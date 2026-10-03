#!/usr/bin/env python3
"""Builds group.ashikanw.com into dist/: /ja-jp/ and /en-us/, from content.py. Run: python3 build.py"""
import html
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from content import COLORS, HISTORY, REPOS, SERVICES, T

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
STATIC = ROOT / "static"
SITE = "https://group.ashikanw.com"
LANGS = ["ja-jp", "en-us"]
BUILD = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def e(s):
    return html.escape(str(s), quote=True)


def url(lang, path=""):
    return f"/{lang}/{path}"


def icon(name):
    paths = {
        "arrow": '<path d="M5 12h14m0 0-5-5m5 5-5 5"/>',
        "ext": '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
        "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
        "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
        "pin": '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
        "server": '<rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M8 7.5h.01M8 16.5h.01"/>',
        "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
        "check": '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
        "github": '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
        "download": '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"/>',
        "spark": '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    }
    return f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths[name]}</svg>'


def keep_phrases(page):
    """Japanese headings and short lines: a space next to a Latin word or number never becomes a line break."""
    def fix(m):
        return re.sub(r">([^<]*)<", lambda t: ">" + re.sub(r"(?<=\S) (?=\S)", " ", t.group(1)) + "<", m.group(0))
    return re.sub(r"<(h1|h2|h3|dt|figcaption|strong)\b[^>]*>.*?</\1>", fix, page, flags=re.S)


# ---------------------------------------------------------------------------------------------
# Page shell
# ---------------------------------------------------------------------------------------------
def header(lang, path, current):
    t = T[lang]
    nav = "".join(
        f'<a href="{url(lang, href)}"{" aria-current=page" if current and href.startswith(current) and "#" not in href else ""}>{e(label)}</a>'
        for href, label in t["nav"])
    other = [l for l in LANGS if l != lang][0]
    return f"""<header class="site-header" id="top">
  <div class="wrap bar">
    <a class="brand" href="{url(lang)}" aria-label="ASHIKA Group"><img src="/assets/mark.png?v={BUILD}" alt="" width="40" height="27"><span>ASHIKA <b>Group</b></span></a>
    <nav class="nav" id="nav" aria-label="{e(t['menu'])}">{nav}</nav>
    <div class="tools">
      <a class="lang" href="{url(other, path)}" hreflang="{T[other]['lang']}" lang="{T[other]['lang']}" data-set-lang="{other}">{icon('globe')}<span>{e(T[other]['name'])}</span></a>
      <button class="icon-btn" id="theme" type="button" aria-label="{e(t['theme'])}" title="{e(t['theme'])}">{icon('sun')}</button>
      <button class="icon-btn menu-btn" id="menu" type="button" aria-label="{e(t['menu'])}" aria-controls="nav" aria-expanded="false">{icon('menu')}</button>
    </div>
  </div>
  <div class="progress" aria-hidden="true"></div>
</header>"""


def footer(lang):
    t = T[lang]
    services = "".join(f'<li><a href="{s["url"]}">{e(s["name"])}</a></li>' for s in SERVICES)
    group = "".join(f'<li><a href="{url(lang, href)}">{e(label)}</a></li>' for href, label in t["footer_links"])
    return f"""<footer class="site-footer">
  <div class="sea" aria-hidden="true">
    <svg class="wave w1" viewBox="0 0 1200 40" preserveAspectRatio="none"><path d="M0 20 Q 75 0 150 20 T 300 20 T 450 20 T 600 20 T 750 20 T 900 20 T 1050 20 T 1200 20 V40 H0z"/></svg>
    <svg class="wave w2" viewBox="0 0 1200 40" preserveAspectRatio="none"><path d="M0 22 Q 100 6 200 22 T 400 22 T 600 22 T 800 22 T 1000 22 T 1200 22 V40 H0z"/></svg>
    <img class="swimmer" src="/assets/seal.png?v={BUILD}" alt="" width="80" height="53">
  </div>
  <div class="wrap foot">
    <div class="foot-brand"><a class="brand" href="{url(lang)}" aria-label="ASHIKA Group"><img src="/assets/mark.png?v={BUILD}" alt="" width="40" height="27"><span>ASHIKA <b>Group</b></span></a><p>{e(t['footer_tag'])}</p></div>
    <div><h2>{e(t['footer_services'])}</h2><ul>{services}</ul></div>
    <div><h2>{e(t['footer_group'])}</h2><ul>{group}</ul></div>
  </div>
  <div class="wrap copy"><span>{e(t['rights'].format(y=datetime.now().year))}</span></div>
</footer>"""


