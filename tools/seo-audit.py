#!/usr/bin/env python3
"""Googlebot / Bingbot / AdSense-reviewer style static scan of the site files.
Usage: python3 tools/seo-audit.py [site_dir]      exit code 1 if any FAIL.
Checks (per page + site-wide): title, description, canonical, h1, lang, viewport, charset position, noindex, JSON-LD, word count,
alt text, broken internal links, duplicate titles/descriptions, sitemap vs. pages, robots.txt, ads.txt, manifest/icons, policy links,
login-wall-on-first-paint, public junk files. It cannot see the live server, DNS, TLS, Search Console or AdSense status."""
import os, re, sys, json
from html.parser import HTMLParser

ROOT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = 'https://eduspark.live'
res = {'FAIL': [], 'WARN': [], 'PASS': 0}
def fail(p, m): res['FAIL'].append((p, m))
def warn(p, m): res['WARN'].append((p, m))
def ok(): res['PASS'] += 1

class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True); s.title=''; s.in_title=False; s.meta={}; s.links=[]; s.h1=0; s.h2=0; s.imgs=[]; s.ld=[]; s.in_ld=False
        s.text=[]; s.skip=0; s.in_noscript=0; s.noscript_text=[]; s.canon=None; s.lang=None; s.anchors=[]; s.metas=[]
    def handle_starttag(s, tag, a):
        a = dict(a)
        if tag=='html': s.lang=a.get('lang')
        if tag=='title': s.in_title=True
        if tag=='meta':
            k=(a.get('name') or a.get('property') or '').lower()
            if k: s.meta[k]=a.get('content','')
            s.metas.append(a)
        if tag=='link' and a.get('rel')=='canonical': s.canon=a.get('href')
        if tag=='h1': s.h1+=1
        if tag=='h2': s.h2+=1
        if tag=='img': s.imgs.append(a)
        if tag=='a' and a.get('href'): s.anchors.append(a)
        if tag=='script':
            if a.get('type')=='application/ld+json': s.in_ld=True
            else: s.skip+=1
        if tag=='style': s.skip+=1
        if tag=='noscript': s.in_noscript+=1
    def handle_endtag(s, tag):
        if tag=='title': s.in_title=False
        if tag=='script':
            if s.in_ld: s.in_ld=False
            elif s.skip: s.skip-=1
        if tag=='style' and s.skip: s.skip-=1
        if tag=='noscript' and s.in_noscript: s.in_noscript-=1
    def handle_data(s, d):
        if s.in_title: s.title+=d
        if s.in_ld: s.ld.append(d); return
        if s.skip: return
        if s.in_noscript: s.noscript_text.append(d)
        s.text.append(d)

def read(p):
    with open(os.path.join(ROOT,p),encoding='utf-8',errors='replace') as f: return f.read()
def has(p): return os.path.exists(os.path.join(ROOT,p))

htmls = sorted(f for f in os.listdir(ROOT) if f.endswith('.html'))
NOINDEX_OK = {'admin.html','eduspark-qr-generator.html'}
parsed = {}
for f in htmls:
    raw = read(f); p = P(); p.feed(raw); parsed[f]=(raw,p)

# sitemap + robots
sm = read('sitemap.xml') if has('sitemap.xml') else ''
sm_urls = re.findall(r'<loc>([^<]+)</loc>', sm)
sm_files = {u.replace(HOST+'/','') or 'index.html' for u in sm_urls}
robots = read('robots.txt') if has('robots.txt') else ''
disallow = [l.split(':',1)[1].strip() for l in robots.splitlines() if l.lower().startswith('disallow:') and l.split(':',1)[1].strip()]

