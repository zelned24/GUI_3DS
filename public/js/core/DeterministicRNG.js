/**
 * DeterministicRNG - Pseudo-Random Number Generator for PokéRogue 3DS Studio.
 * Guarantees 100% reproducible simulation, replays, and deterministic ID generation.
 * Strictly adheres to AGENTS.md rule 6 (no Math.random, no Date.now).
 */
export class DeterministicRNG {
  /**
   * @param {number} seed 
   */
  constructor(seed = 12345) {
    this.initialSeed = seed;
    this.state = seed >>> 0;
    this.sequenceCounters = new Map();
  }

  /**
   * Re-seeds the generator.
   * @param {number} seed 
   */
  seed(seed) {
    this.initialSeed = seed;
    this.state = seed >>> 0;
  }

  /**
   * Generates a floating point number in [0, 1) using Mulberry32.
   * @returns {number}
   */
  next() {
    let t = (this.state += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates an integer in range [min, max] inclusive.
   * @param {number} min 
   * @param {number} max 
   * @returns {number}
   */
  nextInt(min, max) {
    if (min > max) [min, max] = [max, min];
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /**
   * Generates a deterministic sequence-based identifier.
   * @param {string} prefix 
   * @returns {string}
   */
  nextId(prefix = 'id') {
    const current = (this.sequenceCounters.get(prefix) || 0) + 1;
    this.sequenceCounters.set(prefix, current);
    return `${prefix}_${current}`;
  }

  /**
   * Resets counter for a specific prefix.
   * @param {string} prefix 
   */
  resetId(prefix) {
    if (prefix) {
      this.sequenceCounters.delete(prefix);
    } else {
      this.sequenceCounters.clear();
    }
  }

  /**
   * Captures current RNG state for serialization / snapshot.
   */
  getState() {
    return {
      initialSeed: this.initialSeed,
      state: this.state,
      counters: Object.fromEntries(this.sequenceCounters.entries())
    };
  }

  /**
   * Restores RNG state from a previous snapshot.
   */
  setState(saved) {
    if (!saved) return;
    this.initialSeed = saved.initialSeed ?? this.initialSeed;
    this.state = (saved.state ?? this.initialSeed) >>> 0;
    this.sequenceCounters.clear();
    if (saved.counters) {
      for (const [k, v] of Object.entries(saved.counters)) {
        this.sequenceCounters.set(k, v);
      }
    }
  }
}

// Global default determinism instance for editor and simulation sessions
export const globalRNG = new DeterministicRNG(12345);
