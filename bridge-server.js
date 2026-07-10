/**
 * JKP WorkHub — 로컬 브릿지 서버
 * 
 * 역할: 내 PC의 파일시스템을 웹앱(workhub.vercel.app)에서 접근할 수 있도록 중계
 * 포트: localhost:45679 (외부 인터넷에서 직접 접근 불가)
 * 실행: node bridge-server.js (윈도우 시작 프로그램에 등록)
 * 
 * 보안: 
 *  - localhost만 바인딩 (외부 노출 없음)
 *  - CORS: workhub.vercel.app + localhost만 허용
 *  - 모든 파일 경로는 설정된 DESKTOP_ROOT 내부로 제한 (경로 순회 방지)
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 45679;
const SETTINGS_FILE = path.join(__dirname, 'bridge-settings.json');

// 브릿지 설정 로드
let settings = {
  desktopSyncPath: '',
  allowedOrigins: [
    'https://jkpworkhub.vercel.app',
    'http://localhost:3000',
    'http://localhost:45678',
  ]
};

if (fs.existsSync(SETTINGS_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    settings = { ...settings, ...loaded };
  } catch (e) { console.error('Failed to load bridge-settings.json', e); }
}

let DESKTOP_ROOT = settings.desktopSyncPath || path.join(require('os').homedir(), 'Desktop', 'JKP_WorkHub_Files');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || settings.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: Not allowed'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// 요청 로거
app.use((req, res, next) => {
  console.log(`[BRIDGE] ${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// 경로 보안 검증
function safeResolvePath(relativePath) {
  if (!relativePath) return DESKTOP_ROOT;
  let resolved;
  if (path.isAbsolute(relativePath)) {
    resolved = path.resolve(relativePath);
  } else {
    resolved = path.join(DESKTOP_ROOT, relativePath);
  }
  const normResolved = path.resolve(resolved).toLowerCase().replace(/\\/g, '/');
  const normRoot = path.resolve(DESKTOP_ROOT).toLowerCase().replace(/\\/g, '/');
  if (!normResolved.startsWith(normRoot)) {
    throw new Error('Access Denied: Path traversal detected.');
  }
  return resolved;
}

function formatSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ─── 상태 확인 ───────────────────────────────────────────────
app.get('/api/bridge/status', (req, res) => {
  res.json({
    running: true,
    version: '2.0.0',
    desktopRoot: DESKTOP_ROOT,
    rootExists: fs.existsSync(DESKTOP_ROOT),
  });
});

// ─── 설정 저장 ───────────────────────────────────────────────
app.post('/api/bridge/settings', (req, res) => {
  const { desktopSyncPath } = req.body;
  if (desktopSyncPath) {
    DESKTOP_ROOT = desktopSyncPath;
    settings.desktopSyncPath = desktopSyncPath;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  }
  res.json({ success: true, desktopRoot: DESKTOP_ROOT });
});

// ─── 파일 목록 ───────────────────────────────────────────────
let cacheFiles = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 10000;

app.get('/api/files', (req, res) => {
  try {
    const now = Date.now();
    if (cacheFiles && (now - lastCacheTime) < CACHE_DURATION_MS) {
      return res.json(cacheFiles);
    }

    if (!fs.existsSync(DESKTOP_ROOT)) return res.json([]);

    const results = [];
    function crawl(dir, relBase) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const full = path.join(dir, item);
        const rel = relBase ? `${relBase}/${item}` : item;
        try {
          const stat = fs.statSync(full);
          if (stat.isFile()) {
            results.push({
              name: item, path: rel, fullPath: full,
              size: formatSize(stat.size), sizeBytes: stat.size,
              modified: stat.mtime.toISOString(),
              ext: path.extname(item).toLowerCase(),
            });
          } else if (stat.isDirectory()) {
            crawl(full, rel);
          }
        } catch (e) {}
      }
    }
    crawl(DESKTOP_ROOT, '');
    cacheFiles = results;
    lastCacheTime = now;
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 폴더 목록 ───────────────────────────────────────────────
app.get('/api/folders/all', (req, res) => {
  try {
    if (!fs.existsSync(DESKTOP_ROOT)) return res.json([]);
    const results = [];
    function crawl(dir, relBase) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const full = path.join(dir, item);
        const rel = relBase ? `${relBase}/${item}` : item;
        try {
          if (fs.statSync(full).isDirectory()) {
            results.push({ name: item, path: rel, fullPath: full });
            crawl(full, rel);
          }
        } catch (e) {}
      }
    }
    crawl(DESKTOP_ROOT, '');
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 디렉토리 조회 ───────────────────────────────────────────
app.get('/api/dir', (req, res) => {
  try {
    const relPath = req.query.path || '';
    const targetPath = safeResolvePath(relPath);
    if (!fs.existsSync(targetPath)) return res.json([]);
    const items = fs.readdirSync(targetPath).map(item => {
      const full = path.join(targetPath, item);
      const stat = fs.statSync(full);
      return {
        name: item,
        path: relPath ? `${relPath}/${item}` : item,
        isDir: stat.isDirectory(),
        size: stat.isFile() ? formatSize(stat.size) : null,
        modified: stat.mtime.toISOString(),
        ext: stat.isFile() ? path.extname(item).toLowerCase() : null,
      };
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 폴더 생성 ───────────────────────────────────────────────
app.post('/api/folders/create', (req, res) => {
  try {
    const { path: relPath } = req.body;
    const targetPath = safeResolvePath(relPath);
    fs.mkdirSync(targetPath, { recursive: true });
    cacheFiles = null;
    res.json({ success: true, path: relPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 폴더 이름 변경 ──────────────────────────────────────────
app.post('/api/folders/rename', (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    const src = safeResolvePath(oldPath);
    const dst = safeResolvePath(newPath);
    fs.renameSync(src, dst);
    cacheFiles = null;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 폴더 삭제 ───────────────────────────────────────────────
app.delete('/api/folders', (req, res) => {
  try {
    const relPath = req.body.path || req.query.path;
    const targetPath = safeResolvePath(relPath);
    fs.rmSync(targetPath, { recursive: true, force: true });
    cacheFiles = null;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 파일 업로드 (텍스트) ────────────────────────────────────
app.post('/api/files/upload', (req, res) => {
  try {
    const { path: relPath, content } = req.body;
    const targetPath = safeResolvePath(relPath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content || '', 'utf8');
    cacheFiles = null;
    res.json({ success: true, path: relPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 이미지 업로드 (base64) ──────────────────────────────────
app.post('/api/files/uploadImage', (req, res) => {
  try {
    const { filename, base64, folder } = req.body;
    const targetFolder = folder ? safeResolvePath(folder) : path.join(DESKTOP_ROOT, 'Editor_Images');
    fs.mkdirSync(targetFolder, { recursive: true });
    const matches = base64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid base64' });
    const safeName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
    const filePath = path.join(targetFolder, safeName);
    fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
    cacheFiles = null;
    res.json({ success: 1, file: { url: `/local-image?path=${encodeURIComponent(filePath)}` } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 파일 삭제 ───────────────────────────────────────────────
app.delete('/api/files', (req, res) => {
  try {
    const relPath = req.body.path || req.query.path;
    const targetPath = safeResolvePath(relPath);
    fs.unlinkSync(targetPath);
    cacheFiles = null;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 파일 이름 변경 ──────────────────────────────────────────
app.post('/api/files/rename', (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    const src = safeResolvePath(oldPath);
    const dst = safeResolvePath(newPath);
    fs.renameSync(src, dst);
    cacheFiles = null;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 로컬 이미지 서빙 ────────────────────────────────────────
app.get('/local-image', (req, res) => {
  try {
    const filePath = decodeURIComponent(req.query.path);
    const resolved = path.resolve(filePath).toLowerCase().replace(/\\/g, '/');
    const root = path.resolve(DESKTOP_ROOT).toLowerCase().replace(/\\/g, '/');
    if (!resolved.startsWith(root)) return res.status(403).send('Forbidden');
    if (!fs.existsSync(filePath)) return res.status(404).send('Not Found');
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ─── OS에서 파일/폴더 열기 ───────────────────────────────────
app.post('/api/files/open', (req, res) => {
  try {
    const { path: relPath } = req.body;
    const targetPath = safeResolvePath(relPath);
    const { exec } = require('child_process');
    exec(`start "" "${targetPath}"`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/open-folder', (req, res) => {
  try {
    const { path: relPath } = req.body;
    const targetPath = safeResolvePath(relPath);
    const { exec } = require('child_process');
    exec(`explorer "${targetPath}"`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 서버 시작 ───────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║   JKP WorkHub 로컬 브릿지 실행 중     ║`);
  console.log(`║   http://localhost:${PORT}              ║`);
  console.log(`║   자료실: ${DESKTOP_ROOT.slice(0, 30)}...║`);
  console.log(`╚════════════════════════════════════════╝\n`);
});
