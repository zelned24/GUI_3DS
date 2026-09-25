/**
 * PokerogueSource - Centralized configuration of official upstream PokéRogue sources.
 * Manages repository endpoints, frozen commit revisions, raw URLs and cross-platform fetching.
 */

export const POKEROGUE_REPOSITORIES = {
  pokerogue: {
    name: 'pokerogue',
    url: 'https://github.com/pagefaultgames/pokerogue',
    branch: 'beta',
    revision: '8555c08c823b856cbec4eb99ca84ea52a955836d',
    rawBase: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue',
    license: 'AGPL-v3.0-only'
  },
  'pokerogue-assets': {
    name: 'pokerogue-assets',
    url: 'https://github.com/pagefaultgames/pokerogue-assets',
    branch: 'beta',
    revision: '056a1f408f26a3be4fef243f7462cb43608c7928',
    rawBase: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets',
    license: 'GPL-3.0-or-later'
  },
  'pokerogue-locales': {
    name: 'pokerogue-locales',
    url: 'https://github.com/pagefaultgames/pokerogue-locales',
    branch: 'main',
    revision: '23aea1cb0da5a0b15b836f3c243791591cc42303',
    rawBase: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-locales',
    license: 'AGPL-v3.0-only'
  }
};

export class PokerogueSource {
  /**
   * Constructs the canonical raw URL for an upstream file.
   * Format: ${rawBase}/${revision}/${path}
   * @param {string} repoKey 'pokerogue' | 'pokerogue-assets' | 'pokerogue-locales'
   * @param {string} filePath Relative path inside upstream repo
   * @returns {string}
   */
  static buildRawUrl(repoKey, filePath) {
    const config = POKEROGUE_REPOSITORIES[repoKey];
    if (!config) {
      throw new Error(`Unknown PokéRogue repository key: "${repoKey}"`);
    }
    const cleanPath = String(filePath).replace(/^\/+/, '');
    return `${config.rawBase}/${config.revision}/${cleanPath}`;
  }

  /**
   * Returns repository configuration by key.
   */
  static getRepoConfig(repoKey) {
    const config = POKEROGUE_REPOSITORIES[repoKey];
    if (!config) {
      throw new Error(`Unknown PokéRogue repository key: "${repoKey}"`);
    }
    return { ...config };
  }

  /**
   * Cross-platform fetch helper (works in browser and Node 18+).
   * @param {string} repoKey 
   * @param {string} filePath 
   * @returns {Promise<string>}
   */
  static async fetchSourceFile(repoKey, filePath) {
    const url = this.buildRawUrl(repoKey, filePath);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
      }
      return await response.text();
    } catch (err) {
      throw new Error(`Failed to fetch upstream source [${repoKey}:${filePath}] from ${url}: ${err.message}`);
    }
  }
}
