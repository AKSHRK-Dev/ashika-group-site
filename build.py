#!/usr/bin/env python3
"""Builds group.ashikanw.com into dist/: /ja-jp/ and /en-us/, from content.py. Run: python3 build.py"""
import html
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from content import (COLORS, HISTORY, JOIN_SERVERS, REPOS, SERVICES, SUPPORT_NONPROFIT_SERVERS, SUPPORT_PERSONAL_SERVERS,
                     SUPPORT_TERMS_DATE, TERMS_DATE, T)

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
        "code": '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M13.5 5l-3 14"/>',
        "chat": '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/>',
        "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
        "palette": '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.7 1.3-3 3-3h1a3 3 0 0 0 3-3c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>',
        "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
        "heart": '<path d="M12 20s-7.5-4.6-9-9.5C2 7 4.3 4 7.5 4c2 0 3.5 1.2 4.5 2.7C13 5.2 14.5 4 16.5 4 19.7 4 22 7 21 10.5 19.5 15.4 12 20 12 20z"/>',
        "doc": '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15.5h6M9 9h2"/>',
        "spark": '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    }
    return f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths[name]}</svg>'


def keep_phrases(page):
    """Japanese headings and short lines: a space next to a Latin word or number never becomes a line break."""
    def fix(m):
        return re.sub(r">([^<]*)<", lambda t: ">" + re.sub(r"(?<=\S) (?=\S)", " ", t.group(1)) + "<", m.group(0))
    return re.sub(r"<(h1|h2|h3|dt|figcaption|strong)\b[^>]*>.*?</\1>", fix, page, flags=re.S)


# ---------------------------------------------------------------------------------------------
# 2026-11 の作り直しで足した短い文言。長い説明は出さない方針（説明は分かりにくいところだけ）。
# ---------------------------------------------------------------------------------------------
V2 = {
    "ja-jp": {
        "about_k": "About", "about_t": "ASHIKA Group とは",
        "news_k": "News",
        "sp_line": f"非営利団体 {SUPPORT_NONPROFIT_SERVERS} 台・個人 {SUPPORT_PERSONAL_SERVERS} 台まで無料",
        "join_line": f"参加中はサーバー {JOIN_SERVERS} 台まで無料",
        "notes_t": "出典", "type_p": "欧文は Atkinson Hyperlegible Next、和文は BIZ UDPGothic を使っています。",
        "shot_alt": " のトップページ", "server_alt": "サーバーの内部。CPU のヒートシンク、メモリスロット、冷却ファン",
    },
    "en-us": {
        "about_k": "About", "about_t": "What is ASHIKA Group?",
        "news_k": "News",
        "sp_line": f"Free: up to {SUPPORT_NONPROFIT_SERVERS} servers for nonprofits, {SUPPORT_PERSONAL_SERVERS} for individuals",
        "join_line": f"Up to {JOIN_SERVERS} free servers while you take part",
        "notes_t": "Sources", "type_p": "Atkinson Hyperlegible Next for Latin text, BIZ UDPGothic for Japanese.",
        "shot_alt": " home page", "server_alt": "Inside a server: CPU heatsinks, memory slots and cooling fans",
    },
}


# ---------------------------------------------------------------------------------------------
# Page shell
# ---------------------------------------------------------------------------------------------
def brand_link(lang):
    return f'<a class="brand" href="{url(lang)}" aria-label="ASHIKA Group"><img src="/assets/mark.png?v={BUILD}" alt="" width="40" height="27"><span>ASHIKA <b>Group</b></span></a>'


