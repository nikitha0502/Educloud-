const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

const PORT = 5500;
const PUBLIC_DIR = path.join(__dirname, '../frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
};

// 1. Start HTTP Server
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  if (!path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    } else if (fs.existsSync(path.join(PUBLIC_DIR, 'pages', safePath + '.html'))) {
      filePath = path.join(PUBLIC_DIR, 'pages', safePath + '.html');
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>404 Not Found - EduCloud</title>
        <style>body{font-family:sans-serif;background:#0f0c29;color:#fff;text-align:center;padding:80px;}</style>
        </head>
        <body>
          <h1>404 — Page Not Found</h1>
          <p>The requested file <code>${pathname}</code> was not found.</p>
          <p><a href="/" style="color:#a5b4fc;">Return to Home</a></p>
        </body>
        </html>
      `);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🎓 EduCloud Server Started`);
  console.log(`🌐 Local URL:  http://localhost:${PORT}`);
  console.log(`📁 Directory:  ${PUBLIC_DIR}`);
  console.log(`======================================================\n`);

  startTunnel();
});

// 2. Start Cloudflare Tunnel
function startTunnel() {
  console.log(`☁️  Starting Cloudflare Edge Tunnel...`);
  const cloudflaredPath = path.join(__dirname, '../cloudflared.exe');

  const tunnel = spawn(cloudflaredPath, ['tunnel', '--url', `http://localhost:${PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let liveUrl = null;

  function handleOutput(data) {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !liveUrl) {
      liveUrl = match[0];
      console.log(`\n******************************************************`);
      console.log(`🎉 PUBLIC LIVE WEBSITE URL IS READY:`);
      console.log(`👉 ${liveUrl}`);
      console.log(`******************************************************\n`);

      // Write URL to public-url.txt for easy reference
      fs.writeFileSync(path.join(__dirname, '../public-url.txt'), liveUrl);
    }
  }

  tunnel.stdout.on('data', handleOutput);
  tunnel.stderr.on('data', handleOutput);

  tunnel.on('close', (code) => {
    console.log(`Tunnel closed with code ${code}`);
  });
}
