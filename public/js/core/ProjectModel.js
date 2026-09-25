import { ComponentRegistry } from '../components/ComponentRegistry.js';
import { HistoryManager } from './HistoryManager.js';
import { Validator } from './Validator.js';
import { globalRNG } from './DeterministicRNG.js';
import { SceneModel } from './SceneModel.js';
import { AnimationTrack } from '../animation/AnimationTrack.js';

/**
 * ProjectModel - Hierarchical project, screen, and scene state manager.
 * Supports N-ary Node trees, schema versioning (v1 screen, v2 scene), undo/redo, and safe serialization.
 */
export class ProjectModel {
  constructor() {
    this.history = new HistoryManager();
    this.listeners = [];

    this.project = {
      schemaVersion: 2,
      name: 'Rogue3DS',
      version: '1.0.0',
      target: 'Nintendo 3DS',
      screens: ['ExampleScreen'],
      scenes: ['ExampleScene'],
      settings: {
        defaultScreen: 'ExampleScreen',
        topWidth: 400,
        topHeight: 240,
        bottomWidth: 320,
        bottomHeight: 240,
        snapToPixel: true,
        fps: 60
      }
    };

    this.screensMap = new Map(); // screenId/sceneId -> ScreenData | SceneModel
    this.activeScreenId = 'ExampleScreen';
  }

  getActiveScreen() {
    return this.screensMap.get(this.activeScreenId) || null;
  }

  getActiveScene() {
    return this.getActiveScreen();
  }

  setActiveScreen(screenId) {
    if (this.screensMap.has(screenId)) {
      this.activeScreenId = screenId;
      this.history.clear();
      this.emitChange('screenChanged', { screenId });
    }
  }

  setActiveScene(sceneId) {
    this.setActiveScreen(sceneId);
  }

  loadScene(sceneData) {
    if (!sceneData || !sceneData.id) return null;
    const scene = sceneData instanceof SceneModel ? sceneData : new SceneModel(sceneData);
    this.screensMap.set(scene.id, scene);
    if (!this.project.screens.includes(scene.id)) {
      this.project.screens.push(scene.id);
    }
    if (!this.project.scenes) this.project.scenes = [];
    if (!this.project.scenes.includes(scene.id)) {
      this.project.scenes.push(scene.id);
    }
    this.emitChange('screenLoaded', { screenId: scene.id });
    this.emitChange('sceneLoaded', { sceneId: scene.id });
    return scene;
  }

  createScene(sceneId, name, options = {}) {
    const id = (sceneId || globalRNG.nextId('Scene')).trim();
    if (this.screensMap.has(id)) {
      throw new Error(`Scene with ID "${id}" already exists`);
    }
    const newScene = new SceneModel({
      id,
      name: name || id,
      durationFrames: options.durationFrames ?? 60,
      fps: options.fps ?? 60,
      top: options.top || { width: 400, height: 240, backgroundColor: '#12141c' },
      bottom: options.bottom || { width: 320, height: 240, backgroundColor: '#1a1824' },
      nodes: [],
      tracks: [],
      markers: [],
      audioCues: []
    });
    this.screensMap.set(id, newScene);
    if (!this.project.screens.includes(id)) {
      this.project.screens.push(id);
    }
    if (!this.project.scenes) this.project.scenes = [];
    if (!this.project.scenes.includes(id)) {
      this.project.scenes.push(id);
    }
    this.setActiveScreen(id);
    this.emitChange('screenCreated', { screenId: id });
    this.emitChange('sceneCreated', { sceneId: id });
    return newScene;
  }

