/**
 * BattlePhases.js
 * Modular turn phases for PokéRogue 3DS Battle Engine.
 * Follows the AGENTS.md contract:
 * Phase -> Resolver -> Effect -> Event -> Command
 * Preserves 100% of Gen 9 damage calculation, STAB, type effectiveness, and ability triggers.
 */

import { dataManager } from '../data/DataManager.js';
import { BattleEventTypes } from './BattleEvents.js';

/**
 * Phase 1: Determine action execution order between player and enemy battlers.
 */
export class ActionOrderPhase {
  /**
   * @param {import('./BattleState.js').BattleState} state
   * @param {object} pMove Player's chosen Move object
   * @param {object} eMove Enemy's chosen Move object
   * @returns {{ firstAction: object, secondAction: object }}
   */
  static resolve(state, pMove, eMove) {
    const playerPokemon = state.player.active;
    const enemyPokemon = state.enemy.active;

    const pPriority = pMove?.priority || 0;
    const ePriority = eMove?.priority || 0;
    const pSpd = playerPokemon.getEffectiveStat('spd');
    const eSpd = enemyPokemon.getEffectiveStat('spd');

    let playerFirst = true;
    if (pPriority !== ePriority) {
      playerFirst = pPriority > ePriority;
    } else if (pSpd !== eSpd) {
      playerFirst = pSpd > eSpd;
    } else {
      playerFirst = state.random() > 0.5;
    }

    const firstAction = playerFirst
      ? { user: playerPokemon, target: enemyPokemon, move: pMove, isPlayer: true }
      : { user: enemyPokemon, target: playerPokemon, move: eMove, isPlayer: false };

    const secondAction = playerFirst
      ? { user: enemyPokemon, target: playerPokemon, move: eMove, isPlayer: false }
      : { user: playerPokemon, target: enemyPokemon, move: pMove, isPlayer: true };

    return { firstAction, secondAction, playerFirst };
  }
}

/**
 * Phase 2: Resolves status prevention, move accuracy, and initial hit announcement.
 */
export class MoveExecutionPhase {
  /**
   * @param {import('./BattleEngine.js').BattleEngine} engine
   * @param {object} action { user, target, move, isPlayer }
   * @returns {{ canProceed: boolean }}
   */
  static resolve(engine, action) {
    const { user, target, move, isPlayer } = action;

    if (user.fainted) {
      return { canProceed: false };
    }

    // Check status prevention (paralysis 25% chance)
    if (user.status === 'paralysis' && engine.state.random() < 0.25) {
      engine.emit(BattleEventTypes.StatusPreventedMove, { user: user.nickname, status: 'paralysis' });
      return { canProceed: false };
    }

    engine.emit(BattleEventTypes.MoveStarted, { user: user.nickname, move: move.name, moveId: move.id, isPlayer });

    // Accuracy Check
    if (move.accuracy && move.accuracy < 100) {
      const roll = engine.state.random() * 100;
      if (roll > move.accuracy) {
        engine.emit(BattleEventTypes.MoveMissed, { user: user.nickname, target: target.nickname, move: move.name, moveId: move.id });
        return { canProceed: false };
      }
    }

    engine.emit(BattleEventTypes.MoveHit, { user: user.nickname, target: target.nickname, move: move.name, moveId: move.id });
    return { canProceed: true };
  }
}

/**
 * Phase 3: Gen 9 official damage formula calculation and hit resolution.
 */
