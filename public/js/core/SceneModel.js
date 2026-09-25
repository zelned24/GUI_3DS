import { ComponentRegistry } from '../components/ComponentRegistry.js';
import { globalRNG } from './DeterministicRNG.js';
import { AnimationTrack } from '../animation/AnimationTrack.js';
import { TimelineEvaluator } from '../animation/TimelineEvaluator.js';

/**
 * SceneModel - Root 2D Composition Scene for Nintendo 3DS.
 * Replaces static Screen as the primary authoring and runtime unit.
 * 
 * Represents a timed, dual-screen 2D scene composition containing:
 * - Scene Graph (nodes on TOP 400x240, BOTTOM 320x240, or GLOBAL)
 * - Duration in frames and framerate (default 60 FPS)
 * - Current Playhead frame (integer frame)
 * - Animation tracks (for keyframe property animation)
 * - Timeline markers (Event, Audio, Comment, Sync)
 * - Audio cues (sound effects and background music cues)
 * - Metadata
 */
export class SceneModel {
  /**
   * @param {Object} data 
   */
  constructor(data = {}) {
    this.schemaVersion = data.schemaVersion || 2;
    this.id = data.id || globalRNG.nextId('scene');
    this.name = data.name || this.id;
    this.durationFrames = Math.max(1, Math.round(data.durationFrames ?? 60));
    this.fps = Math.round(data.fps ?? 60);
    this.currentFrame = Math.max(0, Math.min(this.durationFrames, Math.round(data.currentFrame ?? 0)));

    // Dual screen dimensions and backgrounds
    this.top = {
      width: 400,
      height: 240,
      backgroundColor: data.top?.backgroundColor || '#12141c'
    };

    this.bottom = {
      width: 320,
      height: 240,
      backgroundColor: data.bottom?.backgroundColor || '#1a1824'
    };

    // Nodes (Scene Graph)
    this.nodes = [];
    const rawNodes = data.nodes || data.components || [];
    this._initNodes(rawNodes);

    // Animation tracks (for Timeline)
    this.tracks = [];
    if (Array.isArray(data.tracks)) {
      for (const t of data.tracks) {
        if (t instanceof AnimationTrack) {
          this.tracks.push(t);
        } else {
          this.tracks.push(new AnimationTrack(t));
        }
      }
    }

    // Timeline markers
    this.markers = Array.isArray(data.markers) ? data.markers.map(m => ({
      id: m.id || globalRNG.nextId('marker'),
      frame: Math.max(0, Math.round(m.frame ?? 0)),
      name: m.name || 'Marker',
      type: m.type || 'Event', // 'Event' | 'Audio' | 'Comment' | 'Sync'
      metadata: { ...(m.metadata || {}) }
    })) : [];

    // Audio cues
    this.audioCues = Array.isArray(data.audioCues) ? data.audioCues.map(c => ({
      id: c.id || globalRNG.nextId('cue'),
      asset: c.asset || '',
      frame: Math.max(0, Math.round(c.frame ?? 0)),
      volume: Math.max(0, Math.min(1, parseFloat(c.volume ?? 1.0))),
      channel: Math.max(0, Math.round(c.channel ?? 0))
    })) : [];

    // Metadata
    this.metadata = {
      author: data.metadata?.author || 'GUI_3DS Studio',
      description: data.metadata?.description || '',
      tags: Array.isArray(data.metadata?.tags) ? [...data.metadata.tags] : [],
      created: data.metadata?.created || 0,
      ...(data.metadata || {})
    };
  }

  // --- Backward Compatibility Alias ---
  get components() {
    return this.nodes;
  }
  set components(val) {
    this.nodes = val;
  }

  /**
   * Initializes nodes and reconnects parent-child links.
   * @param {Array} rawNodes 
   */
  _initNodes(rawNodes) {
    this.nodes = (rawNodes || []).map(nodeData => {
      if (nodeData && typeof nodeData.render === 'function') {
        return nodeData;
      }
      return ComponentRegistry.create(nodeData.type || 'UINode', nodeData);
    });

    // Rebuild bidirectional parent-child hierarchy
    const nodeMap = new Map(this.nodes.map(n => [n.id, n]));
    for (const node of this.nodes) {
      if (node.parent && nodeMap.has(node.parent)) {
        nodeMap.get(node.parent).addChild(node.id);
      }
    }
  }

