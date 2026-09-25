/**
 * StatusResolver.js
 * Handles status condition effects (Paralysis, Burn, Poison, Sleep, Freeze).
 */

export class StatusResolver {
  /**
   * Checks if status prevents moving this turn.
   */
  static checkCanMove(pokemon, rng, emitEvent) {
    if (!pokemon.status) return { canMove: true };

    if (pokemon.status === 'paralysis') {
      // 25% chance to be fully paralyzed
      if (rng.rollPercent(25)) {
        if (emitEvent) {
          emitEvent('StatusPreventedMove', {
            pokemon: pokemon.nickname,
            status: 'paralysis',
            message: `${pokemon.nickname} is paralyzed! It can't move!`
          });
        }
        return { canMove: false, reason: 'paralysis' };
      }
    }

    if (pokemon.status === 'sleep') {
      pokemon.statusTurns = (pokemon.statusTurns || 0) + 1;
      if (pokemon.statusTurns >= 3 || rng.rollPercent(33)) {
        pokemon.status = null;
        pokemon.statusTurns = 0;
        if (emitEvent) {
          emitEvent('StatusEnded', { pokemon: pokemon.nickname, status: 'sleep', message: `${pokemon.nickname} woke up!` });
        }
        return { canMove: true };
      } else {
        if (emitEvent) {
          emitEvent('StatusPreventedMove', { pokemon: pokemon.nickname, status: 'sleep', message: `${pokemon.nickname} is fast asleep!` });
        }
        return { canMove: false, reason: 'sleep' };
      }
    }

    if (pokemon.status === 'freeze') {
      if (rng.rollPercent(20)) {
        pokemon.status = null;
        if (emitEvent) {
          emitEvent('StatusEnded', { pokemon: pokemon.nickname, status: 'freeze', message: `${pokemon.nickname} thawed out!` });
        }
        return { canMove: true };
      } else {
        if (emitEvent) {
          emitEvent('StatusPreventedMove', { pokemon: pokemon.nickname, status: 'freeze', message: `${pokemon.nickname} is frozen solid!` });
        }
        return { canMove: false, reason: 'freeze' };
      }
    }

    return { canMove: true };
  }

  /**
   * Resolves residual status damage at end of turn.
   */
  static resolveTurnEndStatus(pokemon, emitEvent) {
    if (!pokemon.status || pokemon.fainted) return;

    let residualFraction = 0;
    if (pokemon.status === 'burn') residualFraction = 1 / 16;
    if (pokemon.status === 'poison') residualFraction = 1 / 8;

    if (residualFraction > 0) {
      const damage = Math.max(1, Math.floor(pokemon.maxHp * residualFraction));
      pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);

      if (emitEvent) {
        emitEvent('StatusDamageApplied', {
          pokemon: pokemon.nickname,
          status: pokemon.status,
          damage,
          currentHp: pokemon.currentHp,
          maxHp: pokemon.maxHp
        });
      }

      if (pokemon.currentHp <= 0) {
        pokemon.fainted = true;
        if (emitEvent) {
          emitEvent('PokemonFainted', { pokemon: pokemon.nickname });
        }
      }
    }
  }
}
