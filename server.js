const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const ROOT_DIR = __dirname;

// Block direct public access to server/config files
const BLOCKED_FILES = new Set([
  '/server.js',
  '/package.json',
  '/package-lock.json',
]);

app.use((req, res, next) => {
  const reqPath = req.path.toLowerCase();
  if (
    BLOCKED_FILES.has(reqPath) ||
    reqPath.startsWith('/node_modules') ||
    reqPath.startsWith('/.env') ||
    reqPath.startsWith('/.git')
  ) {
    return res.status(404).send('Not Found');
  }
  next();
});

// Serve .well-known assets (e.g. Digital Asset Links)
app.use('/.well-known', express.static(path.join(ROOT_DIR, '.well-known')));

const TEST_PAGE = path.join(ROOT_DIR, 'Test.html');

// Serve Test.html for root and /test.html (case-insensitive)
app.get(['/', '/test.html', '/Test.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(TEST_PAGE);
});

// Serve static site files from project root
app.use(
  express.static(ROOT_DIR, {
    index: 'Test.html',
    setHeaders: (res, filePath) => {
      if (filePath.toLowerCase().endsWith('.apk')) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      }
    },
  })
);

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
