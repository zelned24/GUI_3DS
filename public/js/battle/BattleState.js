/**
 * BattleState.js
 * Domain model for PokéRogue 3DS Battle Engine and Battle Lab.
 * Represents persistent Pokémon data, temporal combat states, active field, and replayable snapshots.
 */

import { dataManager } from '../data/DataManager.js';

export class PokemonBattleData {
  constructor(species, level = 20, nickname = null) {
    this.species = species;
    this.speciesId = species.id;
    this.speciesName = species.name;
    this.nickname = nickname || species.name;
    this.level = level;
    this.types = Array.isArray(species.types) ? [...species.types] : [species.type1 || 'NORMAL'];
    this.baseStats = { ...species.baseStats };
    this.nature = 'Hardy';

    // Calculate actual stats for this level (Gen 3-9 standard stats calculation)
    this.stats = this._calculateStats(species.baseStats, level);
    this.maxHp = this.stats.hp;
    this.currentHp = this.maxHp;

    // Active abilities and moves
    this.ability = species.abilities?.primary || species.ability || 'Static';
    const rawMoves = species.learnableMoves || species.levelMoves || [];
    this.moves = rawMoves.slice(0, 4).map(m => {
      const moveId = typeof m === 'string' ? m : (m.id || m.move || 'tackle');
      const def = dataManager.getMove(moveId);
      return {
        id: moveId,
        name: def?.name || m.name || moveId,
        type: def?.type || m.type || 'NORMAL',
        category: def?.category || m.category || 'Physical',
        power: def?.power ?? m.power ?? 40,
        accuracy: def?.accuracy ?? m.accuracy ?? 100,
        pp: def?.pp ?? m.pp ?? 20,
        maxPp: def?.pp ?? m.pp ?? 20,
        priority: def?.priority ?? m.priority ?? 0
      };
    });

    // Status condition (null, 'burn', 'paralysis', 'sleep', 'poison', 'freeze')
    this.status = null;
    this.statusTurns = 0;

    // Temporal combat stages: -6 to +6
    this.statStages = {
      atk: 0,
      def: 0,
      spatk: 0,
      spdef: 0,
      spd: 0,
      acc: 0,
      eva: 0
    };

    // Temporal flags
    this.fainted = false;
    this.turnsInBattle = 0;
  }

  _calculateStats(base, level) {
    const iv = 31; // Max IV for deterministic studio baseline
    const ev = 0;
    const hp = Math.floor(((2 * base.hp + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
    const calcOther = (b) => Math.floor(((2 * b + iv + Math.floor(ev / 4)) * level) / 100) + 5;

    return {
      hp,
      atk: calcOther(base.atk),
      def: calcOther(base.def),
      spatk: calcOther(base.spatk),
      spdef: calcOther(base.spdef),
      spd: calcOther(base.spd)
    };
  }

  getEffectiveStat(statName) {
    if (statName === 'hp') return this.stats.hp;
    const baseVal = this.stats[statName] || 1;
    const stage = Math.max(-6, Math.min(6, this.statStages[statName] || 0));
    const multipliers = {
      '-6': 2 / 8, '-5': 2 / 7, '-4': 2 / 6, '-3': 2 / 5, '-2': 2 / 4, '-1': 2 / 3,
      '0': 1,
      '1': 3 / 2, '2': 4 / 2, '3': 5 / 2, '4': 6 / 2, '5': 7 / 2, '6': 8 / 2
    };
    let val = Math.floor(baseVal * (multipliers[stage.toString()] || 1));
    if (statName === 'spd' && this.status === 'paralysis') {
      val = Math.floor(val * 0.5);
    }
    return Math.max(1, val);
  }

  clone() {
    const copy = new PokemonBattleData(
      this.species || {
        id: this.speciesId,
        name: this.speciesName,
        types: this.types,
        baseStats: this.baseStats,
        abilities: { primary: this.ability },
        learnableMoves: []
      },
      this.level,
      this.nickname
    );
    copy.stats = { ...this.stats };
    copy.maxHp = this.maxHp;
    copy.currentHp = this.currentHp;
    copy.ability = this.ability;
    copy.moves = this.moves.map(m => ({ ...m }));
    copy.status = this.status;
    copy.statusTurns = this.statusTurns;
    copy.statStages = { ...this.statStages };
    copy.fainted = this.fainted;
    copy.turnsInBattle = this.turnsInBattle;
    return copy;
  }
}

export class BattleState {
  constructor(playerPokemon, enemyPokemon, seed = 12345) {
    this.seed = Number(seed) || 12345;
    this.battleId = `battle_seed_${this.seed >>> 0}`;
    this.rngState = this.seed >>> 0;
    this.turn = 1;
    this.wave = 1;
    this.phase = 'WaitingForCommand'; // CommandPhase, MoveResolvePhase, DamagePhase, EffectPhase, EndTurnPhase, BattleFinished
    this.winner = null; // 'player' | 'enemy' | null
    this.weather = 'none'; // 'sun', 'rain', 'sandstorm', 'snow', 'none'
    this.terrain = 'none'; // 'electric', 'grassy', 'misty', 'psychic', 'none'
    
    this.player = {
      name: 'Player',
      active: playerPokemon,
      party: [playerPokemon]
    };

    this.enemy = {
      name: 'Wild Foe',
      active: enemyPokemon,
      party: [enemyPokemon]
    };

    this.eventLog = [];
    this.damageBreakdown = null; // Last damage calculation details
  }

  // PRNG (Linear Congruential Generator) for reproducible simulations
  random() {
    this.rngState = (this.rngState * 1664525 + 1013904223) % 4294967296;
    return this.rngState / 4294967296;
  }

  randomRange(min, max) {
    return min + this.random() * (max - min);
  }

  createSnapshot() {
    return {
      turn: this.turn,
      wave: this.wave,
      phase: this.phase,
      winner: this.winner,
      weather: this.weather,
      terrain: this.terrain,
      rngState: this.rngState,
      player: {
        active: this.player.active ? this.player.active.clone() : null
      },
      enemy: {
        active: this.enemy.active ? this.enemy.active.clone() : null
      },
      eventLogCount: this.eventLog.length
    };
  }

  restoreSnapshot(snapshot) {
    this.turn = snapshot.turn;
    this.wave = snapshot.wave;
    this.phase = snapshot.phase;
    this.winner = snapshot.winner || null;
    this.weather = snapshot.weather;
    this.terrain = snapshot.terrain;
    this.rngState = snapshot.rngState;
    if (snapshot.player.active) this.player.active = snapshot.player.active.clone();
    if (snapshot.enemy.active) this.enemy.active = snapshot.enemy.active.clone();
  }
}
