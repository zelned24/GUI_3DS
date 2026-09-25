import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { RomFSExporter } from './public/js/generator/RomFSExporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const PROJECT_DIR = path.join(__dirname, 'project');
const SCREENS_DIR = path.join(PROJECT_DIR, 'screens');
const GENERATED_INC_DIR = path.join(PROJECT_DIR, 'generated', 'include', 'screens');
const GENERATED_SRC_DIR = path.join(PROJECT_DIR, 'generated', 'src', 'screens');
const ROMFS_DIR = path.join(PROJECT_DIR, 'generated', 'romfs');
const ROMFS_DATA_DIR = path.join(ROMFS_DIR, 'data');
const EXTERNAL_DIR = path.join(PROJECT_DIR, 'external');

// Ensure necessary project directories exist
[PROJECT_DIR, SCREENS_DIR, GENERATED_INC_DIR, GENERATED_SRC_DIR, ROMFS_DIR, ROMFS_DATA_DIR, EXTERNAL_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e7) { // 10MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // -------------------------------------------------------------
  // REST API: GET /api/project
  // -------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/project') {
    try {
      const projectFile = path.join(PROJECT_DIR, 'project.json');
      let projectData = { name: 'Rogue3DS', version: '1.0.0', screens: [] };

      if (fs.existsSync(projectFile)) {
        projectData = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
      }

      const screens = [];
      if (fs.existsSync(SCREENS_DIR)) {
        const files = fs.readdirSync(SCREENS_DIR);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const screenContent = fs.readFileSync(path.join(SCREENS_DIR, file), 'utf8');
            try {
              screens.push(JSON.parse(screenContent));
            } catch (err) {
              console.error(`Error parsing screen file ${file}:`, err);
            }
          }
        }
      }

      sendJson(res, 200, { project: projectData, screens });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // -------------------------------------------------------------
  // REST API: POST /api/project/save
  // -------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/project/save') {
    try {
      const data = await parseJsonBody(req);
      const { project, screens } = data;

      if (project) {
        const projectFile = path.join(PROJECT_DIR, 'project.json');
        fs.writeFileSync(projectFile, JSON.stringify(project, null, 2), 'utf8');
      }

      if (Array.isArray(screens)) {
        for (const s of screens) {
          if (s && s.id) {
            const screenFile = path.join(SCREENS_DIR, `${s.id}.json`);
            fs.writeFileSync(screenFile, JSON.stringify(s, null, 2), 'utf8');
          }
        }
      }

      sendJson(res, 200, { success: true, message: 'Project saved successfully' });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // -------------------------------------------------------------
  // REST API: POST /api/generate-cpp
  // -------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/generate-cpp') {
    try {
      const data = await parseJsonBody(req);
      const { className, hpp, cpp } = data;

      if (!className || !hpp || !cpp) {
        sendJson(res, 400, { error: 'Missing required code generation fields' });
        return;
      }

      const hppFile = path.join(GENERATED_INC_DIR, `${className}.hpp`);
      const cppFile = path.join(GENERATED_SRC_DIR, `${className}.cpp`);

      fs.writeFileSync(hppFile, hpp, 'utf8');
      fs.writeFileSync(cppFile, cpp, 'utf8');

      sendJson(res, 200, {
        success: true,
        message: 'C++ files written to disk',
        hppPath: path.relative(__dirname, hppFile),
        cppPath: path.relative(__dirname, cppFile)
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // -------------------------------------------------------------
  // REST API: GET /api/pokerogue/config
  // -------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/pokerogue/config') {
    try {
      const cfgPath = path.join(PROJECT_DIR, 'external', 'pokerogue.json');
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        sendJson(res, 200, cfg);
      } else {
        sendJson(res, 404, { error: 'pokerogue.json not found' });
      }
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // -------------------------------------------------------------
  // REST API: GET /api/pokerogue/overrides & POST /api/pokerogue/override
  // -------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/pokerogue/overrides') {
    try {
      const ovPath = path.join(PROJECT_DIR, 'external', 'overrides.json');
      const overrides = fs.existsSync(ovPath) ? JSON.parse(fs.readFileSync(ovPath, 'utf8')) : {};
      sendJson(res, 200, overrides);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/pokerogue/override') {
    try {
      const body = await parseJsonBody(req);
      const { category, id, propertyPath, value } = body;
      const ovPath = path.join(PROJECT_DIR, 'external', 'overrides.json');
      const overrides = fs.existsSync(ovPath) ? JSON.parse(fs.readFileSync(ovPath, 'utf8')) : {};

      const cat = String(category).toLowerCase();
      const itemKey = String(id).toLowerCase();
      if (!overrides[cat]) overrides[cat] = {};
      if (!overrides[cat][itemKey]) overrides[cat][itemKey] = {};
      overrides[cat][itemKey][propertyPath] = value;

      fs.writeFileSync(ovPath, JSON.stringify(overrides, null, 2), 'utf8');
      sendJson(res, 200, { success: true, overrides });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // -------------------------------------------------------------
  // REST API: POST /api/pokerogue/export-romfs
  // -------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/pokerogue/export-romfs') {
    try {
      const body = await parseJsonBody(req);
      const { speciesList, movesList, manifest, provenance } = body;

      const spList = Array.isArray(speciesList) ? speciesList : [];
      const mvList = Array.isArray(movesList) ? movesList : [];

      const speciesBuf = RomFSExporter.packSpeciesBinary(spList);
      const movesBuf = RomFSExporter.packMovesBinary(mvList);

      const speciesBinPath = path.join(ROMFS_DATA_DIR, 'species.bin');
      const movesBinPath = path.join(ROMFS_DATA_DIR, 'moves.bin');
      const manifestPath = path.join(ROMFS_DIR, 'manifest.json');
      const extManifestPath = path.join(EXTERNAL_DIR, 'manifest.json');
      const extProvPath = path.join(EXTERNAL_DIR, 'provenance-report.json');

      fs.writeFileSync(speciesBinPath, Buffer.from(speciesBuf));
      fs.writeFileSync(movesBinPath, Buffer.from(movesBuf));

      if (manifest) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
        fs.writeFileSync(extManifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      }

      if (provenance) {
        fs.writeFileSync(extProvPath, JSON.stringify(provenance, null, 2), 'utf8');
      }

      const budget = RomFSExporter.calculateResourceBudget(manifest, null);

      sendJson(res, 200, {
        success: true,
        message: 'RomFS binary assets generated successfully',
        files: [
          path.relative(__dirname, speciesBinPath),
          path.relative(__dirname, movesBinPath),
          path.relative(__dirname, manifestPath)
        ],
        budget
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // -------------------------------------------------------------
  // REST API: POST /api/pokerogue/save-manifest
  // -------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/pokerogue/save-manifest') {
    try {
      const body = await parseJsonBody(req);
      const { manifest, provenance } = body;

      if (manifest) {
        fs.writeFileSync(path.join(EXTERNAL_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
      }
      if (provenance) {
        fs.writeFileSync(path.join(EXTERNAL_DIR, 'provenance-report.json'), JSON.stringify(provenance, null, 2), 'utf8');
      }

      sendJson(res, 200, { success: true, message: 'Manifest and provenance saved' });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // -------------------------------------------------------------
  // REST API: GET /api/pokerogue/asset?path=...
  // -------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/pokerogue/asset') {
    try {
      const assetSubpath = parsedUrl.searchParams.get('path');
      if (!assetSubpath) {
        sendJson(res, 400, { error: 'Missing path parameter' });
        return;
      }

      // Check local cache
      const cacheDir = path.join(PROJECT_DIR, 'external', 'cache', 'assets');
      const localFile = path.join(cacheDir, assetSubpath);
      const ext = path.extname(assetSubpath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      if (fs.existsSync(localFile)) {
        res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
        fs.createReadStream(localFile).pipe(res);
        return;
      }

      // Proxy from raw GitHub assets repo
      const cfgPath = path.join(PROJECT_DIR, 'external', 'pokerogue.json');
      let assetRev = '87426a79611f9d212c4dc8af58e2834a05b93725';
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        assetRev = cfg.assets?.revision || assetRev;
      }

      const upstreamUrl = `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/${assetRev}/${assetSubpath}`;
      const remoteResp = await fetch(upstreamUrl);
      if (!remoteResp.ok) {
        sendJson(res, 404, { error: `Asset not found in upstream repository: ${assetSubpath}` });
        return;
      }

      const arrayBuf = await remoteResp.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      // Save to cache dir
      fs.mkdirSync(path.dirname(localFile), { recursive: true });
      fs.writeFileSync(localFile, buffer);

      res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
      res.end(buffer);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // -------------------------------------------------------------
  // STATIC ASSETS SERVING
  // -------------------------------------------------------------
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security check to avoid directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log('  3DS UI GAME CREATION STUDIO - LOCAL SERVER');
  console.log(`  Access the Studio IDE at: http://localhost:${PORT}`);
  console.log('====================================================');
});
