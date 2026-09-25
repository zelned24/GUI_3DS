import { SpeciesDefinition, MoveDefinition, AbilityDefinition, ItemDefinition } from './CanonicalModels.js';
import { FALLBACK_VERTICAL_SLICE_FIXTURE } from '../fixtures/fallbackVerticalSlice.js';

function toTitleCase(str) {
  if (!str) return '';
  const s = String(str).trim();
  if (s.toUpperCase() === 'NONE') return 'NONE';
  return s.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}



/**
 * PokerogueAdapter - Translates, normalizes, and decouples PokéRogue source data
 * into the Studio Canonical Data Model while tracking licensing, provenance, and dependencies.
 */
export class PokerogueAdapter {
  constructor() {
    this.sourceRevision = 'main';
    this.sourceRepo = 'https://github.com/pagefaultgames/pokerogue';
    this.license = 'AGPL-v3.0-only';
  }

  /**
   * Generates a license and provenance report for imported data.
   */
  getProvenanceReport() {
    return {
      sourceRepository: this.sourceRepo,
      sourceRevision: this.sourceRevision,
      license: this.license,
      notes: 'All core game data adapted into neutral canonical models for Nintendo 3DS Citro2D authoring.',
      disclaimer: 'PokéRogue is licensed under AGPL-v3.0-only. Pokémon and Nintendo trademarks belong to Nintendo/Creatures Inc./GAME FREAK inc.'
    };
  }

  /**
   * Normalizes raw PokéRogue species data to Canonical SpeciesDefinition.
   */
  normalizeSpecies(raw) {
    const t1 = toTitleCase(raw.type1 || 'Normal');
    const t2 = raw.type2 && raw.type2.toUpperCase() !== 'NONE' ? toTitleCase(raw.type2) : 'NONE';

    const ab1 = toTitleCase(raw.abilities?.primary || raw.abilities?.ability1 || raw.ability1 || 'None');
    const ab2 = raw.abilities?.ability2 || raw.ability2 ? toTitleCase(raw.abilities?.ability2 || raw.ability2) : null;
    const abh = raw.abilities?.hidden || raw.abilityHidden ? toTitleCase(raw.abilities?.hidden || raw.abilityHidden) : null;
    const abp = raw.abilities?.passive || raw.passive ? toTitleCase(raw.abilities?.passive || raw.passive) : null;

    return new SpeciesDefinition({
      id: String(raw.id || raw.name || '').toLowerCase().replace(/\s+/g, '_'),
      speciesId: Number(raw.speciesId || 0),
      name: raw.name || 'Unknown',
      generation: Number(raw.generation || 1),
      type1: t1,
      type2: t2,
      baseStats: {
        hp: Number(raw.stats?.hp || raw.baseHp || 40),
        atk: Number(raw.stats?.atk || raw.baseAtk || 40),
        def: Number(raw.stats?.def || raw.baseDef || 40),
        spatk: Number(raw.stats?.spatk || raw.baseSpatk || 40),
        spdef: Number(raw.stats?.spdef || raw.baseSpdef || 40),
        spd: Number(raw.stats?.spd || raw.baseSpd || 40)
      },
      abilities: {
        primary: ab1,
        secondary: ab2,
        hidden: abh,
        passive: abp,
        ability1: ab1,
        ability2: ab2 || 'NONE'
      },
      starterCost: Number(raw.starterCost ?? 3),
      eggTier: raw.eggTier || 'COMMON',
      levelMoves: Array.isArray(raw.levelMoves) ? raw.levelMoves : [],
      eggMoves: Array.isArray(raw.eggMoves) ? raw.eggMoves : [],
      forms: Array.isArray(raw.forms) ? raw.forms : ['BASE'],
      sprites: {
        atlasPath: `romfs/sprites/pokemon/${raw.speciesId || 0}_${String(raw.id || raw.name || '').toLowerCase()}.t3x`,
        icon: `romfs/sprites/icons/${raw.speciesId || 0}_${String(raw.id || raw.name || '').toLowerCase()}.png`,
        atlas: 'pokemon_front',
        frame: `${raw.speciesId || 0}`,
        hasShiny: true,
        hasFemale: Boolean(raw.hasFemale)
      },

      source: {
        source: 'pokerogue',
        sourcePath: `src/data/pokemon-species.ts`,
        sourceRevision: this.sourceRevision,
        license: this.license
      }
    });
  }

