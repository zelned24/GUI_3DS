import { SceneModel } from './SceneModel.js';
import { ComponentRegistry } from '../components/ComponentRegistry.js';
import { globalRNG } from './DeterministicRNG.js';
import { AnimationTrack } from '../animation/AnimationTrack.js';

/**
 * SceneLibrary - Central registry and authoring manager for Scenes, Compositions, and Templates.
 * Provides duplication, templates, and cycle detection for nested compositions.
 */
export class SceneLibrary {
  static _scenes = new Map();
  static _templates = new Map();
  static _initialized = false;

  registerScene(scene) {
    return SceneLibrary.registerScene(scene);
  }

  getScene(sceneId) {
    return SceneLibrary.getScene(sceneId);
  }

  getAllScenes() {
    return SceneLibrary.getAllScenes();
  }

  hasScene(sceneId) {
    return SceneLibrary.hasScene(sceneId);
  }

  duplicateScene(sceneOrId, newId = null, newName = null) {
    return SceneLibrary.duplicateScene(sceneOrId, newId, newName);
  }

  static registerScene(scene) {
    if (!scene || !scene.id) return;
    const model = scene instanceof SceneModel ? scene : new SceneModel(scene);
    this._scenes.set(model.id, model);
    return model;
  }

  static getScene(sceneId) {
    this._ensureInit();
    return this._scenes.get(sceneId) || null;
  }

  static getAllScenes() {
    this._ensureInit();
    return Array.from(this._scenes.values());
  }

  static hasScene(sceneId) {
    this._ensureInit();
    return this._scenes.has(sceneId);
  }

  static removeScene(sceneId) {
    return this._scenes.delete(sceneId);
  }

  static clearScenes() {
    this._scenes.clear();
  }

  /**
   * Creates a new blank SceneModel with schemaVersion 4.
   * @param {Object} options 
   * @returns {SceneModel}
   */
  static createScene(options = {}) {
    const scene = new SceneModel({
      schemaVersion: 4,
      id: options.id || globalRNG.nextId('scene'),
      name: options.name || 'New Scene',
      durationFrames: options.durationFrames || 60,
      fps: options.fps || 60,
      ...options
    });
    this.registerScene(scene);
    return scene;
  }

  /**
   * Duplicates an existing scene deterministically:
   * - Remaps all node IDs cleanly to prevent collisions.
   * - Remaps all animation track targetNodeIds to the new IDs.
   * - Preserves assets, hierarchy, clips, sequence, markers, and audio cues.
   * 
   * @param {string} sceneId 
   * @param {string} [newId] 
   * @param {string} [newName] 
   * @returns {SceneModel}
   */
  static duplicateScene(sceneOrId, newId = null, newName = null) {
    const source = (typeof sceneOrId === 'string') ? this.getScene(sceneOrId) : sceneOrId;
    if (!source) throw new Error(`Source scene "${sceneOrId}" not found in SceneLibrary`);

    const json = JSON.parse(JSON.stringify(source.toJSON()));
    const generatedId = newId || `${source.id}_copy_${globalRNG.nextId('dup')}`;
    const generatedName = newName || `${source.name} Copy`;

    // Map old node IDs to newly generated deterministic IDs
    const idMap = new Map();
    for (const node of json.components || json.nodes || []) {
      const freshId = `${node.type.toLowerCase()}_${globalRNG.nextId('node')}`;
      idMap.set(node.id, freshId);
    }

    // Remap nodes
    const duplicatedNodes = (json.components || json.nodes || []).map(node => {
      const remappedParent = node.parent && idMap.has(node.parent) ? idMap.get(node.parent) : (node.parent || null);
      const remappedChildren = Array.isArray(node.children)
        ? node.children.map(cid => idMap.get(cid) || cid)
        : [];

      return {
        ...node,
        id: idMap.get(node.id) || node.id,
        parent: remappedParent,
        children: remappedChildren
      };
    });

    // Remap animation tracks targeting remapped nodes
    const duplicatedTracks = (json.tracks || []).map(track => {
      const newTarget = idMap.get(track.targetNodeId) || track.targetNodeId;
      return {
        ...track,
        id: `track_${newTarget}_${track.propertyPath.replace(/\./g, '_')}`,
        targetNodeId: newTarget
      };
    });

    // Remap sequence items if targeting remapped nodes
    const duplicatedSequence = (json.sequence || []).map(seq => ({
      ...seq,
      id: globalRNG.nextId('seq'),
      targetNodeId: idMap.get(seq.targetNodeId) || seq.targetNodeId
    }));

    const newScene = new SceneModel({
      ...json,
      schemaVersion: 4,
      id: generatedId,
      name: generatedName,
      nodes: duplicatedNodes,
      components: duplicatedNodes,
      tracks: duplicatedTracks,
      sequence: duplicatedSequence
    });

    this.registerScene(newScene);
    return newScene;
  }

