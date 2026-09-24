/**
 * Hierarchy - Screen component & node tree view supporting true recursive nesting,
 * layer visibility toggles, reordering, and element management.
 */
export class Hierarchy {
  constructor(containerElement, projectModel, selectionManager) {
    this.container = containerElement;
    this.model = projectModel;
    this.selection = selectionManager;
    this.collapsedNodes = new Set();

    this._setupSubscriptions();
  }

  _setupSubscriptions() {
    this.model.subscribe((type) => {
      if (type !== 'componentUpdated') {
        this.render();
      } else {
        this._updateSelectionHighlight();
      }
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

    const topRoots = this.model.getRootNodes('top');
    const bottomRoots = this.model.getRootNodes('bottom');

    let html = `
      <div class="hierarchy-tree">
        <div class="tree-root-item">
          <span class="icon">📺</span>
          <span class="label font-bold">${screen.name || screen.id}</span>
          <span style="margin-left: auto; font-size: 10px; color: var(--text-dim);">v${screen.schemaVersion || 1}</span>
        </div>

        <!-- TOP SCREEN FOLDER -->
        <div class="tree-group">
          <div class="tree-group-header">
            <span class="tag-top">TOP SCREEN (400×240)</span>
            <span class="count">${screen.components.filter(c => c.screen === 'top').length}</span>
          </div>
          <div class="tree-list" id="tree_top_list">
            ${topRoots.length > 0 ? topRoots.map(r => this._renderNodeBranch(r, 0)).join('') : '<div class="tree-empty-item">(No elements)</div>'}
          </div>
        </div>

        <!-- BOTTOM SCREEN FOLDER -->
        <div class="tree-group">
          <div class="tree-group-header">
            <span class="tag-bottom">BOTTOM TOUCH (320×240)</span>
            <span class="count">${screen.components.filter(c => c.screen === 'bottom').length}</span>
          </div>
          <div class="tree-list" id="tree_bottom_list">
            ${bottomRoots.length > 0 ? bottomRoots.map(r => this._renderNodeBranch(r, 0)).join('') : '<div class="tree-empty-item">(No elements)</div>'}
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this._attachEvents();
    this._updateSelectionHighlight();
  }

  /**
   * Recursively renders a node and its nested children with depth indentation.
   */
  _renderNodeBranch(node, depth = 0) {
    const isVisible = node.visible !== false;
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = this.collapsedNodes.has(node.id);
    const indentPx = depth * 14;

    const typeIcons = {
      RogueBox: '🔲',
      PixelText: '🔤',
      TouchButton: '🔘'
    };
    const icon = typeIcons[node.type] || '📦';

    let html = `
      <div class="tree-item-branch" data-id="${node.id}">
        <div class="tree-item" data-id="${node.id}" style="padding-left: ${8 + indentPx}px;">
          ${hasChildren ? `
            <span class="tree-expander ${isCollapsed ? 'collapsed' : ''}" data-toggle="${node.id}">
              ${isCollapsed ? '▶' : '▼'}
            </span>
          ` : `<span class="tree-spacer" style="width: 12px; display: inline-block;"></span>`}

          <span class="item-visibility ${isVisible ? 'vis-on' : 'vis-off'}" title="Toggle visibility">
            ${isVisible ? '👁' : '🚫'}
          </span>
          <span class="item-icon">${icon}</span>
          <span class="item-name" title="${node.id}">${node.name || node.id}</span>
          <span class="item-badge">${node.type}</span>
          <div class="item-actions">
            <button class="btn-tree-action" data-action="up" title="Move layer up">▲</button>
            <button class="btn-tree-action" data-action="down" title="Move layer down">▼</button>
            <button class="btn-tree-action btn-tree-del" data-action="delete" title="Delete element">✕</button>
          </div>
        </div>
    `;

    // Render children if expanded
    if (hasChildren && !isCollapsed) {
      html += `<div class="tree-children-container">`;
      for (const childId of node.children) {
        const childNode = this.model.getComponent(childId);
        if (childNode) {
          html += this._renderNodeBranch(childNode, depth + 1);
        }
      }
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  _attachEvents() {
    // Selection on click
    const items = this.container.querySelectorAll('.tree-item');
    items.forEach(el => {
      const id = el.getAttribute('data-id');

      el.addEventListener('click', (e) => {
        if (
          e.target.closest('.item-actions') || 
          e.target.closest('.item-visibility') || 
          e.target.closest('.tree-expander')
        ) return;
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

    // Expand / Collapse toggles
    const expanders = this.container.querySelectorAll('.tree-expander');
    expanders.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-toggle');
        if (this.collapsedNodes.has(targetId)) {
          this.collapsedNodes.delete(targetId);
        } else {
          this.collapsedNodes.add(targetId);
        }
        this.render();
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
