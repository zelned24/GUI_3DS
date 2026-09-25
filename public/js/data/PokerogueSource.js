/**
 * public/js/data/PokerogueSource.js
 * 
 * First Layer: Encapsulates upstream repositories configuration, branches,
 * frozen commit revisions, and raw URL generation for PokéRogue, its assets, and locales.
 */

export const POKEROGUE_UPSTREAM_CONFIG = {
  pokerogue: {
    name: 'pokerogue',
    repository: 'https://github.com/pagefaultgames/pokerogue',
    branch: 'beta',
    revision: '8555c08c823b856cbec4eb99ca84ea52a955836d',
    rawBase: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue',
    license: 'AGPL-v3.0-only'
  },
  assets: {
    name: 'pokerogue-assets',
    repository: 'https://github.com/pagefaultgames/pokerogue-assets',
    branch: 'beta',
    revision: '056a1f408f26a3be4fef243f7462cb43608c7928',
    rawBase: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets',
    license: 'Custom / Nintendo Derivative'
  },
  locales: {
    name: 'pokerogue-locales',
    repository: 'https://github.com/pagefaultgames/pokerogue-locales',
    branch: 'main',
    revision: '23aea1cb0da5a0b15b836f3c243791591cc42303',
    rawBase: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-locales',
    license: 'AGPL-v3.0-only'
  }
};

export class PokerogueSource {
  constructor(config = POKEROGUE_UPSTREAM_CONFIG) {
    this.config = config;
  }

  getRepoConfig(repoKey = 'pokerogue') {
    const key = repoKey === 'pokerogue-assets' ? 'assets' : (repoKey === 'pokerogue-locales' ? 'locales' : repoKey);
    const conf = this.config[key];
    if (!conf) {
      throw new Error(`Unknown upstream repository key: ${repoKey}`);
    }
    return conf;
  }

  getRawUrl(repoKey, filePath, revision = null) {
    const conf = this.getRepoConfig(repoKey);
    const rev = revision || conf.revision || conf.branch;
    const cleanPath = filePath.replace(/^\/+/, '');
    return `${conf.rawBase}/${rev}/${cleanPath}`;
  }

  async fetchRaw(repoKey, filePath, options = {}) {
    const url = this.getRawUrl(repoKey, filePath, options.revision);
    if (typeof globalThis.fetch === 'function') {
      const res = await globalThis.fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: HTTP ${res.status} ${res.statusText}`);
      }
      return await res.text();
    }
    throw new Error('globalThis.fetch is not available in the current environment');
  }
}
