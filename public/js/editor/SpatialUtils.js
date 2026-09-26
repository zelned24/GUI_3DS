import { globalRNG } from '../core/DeterministicRNG.js';
import { AnimationTrack } from '../animation/AnimationTrack.js';

/**
 * SpatialUtils - Professional composition tools for 2D 3DS UI authoring:
 * - Alignment & Distribution
 * - Z-Order manipulation
 * - Integer spatial snapping (screen edges, screen center, safe areas, grid, guides, node bounds)
 * - Combined selection bounds
 * - Node copy/paste and animated node duplication with history undo/redo
 */
export class SpatialUtils {
  /**
   * Computes combined bounding box for a set of components without mutating document state.
   * @param {Array<Object>} components 
   * @returns {{ x: number, y: number, width: number, height: number, right: number, bottom: number, centerX: number, centerY: number }|null}
   */
  static getCombinedBounds(components) {
    if (!Array.isArray(components) || components.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const c of components) {
      const cx = Math.round(c.x);
      const cy = Math.round(c.y);
      const cw = Math.round(c.width);
      const ch = Math.round(c.height);

      if (cx < minX) minX = cx;
      if (cy < minY) minY = cy;
      if (cx + cw > maxX) maxX = cx + cw;
      if (cy + ch > maxY) maxY = cy + ch;
    }

    if (minX === Infinity) return null;

    const width = maxX - minX;
    const height = maxY - minY;
    return {
      x: minX,
      y: minY,
      width,
      height,
      right: maxX,
      bottom: maxY,
      centerX: Math.round(minX + width / 2),
      centerY: Math.round(minY + height / 2)
    };
  }

  // --- Alignment Tools ---

  /**
   * Aligns multiple components according to alignment type.
   * @param {Array<Object>} components 
   * @param {'left'|'center-h'|'right'|'top'|'center-v'|'bottom'} type 
   * @param {Object} [sceneModel] 
   * @param {Object} [historyManager] 
   * @returns {boolean}
   */
  static align(components, type, sceneModel = null, historyManager = null) {
    if (!Array.isArray(components) || components.length < 2) return false;
    const bounds = this.getCombinedBounds(components);
    if (!bounds) return false;

    const records = [];

    for (const comp of components) {
      if (comp.locked) continue; // Respect node locking
      const initial = { x: comp.x, y: comp.y };
      let newX = comp.x;
      let newY = comp.y;

      switch (type) {
        case 'left':
          newX = bounds.x;
          break;
        case 'center-h':
          newX = Math.round(bounds.centerX - comp.width / 2);
          break;
        case 'right':
          newX = Math.round(bounds.right - comp.width);
          break;
        case 'top':
          newY = bounds.y;
          break;
        case 'center-v':
          newY = Math.round(bounds.centerY - comp.height / 2);
          break;
        case 'bottom':
          newY = Math.round(bounds.bottom - comp.height);
          break;
        default:
          return false;
      }

      if (newX !== initial.x || newY !== initial.y) {
        records.push({ comp, initial, updated: { x: newX, y: newY } });
        comp.x = newX;
        comp.y = newY;
      }
    }

    if (records.length > 0 && historyManager && typeof historyManager.push === 'function') {
      historyManager.push({
        description: `Align ${components.length} components (${type})`,
        undo: () => {
          for (const rec of records) {
            rec.comp.x = rec.initial.x;
            rec.comp.y = rec.initial.y;
          }
        },
        execute: () => {
          for (const rec of records) {
            rec.comp.x = rec.updated.x;
            rec.comp.y = rec.updated.y;
          }
        }
      });
    }

    return records.length > 0;
  }

  // --- Distribution Tools ---

