/**
 * BattleState.js
 * Domain model for PokéRogue 3DS Battle Engine and Battle Lab.
 * Fully deterministic: utilizes seeded PRNG, sequential event numbers,
 * complete state snapshots, and persistent/temporal data separation.
 */

import { PokemonBattleData, PokemonPersistentData } from './PokemonDataModels.js';
import { RNG } from './RNG.js';

export { PokemonBattleData, PokemonPersistentData };

export class BattleState {
  constructor(playerPokemon, enemyPokemon, seed = 12345) {
    this.seed = Number(seed) >>> 0;
    this.battleId = `battle_seed_${this.seed}`;
    this.rng = new RNG(this.seed);
    this.sequenceNumber = 0; // Monotonic event sequence counter

    this.turn = 1;
    this.wave = 1;
    this.phase = 'WaitingForCommand'; // CommandPhase, SpeedOrderPhase, ActionPhase, TurnEndPhase, Finished
    this.weather = 'none'; // 'sun', 'rain', 'sandstorm', 'snow', 'none'
    this.terrain = 'none'; // 'electric', 'grassy', 'misty', 'psychic', 'none'

    // Battlers
    const pData = playerPokemon instanceof PokemonBattleData ? playerPokemon : new PokemonBattleData(playerPokemon);
    const eData = enemyPokemon instanceof PokemonBattleData ? enemyPokemon : new PokemonBattleData(enemyPokemon);

    this.player = {
      name: 'Player',
      active: pData,
      party: [pData]
    };

    this.enemy = {
      name: 'Wild Foe',
      active: eData,
      party: [eData]
    };

    this.eventLog = [];
    this.damageBreakdown = null; // Last damage calculation details
    this.lastAIDecision = null; // Explainable AI inspection
    this.arenaTags = new Set(); // spikes, stealth_rock, etc.
  }

  /**
   * Deterministic PRNG float proxy [0, 1)
   */
  random() {
    return this.rng.nextFloat();
  }

  randomRange(min, max) {
    return this.rng.nextRange(min, max);
  }

  get rngState() {
    return this.rng.state;
  }

  set rngState(val) {
    this.rng.state = val >>> 0;
  }

  /**
   * Allocates the next deterministic event sequence number.
   */
  nextSequence() {
    return ++this.sequenceNumber;
  }

  createSnapshot() {
    return {
      sequenceNumber: this.sequenceNumber,
      turn: this.turn,
      wave: this.wave,
      phase: this.phase,
      weather: this.weather,
      terrain: this.terrain,
      rngState: this.rng.getState(),
      player: {
        active: this.player.active ? this.player.active.clone() : null
      },
      enemy: {
        active: this.enemy.active ? this.enemy.active.clone() : null
      },
      arenaTags: Array.from(this.arenaTags),
      eventLogCount: this.eventLog.length
    };
  }

  restoreSnapshot(snapshot) {
    this.sequenceNumber = snapshot.sequenceNumber;
    this.turn = snapshot.turn;
    this.wave = snapshot.wave;
    this.phase = snapshot.phase;
    this.weather = snapshot.weather;
    this.terrain = snapshot.terrain;
    this.rng.setState(snapshot.rngState);
    if (snapshot.player.active) this.player.active = snapshot.player.active.clone();
    if (snapshot.enemy.active) this.enemy.active = snapshot.enemy.active.clone();
    this.arenaTags = new Set(snapshot.arenaTags || []);
  }
}
