/**
 * DataManager.js
 * Central database and query engine for all game content.
 * Replaces hardcoded mock data with real imported PokéRogue data.
 * Supports:
 *  - Real upstream imports via PokerogueImporter
 *  - Fallback Test Fixture (strictly for offline/tests)
 *  - Studio Overrides (Base Data vs Override Data vs Final Build Data)
 *  - Data Diffs with upstream
 *  - Bidirectional Dependency Graphs
 *  - Global Search across all content
 */

import { PokerogueRepository } from './PokerogueRepository.js';
import { PokerogueAssetRepository } from './PokerogueAssetRepository.js';
import { PokerogueAssetImporter } from './PokerogueAssetImporter.js';
import { PokerogueImporter } from './PokerogueImporter.js';
import { PokerogueAdapter } from './PokerogueAdapter.js';
import { OverrideManager } from './OverrideManager.js';
import { DependencyGraph } from './DependencyGraph.js';
import { PokemonSpriteResolver } from './PokemonSpriteResolver.js';

export class DataManager {
  constructor() {
    this.adapter = new PokerogueAdapter(); // Legacy adapter maintained for fallback fixture
    this.repo = new PokerogueRepository();
    this.assetRepo = new PokerogueAssetRepository();
    this.assetImporter = new PokerogueAssetImporter(this.assetRepo);
    this.importer = new PokerogueImporter(this.repo, this.assetImporter);
    this.overrideManager = new OverrideManager();
    this.dependencyGraph = new DependencyGraph();
    this.spriteResolver = new PokemonSpriteResolver(this.assetRepo);

    // In-memory base (upstream) stores
    this.baseSpecies = new Map();
    this.baseMoves = new Map();
    this.baseAbilities = new Map();
    this.baseItems = new Map();
    this.baseNatures = new Map();

    // Data source status
    this.dataSource = 'UNINITIALIZED'; // 'UPSTREAM_REAL' | 'FALLBACK_TEST_FIXTURE'
    this.manifest = null;
    this.provenance = null;
    this.listeners = [];

    // Official Gen 9 Pokémon Type Chart
    this.typeChart = this._initTypeChart();

    // Load initial data (synchronous fallback first, then async upgrade if possible)
    this.loadFallbackFixture();
  }

  /**
   * Fallback Test Fixture: Strictly maintained for unit tests / offline baseline.
   * Not to be used as production base.
   */
  loadFallbackFixture() {
    const { species, moves, abilities } = this.adapter.getVerticalSliceDataset();
    this.baseSpecies.clear();
    this.baseMoves.clear();
    this.baseAbilities.clear();

    species.forEach(s => this.baseSpecies.set(s.id, s));
    moves.forEach(m => this.baseMoves.set(m.id, m));
    abilities.forEach(a => this.baseAbilities.set(a.id, a));

    this.dataSource = 'FALLBACK_TEST_FIXTURE';
    this.dependencyGraph.buildFromDataset(this.getAllSpecies(false), this.getAllMoves(false), this.getAllAbilities(false));
    this._notify('dataLoaded', { source: this.dataSource, count: this.baseSpecies.size });
  }

  /**
   * Real Import: Loads and normalizes content from configured PokéRogue source.
   */
  async loadFromUpstream() {
    try {
      const result = await this.importer.importVerticalSlice();
      this.baseSpecies.clear();
      this.baseMoves.clear();
      this.baseAbilities.clear();
      this.baseNatures.clear();

      result.species.forEach(s => this.baseSpecies.set(s.id, s));
      result.moves.forEach(m => this.baseMoves.set(m.id, m));
      result.abilities.forEach(a => this.baseAbilities.set(a.id, a));
      result.natures.forEach(n => this.baseNatures.set(n.id, n));

      this.manifest = result.manifest;
      this.provenance = result.provenance;
      this.dataSource = 'UPSTREAM_REAL';

      this.dependencyGraph.buildFromDataset(this.getAllSpecies(false), this.getAllMoves(false), this.getAllAbilities(false));
      this._notify('dataLoaded', { source: this.dataSource, count: this.baseSpecies.size, manifest: this.manifest });
      return true;
    } catch (err) {
      console.warn('Failed to load from upstream PokéRogue repository, keeping fixture:', err);
      return false;
    }
  }

  /**
   * Injects pre-imported real datasets directly (e.g. during offline test execution).
   */
  loadImportedDataset(dataset) {
    if (dataset.species) {
      this.baseSpecies.clear();
      dataset.species.forEach(s => this.baseSpecies.set(s.id, s));
    }
    if (dataset.moves) {
      this.baseMoves.clear();
      dataset.moves.forEach(m => this.baseMoves.set(m.id, m));
    }
    if (dataset.abilities) {
      this.baseAbilities.clear();
      dataset.abilities.forEach(a => this.baseAbilities.set(a.id, a));
    }
    if (dataset.manifest) this.manifest = dataset.manifest;
    if (dataset.provenance) this.provenance = dataset.provenance;

    this.dataSource = 'UPSTREAM_REAL';
    this.dependencyGraph.buildFromDataset(this.getAllSpecies(false), this.getAllMoves(false), this.getAllAbilities(false));
    this._notify('dataLoaded', { source: this.dataSource, count: this.baseSpecies.size });
  }