def page(lang, path, title, desc, body, current="", kind="page"):
    t = T[lang]
    full = f"{title} | ASHIKA Group" if title else f"ASHIKA Group — {t['footer_tag']}"
    alternates = "".join(f'<link rel="alternate" hreflang="{T[l]["lang"]}" href="{SITE}{url(l, path)}">' for l in LANGS)
    strings = {k: t[k] for k in ("seal_count", "konami", "copied", "game_score", "game_best", "game_start", "game_again")}
    out = f"""<!doctype html>
<html lang="{t['lang']}" data-lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(full)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{SITE}{url(lang, path)}">{alternates}
<meta property="og:title" content="{e(full)}"><meta property="og:description" content="{e(desc)}"><meta property="og:type" content="website">
<meta property="og:url" content="{SITE}{url(lang, path)}"><meta property="og:image" content="{SITE}/assets/og.png">
<meta name="theme-color" content="#14497e">
<link rel="icon" href="/assets/mark.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v={BUILD}">
<script>document.documentElement.classList.add("js");try{{var m=localStorage.getItem("ashika-theme");if(m)document.documentElement.dataset.theme=m}}catch(e){{}}</script>
</head>
<body data-page="{kind}">
<a class="skip" href="#main">{e(t['skip'])}</a>
{header(lang, path, current)}
<main id="main" tabindex="-1">
{body}
</main>
{footer(lang)}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="strings">{json.dumps(strings, ensure_ascii=False)}</script>
<script src="/assets/main.js?v={BUILD}" defer></script>
</body>
</html>"""
    return keep_phrases(out) if lang == "ja-jp" else out


def write(lang, path, content):
    out = DIST / lang / path / "index.html" if path == "" or path.endswith("/") else DIST / lang / path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------------------------
# Pieces
# ---------------------------------------------------------------------------------------------
MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]


def date_label(lang, iso, fmt="date_fmt"):
    y, m, d = (int(x) for x in iso.split("-"))
    return T[lang][fmt].format(y=y, m=m, d=d, mon=MONTHS[m - 1])


def chars(text, start=0):
    """Each character in its own span, so the heading can run in letter by letter (screen readers get the aria-label)."""
    out, i = [], start
    for n, word in enumerate(text.split(" ")):
        if n:
            out.append(" ")
            i += 1
        letters = "".join(f'<span class="ch" style="--i:{i + k}">{e(ch)}</span>' for k, ch in enumerate(word))
        i += len(word)
        # a Latin word must not break between its letters
        out.append(letters if any(ord(c) > 0x2e80 for c in word) else f'<span class="w">{letters}</span>')
    return "".join(out)


def run_title(lines, tag="h1", cls="run"):
    spans, n = [], 0
    for line in lines:
        spans.append(f'<span class="line" aria-hidden="true">{chars(line, n)}</span>')
        n += len(line)
    cjk = any(ord(c) > 0x2e80 for c in "".join(lines))
    label = "".join(lines) if cjk else " ".join(lines)
    return f'<{tag} class="{cls}" aria-label="{e(label)}">{"".join(spans)}</{tag}>'


def shot(s, lang, eager=False):
    return f"""<figure class="shot"><div class="chrome" aria-hidden="true"><i></i><i></i><i></i><span>{e(s['host'])}</span></div>
<img src="/assets/{s['img']}?v={BUILD}" width="1200" height="750" alt="{e(s['name'])}{' のトップページ' if lang == 'ja-jp' else ' home page'}"{'' if eager else ' loading="lazy"'}></figure>"""


