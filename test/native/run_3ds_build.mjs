import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('====================================================');
console.log('  3DS CITRO2D / devkitARM HARDWARE COMPILATION      ');
console.log('====================================================');

// Pre-flight toolchain check
try {
  execSync(`node "${path.join(__dirname, 'check_3ds_toolchain.mjs')}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('\nBuild cannot proceed: 3DS toolchain is missing or incomplete.');
  console.error('STATUS: BLOCKED — missing toolchain/dependency');
  process.exit(1);
}

// Toolchain is present, invoke real devkitARM build
try {
  console.log('[1/2] Invoking real devkitARM 3DS build (make -f Makefile.3ds 3ds)...');
  execSync('make -f Makefile.3ds 3ds', { cwd: rootDir, stdio: 'inherit' });

  const elfPath = path.join(rootDir, 'build', 'GUI_3DS.elf');
  const d3sxPath = path.join(rootDir, 'build', 'GUI_3DS.3dsx');

  if (!fs.existsSync(elfPath) || !fs.existsSync(d3sxPath)) {
    throw new Error('Build completed but output binaries (.elf or .3dsx) were not created');
  }

  console.log(`[2/2] ✓ Real 3DS ELF produced: ${elfPath}`);
  console.log(`[2/2] ✓ Real 3DSX produced: ${d3sxPath}`);
  console.log('====================================================');
  console.log('  3DS BUILD SUCCESSFUL                              ');
  console.log('====================================================');
  process.exit(0);
} catch (err) {
  console.error('3DS compilation/link failed:', err.message);
  process.exit(1);
}