  // -------------------------------------------------------------
  // ENTITY ACCESSORS (supports base upstream vs overridden final build)
  // -------------------------------------------------------------
  getSpecies(id, applyOverrides = true) {
    if (!id) return null;
    const base = this.baseSpecies.get(String(id).toLowerCase()) || null;
    if (!base || !applyOverrides) return base;
    return this.overrideManager.applyOverrides(base, 'species');
  }

  getAllSpecies(applyOverrides = true) {
    const all = Array.from(this.baseSpecies.values());
    if (!applyOverrides) return all;
    return all.map(s => this.overrideManager.applyOverrides(s, 'species'));
  }

  getMove(id, applyOverrides = true) {
    if (!id) return null;
    const base = this.baseMoves.get(String(id).toLowerCase()) || null;
    if (!base || !applyOverrides) return base;
    return this.overrideManager.applyOverrides(base, 'moves');
  }

  getAllMoves(applyOverrides = true) {
    const all = Array.from(this.baseMoves.values());
    if (!applyOverrides) return all;
    return all.map(m => this.overrideManager.applyOverrides(m, 'moves'));
  }

  getAbility(id, applyOverrides = true) {
    if (!id) return null;
    const base = this.baseAbilities.get(String(id).toLowerCase()) || null;
    if (!base || !applyOverrides) return base;
    return this.overrideManager.applyOverrides(base, 'abilities');
  }

  getAllAbilities(applyOverrides = true) {
    const all = Array.from(this.baseAbilities.values());
    if (!applyOverrides) return all;
    return all.map(a => this.overrideManager.applyOverrides(a, 'abilities'));
  }

  getNature(id) {
    if (!id) return null;
    return this.baseNatures.get(String(id).toLowerCase()) || null;
  }

  // -------------------------------------------------------------
  // OVERRIDE & DIFF SYSTEM
  // -------------------------------------------------------------
  setOverride(category, id, propertyPath, value) {
    this.overrideManager.setOverride(category, id, propertyPath, value);
    this._notify('overrideChanged', { category, id, propertyPath, value });
  }

  getDiffWithUpstream(category, id) {
    const cat = String(category).toLowerCase();
    let base = null;
    if (cat === 'species') base = this.getSpecies(id, false);
    else if (cat === 'moves') base = this.getMove(id, false);
    else if (cat === 'abilities') base = this.getAbility(id, false);

    if (!base) return null;
    const overrides = this.overrideManager.getOverridesFor(cat, id);

    const diffs = [];
    for (const [prop, overrideVal] of Object.entries(overrides)) {
      const parts = prop.split('.');
      let currentVal = base;
      for (const p of parts) {
        currentVal = currentVal ? currentVal[p] : undefined;
      }
      diffs.push({
        property: prop,
        upstreamValue: currentVal,
        overrideValue: overrideVal
      });
    }

    return {
      id,
      category: cat,
      hasDiffs: diffs.length > 0,
      diffs
    };
  }

  // -------------------------------------------------------------
  // GLOBAL SEARCH (Ctrl+P)
  // -------------------------------------------------------------
  globalSearch(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const results = [];

    // Search Species
    for (const s of this.getAllSpecies()) {
      if (s.name.toLowerCase().includes(q) || s.id.includes(q)) {
        results.push({ type: 'Species', id: s.id, title: s.name, subtitle: `#${s.nationalDexId} • ${s.types.join('/')}` });
      }
    }

    // Search Moves
    for (const m of this.getAllMoves()) {
      if (m.name.toLowerCase().includes(q) || m.id.includes(q)) {
        results.push({ type: 'Move', id: m.id, title: m.name, subtitle: `${m.type} • ${m.category} • Pwr ${m.power}` });
      }
    }

    // Search Abilities
    for (const a of this.getAllAbilities()) {
      if (a.name.toLowerCase().includes(q) || a.id.includes(q)) {
        results.push({ type: 'Ability', id: a.id, title: a.name, subtitle: a.description.slice(0, 60) });
      }
    }

    // Search Assets
    for (const asset of this.assetRepo.getAllAssets()) {
      if (asset.sourcePath.toLowerCase().includes(q)) {
        results.push({ type: 'Asset', id: asset.id, title: asset.sourcePath, subtitle: `${asset.category} • ${asset.mimeType}` });
      }
    }

    return results;
  }

  // -------------------------------------------------------------
  // TYPE EFFECTIVENESS
  // -------------------------------------------------------------
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

  getTypeMultiplier(attackType, defenderTypes = []) {
    const types = Array.isArray(defenderTypes) ? defenderTypes : [defenderTypes];
    return this.getTypeEffectiveness(attackType, types[0] || 'NORMAL', types[1] || 'NONE');
  }

  getDependencyGraph(speciesId) {
    const s = this.getSpecies(speciesId);
    if (!s) return null;
    const legacyGraph = this.adapter.buildDependencyGraph(s, this.getAllMoves(), this.getAllAbilities());
    return {
      ...legacyGraph,
      species: s.name,
      speciesId: s.speciesId,
      dependencies: this.dependencyGraph.getDependenciesOf(`species:${s.id}`),
      dependents: this.dependencyGraph.getDependentsOn(`species:${s.id}`),
      impactChain: this.dependencyGraph.getImpactAnalysis(`species:${s.id}`)
    };
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

export const dataManager = new DataManager();
