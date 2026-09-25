/**
 * build_romfs.js
 * CLI pipeline to build RomFS binary tables and provenance/manifest reports for 3DS target.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { dataManager } from '../public/js/data/DataManager.js';
import { RomFSExporter } from '../public/js/generator/RomFSExporter.js';
import { PokerogueManifest } from '../public/js/data/PokerogueManifest.js';
import { ProvenanceReport } from '../public/js/data/ProvenanceReport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PROJECT_DIR = path.join(ROOT_DIR, 'project');
const EXTERNAL_DIR = path.join(PROJECT_DIR, 'external');
const ROMFS_DIR = path.join(PROJECT_DIR, 'generated', 'romfs');
const ROMFS_DATA_DIR = path.join(ROMFS_DIR, 'data');

[EXTERNAL_DIR, ROMFS_DIR, ROMFS_DATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

console.log('====================================================');
console.log('  BUILDING POKÉROGUE 3DS ROMFS BINARY TABLES');
console.log('====================================================\n');

// 1. Load config & create manifest
const configPath = path.join(EXTERNAL_DIR, 'pokerogue.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};

const manifest = new PokerogueManifest({
  sourceRevision: config.source?.revision || '8555c08c823b856cbec4eb99ca84ea52a955836d',
  assetRevision: config.assets?.revision || '87426a79611f9d212c4dc8af58e2834a05b93725',
  localeRevision: config.locales?.revision || '23aea1cb0da5a0b15b836f3c243791591cc42303',
  sourceBranch: config.source?.branch || 'beta',
  assetBranch: config.assets?.branch || 'beta',
  localeBranch: config.locales?.branch || 'main'
});

// 2. Collect species & moves
const speciesList = dataManager.getAllSpecies();
const movesList = dataManager.getAllMoves();
const abilitiesList = dataManager.getAllAbilities();

manifest.entityCounts = {
  species: speciesList.length,
  moves: movesList.length,
  abilities: abilitiesList.length
};

// 3. Create provenance report
const provenance = new ProvenanceReport(manifest);
speciesList.forEach(sp => {
  provenance.addImported(sp.id, 'SPECIES', 'src/data/balance/species/generation-01.ts', 'AGPL-v3.0-only');
});

movesList.forEach(mv => {
  provenance.addImported(mv.id, 'MOVE', 'src/data/moves/move.ts', 'AGPL-v3.0-only');
});

abilitiesList.forEach(ab => {
  provenance.addImported(ab.id, 'ABILITY', 'src/data/abilities/init-abilities.ts', 'AGPL-v3.0-only');
});

provenance.addGenerated('romfs/data/species.bin', 'Compact 24-byte record binary species table for Citro2D');
provenance.addGenerated('romfs/data/moves.bin', 'Compact 12-byte record binary move table for Citro2D');

// 4. Pack binary buffers
const speciesBuf = RomFSExporter.packSpeciesBinary(speciesList);
const movesBuf = RomFSExporter.packMovesBinary(movesList);

const speciesBinPath = path.join(ROMFS_DATA_DIR, 'species.bin');
const movesBinPath = path.join(ROMFS_DATA_DIR, 'moves.bin');
const extManifestPath = path.join(EXTERNAL_DIR, 'manifest.json');
const romfsManifestPath = path.join(ROMFS_DIR, 'manifest.json');
const extProvPath = path.join(EXTERNAL_DIR, 'provenance-report.json');

const deterministicManifest = manifest.getDeterministicExport();

fs.writeFileSync(speciesBinPath, Buffer.from(speciesBuf));
fs.writeFileSync(movesBinPath, Buffer.from(movesBuf));
fs.writeFileSync(extManifestPath, JSON.stringify(deterministicManifest, null, 2), 'utf8');
fs.writeFileSync(romfsManifestPath, JSON.stringify(deterministicManifest, null, 2), 'utf8');
fs.writeFileSync(extProvPath, JSON.stringify(provenance.generateReport(), null, 2), 'utf8');

// 5. Calculate memory budget
const budget = RomFSExporter.calculateResourceBudget(deterministicManifest, dataManager.assetRepo);

console.log(`  ✓ Generated: ${path.relative(ROOT_DIR, speciesBinPath)} (${speciesBuf.byteLength} bytes)`);
console.log(`  ✓ Generated: ${path.relative(ROOT_DIR, movesBinPath)} (${movesBuf.byteLength} bytes)`);
console.log(`  ✓ Generated: ${path.relative(ROOT_DIR, extManifestPath)}`);
console.log(`  ✓ Generated: ${path.relative(ROOT_DIR, extProvPath)}`);
console.log('\n--- 3DS HARDWARE RESOURCE BUDGET ---');
console.log(`  • VRAM Usage: ${(budget.usage.textureMemoryBytes / 1024).toFixed(1)} KB / 6144 KB (${budget.status.vramOk ? 'PASSED' : 'EXCEEDED'})`);
console.log(`  • Linear RAM Usage: ${(budget.usage.totalRamUsedBytes / 1024).toFixed(1)} KB / 98304 KB (${budget.status.ramOk ? 'PASSED' : 'EXCEEDED'})`);
console.log(`  • Sprite Count: ${budget.usage.spriteCount}`);
console.log(`  • Est. Draw Calls: ${budget.usage.estimatedDrawCalls}`);
console.log('\n====================================================');
console.log('  ROMFS BUILD COMPLETED SUCCESSFULLY');
console.log('====================================================\n');
