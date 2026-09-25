import { Transform } from '../core/Transform.js';

/**
 * TimelineEvaluator - Evaluates animation tracks for a given frame without mutating document state.
 * Maintains absolute separation between Document State (base node values) and Preview State.
 */
export class TimelineEvaluator {
  /**
   * Evaluates a single animation track at the given frame.
   * @param {AnimationTrack} track 
   * @param {number} frame 
   */
  static evaluateTrack(track, frame) {
    if (!track) return null;
    return track.evaluate(frame);
  }

  /**
   * Evaluates all active tracks in a Scene at the specified frame.
   * Produces an ephemeral evaluation snapshot map: nodeId -> evaluated properties.
   * 
   * @param {SceneModel} scene 
   * @param {number} frame 
   * @returns {Map<string, Object>} Map of nodeId -> evaluated state overrides
   */
  static evaluateScene(scene, frame) {
    const evaluatedMap = new Map();
    if (!scene || !Array.isArray(scene.tracks)) {
      return evaluatedMap;
    }

    const intFrame = Math.max(0, Math.round(frame));
    const tracks = scene.tracks;

    // Check if any track is soloed
    const hasSolo = tracks.some(t => t.solo);

    for (const track of tracks) {
      if (track.muted) continue;
      if (hasSolo && !track.solo) continue;

      const evaluatedValue = track.evaluate(intFrame);
      if (evaluatedValue === null || evaluatedValue === undefined) continue;

      if (!evaluatedMap.has(track.targetNodeId)) {
        evaluatedMap.set(track.targetNodeId, {
          transform: {},
          properties: {},
          visible: undefined
        });
      }

      const nodeEval = evaluatedMap.get(track.targetNodeId);
      this._applyPropertyPath(nodeEval, track.propertyPath, evaluatedValue);
    }

    return evaluatedMap;
  }

  /**
   * Injects evaluated value into the node evaluation dictionary.
   */
  static _applyPropertyPath(targetState, path, value) {
    if (path.startsWith('transform.')) {
      const prop = path.replace('transform.', '');
      targetState.transform[prop] = value;
      return;
    }

    if (path === 'opacity' || path === 'transform.opacity') {
      targetState.opacity = value;
      targetState.transform.opacity = value;
      return;
    }

    if (path === 'x' || path === 'y' || path === 'scaleX' || path === 'scaleY' || path === 'rotation') {
      targetState.transform[path] = value;
      return;
    }

    if (path === 'visible') {
      targetState.visible = Boolean(value);
      return;
    }

    if (path.startsWith('properties.')) {
      const prop = path.replace('properties.', '');
      targetState.properties[prop] = value;
      return;
    }

    // Default to general properties
    targetState.properties[path] = value;
  }

  /**
   * Computes the temporary evaluated transform for rendering, without altering base node data.
   * @param {UINode} node 
   * @param {Map<string, Object>} evaluatedMap 
   * @returns {Transform}
   */
  static getEvaluatedTransform(node, evaluatedMap) {
    if (!node) return new Transform();
    const overrides = evaluatedMap?.get(node.id)?.transform;
    if (!overrides || Object.keys(overrides).length === 0) {
      return node.transform;
    }

    // Create non-persistent transient Transform with base + overrides
    return new Transform({
      x: overrides.x !== undefined ? Math.round(overrides.x) : node.transform.x,
      y: overrides.y !== undefined ? Math.round(overrides.y) : node.transform.y,
      width: overrides.width !== undefined ? Math.round(overrides.width) : node.transform.width,
      height: overrides.height !== undefined ? Math.round(overrides.height) : node.transform.height,
      scaleX: overrides.scaleX !== undefined ? parseFloat(overrides.scaleX) : node.transform.scaleX,
      scaleY: overrides.scaleY !== undefined ? parseFloat(overrides.scaleY) : node.transform.scaleY,
      pivotX: overrides.pivotX !== undefined ? parseFloat(overrides.pivotX) : node.transform.pivotX,
      pivotY: overrides.pivotY !== undefined ? parseFloat(overrides.pivotY) : node.transform.pivotY,
      rotation: overrides.rotation !== undefined ? parseFloat(overrides.rotation) : node.transform.rotation,
      opacity: overrides.opacity !== undefined ? Math.max(0, Math.min(1, parseFloat(overrides.opacity))) : node.transform.opacity
    });
  }

  /**
   * Computes the temporary visibility state for a node.
   * @param {UINode} node 
   * @param {Map<string, Object>} evaluatedMap 
   * @returns {boolean}
   */
  static getEvaluatedVisibility(node, evaluatedMap) {
    if (!node) return false;
    const overrides = evaluatedMap?.get(node.id);
    if (overrides && overrides.visible !== undefined) {
      return Boolean(overrides.visible);
    }
    return Boolean(node.visible);
  }
}
