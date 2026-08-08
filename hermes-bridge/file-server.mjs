import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 9321;
const ROOT = '/opt/data';
const MAX_BYTES = 512 * 1024;

function safeJoin(target) {
  if (target === '/' || target === '') return ROOT;
  const p = path.resolve(ROOT, target);
  if (!p.startsWith(ROOT)) throw new Error('path escape');
  return p;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);
  const target = url.pathname === '/' ? '/' : decodeURIComponent(url.pathname);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  try {
    const p = safeJoin(target);
    if (!fs.existsSync(p)) { res.writeHead(404); res.end(JSON.stringify({ error: 'not found' })); return; }
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(p).sort().map(name => {
        const full = path.join(p, name);
        const s = fs.statSync(full);
        return { name, path: (full.slice(ROOT.length + 1) || '/'), type: s.isDirectory() ? 'dir' : 'file', size: s.size, updatedAt: s.mtime.toISOString() };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ type: 'dir', path: p, entries }));
      return;
    }
    let content = fs.readFileSync(p, 'utf-8');
    if (content.length > MAX_BYTES) content = content.slice(0, MAX_BYTES) + '\n...truncated...';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'file', size: stat.size, content, name: path.basename(p) }));
  } catch (e) {
    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
  }
});
server.listen(PORT, '0.0.0.0', () => console.log('file-server up on :' + PORT));
