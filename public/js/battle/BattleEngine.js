/**
 * BattleEngine.js
 * Core combat orchestrator for PokéRogue 3DS.
 * Features:
 *  - Modular phase-based execution queue using BattlePhases
 *  - Event Bus emitting granular typed battle events (BattleEvents)
 *  - Direct support for BattleCommand (SelectMoveCommand, ForfeitCommand)
 *  - Preserves 100% of Gen 9 damage breakdown calculation with STAB, type effectiveness, crit & RNG
 *  - Ability triggers (Static, Sturdy)
 *  - Reproducible deterministic steps for Battle Lab debugging & time-travel
 */

import { BattleEventTypes, createBattleEvent } from './BattleEvents.js';
import { SelectMoveCommand, ForfeitCommand } from './BattleCommand.js';
import {
  ActionOrderPhase,
  MoveExecutionPhase,
  DamagePhase,
  EffectPhase,
  FaintCheckPhase,
  TurnEndPhase
} from './BattlePhases.js';

export class BattleEngine {
  constructor(battleState) {
    this.state = battleState;
    this.listeners = new Map();
    this.phaseQueue = [];
    this.currentAction = null;
    this.turnHistory = [];
    this.stepCounter = 0;
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
    return () => this.off(eventName, callback);
  }

  onEvent(callback) {
    return this.on('*', callback);
  }

  off(eventName, callback) {
    if (!this.listeners.has(eventName)) return;
    const filtered = this.listeners.get(eventName).filter(cb => cb !== callback);
    this.listeners.set(eventName, filtered);
  }

  emit(eventName, payload = {}) {
    this.stepCounter = (this.stepCounter || 0) + 1;
    const event = createBattleEvent(eventName, payload, this.state?.turn || 1, this.stepCounter);
    this.state.eventLog.push(event);

    // Call specific listeners
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach(cb => {
        try { cb(event); } catch (e) { console.error('Error in event listener:', e); }
      });
    }

    // Call wildcard onEvent listeners
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(cb => {
        try { cb(event); } catch (e) { console.error('Error in onEvent listener:', e); }
      });
    }

    return event;
  }

  /**
   * Executes a high-level battle command.
   * @param {import('./BattleCommand.js').BattleCommand} command
   * @returns {{ success: boolean, reason?: string }}
   */
  executeCommand(command) {
    if (!command || typeof command.validate !== 'function') {
      return { success: false, reason: 'Invalid command object' };
    }

    const validation = command.validate(this.state);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    if (command instanceof ForfeitCommand || command.type === 'FORFEIT') {
      const winner = command.actorId === 'player' ? 'enemy' : 'player';
      this.state.winner = winner;
      this.state.phase = 'BattleFinished';
      this.emit(BattleEventTypes.BattleConcluded, { winner, reason: 'forfeit' });
      return { success: true };
    }

    if (command instanceof SelectMoveCommand || command.type === 'SELECT_MOVE') {
      this.emit(BattleEventTypes.MoveSelected, {
        actorId: command.actorId,
        moveId: command.moveId
      });
      const queued = this.queueTurn(command.moveId);
      if (!queued) {
        return { success: false, reason: 'Unable to queue turn' };
      }
      while (this.phaseQueue.length > 0) {
        this.step();
      }
      return { success: true };
    }

    return { success: false, reason: `Unknown command type: ${command.type}` };
  }

  /**
   * Enqueue a full turn with Player move vs AI selected move.
   * Preserves original API for backwards compatibility.
   */
  queueTurn(playerMoveId) {
    if (this.state.player.active.fainted || this.state.enemy.active.fainted) {
      return false;
    }

    // Save snapshot of turn start for rewind
    this.turnHistory.push(this.state.createSnapshot());

    this.emit(BattleEventTypes.TurnStarted, { turn: this.state.turn });

    const playerPokemon = this.state.player.active;
    const enemyPokemon = this.state.enemy.active;

    const pMove = playerPokemon.moves.find(m => String(m.id).toLowerCase() === String(playerMoveId).toLowerCase()) || playerPokemon.moves[0];
    // Enemy AI: simple heuristic selection (choose highest base power or first available move)
    const eMove = enemyPokemon.moves.reduce((best, m) => (!best || m.power > best.power ? m : best), null) || enemyPokemon.moves[0];

    // Determine turn order using ActionOrderPhase
    const { firstAction, secondAction } = ActionOrderPhase.resolve(this.state, pMove, eMove);

    this.phaseQueue = [
      { phase: 'MoveResolvePhase', action: firstAction },
      { phase: 'MoveResolvePhase', action: secondAction },
      { phase: 'EndTurnPhase', action: null }
    ];

    this.state.phase = this.phaseQueue[0].phase;
    return true;
  }

  /**
   * Execute the next phase in the queue step-by-step.
   */
  step() {
    if (this.phaseQueue.length === 0) {
      return { done: true, phase: this.state.phase };
    }

    const item = this.phaseQueue.shift();
    this.state.phase = item.phase;

    if (item.phase === 'MoveResolvePhase') {
      this._resolveMove(item.action);
    } else if (item.phase === 'EndTurnPhase') {
      this._resolveEndTurn();
    }

    const done = this.phaseQueue.length === 0;
    return { done, phase: this.state.phase };
  }

  /**
   * Run entire turn synchronously until queue is empty.
   */
  runFullTurn(playerMoveId) {
    this.queueTurn(playerMoveId);
    while (this.phaseQueue.length > 0) {
      this.step();
    }
  }

  _resolveMove(action) {
    const { user, target, move, isPlayer } = action;

    // Move execution & accuracy check via MoveExecutionPhase
    const execResult = MoveExecutionPhase.resolve(this, action);
    if (!execResult.canProceed) {
      return;
    }

    // Damage Calculation and application via DamagePhase
    if (move.power > 0) {
      const breakdown = DamagePhase.calculateDamage(this.state, user, target, move);
      DamagePhase.apply(this, action, breakdown);

      // Effect resolution (Static, etc.)
      EffectPhase.resolve(this, action);

      // Faint check
      const faintResult = FaintCheckPhase.resolve(this, target, !isPlayer);
      if (faintResult.fainted) {
        this.phaseQueue = [];
        this._resolveEndTurn();
        this.state.phase = 'BattleFinished';
      }
    }
  }

  /**
   * Backward-compatible bridge to calculateDamage.
   */
  calculateDamage(attacker, defender, move) {
    return DamagePhase.calculateDamage(this.state, attacker, defender, move);
  }

  _resolveEndTurn() {
    TurnEndPhase.resolve(this);
  }

  rewindToPreviousTurn() {
    if (this.turnHistory.length === 0) return false;
    const previous = this.turnHistory.pop();
    this.state.restoreSnapshot(previous);
    this.phaseQueue = [];
    this.emit(BattleEventTypes.TurnRewound, { turn: this.state.turn });
    return true;
  }
}
