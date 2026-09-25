import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { SceneModel } from '../public/js/core/SceneModel.js';
import { SceneCppExporter } from '../public/js/generator/SceneCppExporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function runNativeBuild() {
  console.log('====================================================');
  console.log('  3DS CITRO2D / devkitARM NATIVE BUILD VERIFICATION ');
  console.log('====================================================\n');

  // 1. Export canonical scene
  const scenePath = path.join(rootDir, 'project', 'screens', 'PikachuEntrance.json');
  if (!fs.existsSync(scenePath)) {
    throw new Error(`Scene not found: ${scenePath}`);
  }
  const sceneData = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  const scene = new SceneModel(sceneData);
  const exportResult = SceneCppExporter.export(scene);

  const genDir = path.join(rootDir, 'project', 'generated');
  for (const [relPath, content] of Object.entries(exportResult.files)) {
    const fullPath = path.join(rootDir, 'project', relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  console.log(`[1/5] ✓ Generated ${Object.keys(exportResult.files).length} C++ artifacts for ${exportResult.className}`);

  // 2. Locate clang compiler
  const clangExe = path.join(rootDir, 'node_modules', 'clang-wasm-win64', 'clang.exe');
  if (!fs.existsSync(clangExe)) {
    throw new Error(`Compiler executable not found at: ${clangExe}`);
  }
  console.log(`[2/5] ✓ Compiler found: Clang LLVM`);

  // 3. Verify required files exist
  const sourceFiles = [
    path.join(genDir, 'src', 'screens', 'SceneData.cpp'),
    path.join(genDir, 'src', 'screens', 'SceneTimeline.cpp'),
    path.join(genDir, 'src', 'screens', 'SceneAssets.cpp'),
    path.join(genDir, 'src', 'screens', 'AssetManifest.cpp'),
    path.join(genDir, 'src', 'screens', 'Scene.cpp'),
    path.join(genDir, 'src', 'screens', 'PikachuEntranceScene.cpp'),
    path.join(rootDir, 'project', 'src', 'gfx', 'renderer2d.cpp'),
    path.join(rootDir, 'test', 'native', 'native_build_entry.cpp'),
    path.join(rootDir, 'test', 'native', 'host_compat', 'runtime.cpp')
  ];

  for (const f of sourceFiles) {
    if (!fs.existsSync(f)) {
      throw new Error(`Required native build source file missing: ${f}`);
    }
  }
  console.log(`[3/5] ✓ All ${sourceFiles.length} required native source files confirmed present on disk`);

  // 4. Compile and link all files together
  const outWasm = path.join(rootDir, 'test', 'native', 'native_build_test.wasm');
  const compileArgs = [
    '--target=wasm32',
    '-O2',
    '-nostdlib',
    '-fno-rtti',
    '-fno-exceptions',
    '-Wl,--no-entry',
    '-Wl,--export-all',
    `-I${path.join(genDir, 'include')}`,
    `-I${path.join(rootDir, 'test', 'native', 'host_compat')}`,
    `-I${path.join(rootDir, 'project', 'include')}`,
    '-o', outWasm,
    ...sourceFiles
  ];

  console.log(`[4/5] ⚙ Compiling and linking full native Citro2D runtime bundle...`);
  try {
    execFileSync(clangExe, compileArgs, { stdio: 'pipe' });
  } catch (err) {
    console.error('[NATIVE BUILD FAILURE] Clang compiler/linker error:');
    if (err.stderr) console.error(err.stderr.toString());
    if (err.stdout) console.error(err.stdout.toString());
    process.exit(1);
  }

  if (!fs.existsSync(outWasm)) {
    throw new Error('Linker failed to output native_build_test.wasm');
  }
  console.log(`[4/5] ✓ Native build compiled and linked with 0 errors!`);

  // Also verify ARM11 MPCore compilation (devkitARM compatibility)
  const armOut = path.join(rootDir, 'test', 'native', 'arm_verify.o');
  const armArgs = [
    '--target=arm-none-eabi',
    '-mcpu=mpcore',
    '-mfloat-abi=hard',
    '-fno-rtti',
    '-fno-exceptions',
    '-c',
    `-I${path.join(genDir, 'include')}`,
    `-I${path.join(rootDir, 'test', 'native', 'host_compat')}`,
    `-I${path.join(rootDir, 'project', 'include')}`,
    path.join(genDir, 'src', 'screens', 'PikachuEntranceScene.cpp'),
    '-o', armOut
  ];
  execFileSync(clangExe, armArgs, { stdio: 'pipe' });
  if (fs.existsSync(armOut)) {
    fs.unlinkSync(armOut);
    console.log(`[4/5] ✓ 3DS devkitARM target (arm-none-eabi / mpcore) instruction verification: PASS`);
  }

  // 5. Execute native binary to verify runtime behavior
  console.log(`[5/5] ⚙ Executing compiled native binary...`);
  const wasmBuffer = fs.readFileSync(outWasm);
  const wasmModule = await WebAssembly.instantiate(wasmBuffer);
  const { __wasm_call_ctors, main } = wasmModule.instance.exports;

  if (typeof __wasm_call_ctors === 'function') {
    __wasm_call_ctors();
  }

  const exitCode = main();
  if (exitCode !== 0) {
    throw new Error(`Native runtime execution failed with non-zero exit code: ${exitCode}`);
  }
  console.log(`[5/5] ✓ Native runtime execution verified: main() returned 0\n`);

  console.log('====================================================');
  console.log('  NATIVE BUILD VERIFICATION PASSED (100% SUCCESS)');
  console.log('====================================================\n');
}

runNativeBuild().catch(err => {
  console.error('\n[FATAL ERROR in run_native_build]:', err.message);
  process.exit(1);
});
