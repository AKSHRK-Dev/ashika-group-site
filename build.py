#!/usr/bin/env python3
"""Builds group.ashikanw.com into dist/: /ja-jp/ and /en-us/, from content.py. Run: python3 build.py"""
import html
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from content import SERVICES, T

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
</header>"""


def footer(lang):
    t = T[lang]
    services = "".join(f'<li><a href="{s["url"]}">{e(s["name"])}</a></li>' for s in SERVICES)
    group = "".join(f'<li><a href="{url(lang, href)}">{e(label)}</a></li>' for href, label in t["nav"])
    return f"""<footer class="site-footer">
  <div class="wrap foot">
    <div class="foot-brand"><a class="brand" href="{url(lang)}" aria-label="ASHIKA Group"><img src="/assets/mark.png?v={BUILD}" alt="" width="40" height="27"><span>ASHIKA <b>Group</b></span></a><p>{e(t['footer_tag'])}</p></div>
    <div><h2>{e(t['footer_services'])}</h2><ul>{services}</ul></div>
    <div><h2>{e(t['footer_group'])}</h2><ul>{group}</ul></div>
  </div>
  <div class="wrap copy"><span>{e(t['rights'].format(y=datetime.now().year))}</span></div>
</footer>"""


def page(lang, path, title, desc, body, current=""):
    t = T[lang]
    full = f"{title} | ASHIKA Group" if title else f"ASHIKA Group — {t['footer_tag']}"
    alternates = "".join(f'<link rel="alternate" hreflang="{T[l]["lang"]}" href="{SITE}{url(l, path)}">' for l in LANGS)
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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v={BUILD}">
<script>try{{var m=localStorage.getItem("ashika-theme");if(m)document.documentElement.dataset.theme=m}}catch(e){{}}</script>
</head>
<body>
<a class="skip" href="#main">{e(t['skip'])}</a>
{header(lang, path, current)}
<main id="main" tabindex="-1">
{body}
</main>
{footer(lang)}
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
def shot(s, lang, eager=False):
    return f"""<figure class="shot"><div class="chrome" aria-hidden="true"><i></i><i></i><i></i><span>{e(s['host'])}</span></div>
<img src="/assets/{s['img']}?v={BUILD}" width="1200" height="750" alt="{e(s['name'])}{' のトップページ' if lang == 'ja-jp' else ' home page'}"{'' if eager else ' loading="lazy"'}></figure>"""


def section_head(kicker, title, lead="", tag="h2"):
    lead_html = f'<p class="lead">{e(lead)}</p>' if lead else ""
    return f'<div class="sec-head"><p class="kicker">{e(kicker)}</p><{tag}>{e(title)}</{tag}>{lead_html}</div>'


def profile_table(t):
    rows = "".join(f"<div><dt>{e(k)}</dt><dd>{v}</dd></div>" for k, v in t["profile"])
    return f'<dl class="profile">{rows}</dl>'


def org_chart(t):
    units = "".join(f'<li><div class="unit"><span>{e(kind)}</span><strong>{e(name)}</strong></div></li>' for kind, name in t["org_units"])
    role, name = t["org_top"]
    return f"""<figure class="org" aria-label="{e(t['org_t'])}">
  <div class="org-top"><span>{e(role)}</span><strong>{e(name)}</strong></div>
  <ul class="org-units">{units}</ul>
</figure>"""


def locations(t):
    cards = []
    for i, (label, place, note) in enumerate(t["loc"]):
        cards.append(f"""<div class="loc">{icon('pin' if i == 0 else 'server')}<div><p class="loc-label">{e(label)}</p><h3>{e(place)}</h3><p>{e(note)}</p></div></div>""")
    return f'<div class="locs">{"".join(cards)}</div>'


def contact(lang, t):
    rows = "".join(f'<li><span>{e(what)}</span><a href="{href}">{e(label)} {icon("ext")}</a></li>' for what, href, label in t["contact_rows"])
    return f"""<div class="contact">
  <p>{e(t['contact_p'])}</p>
  <ul class="contact-list">{rows}</ul>
  <button class="btn primary" type="button" data-mail="support" data-domain="ashikanw.com">{icon('mail')}{e(t['contact_mail'])}</button>
</div>"""


# ---------------------------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------------------------
def home(lang):
    t = T[lang]
    facts = "".join(f"<li><b>{e(v)}</b><span>{e(k)}</span></li>" for v, k in t["facts"])
    cards = "".join(f"""<article class="card">
  {shot(s, lang)}
  <div class="card-body"><p class="kind">{e(s[lang[:2]]['kind'])}</p><h3>{e(s['name'])}</h3><p>{e(s[lang[:2]]['lead'])}</p>
  <div class="links"><a class="link" href="{url(lang, 'services/')}#{s['key']}">{e(t['more'])} {icon('arrow')}</a><a class="link quiet" href="{s['url']}">{e(t['visit'])} {icon('ext')}</a></div></div>
</article>""" for s in SERVICES)
    sign_role, sign_name = t["msg_sign"]
    body = f"""
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-text">
      <p class="kicker">{e(t['hero_k'])}</p>
      <h1>{''.join(f'<span>{e(x)}</span>' for x in t['hero_t'])}</h1>
      <p class="lead">{e(t['hero_p'])}</p>
      <div class="actions"><a class="btn primary" href="{url(lang, t['hero_cta'][1])}">{e(t['hero_cta'][0])} {icon('arrow')}</a><a class="btn" href="{url(lang, t['hero_cta2'][1])}">{e(t['hero_cta2'][0])}</a></div>
    </div>
    <div class="hero-art" aria-hidden="true"><div class="ring"></div><img src="/assets/mark.png?v={BUILD}" alt="" width="512" height="339"></div>
  </div>
  <div class="wrap"><ul class="facts">{facts}</ul></div>
