import { assetResolver } from '../data/AssetResolver.js';
import { ComponentRegistry } from '../components/ComponentRegistry.js';

/**
 * AssetBrowser - Visual asset library with search, category filtering,
 * metadata display, and Drag & Drop integration onto Nintendo 3DS canvases.
 */
export class AssetBrowser {
  /**
   * @param {HTMLElement} containerElement 
   * @param {ProjectModel} projectModel 
   * @param {CanvasRenderer} [canvasRenderer]
   */
  constructor(containerElement, projectModel, canvasRenderer = null) {
    this.container = containerElement;
    this.model = projectModel;
    this.renderer = canvasRenderer;

    this.currentCategory = 'all';
    this.searchQuery = '';

    this._initUI();
  }

  _initUI() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="asset-browser-panel">
        <div class="asset-browser-header">
          <div class="asset-search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="assetSearchInput" placeholder="Search assets (e.g. Pikachu, Plains, Potion)..." />
          </div>
          <div class="asset-category-filters" id="assetCategoryFilters"></div>
        </div>
        <div class="asset-grid" id="assetGridContainer"></div>
        <div class="asset-browser-footer">
          <span id="assetCountLabel" class="asset-count">Loading assets...</span>
          <span class="asset-hint">💡 Drag asset to canvas or double-click to add</span>
        </div>
      </div>
    `;

    this._renderCategories();
    this._renderGrid();
    this._setupSearchListener();
  }

  _renderCategories() {
    const filtersEl = this.container.querySelector('#assetCategoryFilters');
    if (!filtersEl) return;

    const categories = assetResolver.getCategories();
    filtersEl.innerHTML = categories.map(cat => `
      <button class="asset-cat-btn ${cat.id === this.currentCategory ? 'active' : ''}" data-category="${cat.id}">
        <span class="cat-icon">${cat.icon}</span>
        <span class="cat-name">${cat.name}</span>
      </button>
    `).join('');

    filtersEl.querySelectorAll('.asset-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filtersEl.querySelectorAll('.asset-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentCategory = btn.dataset.category;
        this._renderGrid();
      });
    });
  }

  _setupSearchListener() {
    const searchInput = this.container.querySelector('#assetSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this._renderGrid();
    });
  }

  _renderGrid() {
    const gridEl = this.container.querySelector('#assetGridContainer');
    const countEl = this.container.querySelector('#assetCountLabel');
    if (!gridEl) return;

    const assets = assetResolver.search(this.searchQuery, this.currentCategory);
    if (countEl) {
      countEl.textContent = `${assets.length} asset${assets.length === 1 ? '' : 's'} available`;
    }

    if (assets.length === 0) {
      gridEl.innerHTML = `
        <div class="asset-empty-state">
          <p>No assets found matching "<em>${this.searchQuery}</em>"</p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = assets.map(asset => {
      const nodeData = assetResolver.createNodeData(asset.id);
      const isPokemon = asset.category === 'pokemon';
      const icon = isPokemon ? '⚡' : (asset.category === 'backgrounds' ? '🌄' : (asset.category === 'ui' ? '🔲' : '🧪'));

      return `
        <div class="asset-card" draggable="true" data-asset-id="${asset.id}">
          <div class="asset-thumb">
            <span class="thumb-icon">${icon}</span>
            <span class="asset-dims">${asset.dimensions.width}×${asset.dimensions.height}</span>
          </div>
          <div class="asset-info">
            <div class="asset-name" title="${asset.name}">${asset.name}</div>
            <div class="asset-meta">
              <span class="asset-type-badge">${asset.defaultComponent}</span>
              <span class="asset-3ds-badge">${asset.target3DS.format}</span>
            </div>
          </div>
          <button class="asset-add-btn" title="Add to Active Screen">+</button>
        </div>
      `;
    }).join('');

    // Attach Drag and Drop & Click listeners to cards
    gridEl.querySelectorAll('.asset-card').forEach(card => {
      const assetId = card.dataset.assetId;
      const asset = assetResolver.getAsset(assetId);

      card.addEventListener('dragstart', (e) => {
        const nodeData = assetResolver.createNodeData(assetId);
        e.dataTransfer.setData('application/json', JSON.stringify(nodeData));
        e.dataTransfer.setData('text/plain', assetId);
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });

      // Quick add on button click or double click
      const addBtn = card.querySelector('.asset-add-btn');
      if (addBtn) {
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.instantiateAsset(assetId);
        });
      }

      card.addEventListener('dblclick', () => {
        this.instantiateAsset(assetId);
      });
    });
  }

  /**
   * Instantiates the asset into the active scene or screen.
   * @param {string} assetId 
   * @param {Object} [overrides] 
   */
  instantiateAsset(assetId, overrides = {}) {
    const nodeData = assetResolver.createNodeData(assetId, overrides);
    const screen = this.model.getActiveScreen();
    if (!screen) return null;

    // Use default target screen for the asset
    const targetScreen = overrides.screen || nodeData.screen || 'top';
    const bounds = targetScreen === 'bottom' ? { w: 320, h: 240 } : { w: 400, h: 240 };

    // Position in center if not provided
    const posX = overrides.x ?? Math.round((bounds.w - nodeData.width) / 2);
    const posY = overrides.y ?? Math.round((bounds.h - nodeData.height) / 2);

    const comp = ComponentRegistry.create(nodeData.type, {
      ...nodeData,
      screen: targetScreen,
      x: posX,
      y: posY
    });

    if (typeof screen.addNode === 'function') {
      screen.addNode(comp);
    } else {
      this.model.addComponent(comp);
    }

    if (this.renderer) {
      this.renderer.render();
    }

    return comp;
  }
}
