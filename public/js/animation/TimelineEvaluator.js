import { Transform } from '../core/Transform.js';
import { AnimationTrack } from './AnimationTrack.js';
import { AnimationClip } from './AnimationClip.js';
import { SceneLibrary } from '../core/SceneLibrary.js';

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
    return typeof track.evaluate === 'function' ? track.evaluate(frame) : new AnimationTrack(track).evaluate(frame);
  }

  /**
   * Evaluates all active tracks in a Scene at the specified frame.
   * Produces an ephemeral evaluation snapshot map: nodeId -> evaluated properties.
   * 
   * @param {SceneModel} scene 
   * @param {number} frame 
   * @param {Object} [options]
   * @param {Function} [options.sceneResolver]
   * @returns {Map<string, Object>} Map of nodeId -> evaluated state overrides
   */
  static evaluateScene(scene, frame, options = {}) {
    const evaluatedMap = new Map();
    if (!scene) return evaluatedMap;

    const intFrame = Math.max(0, Math.round(frame));

    // 1. Evaluate sequencer clips placed on timeline
    if (Array.isArray(scene.sequence)) {
      for (const seqItem of scene.sequence) {
        if (seqItem.muted) continue;
        const start = seqItem.startFrame ?? 0;
        const dur = seqItem.durationFrames ?? 30;
        if (intFrame < start || intFrame > start + dur) continue;

        let clip = null;
        if (typeof scene.getClip === 'function') {
          clip = scene.getClip(seqItem.clipId);
        } else if (Array.isArray(scene.clips)) {
          const raw = scene.clips.find(c => c.id === seqItem.clipId);
          clip = raw ? (raw instanceof AnimationClip ? raw : AnimationClip.fromJSON(raw)) : null;
        }
        if (!clip || !Array.isArray(clip.tracks) || clip.durationFrames <= 0) continue;

        let offset = intFrame - start + (seqItem.clipStartOffset || 0);
        if (seqItem.loopCount > 1 || clip.loop) {
          offset = offset % clip.durationFrames;
        }
        const localFrame = Math.max(0, Math.min(clip.durationFrames, Math.round(offset)));

        for (const clipTrack of clip.tracks) {
          if (clipTrack.muted) continue;
          const evaluatedValue = typeof clipTrack.evaluate === 'function'
            ? clipTrack.evaluate(localFrame)
            : new AnimationTrack(clipTrack).evaluate(localFrame);
          if (evaluatedValue === null || evaluatedValue === undefined) continue;

          const targetNodeId = seqItem.targetNodeId || clipTrack.targetNodeId;
          if (!targetNodeId || targetNodeId === '__target__') continue;

          if (!evaluatedMap.has(targetNodeId)) {
            evaluatedMap.set(targetNodeId, {
              transform: {},
              properties: {},
              visible: undefined
            });
          }

          const nodeEval = evaluatedMap.get(targetNodeId);
          this._applyPropertyPath(nodeEval, clipTrack.propertyPath, evaluatedValue);
        }
      }
    }

    // 2. Evaluate direct tracks on the scene (overrides/layers on sequence)
    if (Array.isArray(scene.tracks)) {
      const tracks = scene.tracks;
      const hasSolo = tracks.some(t => t.solo);

      for (const track of tracks) {
        if (track.muted) continue;
        if (hasSolo && !track.solo) continue;

        const evaluatedValue = typeof track.evaluate === 'function'
          ? track.evaluate(intFrame)
          : new AnimationTrack(track).evaluate(intFrame);
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
    }

    // 3. Evaluate nested compositions (BETA-UI-7)
    const rawNodes = scene.nodes || scene.components || [];
    if (Array.isArray(rawNodes)) {
      for (const node of rawNodes) {
        const isComp = node.type === 'Composition' || node.type === 'CompositionNode' || (node.properties && node.properties.sceneId);
        if (isComp) {
          const childSceneId = node.properties?.sceneId || node.sceneId;
          const start = Math.round(node.properties?.startFrame ?? node.startFrame ?? 0);
          const dur = Math.round(node.properties?.durationFrames ?? node.durationFrames ?? 60);
          const offset = Math.round(node.properties?.localFrameOffset ?? node.localFrameOffset ?? 0);
          const rate = parseFloat(node.properties?.playbackRate ?? node.playbackRate ?? 1.0);
          const loop = Boolean(node.properties?.loop ?? node.loop ?? false);

          let local = Math.floor((intFrame - start) * rate) + offset;
          if (loop && dur > 0) {
            local = ((local % dur) + dur) % dur;
          } else {
            local = Math.max(0, Math.min(dur, local));
          }
          const localFrame = Math.round(local);

          if (!evaluatedMap.has(node.id)) {
            evaluatedMap.set(node.id, {
              transform: {},
              properties: {},
              visible: undefined
            });
          }

          const nodeEval = evaluatedMap.get(node.id);
          nodeEval.localFrame = localFrame;
          nodeEval.childSceneId = childSceneId;

          // Resolve child scene
          let childScene = null;
          if (options.sceneResolver && typeof options.sceneResolver === 'function') {
            childScene = options.sceneResolver(childSceneId);
          } else if (typeof SceneLibrary !== 'undefined') {
            childScene = SceneLibrary.getScene(childSceneId);
          }

          if (childScene) {
            const evalStack = new Set(options._evalStack || []);
            if (!evalStack.has(childSceneId)) {
              evalStack.add(childSceneId);
              const childEval = TimelineEvaluator.evaluateScene(childScene, localFrame, {
                ...options,
                _evalStack: evalStack
              });

              // Ensure all nodes in the child composition are present in childEval
              const childNodes = childScene.nodes || childScene.components || [];
              for (const cn of childNodes) {
                if (!childEval.has(cn.id)) {
                  childEval.set(cn.id, {
                    transform: {
                      x: cn.x ?? cn.transform?.x ?? 0,
                      y: cn.y ?? cn.transform?.y ?? 0,
                      width: cn.width ?? cn.transform?.width ?? 100,
                      height: cn.height ?? cn.transform?.height ?? 40,
                      scaleX: cn.transform?.scaleX ?? 1.0,
                      scaleY: cn.transform?.scaleY ?? 1.0,
                      pivotX: cn.transform?.pivotX ?? 0.0,
                      pivotY: cn.transform?.pivotY ?? 0.0,
                      rotation: cn.transform?.rotation ?? 0.0,
                      opacity: cn.opacity ?? cn.transform?.opacity ?? 1.0
                    },
                    properties: { ...(cn.properties || {}) },
                    visible: cn.visible !== false
                  });
                }
              }

              nodeEval.nestedEvaluations = childEval;
              if (childEval instanceof Map) {
                for (const [childNodeId, childNodeVal] of childEval.entries()) {
                  if (!evaluatedMap.has(childNodeId)) {
                    evaluatedMap.set(childNodeId, childNodeVal);
                  }
                }
              }
            }
          }

          // Apply overrides
          const overrides = node.overrides || node.properties?.overrides;
          if (overrides && typeof overrides === 'object') {
            if (overrides.visible !== undefined) nodeEval.visible = Boolean(overrides.visible);
            if (overrides.opacity !== undefined) {
              const clamped = Math.max(0, Math.min(1, Number(overrides.opacity)));
              nodeEval.opacity = clamped;
              nodeEval.transform.opacity = clamped;
            }
            if (overrides.x !== undefined) nodeEval.transform.x = Number(overrides.x);
            if (overrides.y !== undefined) nodeEval.transform.y = Number(overrides.y);
            if (overrides.scaleX !== undefined) nodeEval.transform.scaleX = Number(overrides.scaleX);
            if (overrides.scaleY !== undefined) nodeEval.transform.scaleY = Number(overrides.scaleY);
            if (overrides.rotation !== undefined) nodeEval.transform.rotation = Number(overrides.rotation);
          }
        }
      }
    }

    return evaluatedMap;
  }

  /**
   * Injects evaluated value into the node evaluation dictionary.
   */
  static _applyPropertyPath(targetState, path, value) {
    if (path === 'opacity' || path === 'transform.opacity') {
      const clamped = Math.max(0.0, Math.min(1.0, Number(value)));
      targetState.opacity = clamped;
      targetState.transform.opacity = clamped;
      return;
    }

    if (path.startsWith('transform.')) {
      const prop = path.replace('transform.', '');
      targetState.transform[prop] = Number(value);
      return;
    }

    if (path === 'x' || path === 'y' || path === 'scaleX' || path === 'scaleY' || path === 'rotation') {
      targetState.transform[path] = Number(value);
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