titles, descs = {}, {}
for f,(raw,p) in parsed.items():
    name = f
    noindex = 'noindex' in (p.meta.get('robots','')).lower()
    indexable = not noindex
    if f in NOINDEX_OK:
        (ok() if noindex else fail(name,'utility/admin page is indexable (add <meta name=robots content=noindex>)'))
        continue
    # charset in first 1024 bytes
    cs = raw.lower().find('charset=')
    (ok() if 0 <= cs < 1000 else fail(name, f'<meta charset> not in first 1024 bytes (pos {cs}) — Hindi text can be mis-decoded'))
    t = p.title.strip()
    if not t: fail(name,'missing <title>')
    elif len(t)>70: warn(name,f'title long ({len(t)} chars)'); ok()
    else: ok()
    d = p.meta.get('description','').strip()
    if not d: fail(name,'missing meta description')
    elif not 50<=len(d)<=175: warn(name,f'meta description length {len(d)} (aim 70-160)')
    else: ok()
    titles.setdefault(t,[]).append(name); descs.setdefault(d,[]).append(name)
    exp = f'{HOST}/' if f=='index.html' else f'{HOST}/{f}'
    (ok() if p.canon==exp else fail(name,f'canonical {p.canon!r} != {exp!r}'))
    vp = p.meta.get('viewport','')
    if not vp: fail(name,'missing viewport')
    elif re.search(r'user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b',vp): fail(name,'viewport blocks pinch-zoom (accessibility; Lighthouse fails)')
    else: ok()
    if not p.lang: fail(name,'missing <html lang>')
    else: ok()
    if f!='index.html':
        (ok() if p.h1==1 else fail(name,f'expected exactly 1 <h1>, found {p.h1}'))
    words = len(re.findall(r'\w+', ' '.join(p.text)))
    if f!='index.html':
        floor = 250 if f in ('contact.html','delete-account.html','disclaimer.html','ads-and-cookies.html','about.html') else 450
        (ok() if words>=floor else warn(name,f'thin content: {words} words (< {floor})'))
    for im in p.imgs:
        if 'alt' not in im: warn(name,f'<img> without alt: {im.get("src","")[:50]}')
    for blob in ['\n'.join(p.ld)] if p.ld else []:
        try: json.loads(blob); ok()
        except Exception as e: fail(name,f'invalid JSON-LD: {e}')
    if f not in ('index.html',) and indexable:
        (ok() if f in sm_files else fail(name,'indexable page missing from sitemap.xml'))
    if indexable and any(f==x.lstrip('/') or ('/'+f).startswith(x) for x in disallow if x!='/'):
        fail(name,'indexable page is Disallowed in robots.txt')
    # internal links
    for a in p.anchors:
        h = a['href']
        if h.startswith(('mailto:','tel:','javascript:','#','http://','https://','data:')):
            if h.startswith('https://') and a.get('target')=='_blank' and 'noopener' not in a.get('rel',''): warn(name,'target=_blank without rel=noopener')
            if h.startswith('http://'): warn(name,f'insecure link {h[:60]}')
            continue
        tgt = h.split('#')[0].split('?')[0].lstrip('/')
        if tgt and not has(tgt): fail(name,f'broken internal link {h}')
    # mixed content
    if re.search(r'(src|href)=["\']http://(?!www\.w3\.org)', raw): fail(name,'mixed-content http:// resource')

for t,fs in titles.items():
    if len(fs)>1 and t: warn(','.join(fs),f'duplicate <title>: {t[:50]}')
for d,fs in descs.items():
    if len(fs)>1 and d: warn(','.join(fs),'duplicate meta description')

