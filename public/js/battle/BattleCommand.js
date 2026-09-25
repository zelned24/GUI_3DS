/**
 * BattleCommand.js
 * Intent objects representing user or AI actions in PokéRogue 3DS combat.
 * Completely DOM-free, serializable, and deterministic.
 */

export class BattleCommand {
  /**
   * @param {string} type e.g. 'SELECT_MOVE', 'FORFEIT'
   * @param {string} actorId 'player' | 'enemy'
   * @param {object} payload
   */
  constructor(type, actorId = 'player', payload = {}) {
    this.type = type;
    this.actorId = actorId;
    this.payload = payload;
    this.timestamp = null; // Strictly no Date.now(); commands rely on turn/stepIndex in state
  }

  toJSON() {
    return {
      type: this.type,
      actorId: this.actorId,
      payload: { ...this.payload }
    };
  }

  static fromJSON(json) {
    if (typeof json === 'string') {
      json = JSON.parse(json);
    }
    if (!json || !json.type) {
      throw new Error('Invalid JSON for BattleCommand');
    }
    switch (json.type) {
      case 'SELECT_MOVE':
        return new SelectMoveCommand(json.actorId, json.payload?.moveId);
      case 'FORFEIT':
        return new ForfeitCommand(json.actorId);
      default:
        return new BattleCommand(json.type, json.actorId, json.payload);
    }
  }
}

export class SelectMoveCommand extends BattleCommand {
  /**
   * @param {string} actorId 'player' | 'enemy'
   * @param {string} moveId e.g. 'thunderbolt', 'tackle'
   */
  constructor(actorId = 'player', moveId = '') {
    super('SELECT_MOVE', actorId, { moveId: String(moveId || '').toLowerCase().trim() });
  }

  get moveId() {
    return this.payload.moveId;
  }

  /**
   * Validates command against the active battle state without mutating it.
   * @param {import('./BattleState.js').BattleState} state
   * @returns {{ valid: boolean, reason?: string }}
   */
  validate(state) {
    if (!state) {
      return { valid: false, reason: 'No battle state provided' };
    }
    if (state.phase === 'BattleFinished' || state.winner) {
      return { valid: false, reason: 'Battle has already concluded' };
    }

    const party = this.actorId === 'player' ? state.player : state.enemy;
    const activePokemon = party?.active;

    if (!activePokemon) {
      return { valid: false, reason: `No active Pokémon found for actor [${this.actorId}]` };
    }
    if (activePokemon.fainted || activePokemon.currentHp <= 0) {
      return { valid: false, reason: `Actor Pokémon [${activePokemon.nickname}] is fainted` };
    }
    if (!this.moveId) {
      return { valid: false, reason: 'No moveId specified in command' };
    }

    const hasMove = activePokemon.moves.some(m => String(m.id).toLowerCase() === this.moveId);
    if (!hasMove) {
      return { valid: false, reason: `Move [${this.moveId}] is not in ${activePokemon.nickname}'s moveset` };
    }

    const moveObj = activePokemon.moves.find(m => String(m.id).toLowerCase() === this.moveId);
    if (moveObj && moveObj.pp <= 0) {
      return { valid: false, reason: `Move [${this.moveId}] has 0 PP remaining` };
    }

    return { valid: true };
  }
}

export class ForfeitCommand extends BattleCommand {
  constructor(actorId = 'player') {
    super('FORFEIT', actorId, {});
  }

  validate(state) {
    if (!state) {
      return { valid: false, reason: 'No battle state provided' };
    }
    if (state.phase === 'BattleFinished' || state.winner) {
      return { valid: false, reason: 'Battle has already concluded' };
    }
    return { valid: true };
  }
}
