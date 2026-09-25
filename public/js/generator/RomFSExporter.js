/**
 * RomFSExporter.js
 * Generates compact binary packages and directory structures for Nintendo 3DS Citro2D RomFS runtime.
 * Eliminates TypeScript parsing at runtime by packing binary tables:
 *  - romfs/data/species.bin
 *  - romfs/data/moves.bin
 *  - romfs/data/abilities.bin
 *  - romfs/data/manifest.bin
 * Computes 3DS VRAM & Linear RAM resource budgets.
 */

export class RomFSExporter {
  /**
   * Packs species data into a compact binary buffer.
   * Header: uint32 count
   * Record (24 bytes per species):
   *   uint16 speciesId
   *   uint8 type1, uint8 type2
   *   uint16 baseHp, baseAtk, baseDef, baseSpatk, baseSpdef, baseSpd (6 x 2 = 12 bytes)
   *   uint16 ability1, ability2, abilityHidden, abilityPassive (4 x 2 = 8 bytes)
   */
  static packSpeciesBinary(speciesList = []) {
    const recordSize = 24;
    const buffer = new ArrayBuffer(4 + speciesList.length * recordSize);
    const view = new DataView(buffer);

    view.setUint32(0, speciesList.length, true);

    speciesList.forEach((sp, idx) => {
      const offset = 4 + idx * recordSize;
      view.setUint16(offset, sp.speciesId || 0, true);
      view.setUint8(offset + 2, this._typeToId(sp.type1));
      view.setUint8(offset + 3, this._typeToId(sp.type2));

      view.setUint16(offset + 4, sp.baseStats.hp, true);
      view.setUint16(offset + 6, sp.baseStats.atk, true);
      view.setUint16(offset + 8, sp.baseStats.def, true);
      view.setUint16(offset + 10, sp.baseStats.spatk, true);
      view.setUint16(offset + 12, sp.baseStats.spdef, true);
      view.setUint16(offset + 14, sp.baseStats.spd, true);

      view.setUint16(offset + 16, 1, true); // ability1 ID
      view.setUint16(offset + 18, 0, true); // ability2 ID
      view.setUint16(offset + 20, 0, true); // abilityHidden ID
      view.setUint16(offset + 22, 0, true); // abilityPassive ID
    });

    return buffer;
  }

  /**
   * Packs moves data into a compact binary buffer.
   * Header: uint32 count
   * Record (12 bytes per move):
   *   uint16 moveId
   *   uint8 type, uint8 category, uint8 power, uint8 accuracy, uint8 pp, int8 priority
   *   uint16 flags
   *   uint16 secondaryEffectCode
   */
  static packMovesBinary(movesList = []) {
    const recordSize = 12;
    const buffer = new ArrayBuffer(4 + movesList.length * recordSize);
    const view = new DataView(buffer);

    view.setUint32(0, movesList.length, true);

    movesList.forEach((mv, idx) => {
      const offset = 4 + idx * recordSize;
      view.setUint16(offset, mv.moveId || 0, true);
      view.setUint8(offset + 2, this._typeToId(mv.type));
      view.setUint8(offset + 3, mv.category === 'Special' ? 1 : (mv.category === 'Status' ? 2 : 0));
      view.setUint8(offset + 4, mv.power || 0);
      view.setUint8(offset + 5, mv.accuracy || 100);
      view.setUint8(offset + 6, mv.pp || 20);
      view.setInt8(offset + 7, mv.priority || 0);

      let flags = 0;
      if (mv.flags.contact) flags |= (1 << 0);
      if (mv.flags.protectable) flags |= (1 << 1);
      if (mv.flags.sound) flags |= (1 << 2);
      view.setUint16(offset + 8, flags, true);

      view.setUint16(offset + 10, mv.secondaryEffects.length > 0 ? 1 : 0, true);
    });

    return buffer;
  }

  /**
   * Computes the 3DS hardware memory budget and constraints.
   */
  static calculateResourceBudget(manifest, assetRepo) {
    const MAX_VRAM_BYTES = 6 * 1024 * 1024; // 6 MB PICA200 VRAM
    const MAX_LINEAR_RAM_BYTES = 96 * 1024 * 1024; // 96 MB application pool on Old 3DS

    const allAssets = assetRepo ? assetRepo.getAllAssets() : [];
    let textureMemory = 0;
    let audioMemory = 0;
    let spriteCount = 0;

    for (const a of allAssets) {
      if (a.category === 'POKEMON_SPRITE' || a.category === 'ICON' || a.category === 'UI') {
        textureMemory += a.sizeBytes || 4096; // estimate 4KB per compressed sprite if size not probed
        spriteCount++;
      } else if (a.category.startsWith('AUDIO')) {
        audioMemory += a.sizeBytes || 16384;
      }
    }

    const dataMemory = (manifest?.entityCounts?.species || 2) * 24 + (manifest?.entityCounts?.moves || 5) * 12 + 1024;
    const estimatedDrawCalls = 16; // Top Screen + Bottom Screen estimated draw calls

    return {
      limits: {
        maxVramBytes: MAX_VRAM_BYTES,
        maxLinearRamBytes: MAX_LINEAR_RAM_BYTES
      },
      usage: {
        textureMemoryBytes: textureMemory,
        audioMemoryBytes: audioMemory,
        dataMemoryBytes: dataMemory,
        totalRamUsedBytes: textureMemory + audioMemory + dataMemory,
        spriteCount,
        estimatedDrawCalls
      },
      status: {
        vramOk: textureMemory < MAX_VRAM_BYTES,
        ramOk: (textureMemory + audioMemory + dataMemory) < MAX_LINEAR_RAM_BYTES
      }
    };
  }

  static _typeToId(typeName) {
    const map = {
      NORMAL: 0, FIRE: 1, WATER: 2, GRASS: 3, ELECTRIC: 4, ICE: 5,
      FIGHTING: 6, POISON: 7, GROUND: 8, FLYING: 9, PSYCHIC: 10, BUG: 11,
      ROCK: 12, GHOST: 13, DRAGON: 14, DARK: 15, STEEL: 16, FAIRY: 17
    };
    return map[String(typeName).toUpperCase()] || 0;
  }
}
