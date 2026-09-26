import { ComponentRegistry } from '../components/ComponentRegistry.js';
import { globalRNG } from './DeterministicRNG.js';
import { AnimationTrack } from '../animation/AnimationTrack.js';
import { AnimationClip } from '../animation/AnimationClip.js';
import { TimelineEvaluator } from '../animation/TimelineEvaluator.js';
import { SpatialUtils } from '../editor/SpatialUtils.js';

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
 * - Guides (horizontal and vertical spatial guidelines)
 * - Metadata
 */
export class SceneModel {
  /**
   * @param {Object} data 
   */
  constructor(data = {}) {
    this.schemaVersion = data.schemaVersion !== undefined ? data.schemaVersion : 2;
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

    // Animation clips (reusable assets)
    this.clips = [];
    if (Array.isArray(data.clips)) {
      for (const c of data.clips) {
        if (c instanceof AnimationClip) {
          this.clips.push(c);
        } else {
          this.clips.push(new AnimationClip(c));
        }
      }
    }

    // Sequencer items (instances of clips placed on the timeline)
    this.sequence = [];
    if (Array.isArray(data.sequence)) {
      for (const s of data.sequence) {
        this.sequence.push({
          id: s.id || globalRNG.nextId('seq'),
          clipId: s.clipId || '',
          targetNodeId: s.targetNodeId || '',
          startFrame: Math.max(0, Math.round(s.startFrame ?? 0)),
          durationFrames: Math.max(1, Math.round(s.durationFrames ?? 30)),
          clipStartOffset: Math.max(0, Math.round(s.clipStartOffset ?? 0)),
          loopCount: Math.max(1, Math.round(s.loopCount ?? 1))
        });
      }
    }

    // Guides (Spatial guidelines)
    this.guides = Array.isArray(data.guides) ? [...data.guides] : [];

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

  addComponent(data) {
    let node = data;
    if (typeof data.render !== 'function') {
      const type = data.type || 'RogueBox';
      node = ComponentRegistry.create(type, data);
    }
    this.addNode(node);
    return node;
  }

  getComponent(id) {
    return this.getNode(id);
  }

  removeComponent(id) {
    return this.removeNode(id);
  }

  updateComponent(id, updates) {
    const node = this.getNode(id);
    if (!node) return null;
    if (updates.x !== undefined) node.x = Math.round(Number(updates.x) || 0);
    if (updates.y !== undefined) node.y = Math.round(Number(updates.y) || 0);
    if (updates.width !== undefined) node.width = Math.round(Number(updates.width) || 0);
    if (updates.height !== undefined) node.height = Math.round(Number(updates.height) || 0);
    if (updates.scaleX !== undefined) node.scaleX = Number(updates.scaleX);
    if (updates.scaleY !== undefined) node.scaleY = Number(updates.scaleY);
    if (updates.rotation !== undefined) node.rotation = Number(updates.rotation);
    if (updates.opacity !== undefined) node.opacity = Number(updates.opacity);
    if (updates.visible !== undefined) node.visible = Boolean(updates.visible);
    if (updates.locked !== undefined) node.locked = Boolean(updates.locked);
    if (updates.zIndex !== undefined) node.zIndex = Number(updates.zIndex);
    if (updates.name !== undefined) node.name = String(updates.name);
    if (updates.properties) {
      node.properties = { ...node.properties, ...updates.properties };
    }
    return node;
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
   * @param {Object|number} markerOrFrame 
   * @param {string} [name]
   * @param {string} [type]
   * @param {Object} [metadata]
   */
  addMarker(markerOrFrame, name, type, metadata) {
    let mObj;
    if (typeof markerOrFrame === 'object' && markerOrFrame !== null) {
      mObj = markerOrFrame;
    } else {
      mObj = { frame: markerOrFrame, name, type, metadata };
    }
    const m = {
      id: mObj.id || globalRNG.nextId('marker'),
      frame: Math.max(0, Math.round(mObj.frame ?? 0)),
      name: mObj.name || 'Marker',
      type: mObj.type || 'Event',
      metadata: { ...(mObj.metadata || {}) }
    };
    this.markers.push(m);
    this.markers.sort((a, b) => a.frame - b.frame);
    return m;
  }

  /**
   * Adds an audio cue.
   * @param {Object|number} cueOrFrame 
   * @param {string} [asset]
   * @param {number} [volume]
   * @param {number} [channel]
   */
  addAudioCue(cueOrFrame, asset, volume, channel) {
    let cObj;
    if (typeof cueOrFrame === 'object' && cueOrFrame !== null) {
      cObj = cueOrFrame;
    } else {
      cObj = { frame: cueOrFrame, asset, volume, channel };
    }
    const c = {
      id: cObj.id || globalRNG.nextId('cue'),
      asset: cObj.asset || '',
      frame: Math.max(0, Math.round(cObj.frame ?? 0)),
      volume: Math.max(0, Math.min(1, parseFloat(cObj.volume ?? 1.0))),
      channel: Math.max(0, Math.round(cObj.channel ?? 0))
    };
    this.audioCues.push(c);
    this.audioCues.sort((a, b) => a.frame - b.frame);
    return c;
  }

  // --- Clips & Sequencer ---
  addClip(clip) {
    const c = clip instanceof AnimationClip ? clip : new AnimationClip(clip);
    this.clips.push(c);
    return c;
  }

  getClip(clipId) {
    return this.clips.find(c => c.id === clipId) || null;
  }

  removeClip(clipId) {
    const idx = this.clips.findIndex(c => c.id === clipId);
    if (idx !== -1) {
      this.clips.splice(idx, 1);
      this.sequence = this.sequence.filter(s => s.clipId !== clipId);
      return true;
    }
    return false;
  }

  addSequenceItem(item) {
    const s = {
      id: item.id || globalRNG.nextId('seq'),
      clipId: item.clipId || '',
      targetNodeId: item.targetNodeId || '',
      startFrame: Math.max(0, Math.round(item.startFrame ?? 0)),
      durationFrames: Math.max(1, Math.round(item.durationFrames ?? 30)),
      clipStartOffset: Math.max(0, Math.round(item.clipStartOffset ?? 0)),
      loopCount: Math.max(1, Math.round(item.loopCount ?? 1))
    };
    this.sequence.push(s);
    this.sequence.sort((a, b) => a.startFrame - b.startFrame);
    return s;
  }

  getSequenceItem(itemId) {
    return this.sequence.find(s => s.id === itemId) || null;
  }

  removeSequenceItem(itemId) {
    const idx = this.sequence.findIndex(s => s.id === itemId);
    if (idx !== -1) {
      this.sequence.splice(idx, 1);
      return true;
    }
    return false;
  }

  moveSequenceItem(itemId, newStartFrame) {
    const item = this.getSequenceItem(itemId);
    if (!item) return false;
    item.startFrame = Math.max(0, Math.round(newStartFrame));
    this.sequence.sort((a, b) => a.startFrame - b.startFrame);
    return true;
  }

  trimSequenceItem(itemId, newStartFrame, newDurationFrames, newOffset = 0) {
    const item = this.getSequenceItem(itemId);
    if (!item) return false;
    item.startFrame = Math.max(0, Math.round(newStartFrame));
    item.durationFrames = Math.max(1, Math.round(newDurationFrames));
    item.clipStartOffset = Math.max(0, Math.round(newOffset));
    return true;
  }

  // --- Markers & Audio Cues Authoring ---
  updateMarker(idOrIndex, updates = {}) {
    const m = typeof idOrIndex === 'number'
      ? this.markers[idOrIndex]
      : this.markers.find(marker => marker.id === idOrIndex);
    if (!m) return false;
    if (updates.frame !== undefined) m.frame = Math.max(0, Math.round(updates.frame));
    if (updates.name !== undefined) m.name = updates.name;
    if (updates.type !== undefined) m.type = updates.type;
    if (updates.metadata) m.metadata = { ...m.metadata, ...updates.metadata };
    this.markers.sort((a, b) => a.frame - b.frame);
    return true;
  }

  deleteMarker(idOrIndex) {
    let idx = -1;
    if (typeof idOrIndex === 'number') {
      if (idOrIndex >= 0 && idOrIndex < this.markers.length) idx = idOrIndex;
    } else {
      idx = this.markers.findIndex(m => m.id === idOrIndex);
    }
    if (idx !== -1) {
      this.markers.splice(idx, 1);
      return true;
    }
    return false;
  }

  updateAudioCue(idOrIndex, updates = {}) {
    const c = typeof idOrIndex === 'number'
      ? this.audioCues[idOrIndex]
      : this.audioCues.find(cue => cue.id === idOrIndex);
    if (!c) return false;
    if (updates.frame !== undefined) c.frame = Math.max(0, Math.round(updates.frame));
    if (updates.asset !== undefined) c.asset = updates.asset;
    if (updates.volume !== undefined) c.volume = Math.max(0, Math.min(1, parseFloat(updates.volume)));
    if (updates.channel !== undefined) c.channel = Math.max(0, Math.round(updates.channel));
    this.audioCues.sort((a, b) => a.frame - b.frame);
    return true;
  }

  deleteAudioCue(idOrIndex) {
    let idx = -1;
    if (typeof idOrIndex === 'number') {
      if (idOrIndex >= 0 && idOrIndex < this.audioCues.length) idx = idOrIndex;
    } else {
      idx = this.audioCues.findIndex(c => c.id === idOrIndex);
    }
    if (idx !== -1) {
      this.audioCues.splice(idx, 1);
      return true;
    }
    return false;
  }

  // --- Guides Operations (BETA-UI-7) ---

  addGuide(arg1, arg2, arg3, historyManager) {
    let orientation = 'h';
    let position = 0;
    let screen = 'top';
    let history = historyManager;

    if (typeof arg1 === 'object' && arg1 !== null) {
      orientation = arg1.orientation || arg1.type || 'h';
      position = arg1.position ?? 0;
      screen = arg1.screen || 'top';
      if (arg2 && typeof arg2.execute === 'function') history = arg2;
    } else {
      orientation = arg1 || 'h';
      position = arg2 ?? 0;
      screen = arg3 || 'top';
    }

    const normOrientation = (orientation === 'vertical' || orientation === 'v') ? 'v' : 'h';
    const guide = {
      id: globalRNG.nextId('guide'),
      orientation: normOrientation,
      position: Math.round(Number(position) || 0),
      screen
    };

    if (history && typeof history.execute === 'function') {
      history.execute({
        name: 'Add Guide',
        execute: () => {
          if (!this.guides.some(g => g.id === guide.id)) this.guides.push(guide);
        },
        undo: () => {
          this.deleteGuide(guide.id);
        }
      });
    } else {
      this.guides.push(guide);
    }
    return guide;
  }

  moveGuide(id, newPosition, historyManager) {
    const g = this.guides.find(guide => guide.id === id);
    if (!g) return false;
    const oldPos = g.position;
    const nextPos = Math.round(Number(newPosition) || 0);

    if (historyManager && typeof historyManager.execute === 'function') {
      historyManager.execute({
        name: 'Move Guide',
        execute: () => { g.position = nextPos; },
        undo: () => { g.position = oldPos; }
      });
    } else {
      g.position = nextPos;
    }
    return true;
  }

  deleteGuide(id, historyManager) {
    const idx = this.guides.findIndex(g => g.id === id);
    if (idx === -1) return false;
    const removed = this.guides[idx];

    if (historyManager && typeof historyManager.execute === 'function') {
      historyManager.execute({
        name: 'Delete Guide',
        execute: () => {
          const i = this.guides.findIndex(g => g.id === id);
          if (i !== -1) this.guides.splice(i, 1);
        },
        undo: () => {
          this.guides.splice(idx, 0, removed);
        }
      });
    } else {
      this.guides.splice(idx, 1);
    }
    return true;
  }

  getGuides() {
    return [...this.guides];
  }

  // --- Z-Order & Node Locking Operations (BETA-UI-7) ---

  setNodeLocked(nodeId, locked = true, historyManager = null) {
    const node = this.getNode(nodeId);
    if (!node) return false;
    const oldLocked = Boolean(node.locked);
    const newLocked = Boolean(locked);

    if (historyManager && typeof historyManager.execute === 'function') {
      historyManager.execute({
        name: `Set Node Locked (${nodeId})`,
        execute: () => { node.locked = newLocked; },
        undo: () => { node.locked = oldLocked; }
      });
    } else {
      node.locked = newLocked;
    }
    return true;
  }

  bringToFront(nodeId) {
    return SpatialUtils.setZOrder(nodeId, 'front', this, this.history);
  }

  sendToBack(nodeId) {
    return SpatialUtils.setZOrder(nodeId, 'back', this, this.history);
  }

  bringForward(nodeId) {
    return SpatialUtils.setZOrder(nodeId, 'forward', this, this.history);
  }

  sendBackward(nodeId) {
    return SpatialUtils.setZOrder(nodeId, 'backward', this, this.history);
  }

  // --- Backward-Compatible Migration ---
  static migrateV2ToV3(data) {
    if (!data) return data;
    const migrated = { ...data };
    migrated.schemaVersion = 3;
    if (!Array.isArray(migrated.clips)) migrated.clips = [];
    if (!Array.isArray(migrated.sequence)) migrated.sequence = [];
    return migrated;
  }

  static migrateV3ToV4(data) {
    if (!data) return data;
    const migrated = { ...data };
    migrated.schemaVersion = 4;
    if (!Array.isArray(migrated.clips)) migrated.clips = [];
    if (!Array.isArray(migrated.sequence)) migrated.sequence = [];
    if (!Array.isArray(migrated.guides)) migrated.guides = [];
    const nodes = migrated.nodes || migrated.components || [];
    for (const n of nodes) {
      if (n.locked === undefined) n.locked = false;
    }
    return migrated;
  }

  static migrateToLatest(data) {
    return this.migrateV3ToV4(data);
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
      components: this.nodes.map(n => (typeof n.toJSON === 'function' ? n.toJSON() : n)),
      nodes: this.nodes.map(n => (typeof n.toJSON === 'function' ? n.toJSON() : n)),
      tracks: this.tracks.map(t => (typeof t.toJSON === 'function' ? t.toJSON() : t)),
      clips: this.clips.map(c => (typeof c.toJSON === 'function' ? c.toJSON() : c)),
      sequence: [...this.sequence],
      markers: [...this.markers],
      audioCues: [...this.audioCues],
      guides: [...this.guides],
      metadata: { ...this.metadata }
    };
  }

  /**
   * Instantiates a SceneModel from JSON data with backward compatibility.
   * @param {Object} json 
   * @returns {SceneModel}
   */
  static fromJSON(json) {
    if (!json) return new SceneModel();
    const data = { ...json };
    if (!Array.isArray(data.clips)) data.clips = [];
    if (!Array.isArray(data.sequence)) data.sequence = [];
    return new SceneModel(data);
  }
}
