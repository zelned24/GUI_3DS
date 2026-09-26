import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('====================================================');
console.log('  3DS DEVKITARM / CITRO2D TOOLCHAIN VERIFICATION     ');
console.log('====================================================');

const results = {
  env: {},
  tools: {},
  libraries: {},
  missing: []
};

// Resolve real local Windows devkitPro paths if process.env has stale linux defaults
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
}

// 1. Check Environment Variables
const envVars = ['DEVKITPRO', 'DEVKITARM', 'CTRULIB'];
for (const ev of envVars) {
  const val = process.env[ev];
  if (val && fs.existsSync(val)) {
    results.env[ev] = val;
    console.log(`  ✓ ${ev}: ${val}`);
  } else {
    results.env[ev] = null;
    results.missing.push(`Environment variable ${ev}`);
    console.log(`  ✗ ${ev}: ${val ? 'DIRECTORY NOT FOUND (' + val + ')' : 'NOT SET'}`);
  }
}

// 2. Check Toolchain Binaries
const isWin = process.platform === 'win32';
const whichCmd = isWin ? 'where' : 'which';

const binaries = [
  'arm-none-eabi-gcc',
  'arm-none-eabi-g++',
  '3dsxtool',
  'tex3ds'
];

for (const bin of binaries) {
  let foundPath = null;
  // Check in PATH
  try {
    const out = execSync(`${whichCmd} ${bin}`, { stdio: 'pipe' }).toString().trim().split(/\r?\n/)[0];
    if (out && fs.existsSync(out)) foundPath = out;
  } catch (e) {}

  // Check in standard devkitARM/devkitPro paths
  const candidateDirs = [];
  if (process.env.DEVKITARM) candidateDirs.push(path.join(process.env.DEVKITARM, 'bin'));
  if (process.env.DEVKITPRO) {
    candidateDirs.push(path.join(process.env.DEVKITPRO, 'tools', 'bin'));
    candidateDirs.push(path.join(process.env.DEVKITPRO, 'devkitARM', 'bin'));
  }
  candidateDirs.push('/opt/devkitpro/tools/bin', '/opt/devkitpro/devkitARM/bin', 'C:/devkitPro/tools/bin', 'C:/devkitPro/devkitARM/bin');

  for (const cDir of candidateDirs) {
    if (!foundPath) {
      const p1 = path.join(cDir, isWin ? `${bin}.exe` : bin);
      if (fs.existsSync(p1)) foundPath = p1;
      const p2 = path.join(cDir, bin);
      if (fs.existsSync(p2)) foundPath = p2;
    }
  }

  if (foundPath) {
    results.tools[bin] = foundPath;
    console.log(`  ✓ ${bin}: ${foundPath}`);
  } else {
    results.tools[bin] = null;
    results.missing.push(`Tool ${bin}`);
    console.log(`  ✗ ${bin}: NOT FOUND`);
  }
}

// 3. Check Citro2D, Citro3D, and ctru Headers / Libraries
const headerSearchDirs = [];
if (process.env.CTRULIB) headerSearchDirs.push(path.join(process.env.CTRULIB, 'include'));
if (process.env.DEVKITPRO) {
  headerSearchDirs.push(path.join(process.env.DEVKITPRO, 'libctru', 'include'));
  headerSearchDirs.push(path.join(process.env.DEVKITPRO, 'portlibs', '3ds', 'include'));
}
headerSearchDirs.push(
  '/opt/devkitpro/libctru/include',
  '/opt/devkitpro/portlibs/3ds/include',
  'C:/devkitPro/libctru/include',
  'C:/devkitPro/portlibs/3ds/include'
);

function findHeader(headerName) {
  for (const dir of headerSearchDirs) {
    const candidate = path.join(dir, headerName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const ctruHeader = findHeader('3ds.h');
if (ctruHeader) {
  results.libraries['ctru'] = ctruHeader;
  console.log(`  ✓ ctru: ${ctruHeader}`);
} else {
  results.libraries['ctru'] = null;
  results.missing.push('ctru header (3ds.h)');
  console.log(`  ✗ ctru: NOT FOUND`);
}

const citro2dHeader = findHeader('citro2d.h');
if (citro2dHeader) {
  results.libraries['citro2d'] = citro2dHeader;
  console.log(`  ✓ citro2d: ${citro2dHeader}`);
} else {
  results.libraries['citro2d'] = null;
  results.missing.push('citro2d header/lib');
  console.log(`  ✗ citro2d: NOT FOUND`);
}

const citro3dHeader = findHeader('citro3d.h');
if (citro3dHeader) {
  results.libraries['citro3d'] = citro3dHeader;
  console.log(`  ✓ citro3d: ${citro3dHeader}`);
} else {
  results.libraries['citro3d'] = null;
  results.missing.push('citro3d header/lib');
  console.log(`  ✗ citro3d: NOT FOUND`);
}

console.log('----------------------------------------------------');

if (results.missing.length > 0) {
  console.error(`\nSTATUS: BLOCKED — missing toolchain/dependency`);
  console.error(`Missing required 3DS toolchain components (${results.missing.length}):`);
  results.missing.forEach(m => console.error(`  - ${m}`));
  console.error(`\nPer FASE 0 & FASE 8 rules: refuses to fake 3DS build with WASM or stubs.`);
  console.error(`To unblock real Nintendo 3DS compilation:`);
  console.error(`  1. Install devkitPro with 3DS development payload (dkp-pacman -S 3ds-dev)`);
  console.error(`  2. Set DEVKITPRO and DEVKITARM environment variables`);
  console.error(`  3. Ensure citro2d, citro3d, tex3ds, and 3dsxtool are installed.\n`);
  process.exit(1);
} else {
  console.log(`\nSTATUS: TOOLCHAIN READY`);
  console.log(`All required 3DS toolchain components verified.\n`);
  process.exit(0);
}