  // --- Templates ---

  static registerTemplate(name, sceneOrData) {
    this._templates.set(name, sceneOrData);
  }

  static getTemplate(name) {
    this._ensureInit();
    return this._templates.get(name) || null;
  }

  static getAllTemplates() {
    this._ensureInit();
    return Array.from(this._templates.keys());
  }

  static saveAsTemplate(sceneId, templateName) {
    const scene = this.getScene(sceneId);
    if (!scene) throw new Error(`Scene "${sceneId}" not found to save as template`);
    this.registerTemplate(templateName, scene.toJSON());
  }

  static createFromTemplate(templateName, newId = null, newName = null) {
    const templateData = this.getTemplate(templateName);
    if (!templateData) throw new Error(`Template "${templateName}" not found`);

    const tempId = `temp_${globalRNG.nextId('tmpl')}`;
    const tempScene = new SceneModel({ ...templateData, id: tempId });
    this.registerScene(tempScene);

    const instanced = this.duplicateScene(tempId, newId || `${templateName.toLowerCase()}_${globalRNG.nextId('scene')}`, newName || `${templateName} Scene`);
    this.removeScene(tempId);
    return instanced;
  }

  // --- Cycle Detection for Nested Compositions ---

  /**
   * Asserts that no cycle exists in composition references starting from rootSceneId.
   * Throws deterministic error if a cycle is detected (e.g. Scene A -> Scene B -> Scene A).
   * 
   * @param {string} rootSceneId 
   * @param {Function} [sceneResolver] 
   */
  static assertNoCompositionCycles(rootSceneId, sceneResolver = null) {
    const resolver = sceneResolver || ((id) => SceneLibrary.getScene(id));
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];

    const checkCycle = (currentId) => {
      visited.add(currentId);
      recursionStack.add(currentId);
      path.push(currentId);

      const scene = resolver(currentId);
      if (scene) {
        const nodes = scene.nodes || scene.components || [];
        for (const node of nodes) {
          const childSceneId = node.properties?.sceneId || node.sceneId;
          if (node.type === 'Composition' && childSceneId) {
            if (!visited.has(childSceneId)) {
              checkCycle(childSceneId);
            } else if (recursionStack.has(childSceneId)) {
              path.push(childSceneId);
              throw new Error(`Circular composition reference detected: ${path.join(' -> ')}`);
            }
          }
        }
      }

      path.pop();
      recursionStack.delete(currentId);
    };

