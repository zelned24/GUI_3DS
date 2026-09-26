import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defaultAssetIndex } from '../public/js/data/AssetIndex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const assetsDir = path.join(rootDir, 'project', 'data', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

// 1. Generate deterministic asset-index.json
const indexPath = path.join(assetsDir, 'asset-index.json');
defaultAssetIndex.writeIndexFile(indexPath);
console.log(`✓ Generated: ${indexPath}`);

// 2. Generate asset-integrity-report.json
const reportPath = path.join(assetsDir, 'asset-integrity-report.json');
defaultAssetIndex.writeIntegrityReport(reportPath);
console.log(`✓ Generated: ${reportPath}`);

// 3. Generate runtime-metrics.json (Budget & Telemetry baseline)
const metricsPath = path.join(assetsDir, 'runtime-metrics.json');
const metricsData = {
  schemaVersion: 1,
  budget: {
    maxLoadedAssets: 64,
    maxCacheMissesPerFrame: 0,
    maxDrawCallsPerFrame: 128,
    maxActiveNodes: 256,
    maxActiveTracks: 128
  },
  instrumentation: {
    loadedAssetCount: 3,
    cacheHitCount: 19,
    cacheMissCount: 1,
    physicalLoadCount: 1,
    drawCallCount: 2,
    activeNodeCount: 2,
    activeTrackCount: 5
  }
};
fs.writeFileSync(metricsPath, JSON.stringify(metricsData, null, 2) + '\n', 'utf8');
console.log(`✓ Generated: ${metricsPath}`);