# --- index.html (the app shell) specifics ---
if 'index.html' in parsed:
    raw,p = parsed['index.html']
    nsw = len(re.findall(r'\w+',' '.join(p.noscript_text)))
    (ok() if nsw>=60 else fail('index.html',f'no crawlable text without JS (<noscript> has {nsw} words); Bing renders JS poorly'))
    (ok() if p.ld else fail('index.html','no JSON-LD (Organization/WebSite/WebApplication)'))
    for need in ('/privacy.html','/terms.html','/about.html','/contact.html'):
        (ok() if any(a['href']==need for a in p.anchors) or need in raw else fail('index.html',f'no link to {need} (AdSense: users must reach policy pages)'))
    # login wall on first paint
    auto = re.search(r'function autoShowLogin\(', raw) is not None
    direct = re.findall(r'setTimeout\(\(\)=>\{ showLoginPage\(\); \},500\)|\n\s+showLoginPage\(\);\n\s+\}\n\s+if \(typeof updateTopbarAvatar', raw)
    if auto and not direct: ok()
    else: fail('index.html','first-time visitors (incl. Googlebot/AdSense) get a full-screen login overlay — "pages behind a login" / no publisher content')
    (ok() if 'adsbygoogle.js?client=ca-pub-' in raw else warn('index.html','AdSense script missing'))
    live = re.sub(r'<!--.*?-->','',raw,flags=re.S)
    if re.search(r'<ins class="adsbygoogle"',live): 
        (ok() if 'data-tag-for-under-age-of-consent' in live else warn('index.html','ad unit without data-tag-for-under-age-of-consent (under-18 audience)'))

# --- site files ---
if has('ads.txt'):
    a = read('ads.txt').strip()
    (ok() if re.match(r'^google\.com,\s*pub-\d{10,},\s*DIRECT,\s*f08c47fec0942fa0$',a,re.I|re.M) else fail('ads.txt','format wrong'))
else: fail('ads.txt','missing')
(ok() if robots else fail('robots.txt','missing'))
if robots:
    (ok() if re.search(r'^Sitemap:\s*https://',robots,re.M) else warn('robots.txt','no Sitemap: line'))
    (ok() if re.search(r'User-agent:\s*Mediapartners-Google',robots,re.I) or not disallow else warn('robots.txt','Disallow rules exist but Mediapartners-Google is not explicitly allowed'))
for u in sm_urls:
    f = u.replace(HOST+'/','') or 'index.html'
    if not has(f): fail('sitemap.xml',f'{u} has no file')
if has('manifest.json'):
    m = json.loads(read('manifest.json')); 
    for k in ('name','short_name','start_url','display','icons','theme_color','background_color'):
        (ok() if k in m else fail('manifest.json',f'missing {k}'))
    purp = [i.get('purpose') for i in m.get('icons',[])]
    (ok() if 'maskable' in purp else warn('manifest.json','no maskable icon'))
    both = [i['src'] for i in m.get('icons',[]) if i.get('purpose')=='maskable'] 
    anyi = [i['src'] for i in m.get('icons',[]) if i.get('purpose')=='any']
    if set(both)&set(anyi): warn('manifest.json','same file used for any + maskable (logo gets cropped on Android)')
    for i in m.get('icons',[]):
        if not has(i['src'].lstrip('/')): fail('manifest.json',f'icon {i["src"]} missing')
sw = read('sw.js') if has('sw.js') else ''
(ok() if 'addEventListener("push"' in sw or "addEventListener('push'" in sw else fail('sw.js','no push handler'))

# files a crawler can fetch from GitHub Pages that should not be public
junk = [x for x in ('NOTES-mistakes.md','firestore.rules','worker.js','package.json','Dockerfile','docker-compose.yml','wrangler.toml','CHANGELOG.md','README.md') if has(x)]
junk += [d+'/' for d in ('docs','tests','scripts','deploy','infra','tools','quiz-app','.github','cron-trigger') if has(d)]
if junk: warn('repo',f'served publicly by GitHub Pages (branch deploy): {", ".join(junk)} — deploy only a whitelist (see .github/workflows/pages.yml)')

print(f'\nSEO/AdSense scan of {ROOT}\n{len(htmls)} html files | sitemap URLs: {len(sm_urls)}')
print(f'PASS checks: {res["PASS"]}   WARN: {len(res["WARN"])}   FAIL: {len(res["FAIL"])}\n')
for p,m in res['FAIL']: print(f'❌ FAIL  [{p}] {m}')
for p,m in res['WARN']: print(f'⚠️  WARN  [{p}] {m}')
sys.exit(1 if res['FAIL'] else 0)
