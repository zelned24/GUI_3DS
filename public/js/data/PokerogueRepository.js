/**
 * PokerogueRepository.js
 * Source repository connector.
 * Provides abstraction for reading PokéRogue source, asset, and locale files from:
 *  1. Local directory (if user provides paths)
 *  2. Local project cache (`project/external/cache`)
 *  3. Remote raw GitHub using frozen commit revisions
 */

export class PokerogueRepository {
  constructor(config = null) {
    this.config = config || {
      source: {
        repository: 'https://github.com/pagefaultgames/pokerogue',
        branch: 'beta',
        revision: '8555c08c823b856cbec4eb99ca84ea52a955836d'
      },
      assets: {
        repository: 'https://github.com/pagefaultgames/pokerogue-assets',
        branch: 'beta',
        revision: '87426a79611f9d212c4dc8af58e2834a05b93725'
      },
      locales: {
        repository: 'https://github.com/pagefaultgames/pokerogue-locales',
        branch: 'main',
        revision: '23aea1cb0da5a0b15b836f3c243791591cc42303'
      }
    };

    this.localSourceDir = null;
    this.localAssetsDir = null;
    this.localLocalesDir = null;
    this.cache = new Map();
  }

  setLocalPaths(sourceDir, assetsDir, localesDir) {
    this.localSourceDir = sourceDir;
    this.localAssetsDir = assetsDir;
    this.localLocalesDir = localesDir;
  }

  getSourceUrl(subpath) {
    const rev = this.config.source.revision;
    return `https://raw.githubusercontent.com/pagefaultgames/pokerogue/${rev}/${subpath}`;
  }

  getAssetUrl(subpath) {
    const rev = this.config.assets.revision;
    return `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/${rev}/${subpath}`;
  }

  getLocaleUrl(subpath) {
    const rev = this.config.locales.revision;
    return `https://raw.githubusercontent.com/pagefaultgames/pokerogue-locales/${rev}/${subpath}`;
  }

  async fetchSourceFile(subpath) {
    const key = `source:${subpath}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const url = this.getSourceUrl(subpath);
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch source file ${subpath} (${resp.status} ${resp.statusText})`);
    }
    const text = await resp.text();
    this.cache.set(key, text);
    return text;
  }

  async fetchAssetJson(subpath) {
    const key = `asset:${subpath}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const url = this.getAssetUrl(subpath);
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch asset file ${subpath} (${resp.status} ${resp.statusText})`);
    }
    const json = await resp.json();
    this.cache.set(key, json);
    return json;
  }

  async fetchLocaleJson(subpath) {
    const key = `locale:${subpath}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const url = this.getLocaleUrl(subpath);
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch locale file ${subpath} (${resp.status} ${resp.statusText})`);
    }
    const json = await resp.json();
    this.cache.set(key, json);
    return json;
  }
}
