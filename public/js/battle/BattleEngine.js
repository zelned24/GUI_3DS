/**
 * BattleEngine.js
 * Core combat execution engine for PokéRogue 3DS.
 * Features:
 *  - Phase-based execution queue (MoveResolvePhase, AccuracyPhase, DamagePhase, EffectPhase, FaintCheckPhase)
 *  - Event Bus emitting granular battle events
 *  - Official Gen 9 damage breakdown calculation with STAB, type effectiveness, crit & RNG
 *  - Ability triggers (Static, Sturdy)
 *  - Reproducible deterministic steps for Battle Lab debugging & time-travel
 */

import { dataManager } from '../data/DataManager.js';

export class BattleEngine {
  constructor(battleState) {
    this.state = battleState;
    this.listeners = new Map();
    this.phaseQueue = [];
    this.currentAction = null;
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

  emit(eventName, payload) {
    const event = { type: eventName, ...payload, timestamp: Date.now() };
    this.state.eventLog.push(event);
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach(cb => {
        try { cb(event); } catch (e) { console.error('Error in event listener:', e); }
      });
    }
  }

  /**
   * Enqueue a full turn with Player move vs AI selected move
   */
  queueTurn(playerMoveId) {
    if (this.state.player.active.fainted || this.state.enemy.active.fainted) {
      return false;
    }

    // Save snapshot of turn start for rewind
    this.turnHistory.push(this.state.createSnapshot());

    this.emit('TurnStarted', { turn: this.state.turn });

    const playerPokemon = this.state.player.active;
    const enemyPokemon = this.state.enemy.active;

    const pMove = playerPokemon.moves.find(m => m.id === playerMoveId) || playerPokemon.moves[0];
    // Enemy AI: simple heuristic selection (choose highest base power or first available move)
    const eMove = enemyPokemon.moves.reduce((best, m) => (!best || m.power > best.power ? m : best), null) || enemyPokemon.moves[0];

    // Determine turn order based on priority and effective speed
    const pPriority = pMove.priority || 0;
    const ePriority = eMove.priority || 0;
    const pSpd = playerPokemon.getEffectiveStat('spd');
    const eSpd = enemyPokemon.getEffectiveStat('spd');

    let playerFirst = true;
    if (pPriority !== ePriority) {
      playerFirst = pPriority > ePriority;
    } else if (pSpd !== eSpd) {
      playerFirst = pSpd > eSpd;
    } else {
      playerFirst = this.state.random() > 0.5;
    }

    const firstAction = playerFirst
      ? { user: playerPokemon, target: enemyPokemon, move: pMove, isPlayer: true }
      : { user: enemyPokemon, target: playerPokemon, move: eMove, isPlayer: false };

    const secondAction = playerFirst
      ? { user: enemyPokemon, target: playerPokemon, move: eMove, isPlayer: false }
      : { user: playerPokemon, target: enemyPokemon, move: pMove, isPlayer: true };

    this.phaseQueue = [
      { phase: 'MoveResolvePhase', action: firstAction },
      { phase: 'MoveResolvePhase', action: secondAction },
      { phase: 'EndTurnPhase', action: null }
    ];

    this.state.phase = this.phaseQueue[0].phase;
    return true;
  }

  /**
   * Execute the next phase in the queue step-by-step
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
   * Run entire turn synchronously until queue is empty
   */
  runFullTurn(playerMoveId) {
    this.queueTurn(playerMoveId);
    while (this.phaseQueue.length > 0) {
      this.step();
    }
  }

