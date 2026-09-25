/**
 * DamageResolver.js
 * Implements the official Gen 9 combat damage formula with step-by-step telemetry.
 * Formula:
 *   BaseDamage = floor(floor((floor((2 * Level) / 5 + 2) * Power * Attack) / Defense) / 50) + 2
 *   FinalDamage = max(1, floor(BaseDamage * Weather * Critical * Random * STAB * TypeEffectiveness * Burn * Other))
 */

import { dataManager } from '../../data/DataManager.js';

export class DamageResolver {
  static resolve(attacker, defender, move, rng, battleContext = {}) {
    const level = attacker.level;
    const power = move.power || 0;

    if (power <= 0) {
      return {
        level,
        power: 0,
        attackStat: 0,
        defenseStat: 0,
        baseFormulaValue: 0,
        stab: 1.0,
        typeEffectiveness: 1.0,
        isCritical: false,
        criticalMultiplier: 1.0,
        weatherMultiplier: 1.0,
        randomFactor: 1.0,
        finalDamage: 0
      };
    }

    // 1. Choose physical vs special stats
    const isSpecial = move.category === 'Special';
    const attackStat = isSpecial ? attacker.getEffectiveStat('spatk') : attacker.getEffectiveStat('atk');
    const defenseStat = isSpecial ? defender.getEffectiveStat('spdef') : defender.getEffectiveStat('def');

    // 2. Base formula value
    const levelTerm = Math.floor((2 * level) / 5 + 2);
    const offensiveTerm = Math.floor(levelTerm * power * attackStat);
    const defenseTerm = Math.floor(offensiveTerm / Math.max(1, defenseStat));
    const baseFormulaValue = Math.floor(defenseTerm / 50) + 2;

    // 3. Weather multiplier (e.g. Rain boosts Water, cuts Fire; Sun boosts Fire, cuts Water)
    let weatherMultiplier = 1.0;
    const weather = battleContext.weather || 'none';
    if (weather === 'rain') {
      if (move.type === 'WATER') weatherMultiplier = 1.5;
      if (move.type === 'FIRE') weatherMultiplier = 0.5;
    } else if (weather === 'sun') {
      if (move.type === 'FIRE') weatherMultiplier = 1.5;
      if (move.type === 'WATER') weatherMultiplier = 0.5;
    }

    // 4. Critical hit check (~4.17% standard 1/24)
    const critRoll = rng.nextFloat();
    const isCritical = critRoll < (1 / 24);
    const criticalMultiplier = isCritical ? 1.5 : 1.0;

    // 5. Deterministic random factor [0.85, 1.00]
    const randomFactor = rng.nextRange(0.85, 1.0);

    // 6. STAB (Same-Type Attack Bonus): 1.5x
    const stab = attacker.types.map(t => t.toUpperCase()).includes(move.type.toUpperCase()) ? 1.5 : 1.0;

    // 7. Type Effectiveness multiplier (0x, 0.25x, 0.5x, 1x, 2x, 4x)
    const typeEffectiveness = dataManager.getTypeMultiplier(move.type, defender.types);

    // 8. Burn physical attack penalty (0.5x if burned and not Guts)
    let burnMultiplier = 1.0;
    if (attacker.status === 'burn' && move.category === 'Physical' && attacker.ability !== 'Guts') {
      burnMultiplier = 0.5;
    }

    // 9. Final damage
    let finalDamage = 0;
    if (typeEffectiveness > 0) {
      const modifierProduct = weatherMultiplier * criticalMultiplier * randomFactor * stab * typeEffectiveness * burnMultiplier;
      finalDamage = Math.max(1, Math.floor(baseFormulaValue * modifierProduct));
    }

    return {
      attacker: attacker.nickname,
      defender: defender.nickname,
      move: move.name,
      moveType: move.type,
      category: move.category,
      level,
      power,
      attackStat,
      defenseStat,
      baseFormulaValue,
      weatherMultiplier,
      criticalMultiplier,
      isCritical,
      randomFactor: parseFloat(randomFactor.toFixed(3)),
      stab,
      typeEffectiveness,
      burnMultiplier,
      finalDamage
    };
  }
}
