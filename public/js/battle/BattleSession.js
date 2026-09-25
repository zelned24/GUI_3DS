/**
 * BattleSession.js
 * Match lifecycle orchestrator for PokéRogue 3DS.
 * Encapsulates BattleState, BattleEngine, command dispatching, event logging, and restart.
 * 100% DOM-free and headless.
 */

import { BattleState, PokemonBattleData } from './BattleState.js';
import { BattleEngine } from './BattleEngine.js';
import { SelectMoveCommand, ForfeitCommand } from './BattleCommand.js';
import { dataManager } from '../data/DataManager.js';

export class BattleSession {
  /**
   * @param {object} options
   * @param {string} [options.playerSpeciesId='pikachu']
   * @param {string} [options.enemySpeciesId='golem']
   * @param {number} [options.playerLevel=20]
   * @param {number} [options.enemyLevel=20]
   * @param {number} [options.seed=4242]
   */
  constructor(options = {}) {
    this.options = {
      playerSpeciesId: options.playerSpeciesId || 'pikachu',
      enemySpeciesId: options.enemySpeciesId || 'golem',
      playerLevel: options.playerLevel || 20,
      enemyLevel: options.enemyLevel || 20,
      seed: options.seed || 4242
    };

    this.state = null;
    this.engine = null;
    this.commandLog = [];
    this.initMatch();
  }

  initMatch() {
    const pSpecies = dataManager.getSpecies(this.options.playerSpeciesId) || dataManager.getAllSpecies()[0];
    const eSpecies = dataManager.getSpecies(this.options.enemySpeciesId) || dataManager.getAllSpecies()[1] || pSpecies;

    if (!pSpecies || !eSpecies) {
      throw new Error(`Unable to initialize BattleSession: missing species definitions for [${this.options.playerSpeciesId}, ${this.options.enemySpeciesId}]`);
    }

    const playerBattler = new PokemonBattleData(pSpecies, this.options.playerLevel);
    const enemyBattler = new PokemonBattleData(eSpecies, this.options.enemyLevel);

    this.state = new BattleState(playerBattler, enemyBattler, this.options.seed);
    this.engine = new BattleEngine(this.state);
    this.commandLog = [];
  }

  /**
   * Dispatches a user command to the engine.
   * @param {import('./BattleCommand.js').BattleCommand} command
   * @returns {{ success: boolean, reason?: string }}
   */
  dispatch(command) {
    if (!command) {
      return { success: false, reason: 'Command is null' };
    }
    const result = this.engine.executeCommand(command);
    if (result.success) {
      this.commandLog.push(command.toJSON());
    }
    return result;
  }

  /**
   * Convenience helper to dispatch a move selection.
   * @param {string} moveId
   */
  selectMove(moveId) {
    const cmd = new SelectMoveCommand('player', moveId);
    return this.dispatch(cmd);
  }

  /**
   * Convenience helper to forfeit the match.
   */
  forfeit() {
    const cmd = new ForfeitCommand('player');
    return this.dispatch(cmd);
  }

  isConcluded() {
    return this.state.phase === 'BattleFinished' || Boolean(this.state.winner);
  }

  getWinner() {
    return this.state.winner;
  }

  restart() {
    this.initMatch();
  }

  getRecentEvents(count = 10) {
    return this.state.eventLog.slice(-count);
  }
}