def section_head(kicker, title, lead="", tag="h2"):
    lead_html = f'<p class="lead">{e(lead)}</p>' if lead else ""
    return f'<div class="sec-head rv"><p class="kicker">{e(kicker)}</p><{tag}>{e(title)}</{tag}>{lead_html}</div>'


def page_head(kicker, title, lead, extra=""):
    return f"""<section class="page-head"><div class="flow" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
<div class="wrap"><div class="sec-head"><p class="kicker">{e(kicker)}</p>{run_title([title], 'h1', 'run small')}<p class="lead rise">{e(lead)}</p></div>{extra}</div></section>"""


def profile_table(t):
    rows = "".join(f'<div class="rv"><dt>{e(k)}</dt><dd>{v}</dd></div>' for k, v in t["profile"])
    return f'<dl class="profile">{rows}</dl>'


def org_chart(t):
    units = "".join(f'<li><div class="unit"><span>{e(kind)}</span><strong>{e(name)}</strong></div></li>' for kind, name in t["org_units"])
    role, name = t["org_top"]
    return f"""<figure class="org rv" aria-label="{e(t['org_t'])}">
  <div class="org-top"><span>{e(role)}</span><strong>{e(name)}</strong></div>
  <ul class="org-units">{units}</ul>
</figure>"""


def locations(t):
    cards = []
    for i, (label, place, note) in enumerate(t["loc"]):
        cards.append(f"""<div class="loc rv">{icon('pin' if i == 0 else 'server')}<div><p class="loc-label">{e(label)}</p><h3>{e(place)}</h3><p>{e(note)}</p></div></div>""")
    return f'<div class="locs">{"".join(cards)}</div>'


def contact(lang, t):
    rows = "".join(f'<li><span>{e(what)}</span><a href="{href}">{e(label)} {icon("ext")}</a></li>' for what, href, label in t["contact_rows"])
    return f"""<div class="contact rv">
  <p>{e(t['contact_p'])}</p>
  <ul class="contact-list">{rows}</ul>
  <button class="btn primary magnet" type="button" data-mail="support" data-domain="ashikanw.com">{icon('mail')}{e(t['contact_mail'])}</button>
</div>"""


def ticker(lang):
    t = T[lang]
    other = T["en-us" if lang == "ja-jp" else "ja-jp"]["ticker"]
    item = f'<span>{e(t["ticker"])}</span><img src="/assets/seal.png?v={BUILD}" alt="" width="34" height="23"><span class="alt">{e(other)}</span><i></i>'
    return f'<div class="ticker" aria-hidden="true"><div class="track">{item * 6}</div></div>'


def count_value(v):
    """'30円' -> ('30', '円'); 'OSS' -> None. Numbers count up when the strip comes into view."""
    m = re.match(r"^([¥]?)(\d+)(.*)$", v)
    return (m.group(1), m.group(2), m.group(3)) if m else None


def fact_items(facts):
    out = []
    for v, k in facts:
        c = count_value(v)
        val = f'{e(c[0])}<span class="num" data-to="{c[1]}">{c[1]}</span>{e(c[2])}' if c else e(v)
        out.append(f"<li class=\"rv\"><b>{val}</b><span>{e(k)}</span></li>")
    return "".join(out)


def timeline(lang, entries):
    t = T[lang]
    items = []
    for iso, cat, jt, jx, et, ex, future in entries:
        title, text = (jt, jx) if lang == "ja-jp" else (et, ex)
        badge = f'<span class="badge future">{e(t["future"])}</span>' if future else ""
        items.append(f"""<li class="tl-item rv{' is-future' if future else ''}" data-cat="{cat}">
  <span class="tl-dot" aria-hidden="true"></span>
  <div class="tl-card"><p class="tl-meta"><time datetime="{iso}">{e(date_label(lang, iso))}</time><span class="chip {cat}">{e(t['cat'][cat])}</span>{badge}</p>
  <h3>{e(title)}</h3><p>{e(text)}</p></div>
</li>""")
    return f'<ol class="timeline"><span class="tl-line" aria-hidden="true"><span class="tl-fill"></span></span>{"".join(items)}</ol>'


