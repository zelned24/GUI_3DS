import { SceneValidator } from './SceneValidator.js';
import { InterpolationTypes } from '../animation/Keyframe.js';
import { AssetResolver } from '../data/AssetResolver.js';
import { PokemonSpriteResolver } from '../data/PokemonSpriteResolver.js';

/**
 * SceneCppExporter - Pure, deterministic C++ generator and Citro2D runtime exporter.
 * Converts GUI_3DS SceneModel into compact, static C++ data tables and Citro2D runtime code.
 * 
 * Guarantees:
 * - Single source of truth (SceneModel + TimelineEvaluator)
 * - Zero gameplay logic (no BattleEngine, combat rules, AI)
 * - Compact static data tables (never per-frame generated C++)
 * - Byte-identical deterministic output for identical input scenes
 * - Mathematical parity with JS TimelineEvaluator
 */
export class SceneCppExporter {
  static PROPERTY_MAP = {
    'transform.x': { id: 1, name: 'X' },
    'x': { id: 1, name: 'X' },
    'transform.y': { id: 2, name: 'Y' },
    'y': { id: 2, name: 'Y' },
    'transform.scaleX': { id: 3, name: 'ScaleX' },
    'scaleX': { id: 3, name: 'ScaleX' },
    'transform.scaleY': { id: 4, name: 'ScaleY' },
    'scaleY': { id: 4, name: 'ScaleY' },
    'transform.rotation': { id: 5, name: 'Rotation' },
    'rotation': { id: 5, name: 'Rotation' },
    'transform.opacity': { id: 6, name: 'Opacity' },
    'opacity': { id: 6, name: 'Opacity' },
    'visible': { id: 7, name: 'Visible' }
  };

  static INTERPOLATION_MAP = {
    [InterpolationTypes.STEP]: { id: 0, name: 'Step' },
    [InterpolationTypes.LINEAR]: { id: 1, name: 'Linear' },
    [InterpolationTypes.EASE_IN]: { id: 2, name: 'EaseIn' },
    [InterpolationTypes.EASE_OUT]: { id: 3, name: 'EaseOut' },
    [InterpolationTypes.EASE_IN_OUT]: { id: 4, name: 'EaseInOut' }
  };

  static NODE_TYPE_MAP = {
    'Image': 0,
    'ImageNode': 0,
    'PokemonSprite': 1,
    'PokemonSpriteNode': 1,
    'PixelText': 2,
    'Text': 2,
    'RogueBox': 3,
    'Panel': 3,
    'HealthBar': 3,
    'TouchButton': 4,
    'MoveButton': 4,
    'Button': 4,
    'Group': 5,
    'GroupNode': 5
  };

  /**
   * Deterministic 32-bit FNV-1a hash algorithm.
   * @param {string} str 
   * @returns {number} Unsigned 32-bit integer
   */
  static fnv1a32(str) {
    let hash = 0x811c9dc5;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      hash ^= s.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  /**
   * Converts a hex color string to Citro2D 32-bit format (0xAABBGGRR).
   * @param {string} hex 
   * @param {string} alphaHex 
   * @returns {string} E.g. "0xFF12141C"
   */
  static hexColorToCitro2D(hex, alphaHex = 'FF') {
    if (!hex) return '0xFFFFFFFF';
    let clean = String(hex).replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length === 8) {
      const r = clean.slice(0, 2);
      const g = clean.slice(2, 4);
      const b = clean.slice(4, 6);
      const a = clean.slice(6, 8);
      return `0x${a.toUpperCase()}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}`;
    }
    if (clean.length === 6) {
      const r = clean.slice(0, 2);
      const g = clean.slice(2, 4);
      const b = clean.slice(4, 6);
      return `0x${alphaHex.toUpperCase()}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}`;
    }
    return '0xFFFFFFFF';
  }

