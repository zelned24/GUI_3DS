/**
 * PokemonDataModels.js
 * Separates Persistent Data (account/run storage), Battle Data (active match statistics & stages),
 * and Turn Data (temporal per-turn action flags).
 */

import { dataManager } from '../data/DataManager.js';

/**
 * Persistent Pokémon entity:
 * Stored in run/save state. Unchanged between turns except for permanent HP loss, exp, friendship, and moveset.
 */
export class PokemonPersistentData {
  constructor(species, options = {}) {
    this.speciesId = species.id;
    this.speciesName = species.name;
    this.nickname = options.nickname || species.name;
    this.level = Number(options.level || 20);
    this.nature = options.nature || 'Hardy';
    this.types = Array.isArray(species.types) ? [...species.types] : [species.type1 || 'Normal'];

    // IVs (0-31) and EVs (0-252)
    this.ivs = options.ivs || { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, spd: 31 };
    this.evs = options.evs || { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0 };

    this.ability = options.ability || species.abilities?.primary || 'None';
    this.passive = options.passive || species.abilities?.passive || 'None';

    // Moveset (up to 4 moves)
    const rawMoves = options.moves || species.learnableMoves || species.levelMoves || [];
    this.moves = rawMoves.slice(0, 4).map(m => {
      const moveId = typeof m === 'string' ? m : (m.id || m.move || 'tackle');
      const def = dataManager.getMove(moveId);
      return {
        id: moveId,
        name: def?.name || m.name || moveId,
        type: def?.type || m.type || 'Normal',
        category: def?.category || m.category || 'Physical',
        power: def?.power ?? m.power ?? 40,
        accuracy: def?.accuracy ?? m.accuracy ?? 100,
        pp: def?.pp ?? m.pp ?? 20,
        maxPp: def?.pp ?? m.pp ?? 20,
        priority: def?.priority ?? m.priority ?? 0
      };
    });

    // Permanent status (burn, paralysis, etc. persisting across waves)
    this.status = options.status || null;
    this.currentHp = options.currentHp !== undefined ? options.currentHp : null; // calculated in BattleData
    this.friendship = Number(options.friendship ?? species.baseFriendship ?? 50);
  }

  clone() {
    return new PokemonPersistentData(
      { id: this.speciesId, name: this.speciesName, types: this.types, baseFriendship: this.friendship, abilities: { primary: this.ability, passive: this.passive } },
      {
        nickname: this.nickname,
        level: this.level,
        nature: this.nature,
        ivs: { ...this.ivs },
        evs: { ...this.evs },
        ability: this.ability,
        passive: this.passive,
        moves: this.moves.map(m => ({ ...m })),
        status: this.status,
        currentHp: this.currentHp
      }
    );
  }
}

/**
 * Temporal per-turn combat state:
 * Tracks whether the Pokémon moved, flinched, protected, or was hit in the current turn.
 */
export class PokemonTurnData {
  constructor() {
    this.hasMoved = false;
    this.isProtected = false;
    this.isFlinched = false;
    this.damageReceivedThisTurn = 0;
    this.lastMoveUsed = null;
  }

  reset() {
    this.hasMoved = false;
    this.isProtected = false;
    this.isFlinched = false;
    this.damageReceivedThisTurn = 0;
    this.lastMoveUsed = null;
  }

  clone() {
    const t = new PokemonTurnData();
    t.hasMoved = this.hasMoved;
    t.isProtected = this.isProtected;
    t.isFlinched = this.isFlinched;
    t.damageReceivedThisTurn = this.damageReceivedThisTurn;
    t.lastMoveUsed = this.lastMoveUsed;
    return t;
  }
}

/**
 * Active Battle Data:
 * Handles combat stat stages (-6 to +6), effective stat computation, and current HP.
 */
export class PokemonBattleData {
  constructor(speciesOrPersistent, level = 20, nickname = null) {
    if (speciesOrPersistent instanceof PokemonPersistentData) {
      this.persistent = speciesOrPersistent;
    } else {
      this.persistent = new PokemonPersistentData(speciesOrPersistent, { level, nickname });
    }

    // Direct access convenience proxies
    this.speciesId = this.persistent.speciesId;
    this.speciesName = this.persistent.speciesName;
    this.nickname = this.persistent.nickname;
    this.level = this.persistent.level;
    this.nature = this.persistent.nature;
    this.types = [...this.persistent.types];
    this.ability = this.persistent.ability;
    this.moves = this.persistent.moves.map(m => ({ ...m }));
    this.status = this.persistent.status;
    this.statusTurns = 0;

    // Get species base stats
    const sp = dataManager.getSpecies(this.speciesId);
    this.baseStats = sp ? { ...sp.baseStats } : { hp: 40, atk: 40, def: 40, spatk: 40, spdef: 40, spd: 40 };

    // Calculate real stats with Gen 3-9 formula and Nature multiplier
    this.stats = this._calculateStats(this.baseStats, this.level, this.nature, this.persistent.ivs, this.persistent.evs);
    this.maxHp = this.stats.hp;
    this.currentHp = this.persistent.currentHp !== null ? this.persistent.currentHp : this.maxHp;

    // Temporal combat stat stages: -6 to +6
    this.statStages = {
      atk: 0,
      def: 0,
      spatk: 0,
      spdef: 0,
      spd: 0,
      acc: 0,
      eva: 0
    };

    this.turnData = new PokemonTurnData();
    this.fainted = this.currentHp <= 0;
    this.turnsInBattle = 0;
    this.tags = new Set(); // substitute, endure, etc.
  }

  _calculateStats(base, level, natureName, ivs, evs) {
    const nature = dataManager.getNature(natureName);
    const hp = Math.floor(((2 * base.hp + (ivs.hp || 31) + Math.floor((evs.hp || 0) / 4)) * level) / 100) + level + 10;

    const calcOther = (statKey, b) => {
      const raw = Math.floor(((2 * b + (ivs[statKey] || 31) + Math.floor((evs[statKey] || 0) / 4)) * level) / 100) + 5;
      const mult = nature ? nature.getMultiplier(statKey) : 1.0;
      return Math.floor(raw * mult);
    };

    return {
      hp,
      atk: calcOther('atk', base.atk),
      def: calcOther('def', base.def),
      spatk: calcOther('spatk', base.spatk),
      spdef: calcOther('spdef', base.spdef),
      spd: calcOther('spd', base.spd)
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

    // Paralysis cuts Speed by 50%
    if (statName === 'spd' && this.status === 'paralysis') {
      val = Math.floor(val * 0.5);
    }

    return Math.max(1, val);
  }

  clone() {
    const copy = new PokemonBattleData(this.persistent.clone());
    copy.baseStats = { ...this.baseStats };
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
    copy.turnData = this.turnData.clone();
    copy.tags = new Set(this.tags);
    return copy;
  }
}
