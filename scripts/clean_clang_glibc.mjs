import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetDirs = [
  path.join(rootDir, 'node_modules', 'clang-linux-x64'),
  path.join(rootDir, 'node_modules', 'clang-wasm-linux-x64')
];

for (const dir of targetDirs) {
  if (fs.existsSync(dir)) {
    const glibcFiles = ['libm.so.6', 'libc.so.6', 'libpthread.so.0', 'ld-linux-x86-64.so.2'];
    for (const file of glibcFiles) {
      const fullPath = path.join(dir, file);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          console.log(`[clean_clang_glibc] Removed bundled glibc override: ${fullPath}`);
        } catch (e) {
          console.warn(`[clean_clang_glibc] Warning: could not delete ${fullPath}: ${e.message}`);
        }
      }
    }
  }
}
