# EduSpark static page template (build: python3 tools/build-pages.py). Output = plain HTML files in the repo root (GitHub Pages ready).
import html, json
SITE = 'https://eduspark.live'
UPDATED = '31 October 2026'
ISO = '2026-10-31'
EMAIL = 'bhupeshkumar36882@gmail.com'

CSS = """
:root{--navy:#16233F;--amber:#E8A33D;--teal:#1E7F6C;--bg:#F7F6F2;--card:#fff;--text:#262B33;--muted:#5d6572;--line:#E4E1D8;--link:#1b5fb4}
@media (prefers-color-scheme:dark){:root{--navy:#dfe7f7;--amber:#f0b45a;--teal:#4fc4a8;--bg:#0f1524;--card:#161e33;--text:#e3e8f3;--muted:#a3adc2;--line:#27314b;--link:#8db8ff}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Devanagari",sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
.wrap{max-width:720px;margin:0 auto;padding:24px 18px 56px}
header.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:16px;margin-bottom:28px;border-bottom:1px solid var(--line)}
.brand{font-family:Georgia,"Times New Roman",serif;font-weight:700;font-size:22px;color:var(--navy);text-decoration:none}
.back{font-size:14px;color:var(--muted);text-decoration:none}.back:hover{color:var(--navy)}
.crumbs{font-size:13px;color:var(--muted);margin:0 0 10px}.crumbs a{color:var(--muted)}
h1{font-family:Georgia,"Times New Roman",serif;font-weight:700;font-size:clamp(26px,5vw,34px);line-height:1.25;color:var(--navy);margin:0 0 14px}
h2{font-family:Georgia,"Times New Roman",serif;font-weight:700;font-size:21px;color:var(--navy);margin:34px 0 10px;line-height:1.3}
h3{font-size:16.5px;color:var(--navy);margin:22px 0 6px}
p{margin:0 0 14px;font-size:16px}ul,ol{margin:0 0 16px;padding-left:22px}li{margin-bottom:7px;font-size:16px}
a{color:var(--link)}
.lead{font-size:17.5px;color:var(--text)}
.upd{font-size:13px;color:var(--muted);margin:0 0 22px}
.note{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--amber);border-radius:8px;padding:12px 14px;font-size:14.5px;margin:22px 0}
.hi{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px;font-size:15px;margin:0 0 22px}
.cta{display:inline-block;margin:6px 0 0;padding:12px 22px;background:var(--amber);color:#16233F;font-weight:700;text-decoration:none;border-radius:8px}
.cta:hover{filter:brightness(.95)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:0 0 18px}
.grid a{display:block;padding:12px 14px;background:var(--card);border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--navy);font-weight:600;font-size:15px}
table{border-collapse:collapse;width:100%;margin:0 0 18px;font-size:15px}th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}th{background:var(--card)}
.tw{overflow-x:auto}
footer{margin-top:48px;padding-top:18px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}
footer nav{display:flex;gap:8px 18px;flex-wrap:wrap;margin-bottom:10px}footer a{color:var(--muted);text-decoration:none}footer a:hover{color:var(--navy);text-decoration:underline}
a:focus-visible{outline:2px solid var(--link);outline-offset:3px;border-radius:2px}
"""

FOOT_LINKS = [('/about.html','About'),('/contact.html','Contact'),('/privacy.html','Privacy Policy'),('/terms.html','Terms of Use'),
              ('/disclaimer.html','Disclaimer'),('/ads-and-cookies.html','Ads & Cookies'),('/delete-account.html','Delete Account')]
GUIDES = [('/cbse-class-10.html','CBSE Class 10'),('/cbse-class-12.html','CBSE Class 12'),('/bser-class-10.html','BSER Class 10'),
          ('/bser-class-12.html','BSER Class 12'),('/ssc-cgl.html','SSC CGL'),('/ssc-chsl.html','SSC CHSL'),
          ('/reet-bstc.html','REET & BSTC'),('/study-tips.html','Study tips: PYQs & quizzes')]

def esc(s): return html.escape(s, quote=True)

def related(exclude):
    items = ''.join(f'<a href="{u}">{esc(n)}</a>' for u, n in GUIDES if u != exclude)
    return f'<h2>More study guides</h2><div class="grid">{items}</div>'

def page(slug, title, desc, h1, body, crumb=None, lang='en-IN', hi_summary=None, guide=False, noindex=False, updated=True):
    url = f'{SITE}/{slug}'
    crumb = crumb or h1
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebPage", "@id": url + "#webpage", "url": url, "name": title, "description": desc, "inLanguage": lang,
         "isPartOf": {"@id": SITE + "/#website"}, "dateModified": ISO},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "EduSpark", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": crumb, "item": url}]}]}
    foot = ' '.join(f'<a href="{u}">{esc(n)}</a>' for u, n in FOOT_LINKS)
    robots = 'noindex, follow' if noindex else 'index, follow, max-image-preview:large'
    upd = f'<p class="upd">Last updated: {UPDATED}</p>' if updated else ''
    hi = f'<div class="hi" lang="hi">{hi_summary}</div>' if hi_summary else ''
    return f'''<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="{robots}">
<meta name="theme-color" content="#16233F">
<link rel="icon" href="/icon-192.png" type="image/png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="EduSpark">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/icon-512.png">
<meta name="twitter:card" content="summary">
<script>if (window.self !== window.top) document.documentElement.className += ' in-frame';</script>
<style>{CSS}.in-frame header.top .back{{display:none}}</style>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body>
<div class="wrap">
  <header class="top">
    <a class="brand" href="/">EduSpark</a>
    <a class="back" href="/">Open the app &rarr;</a>
  </header>
  <main>
    <p class="crumbs"><a href="/">Home</a> &rsaquo; {esc(crumb)}</p>
    <h1>{esc(h1)}</h1>
    {upd}
    {hi}
    {body}
    {related('/' + slug) if guide else ''}
  </main>
  <footer>
    <nav aria-label="Site links">{foot}</nav>
    <div>&copy; 2026 EduSpark. An independent study app &mdash; not affiliated with CBSE, BSER/RBSE, SSC or any government body.</div>
  </footer>
</div>
</body>
</html>
'''
