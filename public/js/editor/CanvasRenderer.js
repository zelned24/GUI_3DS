/**
 * CanvasRenderer - Renders the Dual 3DS screen displays (Top 400x240, Bottom 320x240),
 * hinge representation, pixel grid, component layers, selection outlines, and handles.
 */
export class CanvasRenderer {
  constructor(canvasElement, projectModel, selectionManager, dragResizeManager) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.model = projectModel;
    this.selection = selectionManager;
    this.dragResize = dragResizeManager;

    // View options
    this.viewMode = 'dual'; // 'dual' | 'top' | 'bottom'
    this.zoom = 2; // 1, 2, 3, 4, or 'fit'
    this.panX = 0;
    this.panY = 0;
    this.showGrid = true;
    this.gridSize = 8;

    // Fixed physical layout metrics (logical pixels)
    this.TOP_WIDTH = 400;
    this.TOP_HEIGHT = 240;
    this.BOTTOM_WIDTH = 320;
    this.BOTTOM_HEIGHT = 240;
    this.HINGE_HEIGHT = 24;

    this._setupEvents();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.render();
  }

  setZoom(zoom) {
    this.zoom = zoom;
    this.render();
  }

  setGrid(enabled) {
    this.showGrid = enabled;
    this.render();
  }

  /**
   * Logical screen layouts in editor space.
   */
  getLayout() {
    const topW = this.TOP_WIDTH;
    const topH = this.TOP_HEIGHT;
    const botW = this.BOTTOM_WIDTH;
    const botH = this.BOTTOM_HEIGHT;
    const hinge = this.HINGE_HEIGHT;

    if (this.viewMode === 'top') {
      return {
        top: { x: 0, y: 0, width: topW, height: topH, visible: true },
        bottom: { x: 0, y: 0, width: botW, height: botH, visible: false },
        totalWidth: topW,
        totalHeight: topH
      };
    }
    if (this.viewMode === 'bottom') {
      return {
        top: { x: 0, y: 0, width: topW, height: topH, visible: false },
        bottom: { x: 0, y: 0, width: botW, height: botH, visible: true },
        totalWidth: botW,
        totalHeight: botH
      };
    }

    // Dual view: Top centered above Bottom, separated by hinge
    const maxW = Math.max(topW, botW);
    const topX = Math.round((maxW - topW) / 2);
    const topY = 0;
    const botX = Math.round((maxW - botW) / 2);
    const botY = topH + hinge;

    return {
      top: { x: topX, y: topY, width: topW, height: topH, visible: true },
      bottom: { x: botX, y: botY, width: botW, height: botH, visible: true },
      hinge: { x: 0, y: topH, width: maxW, height: hinge },
      totalWidth: maxW,
      totalHeight: topH + hinge + botH
    };
  }

  /**
   * Convert mouse event client coordinates to logical screen coordinates.
   * Returns { screen: 'top'|'bottom'|null, localX: number, localY: number }
   */
  windowToLogical(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.getEffectiveScale();
    const layout = this.getLayout();

    // Canvas center offset
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;

    const originX = canvasCenterX + this.panX - (layout.totalWidth * scale) / 2;
    const originY = canvasCenterY + this.panY - (layout.totalHeight * scale) / 2;

    const canvasX = (clientX - rect.left);
    const canvasY = (clientY - rect.top);

    const logicalX = Math.round((canvasX - originX) / scale);
    const logicalY = Math.round((canvasY - originY) / scale);

    // Hit test top screen
    if (
      layout.top.visible &&
      logicalX >= layout.top.x &&
      logicalX <= layout.top.x + layout.top.width &&
      logicalY >= layout.top.y &&
      logicalY <= layout.top.y + layout.top.height
    ) {
      return {
        screen: 'top',
        localX: logicalX - layout.top.x,
        localY: logicalY - layout.top.y,
        logicalX,
        logicalY
      };
    }

    // Hit test bottom screen
    if (
      layout.bottom.visible &&
      logicalX >= layout.bottom.x &&
      logicalX <= layout.bottom.x + layout.bottom.width &&
      logicalY >= layout.bottom.y &&
      logicalY <= layout.bottom.y + layout.bottom.height
    ) {
      return {
        screen: 'bottom',
        localX: logicalX - layout.bottom.x,
        localY: logicalY - layout.bottom.y,
        logicalX,
        logicalY
      };
    }

    return {
      screen: null,
      localX: logicalX,
      localY: logicalY,
      logicalX,
      logicalY
    };
  }

  getEffectiveScale() {
    if (typeof this.zoom === 'number') {
      return this.zoom;
    }
    // Fit mode
    const layout = this.getLayout();
    const pad = 40;
    const scaleX = (this.canvas.width - pad) / layout.totalWidth;
    const scaleY = (this.canvas.height - pad) / layout.totalHeight;
    return Math.max(0.5, Math.min(scaleX, scaleY));
  }

  resizeToContainer() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth || 800;
    const h = parent.clientHeight || 600;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.render();
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!w || !h) return;

    // Clear background
    ctx.fillStyle = '#0f1118';
    ctx.fillRect(0, 0, w, h);

    const scale = this.getEffectiveScale();
    const layout = this.getLayout();

    const canvasCenterX = w / 2;
    const canvasCenterY = h / 2;
    const originX = Math.round(canvasCenterX + this.panX - (layout.totalWidth * scale) / 2);
    const originY = Math.round(canvasCenterY + this.panY - (layout.totalHeight * scale) / 2);

    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(scale, scale);

    const screenData = this.model.getActiveScreen();

    // 1. Draw Hinge if in dual view
    if (layout.hinge) {
      this._drawHinge(ctx, layout.hinge);
    }

    // 2. Draw Top Screen
    if (layout.top.visible) {
      ctx.save();
      ctx.translate(layout.top.x, layout.top.y);
      this._drawScreenSurface(ctx, layout.top.width, layout.top.height, screenData?.top?.backgroundColor || '#12141c', 'TOP (400×240)');
      if (this.showGrid) this._drawGrid(ctx, layout.top.width, layout.top.height);
      this._drawComponents(ctx, 'top');
      this._drawSelection(ctx, 'top');
      ctx.restore();
    }

    // 3. Draw Bottom Screen
    if (layout.bottom.visible) {
      ctx.save();
      ctx.translate(layout.bottom.x, layout.bottom.y);
      this._drawScreenSurface(ctx, layout.bottom.width, layout.bottom.height, screenData?.bottom?.backgroundColor || '#1a1824', 'BOTTOM (320×240) - TOUCH');
      if (this.showGrid) this._drawGrid(ctx, layout.bottom.width, layout.bottom.height);
      this._drawComponents(ctx, 'bottom');
      this._drawSelection(ctx, 'bottom');
      ctx.restore();
    }

    ctx.restore();
  }

  _drawHinge(ctx, hinge) {
    // 3DS console bisagra (hinge) aesthetic with stereo speakers indicator & notification LED
    ctx.fillStyle = '#1c1f2b';
    ctx.fillRect(hinge.x, hinge.y, hinge.width, hinge.height);

    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(hinge.x, hinge.y + 4, hinge.width, hinge.height - 8);

    // Hinge seam line
    ctx.strokeStyle = '#2d3345';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hinge.x, hinge.y + hinge.height / 2);
    ctx.lineTo(hinge.x + hinge.width, hinge.y + hinge.height / 2);
    ctx.stroke();

    // Nintendo 3DS hinge badge
    ctx.fillStyle = '#667085';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NINTENDO 3DS HINGE', hinge.x + hinge.width / 2, hinge.y + hinge.height / 2);
  }

  _drawScreenSurface(ctx, width, height, bgColor, label) {
    // Screen bezel shadow & frame
    ctx.fillStyle = '#06070a';
    ctx.fillRect(-2, -2, width + 4, height + 4);

    // Bezel border
    ctx.strokeStyle = '#2b3040';
    ctx.lineWidth = 1;
    ctx.strokeRect(-1, -1, width + 2, height + 2);

    // Screen display surface
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Watermark label in top-left
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, 6, 6);
  }

  _drawGrid(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    const size = this.gridSize;
    ctx.beginPath();
    for (let x = size; x < width; x += size) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    for (let y = size; y < height; y += size) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawComponents(ctx, screenType) {
    const screen = this.model.getActiveScreen();
    if (!screen) return;

    // Sort by zIndex
    const comps = screen.components
      .filter(c => (c.screen === screenType || c.screen === 'global') && c.visible !== false)
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const comp of comps) {
      comp.render(ctx);
    }
  }

  _drawSelection(ctx, screenType) {
    const selectedComps = this.selection.getSelectedComponents()
      .filter(c => c.screen === screenType);

    for (const comp of selectedComps) {
      const { x, y, width: w, height: h } = comp;

      // Selection bounding box
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
      ctx.setLineDash([]);

      // Dimensions tag
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(x, Math.max(0, y - 14), 70, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${w}×${h} (${x},${y})`, x + 3, Math.max(0, y - 14) + 7);

      // Resize handles
      const handles = this.selection.getResizeHandles(comp);
      for (const hnd of handles) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(hnd.x, hnd.y, 6, 6);
        ctx.strokeStyle = '#0284c7';
        ctx.strokeRect(hnd.x, hnd.y, 6, 6);
      }

      ctx.restore();
    }
  }

  _setupEvents() {
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      // Middle click or space+click for pan
      if (e.button === 1 || e.altKey || (e.button === 0 && e.shiftKey && e.ctrlKey)) {
        isPanning = true;
        panStartX = e.clientX - this.panX;
        panStartY = e.clientY - this.panY;
        e.preventDefault();
        return;
      }

      if (e.button !== 0) return; // Only left click for selection & interaction

      const hit = this.windowToLogical(e.clientX, e.clientY);
      const primaryComp = this.selection.getSelectedComponents()[0];

      // Check handle hit first if a component is selected
      if (primaryComp && primaryComp.screen === hit.screen) {
        const handle = this.selection.getHandleAt(primaryComp, hit.localX, hit.localY);
        if (handle) {
          this.dragResize.startResize(primaryComp, handle.id, hit.localX, hit.localY);
          return;
        }
      }

      // Check component hit
      if (hit.screen) {
        const clickedComp = this.selection.findComponentAt(hit.screen, hit.localX, hit.localY);
        if (clickedComp) {
          this.selection.select(clickedComp.id, e.shiftKey);
          this.dragResize.startDrag(clickedComp, hit.localX, hit.localY);
          this.render();
          return;
        }
      }

      // Clicked on empty space: clear selection
      this.selection.clear();
      this.render();
    });

    window.addEventListener('mousemove', (e) => {
      if (isPanning) {
        this.panX = e.clientX - panStartX;
        this.panY = e.clientY - panStartY;
        this.render();
        return;
      }

      if (this.dragResize.isInteracting()) {
        const hit = this.windowToLogical(e.clientX, e.clientY);
        this.dragResize.update(hit.localX, hit.localY);
        this.render();
        return;
      }

      // Cursor update for handles
      const hit = this.windowToLogical(e.clientX, e.clientY);
      const primaryComp = this.selection.getSelectedComponents()[0];
      if (primaryComp && primaryComp.screen === hit.screen) {
        const handle = this.selection.getHandleAt(primaryComp, hit.localX, hit.localY);
        if (handle) {
          this.canvas.style.cursor = handle.cursor;
          return;
        }
      }
      this.canvas.style.cursor = 'default';
    });

    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
      }
      if (this.dragResize.isInteracting()) {
        this.dragResize.end();
        this.render();
      }
    });

    // Zoom on wheel
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (typeof this.zoom !== 'number') this.zoom = 2;
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      this.zoom = Math.max(0.5, Math.min(6, parseFloat((this.zoom + delta).toFixed(2))));
      this.render();
    }, { passive: false });

    // Drag and Drop from Asset Browser or external palette
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const rawData = e.dataTransfer.getData('application/json');
      if (!rawData) return;

      try {
        const nodeData = JSON.parse(rawData);
        const hit = this.windowToLogical(e.clientX, e.clientY);
        const targetScreen = hit.screen || 'top';
        const w = nodeData.width || 64;
        const h = nodeData.height || 64;

        const posX = hit.localX !== undefined ? Math.round(hit.localX - w / 2) : 0;
        const posY = hit.localY !== undefined ? Math.round(hit.localY - h / 2) : 0;

        const screen = this.model.getActiveScreen();
        if (!screen) return;

        const comp = this.model.addComponent({
          ...nodeData,
          screen: targetScreen,
          x: posX,
          y: posY
        });

        if (comp) {
          this.selection.select(comp);
        }
        this.render();
      } catch (err) {
        console.error('Failed to instantiate dropped asset node:', err);
      }
    });
  }
}