def header(lang, path, current):
    t = T[lang]
    links = "".join(
        f'<a href="{url(lang, href)}"{" aria-current=page" if current and href.startswith(current) else ""}>{e(label)}</a>'
        for href, label in t["nav"])
    other = [l for l in LANGS if l != lang][0]
    lang_link = f'<a class="lang" href="{url(other, path)}" hreflang="{T[other]["lang"]}" lang="{T[other]["lang"]}" data-set-lang="{other}">{icon("globe")}<span>{e(T[other]["name"])}</span></a>'
    # スマホのメニューは <details>（JS なしで開閉できる）
    return f"""<header class="site-header" id="top">
  <div class="wrap bar">
    {brand_link(lang)}
    <nav class="nav" aria-label="{e(t['menu'])}">{links}</nav>
    {lang_link}
    <details class="menu"><summary>{icon('menu')}<span>{e(t['menu'])}</span></summary><nav aria-label="{e(t['menu'])}">{links}</nav></details>
  </div>
</header>"""


def footer(lang, notes=()):
    t = T[lang]
    services = "".join(f'<a href="{s["url"]}">{e(s["name"])}</a>' for s in SERVICES)
    group = "".join(f'<a href="{url(lang, href)}">{e(label)}</a>' for href, label in t["footer_links"])
    notes_html = ""
    if notes:
        items = "".join(f"<p>{e(n)}</p>" for n in notes)
        notes_html = f'<section class="notes" aria-label="{e(V2[lang]["notes_t"])}"><div class="wrap"><h2>{e(V2[lang]["notes_t"])}</h2>{items}</div></section>'
    return f"""{notes_html}<footer class="site-footer">
  <div class="wrap foot">
    <div class="foot-brand">{brand_link(lang)}<p>{e(t['footer_tag'])}</p></div>
    <div class="foot-links">
      <div><h2>{e(t['footer_services'])}</h2><p>{services}</p></div>
      <div><h2>{e(t['footer_group'])}</h2><p>{group}</p></div>
    </div>
  </div>
  <div class="wrap copy"><span>{e(t['rights'].format(y=datetime.now().year))}</span><a href="#top">{e(t['top_label'])}</a></div>
</footer>"""


