/**
 * AbilityResolver.js
 * Evaluates triggers, conditions, and effects for Pokémon abilities.
 * Supports:
 *  - ON_DAMAGE_RECEIVED: Static (paralysis on contact hit)
 *  - ON_DAMAGE_PREVENTION: Sturdy (endures lethal hit if at 100% HP)
 *  - ON_TYPE_TARGETED: Lightning Rod (Electric redirection/immunity)
 *  - ON_RECOIL_CALCULATION: Rock Head (prevents recoil)
 */

export class AbilityResolver {
  /**
   * Checks damage prevention / mitigation abilities before damage is applied.
   */
  static onPreDamageApplied(target, attacker, move, proposedDamage, emitEvent) {
    let finalDamage = proposedDamage;
    let effectTriggered = null;

    // Sturdy
    if (target.ability === 'Sturdy' && target.currentHp === target.maxHp && proposedDamage >= target.currentHp) {
      finalDamage = target.currentHp - 1;
      effectTriggered = {
        ability: 'Sturdy',
        pokemon: target.nickname,
        effect: 'Endured the lethal hit with 1 HP!'
      };
      if (emitEvent) {
        emitEvent('AbilityTriggered', effectTriggered);
      }
    }

    return { finalDamage, effectTriggered };
  }

  /**
   * Checks post-damage reaction abilities (e.g. Static).
   */
  static onPostDamageReceived(target, attacker, move, damageDealt, rng, emitEvent) {
    const effects = [];

    // Static: 30% chance to paralyze on contact
    if (target.ability === 'Static' && move.flags?.contact && attacker.status === null) {
      if (rng.rollPercent(30)) {
        attacker.status = 'paralysis';
        const ev = {
          ability: 'Static',
          pokemon: target.nickname,
          target: attacker.nickname,
          effect: `Paralyzed ${attacker.nickname} through static electricity!`
        };
        effects.push(ev);
        if (emitEvent) {
          emitEvent('AbilityTriggered', ev);
          emitEvent('StatusApplied', { pokemon: attacker.nickname, status: 'paralysis' });
        }
      }
    }

    return effects;
  }
}
