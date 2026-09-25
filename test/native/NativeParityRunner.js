import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { TimelineEvaluator } from '../../public/js/animation/TimelineEvaluator.js';
import { SceneCppExporter } from '../../public/js/generator/SceneCppExporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

/**
 * NativeParityRunner - Real compiled C++ execution harness.
 * Compiles real SceneData.cpp and SceneTimeline.cpp with clang into WebAssembly,
 * executes the compiled C++ binary, and compares frame-by-frame against TimelineEvaluator.js.
 */
export class NativeParityRunner {
  /**
   * Compiles and executes real C++ timeline evaluation, comparing against JS TimelineEvaluator.
   * 
   * @param {SceneModel} scene
   * @param {Object} [options]
   * @param {number[]} [options.frames] List of frames to test
   * @returns {Promise<{ pass: boolean, totalChecks: number, evaluatedFrames: number[], reports: Object[] }>}
   */
  static async runParityTest(scene, options = {}) {
    const exportResult = SceneCppExporter.export(scene);
    const buildDir = path.join(__dirname, 'build');
    fs.mkdirSync(buildDir, { recursive: true });

    const includeDir = path.join(buildDir, 'include', 'screens');
    const srcDir = path.join(buildDir, 'src', 'screens');
    fs.mkdirSync(includeDir, { recursive: true });
    fs.mkdirSync(srcDir, { recursive: true });

    // Write exported C++ data and timeline files to build dir
    fs.writeFileSync(path.join(includeDir, 'SceneData.hpp'), exportResult.dataHpp, 'utf8');
    fs.writeFileSync(path.join(srcDir, 'SceneData.cpp'), exportResult.dataCpp, 'utf8');
    fs.writeFileSync(path.join(includeDir, 'SceneTimeline.hpp'), exportResult.timelineHpp, 'utf8');
    fs.writeFileSync(path.join(srcDir, 'SceneTimeline.cpp'), exportResult.timelineCpp, 'utf8');

    const wasmOutPath = path.join(buildDir, 'harness.wasm');
    const harnessCpp = path.join(__dirname, 'native_parity_harness.cpp');
    const compatInclude = path.join(rootDir, 'project', 'include', 'compat');
    const projectInclude = path.join(rootDir, 'project', 'include');
    const buildInclude = path.join(buildDir, 'include');

    // Find clang binary
    const clangExe = path.join(rootDir, 'node_modules', 'clang-wasm-win64', 'clang.exe');
    if (!fs.existsSync(clangExe)) {
      throw new Error(`Clang executable not found at: ${clangExe}`);
    }

    const compileArgs = [
      '--target=wasm32',
      '-O2',
      '-nostdlib',
      '-fno-rtti',
      '-fno-exceptions',
      '-Wl,--no-entry',
      '-Wl,--export-all',
      `-I${buildInclude}`,
      `-I${compatInclude}`,
      `-I${projectInclude}`,
      '-o', wasmOutPath,
      path.join(srcDir, 'SceneData.cpp'),
      path.join(srcDir, 'SceneTimeline.cpp'),
      harnessCpp
    ];

    execFileSync(clangExe, compileArgs, { stdio: 'pipe' });

    if (!fs.existsSync(wasmOutPath)) {
      throw new Error(`Compilation failed: ${wasmOutPath} was not created`);
    }

    // Load compiled C++ WebAssembly module
    const wasmBuffer = fs.readFileSync(wasmOutPath);
    const wasmModule = await WebAssembly.instantiate(wasmBuffer);
    const exports = wasmModule.instance.exports;

    if (typeof exports.__wasm_call_ctors === 'function') {
      exports.__wasm_call_ctors();
    }

    const duration = scene.durationFrames || 60;
    const framesToEvaluate = options.frames || [
      0,
      1,
      Math.floor(duration / 4),
      Math.floor(duration / 2),
      Math.floor((duration * 3) / 4),
      duration - 1,
      duration,
      duration + 5 // Post-duration frame
    ];

    const reports = [];
    let totalChecks = 0;
    let allPassed = true;

    const rawNodes = scene.nodes || scene.components || [];
    const memory = exports.memory;
    const view = new DataView(memory.buffer);

    for (const frame of framesToEvaluate) {
      const jsEvalMap = TimelineEvaluator.evaluateScene(scene, frame);

      for (let nIdx = 0; nIdx < rawNodes.length; nIdx++) {
        const node = rawNodes[nIdx];
        const jsNodeEval = jsEvalMap.get(node.id) || { transform: {}, properties: {} };

        // Evaluate in real compiled C++
        const ptr = exports.harness_evaluate_node(nIdx, frame);
        const cppResult = {
          x: view.getFloat32(ptr + 0, true),
          y: view.getFloat32(ptr + 4, true),
          scaleX: view.getFloat32(ptr + 8, true),
          scaleY: view.getFloat32(ptr + 12, true),
          rotation: view.getFloat32(ptr + 16, true),
          opacity: view.getFloat32(ptr + 20, true),
          visible: view.getInt32(ptr + 24, true) !== 0
        };

        const expectedX = jsNodeEval.transform.x !== undefined ? jsNodeEval.transform.x : (node.x ?? 0);
        const expectedY = jsNodeEval.transform.y !== undefined ? jsNodeEval.transform.y : (node.y ?? 0);
        const expectedScaleX = jsNodeEval.transform.scaleX !== undefined ? jsNodeEval.transform.scaleX : (node.scaleX ?? 1.0);
        const expectedScaleY = jsNodeEval.transform.scaleY !== undefined ? jsNodeEval.transform.scaleY : (node.scaleY ?? 1.0);
        const expectedRotation = jsNodeEval.transform.rotation !== undefined ? jsNodeEval.transform.rotation : (node.rotation ?? 0.0);
        const expectedOpacity = jsNodeEval.transform?.opacity !== undefined ? jsNodeEval.transform.opacity : (jsNodeEval.opacity !== undefined ? jsNodeEval.opacity : (node.opacity ?? 1.0));
        const expectedVisible = jsNodeEval.visible !== undefined ? jsNodeEval.visible : (node.visible !== false);

        const deltaX = Math.abs(cppResult.x - expectedX);
        const deltaY = Math.abs(cppResult.y - expectedY);
        const deltaScaleX = Math.abs(cppResult.scaleX - expectedScaleX);
        const deltaScaleY = Math.abs(cppResult.scaleY - expectedScaleY);
        const deltaRot = Math.abs(cppResult.rotation - expectedRotation);
        const deltaOpacity = Math.abs(cppResult.opacity - expectedOpacity);
        const matchVisible = cppResult.visible === expectedVisible;

        const eps = 0.002;
        const passed = (
          deltaX <= eps &&
          deltaY <= eps &&
          deltaScaleX <= eps &&
          deltaScaleY <= eps &&
          deltaRot <= eps &&
          deltaOpacity <= eps &&
          matchVisible
        );

        totalChecks += 7;
        if (!passed) allPassed = false;

        reports.push({
          frame,
          nodeId: node.id,
          passed,
          js: {
            x: expectedX, y: expectedY, scaleX: expectedScaleX, scaleY: expectedScaleY,
            rotation: expectedRotation, opacity: expectedOpacity, visible: expectedVisible
          },
          cpp: cppResult,
          deltas: { deltaX, deltaY, deltaScaleX, deltaScaleY, deltaRot, deltaOpacity, matchVisible }
        });
      }
    }

    return {
      pass: allPassed,
      totalChecks,
      evaluatedFrames: framesToEvaluate,
      reports
    };
  }
}
