/**
 * RNG.js
 * Deterministic, reproducible Pseudorandom Number Generator (PRNG).
 * Eliminates all Math.random() calls to guarantee identical battle replays across Studio and 3DS Citro2D runtime.
 */

export class RNG {
  constructor(seed = 12345) {
    this.seed = Number(seed) >>> 0;
    this.state = this.seed;
    this.callCount = 0;
  }

  reset(seed = null) {
    if (seed !== null) {
      this.seed = Number(seed) >>> 0;
    }
    this.state = this.seed;
    this.callCount = 0;
  }

  getState() {
    return {
      seed: this.seed,
      state: this.state,
      callCount: this.callCount
    };
  }

  setState(saved) {
    this.seed = saved.seed >>> 0;
    this.state = saved.state >>> 0;
    this.callCount = Number(saved.callCount || 0);
  }

  /**
   * Linear Congruential Generator (Numerical Recipes parameters: a = 1664525, c = 1013904223, m = 2^32)
   * Produces float in range [0, 1).
   */
  nextFloat() {
    this.callCount++;
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  /**
   * Generates integer in range [min, max] inclusive.
   */
  nextInt(min, max) {
    const f = this.nextFloat();
    return Math.floor(f * (max - min + 1)) + min;
  }

  /**
   * Generates float in range [min, max).
   */
  nextRange(min, max) {
    return min + this.nextFloat() * (max - min);
  }

  /**
   * Returns true with given percentage chance (0 to 100).
   */
  rollPercent(chance) {
    if (chance <= 0) return false;
    if (chance >= 100) return true;
    return (this.nextFloat() * 100) < chance;
  }
}
