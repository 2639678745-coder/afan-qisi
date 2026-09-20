'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3210);
const HOST = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('启动失败：PORT 必须是 1～65535 之间的整数。');
  process.exit(1);
}
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const { diagnose, tutor, ocrHandwriting } = require('./public/ai-client.js');

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ app: 'afan-qisi', version: '1.0.2' }));
    return;
  }

  if (req.method === 'GET') {
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    const full = path.join(PUBLIC_DIR, path.normalize(p));
    if (full.startsWith(PUBLIC_DIR) && fs.existsSync(full) && fs.statSync(full).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
      fs.createReadStream(full).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ocr') {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const latex = await ocrHandwriting(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ latex }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: (e && e.message) || String(e) }));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/diagnose') {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const diag = await diagnose(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ diagnosis: diag }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: (e && e.message) || String(e) }));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/tutor') {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const result = await tutor(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: (e && e.message) || String(e) }));
    }
    return;
  }

  res.writeHead(404); res.end('404');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error('启动失败：端口 ' + PORT + ' 已被占用。请先停止已有服务，或用 node afan.js --port 3211 换一个端口。');
  } else {
    console.error('启动失败：' + error.message);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log('AI 讲题 Demo 已启动：http://localhost:' + PORT);
});

module.exports = server;