  /**
   * Normalizes raw move data to Canonical MoveDefinition.
   */
  normalizeMove(raw) {
    return new MoveDefinition({
      id: String(raw.id || raw.name || '').toLowerCase().replace(/\s+/g, '_'),
      moveId: Number(raw.moveId || 0),
      name: raw.name || 'Unknown Move',
      type: toTitleCase(raw.type || 'Normal'),
      category: toTitleCase(raw.category || 'Physical'),
      power: Number(raw.power ?? 0),
      accuracy: Number(raw.accuracy ?? 100),
      pp: Number(raw.pp ?? 20),
      priority: Number(raw.priority ?? 0),
      target: raw.target || 'ENEMY',
      flags: {
        contact: Boolean(raw.flags?.contact),
        protectable: Boolean(raw.flags?.protectable ?? true)
      },
      secondaryEffects: Array.isArray(raw.secondaryEffects) ? raw.secondaryEffects : [],
      source: {
        source: 'pokerogue',
        sourcePath: 'src/data/moves.ts',
        sourceRevision: this.sourceRevision,
        license: this.license
      }
    });
  }

  /**
   * Normalizes raw ability data to Canonical AbilityDefinition.
   */
  normalizeAbility(raw) {
    return new AbilityDefinition({
      id: String(raw.id || raw.name || '').toLowerCase().replace(/\s+/g, '_'),
      name: raw.name || 'Unknown Ability',
      description: raw.description || '',
      trigger: raw.trigger || 'PASSIVE',
      conditions: Array.isArray(raw.conditions) ? raw.conditions : [],
      attributes: Array.isArray(raw.attributes) ? raw.attributes : [],
      effects: Array.isArray(raw.effects) ? raw.effects : [],
      source: {
        source: 'pokerogue',
        sourcePath: 'src/data/ability.ts',
        sourceRevision: this.sourceRevision,
        license: this.license
      }
    });
  }

  /**
   * Resolves 3DS texture atlas reference from species ID, form, shiny, and gender.
   */
  resolveSprite(speciesId, form = 'BASE', shiny = false, female = false, facing = 'front') {
    const formPrefix = form && form !== 'BASE' ? `_${form.toLowerCase()}` : '';
    const shinyPrefix = shiny ? '_shiny' : '';
    const femalePrefix = female ? '_f' : '';
    const key = `${speciesId}${formPrefix}${shinyPrefix}${femalePrefix}_${facing}`;

    return {
      speciesId,
      form,
      shiny,
      female,
      facing,
      spriteKey: key,
      atlasPath: `romfs/sprites/pokemon/${speciesId}.t3x`,
      frameIndex: 0,
      iconPath: `romfs/sprites/icons/${speciesId}.png`,
      targetFormat: 'citro2d / t3x texture sheet'
    };
  }

  /**
   * Builds the dependency graph for a Pokémon species.
   */
  buildDependencyGraph(species, allMoves = [], allAbilities = []) {
    const movesList = (species.levelMoves || []).map(m => {
      const raw = typeof m === 'string' ? m : (m.name || m.move || m.id || '');
      return toTitleCase(raw.replace(/_/g, ' '));
    });
    const eggMovesList = (species.eggMoves || []).map(m => {
      const raw = typeof m === 'string' ? m : (m.name || m.move || m.id || '');
      return toTitleCase(raw.replace(/_/g, ' '));
    });
    const neededMoves = Array.from(new Set([...movesList, ...eggMovesList]));

    const primaryAbility = species.abilities.primary || species.abilities.ability1 || 'None';
    const neededAbilities = [
      species.abilities.primary,
      species.abilities.secondary,
      species.abilities.hidden,
      species.abilities.passive
    ].filter(a => a && a !== 'NONE' && a !== 'None');

    return {
      species: species.name || species.id,
      speciesId: species.speciesId,
      moves: neededMoves,
      abilities: {
        primary: primaryAbility,
        all: neededAbilities
      },
      forms: species.forms,
      sprites: {
        atlasPath: species.sprites?.atlasPath || `romfs/sprites/pokemon/${species.speciesId}.t3x`,
        icon: species.sprites?.icon || `romfs/sprites/icons/${species.speciesId}.png`
      }
    };
  }

  /**
   * Provides the fallback test fixture strictly for offline / test fixtures.
   * Production data MUST be ingested via PokerogueImporter directly from upstream.
   */
  getFallbackTestFixture() {
    const species = FALLBACK_VERTICAL_SLICE_FIXTURE.species.map(s => this.normalizeSpecies(s));
    const moves = FALLBACK_VERTICAL_SLICE_FIXTURE.moves.map(m => this.normalizeMove(m));
    const abilities = FALLBACK_VERTICAL_SLICE_FIXTURE.abilities.map(a => this.normalizeAbility(a));
    return { species, moves, abilities };
  }

  /**
   * @deprecated Strictly for test fixtures. Do NOT use as production data source.
   */
  getVerticalSliceDataset() {
    return this.getFallbackTestFixture();
  }
}
