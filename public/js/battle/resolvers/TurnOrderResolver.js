/**
 * TurnOrderResolver.js
 * Computes deterministic turn execution order based on move priority brackets,
 * effective speeds, and deterministic PRNG tie-breaking.
 */

export class TurnOrderResolver {
  static resolve(playerAction, enemyAction, rng) {
    const pPriority = playerAction.move?.priority || 0;
    const ePriority = enemyAction.move?.priority || 0;

    // 1. Move Priority Bracket comparison
    if (pPriority !== ePriority) {
      return pPriority > ePriority
        ? { first: playerAction, second: enemyAction, reason: `Priority (+${pPriority} vs +${ePriority})` }
        : { first: enemyAction, second: playerAction, reason: `Priority (+${ePriority} vs +${pPriority})` };
    }

    // 2. Effective Speed comparison
    const pSpd = playerAction.user.getEffectiveStat('spd');
    const eSpd = enemyAction.user.getEffectiveStat('spd');

    if (pSpd !== eSpd) {
      return pSpd > eSpd
        ? { first: playerAction, second: enemyAction, reason: `Speed (${pSpd} vs ${eSpd})` }
        : { first: enemyAction, second: playerAction, reason: `Speed (${eSpd} vs ${pSpd})` };
    }

    // 3. Deterministic Speed Tie roll
    const tieRoll = rng.nextFloat();
    return tieRoll < 0.5
      ? { first: playerAction, second: enemyAction, reason: 'Speed Tie (Deterministic Coin Flip)' }
      : { first: enemyAction, second: playerAction, reason: 'Speed Tie (Deterministic Coin Flip)' };
  }
}
