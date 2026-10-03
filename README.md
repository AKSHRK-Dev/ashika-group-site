# ASHIKA Group website

Source of group.ashikanw.com: ASHIKA Group's corporate site (Japanese and English).

```bash
python3 build.py          # writes the site into dist/
cd dist && python3 -m http.server 8000
```

- All text: `content.py` (Japanese and English side by side)
- Pages and layout: `build.py`; styles and scripts: `static/`
- Screenshots of the services: `static/img/`
- Serving: `node serve.mjs` (port 4400, or `PORT=`), behind the Cloudflare Tunnel; `/` picks the visitor's language
