import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { SceneValidator } from '../../public/js/generator/SceneValidator.js';
import { SceneCppExporter } from '../../public/js/generator/SceneCppExporter.js';
import { AssetPackager } from '../../public/js/generator/AssetPackager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// Ensure real local Windows devkitPro paths are resolved if process.env points to stale/default linux paths
if (process.platform === 'win32') {
  if ((!process.env.DEVKITPRO || !fs.existsSync(process.env.DEVKITPRO)) && fs.existsSync('C:/devkitPro')) {
    process.env.DEVKITPRO = 'C:/devkitPro';
  }
  if ((!process.env.DEVKITARM || !fs.existsSync(process.env.DEVKITARM)) && fs.existsSync('C:/devkitPro/devkitARM')) {
    process.env.DEVKITARM = 'C:/devkitPro/devkitARM';
  }
  if ((!process.env.CTRULIB || !fs.existsSync(process.env.CTRULIB)) && fs.existsSync('C:/devkitPro/libctru')) {
    process.env.CTRULIB = 'C:/devkitPro/libctru';
  }
  const extraPaths = [
    'C:\\devkitPro\\devkitARM\\bin',
    'C:\\devkitPro\\tools\\bin',
    'C:\\devkitPro\\msys2\\usr\\bin'
  ].filter(p => fs.existsSync(p));
  if (extraPaths.length > 0) {
    process.env.PATH = extraPaths.join(path.delimiter) + path.delimiter + (process.env.PATH || '');
  }
}

console.log('====================================================');
console.log('  3DS CITRO2D / devkitARM HARDWARE COMPILATION PIPELINE ');
console.log('====================================================');

// 1. Pre-flight toolchain check
try {
  execSync(`node "${path.join(__dirname, 'check_3ds_toolchain.mjs')}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('\nBuild cannot proceed: 3DS toolchain is missing or incomplete.');
  console.error('STATUS: BLOCKED — missing toolchain/dependency');
  process.exit(1);
}

async function runPipeline() {
  try {
    // 2. Scene Validation & Export
    console.log('\n[1/4] Validating and exporting Scene JSON to C++...');
    const scenePath = path.join(rootDir, 'project', 'screens', 'PikachuEntrance.json');
    if (!fs.existsSync(scenePath)) {
      throw new Error(`Scene file not found: ${scenePath}`);
    }
    const sceneData = JSON.parse(fs.readFileSync(scenePath, 'utf8'));

    const valResult = SceneValidator.validate(sceneData);
    if (!valResult.valid) {
      throw new Error(`Scene validation failed: ${valResult.errors.join(', ')}`);
    }

    const exportResult = SceneCppExporter.export(sceneData);
    for (const [relPath, content] of Object.entries(exportResult.files)) {
      const fullPath = path.join(rootDir, 'project', relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
    }
    fs.writeFileSync(
      path.join(rootDir, 'project', 'generated', 'SceneManifest.json'),
      JSON.stringify(exportResult.manifest, null, 2),
      'utf8'
    );
    console.log('  ✓ C++ scene code and AssetManifest exported');

    // 3. RomFS Asset Packaging via real tex3ds
    console.log('\n[2/4] Packaging assets into RomFS with real tex3ds...');
    const stagingDir = path.join(rootDir, 'build', 'romfs');
    fs.mkdirSync(stagingDir, { recursive: true });
    const packager = new AssetPackager({ stagingDir });
    const pkgResult = await packager.packageManifest(exportResult.manifest);
    console.log(`  ✓ RomFS staged: ${pkgResult.stagedFiles.length} assets packaged`);

    // 4. Invoke real devkitARM 3DS build
    console.log('\n[3/4] Invoking real devkitARM 3DS build (make -f Makefile.3ds 3ds)...');
    execSync('make -f Makefile.3ds 3ds', { cwd: rootDir, stdio: 'inherit' });

    // 5. Binary verification
    console.log('\n[4/4] Verifying generated 3DS binaries...');
    const elfPath = path.join(rootDir, 'build', 'GUI_3DS.elf');
    const d3sxPath = path.join(rootDir, 'build', 'GUI_3DS.3dsx');

    if (!fs.existsSync(elfPath) || fs.statSync(elfPath).size === 0) {
      throw new Error(`ELF binary missing or empty: ${elfPath}`);
    }
    if (!fs.existsSync(d3sxPath) || fs.statSync(d3sxPath).size === 0) {
      throw new Error(`3DSX binary missing or empty: ${d3sxPath}`);
    }

    console.log(`  ✓ Real ARM/ELF produced: ${elfPath} (${fs.statSync(elfPath).size} bytes)`);
    console.log(`  ✓ Real 3DSX with RomFS produced: ${d3sxPath} (${fs.statSync(d3sxPath).size} bytes)`);
    console.log('====================================================');
    console.log('  3DS BUILD PIPELINE COMPLETED SUCCESSFULLY (PASS)  ');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n3DS compilation/link failed:', err.message);
    if (err.isToolchainBlocked) {
      console.error('STATUS: BLOCKED — missing toolchain/dependency');
    }
    process.exit(1);
  }
}

await runPipeline();
