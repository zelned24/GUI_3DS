/**
 * PreviewRuntime - Interactive 3DS simulator with D-pad, face buttons (A, B, X, Y),
 * shoulder buttons (L, R), bottom touch screen hit testing, and state management.
 */
export class PreviewRuntime {
  constructor(modalElement, projectModel) {
    this.modal = modalElement;
    this.model = projectModel;

    this.topCanvas = null;
    this.bottomCanvas = null;
    this.topCtx = null;
    this.bottomCtx = null;

    this.isRunning = false;
    this.animFrameId = null;
    this.focusedIndex = 0;
    this.pressedId = null;
    this.lastTime = 0;
    this.dt = 0;

    this.interactiveButtons = [];
    this.logHistory = [];

    this._buildUI();
  }

  _buildUI() {
    this.modal.innerHTML = `
      <div class="preview-backdrop"></div>
      <div class="preview-dialog">
        <div class="preview-header">
          <div class="preview-title">
            <span class="badge-3ds">3DS</span>
            <span>Interactive Runtime Simulator</span>
          </div>
          <div class="preview-controls">
            <button id="btn_preview_play" class="btn btn-sm btn-success" title="Play">▶ Play</button>
            <button id="btn_preview_pause" class="btn btn-sm btn-secondary" title="Pause">⏸ Pause</button>
            <button id="btn_preview_restart" class="btn btn-sm btn-secondary" title="Restart">🔄 Restart</button>
            <button id="btn_preview_close" class="btn btn-sm btn-danger" title="Close Preview">✕</button>
          </div>
        </div>

        <div class="preview-body">
          <!-- 3DS CHASSIS CONSOLE FRAME -->
          <div class="chassis-3ds">
            <!-- TOP SCREEN HOUSING -->
            <div class="chassis-top-housing">
              <div class="chassis-speaker-left"></div>
              <div class="screen-frame screen-frame-top">
                <canvas id="preview_top_canvas" width="400" height="240"></canvas>
              </div>
              <div class="chassis-speaker-right"></div>
            </div>

            <!-- CHASSIS HINGE -->
            <div class="chassis-hinge-bar">
              <div class="hinge-indicator">NINTENDO 3DS</div>
            </div>

            <!-- BOTTOM SCREEN HOUSING -->
            <div class="chassis-bottom-housing">
              <!-- LEFT CONTROLS: D-PAD & CIRCLE PAD -->
              <div class="chassis-left-pad">
                <div class="dpad-container">
                  <button class="dpad-btn dpad-up" data-btn="UP">▲</button>
                  <button class="dpad-btn dpad-left" data-btn="LEFT">◀</button>
                  <div class="dpad-center"></div>
                  <button class="dpad-btn dpad-right" data-btn="RIGHT">▶</button>
                  <button class="dpad-btn dpad-down" data-btn="DOWN">▼</button>
                </div>
              </div>

              <!-- TOUCH SCREEN -->
              <div class="screen-frame screen-frame-bottom">
                <canvas id="preview_bottom_canvas" width="320" height="240"></canvas>
                <div class="touch-hint">TOUCH SCREEN ENABLED</div>
              </div>

              <!-- RIGHT CONTROLS: A, B, X, Y -->
              <div class="chassis-right-pad">
                <div class="action-buttons">
                  <button class="action-btn btn-x" data-btn="X">X</button>
                  <div class="action-row-mid">
                    <button class="action-btn btn-y" data-btn="Y">Y</button>
                    <button class="action-btn btn-a" data-btn="A">A</button>
                  </div>
                  <button class="action-btn btn-b" data-btn="B">B</button>
                </div>
              </div>
            </div>

            <!-- BOTTOM STATUS STRIP -->
            <div class="chassis-status-strip">
              <div class="shoulder-group">
                <button class="shoulder-btn" data-btn="L">[L TRIGGER]</button>
                <button class="shoulder-btn" data-btn="R">[R TRIGGER]</button>
              </div>
              <div class="keyboard-legend">
                <span>Keys: Arrows = D-Pad | Z = A | X = B | C = X | V = Y | Click = Touch</span>
              </div>
            </div>
          </div>

          <!-- DIAGNOSTIC CONSOLE LOG -->
          <div class="preview-console">
            <div class="console-title">Runtime Event Console</div>
            <div class="console-logs" id="preview_console_logs">
              <div class="log-entry log-info">[Runtime] 3DS Engine initialized. Ready for input.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.topCanvas = this.modal.querySelector('#preview_top_canvas');
    this.bottomCanvas = this.modal.querySelector('#preview_bottom_canvas');
    this.topCtx = this.topCanvas.getContext('2d');
    this.bottomCtx = this.bottomCanvas.getContext('2d');

    this._setupControls();
  }

  _setupControls() {
    this.modal.querySelector('#btn_preview_close').onclick = () => this.hide();
    this.modal.querySelector('.preview-backdrop').onclick = () => this.hide();

    this.modal.querySelector('#btn_preview_play').onclick = () => this.resume();
    this.modal.querySelector('#btn_preview_pause').onclick = () => this.pause();
    this.modal.querySelector('#btn_preview_restart').onclick = () => this.restart();

    // D-Pad and Action buttons
    const btns = this.modal.querySelectorAll('[data-btn]');
    btns.forEach(btn => {
      const code = btn.getAttribute('data-btn');
      btn.addEventListener('mousedown', () => this.handleButtonDown(code));
      btn.addEventListener('mouseup', () => this.handleButtonUp(code));
    });

    // Touch screen click & drag
    this.bottomCanvas.addEventListener('mousedown', (e) => this._handleTouch(e, true));
    this.bottomCanvas.addEventListener('mouseup', (e) => this._handleTouch(e, false));

    // Keyboard bindings
    this._keyHandler = (e) => {
      if (!this.modal.classList.contains('active')) return;
      const keyMap = {
        ArrowUp: 'UP',
        ArrowDown: 'DOWN',
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
        z: 'A', Z: 'A',
        x: 'B', X: 'B',
        c: 'X', C: 'X',
        v: 'Y', V: 'Y',
        q: 'L', Q: 'L',
        e: 'R', E: 'R'
      };
      const btn = keyMap[e.key];
      if (btn) {
        e.preventDefault();
        if (e.type === 'keydown') this.handleButtonDown(btn);
        else if (e.type === 'keyup') this.handleButtonUp(btn);
      }
    };
    window.addEventListener('keydown', this._keyHandler);
    window.addEventListener('keyup', this._keyHandler);
  }

  show() {
    this.modal.classList.add('active');
    this.restart();
  }

  hide() {
    this.pause();
    this.modal.classList.remove('active');
  }

  restart() {
    this.pause();
    this.focusedIndex = 0;
    this.pressedId = null;
    this._refreshButtons();
    this.log(`Screen "${this.model.activeScreenId}" loaded into memory`);
    this.resume();
  }

  resume() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this._loop();
  }

  pause() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  _refreshButtons() {
    const screen = this.model.getActiveScreen();
    if (!screen) {
      this.interactiveButtons = [];
      return;
    }
    // Collect all TouchButton components ordered by focusId
    this.interactiveButtons = screen.components
      .filter(c => c.type === 'TouchButton' && c.visible !== false && c.enabled !== false)
      .sort((a, b) => (a.properties?.focusId ?? 0) - (b.properties?.focusId ?? 0));
  }

  handleButtonDown(btn) {
    if (btn === 'DOWN') {
      if (this.interactiveButtons.length > 0) {
        this.focusedIndex = (this.focusedIndex + 1) % this.interactiveButtons.length;
        const target = this.interactiveButtons[this.focusedIndex];
        this.log(`[D-PAD DOWN] Focused: ${target.id} ("${target.properties.label}")`);
      }
    } else if (btn === 'UP') {
      if (this.interactiveButtons.length > 0) {
        this.focusedIndex = (this.focusedIndex - 1 + this.interactiveButtons.length) % this.interactiveButtons.length;
        const target = this.interactiveButtons[this.focusedIndex];
        this.log(`[D-PAD UP] Focused: ${target.id} ("${target.properties.label}")`);
      }
    } else if (btn === 'A') {
      const target = this.interactiveButtons[this.focusedIndex];
      if (target) {
        this.pressedId = target.id;
        this.log(`[3DS A BUTTON] Triggered: ${target.id} (Action: ${target.properties.action || 'DEFAULT'})`);
      }
    } else {
      this.log(`[3DS ${btn}] Pressed`);
    }
  }

  handleButtonUp(btn) {
    if (btn === 'A' && this.pressedId) {
      this.pressedId = null;
    }
  }

  _handleTouch(e, isDown) {
    const rect = this.bottomCanvas.getBoundingClientRect();
    const scaleX = 320 / rect.width;
    const scaleY = 240 / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    if (isDown) {
      const screen = this.model.getActiveScreen();
      if (!screen) return;

      const hit = screen.components
        .filter(c => c.screen === 'bottom' && c.visible !== false)
        .reverse()
        .find(c => x >= c.x && x <= c.x + c.width && y >= c.y && y <= c.y + c.height);

      if (hit) {
        this.pressedId = hit.id;
        const btnIdx = this.interactiveButtons.findIndex(b => b.id === hit.id);
        if (btnIdx !== -1) this.focusedIndex = btnIdx;
        this.log(`[TOUCH HIT] (${x}, ${y}) -> ${hit.id} (${hit.type}) triggered!`);
      } else {
        this.log(`[TOUCH] (${x}, ${y}) on empty bottom screen surface`);
      }
    } else {
      this.pressedId = null;
    }
  }

  log(msg) {
    const logsEl = this.modal.querySelector('#preview_console_logs');
    if (!logsEl) return;
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${time}] ${msg}`;
    logsEl.appendChild(entry);
    logsEl.scrollTop = logsEl.scrollHeight;
  }