export class DamagePhase {
  /**
   * Computes mathematical Gen 9 breakdown using exact preserved logic.
   */
  static calculateDamage(state, attacker, defender, move) {
    const level = attacker.level;
    const power = move.power;

    const isSpecial = move.category === 'Special';
    const aStat = isSpecial ? attacker.getEffectiveStat('spatk') : attacker.getEffectiveStat('atk');
    const dStat = isSpecial ? defender.getEffectiveStat('spdef') : defender.getEffectiveStat('def');

    // STAB (Same-Type Attack Bonus)
    const stab = attacker.types.includes(move.type) ? 1.5 : 1.0;

    // Type Effectiveness
    const typeEff = dataManager.getTypeMultiplier(move.type, defender.types);

    // Critical Hit (approx 1/24 ~ 4.17%)
    const isCrit = state.random() < (1 / 24);
    const critMult = isCrit ? 1.5 : 1.0;

    // Random Factor: 0.85 to 1.00
    const randMult = state.randomRange(0.85, 1.0);

    // Official Gen 9 damage formula
    const baseDamage = Math.floor(Math.floor((Math.floor((2 * level) / 5 + 2) * power * aStat) / dStat) / 50) + 2;
    const finalDamage = Math.max(1, Math.floor(baseDamage * stab * typeEff * critMult * randMult));

    return {
      attacker: attacker.nickname,
      defender: defender.nickname,
      move: move.name,
      moveId: move.id,
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

  /**
   * Executes damage application onto target Pokémon.
   */
  static apply(engine, action, breakdown) {
    const { user, target, move, isPlayer } = action;

    engine.state.damageBreakdown = breakdown;
    engine.emit(BattleEventTypes.DamageCalculated, { breakdown });

    if (breakdown.isCritical) {
      engine.emit(BattleEventTypes.CriticalHit, { target: target.nickname });
    }

    if (breakdown.typeEffectiveness !== 1.0) {
      engine.emit(BattleEventTypes.EffectivenessChanged, {
        target: target.nickname,
        multiplier: breakdown.typeEffectiveness
      });
    }

    const prevHp = target.currentHp;
    let damageToApply = breakdown.finalDamage;

    // Sturdy check: if target at full HP and would faint, retain 1 HP
    if (target.ability === 'Sturdy' && target.currentHp === target.maxHp && damageToApply >= target.currentHp) {
      damageToApply = target.currentHp - 1;
      engine.emit(BattleEventTypes.AbilityTriggered, {
        pokemon: target.nickname,
        ability: 'Sturdy',
        effect: 'Endured the hit!'
      });
    }

    target.currentHp = Math.max(0, target.currentHp - damageToApply);
    const actualDamage = prevHp - target.currentHp;

    engine.emit(BattleEventTypes.DamageApplied, {
      target: target.nickname,
      damage: actualDamage,
      currentHp: target.currentHp,
      maxHp: target.maxHp
    });

    engine.emit(BattleEventTypes.HPChanged, {
      pokemon: target.nickname,
      currentHp: target.currentHp,
      maxHp: target.maxHp,
      isPlayer: !isPlayer
    });

    return actualDamage;
  }
}

/**
 * Phase 4: Resolves secondary effects and contact abilities (e.g. Static).
 */
export class EffectPhase {
  static resolve(engine, action) {
    const { user, target, move } = action;

    // Contact Ability check (Static: 30% chance of paralysis on physical contact)
    if (target.ability === 'Static' && move.category === 'Physical' && user.status === null) {
      if (engine.state.random() < 0.30) {
        user.status = 'paralysis';
        engine.emit(BattleEventTypes.AbilityTriggered, {
          pokemon: target.nickname,
          ability: 'Static',
          effect: `Paralyzed ${user.nickname}!`
        });
        engine.emit(BattleEventTypes.StatusApplied, { pokemon: user.nickname, status: 'paralysis' });
      }
    }
  }
}

/**
 * Phase 5: Checks whether any battler has fainted and updates victory/defeat status.
 */
export class FaintCheckPhase {
  /**
   * @returns {{ fainted: boolean, winner: string|null }}
   */
  static resolve(engine, target, isPlayerTarget) {
    if (target.currentHp <= 0) {
      target.fainted = true;
      engine.emit(BattleEventTypes.PokemonFainted, {
        pokemon: target.nickname,
        isPlayer: isPlayerTarget
      });

      const winner = isPlayerTarget ? 'enemy' : 'player';
      engine.state.winner = winner;
      engine.state.phase = 'BattleFinished';

      engine.emit(BattleEventTypes.BattleConcluded, {
        winner,
        reason: `${target.nickname} fainted`
      });

      return { fainted: true, winner };
    }
    return { fainted: false, winner: null };
  }
}

/**
 * Phase 6: Closes the current turn and advances the battle counter.
 */
export class TurnEndPhase {
  static resolve(engine) {
    if (engine.state.phase !== 'BattleFinished') {
      engine.state.turn++;
      engine.state.phase = 'WaitingForCommand';
    }
    engine.emit(BattleEventTypes.TurnEnded, { turn: engine.state.turn });
  }
}
