import { InterpolationTypes } from '../animation/Keyframe.js';

/**
 * SceneValidator - Strict pre-export validation for GUI_3DS scenes.
 * Detects structural corruptions, broken references, out-of-range keyframes,
 * missing assets, and invalid dimensions before code generation.
 * 
 * Fails explicitly and deterministically.
 */
export class SceneValidator {
  static VALID_PROPERTY_PATHS = new Set([
    'transform.x', 'x',
    'transform.y', 'y',
    'transform.scaleX', 'scaleX',
    'transform.scaleY', 'scaleY',
    'transform.rotation', 'rotation',
    'transform.opacity', 'opacity',
    'transform.pivotX', 'pivotX',
    'transform.pivotY', 'pivotY',
    'visible'
  ]);

  static VALID_INTERPOLATIONS = new Set(Object.values(InterpolationTypes));

  /**
   * Validates a SceneModel or raw scene JSON object.
   * @param {Object} scene 
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  static validate(scene) {
    const errors = [];
    const warnings = [];

    if (!scene || typeof scene !== 'object') {
      return {
        valid: false,
        errors: ['Scene must be a valid non-null object'],
        warnings: []
      };
    }

    // 1. Scene ID
    if (!scene.id || typeof scene.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(scene.id)) {
      errors.push(`Invalid scene ID "${scene.id}": must be a non-empty alphanumeric string (with optional _ or -)`);
    }

    // 2. Dual Screen Dimensions (Mandatory Nintendo 3DS 400x240 Top, 320x240 Bottom)
    if (!scene.top || scene.top.width !== 400 || scene.top.height !== 240) {
      errors.push(`Invalid Top Screen dimensions: must be exactly 400x240 (received ${scene.top?.width}x${scene.top?.height})`);
    }

    if (!scene.bottom || scene.bottom.width !== 320 || scene.bottom.height !== 240) {
      errors.push(`Invalid Bottom Screen dimensions: must be exactly 320x240 (received ${scene.bottom?.width}x${scene.bottom?.height})`);
    }

    // 3. Temporal Constraints (Integer Frame Authority)
    const duration = scene.durationFrames;
    if (!Number.isInteger(duration) || duration < 1) {
      errors.push(`Invalid durationFrames "${duration}": must be an integer >= 1`);
    }

    const fps = scene.fps;
    if (!Number.isInteger(fps) || fps < 1) {
      errors.push(`Invalid fps "${fps}": must be an integer >= 1`);
    }

    // 4. Node Graph Validation
    const rawNodes = scene.nodes || scene.components || [];
    if (!Array.isArray(rawNodes)) {
      errors.push('Scene nodes/components must be an array');
    }

    const nodeIds = new Set();
    const nodeMap = new Map();

    for (let i = 0; i < rawNodes.length; i++) {
      const node = rawNodes[i];
      if (!node || typeof node !== 'object') {
        errors.push(`Node at index ${i} is not a valid object`);
        continue;
      }

      if (!node.id || typeof node.id !== 'string') {
        errors.push(`Node at index ${i} has missing or non-string ID`);
        continue;
      }

      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID detected: "${node.id}"`);
      }
      nodeIds.add(node.id);
      nodeMap.set(node.id, node);

      // Validate screen assignment
      if (node.screen && !['top', 'bottom', 'global'].includes(node.screen)) {
        errors.push(`Node "${node.id}" has invalid screen "${node.screen}": must be 'top', 'bottom', or 'global'`);
      }

      // Validate ImageNode asset reference
      if (node.type === 'Image' || node.type === 'ImageNode') {
        const asset = node.properties?.asset;
        if (!asset || typeof asset !== 'string' || asset.trim() === '') {
          errors.push(`ImageNode "${node.id}" is missing required asset reference in properties.asset`);
        }
      }

      // Validate PokemonSpriteNode species / dexId
      if (node.type === 'PokemonSprite' || node.type === 'PokemonSpriteNode') {
        const dexId = node.properties?.nationalDexId;
        if (dexId === undefined || dexId === null || !Number.isInteger(Number(dexId)) || Number(dexId) <= 0) {
          errors.push(`PokemonSpriteNode "${node.id}" has invalid nationalDexId "${dexId}"`);
        }
      }
    }

    // 5. Parent-Child Hierarchy and Cycle Detection
    for (const [nodeId, node] of nodeMap.entries()) {
      if (node.parent) {
        if (!nodeMap.has(node.parent)) {
          errors.push(`Node "${nodeId}" references non-existent parent "${node.parent}"`);
        } else if (node.parent === nodeId) {
          errors.push(`Node "${nodeId}" cannot be its own parent`);
        } else {
          // Check for cycles
          let curr = nodeMap.get(node.parent);
          const visited = new Set([nodeId]);
          while (curr && curr.parent) {
            if (visited.has(curr.parent)) {
              errors.push(`Hierarchy cycle detected involving node "${nodeId}" and parent "${curr.parent}"`);
              break;
            }
            visited.add(curr.parent);
            curr = nodeMap.get(curr.parent);
          }
        }
      }
    }

    // 6. Animation Tracks Validation
    const tracks = scene.tracks || [];
    if (!Array.isArray(tracks)) {
      errors.push('Scene tracks must be an array');
    } else {
      const trackIdSet = new Set();

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (!track || typeof track !== 'object') {
          errors.push(`Track at index ${i} is not a valid object`);
          continue;
        }

        if (track.id) {
          if (trackIdSet.has(track.id)) {
            warnings.push(`Duplicate track ID "${track.id}" (will be normalized)`);
          }
          trackIdSet.add(track.id);
        }

        // Must point to an existing node
        if (!track.targetNodeId || !nodeIds.has(track.targetNodeId)) {
          errors.push(`Track index ${i} targets non-existent node "${track.targetNodeId}"`);
        }

        // Must have valid property path
        if (!track.propertyPath || typeof track.propertyPath !== 'string') {
          errors.push(`Track index ${i} has invalid or missing propertyPath`);
        } else {
          const isStandard = this.VALID_PROPERTY_PATHS.has(track.propertyPath);
          const isCustomProp = track.propertyPath.startsWith('properties.');
          if (!isStandard && !isCustomProp) {
            errors.push(`Track targeting "${track.targetNodeId}" has unsupported propertyPath "${track.propertyPath}"`);
          }
        }

        // Validate keyframes
        const keyframes = track.keyframes || [];
        if (!Array.isArray(keyframes)) {
          errors.push(`Track targeting "${track.targetNodeId}" keyframes must be an array`);
        } else {
          for (let k = 0; k < keyframes.length; k++) {
            const kf = keyframes[k];
            if (!kf || typeof kf !== 'object') {
              errors.push(`Track "${track.id || i}" keyframe at index ${k} is invalid`);
              continue;
            }

            if (!Number.isInteger(kf.frame)) {
              errors.push(`Track "${track.id || i}" keyframe at index ${k} has non-integer frame "${kf.frame}"`);
            } else if (kf.frame < 0 || (Number.isInteger(duration) && kf.frame > duration)) {
              errors.push(`Track "${track.id || i}" keyframe at frame ${kf.frame} is out of scene range [0..${duration}]`);
            }

            if (kf.value === undefined || kf.value === null || (typeof kf.value === 'number' && isNaN(kf.value))) {
              errors.push(`Track "${track.id || i}" keyframe at frame ${kf.frame} has invalid value: ${kf.value}`);
            }

            if (kf.interpolation && !this.VALID_INTERPOLATIONS.has(kf.interpolation)) {
              errors.push(`Track "${track.id || i}" keyframe at frame ${kf.frame} has unknown interpolation "${kf.interpolation}"`);
            }
          }
        }
      }
    }

    // 7. Timeline Markers Validation
    const markers = scene.markers || [];
    if (Array.isArray(markers)) {
      for (let m = 0; m < markers.length; m++) {
        const marker = markers[m];
        if (!marker || typeof marker !== 'object') continue;
        if (!Number.isInteger(marker.frame) || marker.frame < 0 || (Number.isInteger(duration) && marker.frame > duration)) {
          errors.push(`Marker "${marker.name || m}" has out-of-range frame ${marker.frame} (expected [0..${duration}])`);
        }
      }
    }

    // 8. Audio Cues Validation
    const audioCues = scene.audioCues || [];
    if (Array.isArray(audioCues)) {
      for (let c = 0; c < audioCues.length; c++) {
        const cue = audioCues[c];
        if (!cue || typeof cue !== 'object') continue;
        if (!Number.isInteger(cue.frame) || cue.frame < 0 || (Number.isInteger(duration) && cue.frame > duration)) {
          errors.push(`Audio cue index ${c} has out-of-range frame ${cue.frame} (expected [0..${duration}])`);
        }
        if (!cue.asset || typeof cue.asset !== 'string' || cue.asset.trim() === '') {
          errors.push(`Audio cue index ${c} at frame ${cue.frame} has empty asset reference`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Asserts that a scene is valid; throws descriptive Error if invalid.
   * @param {Object} scene 
   */
  static assertValid(scene) {
    const report = this.validate(scene);
    if (!report.valid) {
      throw new Error(`Scene validation failed with ${report.errors.length} error(s):\n - ${report.errors.join('\n - ')}`);
    }
    return report;
  }
}
