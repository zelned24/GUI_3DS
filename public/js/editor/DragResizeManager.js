/**
 * DragResizeManager - Handles dragging and resizing elements with strict integer pixel snapping.
 */
export class DragResizeManager {
  constructor(projectModel, selectionManager) {
    this.model = projectModel;
    this.selection = selectionManager;

    this.state = null; // null | { mode: 'drag'|'resize', ... }
  }

  isInteracting() {
    return this.state !== null;
  }

  /**
   * Start dragging the selected component.
   */
  startDrag(comp, startLogicalX, startLogicalY) {
    if (!comp) return;
    this.state = {
      mode: 'drag',
      comp,
      startX: startLogicalX,
      startY: startLogicalY,
      initialCompX: comp.x,
      initialCompY: comp.y,
      initialState: comp.toJSON()
    };
  }

  /**
   * Start resizing with a specific handle ('nw', 'n', 'se', etc.).
   */
  startResize(comp, handleId, startLogicalX, startLogicalY) {
    if (!comp) return;
    this.state = {
      mode: 'resize',
      comp,
      handle: handleId,
      startX: startLogicalX,
      startY: startLogicalY,
      initialCompX: comp.x,
      initialCompY: comp.y,
      initialWidth: comp.width,
      initialHeight: comp.height,
      initialState: comp.toJSON()
    };
  }

  /**
   * Update drag or resize movement on mousemove.
   */
  update(currentLogicalX, currentLogicalY) {
    if (!this.state) return;
    const { mode, comp } = this.state;

    if (mode === 'drag') {
      const dx = Math.round(currentLogicalX - this.state.startX);
      const dy = Math.round(currentLogicalY - this.state.startY);

      const newX = Math.round(this.state.initialCompX + dx);
      const newY = Math.round(this.state.initialCompY + dy);

      this.model.updateComponent(comp.id, { x: newX, y: newY }, false);
    } else if (mode === 'resize') {
      const dx = Math.round(currentLogicalX - this.state.startX);
      const dy = Math.round(currentLogicalY - this.state.startY);
      const handle = this.state.handle;

      let { initialCompX: x, initialCompY: y, initialWidth: w, initialHeight: h } = this.state;

      const minW = 8;
      const minH = 8;

      if (handle.includes('e')) {
        w = Math.max(minW, Math.round(w + dx));
      }
      if (handle.includes('s')) {
        h = Math.max(minH, Math.round(h + dy));
      }
      if (handle.includes('w')) {
        const potentialW = Math.round(w - dx);
        if (potentialW >= minW) {
          x = Math.round(x + dx);
          w = potentialW;
        }
      }
      if (handle.includes('n')) {
        const potentialH = Math.round(h - dy);
        if (potentialH >= minH) {
          y = Math.round(y + dy);
          h = potentialH;
        }
      }

      this.model.updateComponent(comp.id, { x, y, width: w, height: h }, false);
    }
  }

  /**
   * Finish drag or resize, push command to history.
   */
  end() {
    if (!this.state) return;
    const { comp, initialState } = this.state;
    const finalState = comp.toJSON();

    // Check if there was any actual change
    const changed = (
      initialState.x !== finalState.x ||
      initialState.y !== finalState.y ||
      initialState.width !== finalState.width ||
      initialState.height !== finalState.height
    );

    if (changed) {
      this.model.history.push({
        description: this.state.mode === 'drag'
          ? `Move ${comp.id} to (${finalState.x}, ${finalState.y})`
          : `Resize ${comp.id} to ${finalState.width}x${finalState.height}`,
        undo: () => {
          this.model.updateComponent(comp.id, initialState, false);
        },
        execute: () => {
          this.model.updateComponent(comp.id, finalState, false);
        }
      });
    }

    this.state = null;
  }
}