  /**
   * Distributes components evenly along the horizontal or vertical axis.
   * Keeps the extreme ends fixed and spaces intermediate components evenly with integer positions.
   * 
   * @param {Array<Object>} components 
   * @param {'horizontal'|'vertical'} axis 
   * @param {Object} [sceneModel] 
   * @param {Object} [historyManager] 
   * @returns {boolean}
   */
  static distribute(components, axis, sceneModel = null, historyManager = null) {
    if (!Array.isArray(components) || components.length < 3) return false;

    // Filter out locked nodes
    const valid = components.filter(c => !c.locked);
    if (valid.length < 3) return false;

    const records = [];

    if (axis === 'horizontal') {
      const sorted = [...valid].sort((a, b) => a.x - b.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      const totalSpan = last.x - first.x;
      const step = totalSpan / (sorted.length - 1);

      for (let i = 1; i < sorted.length - 1; i++) {
        const comp = sorted[i];
        const initial = { x: comp.x, y: comp.y };
        const newX = Math.round(first.x + i * step);

        if (newX !== initial.x) {
          records.push({ comp, initial, updated: { x: newX, y: comp.y } });
          comp.x = newX;
        }
      }
    } else if (axis === 'vertical') {
      const sorted = [...valid].sort((a, b) => a.y - b.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      const totalSpan = last.y - first.y;
      const step = totalSpan / (sorted.length - 1);

      for (let i = 1; i < sorted.length - 1; i++) {
        const comp = sorted[i];
        const initial = { x: comp.x, y: comp.y };
        const newY = Math.round(first.y + i * step);

        if (newY !== initial.y) {
          records.push({ comp, initial, updated: { x: comp.x, y: newY } });
          comp.y = newY;
        }
      }
    }

    if (records.length > 0 && historyManager && typeof historyManager.push === 'function') {
      historyManager.push({
        description: `Distribute ${valid.length} components (${axis})`,
        undo: () => {
          for (const rec of records) {
            rec.comp.x = rec.initial.x;
            rec.comp.y = rec.initial.y;
          }
        },
        execute: () => {
          for (const rec of records) {
            rec.comp.x = rec.updated.x;
            rec.comp.y = rec.updated.y;
          }
        }
      });
    }

    return records.length > 0;
  }

  // --- Z-Order Manipulation ---

  /**
   * Adjusts z-ordering of a node in a scene.
   * @param {string} nodeId 
   * @param {'front'|'back'|'forward'|'backward'} action 
   * @param {Object} sceneModel 
   * @param {Object} [historyManager] 
   */
  static setZOrder(nodeId, action, sceneModel, historyManager = null) {
    if (!sceneModel) return false;
    const node = typeof sceneModel.getNode === 'function' ? sceneModel.getNode(nodeId) : null;
    if (!node) return false;

    const screenNodes = (sceneModel.nodes || sceneModel.components || [])
      .filter(n => n.screen === node.screen);

    if (screenNodes.length <= 1) return false;

    // Sort by current zIndex
    screenNodes.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const currentIndex = screenNodes.findIndex(n => n.id === nodeId);
    if (currentIndex === -1) return false;

    const oldZIndices = screenNodes.map(n => ({ node: n, zIndex: n.zIndex }));

    if (action === 'front') {
      screenNodes.splice(currentIndex, 1);
      screenNodes.push(node);
    } else if (action === 'back') {
      screenNodes.splice(currentIndex, 1);
      screenNodes.unshift(node);
    } else if (action === 'forward') {
      if (currentIndex < screenNodes.length - 1) {
        screenNodes[currentIndex] = screenNodes[currentIndex + 1];
        screenNodes[currentIndex + 1] = node;
      } else {
        return false;
      }
    } else if (action === 'backward') {
      if (currentIndex > 0) {
        screenNodes[currentIndex] = screenNodes[currentIndex - 1];
        screenNodes[currentIndex - 1] = node;
      } else {
        return false;
      }
    }

    // Assign integer zIndices 1..N
    const newZIndices = screenNodes.map((n, idx) => {
      n.zIndex = idx + 1;
      return { node: n, zIndex: n.zIndex };
    });

    if (historyManager && typeof historyManager.push === 'function') {
      historyManager.push({
        description: `Z-Order: ${action} on ${node.id}`,
        undo: () => {
          for (const item of oldZIndices) {
            item.node.zIndex = item.zIndex;
          }
        },
        execute: () => {
          for (const item of newZIndices) {
            item.node.zIndex = item.zIndex;
          }
        }
      });
    }

    return true;
  }

  // --- Spatial Snapping ---

  /**
   * Snaps a candidate position (x, y) with integer pixel precision.
   * Snaps to: screen edges, screen center, safe areas, grid, guides, other node edges and centers.
   * 
   * @param {Object} params
   * @param {number} params.x - Candidate logical X
   * @param {number} params.y - Candidate logical Y
   * @param {number} params.width - Node width
   * @param {number} params.height - Node height
   * @param {'top'|'bottom'} params.screen
   * @param {Object} [params.scene]
   * @param {number} [params.threshold=5]
   * @param {number} [params.gridSize=0]
   * @param {Array<Object>} [params.guides=[]]
   * @param {string} [params.ignoreNodeId=null]
   * @returns {{ x: number, y: number, snappedX: boolean, snappedY: boolean, snapLines: Array<{ type: 'x'|'y', val: number }> }}
   */
  static snapPosition({
    x, y, width, height,
    screen = 'top',
    scene = null,
    threshold = 5,
    gridSize = 0,
    guides = [],
    ignoreNodeId = null
  }) {
    let bestX = Math.round(x);
    let bestY = Math.round(y);
    let minDistX = threshold + 1;
    let minDistY = threshold + 1;
    let snappedX = false;
    let snappedY = false;
    const snapLines = [];

    const screenW = screen === 'top' ? 400 : 320;
    const screenH = 240;

    const targetsX = [
      0, // left edge
      Math.round(screenW / 2), // screen center
      screenW // right edge
    ];

    const targetsY = [
      0, // top edge
      Math.round(screenH / 2), // screen center
      screenH // bottom edge
    ];

    // Safe Areas (Title Safe 16px, Action Safe 8px)
    targetsX.push(16, screenW - 16, 8, screenW - 8);
    targetsY.push(16, screenH - 16, 8, screenH - 8);

    // Guides
    if (Array.isArray(guides)) {
      for (const g of guides) {
        if (g.screen && g.screen !== screen) continue;
        if (g.orientation === 'vertical') targetsX.push(Math.round(g.position));
        if (g.orientation === 'horizontal') targetsY.push(Math.round(g.position));
      }
    }

    // Other nodes in the scene
    if (scene) {
      const nodes = (scene.nodes || scene.components || []).filter(n => n.screen === screen && n.id !== ignoreNodeId);
      for (const n of nodes) {
        const nx = Math.round(n.x);
        const ny = Math.round(n.y);
        const nw = Math.round(n.width);
        const nh = Math.round(n.height);

        targetsX.push(nx, nx + nw, Math.round(nx + nw / 2));
        targetsY.push(ny, ny + nh, Math.round(ny + nh / 2));
      }
    }

    // Snap X
    const testPointsX = [
      { offset: 0, val: bestX }, // Left edge of moving node
      { offset: Math.round(width / 2), val: Math.round(bestX + width / 2) }, // Center
      { offset: width, val: Math.round(bestX + width) } // Right edge
    ];

    for (const tp of testPointsX) {
      for (const target of targetsX) {
        const dist = Math.abs(tp.val - target);
        if (dist <= threshold && dist < minDistX) {
          minDistX = dist;
          bestX = target - tp.offset;
          snappedX = true;
          snapLines.push({ type: 'x', val: target });
        }
      }
    }

    // Snap Y
    const testPointsY = [
      { offset: 0, val: bestY }, // Top edge
      { offset: Math.round(height / 2), val: Math.round(bestY + height / 2) }, // Center
      { offset: height, val: Math.round(bestY + height) } // Bottom edge
    ];

    for (const tp of testPointsY) {
      for (const target of targetsY) {
        const dist = Math.abs(tp.val - target);
        if (dist <= threshold && dist < minDistY) {
          minDistY = dist;
          bestY = target - tp.offset;
          snappedY = true;
          snapLines.push({ type: 'y', val: target });
        }
      }
    }

    // Grid snapping if not already snapped to stronger target
    if (!snappedX && gridSize > 1) {
      const gridX = Math.round(bestX / gridSize) * gridSize;
      if (Math.abs(bestX - gridX) <= threshold) {
        bestX = gridX;
        snappedX = true;
      }
    }
    if (!snappedY && gridSize > 1) {
      const gridY = Math.round(bestY / gridSize) * gridSize;
      if (Math.abs(bestY - gridY) <= threshold) {
        bestY = gridY;
        snappedY = true;
      }
    }

    return {
      x: Math.round(bestX),
      y: Math.round(bestY),
      snappedX,
      snappedY,
      snapLines
    };
  }

  // --- Copy / Paste / Duplicate with Animation ---

  static _nodeClipboard = null;

  /**
   * Copies node(s) and their associated animation tracks into internal clipboard.
   * @param {Array<Object>} components 
   * @param {Object} sceneModel 
   */
  static copyNodes(components, sceneModel = null) {
    if (!Array.isArray(components) || components.length === 0) return [];

    const copiedNodes = components.map(c => (typeof c.toJSON === 'function' ? c.toJSON() : JSON.parse(JSON.stringify(c))));
    const nodeIds = new Set(copiedNodes.map(n => n.id));

    // Gather animation tracks belonging to copied nodes
    const sceneTracks = (sceneModel && sceneModel.tracks) ? sceneModel.tracks : [];
    const copiedTracks = sceneTracks
      .filter(t => nodeIds.has(t.targetNodeId))
      .map(t => (typeof t.toJSON === 'function' ? t.toJSON() : JSON.parse(JSON.stringify(t))));

    this._nodeClipboard = {
      nodes: copiedNodes,
      tracks: copiedTracks
    };

    return copiedNodes;
  }

  /**
   * Pastes nodes from clipboard with freshly generated deterministic IDs, cloning animation tracks.
   * @param {Object} arg1 
   * @param {Object} [arg2] 
   * @param {Object} [arg3] 
   * @param {Object} [arg4] 
   * @returns {Array<Object>}
   */
  static pasteNodes(arg1, arg2, arg3, arg4) {
    let clipboard = this._nodeClipboard;
    let sceneModel = arg1;
    let historyManager = arg2;
    let options = arg3 || {};

    if (Array.isArray(arg1)) {
      clipboard = { nodes: arg1, tracks: [] };
      sceneModel = arg2;
      historyManager = arg3;
      options = arg4 || {};
    }

    if (!clipboard || !Array.isArray(clipboard.nodes) || clipboard.nodes.length === 0) {
      return [];
    }

    const offset = options.offset !== undefined ? options.offset : 8;
    const idMap = new Map();
    for (const n of clipboard.nodes) {
      const newId = `${n.type ? n.type.toLowerCase() : 'node'}_${globalRNG.nextId('node')}`;
      idMap.set(n.id, newId);
    }

    const newNodes = [];
    for (const raw of clipboard.nodes) {
      const freshId = idMap.get(raw.id);
      const remappedParent = raw.parent && idMap.has(raw.parent) ? idMap.get(raw.parent) : (raw.parent || null);
      const remappedChildren = Array.isArray(raw.children)
        ? raw.children.map(cid => idMap.get(cid) || cid)
        : [];

      const nodeData = {
        ...raw,
        id: freshId,
        name: `${raw.name || freshId} Copy`,
        x: Math.round(raw.x + offset),
        y: Math.round(raw.y + offset),
        parent: remappedParent,
        children: remappedChildren
      };

      if (typeof sceneModel.addComponent === 'function') {
        sceneModel.addComponent(nodeData);
      } else {
        sceneModel.addNode(nodeData);
      }
      newNodes.push(sceneModel.getNode(freshId));
    }

    // Clone and attach animation tracks with new targetNodeIds
    const newTracks = [];
    for (const rawTrack of clipboard.tracks || []) {
      const newTarget = idMap.get(rawTrack.targetNodeId);
      if (newTarget) {
        const clonedTrack = new AnimationTrack({
          ...rawTrack,
          id: `track_${newTarget}_${rawTrack.propertyPath.replace(/\./g, '_')}`,
          targetNodeId: newTarget
        });
        sceneModel.addTrack(clonedTrack);
        newTracks.push(clonedTrack);
      }
    }

    if (historyManager && typeof historyManager.push === 'function') {
      historyManager.push({
        description: `Paste ${newNodes.length} Nodes`,
        undo: () => {
          for (const n of newNodes) {
            sceneModel.removeNode(n.id);
          }
          for (const t of newTracks) {
            sceneModel.removeTrack(t.id);
          }
        },
        execute: () => {
          for (const n of newNodes) {
            sceneModel.addNode(n);
          }
          for (const t of newTracks) {
            sceneModel.addTrack(t);
          }
        }
      });
    }

    return newNodes;
  }

  /**
   * Duplicates a node with all its animation tracks atomically.
   * @param {string} nodeId 
   * @param {Object} sceneModel 
   * @param {Object} [historyManager] 
   * @returns {Object|null}
   */
  static duplicateNode(nodeId, sceneModel, historyManager = null) {
    const node = sceneModel.getNode(nodeId);
    if (!node) return null;

    this.copyNodes([node], sceneModel);
    const pasted = this.pasteNodes(sceneModel, historyManager);
    return pasted[0] || null;
  }
}