# ---------------------------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------------------------
def home(lang):
    t = T[lang]
    cards = "".join(f"""<article class="card rv tilt" style="--d:{i}">
  {shot(s, lang)}
  <div class="card-body"><p class="kind">{e(s[lang[:2]]['kind'])}</p><h3>{e(s['name'])}</h3><p>{e(s[lang[:2]]['lead'])}</p>
  <div class="links"><a class="link" href="{url(lang, 'services/')}#{s['key']}">{e(t['more'])} {icon('arrow')}</a><a class="link quiet" href="{s['url']}">{e(t['visit'])} {icon('ext')}</a></div></div>
</article>""" for i, s in enumerate(SERVICES))
    words = "".join(f'<li class="word rv" style="--d:{i}"><b>{e(w)}</b><small>{e(sub)}</small></li>' for i, (w, sub, _) in enumerate(t["words"]))
    recent = [h for h in HISTORY if not h[6]][-3:][::-1]
    sign_role, sign_name = t["msg_sign"]
    body = f"""
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-text">
      <p class="kicker rise">{e(t['hero_k'])}</p>
      {run_title(t['hero_t'])}
      <p class="lead rise" style="--d:2">{e(t['hero_p'])}</p>
      <div class="actions rise" style="--d:3"><a class="btn primary magnet" href="{url(lang, t['hero_cta'][1])}">{e(t['hero_cta'][0])} {icon('arrow')}</a><a class="btn" href="{url(lang, t['hero_cta2'][1])}">{e(t['hero_cta2'][0])}</a></div>
    </div>
    <div class="stage" id="stage">
      <canvas class="globe" id="globe" aria-hidden="true"></canvas>
      <img class="seal" src="/assets/seal.png?v={BUILD}" alt="" width="512" height="339">
      <button class="poke" id="poke" type="button" aria-label="{e(t['seal_hint'])}" title="{e(t['seal_hint'])}"></button>
      <p class="poke-count" id="poke-count" aria-live="polite"></p>
    </div>
  </div>
  <div class="wrap"><ul class="facts">{fact_items(t['facts'])}</ul></div>
</section>
{ticker(lang)}
<section class="sec" id="services">
  <div class="wrap">{section_head(t['biz_k'], t['biz_t'], t['biz_p'])}<div class="cards">{cards}</div></div>
</section>
<section class="sec vision-teaser">
  <div class="wrap">
    {section_head(t['vision_k'], t['footer_tag'], t['vision_p'])}
    <ol class="words">{words}</ol>
    <a class="link rv" href="{url(lang, 'vision/')}">{e(t['vision_t'])} {icon('arrow')}</a>
  </div>
</section>
<section class="sec tint">
  <div class="wrap message-teaser">
    {section_head(t['msg_k'], t['msg_t'])}
    <blockquote class="rv"><p>{e(t['msg_short'])}</p><footer><span>{e(sign_role)}</span><strong>{e(sign_name)}</strong></footer></blockquote>
    <a class="link rv" href="{url(lang, 'about/')}#message">{e(t['more'])} {icon('arrow')}</a>
  </div>
</section>
<section class="sec">
  <div class="wrap split">
    <div>{section_head(t['hist_k'], t['hist_home_t'])}<a class="link rv" href="{url(lang, 'history/')}">{e(t['hist_all'])} {icon('arrow')}</a></div>
    {timeline(lang, recent)}
  </div>
</section>
<section class="sec tint">
  <div class="wrap split">
    <div>{section_head(t['co_k'], t['profile_t'])}<a class="link rv" href="{url(lang, 'about/')}">{e(t['co_t'])} {icon('arrow')}</a></div>
    {profile_table(t)}
  </div>
</section>"""
    return page(lang, "", "", t["desc"], body, "", "home")