  _loop() {
    if (!this.isRunning) return;

    const now = performance.now();
    this.dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this._draw();
    this.animFrameId = requestAnimationFrame(() => this._loop());
  }

  _draw() {
    const screen = this.model.getActiveScreen();
    if (!screen) return;

    const focusedComp = this.interactiveButtons[this.focusedIndex];

    const renderOpts = {
      focusedId: focusedComp ? focusedComp.id : null,
      focusedIndex: this.focusedIndex,
      pressedId: this.pressedId,
      previewMode: true
    };

    // Draw Top (400x240)
    const topCtx = this.topCtx;
    topCtx.fillStyle = screen.top?.backgroundColor || '#12141c';
    topCtx.fillRect(0, 0, 400, 240);

    const topComps = screen.components
      .filter(c => c.screen === 'top' && c.visible !== false)
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const comp of topComps) {
      comp.render(topCtx, renderOpts);
    }

    // Draw Bottom (320x240)
    const botCtx = this.bottomCtx;
    botCtx.fillStyle = screen.bottom?.backgroundColor || '#1a1824';
    botCtx.fillRect(0, 0, 320, 240);

    const botComps = screen.components
      .filter(c => c.screen === 'bottom' && c.visible !== false)
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const comp of botComps) {
      comp.render(botCtx, renderOpts);
    }
  }
}