  /**
   * Adds a node to the scene.
   * @param {Object} node 
   */
  addNode(node) {
    if (!node || !node.id) return;
    if (this.nodes.some(n => n.id === node.id)) {
      throw new Error(`Node with ID "${node.id}" already exists in scene "${this.id}"`);
    }
    this.nodes.push(node);

    if (node.parent) {
      const parentNode = this.getNode(node.parent);
      if (parentNode) {
        parentNode.addChild(node.id);
      }
    }
  }

  /**
   * Removes a node by ID, along with reparenting or removing its children and associated tracks.
   * @param {string} nodeId 
   */
  removeNode(nodeId) {
    const idx = this.nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) return null;

    const [removed] = this.nodes.splice(idx, 1);

    // Detach from parent
    if (removed.parent) {
      const parentNode = this.getNode(removed.parent);
      if (parentNode) {
        parentNode.removeChild(nodeId);
      }
    }

    // Detach or cascade children
    for (const childId of [...removed.children]) {
      const child = this.getNode(childId);
      if (child) {
        child.parent = removed.parent || null;
        if (removed.parent) {
          const newParent = this.getNode(removed.parent);
          if (newParent) newParent.addChild(child.id);
        }
      }
    }

    // Remove any animation tracks associated with this node
    this.tracks = this.tracks.filter(t => t.targetNodeId !== nodeId);