def page(lang, path, title, desc, body, current="", kind="page", notes=()):
    t = T[lang]
    full = f"{title} | ASHIKA Group" if title else f"ASHIKA Group — {t['footer_tag']}"
    alternates = "".join(f'<link rel="alternate" hreflang="{T[l]["lang"]}" href="{SITE}{url(l, path)}">' for l in LANGS)
    strings = {k: t[k] for k in ("copied", "game_t", "game_how", "game_start", "game_again", "game_over", "game_result", "game_new_best",
                                 "game_paused", "game_resume_hint", "game_resume", "game_combo", "game_share_text")}
    strings["game_url"] = url(lang, "game/")
    game_js = f'<script src="/assets/game.js?v={BUILD}" defer></script>' if kind in ("game", "lost") else ""
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
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;700&family=BIZ+UDPGothic:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v={BUILD}">
</head>
<body data-page="{kind}">
<a class="skip" href="#main">{e(t['skip'])}</a>
{header(lang, path, current)}
<main id="main" tabindex="-1">
{body}
</main>
{footer(lang, notes)}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="strings">{json.dumps(strings, ensure_ascii=False)}</script>
<script src="/assets/main.js?v={BUILD}" defer></script>{game_js}
</body>
</html>"""
    return keep_phrases(out) if lang == "ja-jp" else out


# 代表者の氏名は文字で書かず、画像で出す（検索エンジンに拾わせないため。画像の場所は robots.txt で断る）。
# 画像は文字の形だけ（透明の上に黒）で、CSS の mask で塗るので、まわりの文字色になる。
NAME_IMAGES = {
    "[[NAME_JA_B]]": ("name-ja-b", 275, 77, "代表者の氏名（画像）"),
    "[[NAME_JA_KANA]]": ("name-ja-kana", 801, 77, "代表者の氏名とよみ（画像）"),
    "[[NAME_EN_B]]": ("name-en-b", 458, 77, "Representative's name (image)"),
    "[[NAME_EN]]": ("name-en", 431, 77, "Representative's name (image)"),
}


def name_images(html_text):
    for token, (file, w, h, label) in NAME_IMAGES.items():
        tag = f'<i class="name-img" role="img" aria-label="{e(label)}" style="--ar:{w}/{h};--src:url(/assets/{file}.png?v={BUILD})"></i>'
        html_text = html_text.replace(token, tag)
    return html_text


def write(lang, path, content):
    out = DIST / lang / path / "index.html" if path == "" or path.endswith("/") else DIST / lang / path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(name_images(content), encoding="utf-8")


# ---------------------------------------------------------------------------------------------
# Pieces（どのページも、ここの少ない部品だけで組む）
# ---------------------------------------------------------------------------------------------
MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]


def date_label(lang, iso, fmt="date_fmt"):
    y, m, d = (int(x) for x in iso.split("-"))
    return T[lang][fmt].format(y=y, m=m, d=d, mon=MONTHS[m - 1])


def head(kicker, title, tag="h2"):
    """小さな英字の札 + 見出し。説明文は付けない。"""
    return f'<div class="head"><p class="kicker">{e(kicker)}</p><{tag}>{e(title)}</{tag}></div>'


def page_head(kicker, title, extra=""):
    return f'<section class="page-head"><div class="wrap">{head(kicker, title, "h1")}{extra}</div></section>'


def sec(inner, cls="", id_=""):
    attr = f' id="{id_}"' if id_ else ""
    return f'<section class="sec{" " + cls if cls else ""}"{attr}><div class="wrap">{inner}</div></section>'


def rows(pairs, raw=False):
    """項目名と内容の表（罫線だけ）。"""
    return '<dl class="rows">' + "".join(f"<div><dt>{e(k)}</dt><dd>{v if raw else e(v)}</dd></div>" for k, v in pairs) + "</dl>"


def ticks(items):
    return '<ul class="ticks">' + "".join(f"<li>{icon('check')}<span>{e(x)}</span></li>" for x in items) + "</ul>"


def plain_list(items):
    return '<ul class="list">' + "".join(f"<li>{e(x)}</li>" for x in items) + "</ul>"


def steps(items):
    return '<ol class="steps">' + "".join(f'<li><span class="no">{i + 1}</span><div><h3>{e(a)}</h3><p>{e(b)}</p></div></li>' for i, (a, b) in enumerate(items)) + "</ol>"


def faqs(items):
    return '<div class="faqs">' + "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in items) + "</div>"


def shot(s, lang, eager=False):
    lazy = "" if eager else ' loading="lazy"'
    return f'<figure class="shot"><img src="/assets/{s["img"]}?v={BUILD}" width="1200" height="750" alt="{e(s["name"])}{V2[lang]["shot_alt"]}"{lazy}></figure>'


def toc(pairs, label):
    return f'<nav class="toc" aria-label="{e(label)}">' + "".join(f'<a href="#{a}">{e(x)}</a>' for a, x in pairs) + "</nav>"


def mail_button(label, subject=""):
    sub = f' data-subject="{e(subject)}"' if subject else ""
    return f'<button class="btn primary" type="button" data-mail="support" data-domain="ashikanw.com"{sub}>{icon("mail")}{e(label)}</button>'


def discord_button(label):
    return f'<a class="btn" href="https://link.ashikanw.com/discord">{icon("chat")}{e(label)}</a>'


def more_link(href, label, ic="arrow"):
    return f'<a class="link" href="{href}">{e(label)} {icon(ic)}</a>'


def timeline(lang, entries):
    t = T[lang]
    items = []
    for iso, cat, jt, jx, et, ex, future in entries:
        title, text = (jt, jx) if lang == "ja-jp" else (et, ex)
        badge = f'<span class="chip future">{e(t["future"])}</span>' if future else ""
        items.append(f'<li><p class="meta"><time datetime="{iso}">{e(date_label(lang, iso))}</time><span class="chip">{e(t["cat"][cat])}</span>{badge}</p>'
                     f"<h3>{e(title)}</h3><p>{e(text)}</p></li>")
    return f'<ol class="timeline">{"".join(items)}</ol>'


def service_list(lang, detail=False):
    """番号つきのサービス一覧。画面の画像は出さず、1行＝1サービスの短い並びにする（行ごと押せる）。
    detail のときは特徴も出す（サービスのページ）。"""
    t = T[lang]
    out = []
    for i, s in enumerate(SERVICES):
        c = s[lang[:2]]
        extra = ticks(c["points"]) if detail else ""
        out.append(f"""<li class="svc" id="{s['key']}">
  <a class="svc-link" href="{s['url']}"><span class="no">{i + 1:02d}</span><span class="svc-name"><b>{e(s['name'])}</b><span class="kind">{e(c['kind'])}</span></span><span class="svc-host">{e(s['host'])}</span>{icon('ext')}</a>{extra}
