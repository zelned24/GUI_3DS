/**
 * AccuracyResolver.js
 * Checks move accuracy against user accuracy stages, target evasion stages, and PRNG roll.
 */

export class AccuracyResolver {
  static resolve(user, target, move, rng) {
    // Moves with null / negative accuracy or 0 (self-targeting / bypass) always hit
    if (!move.accuracy || move.accuracy <= 0 || move.accuracy >= 100) {
      return { hit: true, roll: 0, threshold: 100, bypass: true };
    }

    const accStage = Math.max(-6, Math.min(6, user.statStages?.acc || 0));
    const evaStage = Math.max(-6, Math.min(6, target.statStages?.eva || 0));
    const netStage = Math.max(-6, Math.min(6, accStage - evaStage));

    const stageMultipliers = {
      '-6': 3 / 9, '-5': 3 / 8, '-4': 3 / 7, '-3': 3 / 6, '-2': 3 / 5, '-1': 3 / 4,
      '0': 1.0,
      '1': 4 / 3, '2': 5 / 3, '3': 6 / 3, '4': 7 / 3, '5': 8 / 3, '6': 9 / 3
    };

    const threshold = Math.floor(move.accuracy * (stageMultipliers[netStage.toString()] || 1.0));
    const roll = rng.nextInt(1, 100);
    const hit = roll <= threshold;

    return {
      hit,
      roll,
      threshold,
      bypass: false
    };
  }
}
