import { ComponentRegistry } from '../components/ComponentRegistry.js';
import { HistoryManager } from './HistoryManager.js';
import { Validator } from './Validator.js';

/**
 * ProjectModel - Declarative project and screen state manager.
 */
export class ProjectModel {
  constructor() {
    this.history = new HistoryManager();
    this.listeners = [];

    this.project = {
      name: 'Rogue3DS',
      version: '1.0.0',
      target: 'Nintendo 3DS',
      screens: ['ExampleScreen'],
      settings: {
        defaultScreen: 'ExampleScreen',
        topWidth: 400,
        topHeight: 240,
        bottomWidth: 320,
        bottomHeight: 240,
        snapToPixel: true
      }
    };

    this.screensMap = new Map(); // screenId -> ScreenData
    this.activeScreenId = 'ExampleScreen';
  }

  getActiveScreen() {
    return this.screensMap.get(this.activeScreenId) || null;
  }

  setActiveScreen(screenId) {
    if (this.screensMap.has(screenId)) {
      this.activeScreenId = screenId;
      this.history.clear();
      this.emitChange('screenChanged', { screenId });
    }
  }

  loadScreen(screenData) {
    if (!screenData || !screenData.id) return;
    const comps = (screenData.components || []).map(c => ComponentRegistry.create(c.type, c));
    const normalized = {
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
      components: comps
    };
    this.screensMap.set(normalized.id, normalized);
    if (!this.project.screens.includes(normalized.id)) {
      this.project.screens.push(normalized.id);
    }
    this.emitChange('screenLoaded', { screenId: normalized.id });
  }

  createScreen(screenId, name) {
    const id = (screenId || `Screen_${Date.now()}`).trim();
    if (this.screensMap.has(id)) {
      throw new Error(`Screen with ID "${id}" already exists`);
    }
    const newScreen = {
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

  addComponent(componentData, recordHistory = true) {
    const screen = this.getActiveScreen();
    if (!screen) return null;

    const comp = componentData instanceof Object && componentData.type
      ? (componentData.render ? componentData : ComponentRegistry.create(componentData.type, componentData))
      : ComponentRegistry.create('RogueBox', componentData);

    // Ensure integer pixel snapping
    comp.x = Math.round(comp.x);
    comp.y = Math.round(comp.y);
    comp.width = Math.round(comp.width);
    comp.height = Math.round(comp.height);

    // Auto-assign unique ID if duplicated
    let baseId = comp.id;
    let counter = 1;
    while (screen.components.some(c => c.id === comp.id)) {
      comp.id = `${baseId}_${counter++}`;
    }

    screen.components.push(comp);

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
    return comp;
  }

  removeComponent(componentId, recordHistory = true) {
    const screen = this.getActiveScreen();
    if (!screen) return null;
    const index = screen.components.findIndex(c => c.id === componentId);
    if (index === -1) return null;

    const [removed] = screen.components.splice(index, 1);

    if (recordHistory) {
      this.history.push({
        description: `Remove ${removed.type} (${removed.id})`,
        undo: () => {
          screen.components.splice(index, 0, removed);
          this.emitChange('componentAdded', { component: removed });
        },
        execute: () => {
          this.removeComponent(removed.id, false);
        }
      });
    }

    this.emitChange('componentRemoved', { componentId, removed });
    return removed;
  }

  updateComponent(componentId, updates, recordHistory = true) {
    const comp = this.getComponent(componentId);
    if (!comp) return null;

    const oldState = comp.toJSON();

    // Apply updates with pixel snapping
    if (updates.x !== undefined) comp.x = Math.round(updates.x);
    if (updates.y !== undefined) comp.y = Math.round(updates.y);
    if (updates.width !== undefined) comp.width = Math.max(4, Math.round(updates.width));
    if (updates.height !== undefined) comp.height = Math.max(4, Math.round(updates.height));
    if (updates.screen !== undefined) comp.screen = updates.screen;
    if (updates.visible !== undefined) comp.visible = Boolean(updates.visible);
    if (updates.enabled !== undefined) comp.enabled = Boolean(updates.enabled);
    if (updates.zIndex !== undefined) comp.zIndex = Math.round(updates.zIndex);
    if (updates.parent !== undefined) comp.parent = updates.parent;
    if (updates.id !== undefined && updates.id.trim() && updates.id !== comp.id) {
      // Check ID uniqueness
      const screen = this.getActiveScreen();
      if (!screen.components.some(c => c.id === updates.id)) {
        comp.id = updates.id.trim();
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
          comp.properties = { ...oldState.properties };
          this.emitChange('componentUpdated', { component: comp, previous: newState });
        },
        execute: () => {
          Object.assign(comp, newState);
          comp.properties = { ...newState.properties };
          this.emitChange('componentUpdated', { component: comp, previous: oldState });
        }
      });
    }

    this.emitChange('componentUpdated', { component: comp, previous: oldState });
    return comp;
  }

  duplicateComponent(componentId) {
    const comp = this.getComponent(componentId);
    if (!comp) return null;
    const cloned = comp.clone({
      id: `${comp.id}_copy`,
      x: comp.x + 8,
      y: comp.y + 8
    });
    return this.addComponent(cloned);
  }

  reorderComponent(componentId, direction) {
    // direction: 'up' | 'down' | 'top' | 'bottom'
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
    return {
      id: screen.id,
      name: screen.name,
      top: { ...screen.top },
      bottom: { ...screen.bottom },
      components: screen.components.map(c => c.toJSON())
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