</li>""")
    return f'<ol class="svcs{" detail" if detail else ""}">{"".join(out)}</ol>'


# ---------------------------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------------------------
def home(lang):
    t, v = T[lang], V2[lang]
    ja = lang == "ja-jp"
    recent = [h for h in HISTORY if not h[6]][-4:][::-1]
    news = "".join(f'<li><a href="{url(lang, "history/")}"><time datetime="{iso}">{e(date_label(lang, iso))}</time><span class="chip">{e(t["cat"][cat])}</span>'
                   f'<span class="news-t">{e(jt if ja else et)}</span>{icon("arrow")}</a></li>'
                   for iso, cat, jt, jx, et, ex, _ in recent)
    facts = "".join(f"<li><b>{e(a)}</b><span>{e(k)}</span></li>" for a, k in t["facts"])
    title = "".join(f"<span>{e(line)}</span>" for line in t["hero_t"])
    body = f"""
<section class="hero" style="--photo:url(/assets/hero-osaka.webp?v={BUILD})">
  <p class="hero-word" aria-hidden="true">ASHIKA GROUP</p>
  <div class="wrap hero-in">
    <div class="hero-copy">
      <h1>{title}</h1>
      <a class="btn primary" href="{url(lang, t['hero_cta'][1])}">{e(t['hero_cta'][0])} {icon('arrow')}</a>
    </div>
    <div class="hero-art" aria-hidden="true"><span class="seal"></span></div>
  </div>
</section>
<section class="sec">
  <div class="wrap two">
    {head(v['about_k'], v['about_t'])}
    <div>
      <p class="statement">{e(t['hero_p'])}</p>
      <ul class="facts">{facts}</ul>
      {more_link(url(lang, 'about/'), t['more'])}
    </div>
  </div>
</section>
<section class="sec tint arc" id="services">
  <div class="wrap">{head(t['biz_k'], t['biz_t'])}{service_list(lang)}</div>
</section>
<section class="sec" id="news">
  <div class="wrap two">
    {head(v['news_k'], t['hist_home_t'])}
    <div><ul class="news">{news}</ul>{more_link(url(lang, 'history/'), t['hist_all'])}</div>
  </div>
</section>
<section class="sec doors-sec">
  <div class="wrap doors">
    <a class="door" href="{url(lang, 'supportprogram/')}"><span class="kicker">{e(t['sp_k'])}</span><b>{e(t['sp_t'])}</b><span>{e(v['sp_line'])}</span>{icon('arrow')}</a>
    <a class="door" href="{url(lang, 'join/')}"><span class="kicker">{e(t['join_k'])}</span><b>{e(t['join_t'])}</b><span>{e(v['join_line'])}</span>{icon('arrow')}</a>
  </div>
