/**
 * PokerogueManifest.js
 * Represents the frozen provenance manifest of all imported PokéRogue source, asset, and locale dependencies.
 */

export class PokerogueManifest {
  constructor(data = {}) {
    this.schemaVersion = 1;
    this.source = {
      repository: data.source?.repository || 'https://github.com/pagefaultgames/pokerogue',
      branch: data.source?.branch || 'beta',
      revision: data.source?.revision || '8555c08c823b856cbec4eb99ca84ea52a955836d',
      paths: data.source?.paths || [
        'src/data/pokemon-species.ts',
        'src/data/balance/species/generation-01.ts',
        'src/data/moves/move.ts',
        'src/data/moves/pokemon-move.ts',
        'src/data/abilities/init-abilities.ts',
        'src/enums/'
      ]
    };

    this.assets = {
      repository: data.assets?.repository || 'https://github.com/pagefaultgames/pokerogue-assets',
      branch: data.assets?.branch || 'beta',
      revision: data.assets?.revision || '87426a79611f9d212c4dc8af58e2834a05b93725',
      paths: data.assets?.paths || [
        'images/pokemon/',
        'images/pokemon/icons/',
        'audio/',
        'fonts/',
        'battle-anims/'
      ]
    };

    this.locales = {
      repository: data.locales?.repository || 'https://github.com/pagefaultgames/pokerogue-locales',
      branch: data.locales?.branch || 'main',
      revision: data.locales?.revision || '23aea1cb0da5a0b15b836f3c243791591cc42303',
      defaultLocale: 'en',
      availableLocales: ['en', 'es-ES', 'es-419', 'ja']
    };

    this.importTimestamp = data.importTimestamp || new Date().toISOString();
    this.fileHashes = data.fileHashes || {};
    this.entityCounts = data.entityCounts || {
      species: 0,
      moves: 0,
      abilities: 0,
      items: 0,
      assets: 0
    };
  }

  /**
   * Generates a deterministic manifest view (without timestamps) for 3DS RomFS reproducible builds.
   */
  getDeterministicExport() {
    return {
      schemaVersion: this.schemaVersion,
      sourceRevision: this.source.revision,
      assetRevision: this.assets.revision,
      localeRevision: this.locales.revision,
      entityCounts: this.entityCounts,
      fileHashes: Object.keys(this.fileHashes).sort().reduce((acc, key) => {
        acc[key] = this.fileHashes[key];
        return acc;
      }, {})
    };
  }
}
