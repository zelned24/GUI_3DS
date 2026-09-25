/**
 * BattleEngine.js
 * Core combat simulation engine for PokéRogue 3DS.
 * Fully deterministic, modular, phase-based execution with explainable AI and reproducible replays.
 */

import { PhaseQueue } from './PhaseQueue.js';
import { TurnOrderResolver } from './resolvers/TurnOrderResolver.js';
import { AccuracyResolver } from './resolvers/AccuracyResolver.js';
import { DamageResolver } from './resolvers/DamageResolver.js';
import { StatusResolver } from './resolvers/StatusResolver.js';
import { AbilityResolver } from './resolvers/AbilityResolver.js';
import { AIAdapter } from './resolvers/AIAdapter.js';

export class BattleEngine {
  constructor(battleState) {
    this.state = battleState;
    this.listeners = new Map();
    this.phaseQueue = new PhaseQueue();
    this.turnHistory = [];
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
    return () => this.off(eventName, callback);
  }

  off(eventName, callback) {
    if (!this.listeners.has(eventName)) return;
    const filtered = this.listeners.get(eventName).filter(cb => cb !== callback);
    this.listeners.set(eventName, filtered);
  }

  /**
   * Deterministic event emission.
   * Uses monotonic sequence numbers instead of non-deterministic timestamps.
   */
  emit(eventName, payload = {}) {
    const seq = this.state.nextSequence();
    const event = {
      eventId: `ev_${seq}`,
      sequenceNumber: seq,
      type: eventName,
      phase: this.state.phase,
      ...payload
    };

    this.state.eventLog.push(event);
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach(cb => {
        try { cb(event); } catch (e) { console.error('Error in event listener:', e); }
      });
    }
    return event;
  }

  /**
   * Enqueues a full turn with Player move vs AI selected move.
   */
  queueTurn(playerMoveId) {
    if (this.state.player.active.fainted || this.state.enemy.active.fainted) {
      return false;
    }

    // Save snapshot of turn start for rewind
    this.turnHistory.push(this.state.createSnapshot());

    const playerPokemon = this.state.player.active;
    const enemyPokemon = this.state.enemy.active;

    // Resolve Player move
    const pMove = playerPokemon.moves.find(m => m.id === playerMoveId) || playerPokemon.moves[0];

    // Resolve AI decision with explainable candidate scores
    const aiDecision = AIAdapter.selectBestAction(enemyPokemon, playerPokemon, { weather: this.state.weather });
    this.state.lastAIDecision = aiDecision;
    const eMove = aiDecision.selectedCandidate?.move || enemyPokemon.moves[0];

    const playerAction = { user: playerPokemon, target: enemyPokemon, move: pMove, isPlayer: true };
    const enemyAction = { user: enemyPokemon, target: playerPokemon, move: eMove, isPlayer: false };

    // Resolve turn order
    const order = TurnOrderResolver.resolve(playerAction, enemyAction, this.state.rng);

    this.emit('TurnStarted', {
      turn: this.state.turn,
      playerMove: pMove.name,
      enemyMove: eMove.name,
      turnOrderReason: order.reason
    });

    this.phaseQueue.clear();
    this.phaseQueue.enqueue('SpeedOrderPhase', { order });
    this.phaseQueue.enqueue('ActionPhase', { action: order.first });
    this.phaseQueue.enqueue('ActionPhase', { action: order.second });
    this.phaseQueue.enqueue('TurnEndPhase', {});

    this.state.phase = 'SpeedOrderPhase';
    return true;
  }

  /**
   * Executes the next phase in the queue step-by-step.
   */
  step() {
    if (this.phaseQueue.length === 0) {
      return { done: true, phase: this.state.phase };
    }

    const current = this.phaseQueue.dequeue();
    this.state.phase = current.name;

    if (current.name === 'SpeedOrderPhase') {
      this.emit('TurnOrderResolved', {
        first: current.payload.order.first.user.nickname,
        second: current.payload.order.second.user.nickname,
        reason: current.payload.order.reason
      });
    } else if (current.name === 'ActionPhase') {
      this._resolveActionPhase(current.payload.action);
    } else if (current.name === 'TurnEndPhase') {
      this._resolveTurnEndPhase();
    }

    const done = this.phaseQueue.length === 0;
    return { done, phase: this.state.phase };
  }

  /**
   * Runs the entire turn synchronously until queue is empty.
   */
  runFullTurn(playerMoveId) {
    this.queueTurn(playerMoveId);
    while (this.phaseQueue.length > 0) {
      this.step();
    }
  }

  _resolveActionPhase(action) {
    const { user, target, move, isPlayer } = action;

    if (user.fainted) {
      return; // Cannot move if fainted earlier this turn
    }

    // 1. Status Check (e.g. 25% paralysis roll)
    const canMoveResult = StatusResolver.checkCanMove(user, this.state.rng, (ev, p) => this.emit(ev, p));
    if (!canMoveResult.canMove) {
      return;
    }

    this.emit('MoveStarted', { user: user.nickname, move: move.name, isPlayer });

    // 2. Accuracy Check
    const accResult = AccuracyResolver.resolve(user, target, move, this.state.rng);
    if (!accResult.hit) {
      this.emit('MoveMissed', {
        user: user.nickname,
        target: target.nickname,
        move: move.name,
        roll: accResult.roll,
        threshold: accResult.threshold
      });
      return;
    }

    this.emit('MoveHit', { user: user.nickname, target: target.nickname, move: move.name });

    // 3. Damage Calculation
    if (move.power > 0) {
      const breakdown = DamageResolver.resolve(user, target, move, this.state.rng, { weather: this.state.weather });
      this.state.damageBreakdown = breakdown;
      this.emit('DamageCalculated', { breakdown });

      // 4. Pre-Damage Abilities (e.g. Sturdy)
      const { finalDamage } = AbilityResolver.onPreDamageApplied(
        target,
        user,
        move,
        breakdown.finalDamage,
        (ev, p) => this.emit(ev, p)
      );

      // 5. Apply Damage
      const prevHp = target.currentHp;
      target.currentHp = Math.max(0, target.currentHp - finalDamage);
      const actualDamage = prevHp - target.currentHp;

      this.emit('DamageApplied', {
        target: target.nickname,
        damage: actualDamage,
        currentHp: target.currentHp,
        maxHp: target.maxHp
      });

      this.emit('HPChanged', {
        pokemon: target.nickname,
        currentHp: target.currentHp,
        maxHp: target.maxHp,
        isPlayer: !isPlayer
      });

      // 6. Post-Damage Abilities (e.g. Static contact paralysis)
      AbilityResolver.onPostDamageReceived(
        target,
        user,
        move,
        actualDamage,
        this.state.rng,
        (ev, p) => this.emit(ev, p)
      );

      // 7. Faint Check
      if (target.currentHp <= 0) {
        target.fainted = true;
        this.emit('PokemonFainted', { pokemon: target.nickname, isPlayer: !isPlayer });
        this.phaseQueue.clear();
        this._resolveTurnEndPhase();
        this.state.phase = 'BattleFinished';
      }
    }
  }

  _resolveTurnEndPhase() {
    // End-of-turn residual status damage (burn, poison)
    StatusResolver.resolveTurnEndStatus(this.state.player.active, (ev, p) => this.emit(ev, p));
    StatusResolver.resolveTurnEndStatus(this.state.enemy.active, (ev, p) => this.emit(ev, p));

    this.state.turn++;
    this.state.phase = this.state.player.active.fainted || this.state.enemy.active.fainted ? 'BattleFinished' : 'WaitingForCommand';
    this.emit('TurnEnded', { turn: this.state.turn });
  }

  rewindToPreviousTurn() {
    if (this.turnHistory.length === 0) return false;
    const previous = this.turnHistory.pop();
    this.state.restoreSnapshot(previous);
    this.phaseQueue.clear();
    this.emit('TurnRewound', { turn: this.state.turn });
    return true;
  }
}