</section>"""
    return page(lang, "", "", t["desc"], body, "", "home", notes=[t["sat_credit"]])


def about(lang):
    t = T[lang]
    sign_role, sign_name = t["msg_sign"]
    local = [("message", t["msg_t"]), ("profile", t["profile_t"]), ("organization", t["org_t"]), ("locations", t["loc_t"]), ("contact", t["contact_t"])]
    paragraphs = "".join(f"<p>{e(p)}</p>" for p in t["msg_body"])
    units = "".join(f"<li><span>{e(kind)}</span><strong>{e(name)}</strong></li>" for kind, name in t["org_units"])
    role, name = t["org_top"]
    org = f'<figure class="org" aria-label="{e(t["org_t"])}"><div class="org-top"><span>{e(role)}</span><strong>{e(name)}</strong></div><ul>{units}</ul></figure>'
    contact = rows([(what, f'<a href="{href}">{e(label)} {icon("ext")}</a>') for what, href, label in t["contact_rows"]], raw=True)
    message = (f'<h2>{e(t["msg_t"])}</h2><div class="message"><p class="statement">{e(t["msg_short"])}</p>{paragraphs}'
               f'<p class="sign"><span>{e(sign_role)}</span><strong>{e(sign_name)}</strong></p></div>')
    body = "\n".join([
        page_head(t["co_k"], t["co_t"], toc(local, t["co_t"])),
        sec(message, "narrow", "message"),
        sec(f'<h2>{e(t["profile_t"])}</h2>{rows(t["profile"], raw=True)}', "narrow tint", "profile"),
        sec(f'<h2>{e(t["org_t"])}</h2>{org}', "narrow", "organization"),
        sec(f'<h2>{e(t["loc_t"])}</h2>{rows([(label, place) for label, place, _ in t["loc"]])}', "narrow tint", "locations"),
        sec(f'<h2>{e(t["contact_t"])}</h2>{contact}<p class="actions">{mail_button(t["contact_mail"])}</p>', "narrow", "contact"),
    ])
    return page(lang, "about/", t["co_t"], t["desc"], body, "about/")


def services(lang):
    t = T[lang]
    body = page_head(t["biz_k"], t["biz_t"]) + sec(service_list(lang, detail=True))
    return page(lang, "services/", t["biz_t"], t["desc"], body, "services/")


def vision(lang):
    t = T[lang]
    words = "".join(f'<li><p class="kicker">{e(sub)}</p><h3>{e(w)}</h3><p>{e(txt)}</p></li>' for w, sub, txt in t["words"])
    values = "".join(f'<li><span class="no">{i + 1:02d}</span><h3>{e(name)}</h3><p>{e(txt)}</p></li>' for i, (name, txt) in enumerate(t["values"]))
    mapping = rows([(s["name"], t["map"][s["key"]][0]) for s in SERVICES])
    slogan = "".join(f"<span>{e(line)}</span>" for line in t["hero_t"])
    body = "\n".join([
        page_head(t["vision_k"], t["vision_t"]),
        f'<section class="slogan"><div class="wrap"><p>{slogan}</p></div></section>',
        sec(f'<h2>{e(t["words_t"])}</h2><ul class="cards three">{words}</ul>'),
        sec(f'<h2>{e(t["values_t"])}</h2><ol class="cards">{values}</ol>', "tint"),
        sec(f'<h2>{e(t["map_t"])}</h2>{mapping}', "narrow"),
    ])
    return page(lang, "vision/", t["vision_t"], t["vision_p"], body, "vision/")


def history(lang):
    t = T[lang]
    years = sorted({h[0][:4] for h in HISTORY}, reverse=True)
    blocks = "".join(f'<section class="year"><h2>{y}</h2>{timeline(lang, [h for h in HISTORY if h[0].startswith(y)][::-1])}</section>' for y in years)
    body = page_head(t["hist_k"], t["hist_t"]) + sec(blocks, "narrow")
    return page(lang, "history/", t["hist_t"], t["hist_p"], body, "history/")


def technology(lang):
    t = T[lang]
    by_key = {s["key"]: s for s in SERVICES}
    stats = "".join(f"<li><b>{e(a)}{e(unit)}</b><span>{e(label)}</span></li>" for a, unit, label in t["tech_stats"])
    blocks = "".join(f'<article class="tech" id="{key}"><header><p class="kicker">{e(kind)}</p><h2>{e(by_key[key]["name"])}</h2></header>{rows(items)}</article>'
                     for key, kind, items in t["tech"])
    blocks += f'<article class="tech" id="web"><header><p class="kicker">Web</p><h2>{e(t["web_t"])}</h2></header>{rows(t["web"])}</article>'
    repos = "".join(f'<li><a href="https://github.com/{path}">{icon("github")}<span><b>{e(name)}</b><small>{e(ja if lang == "ja-jp" else en)}</small></span>{icon("ext")}</a></li>'
                    for name, path, ja, en in REPOS)
    body = "\n".join([
        page_head(t["tech_k"], t["tech_t"]),
        # 自前のサーバーの中の写真。ラベル（シリアル番号・管理用の初期パスワード）と床が写らない範囲だけを切り出してある
        f'<div class="wrap"><figure class="photo"><img src="/assets/server-inside.webp?v={BUILD}" width="880" height="480" alt="{e(V2[lang]["server_alt"])}"></figure></div>',
        sec(f'<ul class="facts">{stats}</ul>{blocks}'),
        sec(f'<h2>{e(t["oss_t"])}</h2><ul class="repos">{repos}</ul>', "tint"),
    ])
    return page(lang, "technology/", t["tech_t"], t["tech_p"], body, "technology/")


def brand(lang):
    t = T[lang]
    swatches = "".join(f'<li><button class="swatch" type="button" data-copy="{hx}"><span class="swatch-c" style="background:{hx}"></span><b>{e(name)}</b><code>{hx}</code>'
                       f'<small>{e(t["color_use"][name])}</small></button></li>' for name, hx in COLORS)
    dls = "".join(f'<a class="btn" href="/assets/{fn}" download>{icon("download")}{e(label)}</a>' for fn, label in t["dl"])
    boards = (f'<div class="boards"><div class="board"><img src="/assets/mark.png?v={BUILD}" alt="ASHIKA Group" width="512" height="339"></div>'
              f'<div class="board dark"><img src="/assets/mark.png?v={BUILD}" alt="" width="512" height="339"></div></div>')
    sample = '<div class="type-sample"><p class="ts-ja">情報と世界を駆け巡る</p><p class="ts-en">Across information, around the world.</p></div>'
    body = "\n".join([
        page_head(t["brand_k"], t["brand_t"]),
        sec(f'<h2>{e(t["mark_t"])}</h2>{boards}<h3>{e(t["rules_t"])}</h3>{rows(t["rules"])}', "narrow"),
        sec(f'<h2>{e(t["colors_t"])}</h2><p class="hint">{e(t["colors_p"])}</p><ul class="swatches">{swatches}</ul>', "narrow tint"),
        sec(f'<h2>{e(t["type_t"])}</h2>{sample}<p class="hint">{e(V2[lang]["type_p"])}</p>', "narrow"),
        sec(f'<h2>{e(t["dl_t"])}</h2><p class="actions">{dls}</p>', "narrow tint"),
    ])
    return page(lang, "brand/", t["brand_t"], t["brand_p"], body, "brand/")


def join(lang):
    t = T[lang]
    roles = "".join(f'<li id="{key}"><p class="kicker">{e(sub)}</p><h3>{e(name)}</h3>{ticks(tasks)}<p class="want"><b>{e(t["roles_want"])}</b>{e(want)}</p></li>'
                    for key, name, sub, lead, tasks, want in t["roles"])
    perks = ticks([a for _, a, _ in t["perks"]])  # 見出しだけで伝わるので、説明は出さない
    must = f'<span class="must">{e(t["apply_must"])}</span>'
    apply_items = "".join(f"<li>{e(x)}{must if need else ''}</li>" for x, need in t["apply_items"])
    subject = "お手伝い応募" if lang == "ja-jp" else "Joining ASHIKA Group"
    apply = (f'<div class="two"><div><h2>{e(t["steps_t"])}</h2>{steps(t["steps"])}</div>'
             f'<div class="box"><h2>{e(t["apply_t"])}</h2><p class="req"><span>{e(t["apply_req_k"])}</span><b>{e(t["apply_req"])}</b></p><p>{e(t["apply_p"])}</p>'
             f'<ul class="list">{apply_items}</ul><p class="hint">{e(t["apply_note"])}</p>'
             f'<p class="actions">{mail_button(t["apply_mail"], subject)}{discord_button(t["apply_discord"])}</p></div></div>')
    fine = f'<div class="fine"><h2>{e(t["disclaimer_t"])}</h2>{plain_list(t["disclaimer"])}{more_link(url(lang, "join/terms/"), t["terms_link"])}</div>'
    body = "\n".join([
        page_head(t["join_k"], t["join_t"], f'<p><span class="chip open">{e(t["join_open"])}</span></p>'),
        sec(f'<h2>{e(t["roles_t"])}</h2><ul class="cards two-col">{roles}</ul>'),
        sec(f'<h2>{e(t["perks_t"])}</h2>{perks}', "narrow tint"),
        sec(apply, "", "apply"),
        sec(f'<h2>{e(t["join_faq_t"])}</h2>{faqs(t["join_faq"])}', "narrow tint"),
        sec(fine, "narrow"),
    ])
    return page(lang, "join/", t["join_t"], t["join_p"], body, "join/")


def terms_page(lang, path, current, kicker, title, lead, dated, date, articles, back_path, back_label):
    """Terms with numbered articles (member terms, support program terms)."""
    t = T[lang]
    nav = toc([(f"a{n}", t["terms_article"].format(n=n)) for n in range(1, len(articles) + 1)], title)
    sections = []
    for n, (name, clauses) in enumerate(articles, 1):
        h = f'{t["terms_article"].format(n=n)}（{name}）' if lang == "ja-jp" else f'{t["terms_article"].format(n=n)}. {name}'
        sections.append(f'<section id="a{n}"><h2>{e(h)}</h2><ol>{"".join(f"<li>{e(c)}</li>" for c in clauses)}</ol></section>')
    inner = (f'<p class="hint"><time datetime="{date}">{e(dated)}</time></p><div class="terms">{"".join(sections)}</div>'
             f'{more_link(url(lang, back_path), back_label)}')
    body = page_head(kicker, title, nav) + sec(inner, "narrow")
    return page(lang, path, title, lead, body, current, "terms")


def join_terms(lang):
    t = T[lang]
    return terms_page(lang, "join/terms/", "join/", t["terms_k"], t["terms_t"], t["terms_p"], t["terms_dated"], TERMS_DATE,
                      t["terms"], "join/", t["terms_back"])


def support(lang):
    t = T[lang]
    cards = []
    for key, name, sub, count, lead, who, need in t["sp_programs"]:
        note = f'<p class="hint">{e(t["sp_hardship_note"])}</p>' if key == "personal" else ""
        cards.append(f'<li id="{key}"><p class="big"><b>{count}</b><span>{e(t["sp_unit"])}</span></p><p class="kicker">{e(sub)}</p><h3>{e(name)}</h3>'
                     f'<h4>{e(t["sp_who"])}</h4>{ticks(who)}<h4>{e(t["sp_need"])}</h4>{plain_list(need)}{note}</li>')
    subject = "支援プログラム申請" if lang == "ja-jp" else "Support program application"
    fine = f'<div class="fine"><h2>{e(t["sp_notes_t"])}</h2>{plain_list(t["sp_notes"])}{more_link(url(lang, "supportprogram/terms/"), t["sp_terms_link"])}</div>'
    body = "\n".join([
        page_head(t["sp_k"], t["sp_t"]),
        sec(f'<h2>{e(t["sp_programs_t"])}</h2><ul class="cards two-col">{"".join(cards)}</ul>'),
        sec(f'<h2>{e(t["sp_steps_t"])}</h2>{steps(t["sp_steps"])}<p class="actions">{mail_button(t["sp_apply_mail"], subject)}{discord_button(t["sp_apply_discord"])}</p>', "narrow tint", "apply"),
        sec(f'<h2>{e(t["sp_faq_t"])}</h2>{faqs(t["sp_faq"])}', "narrow"),
        sec(fine, "narrow tint"),
    ])
    return page(lang, "supportprogram/", t["sp_t"], t["sp_p"], body, "supportprogram/")


def support_terms(lang):
    t = T[lang]
    return terms_page(lang, "supportprogram/terms/", "supportprogram/", t["spt_k"], t["spt_t"], t["spt_p"], t["spt_dated"], SUPPORT_TERMS_DATE,
                      t["spt_terms"], "supportprogram/", t["spt_back"])


def game_box(lang, full=False):
    """The Seal Ball game (static/game.js reads it by data-game)."""
    t = T[lang]
    return f"""<div class="seal-game{' full' if full else ''}" data-game>
  <div class="sg-hud"><span>{e(t['game_score'])} <b data-score>0</b></span><span class="sg-combo" data-combo aria-live="polite"></span>
  <span>{e(t['game_best'])} <b data-best>0</b></span><span>{e(t['game_lives'])} <b class="sg-lives" data-lives>●●●</b></span></div>
  <canvas tabindex="0" aria-label="{e(t['game_t'])}"></canvas>
  <div class="sg-overlay" data-overlay><h2 data-title>{e(t['game_t'])}</h2><p data-text>{e(t['game_how'])}</p>
  <div class="actions"><button class="btn primary" type="button" data-start>{e(t['game_start'])}</button><a class="btn" data-share target="_blank" rel="noopener" hidden>{e(t['game_share'])}</a></div></div>
