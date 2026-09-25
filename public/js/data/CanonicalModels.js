/**
 * CanonicalModels - Neutral, declarative domain models for the 3DS Game Creation Studio.
 * Decouples PokéRogue's internal TypeScript implementation from the Studio and 3DS runtime.
 */

export class SourceMetadata {
  constructor(data = {}) {
    this.source = data?.source || 'pokerogue';
    this.sourcePath = data?.sourcePath || 'src/data';
    this.sourceRevision = data?.sourceRevision || 'main';
    this.importedAt = data?.importedAt || 'CANONICAL_IMPORT';
    this.license = data?.license || 'AGPL-v3.0-only';
  }
}

function toTitleCase(str) {
  if (!str) return '';
  const s = String(str).trim();
  if (s.toUpperCase() === 'NONE') return 'NONE';
  return s.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}


export class SpeciesDefinition {
  constructor(data = {}) {
    this.id = data.id || 'unknown';
    this.speciesId = Number(data.speciesId || data.nationalDexId || 0);
    this.nationalDexId = this.speciesId;
    this.name = data.name || this.id;
    this.generation = Number(data.generation || 1);
    this.type1 = toTitleCase(data.type1 || (data.types && data.types[0]) || 'Normal');
    this.type2 = data.type2 && data.type2.toUpperCase() !== 'NONE' ? toTitleCase(data.type2) : ((data.types && data.types[1]) ? toTitleCase(data.types[1]) : 'NONE');
    this.types = [this.type1];
    if (this.type2 && this.type2 !== 'NONE') {
      this.types.push(this.type2);
    }
    this.baseStats = {
      hp: Number(data.baseStats?.hp ?? 40),

      atk: Number(data.baseStats?.atk ?? 40),
      def: Number(data.baseStats?.def ?? 40),
      spatk: Number(data.baseStats?.spatk ?? 40),
      spdef: Number(data.baseStats?.spdef ?? 40),
      spd: Number(data.baseStats?.spd ?? 40)
    };
    const ab1 = data.abilities?.primary || data.abilities?.ability1 || data.ability1 || 'NONE';
    const ab2 = data.abilities?.secondary || data.abilities?.ability2 || data.ability2 || null;
    const abh = data.abilities?.hidden || data.abilityHidden || null;
    const abp = data.abilities?.passive || data.passive || null;
    this.abilities = {
      primary: ab1,
      secondary: ab2,
      hidden: abh,
      passive: abp,
      ability1: ab1,
      ability2: ab2 || 'NONE'
    };
    this.starterCost = Number(data.starterCost ?? 3);
    this.eggTier = data.eggTier || 'COMMON';
    const rawMoves = Array.isArray(data.learnableMoves)
      ? data.learnableMoves
      : (Array.isArray(data.levelMoves) ? data.levelMoves : []);
    this.learnableMoves = rawMoves.map(m => {
      if (typeof m === 'string') {
        return { id: m, move: m, level: 1, name: toTitleCase(m.replace(/_/g, ' ')) };
      }
      const moveKey = m.id || m.move || 'unknown';
      return {
        ...m,
        id: moveKey,
        move: moveKey,
        level: m.level || 1,
        name: m.name || toTitleCase(moveKey.replace(/_/g, ' '))
      };
    });
    this.levelMoves = this.learnableMoves;

    this.eggMoves = Array.isArray(data.eggMoves) ? [...data.eggMoves] : [];
    this.forms = Array.isArray(data.forms) ? [...data.forms] : ['BASE'];
    this.sprites = {
      atlasPath: data.sprites?.atlasPath || `romfs/sprites/pokemon/${this.speciesId}.t3x`,
      icon: data.sprites?.icon || `romfs/sprites/icons/${this.speciesId}.png`,
      atlas: data.sprite?.atlas || 'pokemon_front',
      frame: data.sprite?.frame || `${this.speciesId}`,
      hasFemale: Boolean(data.sprite?.hasFemale),
      hasShiny: Boolean(data.sprite?.hasShiny ?? true),
      hasVariants: Boolean(data.sprite?.hasVariants)
    };
    this.sprite = this.sprites;
    this.source = new SourceMetadata(data.metadata || data.source);
    this.metadata = this.source;
    this.schemaVersion = 1;
  }
}

export class MoveDefinition {
  constructor(data = {}) {
    this.id = data.id || 'unknown';
    this.moveId = Number(data.moveId || 0);
    this.name = data.name || this.id;
    this.type = (data.type || 'NORMAL').toUpperCase();
    this.category = data.category || 'Physical';
    this.power = Number(data.power ?? 0);
    this.accuracy = Number(data.accuracy ?? 100);
    this.pp = Number(data.pp ?? 20);
    this.maxPp = Number(data.maxPp ?? Math.floor(this.pp * 1.6));
    this.priority = Number(data.priority ?? 0);
    this.target = data.target || 'Selected';
    this.description = data.description || '';
    this.flags = {
      contact: Boolean(data.flags?.contact),
      protectable: Boolean(data.flags?.protectable ?? true),
      sound: Boolean(data.flags?.sound),
      bullet: Boolean(data.flags?.bullet)
    };
    this.secondaryEffects = Array.isArray(data.secondaryEffects) ? [...data.secondaryEffects] : [];
    this.source = new SourceMetadata(data.metadata || data.source);
    this.metadata = this.source;
    this.schemaVersion = 1;
  }
}

export class AbilityDefinition {
  constructor(data = {}) {
    this.id = data.id || 'unknown';
    this.name = data.name || this.id;
    this.description = data.description || '';
    this.trigger = data.trigger || 'PASSIVE';
    this.attributes = Array.isArray(data.attributes) ? [...data.attributes] : [];
    this.conditions = Array.isArray(data.conditions) ? [...data.conditions] : [];
    this.effects = Array.isArray(data.effects) ? [...data.effects] : [];
    this.source = new SourceMetadata(data.metadata || data.source);
    this.metadata = this.source;
    this.schemaVersion = 1;
  }
}

export class ItemDefinition {
  constructor(data = {}) {
    this.id = data.id || 'unknown';
    this.name = data.name || this.id;
    this.category = data.category || 'GENERAL';
    this.tier = data.tier || 'COMMON';
    this.price = Number(data.price ?? 100);
    this.description = data.description || '';
    this.source = new SourceMetadata(data.metadata || data.source);
    this.metadata = this.source;
    this.schemaVersion = 1;
  }
}