  loadScreen(screenData) {
    if (!screenData || !screenData.id) return;
    
    // If screenData has scene characteristics, load as SceneModel
    if (screenData instanceof SceneModel || screenData.schemaVersion >= 2 || screenData.durationFrames !== undefined || screenData.nodes !== undefined) {
      return this.loadScene(screenData);
    }

    // Instantiate nodes
    const comps = (screenData.components || []).map(c => ComponentRegistry.create(c.type, c));

    // Rebuild bidirectional parent-child links
    const nodeMap = new Map(comps.map(c => [c.id, c]));
    for (const node of comps) {
      if (node.parent && nodeMap.has(node.parent)) {
        nodeMap.get(node.parent).addChild(node.id);
      }
    }

    const normalized = {
      schemaVersion: screenData.schemaVersion || 1,
      id: screenData.id,
      name: screenData.name || screenData.id,
      top: {
        width: screenData.top?.width || 400,
        height: screenData.top?.height || 240,
        backgroundColor: screenData.top?.backgroundColor || '#12141c'
      },
      bottom: {
        width: screenData.bottom?.width || 320,
        height: screenData.bottom?.height || 240,
        backgroundColor: screenData.bottom?.backgroundColor || '#1a1824'
      },
      components: comps,
      tracks: (screenData.tracks || []).map(t => t instanceof AnimationTrack ? t : AnimationTrack.fromJSON(t))
    };

    this.screensMap.set(normalized.id, normalized);
    if (!this.project.screens.includes(normalized.id)) {
      this.project.screens.push(normalized.id);
    }
    this.emitChange('screenLoaded', { screenId: normalized.id });
  }

  createScreen(screenId, name) {
    const id = (screenId || globalRNG.nextId('Screen')).trim();
    if (this.screensMap.has(id)) {
      throw new Error(`Screen with ID "${id}" already exists`);
    }
    const newScreen = {
      schemaVersion: 1,
      id,
      name: name || id,
      top: { width: 400, height: 240, backgroundColor: '#12141c' },
      bottom: { width: 320, height: 240, backgroundColor: '#1a1824' },
      components: []
    };
    this.screensMap.set(id, newScreen);
    if (!this.project.screens.includes(id)) {
      this.project.screens.push(id);
    }
    this.setActiveScreen(id);
    this.emitChange('screenCreated', { screenId: id });
    return newScreen;
  }

  getComponent(componentId) {
    const screen = this.getActiveScreen();
    if (!screen) return null;
    return screen.components.find(c => c.id === componentId) || null;
  }

  /**
   * Returns root-level nodes (nodes without a parent).
   */
  getRootNodes(screenType = null) {
    const screen = this.getActiveScreen();
    if (!screen) return [];
    return screen.components.filter(c => {
      const matchScreen = !screenType || c.screen === screenType;
      return matchScreen && (!c.parent || !this.getComponent(c.parent));
    });
  }

  addComponent(componentData, recordHistory = true) {
    const screen = this.getActiveScreen();
    if (!screen) return null;

    const comp = componentData instanceof Object && componentData.type
      ? (componentData.render ? componentData : ComponentRegistry.create(componentData.type, componentData))
      : ComponentRegistry.create('RogueBox', componentData);

    // Auto-assign unique ID if duplicated
    let baseId = comp.id;
    let counter = 1;
    while (screen.components.some(c => c.id === comp.id)) {
      comp.id = `${baseId}_${counter++}`;
    }

    screen.components.push(comp);

    // If node specifies a parent, update parent's children array
    if (comp.parent) {
      const parentNode = this.getComponent(comp.parent);
      if (parentNode) parentNode.addChild(comp.id);
    }

    if (recordHistory) {
      this.history.push({
        description: `Add ${comp.type} (${comp.id})`,
        undo: () => {
          this.removeComponent(comp.id, false);
        },
        execute: () => {
          this.addComponent(comp, false);
        }
      });
    }

    this.emitChange('componentAdded', { component: comp });
    this.emitChange('hierarchyChanged', {});
    return comp;
  }

