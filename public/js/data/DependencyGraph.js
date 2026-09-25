/**
 * DependencyGraph.js
 * Builds bidirectional dependency chains across Species, Moves, Abilities, Forms, Sprites, Icons, and Items.
 * Allows answering "What breaks if this changes?" and impact analysis.
 */

export class DependencyGraph {
  constructor() {
    this.forwardDeps = new Map(); // entityKey -> Set of entityKeys it depends on
    this.reverseDeps = new Map(); // entityKey -> Set of entityKeys that depend on it
  }

  addDependency(sourceKey, targetKey) {
    if (!this.forwardDeps.has(sourceKey)) {
      this.forwardDeps.set(sourceKey, new Set());
    }
    this.forwardDeps.get(sourceKey).add(targetKey);

    if (!this.reverseDeps.has(targetKey)) {
      this.reverseDeps.set(targetKey, new Set());
    }
    this.reverseDeps.get(targetKey).add(sourceKey);
  }

  getDependenciesOf(entityKey) {
    return Array.from(this.forwardDeps.get(entityKey) || []);
  }

  getDependentsOn(entityKey) {
    return Array.from(this.reverseDeps.get(entityKey) || []);
  }

  /**
   * Analyzes the impact if entityKey is modified or deleted.
   */
  getImpactAnalysis(entityKey) {
    const visited = new Set();
    const queue = [entityKey];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!visited.has(current)) {
        visited.add(current);
        const dependents = this.getDependentsOn(current);
        for (const dep of dependents) {
          if (!visited.has(dep)) {
            queue.push(dep);
          }
        }
      }
    }

    visited.delete(entityKey);
    return Array.from(visited);
  }

  /**
   * Builds full graph from species, moves, abilities, forms.
   */
  buildFromDataset(speciesList = [], movesList = [], abilitiesList = []) {
    this.forwardDeps.clear();
    this.reverseDeps.clear();

    for (const sp of speciesList) {
      const spKey = `species:${sp.id}`;

      // Abilities
      if (sp.abilities?.primary && sp.abilities.primary !== 'NONE') {
        const abKey = `ability:${sp.abilities.primary.toLowerCase()}`;
        this.addDependency(spKey, abKey);
      }
      if (sp.abilities?.secondary && sp.abilities.secondary !== 'NONE') {
        const abKey = `ability:${sp.abilities.secondary.toLowerCase()}`;
        this.addDependency(spKey, abKey);
      }
      if (sp.abilities?.hidden) {
        const abKey = `ability:${sp.abilities.hidden.toLowerCase()}`;
        this.addDependency(spKey, abKey);
      }
      if (sp.abilities?.passive) {
        const abKey = `ability:${sp.abilities.passive.toLowerCase()}`;
        this.addDependency(spKey, abKey);
      }

      // Moves
      const moves = sp.learnableMoves || sp.levelMoves || [];
      for (const m of moves) {
        const moveId = typeof m === 'string' ? m : (m.id || m.move);
        if (moveId) {
          this.addDependency(spKey, `move:${moveId.toLowerCase()}`);
        }
      }

      // Sprites & Icons
      if (sp.sprites?.atlasPath) {
        this.addDependency(spKey, `asset:${sp.sprites.atlasPath}`);
      }
      if (sp.sprites?.icon) {
        this.addDependency(spKey, `asset:${sp.sprites.icon}`);
      }
    }
  }
}