def about(lang):
    t = T[lang]
    sign_role, sign_name = t["msg_sign"]
    local = [("message", t["msg_t"]), ("profile", t["profile_t"]), ("organization", t["org_t"]), ("locations", t["loc_t"]), ("contact", t["contact_t"])]
    toc = '<nav class="toc rise" style="--d:2" aria-label="' + e(t["co_t"]) + '">' + "".join(f'<a href="#{a}">{e(label)}</a>' for a, label in local) + "</nav>"
    paragraphs = "".join(f'<p class="rv">{e(p)}</p>' for p in t["msg_body"])
    body = f"""
{page_head(t['co_k'], t['co_t'], t['desc'], toc)}
<section class="sec" id="message"><div class="wrap narrow">
  <h2 class="rv">{e(t['msg_t'])}</h2>
  <div class="message"><p class="message-lead rv">{e(t['msg_short'])}</p>{paragraphs}<p class="sign rv"><span>{e(sign_role)}</span><strong>{e(sign_name)}</strong></p></div>
</div></section>
<section class="sec tint" id="profile"><div class="wrap narrow"><h2 class="rv">{e(t['profile_t'])}</h2>{profile_table(t)}</div></section>
<section class="sec" id="organization"><div class="wrap narrow"><h2 class="rv">{e(t['org_t'])}</h2><p class="lead rv">{e(t['org_p'])}</p>{org_chart(t)}</div></section>
<section class="sec tint" id="locations"><div class="wrap narrow"><h2 class="rv">{e(t['loc_t'])}</h2>{locations(t)}</div></section>
<section class="sec" id="contact"><div class="wrap narrow"><h2 class="rv">{e(t['contact_t'])}</h2>{contact(lang, t)}</div></section>"""
    return page(lang, "about/", t["co_t"], t["desc"], body, "about/")


def services(lang):
    t = T[lang]
    rows = []
    for i, s in enumerate(SERVICES):
        c = s[lang[:2]]
        points = "".join(f'<li class="rv" style="--d:{j}">{icon("check")}<span>{e(p)}</span></li>' for j, p in enumerate(c["points"]))
        rows.append(f"""<section class="biz{' flip' if i % 2 else ''}" id="{s['key']}">
  <div class="biz-text"><p class="kind rv">{e(c['kind'])}</p><h2 class="rv">{e(s['name'])}</h2><p class="lead rv">{e(c['lead'])}</p><ul class="points">{points}</ul>
  <a class="btn primary magnet rv" href="{s['url']}">{e(t['visit'])} {icon('ext')}</a></div>
  <div class="rv slide tilt">{shot(s, lang, eager=i == 0)}</div>
</section>""")
    body = f"""
{page_head(t['biz_k'], t['biz_t'], t['biz_page_p'])}
<div class="wrap biz-list">{''.join(rows)}</div>"""
    return page(lang, "services/", t["biz_t"], t["desc"], body, "services/")


def vision(lang):
    t = T[lang]
    big = f"""<section class="manifesto"><div class="wrap">
  <p class="kicker rv">{e(t['words_t'])}</p>
  <div class="mf-words">{''.join(f'<div class="mf rv" style="--d:{i}"><p class="mf-sub">{e(sub)}</p><h2>{e(w)}</h2><p>{e(txt)}</p></div>' for i, (w, sub, txt) in enumerate(t['words']))}</div>
</div></section>"""
    values = "".join(f"""<li class="value rv tilt" style="--d:{i}"><span class="v-no">{i + 1:02d}</span><h3>{e(name)}</h3><p>{e(txt)}</p></li>""" for i, (name, txt) in enumerate(t["values"]))
    mapping = "".join(f"""<li class="map-item rv" style="--d:{i}"><img src="/assets/{s['img']}?v={BUILD}" alt="" width="1200" height="750" loading="lazy"><div><p class="kind">{e(s['name'])}</p><h3>{e(t['map'][s['key']][0])}</h3><p>{e(t['map'][s['key']][1])}</p></div></li>""" for i, s in enumerate(SERVICES))
    body = f"""
{page_head(t['vision_k'], t['vision_t'], t['vision_p'])}
<section class="slogan" aria-label="{e(t['footer_tag'])}"><div class="wrap">{run_title(t['hero_t'], 'p', 'run huge')}</div><canvas class="streams" id="streams" aria-hidden="true"></canvas></section>
{big}
<section class="sec tint"><div class="wrap"><h2 class="rv">{e(t['values_t'])}</h2><ol class="values">{values}</ol></div></section>
<section class="sec"><div class="wrap"><h2 class="rv">{e(t['map_t'])}</h2><ol class="map">{mapping}</ol></div></section>"""
    return page(lang, "vision/", t["vision_t"], t["vision_p"], body, "vision/", "vision")


