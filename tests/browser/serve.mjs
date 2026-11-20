// Repo ko chhote static server par chalata hai (browser tests ke liye) — kuch install nahi karna
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
export function start() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\.\./g, ''));
      fs.readFile(fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(ROOT, 'index.html'), (e, buf) => { rsp.writeHead(e ? 404 : 200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); rsp.end(buf); });
    }).listen(0, '127.0.0.1', () => res({ url: 'http://127.0.0.1:' + srv.address().port + '/', close: () => srv.close() }));
  });
}
export async function launch() {
  const { chromium } = await import(process.env.PW_MODULE || 'playwright');
  return chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
}