</div>"""


def game(lang):
    t = T[lang]
    help_ = f'<div class="two game-help"><div><h2>{e(t["game_rules_t"])}</h2>{plain_list(t["game_rules"])}</div>{rows(t["game_controls"])}</div>'
    body = page_head("Game", t["game_t"]) + sec(game_box(lang, full=True) + help_)
    return page(lang, "game/", t["game_t"], t["game_p"], body, "", "game")


def not_found(lang):
    t = T[lang]
    title, text, back = t["not_found"]
    inner = f'<p>{e(text)}</p><p class="actions"><a class="btn primary" href="{url(lang)}">{e(back)}</a></p><h2>{e(t["game_t"])}</h2>{game_box(lang)}'
    body = page_head("404", title) + sec(inner, "narrow")
    return page(lang, "404.html", title, text, body, "", "lost")


def moved(target):
    """A page that sends visitors (and search engines) on to the address a page moved to."""
    return f"""<!doctype html><meta charset="utf-8"><title>ASHIKA Group</title>
<link rel="canonical" href="{SITE}{target}"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url={target}">
<script>location.replace("{target}" + location.hash)</script>
<a href="{target}">{SITE}{target}</a>"""


def redirect_root():
    return """<!doctype html><meta charset="utf-8"><title>ASHIKA Group</title>