  _resolveMove(action) {
    const { user, target, move, isPlayer } = action;

    if (user.fainted) {
      return; // Cannot move if already fainted earlier in turn
    }

    // Check status prevention (paralysis 25% chance)
    if (user.status === 'paralysis' && this.state.random() < 0.25) {
      this.emit('StatusPreventedMove', { user: user.nickname, status: 'paralysis' });
      return;
    }

    this.emit('MoveStarted', { user: user.nickname, move: move.name, isPlayer });

    // Accuracy Check
    if (move.accuracy && move.accuracy < 100) {
      const roll = this.state.random() * 100;
      if (roll > move.accuracy) {
        this.emit('MoveMissed', { user: user.nickname, target: target.nickname, move: move.name });
        return;
      }
    }

    this.emit('MoveHit', { user: user.nickname, target: target.nickname, move: move.name });

    // Damage Calculation
    if (move.power > 0) {
      const breakdown = this.calculateDamage(user, target, move);
      this.state.damageBreakdown = breakdown;

      this.emit('DamageCalculated', { breakdown });

      // Apply damage
      const prevHp = target.currentHp;
      let damageToApply = breakdown.finalDamage;

      // Sturdy check: if target at full HP and would faint, retain 1 HP
      if (target.ability === 'Sturdy' && target.currentHp === target.maxHp && damageToApply >= target.currentHp) {
        damageToApply = target.currentHp - 1;
        this.emit('AbilityTriggered', { pokemon: target.nickname, ability: 'Sturdy', effect: 'Endured the hit!' });
      }

      target.currentHp = Math.max(0, target.currentHp - damageToApply);
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

      // Contact Ability check (Static: 30% chance of paralysis on contact if move makes contact)
      if (target.ability === 'Static' && move.category === 'Physical' && user.status === null) {
        if (this.state.random() < 0.30) {
          user.status = 'paralysis';
          this.emit('AbilityTriggered', { pokemon: target.nickname, ability: 'Static', effect: `Paralyzed ${user.nickname}!` });
          this.emit('StatusApplied', { pokemon: user.nickname, status: 'paralysis' });
        }
      }

      // Check Faint
      if (target.currentHp <= 0) {
        target.fainted = true;
        this.emit('PokemonFainted', { pokemon: target.nickname, isPlayer: !isPlayer });
        this.phaseQueue = [];
        this._resolveEndTurn();
        this.state.phase = 'BattleFinished';
      }
    }
  }


  calculateDamage(attacker, defender, move) {
    const level = attacker.level;
    const power = move.power;

    // Determine stats based on Physical / Special
    const isSpecial = move.category === 'Special';
    const aStat = isSpecial ? attacker.getEffectiveStat('spatk') : attacker.getEffectiveStat('atk');
    const dStat = isSpecial ? defender.getEffectiveStat('spdef') : defender.getEffectiveStat('def');

    // STAB (Same-Type Attack Bonus)
    const stab = attacker.types.includes(move.type) ? 1.5 : 1.0;

    // Type Effectiveness
    const typeEff = dataManager.getTypeMultiplier(move.type, defender.types);

    // Critical Hit (approx 1/24 ~ 4.17%)
    const isCrit = this.state.random() < (1 / 24);
    const critMult = isCrit ? 1.5 : 1.0;

    // Random Factor: 0.85 to 1.00
    const randMult = this.state.randomRange(0.85, 1.0);

    // Official Gen 9 damage formula
    const baseDamage = Math.floor(Math.floor((Math.floor((2 * level) / 5 + 2) * power * aStat) / dStat) / 50) + 2;
    const finalDamage = Math.max(1, Math.floor(baseDamage * stab * typeEff * critMult * randMult));

    return {
      attacker: attacker.nickname,
      defender: defender.nickname,
      move: move.name,
      moveType: move.type,
      category: move.category,
      basePower: power,
      attackStat: aStat,
      defenseStat: dStat,
      baseDamage,
      stab,
      typeEffectiveness: typeEff,
      isCritical: isCrit,
      criticalMultiplier: critMult,
      randomFactor: parseFloat(randMult.toFixed(3)),
      finalDamage
    };
  }

  _resolveEndTurn() {
    this.state.turn++;
    this.state.phase = 'WaitingForCommand';
    this.emit('TurnEnded', { turn: this.state.turn });
  }

  rewindToPreviousTurn() {
    if (this.turnHistory.length === 0) return false;
    const previous = this.turnHistory.pop();
    this.state.restoreSnapshot(previous);
    this.phaseQueue = [];
    this.emit('TurnRewound', { turn: this.state.turn });
    return true;
  }
}
