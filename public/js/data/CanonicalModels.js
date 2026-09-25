/**
 * CanonicalModels.js
 * Neutral, declarative domain models for the 3DS Game Creation Studio.
 * Decouples PokéRogue's internal TypeScript implementation from the Studio and 3DS runtime.
 * Implements Lossless-First Import: preserves raw source data alongside interpreted canonical structures.
 */

export class SourceMetadata {
  constructor(data = {}) {
    this.repository = data.repository || data.source || 'https://github.com/pagefaultgames/pokerogue';
    this.source = data.source || 'pokerogue';
    this.sourcePath = data.sourcePath || data.path || 'src/data';
    this.sourceRevision = data.sourceRevision || data.revision || '8555c08c823b856cbec4eb99ca84ea52a955836d';
    this.importedAt = data.importedAt || new Date().toISOString();
    this.license = data.license || data.licenseRef || 'AGPL-v3.0-only';
    this.fileHash = data.fileHash || null;
  }
}

export function toTitleCase(str) {
  if (!str) return '';
  const s = String(str).trim();
  if (s.toUpperCase() === 'NONE') return 'NONE';
  return s.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Asset Definitions (Sprite, Atlas, Animation, Audio, Font)
 */
export class AssetDefinition {
  constructor(data = {}) {
    this.id = data.id || 'unknown_asset';
    this.category = data.category || 'IMAGE'; // IMAGE, AUDIO, FONT, ATLAS, ANIMATION, METADATA
    this.sourcePath = data.sourcePath || '';
    this.targetRomFSPath = data.targetRomFSPath || '';
    this.extension = data.extension || 'png';
    this.mimeType = data.mimeType || 'image/png';
    this.sizeBytes = Number(data.sizeBytes || 0);
    this.dimensions = data.dimensions || { width: 0, height: 0 };
    this.channels = Number(data.channels || 4); // RGBA
    this.hasAlpha = Boolean(data.hasAlpha ?? true);
    this.licenseRef = data.licenseRef || 'LicenseRef-FAIR-USE';
    this.rawMetadata = data.rawMetadata || {};
  }
}

export class SpriteDefinition {
  constructor(data = {}) {
    this.id = data.id || '';
    this.source = data.source || '';
    this.atlas = data.atlas || null; // AtlasDefinition or key
    this.frame = data.frame || '0';
    this.width = Number(data.width || 0);
    this.height = Number(data.height || 0);
    this.pivot = data.pivot || { x: 0.5, y: 0.5 };
    this.variant = Number(data.variant || 0);
    this.shiny = Boolean(data.shiny);
    this.female = Boolean(data.female);
    this.facing = data.facing || 'front'; // 'front' | 'back'
    this.animation = data.animation || null;
    this.missing = Boolean(data.missing);
  }
}

export class AtlasDefinition {
  constructor(data = {}) {
    this.id = data.id || '';
    this.imagePath = data.imagePath || '';
    this.format = data.format || 'RGBA8888';
    this.width = Number(data.width || 0);
    this.height = Number(data.height || 0);
    this.scale = Number(data.scale || 1);
    this.frames = data.frames || []; // Array of { filename, frame: {x,y,w,h}, sourceSize, spriteSourceSize }
  }
}

export class AnimationAssetDefinition {
  constructor(data = {}) {
    this.id = data.id || '';
    this.frames = Array.isArray(data.frames) ? data.frames : [];
    this.frameRate = Number(data.frameRate || 12);
    this.durationMs = Number(data.durationMs || 500);
    this.loop = Boolean(data.loop ?? true);
    this.soundCue = data.soundCue || null;
  }
}

export class AudioDefinition {
  constructor(data = {}) {
    this.id = data.id || '';
    this.category = data.category || 'SE'; // CRY, SE, BGM, UI
    this.sourcePath = data.sourcePath || '';
    this.targetRomFSPath = data.targetRomFSPath || '';
    this.durationSeconds = Number(data.durationSeconds || 0);
    this.loopPoints = data.loopPoints || null; // { start, end }
    this.format = data.format || 'wav';
    this.target3DSFormat = 'CWAV / BCSAR';
  }
}

export class FontDefinition {
  constructor(data = {}) {
    this.id = data.id || '';
    this.sourcePath = data.sourcePath || '';
    this.targetRomFSPath = data.targetRomFSPath || '';
    this.type = data.type || 'TTF'; // TTF, BITMAP
    this.glyphDimensions = data.glyphDimensions || { width: 8, height: 8 };
  }
}

/**
 * Game Content Definitions
 */
export class FormDefinition {
  constructor(data = {}) {
    this.formKey = data.formKey || 'BASE';
    this.formName = data.formName || 'Normal';
    this.type1 = toTitleCase(data.type1 || 'Normal');
    this.type2 = data.type2 ? toTitleCase(data.type2) : 'NONE';
    this.baseStats = data.baseStats || null;
    this.abilities = data.abilities || null;
    this.height = Number(data.height || 0);
    this.weight = Number(data.weight || 0);
    this.trigger = data.trigger || null; // e.g. FormChangeItem.MAX_MUSHROOMS
    this.sprite = data.sprite || null;
  }
}

export class SpeciesDefinition {
  constructor(data = {}) {
    this.id = String(data.id || '').toLowerCase().replace(/\s+/g, '_');
    this.speciesId = Number(data.speciesId || data.nationalDexId || 0);
    this.nationalDexId = this.speciesId;
    this.name = data.name || toTitleCase(this.id);
    this.category = data.category || 'Pokémon';
    this.generation = Number(data.generation || 1);

    // Types
    this.type1 = toTitleCase(data.type1 || (data.types && data.types[0]) || 'Normal');
    this.type2 = data.type2 && data.type2.toUpperCase() !== 'NONE' 
      ? toTitleCase(data.type2) 
      : ((data.types && data.types[1]) ? toTitleCase(data.types[1]) : 'NONE');
    this.types = [this.type1];
    if (this.type2 && this.type2 !== 'NONE') {
      this.types.push(this.type2);
    }

    // Physical
    this.height = Number(data.height || 0.5);
    this.weight = Number(data.weight || 10.0);

    // Base Stats
    this.baseStats = {
      hp: Number(data.baseStats?.hp ?? data.baseHp ?? 40),
      atk: Number(data.baseStats?.atk ?? data.baseAtk ?? 40),
      def: Number(data.baseStats?.def ?? data.baseDef ?? 40),
      spatk: Number(data.baseStats?.spatk ?? data.baseSpatk ?? 40),
      spdef: Number(data.baseStats?.spdef ?? data.baseSpdef ?? 40),
      spd: Number(data.baseStats?.spd ?? data.baseSpd ?? 40)
    };
    this.baseTotal = Object.values(this.baseStats).reduce((a, b) => a + b, 0);

    // Abilities & Passives
    const ab1 = toTitleCase(data.abilities?.primary || data.abilities?.ability1 || data.ability1 || 'None');
    const ab2 = data.abilities?.secondary || data.abilities?.ability2 || data.ability2 
      ? toTitleCase(data.abilities?.secondary || data.abilities?.ability2 || data.ability2) : null;
    const abh = data.abilities?.hidden || data.abilityHidden 
      ? toTitleCase(data.abilities?.hidden || data.abilityHidden) : null;
    const abp = data.abilities?.passive || data.passive 
      ? toTitleCase(data.abilities?.passive || data.passive) : null;

    this.abilities = {
      primary: ab1,
      secondary: ab2,
      hidden: abh,
      passive: abp,
      ability1: ab1,
      ability2: ab2 || 'NONE'
    };

    // Passives Map (PokéRogue allows unlocking multiple passives)
    this.passives = data.passives || { 0: abp || 'None' };

    // Rogue mechanics
    this.starterCost = Number(data.starterCost ?? 3);
    this.eggTier = data.eggTier || 'COMMON';
    this.catchRate = Number(data.catchRate ?? 190);
    this.baseFriendship = Number(data.baseFriendship ?? 50);
    this.baseExp = Number(data.baseExp ?? 100);
    this.growthRate = data.growthRate || 'MEDIUM_FAST';
    this.malePercent = data.malePercent !== undefined ? data.malePercent : 50;
    this.genderDiffs = Boolean(data.genderDiffs);
    this.canChangeForm = Boolean(data.canChangeForm);

    // Move pools
    const rawMoves = Array.isArray(data.learnableMoves)
      ? data.learnableMoves
      : (Array.isArray(data.levelMoves) ? data.levelMoves : []);
    this.learnableMoves = rawMoves.map(m => {
      if (Array.isArray(m)) {
        return { level: Number(m[0]), move: String(m[1]).toLowerCase(), id: String(m[1]).toLowerCase(), name: toTitleCase(String(m[1])) };
      }
      if (typeof m === 'string') {
        return { level: 1, move: m.toLowerCase(), id: m.toLowerCase(), name: toTitleCase(m) };
      }
      const moveKey = String(m.id || m.move || '').toLowerCase();
      return {
        level: Number(m.level || 1),
        move: moveKey,
        id: moveKey,
        name: m.name || toTitleCase(moveKey)
      };
    });
    this.levelMoves = this.learnableMoves;

    this.eggMoves = (data.eggMoves || []).map(m => String(m).toLowerCase());
    this.tms = (data.tms || []).map(m => String(m).toLowerCase());

    // Forms
    this.forms = Array.isArray(data.forms) ? data.forms : ['BASE'];
    this.formChanges = Array.isArray(data.formChanges) ? data.formChanges : [];

    // Sprites & Assets
    this.sprites = {
      atlasPath: data.sprites?.atlasPath || `images/pokemon/${this.speciesId}.json`,
      icon: data.sprites?.icon || `images/pokemon/icons/1/${this.speciesId}.png`,
      frontSprite: data.sprites?.frontSprite || `images/pokemon/${this.speciesId}.png`,
      backSprite: data.sprites?.backSprite || `images/pokemon/back/${this.speciesId}.png`,
      shinySprite: data.sprites?.shinySprite || `images/pokemon/shiny/${this.speciesId}.png`,
      femaleSprite: data.sprites?.femaleSprite || (this.genderDiffs ? `images/pokemon/female/${this.speciesId}.png` : null),
      hasShiny: true,
      hasFemale: this.genderDiffs,
      hasVariants: Boolean(data.hasVariants)
    };
    this.sprite = this.sprites;

    // Provenance & Lossless Preservation
    this.source = new SourceMetadata(data.metadata || data.source);
    this.metadata = this.source;
    this.schemaVersion = 2;

    // Lossless storage: retain every unrecognized or raw property
    this.preserveRawData = data.preserveRawData || data.rawData || {};
    this.unsupportedFeatures = Array.isArray(data.unsupportedFeatures) ? [...data.unsupportedFeatures] : [];
  }
}

export class MoveDefinition {
  constructor(data = {}) {
    this.id = String(data.id || '').toLowerCase().replace(/\s+/g, '_');
    this.moveId = Number(data.moveId || 0);
    this.name = data.name || toTitleCase(this.id);
    this.type = (data.type || 'Normal').toUpperCase();
    this.category = toTitleCase(data.category || 'Physical'); // Physical, Special, Status
    this.power = Number(data.power ?? 0);
    this.accuracy = data.accuracy !== undefined ? Number(data.accuracy) : 100;
    this.pp = Number(data.pp ?? 20);
    this.maxPp = Number(data.maxPp ?? Math.floor(this.pp * 1.6));
    this.priority = Number(data.priority ?? 0);
    this.target = data.target || 'Selected'; // SELECTED, ALL_NEAR_ENEMIES, USER, etc.
    this.description = data.description || '';

    // Flags
    this.flags = {
      contact: Boolean(data.flags?.contact),
      protectable: Boolean(data.flags?.protectable ?? true),
      sound: Boolean(data.flags?.sound),
      bullet: Boolean(data.flags?.bullet),
      slicing: Boolean(data.flags?.slicing),
      wind: Boolean(data.flags?.wind),
      pulse: Boolean(data.flags?.pulse),
      healing: Boolean(data.flags?.healing)
    };

    // Effects & Attributes
    this.effects = Array.isArray(data.effects) ? [...data.effects] : [];
    this.secondaryEffects = Array.isArray(data.secondaryEffects) ? [...data.secondaryEffects] : [];
    this.conditions = Array.isArray(data.conditions) ? [...data.conditions] : [];

    // Audio & Animation cues
    this.animation = data.animation || `anim_${this.id}`;
    this.soundEffect = data.soundEffect || `se_${this.id}`;

    // Provenance & Lossless
    this.source = new SourceMetadata(data.metadata || data.source);
    this.metadata = this.source;
    this.schemaVersion = 2;
    this.preserveRawData = data.preserveRawData || data.rawData || {};
    this.unsupportedFeatures = Array.isArray(data.unsupportedFeatures) ? [...data.unsupportedFeatures] : [];
  }
}

export class AbilityDefinition {
  constructor(data = {}) {
    this.id = String(data.id || '').toLowerCase().replace(/\s+/g, '_');
    this.abilityId = Number(data.abilityId || 0);
    this.name = data.name || toTitleCase(this.id);
    this.description = data.description || '';
    this.trigger = data.trigger || 'PASSIVE'; // ON_DAMAGE_RECEIVED, ON_DAMAGE_PREVENTION, etc.
    this.attributes = Array.isArray(data.attributes) ? [...data.attributes] : [];
    this.conditions = Array.isArray(data.conditions) ? [...data.conditions] : [];
    this.effects = Array.isArray(data.effects) ? [...data.effects] : [];
    this.bypassFaint = Boolean(data.bypassFaint);
    this.ignorable = Boolean(data.ignorable ?? true);

    // Provenance & Lossless
    this.source = new SourceMetadata(data.metadata || data.source);
    this.metadata = this.source;
    this.schemaVersion = 2;
    this.preserveRawData = data.preserveRawData || data.rawData || {};
    this.unsupportedFeatures = Array.isArray(data.unsupportedFeatures) ? [...data.unsupportedFeatures] : [];
  }
}

export class ItemDefinition {
  constructor(data = {}) {
    this.id = String(data.id || '').toLowerCase().replace(/\s+/g, '_');
    this.name = data.name || toTitleCase(this.id);
    this.category = data.category || 'MODIFIER';
    this.tier = data.tier || 'COMMON'; // COMMON, GREAT, ULTRA, ROGUE, MASTER
    this.price = Number(data.price ?? 100);
    this.description = data.description || '';
    this.stackable = Boolean(data.stackable ?? true);
    this.maxStacks = Number(data.maxStacks || 99);

    this.source = new SourceMetadata(data.metadata || data.source);
    this.metadata = this.source;
    this.schemaVersion = 2;
    this.preserveRawData = data.preserveRawData || data.rawData || {};
    this.unsupportedFeatures = Array.isArray(data.unsupportedFeatures) ? [...data.unsupportedFeatures] : [];
  }
}

export class NatureDefinition {
  constructor(data = {}) {
    this.id = String(data.id || data.name || 'Hardy').toLowerCase();
    this.name = data.name || 'Hardy';
    this.plusStat = data.plusStat || null;   // 'atk', 'def', 'spatk', 'spdef', 'spd'
    this.minusStat = data.minusStat || null;
  }

  getMultiplier(stat) {
    if (!this.plusStat || !this.minusStat || this.plusStat === this.minusStat) return 1.0;
    if (stat === this.plusStat) return 1.1;
    if (stat === this.minusStat) return 0.9;
    return 1.0;
  }
}

export class TypeDefinition {
  constructor(data = {}) {
    this.name = (data.name || 'Normal').toUpperCase();
    this.effectiveness = data.effectiveness || {}; // DefendingType -> multiplier
    this.colorHex = data.colorHex || '#A8A878';
  }
}