  removeComponent(componentId, recordHistory = true) {
    const screen = this.getActiveScreen();
    if (!screen) return null;
    const index = screen.components.findIndex(c => c.id === componentId);
    if (index === -1) return null;

    const [removed] = screen.components.splice(index, 1);

    // Detach from parent
    if (removed.parent) {
      const parentNode = this.getComponent(removed.parent);
      if (parentNode) parentNode.removeChild(removed.id);
    }

    // Reparent orphaned children to removed node's parent
    const orphanedChildren = screen.components.filter(c => c.parent === removed.id);
    for (const child of orphanedChildren) {
      child.parent = removed.parent;
      if (removed.parent) {
        const grandParent = this.getComponent(removed.parent);
        if (grandParent) grandParent.addChild(child.id);
      }
    }

    if (recordHistory) {
      this.history.push({
        description: `Remove ${removed.type} (${removed.id})`,
        undo: () => {
          screen.components.splice(index, 0, removed);
          if (removed.parent) {
            const parentNode = this.getComponent(removed.parent);
            if (parentNode) parentNode.addChild(removed.id);
          }
          for (const child of orphanedChildren) {
            child.parent = removed.id;
          }
          this.emitChange('componentAdded', { component: removed });
          this.emitChange('hierarchyChanged', {});
        },
        execute: () => {
          this.removeComponent(removed.id, false);
        }
      });
    }

    this.emitChange('componentRemoved', { componentId, removed });
    this.emitChange('hierarchyChanged', {});
    return removed;
  }

  updateComponent(componentId, updates, recordHistory = true) {
    const comp = this.getComponent(componentId);
    if (!comp) return null;

    const oldState = comp.toJSON();

    // Position & dimensions with integer pixel snapping
    if (updates.x !== undefined) comp.x = Math.round(updates.x);
    if (updates.y !== undefined) comp.y = Math.round(updates.y);
    if (updates.width !== undefined) comp.width = Math.max(1, Math.round(updates.width));
    if (updates.height !== undefined) comp.height = Math.max(1, Math.round(updates.height));

    // Spatial transform properties
    if (updates.scaleX !== undefined) comp.transform.scaleX = parseFloat(updates.scaleX);
    if (updates.scaleY !== undefined) comp.transform.scaleY = parseFloat(updates.scaleY);
    if (updates.rotation !== undefined) comp.transform.rotation = parseFloat(updates.rotation);
    if (updates.opacity !== undefined) comp.opacity = parseFloat(updates.opacity);

    // Node attributes
    if (updates.name !== undefined) comp.name = String(updates.name);
    if (updates.screen !== undefined) comp.screen = updates.screen;
    if (updates.visible !== undefined) comp.visible = Boolean(updates.visible);
    if (updates.enabled !== undefined) comp.enabled = Boolean(updates.enabled);
    if (updates.zIndex !== undefined) comp.zIndex = Math.round(updates.zIndex);

    if (updates.id !== undefined && updates.id.trim() && updates.id !== comp.id) {
      const screen = this.getActiveScreen();
      if (!screen.components.some(c => c.id === updates.id)) {
        const oldId = comp.id;
        comp.id = updates.id.trim();
        // Update children pointers
        screen.components.forEach(c => {
          if (c.parent === oldId) c.parent = comp.id;
        });
      }
    }

    if (updates.properties) {
      comp.properties = { ...comp.properties, ...updates.properties };
    }

    if (recordHistory) {
      const newState = comp.toJSON();
      this.history.push({
        description: `Modify ${comp.id}`,
        undo: () => {
          Object.assign(comp, oldState);
          comp.transform.x = oldState.x;
          comp.transform.y = oldState.y;
          comp.transform.width = oldState.width;
          comp.transform.height = oldState.height;
          comp.properties = { ...oldState.properties };
          this.emitChange('componentUpdated', { component: comp, previous: newState });
        },
        execute: () => {
          Object.assign(comp, newState);
          comp.transform.x = newState.x;
          comp.transform.y = newState.y;
          comp.transform.width = newState.width;
          comp.transform.height = newState.height;
          comp.properties = { ...newState.properties };
          this.emitChange('componentUpdated', { component: comp, previous: oldState });
        }
      });
    }

    this.emitChange('componentUpdated', { component: comp, previous: oldState });
    return comp;
  }