    return removed;
  }

  /**
   * Retrieves a node by ID.
   * @param {string} nodeId 
   * @returns {Object|null}
   */
  getNode(nodeId) {
    return this.nodes.find(n => n.id === nodeId) || null;
  }

  /**
   * Alias for backward compatibility with ProjectModel.getComponent.
   * @param {string} id 
   */
  getComponent(id) {
    return this.getNode(id);
  }

  /**
   * Returns all nodes belonging to a target screen: 'top', 'bottom', or 'global'.
   * @param {'top'|'bottom'|'global'} screen 
   */
  getNodesByScreen(screen) {
    return this.nodes.filter(n => n.screen === screen);
  }

  /**
   * Reparents a node under a new parent or screen root.
   * @param {string} nodeId 
   * @param {string|null} newParentId 
   */
  reparentNode(nodeId, newParentId) {
    const node = this.getNode(nodeId);
    if (!node) throw new Error(`Node "${nodeId}" not found`);

    if (newParentId === nodeId) {
      throw new Error(`Cannot reparent node "${nodeId}" to itself`);
    }

    if (newParentId) {
      const newParent = this.getNode(newParentId);
      if (!newParent) throw new Error(`Target parent "${newParentId}" not found`);
      if (newParent.isDescendantOf(nodeId, this)) {
        throw new Error(`Cycle detected: cannot reparent "${nodeId}" under its own descendant "${newParentId}"`);
      }
    }

    // Remove from old parent
    if (node.parent) {
      const oldParent = this.getNode(node.parent);
      if (oldParent) oldParent.removeChild(nodeId);
    }

    // Attach to new parent
    node.parent = newParentId;
    if (newParentId) {
      const newParent = this.getNode(newParentId);
      if (newParent) {
        newParent.addChild(nodeId);
        // Synchronize screen assignment with parent
        node.screen = newParent.screen;
      }
    }
  }

  // --- Animation Track Operations ---

  /**
   * Adds or registers an animation track.
   * @param {AnimationTrack|Object} trackOrData 
   * @returns {AnimationTrack}
   */
  addTrack(trackOrData) {
    const track = trackOrData instanceof AnimationTrack
      ? trackOrData
      : new AnimationTrack(trackOrData);

    const existingIdx = this.tracks.findIndex(t => t.id === track.id);
    if (existingIdx !== -1) {
      this.tracks[existingIdx] = track;
    } else {
      this.tracks.push(track);
    }
    return track;
  }

  /**
   * Removes an animation track by ID.
   * @param {string} trackId 
   * @returns {AnimationTrack|null}
   */
  removeTrack(trackId) {
    const idx = this.tracks.findIndex(t => t.id === trackId);
    if (idx === -1) return null;
    const [removed] = this.tracks.splice(idx, 1);
    return removed;
  }

  /**
   * Retrieves an animation track by ID.
   * @param {string} trackId 
   */
  getTrack(trackId) {
    return this.tracks.find(t => t.id === trackId) || null;
  }

  /**
   * Returns all tracks targeting a specific node.
   * @param {string} nodeId 
   * @returns {AnimationTrack[]}
   */
  getTracksForNode(nodeId) {
    return this.tracks.filter(t => t.targetNodeId === nodeId);
  }

  /**
   * Finds a track for a specific node and property path.
   * @param {string} nodeId 
   * @param {string} propertyPath 
   */
  getTrackForProperty(nodeId, propertyPath) {
    return this.tracks.find(t => t.targetNodeId === nodeId && t.propertyPath === propertyPath) || null;
  }

  // --- Time & Playhead Operations ---

  /**
   * Seeks the timeline playhead to an integer frame.
   * Clamps between 0 and durationFrames.
   * @param {number} frame 
   * @returns {number} The updated integer currentFrame
   */
  seek(frame) {
    this.currentFrame = Math.max(0, Math.min(this.durationFrames, Math.round(frame)));
    return this.currentFrame;
  }

  /**
   * Converts a frame number to fractional seconds at current scene FPS.
   * @param {number} [frame=this.currentFrame] 
   * @returns {number}
   */
  frameToSeconds(frame = this.currentFrame) {
    return parseFloat((frame / this.fps).toFixed(3));
  }

  /**
   * Converts seconds to integer frame at current scene FPS.
   * @param {number} seconds 
   * @returns {number}
   */
  secondsToFrame(seconds) {
    return Math.max(0, Math.round(seconds * this.fps));
  }

  /**
   * Formats time display as MM:SS.mmm
   * @param {number} [frame=this.currentFrame] 
   * @returns {string}
   */
  getFormattedTime(frame = this.currentFrame) {
    const totalSecs = frame / this.fps;
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.floor(totalSecs % 60);
    const millis = Math.floor((totalSecs % 1) * 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  /**
   * Evaluates the active scene at the specified frame (or current playhead frame).
   * Does not mutate persistent document state.
   * @param {number} [frame=this.currentFrame] 
   * @returns {Map<string, Object>} Map of nodeId -> evaluated state overrides
   */
  evaluate(frame = this.currentFrame) {
    return TimelineEvaluator.evaluateScene(this, frame);
  }

  /**
   * Adds a timeline marker.
   * @param {Object} marker 
   */
  addMarker(marker) {
    const m = {
      id: marker.id || globalRNG.nextId('marker'),
      frame: Math.max(0, Math.round(marker.frame ?? 0)),
      name: marker.name || 'Marker',
      type: marker.type || 'Event',
      metadata: { ...(marker.metadata || {}) }
    };
    this.markers.push(m);
    this.markers.sort((a, b) => a.frame - b.frame);
    return m;
  }

  /**
   * Adds an audio cue.
   * @param {Object} cue 
   */
  addAudioCue(cue) {
    const c = {
      id: cue.id || globalRNG.nextId('cue'),
      asset: cue.asset || '',
      frame: Math.max(0, Math.round(cue.frame ?? 0)),
      volume: Math.max(0, Math.min(1, parseFloat(cue.volume ?? 1.0))),
      channel: Math.max(0, Math.round(cue.channel ?? 0))
    };
    this.audioCues.push(c);
    this.audioCues.sort((a, b) => a.frame - b.frame);
    return c;
  }

  /**
   * Deterministic JSON serialization.
   * Produces reproducible output without volatile timestamps or random values.
   */
  toJSON() {
    return {
      schemaVersion: this.schemaVersion,
      id: this.id,
      name: this.name,
      durationFrames: this.durationFrames,
      fps: this.fps,
      currentFrame: this.currentFrame,
      top: {
        width: this.top.width,
        height: this.top.height,
        backgroundColor: this.top.backgroundColor
      },
      bottom: {
        width: this.bottom.width,
        height: this.bottom.height,
        backgroundColor: this.bottom.backgroundColor
      },
      nodes: this.nodes.map(n => (typeof n.toJSON === 'function' ? n.toJSON() : n)),
      tracks: this.tracks.map(t => (typeof t.toJSON === 'function' ? t.toJSON() : t)),
      markers: [...this.markers],
      audioCues: [...this.audioCues],
      metadata: { ...this.metadata }
    };
  }

  /**
   * Instantiates a SceneModel from JSON data.
   * @param {Object} json 
   * @returns {SceneModel}
   */
  static fromJSON(json) {
    return new SceneModel(json);
  }
}
