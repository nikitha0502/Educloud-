/**
 * server.js — EduCloud Local Development Server
 * Pure Node.js HTTP server (zero external dependencies).
 * Serves the frontend static files and manages proper MIME types.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 5500;
const PUBLIC_DIR = path.join(__dirname, 'frontend');

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

const server = http.createServer((req, res) => {
  // Add CORS and security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Default to index.html for root path
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  // Prevent directory traversal attacks
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  // If request is without extension and a corresponding .html exists in pages or root
  if (!path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    } else if (fs.existsSync(path.join(PUBLIC_DIR, 'pages', safePath + '.html'))) {
      filePath = path.join(PUBLIC_DIR, 'pages', safePath + '.html');
    }
  }

  // Check if file exists and is inside PUBLIC_DIR
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Return custom 404 or redirect to index.html
      const notFoundPath = path.join(PUBLIC_DIR, 'pages', '404.html');
      if (fs.existsSync(notFoundPath)) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(notFoundPath).pipe(res);
      } else {
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
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🎓 EduCloud Server running at: http://localhost:${PORT}`);
  console.log(`📁 Serving directory: ${PUBLIC_DIR}`);
  console.log(`====================================================`);
});