  /**
   * Reparents a node under a new parent container.
   */
  reparentNode(nodeId, newParentId) {
    const screen = this.getActiveScreen();
    if (!screen) return;
    const node = this.getComponent(nodeId);
    if (!node) return;

    if (newParentId === nodeId) return; // Cannot parent to itself

    if (newParentId) {
      const newParent = this.getComponent(newParentId);
      if (!newParent) return;
      if (newParent.isDescendantOf(nodeId, this)) return; // Prevent cycle
      if (newParent.screen !== node.screen) return; // Must be on same display
    }

    const oldParentId = node.parent;
    if (oldParentId === newParentId) return;

    // Apply reparenting
    if (oldParentId) {
      const oldParent = this.getComponent(oldParentId);
      if (oldParent) oldParent.removeChild(nodeId);
    }

    node.parent = newParentId || null;

    if (newParentId) {
      const newParent = this.getComponent(newParentId);
      if (newParent) newParent.addChild(nodeId);
    }

    this.history.push({
      description: `Reparent ${nodeId} to ${newParentId || 'root'}`,
      undo: () => {
        this.reparentNode(nodeId, oldParentId);
      },
      execute: () => {
        this.reparentNode(nodeId, newParentId);
      }
    });

    this.emitChange('hierarchyChanged', { nodeId, newParentId, oldParentId });
  }

  duplicateComponent(componentId) {
    const comp = this.getComponent(componentId);
    if (!comp) return null;
    const cloned = comp.clone({
      id: `${comp.id}_copy`,
      x: comp.x + 8,
      y: comp.y + 8,
      parent: comp.parent
    });
    return this.addComponent(cloned);
  }

  reorderComponent(componentId, direction) {
    const screen = this.getActiveScreen();
    if (!screen) return;
    const index = screen.components.findIndex(c => c.id === componentId);
    if (index === -1) return;

    const oldOrder = [...screen.components];
    const comp = screen.components[index];

    if (direction === 'up' && index < screen.components.length - 1) {
      screen.components[index] = screen.components[index + 1];
      screen.components[index + 1] = comp;
    } else if (direction === 'down' && index > 0) {
      screen.components[index] = screen.components[index - 1];
      screen.components[index - 1] = comp;
    } else if (direction === 'top') {
      screen.components.splice(index, 1);
      screen.components.push(comp);
    } else if (direction === 'bottom') {
      screen.components.splice(index, 1);
      screen.components.unshift(comp);
    }

    // Synchronize zIndex
    screen.components.forEach((c, i) => {
      c.zIndex = i + 1;
    });

    this.history.push({
      description: `Reorder ${comp.id}`,
      undo: () => {
        screen.components = [...oldOrder];
        this.emitChange('hierarchyChanged', {});
      },
      execute: () => {
        this.reorderComponent(componentId, direction);
      }
    });

    this.emitChange('hierarchyChanged', {});
  }

  validateActiveScreen() {
    return Validator.validateScreen(this.getActiveScreen());
  }

  toJSON() {
    const screen = this.getActiveScreen();
    if (!screen) return null;
    if (typeof screen.toJSON === 'function') {
      return screen.toJSON();
    }
    return {
      schemaVersion: screen.schemaVersion || 1,
      id: screen.id,
      name: screen.name,
      top: { ...screen.top },
      bottom: { ...screen.bottom },
      components: (screen.components || []).map(c => c.toJSON()),
      tracks: (screen.tracks || []).map(t => typeof t.toJSON === 'function' ? t.toJSON() : t)
    };
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emitChange(type, data = {}) {
    for (const listener of this.listeners) {
      try {
        listener(type, data);
      } catch (err) {
        console.error('ProjectModel listener error:', err);
      }
    }
  }
}