    checkCycle(rootSceneId);
  }

  static _ensureInit() {
    if (!this._initialized) {
      this.initDefaultTemplates();
      this._initialized = true;
    }
  }

  /**
   * Initializes the 5 required authoring templates:
   * 1. DialogScene
   * 2. BattleIntro
   * 3. Menu
   * 4. TitleCard
   * 5. PokemonEntrance
   */
  static initDefaultTemplates() {
    this._templates.clear();

    // 1. DialogScene
    this.registerTemplate('DialogScene', {
      schemaVersion: 4,
      id: 'template_dialog',
      name: 'Dialog Scene',
      durationFrames: 60,
      fps: 60,
      top: { width: 400, height: 240, backgroundColor: '#10121a' },
      bottom: { width: 320, height: 240, backgroundColor: '#181b24' },
      components: [
        {
          id: 'dlg_speaker',
          type: 'PixelText',
          screen: 'top',
          x: 20, y: 160, width: 360, height: 24,
          properties: { text: 'Professor Oak', fontSize: 12, color: '#38bdf8' }
        },
        {
          id: 'dlg_text',
          type: 'PixelText',
          screen: 'top',
          x: 20, y: 190, width: 360, height: 40,
          properties: { text: 'Welcome to the world of Pokémon!', fontSize: 11, color: '#ffffff' }
        },
        {
          id: 'dlg_prompt_box',
          type: 'RogueBox',
          screen: 'bottom',
          x: 10, y: 30, width: 300, height: 180,
          properties: { backgroundColor: '#1e2433' }
        },
        {
          id: 'dlg_next_btn',
          type: 'TouchButton',
          screen: 'bottom',
          parent: 'dlg_prompt_box',
          x: 60, y: 90, width: 200, height: 44,
          properties: { label: 'CONTINUE', backgroundColor: '#0284c7' }
        }
      ],
      tracks: []
    });

    // 2. BattleIntro
    this.registerTemplate('BattleIntro', {
      schemaVersion: 4,
      id: 'template_battle_intro',
      name: 'Battle Intro',
      durationFrames: 60,
      fps: 60,
      top: { width: 400, height: 240, backgroundColor: '#0d1117' },
      bottom: { width: 320, height: 240, backgroundColor: '#161b22' },
      components: [
        {
          id: 'battle_bg',
          type: 'Image',
          screen: 'top',
          x: 0, y: 0, width: 400, height: 240,
          properties: { asset: 'bg_arena_plains', fit: 'stretch' }
        },
        {
          id: 'enemy_sprite',
          type: 'PokemonSprite',
          screen: 'top',
          x: 250, y: 40, width: 96, height: 96,
          properties: { species: 'Pikachu', nationalDexId: 25, facing: 'front' }
        },
        {
          id: 'command_box',
          type: 'RogueBox',
          screen: 'bottom',
          x: 10, y: 20, width: 300, height: 200,
          properties: { backgroundColor: '#21262d' }
        }
      ],
      tracks: []
    });

    // 3. Menu
    this.registerTemplate('Menu', {
      schemaVersion: 4,
      id: 'template_menu',
      name: 'Menu Template',
      durationFrames: 60,
      fps: 60,
      top: { width: 400, height: 240, backgroundColor: '#0f172a' },
      bottom: { width: 320, height: 240, backgroundColor: '#1e293b' },
      components: [
        {
          id: 'menu_title',
          type: 'PixelText',
          screen: 'top',
          x: 20, y: 30, width: 360, height: 32,
          properties: { text: 'MAIN MENU', fontSize: 16, color: '#f8fafc', align: 'center' }
        },
        {
          id: 'btn_start',
          type: 'TouchButton',
          screen: 'bottom',
          x: 40, y: 30, width: 240, height: 40,
          properties: { label: 'START ADVENTURE', backgroundColor: '#3b82f6' }
        },
        {
          id: 'btn_options',
          type: 'TouchButton',
          screen: 'bottom',
          x: 40, y: 90, width: 240, height: 40,
          properties: { label: 'OPTIONS', backgroundColor: '#475569' }
        }
      ],
      tracks: []
    });

    // 4. TitleCard
    this.registerTemplate('TitleCard', {
      schemaVersion: 4,
      id: 'template_title_card',
      name: 'Title Card',
      durationFrames: 90,
      fps: 60,
      top: { width: 400, height: 240, backgroundColor: '#020617' },
      bottom: { width: 320, height: 240, backgroundColor: '#0f172a' },
      components: [
        {
          id: 'title_logo',
          type: 'PixelText',
          screen: 'top',
          x: 20, y: 90, width: 360, height: 48,
          properties: { text: 'POKÉMON STUDIO 3DS', fontSize: 18, color: '#fbbf24', align: 'center' }
        },
        {
          id: 'touch_prompt',
          type: 'TouchButton',
          screen: 'bottom',
          x: 30, y: 100, width: 260, height: 44,
          properties: { label: 'TOUCH TO START', backgroundColor: '#334155' }
        }
      ],
      tracks: []
    });

    // 5. PokemonEntrance
    this.registerTemplate('PokemonEntrance', {
      schemaVersion: 4,
      id: 'template_pokemon_entrance',
      name: 'Pokemon Entrance',
      durationFrames: 60,
      fps: 60,
      top: { width: 400, height: 240, backgroundColor: '#12141c' },
      bottom: { width: 320, height: 240, backgroundColor: '#1a1824' },
      components: [
        {
          id: 'ent_pokemon',
          type: 'PokemonSprite',
          screen: 'top',
          x: 150, y: 50, width: 100, height: 100,
          properties: { species: 'Pikachu', nationalDexId: 25, facing: 'front' }
        },
        {
          id: 'ent_status',
          type: 'RogueBox',
          screen: 'bottom',
          x: 10, y: 30, width: 300, height: 180,
          properties: { backgroundColor: '#1f2937' }
        }
      ],
      tracks: []
    });
  }
}
