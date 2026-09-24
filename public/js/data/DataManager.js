import { PokerogueAdapter } from './PokerogueAdapter.js';

/**
 * DataManager - Central database and query engine for all game content
 * (Species, Moves, Abilities, Items, Type Chart, Dependency Graphs).
 */
export class DataManager {
  constructor() {
    this.adapter = new PokerogueAdapter();
    this.species = new Map(); // id -> SpeciesDefinition
    this.moves = new Map();   // id -> MoveDefinition
    this.abilities = new Map(); // id -> AbilityDefinition
    this.items = new Map();   // id -> ItemDefinition
    this.listeners = [];

    // Official Gen 9 Pokémon Type Chart
    this.typeChart = this._initTypeChart();

    // Populate baseline vertical slice
    this.loadBaseline();
  }

  loadBaseline() {
    const { species, moves, abilities } = this.adapter.getVerticalSliceDataset();
    species.forEach(s => this.species.set(s.id, s));
    moves.forEach(m => this.moves.set(m.id, m));
    abilities.forEach(a => this.abilities.set(a.id, a));
    this._notify('dataLoaded', { count: this.species.size });
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