def history(lang):
    t = T[lang]
    years = sorted({h[0][:4] for h in HISTORY})
    blocks = []
    for y in years:
        entries = [h for h in HISTORY if h[0].startswith(y)]
        blocks.append(f'<section class="year"><h2 class="year-no rv" data-year="{y}">{y}</h2>{timeline(lang, entries)}</section>')
    body = f"""
{page_head(t['hist_k'], t['hist_t'], t['hist_p'])}
<div class="sec"><div class="wrap narrow">{''.join(blocks)}</div></div>"""
    return page(lang, "history/", t["hist_t"], t["hist_p"], body, "history/", "history")


def technology(lang):
    t = T[lang]
    by_key = {s["key"]: s for s in SERVICES}
    stats = "".join(f'<li class="rv" style="--d:{i}"><b>{f"<span class=num data-to={v}>{v}</span>" if v.isdigit() else e(v)}{e(unit)}</b><span>{e(label)}</span></li>' for i, (v, unit, label) in enumerate(t["tech_stats"]))
    blocks = []
    for key, kind, rows in t["tech"]:
        s = by_key[key]
        dl = "".join(f'<div class="rv" style="--d:{i}"><dt>{e(k)}</dt><dd>{e(v)}</dd></div>' for i, (k, v) in enumerate(rows))
        blocks.append(f"""<article class="tech-block" id="{key}"><header class="rv"><p class="kind">{e(kind)}</p><h2>{e(s['name'])}</h2><a class="link quiet" href="{s['url']}">{e(s['host'])} {icon('ext')}</a></header><dl class="spec">{dl}</dl></article>""")
    web = "".join(f'<div class="rv"><dt>{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in t["web"])
    repos = "".join(f"""<li class="repo rv tilt" style="--d:{i}"><a href="https://github.com/{path}">{icon('github')}<span><b>{e(name)}</b><small>{e(ja if lang == 'ja-jp' else en)}</small></span>{icon('ext')}</a></li>""" for i, (name, path, ja, en) in enumerate(REPOS))
    body = f"""
{page_head(t['tech_k'], t['tech_t'], t['tech_p'])}
<section class="sec"><div class="wrap"><ul class="facts stats">{stats}</ul>
<div class="tech-list">{''.join(blocks)}<article class="tech-block" id="web"><header class="rv"><p class="kind">Web</p><h2>{e(t['web_t'])}</h2></header><dl class="spec">{web}</dl></article></div></div></section>
<section class="sec tint"><div class="wrap"><h2 class="rv">{e(t['oss_t'])}</h2><p class="lead rv">{e(t['oss_p'])}</p><ul class="repos">{repos}</ul></div></section>"""
    return page(lang, "technology/", t["tech_t"], t["tech_p"], body, "technology/", "technology")


def brand(lang):
    t = T[lang]
    rules = "".join(f'<li class="rv" style="--d:{i}"><h3>{e(a)}</h3><p>{e(b)}</p></li>' for i, (a, b) in enumerate(t["rules"]))
    swatches = "".join(f"""<li class="rv" style="--d:{i}"><button class="swatch" type="button" data-copy="{hx}" style="--c:{hx}"><span class="chip-c"></span><b>{e(name)}</b><code>{hx}</code><small>{e(t['color_use'][name])}</small></button></li>""" for i, (name, hx) in enumerate(COLORS))
    dls = "".join(f'<li class="rv"><a class="btn" href="/assets/{fn}" download>{icon("download")}{e(label)}</a></li>' for fn, label in t["dl"])
    body = f"""
{page_head(t['brand_k'], t['brand_t'], t['brand_p'])}
<section class="sec"><div class="wrap split">
  <div><h2 class="rv">{e(t['mark_t'])}</h2><p class="rv">{e(t['mark_p'])}</p><ul class="rules">{rules}</ul></div>
  <div class="mark-boards rv"><div class="board light"><img src="/assets/mark.png?v={BUILD}" alt="ASHIKA Group" width="512" height="339"></div><div class="board dark"><img src="/assets/mark.png?v={BUILD}" alt="" width="512" height="339"></div>
  <div class="board wm"><span class="wordmark">ASHIKA <b>Group</b></span></div></div>
</div></section>
<section class="sec tint"><div class="wrap"><h2 class="rv">{e(t['colors_t'])}</h2><p class="lead rv">{e(t['colors_p'])}</p><ul class="swatches">{swatches}</ul></div></section>
<section class="sec"><div class="wrap split">
  <div><h2 class="rv">{e(t['type_t'])}</h2><p class="rv">{e(t['type_p'])}</p></div>
  <div class="type-sample rv"><p class="ts-ja">情報と世界を駆け巡る</p><p class="ts-en">Across information, around the world.</p><p class="ts-meta">Inter · Noto Sans JP</p></div>
</div></section>
<section class="sec tint"><div class="wrap"><h2 class="rv">{e(t['dl_t'])}</h2><ul class="downloads">{dls}</ul></div></section>"""
    return page(lang, "brand/", t["brand_t"], t["brand_p"], body, "brand/", "brand")


def not_found(lang):
    t = T[lang]
    title, text, back = t["not_found"]
    body = f"""<section class="sec lost"><div class="wrap narrow center"><p class="kicker">404</p><h1>{e(title)}</h1><p class="lead">{e(text)}</p>
<p><a class="btn primary" href="{url(lang)}">{e(back)}</a></p>
<div class="game" id="game"><h2>{e(t['game_t'])}</h2><p>{e(t['game_p'])}</p>
<div class="game-box"><canvas id="game-canvas" aria-label="{e(t['game_t'])}"></canvas><div class="game-hud"><span id="game-score">0</span><span id="game-best"></span></div>
<button class="btn primary game-start" id="game-start" type="button">{e(t['game_start'])}</button></div></div>
</div></section>"""
    return page(lang, "404.html", title, text, body, "", "lost")


def redirect_root():
    return """<!doctype html><meta charset="utf-8"><title>ASHIKA Group</title>
<script>var l=(navigator.language||"ja").toLowerCase().indexOf("ja")===0?"ja-jp":"en-us";try{var s=document.cookie.match(/ashika_lang=([a-z-]+)/);if(s)l=s[1]}catch(e){}location.replace("/"+l+"/")</script>
<noscript><meta http-equiv="refresh" content="0; url=/ja-jp/"></noscript><a href="/ja-jp/">日本語</a> · <a href="/en-us/">English</a>"""


PAGES = [("", home), ("about/", about), ("services/", services), ("vision/", vision), ("history/", history), ("technology/", technology), ("brand/", brand)]


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    (DIST / "assets").mkdir(parents=True)
    for f in STATIC.rglob("*"):
        if f.is_file():
            shutil.copy2(f, DIST / "assets" / f.name)
    for lang in LANGS:
        for path, fn in PAGES:
            write(lang, path, fn(lang))
        write(lang, "404.html", not_found(lang))
    (DIST / "index.html").write_text(redirect_root(), encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n", encoding="utf-8")
    urls = "".join(f"<url><loc>{SITE}{url(l, p)}</loc></url>" for l in LANGS for p, _ in PAGES)
    (DIST / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>', encoding="utf-8")
    print(f"built {sum(1 for _ in DIST.rglob('*.html'))} pages into {DIST}")


if __name__ == "__main__":
    main()
