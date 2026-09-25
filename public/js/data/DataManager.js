import { PokerogueAdapter } from './PokerogueAdapter.js';
import { PokerogueLocaleImporter } from './PokerogueLocaleImporter.js';

/**
 * DataManager - Central database and query engine for all game content
 * (Species, Moves, Abilities, Items, Type Chart, Enums, Locales, Dependency Graphs).
 */
export class DataManager {
  constructor() {
    this.adapter = new PokerogueAdapter();
    this.species = new Map(); // id -> SpeciesDefinition
    this.moves = new Map();   // id -> MoveDefinition
    this.abilities = new Map(); // id -> AbilityDefinition
    this.items = new Map();   // id -> ItemDefinition
    this.enums = new Map();   // enumName -> PokerogueEnumCatalog
    this.locales = new Map(); // `${locale}:${namespace}` -> PokerogueLocalePackage
    this.currentLocale = 'en';
    this.listeners = [];

    // Official Gen 9 Pokémon Type Chart
    this.typeChart = this._initTypeChart();

    // Populate baseline vertical slice
    this.manifest = null;
    this.loadBaseline();
  }

  loadBaseline() {
    const { species, moves, abilities } = this.adapter.getVerticalSliceDataset();
    this.loadDataset({ species, moves, abilities });
    this.isFallback = true;
    this._notify('dataLoaded', { count: this.species.size, source: 'fallback_fixture' });
  }

  /**
   * Idempotently loads a dataset of species, moves, and abilities.
   */
  loadDataset({ species = [], moves = [], abilities = [] }) {
    species.forEach(s => this.species.set(s.id, s));
    moves.forEach(m => this.moves.set(m.id, m));
    abilities.forEach(a => this.abilities.set(a.id, a));
  }

  /**
   * Registers a parsed enum catalog into the data registry.
   * @param {string} enumName e.g. 'SpeciesId', 'MoveId', 'AbilityId', 'PokemonType'
   * @param {import('./PokerogueEnumParser.js').PokerogueEnumCatalog} catalog 
   */
  registerEnums(enumName, catalog) {
    if (!enumName || !catalog) {
      throw new Error('Valid enumName and PokerogueEnumCatalog required for registerEnums');
    }
    this.enums.set(enumName, catalog);
    this._notify('enumsRegistered', { enumName, count: catalog.count });
  }

  /**
   * Retrieves an enum catalog by name.
   */
  getEnum(enumName) {
    return this.enums.get(enumName) || null;
  }

  /**
   * Resolves a symbol to its numeric ID across registered enums.
   * @param {string} enumName e.g. 'SpeciesId'
   * @param {string} symbol e.g. 'PIKACHU'
   * @returns {number|null}
   */
  getEnumByName(enumName, symbol) {
    const catalog = this.getEnum(enumName);
    if (!catalog) return null;
    const id = catalog.getId(symbol);
    return id !== undefined ? id : null;
  }

  /**
   * Resolves a numeric ID to its symbol name across registered enums.
   * @param {string} enumName e.g. 'SpeciesId'
   * @param {number} id e.g. 25
   * @returns {string|null}
   */
  getEnumById(enumName, id) {
    const catalog = this.getEnum(enumName);
    if (!catalog) return null;
    return catalog.getSymbol(id) || null;
  }

  /**
   * Registers a parsed locale package into the data registry.
   * @param {import('./PokerogueLocaleImporter.js').PokerogueLocalePackage} localePackage 
   */
  registerLocale(localePackage) {
    if (!localePackage) {
      throw new Error('Valid PokerogueLocalePackage required for registerLocale');
    }
    const normLocale = PokerogueLocaleImporter.normalizeLocaleCode(localePackage.localeCode);
    const key = `${normLocale}:${localePackage.namespace}`;
    this.locales.set(key, localePackage);

    // Apply localization updates to existing canonical models in-memory
    this._applyLocaleToEntities(normLocale, localePackage.namespace, localePackage);

    this._notify('localeRegistered', {
      locale: normLocale,
      namespace: localePackage.namespace,
      count: localePackage.size()
    });
  }

  /**
   * Sets current active UI display language.
   * @param {'en'|'es'|'es-ES'} localeCode 
   */
  setLocale(localeCode) {
    const norm = PokerogueLocaleImporter.normalizeLocaleCode(localeCode);
    if (this.currentLocale !== norm) {
      this.currentLocale = norm;
      this._notify('localeChanged', { locale: norm });
    }
  }

