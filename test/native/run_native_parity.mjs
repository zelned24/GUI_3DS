import { SceneModel } from '../../public/js/core/SceneModel.js';
import { ComponentRegistry } from '../../public/js/components/ComponentRegistry.js';
import { AnimationTrack } from '../../public/js/animation/AnimationTrack.js';
import { NativeParityRunner } from './NativeParityRunner.js';

console.log('====================================================');
console.log('  RUNNING NATIVE PARITY HARNESS (C++ vs JS)         ');
console.log('====================================================');

const scene = new SceneModel({
  id: 'NativeParityVerificationScene',
  name: 'Native Parity Verification Scene',
  durationFrames: 60,
  fps: 60
});

// Setup nodes and tracks across all 5 interpolation curves
const nodeA = ComponentRegistry.create('Image', {
  id: 'node_parity',
  name: 'Node Parity',
  screen: 'top',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  properties: { assetId: 'bg_arena_plains' }
});
scene.addNode(nodeA);

const trackX = new AnimationTrack({ targetNodeId: 'node_parity', propertyPath: 'transform.x' });
trackX.addKeyframe(0, 0, 'linear');
trackX.addKeyframe(60, 300, 'linear');
scene.addTrack(trackX);

const trackY = new AnimationTrack({ targetNodeId: 'node_parity', propertyPath: 'transform.y' });
trackY.addKeyframe(0, 10, 'easeIn');
trackY.addKeyframe(60, 200, 'easeIn');
scene.addTrack(trackY);

const trackScale = new AnimationTrack({ targetNodeId: 'node_parity', propertyPath: 'transform.scaleX' });
trackScale.addKeyframe(0, 0.5, 'easeOut');
trackScale.addKeyframe(60, 2.0, 'easeOut');
scene.addTrack(trackScale);

const trackRot = new AnimationTrack({ targetNodeId: 'node_parity', propertyPath: 'transform.rotation' });
trackRot.addKeyframe(0, 0, 'easeInOut');
trackRot.addKeyframe(60, 3.14159, 'easeInOut');
scene.addTrack(trackRot);

const trackOp = new AnimationTrack({ targetNodeId: 'node_parity', propertyPath: 'opacity' });
trackOp.addKeyframe(0, 1.0, 'step');
trackOp.addKeyframe(30, 0.5, 'step');
trackOp.addKeyframe(60, 0.0, 'step');
scene.addTrack(trackOp);

try {
  const result = await NativeParityRunner.runParityTest(scene, {
    frames: [0, 5, 15, 30, 45, 60]
  });

  if (result.pass) {
    console.log(`✓ All ${result.totalChecks} mathematical parity checks passed between C++ and JS!`);
    console.log('====================================================');
    console.log('  NATIVE PARITY VERIFICATION PASSED (100% SUCCESS)  ');
    console.log('====================================================');
    process.exit(0);
  } else {
    console.error('Parity verification failed. Reports:', result.reports);
    process.exit(1);
  }
} catch (err) {
  console.error('Native parity test error:', err);
  process.exit(1);
}