</section>
<section class="sec" id="services">
  <div class="wrap">{section_head(t['biz_k'], t['biz_t'], t['biz_p'])}<div class="cards">{cards}</div></div>
</section>
<section class="sec tint">
  <div class="wrap message-teaser">
    {section_head(t['msg_k'], t['msg_t'])}
    <blockquote><p>{e(t['msg_short'])}</p><footer><span>{e(sign_role)}</span><strong>{e(sign_name)}</strong></footer></blockquote>
    <a class="link" href="{url(lang, 'about/')}#message">{e(t['more'])} {icon('arrow')}</a>
  </div>
</section>
<section class="sec">
  <div class="wrap split">
    <div>{section_head(t['co_k'], t['profile_t'])}<a class="link" href="{url(lang, 'about/')}">{e(t['co_t'])} {icon('arrow')}</a></div>
    {profile_table(t)}
  </div>
</section>"""
    return page(lang, "", "", t["desc"], body, "")


def about(lang):
    t = T[lang]
    sign_role, sign_name = t["msg_sign"]
    local = [("message", t["msg_t"]), ("profile", t["profile_t"]), ("organization", t["org_t"]), ("locations", t["loc_t"]), ("contact", t["contact_t"])]
    toc = "".join(f'<a href="#{a}">{e(label)}</a>' for a, label in local)
    paragraphs = "".join(f"<p>{e(p)}</p>" for p in t["msg_body"])
    body = f"""
<section class="page-head"><div class="wrap">{section_head(t['co_k'], t['co_t'], tag='h1')}<nav class="toc" aria-label="{e(t['co_t'])}">{toc}</nav></div></section>
<section class="sec" id="message"><div class="wrap narrow">
  <h2>{e(t['msg_t'])}</h2>
  <div class="message"><p class="message-lead">{e(t['msg_short'])}</p>{paragraphs}<p class="sign"><span>{e(sign_role)}</span><strong>{e(sign_name)}</strong></p></div>
</div></section>
<section class="sec tint" id="profile"><div class="wrap narrow"><h2>{e(t['profile_t'])}</h2>{profile_table(t)}</div></section>
<section class="sec" id="organization"><div class="wrap narrow"><h2>{e(t['org_t'])}</h2><p class="lead">{e(t['org_p'])}</p>{org_chart(t)}</div></section>
<section class="sec tint" id="locations"><div class="wrap narrow"><h2>{e(t['loc_t'])}</h2>{locations(t)}</div></section>
<section class="sec" id="contact"><div class="wrap narrow"><h2>{e(t['contact_t'])}</h2>{contact(lang, t)}</div></section>"""
    return page(lang, "about/", t["co_t"], t["desc"], body, "about/")


def services(lang):
    t = T[lang]
    rows = []
    for i, s in enumerate(SERVICES):
        c = s[lang[:2]]
        points = "".join(f"<li>{icon('check')}<span>{e(p)}</span></li>" for p in c["points"])
        rows.append(f"""<section class="biz{' flip' if i % 2 else ''}" id="{s['key']}">
  <div class="biz-text"><p class="kind">{e(c['kind'])}</p><h2>{e(s['name'])}</h2><p class="lead">{e(c['lead'])}</p><ul class="points">{points}</ul>
  <a class="btn primary" href="{s['url']}">{e(t['visit'])} {icon('ext')}</a></div>
  {shot(s, lang, eager=i == 0)}
</section>""")
    body = f"""
<section class="page-head"><div class="wrap">{section_head(t['biz_k'], t['biz_t'], t['biz_page_p'], tag='h1')}</div></section>
<div class="wrap biz-list">{''.join(rows)}</div>"""
    return page(lang, "services/", t["biz_t"], t["desc"], body, "services/")


def not_found(lang):
    t = T[lang]
    title, text, back = t["not_found"]
    body = f"""<section class="sec"><div class="wrap narrow center"><p class="kicker">404</p><h1>{e(title)}</h1><p class="lead">{e(text)}</p>
<p><a class="btn primary" href="{url(lang)}">{e(back)}</a></p></div></section>"""
    return page(lang, "404.html", title, text, body)


def redirect_root():
    return """<!doctype html><meta charset="utf-8"><title>ASHIKA Group</title>
<script>var l=(navigator.language||"ja").toLowerCase().indexOf("ja")===0?"ja-jp":"en-us";try{var s=document.cookie.match(/ashika_lang=([a-z-]+)/);if(s)l=s[1]}catch(e){}location.replace("/"+l+"/")</script>
<noscript><meta http-equiv="refresh" content="0; url=/ja-jp/"></noscript><a href="/ja-jp/">日本語</a> · <a href="/en-us/">English</a>"""


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    (DIST / "assets").mkdir(parents=True)
    for f in STATIC.rglob("*"):
        if f.is_file():
            shutil.copy2(f, DIST / "assets" / f.name)
    for lang in LANGS:
        write(lang, "", home(lang))
        write(lang, "about/", about(lang))
        write(lang, "services/", services(lang))
        write(lang, "404.html", not_found(lang))
    (DIST / "index.html").write_text(redirect_root(), encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n", encoding="utf-8")
    urls = "".join(f"<url><loc>{SITE}{url(l, p)}</loc></url>" for l in LANGS for p in ("", "services/", "about/"))
    (DIST / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>', encoding="utf-8")
    print(f"built {sum(1 for _ in DIST.rglob('*.html'))} pages into {DIST}")


if __name__ == "__main__":
    main()