  getLocale() {
    return this.currentLocale;
  }

  /**
   * Retrieves localized text from registered locale packages.
   * @param {string} namespace 'move' | 'ability' | 'pokemon' | 'battle'
   * @param {string} id Entity key e.g. 'thunderbolt', 'static'
   * @param {string} [field='name']
   * @param {string} [locale=this.currentLocale]
   * @returns {string|null}
   */
  getLocalizedText(namespace, id, field = 'name', locale = this.currentLocale) {
    const normLocale = PokerogueLocaleImporter.normalizeLocaleCode(locale);
    const key = `${normLocale}:${namespace}`;
    const pkg = this.locales.get(key);
    if (!pkg) {
      // Fallback to 'en' if requested locale is missing
      const enPkg = this.locales.get(`en:${namespace}`);
      if (enPkg) {
        const entry = enPkg.get(id);
        if (typeof entry === 'string') return entry;
        if (typeof entry === 'object' && entry !== null) return entry[field] || entry.name || null;
      }
      return null;
    }

    const entry = pkg.get(id);
    if (!entry) return null;
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object' && entry !== null) {
      return entry[field] || entry.name || null;
    }
    return null;
  }

  /**
   * In-place enrichment of canonical entities with imported locale data.
   */
  _applyLocaleToEntities(locale, namespace, pkg) {
    const langKey = locale.toLowerCase().startsWith('es') ? 'es' : 'en';

    if (namespace === 'move') {
      this.moves.forEach(m => {
        const entry = pkg.get(m.id);
        if (entry) {
          if (typeof entry === 'object') {
            if (entry.name) m.names[langKey] = entry.name;
            if (entry.effect) m.descriptions[langKey] = entry.effect;
          } else if (typeof entry === 'string') {
            m.names[langKey] = entry;
          }
        }
      });
    } else if (namespace === 'ability') {
      this.abilities.forEach(a => {
        const entry = pkg.get(a.id);
        if (entry) {
          if (typeof entry === 'object') {
            if (entry.name) a.names[langKey] = entry.name;
            if (entry.description) a.descriptions[langKey] = entry.description;
          } else if (typeof entry === 'string') {
            a.names[langKey] = entry;
          }
        }
      });
    } else if (namespace === 'pokemon') {
      this.species.forEach(s => {
        const entry = pkg.get(s.id);
        if (entry && typeof entry === 'string') {
          s.names[langKey] = entry;
        }
      });
    }
  }

  /**
   * Performs real upstream ingestion using PokerogueImporter.
   */
  async importUpstream(importer) {
    if (!importer) throw new Error('PokerogueImporter instance required');
    const result = await importer.importVerticalSlice();
    this.loadDataset(result);
    this.manifest = result.manifest;
    this.isFallback = false;
    this._notify('upstreamSynced', {
      speciesCount: result.species.length,
      movesCount: result.moves.length,
      abilitiesCount: result.abilities.length,
      manifest: this.manifest
    });
    return result;
  }

  getSpecies(id) {
    if (!id) return null;
    return this.species.get(String(id).toLowerCase()) || null;
  }

  getAllSpecies() {
    return Array.from(this.species.values());
  }

  getMove(id) {
    if (!id) return null;
    return this.moves.get(String(id).toLowerCase()) || null;
  }

  getAllMoves() {
    return Array.from(this.moves.values());
  }

  getAbility(id) {
    if (!id) return null;
    return this.abilities.get(String(id).toLowerCase()) || null;
  }

  getAllAbilities() {
    return Array.from(this.abilities.values());
  }

  /**
   * Calculates type effectiveness multiplier (0, 0.25, 0.5, 1, 2, 4).
   * @param {string} attackType 
   * @param {string} defenderType1 
   * @param {string} defenderType2 
   * @returns {number}
   */
  getTypeEffectiveness(attackType, defenderType1, defenderType2 = 'NONE') {
    const atk = String(attackType).toUpperCase();
    const def1 = String(defenderType1).toUpperCase();
    const def2 = String(defenderType2).toUpperCase();

    let mult = 1.0;
    if (this.typeChart[atk] && this.typeChart[atk][def1] !== undefined) {
      mult *= this.typeChart[atk][def1];
    }
    if (def2 && def2 !== 'NONE' && this.typeChart[atk] && this.typeChart[atk][def2] !== undefined) {
      mult *= this.typeChart[atk][def2];
    }
    return mult;
  }

  /**
   * Calculates type effectiveness multiplier against an array of defender types.
   */
  getTypeMultiplier(attackType, defenderTypes = []) {
    const types = Array.isArray(defenderTypes) ? defenderTypes : [defenderTypes];
    return this.getTypeEffectiveness(attackType, types[0] || 'NORMAL', types[1] || 'NONE');
  }

  /**
   * Generates dependency graph for a Pokémon.
   */
  getDependencyGraph(speciesId) {
    const s = this.getSpecies(speciesId);
    if (!s) return null;
    return this.adapter.buildDependencyGraph(s, this.getAllMoves(), this.getAllAbilities());
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  _notify(type, data = {}) {
    this.listeners.forEach(l => {
      try { l(type, data); } catch (e) { console.error('DataManager listener error:', e); }
    });
  }

  _initTypeChart() {
    return {
      NORMAL: { ROCK: 0.5, GHOST: 0, STEEL: 0.5 },
      FIRE: { FIRE: 0.5, WATER: 0.5, GRASS: 2, ICE: 2, BUG: 2, ROCK: 0.5, DRAGON: 0.5, STEEL: 2 },
      WATER: { FIRE: 2, WATER: 0.5, GRASS: 0.5, GROUND: 2, ROCK: 2, DRAGON: 0.5 },
      GRASS: { FIRE: 0.5, WATER: 2, GRASS: 0.5, POISON: 0.5, GROUND: 2, FLYING: 0.5, BUG: 0.5, ROCK: 2, DRAGON: 0.5, STEEL: 0.5 },
      ELECTRIC: { WATER: 2, GRASS: 0.5, ELECTRIC: 0.5, GROUND: 0, FLYING: 2, DRAGON: 0.5 },
      ICE: { FIRE: 0.5, WATER: 0.5, GRASS: 2, ICE: 0.5, GROUND: 2, FLYING: 2, DRAGON: 2, STEEL: 0.5 },
      FIGHTING: { NORMAL: 2, ICE: 2, POISON: 0.5, FLYING: 0.5, PSYCHIC: 0.5, BUG: 0.5, ROCK: 2, GHOST: 0, DARK: 2, STEEL: 2, FAIRY: 0.5 },
      POISON: { GRASS: 2, POISON: 0.5, GROUND: 0.5, ROCK: 0.5, GHOST: 0.5, STEEL: 0, FAIRY: 2 },
      GROUND: { FIRE: 2, ELECTRIC: 2, GRASS: 0.5, POISON: 2, FLYING: 0, BUG: 0.5, ROCK: 2, STEEL: 2 },
      FLYING: { ELECTRIC: 0.5, GRASS: 2, FIGHTING: 2, BUG: 2, ROCK: 0.5, STEEL: 0.5 },
      PSYCHIC: { FIGHTING: 2, POISON: 2, PSYCHIC: 0.5, DARK: 0, STEEL: 0.5 },
      BUG: { FIRE: 0.5, GRASS: 2, FIGHTING: 0.5, POISON: 0.5, FLYING: 0.5, PSYCHIC: 2, GHOST: 0.5, DARK: 2, STEEL: 0.5, FAIRY: 0.5 },
      ROCK: { FIRE: 2, ICE: 2, FIGHTING: 0.5, GROUND: 0.5, FLYING: 2, BUG: 2, STEEL: 0.5 },
      GHOST: { NORMAL: 0, PSYCHIC: 2, GHOST: 2, DARK: 0.5 },
      DRAGON: { DRAGON: 2, STEEL: 0.5, FAIRY: 0 },
      DARK: { FIGHTING: 0.5, PSYCHIC: 2, GHOST: 2, DARK: 0.5, FAIRY: 0.5 },
      STEEL: { FIRE: 0.5, WATER: 0.5, ELECTRIC: 0.5, ICE: 2, ROCK: 2, STEEL: 0.5, FAIRY: 2 },
      FAIRY: { FIRE: 0.5, FIGHTING: 2, POISON: 0.5, DRAGON: 2, DARK: 2, STEEL: 0.5 }
    };
  }
}

// Global DataManager singleton
export const dataManager = new DataManager();
