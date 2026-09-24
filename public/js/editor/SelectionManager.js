/**
 * SelectionManager - Manages element selection, multi-selection, and resize handle hit detection.
 */
export class SelectionManager {
  constructor(projectModel) {
    this.model = projectModel;
    this.selectedIds = new Set();
    this.listeners = [];
  }

  getSelectedId() {
    return this.selectedIds.values().next().value || null;
  }

  getSelectedIds() {
    return Array.from(this.selectedIds);
  }

  getSelectedComponents() {
    return this.getSelectedIds()
      .map(id => this.model.getComponent(id))
      .filter(Boolean);
  }

  isSelected(id) {
    return this.selectedIds.has(id);
  }

  select(id, multi = false) {
    if (!multi) {
      this.selectedIds.clear();
    }
    if (id) {
      this.selectedIds.add(id);
    }
    this._notify();
  }

  deselect(id) {
    if (id) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.clear();
    }
    this._notify();
  }

  toggle(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this._notify();
  }

  clear() {
    if (this.selectedIds.size > 0) {
      this.selectedIds.clear();
      this._notify();
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  _notify() {
    const selected = this.getSelectedComponents();
    for (const listener of this.listeners) {
      try {
        listener({
          selectedIds: this.getSelectedIds(),
          primary: selected[0] || null,
          count: selected.length
        });
      } catch (err) {
        console.error('SelectionManager listener error:', err);
      }
    }
  }

  /**
   * Find the top-most component at logical coordinates (screen, x, y).
   */
  findComponentAt(screenType, x, y) {
    const screen = this.model.getActiveScreen();
    if (!screen) return null;

    // Filter components on target screen, sorted reverse by zIndex
    const comps = screen.components
      .filter(c => c.screen === screenType && c.visible !== false)
      .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

    for (const comp of comps) {
      if (
        x >= comp.x &&
        x <= comp.x + comp.width &&
        y >= comp.y &&
        y <= comp.y + comp.height
      ) {
        return comp;
      }
    }
    return null;
  }

  /**
   * 8 resize handles for the selected component.
   */
  getResizeHandles(comp) {
    if (!comp) return [];
    const handleSize = 6;
    const half = handleSize / 2;
    const { x, y, width: w, height: h } = comp;

    return [
      { id: 'nw', x: x - half, y: y - half, cursor: 'nwse-resize' },
      { id: 'n',  x: x + w / 2 - half, y: y - half, cursor: 'ns-resize' },
      { id: 'ne', x: x + w - half, y: y - half, cursor: 'nesw-resize' },
      { id: 'e',  x: x + w - half, y: y + h / 2 - half, cursor: 'ew-resize' },
      { id: 'se', x: x + w - half, y: y + h - half, cursor: 'nwse-resize' },
      { id: 's',  x: x + w / 2 - half, y: y + h - half, cursor: 'ns-resize' },
      { id: 'sw', x: x - half, y: y + h - half, cursor: 'nesw-resize' },
      { id: 'w',  x: x - half, y: y + h / 2 - half, cursor: 'ew-resize' },
    ];
  }

  /**
   * Check if a point hits any resize handle of the primary selected component.
   */
  getHandleAt(comp, localX, localY, tolerance = 6) {
    if (!comp) return null;
    const handles = this.getResizeHandles(comp);
    for (const h of handles) {
      if (
        localX >= h.x - tolerance &&
        localX <= h.x + 6 + tolerance &&
        localY >= h.y - tolerance &&
        localY <= h.y + 6 + tolerance
      ) {
        return h;
      }
    }
    return null;
  }
}
