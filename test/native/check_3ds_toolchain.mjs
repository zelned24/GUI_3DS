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
const binaries = [
  'arm-none-eabi-gcc',
  'arm-none-eabi-g++',
  '3dsxtool',
  'makerom',
  'tex3ds'
];

for (const bin of binaries) {
  let foundPath = null;
  // Check in PATH
  try {
    const out = execSync(`where ${bin}`, { stdio: 'pipe' }).toString().trim().split('\r\n')[0];
    if (out && fs.existsSync(out)) foundPath = out;
  } catch (e) {}

  // Check in standard devkitARM/devkitPro paths if env exists
  if (!foundPath && process.env.DEVKITARM) {
    const devkitArmBin = path.join(process.env.DEVKITARM, 'bin', `${bin}.exe`);
    if (fs.existsSync(devkitArmBin)) foundPath = devkitArmBin;
  }
  if (!foundPath && process.env.DEVKITPRO) {
    const devkitProBin = path.join(process.env.DEVKITPRO, 'tools', 'bin', `${bin}.exe`);
    if (fs.existsSync(devkitProBin)) foundPath = devkitProBin;
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

// 3. Check Citro2D and Citro3D Headers / Libraries
const dkp = process.env.DEVKITPRO || 'C:/devkitPro';
const ctru = process.env.CTRULIB || path.join(dkp, 'libctru');
const citro2dHeader = path.join(ctru, 'include', 'citro2d.h');
const citro3dHeader = path.join(ctru, 'include', 'citro3d.h');

if (fs.existsSync(citro2dHeader)) {
  results.libraries['citro2d'] = citro2dHeader;
  console.log(`  ✓ citro2d: ${citro2dHeader}`);
} else {
  results.libraries['citro2d'] = null;
  results.missing.push('citro2d header/lib');
  console.log(`  ✗ citro2d: NOT FOUND`);
}

if (fs.existsSync(citro3dHeader)) {
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
