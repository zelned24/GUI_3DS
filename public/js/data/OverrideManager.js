/**
 * OverrideManager.js
 * Manages the multi-layered data model:
 *   Base Data (PokéRogue upstream imported)
 *   + Studio Overrides (custom 3DS balance, stat tweaks, custom moves)
 *   = Final Build Data (used by Studio runtime and exported to 3DS RomFS)
 */

export class OverrideManager {
  constructor(initialOverrides = {}) {
    // category -> id -> { propertyPath: overrideValue }
    this.overrides = initialOverrides;
  }

  setOverride(category, id, propertyPath, value) {
    const cat = String(category).toLowerCase();
    const itemKey = String(id).toLowerCase();

    if (!this.overrides[cat]) {
      this.overrides[cat] = {};
    }
    if (!this.overrides[cat][itemKey]) {
      this.overrides[cat][itemKey] = {};
    }

    this.overrides[cat][itemKey][propertyPath] = value;
  }

  removeOverride(category, id, propertyPath) {
    const cat = String(category).toLowerCase();
    const itemKey = String(id).toLowerCase();
    if (this.overrides[cat] && this.overrides[cat][itemKey]) {
      delete this.overrides[cat][itemKey][propertyPath];
      if (Object.keys(this.overrides[cat][itemKey]).length === 0) {
        delete this.overrides[cat][itemKey];
      }
    }
  }

  getOverridesFor(category, id) {
    const cat = String(category).toLowerCase();
    const itemKey = String(id).toLowerCase();
    return this.overrides[cat]?.[itemKey] || {};
  }

  hasOverride(category, id, propertyPath = null) {
    const cat = String(category).toLowerCase();
    const itemKey = String(id).toLowerCase();
    const entry = this.overrides[cat]?.[itemKey];
    if (!entry) return false;
    if (propertyPath) return propertyPath in entry;
    return Object.keys(entry).length > 0;
  }

  /**
   * Applies overrides non-destructively to produce final build data.
   */
  applyOverrides(baseEntity, category) {
    if (!baseEntity || !baseEntity.id) return baseEntity;
    const cat = String(category).toLowerCase();
    const overrides = this.getOverridesFor(cat, baseEntity.id);
    if (!overrides || Object.keys(overrides).length === 0) {
      return baseEntity;
    }

    // Clone base entity
    const finalData = Object.assign(
      Object.create(Object.getPrototypeOf(baseEntity)),
      JSON.parse(JSON.stringify(baseEntity))
    );

    for (const [propPath, val] of Object.entries(overrides)) {
      const parts = propPath.split('.');
      let target = finalData;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = val;
    }

    finalData._hasOverrides = true;
    finalData._overriddenProperties = Object.keys(overrides);
    return finalData;
  }

  serialize() {
    return JSON.parse(JSON.stringify(this.overrides));
  }

  deserialize(json) {
    this.overrides = typeof json === 'string' ? JSON.parse(json) : (json || {});
  }
}
