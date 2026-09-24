/**
 * Hierarchy - Screen component tree, layers view, reordering, and element management.
 */
export class Hierarchy {
  constructor(containerElement, projectModel, selectionManager) {
    this.container = containerElement;
    this.model = projectModel;
    this.selection = selectionManager;

    this._setupSubscriptions();
  }

  _setupSubscriptions() {
    this.model.subscribe(() => {
      this.render();
    });

    this.selection.subscribe(() => {
      this._updateSelectionHighlight();
    });
  }

  render() {
    const screen = this.model.getActiveScreen();
    if (!screen) {
      this.container.innerHTML = `<div class="hierarchy-empty">No active screen</div>`;
      return;
    }

    const topComps = screen.components.filter(c => c.screen === 'top');
    const bottomComps = screen.components.filter(c => c.screen === 'bottom');

    let html = `
      <div class="hierarchy-tree">
        <div class="tree-root-item">
          <span class="icon">📺</span>
          <span class="label font-bold">${screen.name || screen.id}</span>
        </div>

        <!-- TOP SCREEN FOLDER -->
        <div class="tree-group">
          <div class="tree-group-header">
            <span class="tag-top">TOP SCREEN</span>
            <span class="count">${topComps.length}</span>
          </div>
          <div class="tree-list" id="tree_top_list">
            ${this._renderComponentList(topComps)}
          </div>
        </div>

        <!-- BOTTOM SCREEN FOLDER -->
        <div class="tree-group">
          <div class="tree-group-header">
            <span class="tag-bottom">BOTTOM (TOUCH)</span>
            <span class="count">${bottomComps.length}</span>
          </div>
          <div class="tree-list" id="tree_bottom_list">
            ${this._renderComponentList(bottomComps)}
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this._attachEvents();
    this._updateSelectionHighlight();
  }

  _renderComponentList(comps) {
    if (comps.length === 0) {
      return `<div class="tree-empty-item">(No elements)</div>`;
    }

    // Display in reverse z-index (top layers at the top of the tree view)
    const sorted = [...comps].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

    return sorted.map(comp => {
      const typeIcons = {
        RogueBox: '🔲',
        PixelText: '🔤',
        TouchButton: '🔘'
      };
      const icon = typeIcons[comp.type] || '📦';
      const isVisible = comp.visible !== false;

      return `
        <div class="tree-item" data-id="${comp.id}">
          <span class="item-visibility ${isVisible ? 'vis-on' : 'vis-off'}" title="Toggle visibility">
            ${isVisible ? '👁' : '🚫'}
          </span>
          <span class="item-icon">${icon}</span>
          <span class="item-name" title="${comp.id}">${comp.id}</span>
          <span class="item-badge">${comp.type}</span>
          <div class="item-actions">
            <button class="btn-tree-action" data-action="up" title="Move layer up">▲</button>
            <button class="btn-tree-action" data-action="down" title="Move layer down">▼</button>
            <button class="btn-tree-action btn-tree-del" data-action="delete" title="Delete element">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  _attachEvents() {
    const items = this.container.querySelectorAll('.tree-item');
    items.forEach(el => {
      const id = el.getAttribute('data-id');

      // Selection on click
      el.addEventListener('click', (e) => {
        if (e.target.closest('.item-actions') || e.target.closest('.item-visibility')) return;
        this.selection.select(id, e.shiftKey);
      });

      // Visibility toggle
      const visBtn = el.querySelector('.item-visibility');
      if (visBtn) {
        visBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const comp = this.model.getComponent(id);
          if (comp) {
            this.model.updateComponent(id, { visible: !comp.visible });
          }
        });
      }

      // Reordering actions
      const actBtns = el.querySelectorAll('.btn-tree-action');
      actBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.getAttribute('data-action');
          if (action === 'up') {
            this.model.reorderComponent(id, 'up');
          } else if (action === 'down') {
            this.model.reorderComponent(id, 'down');
          } else if (action === 'delete') {
            this.model.removeComponent(id);
            this.selection.deselect(id);
          }
        });
      });
    });
  }

  _updateSelectionHighlight() {
    const selectedIds = new Set(this.selection.getSelectedIds());
    const items = this.container.querySelectorAll('.tree-item');
    items.forEach(el => {
      const id = el.getAttribute('data-id');
      if (selectedIds.has(id)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }
}
