/**
 * WaveManager.js
 * Controls the progression of Waves 1 to 10 in GUI_3DS.
 * Manages encounter generation, difficulty scaling, and cumulative run statistics.
 */

import { dataManager } from '../data/DataManager.js';
import { PokemonBattleData, BattleState } from '../battle/BattleState.js';

export class WaveManager {
  constructor() {
    this.totalWaves = 10;
    this.currentWave = 1;
    this.playerConfig = {
      speciesId: 'pikachu',
      level: 15
    };
    this.runStats = {
      battlesWon: 0,
      totalTurns: 0,
      damageDealt: 0,
      damageTaken: 0,
      cleared: false
    };
  }

  /**
   * Resets the run state for a fresh attempt.
   */
  resetRun(playerConfig = {}, startWave = 1) {
    this.currentWave = Math.min(Math.max(1, startWave), this.totalWaves);
    if (playerConfig.speciesId) {
      this.playerConfig.speciesId = playerConfig.speciesId;
    }
    if (playerConfig.level) {
      this.playerConfig.level = Number(playerConfig.level);
    }
    this.runStats = {
      battlesWon: this.currentWave - 1,
      totalTurns: 0,
      damageDealt: 0,
      damageTaken: 0,
      cleared: false
    };
  }

  /**
   * Returns definition for a specific wave.
   */
  getWaveDefinition(waveNum) {
    const num = Math.min(Math.max(1, waveNum), this.totalWaves);
    // Alternate between Geodude/Golem and Pikachu with increasing levels
    const isBoss = num === 10;
    const isMiniBoss = num === 5;

    let enemySpeciesId = 'golem';
    let level = 5 + (num * 2);
    let title = `Wild Encounter - Wave ${num}`;

    if (num % 2 === 1) {
      enemySpeciesId = num >= 7 ? 'golem' : 'pikachu';
      level = 4 + (num * 2);
    } else {
      enemySpeciesId = 'golem';
      level = 5 + (num * 2);
    }

    if (isMiniBoss) {
      title = `⚠️ MINI-BOSS: Veteran Golem`;
      level = 16;
    } else if (isBoss) {
      title = `👑 FINAL BOSS: Alpha Golem`;
      level = 25;
    }

    return {
      waveNumber: num,
      totalWaves: this.totalWaves,
      enemySpeciesId,
      enemyLevel: level,
      title,
      isMiniBoss,
      isBoss,
      rewards: {
        score: num * 100,
        exp: num * 50
      }
    };
  }

  getCurrentWaveDefinition() {
    return this.getWaveDefinition(this.currentWave);
  }

  /**
   * Instantiates a real BattleState for the current wave using DataManager.
   */
  createBattleStateForCurrentWave(seed = 5555) {
    const waveDef = this.getCurrentWaveDefinition();
    const pSpecies = dataManager.getSpecies(this.playerConfig.speciesId) || dataManager.getAllSpecies()[0];
    const eSpecies = dataManager.getSpecies(waveDef.enemySpeciesId) || dataManager.getAllSpecies()[0];

    const pBattler = new PokemonBattleData(pSpecies, this.playerConfig.level);
    const eBattler = new PokemonBattleData(eSpecies, waveDef.enemyLevel);

    const state = new BattleState(pBattler, eBattler, seed + this.currentWave);
    state.wave = this.currentWave;
    return state;
  }

  recordBattleResult(result) {
    if (result.won) {
      this.runStats.battlesWon++;
    }
    this.runStats.totalTurns += (result.turns || 0);
    this.runStats.damageDealt += (result.damageDealt || 0);
    this.runStats.damageTaken += (result.damageTaken || 0);
  }

  advanceWave() {
    if (this.currentWave < this.totalWaves) {
      this.currentWave++;
    } else {
      this.runStats.cleared = true;
    }
    return this.getCurrentWaveDefinition();
  }

  isRunComplete() {
    return this.runStats.cleared || this.currentWave > this.totalWaves;
  }

  getRunState() {
    return {
      currentWave: this.currentWave,
      totalWaves: this.totalWaves,
      playerConfig: { ...this.playerConfig },
      runStats: { ...this.runStats }
    };
  }

  getRunSummary() {
    return {
      cleared: this.runStats.cleared,
      wavesCompleted: this.runStats.battlesWon,
      totalWaves: this.totalWaves,
      totalTurns: this.runStats.totalTurns,
      damageDealt: this.runStats.damageDealt,
      damageTaken: this.runStats.damageTaken,
      playerSpecies: this.playerConfig.speciesId,
      playerLevel: this.playerConfig.level
    };
  }
}