<script>var l=(navigator.language||"ja").toLowerCase().indexOf("ja")===0?"ja-jp":"en-us";try{var s=document.cookie.match(/ashika_lang=([a-z-]+)/);if(s)l=s[1]}catch(e){}location.replace("/"+l+"/")</script>
<noscript><meta http-equiv="refresh" content="0; url=/ja-jp/"></noscript><a href="/ja-jp/">日本語</a> · <a href="/en-us/">English</a>"""


PAGES = [("", home), ("about/", about), ("services/", services), ("vision/", vision), ("history/", history), ("technology/", technology), ("brand/", brand), ("join/", join), ("join/terms/", join_terms), ("supportprogram/", support), ("supportprogram/terms/", support_terms), ("game/", game)]


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
    # the support program moved from /support/ to /supportprogram/: keep the old links working
    for lang in LANGS:
        for old, new in (("support/", "supportprogram/"), ("support/terms/", "supportprogram/terms/")):
            write(lang, old, moved(url(lang, new)))
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /assets/name-\nSitemap: {SITE}/sitemap.xml\n", encoding="utf-8")
    urls = "".join(f"<url><loc>{SITE}{url(l, p)}</loc></url>" for l in LANGS for p, _ in PAGES)
    (DIST / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>', encoding="utf-8")
    print(f"built {sum(1 for _ in DIST.rglob('*.html'))} pages into {DIST}")


if __name__ == "__main__":
    main()
