/**
 * PhaseQueue.js
 * Manages the ordered queue of combat execution phases.
 * Phases include:
 *  - TurnInitPhase
 *  - SpeedOrderPhase
 *  - ActionExecutePhase (Move, Item, Switch)
 *  - AccuracyCheckPhase
 *  - DamageCalcPhase
 *  - DamageApplyPhase
 *  - AbilityReactionPhase
 *  - FaintCheckPhase
 *  - TurnEndPhase
 */

export class BattlePhase {
  constructor(name, payload = {}) {
    this.name = name;
    this.payload = payload;
  }
}

export class PhaseQueue {
  constructor() {
    this.queue = [];
    this.currentPhase = null;
  }

  enqueue(phaseName, payload = {}) {
    this.queue.push(new BattlePhase(phaseName, payload));
  }

  enqueueFront(phaseName, payload = {}) {
    this.queue.unshift(new BattlePhase(phaseName, payload));
  }

  dequeue() {
    if (this.queue.length === 0) {
      this.currentPhase = null;
      return null;
    }
    this.currentPhase = this.queue.shift();
    return this.currentPhase;
  }

  peek() {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  clear() {
    this.queue = [];
    this.currentPhase = null;
  }

  get length() {
    return this.queue.length;
  }

  getQueuedPhaseNames() {
    return this.queue.map(p => p.name);
  }
}