  static escapeCppString(str) {
    return String(str ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }

  static sanitizeIdentifier(str) {
    const cleaned = String(str || '').replace(/[^a-zA-Z0-9_]/g, '_');
    if (/^[0-9]/.test(cleaned)) return `s_${cleaned}`;
    return cleaned || 'scene';
  }

  static sanitizeClassName(str) {
    const clean = String(str || '').replace(/[^a-zA-Z0-9_]/g, '');
    const base = clean ? (clean.charAt(0).toUpperCase() + clean.slice(1)) : 'CustomScene';
    return base.endsWith('Scene') ? base : `${base}Scene`;
  }

  /**
   * Exports a SceneModel (or raw scene JSON) to complete C++ Citro2D runtime bundle.
   * Performs pre-export validation before generating any output.
   * 
   * @param {Object} scene 
   * @param {Object} [options]
   * @returns {Object} Complete file bundle
   */
  static export(scene, options = {}) {
    // 1. Strict pre-export validation
    SceneValidator.assertValid(scene);

    const sceneRaw = typeof scene.toJSON === 'function' ? scene.toJSON() : scene;
    const sceneId = sceneRaw.id;
    const className = this.sanitizeClassName(sceneId);

    // 2. Resolve referenced assets deterministically
    const assetManifest = this._buildAssetManifest(sceneRaw);

    // 3. Build normalized deterministic scene export model
    const exportModel = this._buildExportModel(sceneRaw, assetManifest);

    // 4. Generate C++ files
    const dataHpp = this._generateSceneDataHpp(exportModel);
    const dataCpp = this._generateSceneDataCpp(exportModel);
    const assetsHpp = this._generateSceneAssetsHpp(assetManifest);
    const assetsCpp = this._generateSceneAssetsCpp(assetManifest);
    const timelineHpp = this._generateSceneTimelineHpp();
    const timelineCpp = this._generateSceneTimelineCpp();
    const sceneHpp = this._generateSceneClassHpp(className, exportModel);
    const sceneCpp = this._generateSceneClassCpp(className, exportModel);
    const manifestJson = JSON.stringify(assetManifest, null, 2);

    const files = {
      'generated/include/screens/SceneData.hpp': dataHpp,
      'generated/src/screens/SceneData.cpp': dataCpp,
      'generated/include/screens/SceneAssets.hpp': assetsHpp,
      'generated/src/screens/SceneAssets.cpp': assetsCpp,
      'generated/include/screens/AssetManifest.hpp': assetsHpp,
      'generated/src/screens/AssetManifest.cpp': assetsCpp,
      'generated/include/screens/SceneTimeline.hpp': timelineHpp,
      'generated/src/screens/SceneTimeline.cpp': timelineCpp,
      'generated/include/screens/Scene.hpp': sceneHpp,
      'generated/src/screens/Scene.cpp': sceneCpp,
      [`generated/include/screens/${className}.hpp`]: sceneHpp,
      [`generated/src/screens/${className}.cpp`]: sceneCpp,
      'generated/SceneManifest.json': manifestJson
    };

    return {
      sceneId,
      className,
      headerPath: `generated/include/screens/${className}.hpp`,
      sourcePath: `generated/src/screens/${className}.cpp`,
      hpp: sceneHpp,
      cpp: sceneCpp,
      dataHpp,
      dataCpp,
      assetsHpp,
      assetsCpp,
      timelineHpp,
      timelineCpp,
      manifestJson,
      manifest: assetManifest,
      exportModel,
      files
    };
  }

  /**
   * Builds deterministic Asset Manifest containing only referenced scene assets.
   * @param {Object} scene 
   */
  static _buildAssetManifest(scene) {
    const assetResolver = new AssetResolver();
    const pokemonResolver = new PokemonSpriteResolver();
    const assetMap = new Map();

    const rawNodes = scene.nodes || scene.components || [];

    for (const node of rawNodes) {
      if (node.type === 'Image' || node.type === 'ImageNode') {
        const assetId = node.properties?.asset;
        if (assetId && !assetMap.has(assetId)) {
          const resolved = assetResolver.getAsset(assetId);
          if (resolved) {
            assetMap.set(assetId, {
              assetId,
              romfsPath: resolved.target3DS?.t3xPath || `romfs/gfx/${assetId}.t3x`,
              format: resolved.target3DS?.format || 'RGB565',
              width: resolved.dimensions?.width || node.width || 400,
              height: resolved.dimensions?.height || node.height || 240,
              sourceRepository: resolved.repository || 'pokerogue-assets',
              sourceRevision: resolved.revision || '056a1f4'
            });
          } else {
            // Fallback for valid user assets
            assetMap.set(assetId, {
              assetId,
              romfsPath: `romfs/gfx/${assetId}.t3x`,
              format: 'RGB565',
              width: node.width || 400,
              height: node.height || 240,
              sourceRepository: 'local',
              sourceRevision: 'HEAD'
            });
          }
        }
      }

      if (node.type === 'PokemonSprite' || node.type === 'PokemonSpriteNode') {
        const dexId = Number(node.properties?.nationalDexId || 25);
        const assetId = `pokemon_sprite_${dexId}_${node.properties?.facing || 'front'}`;
        if (!assetMap.has(assetId)) {
          const pkmnRes = pokemonResolver.resolvePokemonSprite(dexId);
          const t3x = pkmnRes?.target3DS?.t3xPath || `romfs/sprites/pokemon/${dexId}.t3x`;
          const fmt = pkmnRes?.target3DS?.format || 'RGBA4444';
          const dims = pkmnRes?.dimensions || { width: node.width || 96, height: node.height || 96 };

          assetMap.set(assetId, {
            assetId,
            romfsPath: t3x,
            format: fmt,
            width: dims.width,
            height: dims.height,
            sourceRepository: pkmnRes?.sourceRepository || 'pokerogue-assets',
            sourceRevision: pkmnRes?.sourceRevision || '056a1f4'
          });
        }
      }
    }

    // Audio cues
    if (Array.isArray(scene.audioCues)) {
      for (const cue of scene.audioCues) {
        if (cue.asset && !assetMap.has(cue.asset)) {
          assetMap.set(cue.asset, {
            assetId: cue.asset,
            romfsPath: `romfs/audio/${cue.asset}.bcstm`,
            format: 'BCSTM',
            width: 0,
            height: 0,
            sourceRepository: 'audio-catalog',
            sourceRevision: 'HEAD'
          });
        }
      }
    }

    // Sort deterministically by assetId
    const sortedAssets = Array.from(assetMap.values()).sort((a, b) => a.assetId.localeCompare(b.assetId));

    return {
      schemaVersion: 2,
      sceneId: scene.id,
      generated: true,
      assetCount: sortedAssets.length,
      assets: sortedAssets
    };
  }

  /**
   * Builds normalized C++ export model from SceneModel.
   * @param {Object} scene 
   * @param {Object} assetManifest 
   */
  static _buildExportModel(scene, assetManifest) {
    const rawNodes = [...(scene.nodes || scene.components || [])];

    // Sort nodes deterministically: screen (top, bottom, global), then zIndex, then id
    const screenOrder = { 'top': 0, 'bottom': 1, 'global': 2 };
    rawNodes.sort((a, b) => {
      const sA = screenOrder[a.screen || 'top'] ?? 2;
      const sB = screenOrder[b.screen || 'top'] ?? 2;
      if (sA !== sB) return sA - sB;
      const zA = a.zIndex || 0;
      const zB = b.zIndex || 0;
      if (zA !== zB) return zA - zB;
      return a.id.localeCompare(b.id);
    });

    const nodeIdToIndex = new Map(rawNodes.map((n, idx) => [n.id, idx]));

    const nodes = rawNodes.map((n, idx) => {
      const idHash = this.fnv1a32(n.id);
      const parentIndex = (n.parent && nodeIdToIndex.has(n.parent)) ? nodeIdToIndex.get(n.parent) : -1;
      const typeCode = this.NODE_TYPE_MAP[n.type] ?? 0;
      const screenCode = n.screen === 'bottom' ? 1 : (n.screen === 'global' ? 2 : 0);

      let assetId = '';
      if (n.type === 'Image' || n.type === 'ImageNode') {
        assetId = n.properties?.asset || '';
      } else if (n.type === 'PokemonSprite' || n.type === 'PokemonSpriteNode') {
        const dexId = Number(n.properties?.nationalDexId || 25);
        assetId = `pokemon_sprite_${dexId}_${n.properties?.facing || 'front'}`;
      }

      const tint = n.properties?.tint || n.properties?.backgroundColor || '#ffffff';
      const text = n.properties?.text || n.properties?.label || '';

      return {
        index: idx,
        id: n.id,
        idHash,
        type: n.type,
        typeCode,
        screen: n.screen || 'top',
        screenCode,
        parent: n.parent || null,
        parentIndex,
        x: Number(n.x ?? n.transform?.x ?? 0),
        y: Number(n.y ?? n.transform?.y ?? 0),
        width: Number(n.width ?? n.transform?.width ?? 0),
        height: Number(n.height ?? n.transform?.height ?? 0),
        scaleX: Number(n.scaleX ?? n.transform?.scaleX ?? 1.0),
        scaleY: Number(n.scaleY ?? n.transform?.scaleY ?? 1.0),
        rotation: Number(n.rotation ?? n.transform?.rotation ?? 0.0),
        opacity: Number(n.opacity ?? n.transform?.opacity ?? 1.0),
        visible: n.visible !== false,
        zIndex: Number(n.zIndex || 0),
        asset: assetId,
        flipX: Boolean(n.properties?.flipX),
        flipY: Boolean(n.properties?.flipY),
        tintColor: this.hexColorToCitro2D(tint),
        text
      };
    });

    // Build tracks with deterministic sorting: targetNodeId, then propertyId
    const rawTracks = [...(scene.tracks || [])];
    rawTracks.sort((a, b) => {
      const nodeDiff = a.targetNodeId.localeCompare(b.targetNodeId);
      if (nodeDiff !== 0) return nodeDiff;
      return (a.propertyPath || '').localeCompare(b.propertyPath || '');
    });

    const tracks = rawTracks.map(t => {
      const propInfo = this.PROPERTY_MAP[t.propertyPath] || { id: 0, name: 'None' };
      const nodeHash = this.fnv1a32(t.targetNodeId);
      const rawKfs = [...(t.keyframes || [])];

      // Keyframes strictly sorted by integer frame
      rawKfs.sort((a, b) => Math.round(a.frame) - Math.round(b.frame));

      const keyframes = rawKfs.map(kf => {
        const interpInfo = this.INTERPOLATION_MAP[kf.interpolation] || { id: 1, name: 'Linear' };
        return {
          frame: Math.max(0, Math.round(kf.frame)),
          value: Number(kf.value),
          interpolation: kf.interpolation || 'linear',
          interpolationId: interpInfo.id,
          interpolationName: interpInfo.name
        };
      });

      return {
        id: t.id,
        targetNodeId: t.targetNodeId,
        nodeHash,
        propertyPath: t.propertyPath,
        propertyId: propInfo.id,
        propertyName: propInfo.name,
        muted: Boolean(t.muted),
        solo: Boolean(t.solo),
        keyframes
      };
    });

    // Markers sorted deterministically
    const rawMarkers = [...(scene.markers || [])];
    rawMarkers.sort((a, b) => {
      const fDiff = Math.round(a.frame || 0) - Math.round(b.frame || 0);
      if (fDiff !== 0) return fDiff;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    const markers = rawMarkers.map(m => ({
      frame: Math.max(0, Math.round(m.frame || 0)),
      name: m.name || 'Marker',
      type: m.type || 'Event'
    }));

    // Audio cues sorted deterministically
    const rawCues = [...(scene.audioCues || [])];
    rawCues.sort((a, b) => {
      const fDiff = Math.round(a.frame || 0) - Math.round(b.frame || 0);
      if (fDiff !== 0) return fDiff;
      return String(a.asset || '').localeCompare(String(b.asset || ''));
    });
    const audioCues = rawCues.map(c => ({
      frame: Math.max(0, Math.round(c.frame || 0)),
      asset: c.asset || '',
      volume: Number(c.volume ?? 1.0),
      channel: Number(c.channel ?? 0)
    }));

    return {
      sceneId: scene.id,
      durationFrames: Math.max(1, Math.round(scene.durationFrames ?? 60)),
      fps: Math.round(scene.fps ?? 60),
      topBgColor: this.hexColorToCitro2D(scene.top?.backgroundColor || '#12141c'),
      bottomBgColor: this.hexColorToCitro2D(scene.bottom?.backgroundColor || '#1a1824'),
      nodes,
      tracks,
      markers,
      audioCues,
      assets: assetManifest.assets
    };
  }

  // -------------------------------------------------------------
  // C++ GENERATION METHODS
  // -------------------------------------------------------------

  static _generateSceneDataHpp(model) {
    return `#pragma once

#include <cstdint>
#include <cstddef>

namespace Citro2D {

enum class PropertyId : uint16_t {
    None = 0,
    X = 1,
    Y = 2,
    ScaleX = 3,
    ScaleY = 4,
    Rotation = 5,
    Opacity = 6,
    Visible = 7
};

enum class InterpolationType : uint8_t {
    Step = 0,
    Linear = 1,
    EaseIn = 2,
    EaseOut = 3,
    EaseInOut = 4
};

enum class ScreenTarget : uint8_t {
    Top = 0,     // 400x240
    Bottom = 1,  // 320x240
    Global = 2
};

enum class NodeType : uint8_t {
    Image = 0,
    PokemonSprite = 1,
    Text = 2,
    Panel = 3,
    Button = 4,
    Group = 5
};

struct SceneKeyframe {
    uint16_t frame;
    float value;
    InterpolationType interpolation;
};

struct SceneTrack {
    uint32_t nodeHash;
    const char* nodeId;
    PropertyId propertyId;
    uint16_t keyframeCount;
    const SceneKeyframe* keyframes;
};

struct SceneMarker {
    uint16_t frame;
    const char* name;
    const char* type;
};

struct SceneAudioCue {
    uint16_t frame;
    const char* asset;
    float volume;
    uint8_t channel;
};

struct SceneNodeData {
    uint32_t idHash;
    const char* id;
    NodeType type;
    ScreenTarget screen;
    int32_t parentIndex; // -1 if root node
    // Base transform
    float x;
    float y;
    float width;
    float height;
    float scaleX;
    float scaleY;
    float rotation;
    float opacity;
    bool visible;
    int16_t zIndex;
    // Node-specific properties
    const char* asset;
    bool flipX;
    bool flipY;
    uint32_t tintColor;
    const char* text;
};

struct SceneDefinition {
    const char* id;
    uint16_t durationFrames;
    uint16_t fps;
    uint32_t topBgColor;
    uint32_t bottomBgColor;
    uint16_t nodeCount;
    const SceneNodeData* nodes;
    uint16_t trackCount;
    const SceneTrack* tracks;
    uint16_t markerCount;
    const SceneMarker* markers;
    uint16_t audioCueCount;
    const SceneAudioCue* audioCues;
};

extern const SceneDefinition g_SceneDefinition;

} // namespace Citro2D
`;
  }

  static _generateSceneDataCpp(model) {
    const lines = [];
    lines.push('#include "screens/SceneData.hpp"');
    lines.push('');
    lines.push('namespace Citro2D {');
    lines.push('');

    // 1. Static Keyframe Arrays
    lines.push('// -------------------------------------------------------------');
    lines.push('// 1. KEYFRAME ARRAYS (Deterministic Static Compact Data)');
    lines.push('// -------------------------------------------------------------');

    for (let i = 0; i < model.tracks.length; i++) {
      const track = model.tracks[i];
      const safeNode = this.sanitizeIdentifier(track.targetNodeId);
      const safeProp = this.sanitizeIdentifier(track.propertyName);
      const varName = `s_keyframes_${safeNode}_${safeProp}_${i}`;

      if (track.keyframes.length === 0) {
        lines.push(`// Track ${track.targetNodeId}.${track.propertyName} has 0 keyframes`);
      } else {
        lines.push(`static const SceneKeyframe ${varName}[] = {`);
        for (const kf of track.keyframes) {
          const valStr = Number.isInteger(kf.value) ? `${kf.value}.0f` : `${kf.value}f`;
          lines.push(`    { ${kf.frame}, ${valStr}, InterpolationType::${kf.interpolationName} },`);
        }
        lines.push('};');
        lines.push('');
      }
    }

    // 2. Static Track Array
    lines.push('// -------------------------------------------------------------');
    lines.push('// 2. ANIMATION TRACKS');
    lines.push('// -------------------------------------------------------------');
    if (model.tracks.length === 0) {
      lines.push('static const SceneTrack* s_tracks = nullptr;');
    } else {
      lines.push('static const SceneTrack s_tracks[] = {');
      for (let i = 0; i < model.tracks.length; i++) {
        const track = model.tracks[i];
        const safeNode = this.sanitizeIdentifier(track.targetNodeId);
        const safeProp = this.sanitizeIdentifier(track.propertyName);
        const kfVar = track.keyframes.length > 0 ? `s_keyframes_${safeNode}_${safeProp}_${i}` : 'nullptr';
        const hexHash = `0x${track.nodeHash.toString(16).toUpperCase().padStart(8, '0')}`;

        lines.push(`    { ${hexHash}, "${this.escapeCppString(track.targetNodeId)}", PropertyId::${track.propertyName}, ${track.keyframes.length}, ${kfVar} },`);
      }
      lines.push('};');
    }
    lines.push('');

    // 3. Static Nodes Array
    lines.push('// -------------------------------------------------------------');
    lines.push('// 3. SCENE NODES (Hierarchy & Base Transforms)');
    lines.push('// -------------------------------------------------------------');
    if (model.nodes.length === 0) {
      lines.push('static const SceneNodeData* s_nodes = nullptr;');
    } else {
      lines.push('static const SceneNodeData s_nodes[] = {');
      for (const node of model.nodes) {
        const hexHash = `0x${node.idHash.toString(16).toUpperCase().padStart(8, '0')}`;
        const screenEnum = node.screen === 'bottom' ? 'ScreenTarget::Bottom' : (node.screen === 'global' ? 'ScreenTarget::Global' : 'ScreenTarget::Top');
        const typeEnum = `NodeType::${['Image', 'PokemonSprite', 'Text', 'Panel', 'Button', 'Group'][node.typeCode] || 'Image'}`;
        const assetStr = node.asset ? `"${this.escapeCppString(node.asset)}"` : 'nullptr';
        const textStr = node.text ? `"${this.escapeCppString(node.text)}"` : 'nullptr';

        lines.push('    {');
        lines.push(`        ${hexHash}, "${this.escapeCppString(node.id)}", ${typeEnum}, ${screenEnum}, ${node.parentIndex},`);
        lines.push(`        ${node.x}.0f, ${node.y}.0f, ${node.width}.0f, ${node.height}.0f,`);
        lines.push(`        ${node.scaleX}f, ${node.scaleY}f, ${node.rotation}f, ${node.opacity}f,`);
        lines.push(`        ${node.visible ? 'true' : 'false'}, ${node.zIndex},`);
        lines.push(`        ${assetStr}, ${node.flipX ? 'true' : 'false'}, ${node.flipY ? 'true' : 'false'},`);
        lines.push(`        ${node.tintColor}, ${textStr}`);
        lines.push('    },');
      }
      lines.push('};');
    }
    lines.push('');

    // 4. Static Markers Array
    lines.push('// -------------------------------------------------------------');
    lines.push('// 4. TIMELINE MARKERS');
    lines.push('// -------------------------------------------------------------');
    if (model.markers.length === 0) {
      lines.push('static const SceneMarker* s_markers = nullptr;');
    } else {
      lines.push('static const SceneMarker s_markers[] = {');
      for (const m of model.markers) {
        lines.push(`    { ${m.frame}, "${this.escapeCppString(m.name)}", "${this.escapeCppString(m.type)}" },`);
      }
      lines.push('};');
    }
    lines.push('');

    // 5. Static Audio Cues Array
    lines.push('// -------------------------------------------------------------');
    lines.push('// 5. AUDIO CUES');
    lines.push('// -------------------------------------------------------------');
    if (model.audioCues.length === 0) {
      lines.push('static const SceneAudioCue* s_audioCues = nullptr;');
    } else {
      lines.push('static const SceneAudioCue s_audioCues[] = {');
      for (const c of model.audioCues) {
        lines.push(`    { ${c.frame}, "${this.escapeCppString(c.asset)}", ${c.volume}f, ${c.channel} },`);
      }
      lines.push('};');
    }
    lines.push('');

    // 6. Global Scene Definition
    lines.push('// -------------------------------------------------------------');
    lines.push('// 6. CANONICAL SCENE DEFINITION');
    lines.push('// -------------------------------------------------------------');
    lines.push('const SceneDefinition g_SceneDefinition = {');
    lines.push(`    "${this.escapeCppString(model.sceneId)}",`);
    lines.push(`    ${model.durationFrames},`);
    lines.push(`    ${model.fps},`);
    lines.push(`    ${model.topBgColor},`);
    lines.push(`    ${model.bottomBgColor},`);
    lines.push(`    ${model.nodes.length},`);
    lines.push(`    ${model.nodes.length > 0 ? 's_nodes' : 'nullptr'},`);
    lines.push(`    ${model.tracks.length},`);
    lines.push(`    ${model.tracks.length > 0 ? 's_tracks' : 'nullptr'},`);
    lines.push(`    ${model.markers.length},`);
    lines.push(`    ${model.markers.length > 0 ? 's_markers' : 'nullptr'},`);
    lines.push(`    ${model.audioCues.length},`);
    lines.push(`    ${model.audioCues.length > 0 ? 's_audioCues' : 'nullptr'}`);
    lines.push('};');
    lines.push('');
    lines.push('} // namespace Citro2D');
    lines.push('');

    return lines.join('\n');
  }

  static _generateSceneAssetsHpp(manifest) {
    return `#pragma once

#include <cstdint>
#include <cstddef>

namespace Citro2D {

struct AssetEntry {
    const char* assetId;
    const char* romfsPath;
    const char* targetFormat;
    uint16_t width;
    uint16_t height;
};

extern const AssetEntry g_SceneAssets[];
extern const size_t g_SceneAssetCount;

const AssetEntry* findSceneAsset(const char* assetId);

} // namespace Citro2D
`;
  }

  static _generateSceneAssetsCpp(manifest) {
    const lines = [];
    lines.push('#include "screens/SceneAssets.hpp"');
    lines.push('#include <cstring>');
    lines.push('');
    lines.push('namespace Citro2D {');
    lines.push('');

    if (manifest.assets.length === 0) {
      lines.push('const AssetEntry g_SceneAssets[] = {};');
      lines.push('const size_t g_SceneAssetCount = 0;');
    } else {
      lines.push('const AssetEntry g_SceneAssets[] = {');
      for (const a of manifest.assets) {
        lines.push(`    { "${this.escapeCppString(a.assetId)}", "${this.escapeCppString(a.romfsPath)}", "${this.escapeCppString(a.format)}", ${a.width}, ${a.height} },`);
      }
      lines.push('};');
      lines.push('');
      lines.push('const size_t g_SceneAssetCount = sizeof(g_SceneAssets) / sizeof(g_SceneAssets[0]);');
    }

    lines.push('');
    lines.push('const AssetEntry* findSceneAsset(const char* assetId) {');
    lines.push('    if (!assetId) return nullptr;');
    lines.push('    for (size_t i = 0; i < g_SceneAssetCount; ++i) {');
    lines.push('        if (std::strcmp(g_SceneAssets[i].assetId, assetId) == 0) {');
    lines.push('            return &g_SceneAssets[i];');
    lines.push('        }');
    lines.push('    }');
    lines.push('    return nullptr;');
    lines.push('}');
    lines.push('');
    lines.push('} // namespace Citro2D');
    lines.push('');

    return lines.join('\n');
  }

  static _generateSceneTimelineHpp() {
    return `#pragma once

#include "screens/SceneData.hpp"
#include <cstdint>

namespace Citro2D {

struct EvaluatedTransform {
    float x;
    float y;
    float width;
    float height;
    float scaleX;
    float scaleY;
    float rotation;
    float opacity;
};

class SceneTimeline {
public:
    explicit SceneTimeline(const SceneDefinition& scene = g_SceneDefinition);

    // Temporal Authority: Frame number is the strict single source of truth
    uint32_t getCurrentFrame() const { return m_currentFrame; }
    uint32_t getDuration() const { return m_scene.durationFrames; }
    uint32_t getFps() const { return m_scene.fps; }
    float frameToSeconds(uint32_t frame) const;
    uint32_t secondsToFrame(float seconds) const;

    // Playback control
    void seek(uint32_t frame);
    void advanceFrame();
    void update(float dt = 1.0f / 60.0f);
    void play();
    void pause();
    void togglePlay();
    bool isPlaying() const { return m_isPlaying; }
    void setLoop(bool loop) { m_isLooping = loop; }
    bool isLooping() const { return m_isLooping; }

    // Pure mathematical evaluation matching TimelineEvaluator.js
    static float evaluateProgress(float t, InterpolationType type);
    static float evaluateTrack(const SceneTrack& track, uint32_t frame, float defaultValue);

    // Node evaluation (local overrides at frame)
    void evaluateNodeLocal(uint32_t nodeIndex, uint32_t frame, EvaluatedTransform& outTransform, bool& outVisible) const;

    // Node evaluation (world transform accumulating parent hierarchy)
    void evaluateNodeWorld(uint32_t nodeIndex, uint32_t frame, EvaluatedTransform& outTransform, bool& outVisible) const;

    // Timeline event queries
    bool hasMarkerAt(uint32_t frame, const char** outName = nullptr, const char** outType = nullptr) const;
    bool hasAudioCueAt(uint32_t frame, const char** outAsset = nullptr, float* outVol = nullptr, uint8_t* outChan = nullptr) const;

private:
    const SceneDefinition& m_scene;
    uint32_t m_currentFrame;
    bool m_isPlaying;
    bool m_isLooping;
    float m_subframeAccumulator;
};

} // namespace Citro2D
`;
  }

  static _generateSceneTimelineCpp() {
    return `#include "screens/SceneTimeline.hpp"
#include <cmath>
#include <cstring>

namespace Citro2D {

SceneTimeline::SceneTimeline(const SceneDefinition& scene)
    : m_scene(scene)
    , m_currentFrame(0)
    , m_isPlaying(false)
    , m_isLooping(true)
    , m_subframeAccumulator(0.0f)
{
}

float SceneTimeline::frameToSeconds(uint32_t frame) const {
    if (m_scene.fps == 0) return 0.0f;
    return static_cast<float>(frame) / static_cast<float>(m_scene.fps);
}

uint32_t SceneTimeline::secondsToFrame(float seconds) const {
    if (seconds <= 0.0f) return 0;
    return static_cast<uint32_t>(std::round(seconds * static_cast<float>(m_scene.fps)));
}

void SceneTimeline::seek(uint32_t frame) {
    if (frame > m_scene.durationFrames) {
        m_currentFrame = m_scene.durationFrames;
    } else {
        m_currentFrame = frame;
    }
}

void SceneTimeline::advanceFrame() {
    if (m_currentFrame + 1 > m_scene.durationFrames) {
        if (m_isLooping) {
            m_currentFrame = 0;
        } else {
            m_currentFrame = m_scene.durationFrames;
            m_isPlaying = false;
        }
    } else {
        m_currentFrame++;
    }
}

void SceneTimeline::update(float dt) {
    if (!m_isPlaying || m_scene.fps == 0) return;

    m_subframeAccumulator += dt;
    const float frameDuration = 1.0f / static_cast<float>(m_scene.fps);

    while (m_subframeAccumulator >= frameDuration) {
        m_subframeAccumulator -= frameDuration;
        advanceFrame();
    }
}

void SceneTimeline::play() {
    m_isPlaying = true;
}

void SceneTimeline::pause() {
    m_isPlaying = false;
}

void SceneTimeline::togglePlay() {
    m_isPlaying = !m_isPlaying;
}

// -------------------------------------------------------------
// PURE MATHEMATICAL INTERPOLATION (Identical to JS Interpolation.js)
// -------------------------------------------------------------
float SceneTimeline::evaluateProgress(float t, InterpolationType type) {
    const float clampedT = t < 0.0f ? 0.0f : (t > 1.0f ? 1.0f : t);

    switch (type) {
        case InterpolationType::Step:
            return clampedT < 1.0f ? 0.0f : 1.0f;

        case InterpolationType::Linear:
            return clampedT;

        case InterpolationType::EaseIn:
            // Quadratic Ease In: t^2
            return clampedT * clampedT;

        case InterpolationType::EaseOut:
            // Quadratic Ease Out: t * (2 - t)
            return clampedT * (2.0f - clampedT);

        case InterpolationType::EaseInOut:
            // Smooth Quadratic Ease In-Out
            return clampedT < 0.5f
                ? 2.0f * clampedT * clampedT
                : -1.0f + (4.0f - 2.0f * clampedT) * clampedT;

        default:
            return clampedT;
    }
}

float SceneTimeline::evaluateTrack(const SceneTrack& track, uint32_t frame, float defaultValue) {
    if (track.keyframeCount == 0 || track.keyframes == nullptr) {
        return defaultValue;
    }

    if (track.keyframeCount == 1) {
        return track.keyframes[0].value;
    }

    // Before or at first keyframe
    if (frame <= track.keyframes[0].frame) {
        return track.keyframes[0].value;
    }

    // After or at last keyframe
    const SceneKeyframe& last = track.keyframes[track.keyframeCount - 1];
    if (frame >= last.frame) {
        return last.value;
    }

    // Binary / Linear interval search
    for (uint16_t i = 0; i < track.keyframeCount - 1; ++i) {
        const SceneKeyframe& k0 = track.keyframes[i];
        const SceneKeyframe& k1 = track.keyframes[i + 1];

        if (frame >= k0.frame && frame <= k1.frame) {
            if (k0.frame == k1.frame) {
                return k0.value;
            }

            const float t = static_cast<float>(frame - k0.frame) / static_cast<float>(k1.frame - k0.frame);
            const float progress = evaluateProgress(t, k0.interpolation);

            if (track.propertyId == PropertyId::Visible) {
                return progress < 0.5f ? k0.value : k1.value;
            }

            return k0.value + (k1.value - k0.value) * progress;
        }
    }

    return last.value;
}

void SceneTimeline::evaluateNodeLocal(uint32_t nodeIndex, uint32_t frame, EvaluatedTransform& outTransform, bool& outVisible) const {
    if (nodeIndex >= m_scene.nodeCount || m_scene.nodes == nullptr) return;

    const SceneNodeData& node = m_scene.nodes[nodeIndex];

    outTransform.x = node.x;
    outTransform.y = node.y;
    outTransform.width = node.width;
    outTransform.height = node.height;
    outTransform.scaleX = node.scaleX;
    outTransform.scaleY = node.scaleY;
    outTransform.rotation = node.rotation;
    outTransform.opacity = node.opacity;
    outVisible = node.visible;

    // Evaluate all active tracks targeting this node
    for (uint16_t t = 0; t < m_scene.trackCount; ++t) {
        const SceneTrack& track = m_scene.tracks[t];
        if (track.nodeHash != node.idHash) continue;
        if (std::strcmp(track.nodeId, node.id) != 0) continue;

        switch (track.propertyId) {
            case PropertyId::X:
                outTransform.x = evaluateTrack(track, frame, outTransform.x);
                break;
            case PropertyId::Y:
                outTransform.y = evaluateTrack(track, frame, outTransform.y);
                break;
            case PropertyId::ScaleX:
                outTransform.scaleX = evaluateTrack(track, frame, outTransform.scaleX);
                break;
            case PropertyId::ScaleY:
                outTransform.scaleY = evaluateTrack(track, frame, outTransform.scaleY);
                break;
            case PropertyId::Rotation:
                outTransform.rotation = evaluateTrack(track, frame, outTransform.rotation);
                break;
            case PropertyId::Opacity:
                outTransform.opacity = evaluateTrack(track, frame, outTransform.opacity);
                if (outTransform.opacity < 0.0f) outTransform.opacity = 0.0f;
                if (outTransform.opacity > 1.0f) outTransform.opacity = 1.0f;
                break;
            case PropertyId::Visible:
                outVisible = evaluateTrack(track, frame, outVisible ? 1.0f : 0.0f) >= 0.5f;
                break;
            default:
                break;
        }
    }
}

void SceneTimeline::evaluateNodeWorld(uint32_t nodeIndex, uint32_t frame, EvaluatedTransform& outTransform, bool& outVisible) const {
    evaluateNodeLocal(nodeIndex, frame, outTransform, outVisible);
    if (nodeIndex >= m_scene.nodeCount || m_scene.nodes == nullptr) return;

    int32_t parentIdx = m_scene.nodes[nodeIndex].parentIndex;
    while (parentIdx >= 0 && parentIdx < static_cast<int32_t>(m_scene.nodeCount)) {
        EvaluatedTransform parentTransform;
        bool parentVisible = true;
        evaluateNodeLocal(static_cast<uint32_t>(parentIdx), frame, parentTransform, parentVisible);

        // Accumulate transforms
        outTransform.x += parentTransform.x;
        outTransform.y += parentTransform.y;
        outTransform.scaleX *= parentTransform.scaleX;
        outTransform.scaleY *= parentTransform.scaleY;
        outTransform.rotation += parentTransform.rotation;
        outTransform.opacity *= parentTransform.opacity;
        outVisible = outVisible && parentVisible;

        parentIdx = m_scene.nodes[parentIdx].parentIndex;
    }
}

bool SceneTimeline::hasMarkerAt(uint32_t frame, const char** outName, const char** outType) const {
    for (uint16_t i = 0; i < m_scene.markerCount; ++i) {
        if (m_scene.markers[i].frame == frame) {
            if (outName) *outName = m_scene.markers[i].name;
            if (outType) *outType = m_scene.markers[i].type;
            return true;
        }
    }
    return false;
}

bool SceneTimeline::hasAudioCueAt(uint32_t frame, const char** outAsset, float* outVol, uint8_t* outChan) const {
    for (uint16_t i = 0; i < m_scene.audioCueCount; ++i) {
        if (m_scene.audioCues[i].frame == frame) {
            if (outAsset) *outAsset = m_scene.audioCues[i].asset;
            if (outVol) *outVol = m_scene.audioCues[i].volume;
            if (outChan) *outChan = m_scene.audioCues[i].channel;
            return true;
        }
    }
    return false;
}

} // namespace Citro2D
`;
  }

  static _generateSceneClassHpp(className, model) {
    return `#pragma once

#include "screens/screen.hpp"
#include "screens/SceneData.hpp"
#include "screens/SceneTimeline.hpp"
#include "screens/SceneAssets.hpp"

class ${className} : public Screen {
public:
    explicit ${className}(const Citro2D::SceneDefinition& def = Citro2D::g_SceneDefinition);
    ~${className}() override = default;

    void init();
    void enter() override;
    void exit() override;
    void handleInput(const InputManager& input) override;
    void update(float dt) override;
    void drawTop(Renderer2D& renderer) override;
    void drawBottom(Renderer2D& renderer) override;

    Citro2D::SceneTimeline& getTimeline() { return m_timeline; }
    const Citro2D::SceneTimeline& getTimeline() const { return m_timeline; }

private:
    void renderScreen(Renderer2D& renderer, Citro2D::ScreenTarget targetScreen);
    void renderNode(Renderer2D& renderer, uint32_t nodeIndex);

    Citro2D::SceneDefinition m_sceneDef;
    Citro2D::SceneTimeline m_timeline;
};
`;
  }

  static _generateSceneClassCpp(className, model) {
    return `#include "screens/${className}.hpp"
#include "gfx/renderer2d.hpp"
#include "core/input_manager.hpp"

${className}::${className}(const Citro2D::SceneDefinition& def)
    : m_sceneDef(def)
    , m_timeline(def)
{
    init();
}

void ${className}::init() {
    m_timeline.seek(0);
}

void ${className}::enter() {
    m_timeline.play();
}

void ${className}::exit() {
    m_timeline.pause();
}

void ${className}::handleInput(const InputManager& input) {
    (void)input;
}

void ${className}::update(float dt) {
    m_timeline.update(dt);
}

void ${className}::drawTop(Renderer2D& renderer) {
    renderer.clear(m_sceneDef.topBgColor);
    renderScreen(renderer, Citro2D::ScreenTarget::Top);
}

void ${className}::drawBottom(Renderer2D& renderer) {
    renderer.clear(m_sceneDef.bottomBgColor);
    renderScreen(renderer, Citro2D::ScreenTarget::Bottom);
}

void ${className}::renderScreen(Renderer2D& renderer, Citro2D::ScreenTarget targetScreen) {
    for (uint16_t i = 0; i < m_sceneDef.nodeCount; ++i) {
        const auto& node = m_sceneDef.nodes[i];
        if (node.screen == targetScreen || node.screen == Citro2D::ScreenTarget::Global) {
            renderNode(renderer, i);
        }
    }
}

void ${className}::renderNode(Renderer2D& renderer, uint32_t nodeIndex) {
    if (nodeIndex >= m_sceneDef.nodeCount) return;
    const auto& node = m_sceneDef.nodes[nodeIndex];

    Citro2D::EvaluatedTransform worldTransform;
    bool isVisible = false;
    m_timeline.evaluateNodeWorld(nodeIndex, m_timeline.getCurrentFrame(), worldTransform, isVisible);

    if (!isVisible || worldTransform.opacity <= 0.001f) {
        return;
    }

    switch (node.type) {
        case Citro2D::NodeType::Image:
        case Citro2D::NodeType::PokemonSprite: {
            if (node.asset && node.asset[0] != '\\0') {
                renderer.drawImage(
                    node.asset,
                    worldTransform.x,
                    worldTransform.y,
                    worldTransform.width * worldTransform.scaleX,
                    worldTransform.height * worldTransform.scaleY,
                    worldTransform.rotation,
                    worldTransform.opacity,
                    node.flipX,
                    node.flipY,
                    node.tintColor
                );
            }
            break;
        }
        case Citro2D::NodeType::Panel: {
            renderer.drawRect(
                worldTransform.x,
                worldTransform.y,
                worldTransform.width * worldTransform.scaleX,
                worldTransform.height * worldTransform.scaleY,
                node.tintColor,
                worldTransform.opacity
            );
            break;
        }
        case Citro2D::NodeType::Text: {
            if (node.text) {
                renderer.drawText(
                    node.text,
                    worldTransform.x,
                    worldTransform.y,
                    node.tintColor,
                    worldTransform.opacity
                );
            }
            break;
        }
        default:
            break;
    }
}
`;
  }

  // -------------------------------------------------------------
  // CROSS-EVALUATION PARITY VERIFICATION (Simulates C++ in JS)
  // -------------------------------------------------------------
  /**
   * Evaluates the exported data model using the exact C++ evaluation algorithms.
   * Enables cross-verification of mathematical parity with TimelineEvaluator in automated tests.
   * 
   * @param {Object} exportModel 
   * @param {number} frame 
   * @returns {Map<string, Object>} Map of nodeId -> evaluated state overrides
   */
  static evaluateExportedData(exportModel, frame) {
    const evaluatedMap = new Map();
    const intFrame = Math.max(0, Math.round(frame));

    // Progress evaluation identical to C++
    const evalProgress = (t, interpType) => {
      const clampedT = Math.max(0, Math.min(1, t));
      switch (interpType) {
        case 0: // Step
          return clampedT < 1.0 ? 0.0 : 1.0;
        case 1: // Linear
          return clampedT;
        case 2: // EaseIn
          return clampedT * clampedT;
        case 3: // EaseOut
          return clampedT * (2.0 - clampedT);
        case 4: // EaseInOut
          return clampedT < 0.5
            ? 2.0 * clampedT * clampedT
            : -1.0 + (4.0 - 2.0 * clampedT) * clampedT;
        default:
          return clampedT;
      }
    };

    // Track evaluation identical to C++ evaluateTrack
    const evalTrack = (track) => {
      if (!track.keyframes || track.keyframes.length === 0) return null;
      if (track.keyframes.length === 1) return track.keyframes[0].value;
      if (intFrame <= track.keyframes[0].frame) return track.keyframes[0].value;
      const last = track.keyframes[track.keyframes.length - 1];
      if (intFrame >= last.frame) return last.value;

      for (let i = 0; i < track.keyframes.length - 1; i++) {
        const k0 = track.keyframes[i];
        const k1 = track.keyframes[i + 1];
        if (intFrame >= k0.frame && intFrame <= k1.frame) {
          if (k0.frame === k1.frame) return k0.value;
          const t = (intFrame - k0.frame) / (k1.frame - k0.frame);
          const progress = evalProgress(t, k0.interpolationId);
          if (track.propertyId === 7) { // Visible
            return progress < 0.5 ? k0.value : k1.value;
          }
          return k0.value + (k1.value - k0.value) * progress;
        }
      }
      return last.value;
    };

    // Evaluate each track
    for (const track of exportModel.tracks) {
      if (track.muted) continue;
      const evaluatedVal = evalTrack(track);
      if (evaluatedVal === null || evaluatedVal === undefined) continue;

      if (!evaluatedMap.has(track.targetNodeId)) {
        evaluatedMap.set(track.targetNodeId, {
          transform: {},
          visible: undefined,
          opacity: undefined
        });
      }

      const nodeEval = evaluatedMap.get(track.targetNodeId);
      switch (track.propertyId) {
        case 1: nodeEval.transform.x = evaluatedVal; break;
        case 2: nodeEval.transform.y = evaluatedVal; break;
        case 3: nodeEval.transform.scaleX = evaluatedVal; break;
        case 4: nodeEval.transform.scaleY = evaluatedVal; break;
        case 5: nodeEval.transform.rotation = evaluatedVal; break;
        case 6:
          nodeEval.opacity = Math.max(0, Math.min(1, evaluatedVal));
          nodeEval.transform.opacity = nodeEval.opacity;
          break;
        case 7:
          nodeEval.visible = evaluatedVal >= 0.5;
          break;
        default:
          break;
      }
    }

    return evaluatedMap;
  }
}
