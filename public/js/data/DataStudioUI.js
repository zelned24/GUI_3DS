/**
 * DataStudioUI.js
 * Data Studio explorer for PokéRogue 3DS Canonical Data.
 * Allows browsing adapted species, moves, abilities, forms, source provenance, and dependency graphs.
 */

import { dataManager } from './DataManager.js';
import { PokerogueImporter } from './PokerogueImporter.js';
import { PokerogueRepository } from './PokerogueRepository.js';

export class DataStudioUI {
  constructor(containerElement) {
    this.container = containerElement;
    this.currentCategory = 'species'; // 'species', 'moves', 'abilities'
    this.selectedItemId = 'pikachu';
    this.searchQuery = '';
  }

  render() {
    if (!this.container) return;

    const allSpecies = dataManager.getAllSpecies();
    const allMoves = dataManager.getAllMoves();
    const allAbilities = dataManager.getAllAbilities();

    let itemsList = [];
    if (this.currentCategory === 'species') itemsList = allSpecies;
    else if (this.currentCategory === 'moves') itemsList = allMoves;
    else if (this.currentCategory === 'abilities') itemsList = allAbilities;

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      itemsList = itemsList.filter(item => item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
    }

    // Default selection if current not in filtered list
    if (itemsList.length > 0 && !itemsList.find(i => i.id === this.selectedItemId)) {
      this.selectedItemId = itemsList[0].id;
    }

    this.container.innerHTML = `
      <div class="data-studio-root">
        <!-- Sidebar Navigation -->
        <div class="data-studio-sidebar">
          <div class="data-studio-header">
            <h3>📊 DATA STUDIO</h3>
            <span class="data-badge">${dataManager.isFallback ? 'Offline Fixture' : 'PokéRogue Upstream Synced'}</span>
            <button id="btn-sync-upstream" class="btn-sync-upstream" style="margin-top:6px; padding:4px 8px; font-size:11px; font-weight:bold; background:#3182ce; color:#fff; border:none; border-radius:4px; cursor:pointer;">🔄 Sync Upstream Data</button>
          </div>

          <!-- Category Selector Tabs -->
          <div class="category-tabs">
            <button class="cat-tab ${this.currentCategory === 'species' ? 'active' : ''}" data-cat="species">
              🐾 Pokémon (${allSpecies.length})
            </button>
            <button class="cat-tab ${this.currentCategory === 'moves' ? 'active' : ''}" data-cat="moves">
              ⚔️ Moves (${allMoves.length})
            </button>
            <button class="cat-tab ${this.currentCategory === 'abilities' ? 'active' : ''}" data-cat="abilities">
              ✨ Abilities (${allAbilities.length})
            </button>
          </div>

          <!-- Search Filter -->
          <div class="data-search-box">
            <input type="text" id="data-search-input" placeholder="Search ${this.currentCategory}..." value="${this.searchQuery}">
          </div>

          <!-- Items List -->
          <div class="data-items-list">
            ${itemsList.map(item => `
              <div class="data-item-row ${item.id === this.selectedItemId ? 'active' : ''}" data-id="${item.id}">
                <div class="data-item-left">
                  <span class="data-item-name">${item.name}</span>
                  <span class="data-item-sub">#${item.nationalDexId || item.id}</span>
                </div>
                ${item.types ? `
                  <div class="data-item-types">
                    ${item.types.map(t => `<span class="type-badge-mini type-${t.toLowerCase()}">${t.slice(0, 3)}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
            ${itemsList.length === 0 ? '<div class="data-empty">No items match search.</div>' : ''}
          </div>
        </div>

        <!-- Detail Content Panel -->
        <div class="data-studio-content">
          ${this._renderDetailView()}
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _renderDetailView() {
    if (this.currentCategory === 'species') {
      const sp = dataManager.getSpecies(this.selectedItemId);
      if (!sp) return '<div class="data-empty">Select a Pokémon from the list.</div>';
      const depGraph = dataManager.getDependencyGraph(sp.id);

      const maxStat = 160;
      const getStatPercent = (val) => Math.min(100, Math.round((val / maxStat) * 100));

      return `
        <div class="data-detail-card">
          <!-- Header Banner -->
          <div class="detail-header-banner">
            <div class="detail-title-group">
              <span class="dex-num">#${String(sp.nationalDexId).padStart(3, '0')}</span>
              <h2>${sp.name}</h2>
              <div class="detail-types">
                ${sp.types.map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join('')}
              </div>
            </div>
            <div class="detail-provenance">
              <span class="prov-tag">Source: <b>${sp.source.source}</b></span>
              <span class="prov-tag">License: <b>${sp.source.license}</b></span>
              <span class="prov-tag">Schema: v${sp.schemaVersion || 1}</span>
            </div>
          </div>


          <div class="detail-grid">
            <!-- Left Column: Stats & Sprites -->
            <div class="detail-col">
              <div class="section-box">
                <h4>BASE STATS (TOTAL: ${Object.values(sp.baseStats).reduce((a, b) => a + b, 0)})</h4>
                <div class="stats-bars">
                  ${Object.entries(sp.baseStats).map(([st, val]) => `
                    <div class="stat-bar-row">
                      <span class="stat-name">${st.toUpperCase()}</span>
                      <span class="stat-val">${val}</span>
                      <div class="stat-track">
                        <div class="stat-fill stat-${st}" style="width: ${getStatPercent(val)}%"></div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <div class="section-box">
                <h4>3DS SPRITE & ATLAS REFERENCE</h4>
                <div class="sprite-ref-box">
                  <div class="sprite-preview-wrap">
                    <img src="${sp.sprites.icon}" alt="${sp.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <div class="sprite-fallback" style="display:none;">⚡</div>
                  </div>
                  <div class="sprite-paths">
                    <div><b>Atlas Path:</b> <code>${sp.sprites.atlasPath}</code></div>
                    <div><b>Icon Path:</b> <code>${sp.sprites.icon}</code></div>
                    <div><b>RomFS 3DS Format:</b> <code>citro2d / t3x texture sheet</code></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Abilities, Moves, Dependencies -->
            <div class="detail-col">
              <div class="section-box">
                <h4>ABILITIES</h4>
                <div class="abilities-list">
                  <div>Primary: <b>${sp.abilities.primary}</b></div>
                  ${sp.abilities.secondary ? `<div>Secondary: <b>${sp.abilities.secondary}</b></div>` : ''}
                  ${sp.abilities.hidden ? `<div>Hidden: <b>${sp.abilities.hidden}</b></div>` : ''}
                </div>
              </div>

              <div class="section-box">
                <h4>LEARNABLE MOVES (${sp.learnableMoves.length})</h4>
                <div class="moves-table-wrap">
                  <table class="moves-table">
                    <thead>
                      <tr><th>Move</th><th>Type</th><th>Cat</th><th>Pwr</th><th>Acc</th><th>PP</th></tr>
                    </thead>
                    <tbody>
                      ${sp.learnableMoves.map(m => {
                        const moveDef = dataManager.getMove(m.id || m.move);
                        const mType = moveDef?.type || m.type || 'Normal';
                        const mCat = moveDef?.category || m.category || 'Physical';
                        const mPwr = moveDef?.power ?? m.power ?? '—';
                        const mAcc = moveDef?.accuracy ?? m.accuracy ?? '—';
                        const mPp = moveDef?.pp ?? m.pp ?? 20;
                        return `
                          <tr>
                            <td><b>${m.name || moveDef?.name || m.id}</b></td>
                            <td><span class="type-badge-mini type-${mType.toLowerCase()}">${mType}</span></td>
                            <td>${mCat}</td>
                            <td>${mPwr}</td>
                            <td>${mAcc}</td>
                            <td>${mPp}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>

                  </table>
                </div>
              </div>

              <!-- Data Dependency Tree -->
              <div class="section-box">
                <h4>DATA DEPENDENCY GRAPH</h4>
                <div class="dependency-tree">
                  <div class="tree-root">🐾 ${depGraph.species}</div>
                  <div class="tree-branch">├── 🖼️ Sprites: <code>${depGraph.sprites.atlasPath}</code></div>
                  <div class="tree-branch">├── ✨ Primary Ability: <b>${depGraph.abilities.primary}</b></div>
                  <div class="tree-branch">├── ⚔️ Moves: ${depGraph.moves.join(', ')}</div>
                  <div class="tree-branch">└── 🧩 Forms: ${depGraph.forms.join(', ')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (this.currentCategory === 'moves') {
      const mv = dataManager.getMove(this.selectedItemId);
      if (!mv) return '<div class="data-empty">Select a move from the list.</div>';
      return `
        <div class="data-detail-card">
          <div class="detail-header-banner">
            <div class="detail-title-group">
              <h2>${mv.name}</h2>
              <span class="type-badge type-${mv.type.toLowerCase()}">${mv.type}</span>
              <span class="category-badge">${mv.category}</span>
            </div>
            <div class="detail-provenance">
              <span class="prov-tag">Source: <b>${mv.source.source}</b></span>
              <span class="prov-tag">License: <b>${mv.source.license}</b></span>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-col">
              <div class="section-box">
                <h4>COMBAT PROPERTIES</h4>
                <div class="stat-bar-row"><span>Power</span><b>${mv.power || '— (Status)'}</b></div>
                <div class="stat-bar-row"><span>Accuracy</span><b>${mv.accuracy || '—'}%</b></div>
                <div class="stat-bar-row"><span>Base PP</span><b>${mv.pp}</b></div>
                <div class="stat-bar-row"><span>Priority</span><b>${mv.priority || 0}</b></div>
                <div class="stat-bar-row"><span>Target</span><b>${mv.target || 'Selected Target'}</b></div>
              </div>
            </div>
            <div class="detail-col">
              <div class="section-box">
                <h4>DESCRIPTION & EFFECTS</h4>
                <p class="desc-text">${mv.description}</p>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (this.currentCategory === 'abilities') {
      const ab = dataManager.getAbility(this.selectedItemId);
      if (!ab) return '<div class="data-empty">Select an ability from the list.</div>';
      return `
        <div class="data-detail-card">
          <div class="detail-header-banner">
            <div class="detail-title-group">
              <h2>${ab.name}</h2>
            </div>
            <div class="detail-provenance">
              <span class="prov-tag">Source: <b>${ab.source.source}</b></span>
              <span class="prov-tag">License: <b>${ab.source.license}</b></span>
            </div>
          </div>
          <div class="section-box">
            <h4>DECLARATIVE SPECIFICATION</h4>
            <p class="desc-text">${ab.description}</p>
            <div class="stat-bar-row"><span>Attributes</span><b>${ab.attributes?.join(', ') || 'None'}</b></div>
          </div>
        </div>
      `;
    }
  }

  _bindEvents() {
    // Category Tabs
    this.container.querySelectorAll('.cat-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentCategory = e.currentTarget.dataset.cat;
        this.searchQuery = '';
        this.render();
      });
    });

    // Item selection
    this.container.querySelectorAll('.data-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        this.selectedItemId = e.currentTarget.dataset.id;
        this.render();
      });
    });

    // Search Input
    const searchInput = this.container.querySelector('#data-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
        // Restore focus and cursor position
        const updatedInput = this.container.querySelector('#data-search-input');
        if (updatedInput) {
          updatedInput.focus();
          updatedInput.selectionStart = updatedInput.selectionEnd = updatedInput.value.length;
        }
      });
    }

    // Upstream sync button
    const syncBtn = this.container.querySelector('#btn-sync-upstream');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.textContent = '⏳ Syncing...';
        syncBtn.disabled = true;
        try {
          const importer = new PokerogueImporter(new PokerogueRepository());
          await dataManager.importUpstream(importer);
        } catch (err) {
          console.error('Error syncing upstream data:', err);
        }
        this.render();
      });
    }
  }
}
