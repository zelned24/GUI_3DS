import { ProjectModel } from './core/ProjectModel.js';
import { SelectionManager } from './editor/SelectionManager.js';
import { DragResizeManager } from './editor/DragResizeManager.js';
import { CanvasRenderer } from './editor/CanvasRenderer.js';
import { Inspector } from './editor/Inspector.js';
import { Hierarchy } from './editor/Hierarchy.js';
import { PreviewRuntime } from './preview/PreviewRuntime.js';
import { Validator } from './core/Validator.js';
import { CodeGenerator } from './generator/CodeGenerator.js';
import { DataStudioUI } from './data/DataStudioUI.js';
import { BattleLabUI } from './battle/BattleLabUI.js';
import { AppShell, AppStates } from './shell/AppShell.js';

/**
 * StudioApp - Main Studio IDE Application orchestrator.
 */
class StudioApp {
  constructor() {
    this.model = new ProjectModel();
    this.selection = new SelectionManager(this.model);
    this.dragResize = new DragResizeManager(this.model, this.selection);

    this.canvas = document.getElementById('studio_canvas');
    this.canvasRenderer = new CanvasRenderer(this.canvas, this.model, this.selection, this.dragResize);

    this.inspectorContainer = document.getElementById('inspector_content');
    this.inspector = new Inspector(this.inspectorContainer, this.model, this.selection);

    this.hierarchyContainer = document.getElementById('hierarchy_content');
    this.hierarchy = new Hierarchy(this.hierarchyContainer, this.model, this.selection);

    this.previewModal = document.getElementById('preview_modal');
    this.previewRuntime = new PreviewRuntime(this.previewModal, this.model);

    this.codeModal = document.getElementById('code_modal');
    this.validationModal = document.getElementById('validation_modal');

    // 5-Pillar Studios: Data Studio & Battle Lab
    this.currentMode = 'game';
    this.dataStudioContainer = document.getElementById('data_studio_view');
    this.dataStudio = new DataStudioUI(this.dataStudioContainer);

    this.battleLabContainer = document.getElementById('battle_lab_view');
    this.battleLab = new BattleLabUI(this.battleLabContainer);

    // Primary 3DS Game Player Engine (AppShell)
    this.gameTopContainer = document.getElementById('game_top_screen');
    this.gameBottomContainer = document.getElementById('game_bottom_screen');
    this.appShell = new AppShell({
      topContainer: this.gameTopContainer,
      bottomContainer: this.gameBottomContainer,
      onEnterDebug: () => {
        this.setStudioMode('battle');
      }
    });

    this._init();
  }


  async _init() {
    this._bindToolbar();
    this._bindKeyboardShortcuts();
    this._bindWindowResize();

    // Load initial project from server / disk
    await this.loadProjectFromServer();

    // Initial render
    this.canvasRenderer.resizeToContainer();
    this.canvasRenderer.render();
    this.hierarchy.render();

    // Start 3DS Game Player Engine (Primary Experience)
    this.appShell.init();
    this.setStudioMode('game');
    this.updateStatus('PokéRogue 3DS Game Player active — Dual 400x240 / 320x240 screens.');
  }

  async loadProjectFromServer() {
    try {
      this.updateStatus('Loading project from disk...');
      const res = await fetch('/api/project');
      if (res.ok) {
        const data = await res.json();
        if (data.project) {
          this.model.project = data.project;
        }
        if (data.screens && data.screens.length > 0) {
          for (const s of data.screens) {
            this.model.loadScreen(s);
          }
          const defaultScreen = data.project?.settings?.defaultScreen || data.screens[0].id;
          this.model.setActiveScreen(defaultScreen);
          this._populateScreenSelector();
        }
        this.updateStatus('Project loaded successfully.');
      } else {
        throw new Error('Server returned ' + res.status);
      }
    } catch (err) {
      console.warn('Could not load from /api/project, using fallback local template:', err);
      // Fallback: create default ExampleScreen
      this._createDefaultFallbackScreen();
      this._populateScreenSelector();
      this.updateStatus('Fallback demo screen loaded.');
    }
  }

  _createDefaultFallbackScreen() {
    this.model.loadScreen({
      id: 'ExampleScreen',
      name: 'Example Screen',
      top: { width: 400, height: 240, backgroundColor: '#12141c' },
      bottom: { width: 320, height: 240, backgroundColor: '#1a1824' },
      components: [
        {
          id: 'top_banner_box',
          type: 'RogueBox',
          screen: 'top',
          x: 40,
          y: 28,
          width: 320,
          height: 184,
          properties: { backgroundColor: '#1e2230', borderColor: '#c83834', borderWidth: 2, borderRadius: 4 }
        },
        {
          id: 'title_text',
          type: 'PixelText',
          screen: 'top',
          x: 80,
          y: 64,
          width: 240,
          height: 32,
          properties: { text: 'ROGUE 3DS TEST', fontSize: 18, color: '#ffcb05', align: 'center' }
        },
        {
          id: 'start_button',
          type: 'TouchButton',
          screen: 'top',
          x: 130,
          y: 128,
          width: 140,
          height: 36,
          properties: { label: '[ START ]', action: 'START_GAME', focusId: 0 }
        },
        {
          id: 'bottom_menu_box',
          type: 'RogueBox',
          screen: 'bottom',
          x: 30,
          y: 20,
          width: 260,
          height: 200,
          properties: { backgroundColor: '#241f2a', borderColor: '#9e2835', borderWidth: 2, borderRadius: 4 }
        },
        {
          id: 'btn_play',
          type: 'TouchButton',
          screen: 'bottom',
          x: 60,
          y: 56,
          width: 200,
          height: 44,
          properties: { label: 'PLAY', action: 'OPEN_BATTLE', focusId: 1 }
        },
        {
          id: 'btn_settings',
          type: 'TouchButton',
          screen: 'bottom',
          x: 60,
          y: 124,
          width: 200,
          height: 44,
          properties: { label: 'SETTINGS', action: 'OPEN_SETTINGS', focusId: 2 }
        }
      ]
    });
  }

  async saveProjectToServer() {
    try {
      this.updateStatus('Saving project to disk...');
      const payload = {
        project: this.model.project,
        screens: Array.from(this.model.screensMap.values()).map(s => ({
          id: s.id,
          name: s.name,
          top: s.top,
          bottom: s.bottom,
          components: s.components.map(c => c.toJSON())
        }))
      };

      const res = await fetch('/api/project/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        this.updateStatus('Project saved successfully to project/ directory.');
        this._showToast('✓ Project saved to disk', 'success');
      } else {
        throw new Error('Save failed with status ' + res.status);
      }
    } catch (err) {
      console.error('Error saving project:', err);
      this.updateStatus('Save failed: ' + err.message);
      this._showToast('✕ Error saving project to server', 'error');
    }
  }

  async generateCpp() {
    const screen = this.model.getActiveScreen();
    if (!screen) {
      alert('No screen selected');
      return;
    }

    // Run validator first
    const val = Validator.validateScreen(screen);
    if (!val.valid) {
      this.showValidationReport(val);
      this.updateStatus('Validation failed. Please resolve errors before export.');
      return;
    }

    try {
      this.updateStatus('Generating C++ code...');
      const generated = CodeGenerator.generate(screen);

      // Save generated files to server
      const res = await fetch('/api/generate-cpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generated)
      });

      let serverSaved = false;
      if (res.ok) {
        serverSaved = true;
        this.updateStatus(`Generated C++ files written to ${generated.headerPath} & ${generated.sourcePath}`);
      }

      this._showCodeModal(generated, serverSaved);
    } catch (err) {
      console.error('Error in code generator:', err);
      alert('Code generation error: ' + err.message);
    }
  }

  _showCodeModal(generated, serverSaved) {
    const modal = this.codeModal;
    modal.innerHTML = `
      <div class="code-modal-dialog">
        <div class="code-modal-header">
          <div class="title">
            <span>⚡ Generated C++ for ${generated.className}</span>
            ${serverSaved ? '<span class="saved-badge">✓ Written to disk</span>' : ''}
          </div>
          <button id="btn_close_code" class="btn btn-sm btn-secondary">✕</button>
        </div>

        <div class="code-modal-tabs">
          <button class="tab-btn active" data-tab="hpp">${generated.headerPath}</button>
          <button class="tab-btn" data-tab="cpp">${generated.sourcePath}</button>
        </div>

        <div class="code-modal-body">
          <pre id="code_display_hpp" class="code-block active"><code>${this._escapeHtml(generated.hpp)}</code></pre>
          <pre id="code_display_cpp" class="code-block"><code>${this._escapeHtml(generated.cpp)}</code></pre>
        </div>

        <div class="code-modal-footer">
          <div class="meta-info">Deterministic Citro2D / devkitARM Screen Class</div>
          <div class="btn-group">
            <button id="btn_copy_code" class="btn btn-secondary">Copy to Clipboard</button>
            <button id="btn_download_code" class="btn btn-primary">Download Files</button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('active');

    modal.querySelector('#btn_close_code').onclick = () => modal.classList.remove('active');

    // Tab switching
    const tabBtns = modal.querySelectorAll('.tab-btn');
    const hppBlock = modal.querySelector('#code_display_hpp');
    const cppBlock = modal.querySelector('#code_display_cpp');

    let activeTab = 'hpp';
    tabBtns.forEach(btn => {
      btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.getAttribute('data-tab');
        if (activeTab === 'hpp') {
          hppBlock.classList.add('active');
          cppBlock.classList.remove('active');
        } else {
          hppBlock.classList.remove('active');
          cppBlock.classList.add('active');
        }
      };
    });

    // Copy to clipboard
    modal.querySelector('#btn_copy_code').onclick = () => {
      const text = activeTab === 'hpp' ? generated.hpp : generated.cpp;
      navigator.clipboard.writeText(text);
      this._showToast('Copied to clipboard!', 'success');
    };

    // Download files
    modal.querySelector('#btn_download_code').onclick = () => {
      this._downloadFile(`${generated.className}.hpp`, generated.hpp);
      setTimeout(() => {
        this._downloadFile(`${generated.className}.cpp`, generated.cpp);
      }, 200);
    };
  }

  showValidationReport(report = null) {
    if (!report) {
      report = this.model.validateActiveScreen();
    }
    const modal = this.validationModal;
    const errors = report.errors || [];

    modal.innerHTML = `
      <div class="validation-dialog">
        <div class="validation-header">
          <div class="title">
            <span>🔍 3DS Screen Validator</span>
            <span class="val-summary-badge ${report.valid ? 'val-pass' : 'val-fail'}">
              ${report.valid ? '✓ VALID FOR 3DS' : `✕ ${errors.length} ISSUE(S)`}
            </span>
          </div>
          <button id="btn_close_val" class="btn btn-sm btn-secondary">✕</button>
        </div>

        <div class="validation-body">
          ${errors.length === 0 ? `
            <div class="val-all-good">
              <div class="val-icon">✓</div>
              <h3>Screen structure is 100% compliant</h3>
              <p>Top (400×240) and Bottom (320×240) constraints verified. Ready for C++ compilation and Azahar testing.</p>
            </div>
          ` : `
            <div class="val-issues-list">
              ${errors.map(err => `
                <div class="val-issue-item ${err.level}">
                  <div class="val-badge">${err.level.toUpperCase()}</div>
                  <div class="val-details">
                    <div class="val-comp">Component: <strong>${err.componentId || '(Screen)'}</strong> ${err.property ? `| Property: <code>${err.property}</code>` : ''} ${err.value !== undefined ? `| Value: <code>${err.value}</code>` : ''}</div>
                    <div class="val-msg">${err.message}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="validation-footer">
          <button id="btn_val_ok" class="btn btn-primary">Close</button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('#btn_close_val').onclick = () => modal.classList.remove('active');
    modal.querySelector('#btn_val_ok').onclick = () => modal.classList.remove('active');
  }

  _bindToolbar() {
    // Add component buttons
    document.getElementById('btn_add_box')?.addEventListener('click', () => {
      const activeScreenType = this.canvasRenderer.viewMode === 'bottom' ? 'bottom' : 'top';
      const comp = this.model.addComponent({
        type: 'RogueBox',
        screen: activeScreenType,
        x: 40,
        y: 40,
        width: 140,
        height: 80
      });
      this.selection.select(comp.id);
      this.canvasRenderer.render();
    });

    document.getElementById('btn_add_text')?.addEventListener('click', () => {
      const activeScreenType = this.canvasRenderer.viewMode === 'bottom' ? 'bottom' : 'top';
      const comp = this.model.addComponent({
        type: 'PixelText',
        screen: activeScreenType,
        x: 50,
        y: 50,
        width: 120,
        height: 24,
        properties: { text: 'New Pixel Text', fontSize: 14, color: '#ffffff' }
      });
      this.selection.select(comp.id);
      this.canvasRenderer.render();
    });

    document.getElementById('btn_add_button')?.addEventListener('click', () => {
      // Buttons default to Bottom touch screen
      const activeScreenType = this.canvasRenderer.viewMode === 'top' ? 'top' : 'bottom';
      const screen = this.model.getActiveScreen();
      const existingButtons = screen.components.filter(c => c.type === 'TouchButton');

      const comp = this.model.addComponent({
        type: 'TouchButton',
        screen: activeScreenType,
        x: 40,
        y: 40 + existingButtons.length * 36,
        width: 160,
        height: 32,
        properties: {
          label: `BUTTON ${existingButtons.length + 1}`,
          action: `ACTION_${existingButtons.length + 1}`,
          focusId: existingButtons.length
        }
      });
      this.selection.select(comp.id);
      this.canvasRenderer.render();
    });

    document.getElementById('btn_add_healthbar')?.addEventListener('click', () => {
      const activeScreenType = this.canvasRenderer.viewMode === 'bottom' ? 'bottom' : 'top';
      const comp = this.model.addComponent({
        type: 'HealthBar',
        screen: activeScreenType,
        x: 40,
        y: 30,
        width: 180,
        height: 18,
        properties: {
          pokemonBinding: 'pikachu',
          currentHp: 74,
          maxHp: 82,
          showNumbers: true
        }
      });
      this.selection.select(comp.id);
      this.canvasRenderer.render();
    });

    document.getElementById('btn_add_movebutton')?.addEventListener('click', () => {
      const activeScreenType = this.canvasRenderer.viewMode === 'top' ? 'top' : 'bottom';
      const comp = this.model.addComponent({
        type: 'MoveButton',
        screen: activeScreenType,
        x: 20,
        y: 60,
        width: 135,
        height: 40,
        properties: {
          moveBinding: 'thunderbolt',
          moveName: 'Thunderbolt',
          moveType: 'Electric',
          category: 'Special',
          power: 90,
          currentPp: 15,
          maxPp: 15,
          action: 'USE_THUNDERBOLT'
        }
      });
      this.selection.select(comp.id);
      this.canvasRenderer.render();
    });

    // 5-Pillar Mode Switcher Tabs
    document.getElementById('mode_game_player')?.addEventListener('click', () => this.setStudioMode('game'));
    document.getElementById('mode_ui_studio')?.addEventListener('click', () => this.setStudioMode('ui'));
    document.getElementById('mode_data_studio')?.addEventListener('click', () => this.setStudioMode('data'));
    document.getElementById('mode_battle_lab')?.addEventListener('click', () => this.setStudioMode('battle'));

    // View mode selectors
    document.getElementById('view_dual')?.addEventListener('click', (e) => {
      this._setActiveViewBtn(e.target);
      this.canvasRenderer.setViewMode('dual');
    });

    document.getElementById('view_top')?.addEventListener('click', (e) => {
      this._setActiveViewBtn(e.target);
      this.canvasRenderer.setViewMode('top');
    });
    document.getElementById('view_bottom')?.addEventListener('click', (e) => {
      this._setActiveViewBtn(e.target);
      this.canvasRenderer.setViewMode('bottom');
    });

    // Zoom selector
    document.getElementById('zoom_select')?.addEventListener('change', (e) => {
      const val = e.target.value;
      this.canvasRenderer.setZoom(val === 'fit' ? 'fit' : parseFloat(val));
    });

    // Grid toggle
    document.getElementById('toggle_grid')?.addEventListener('change', (e) => {
      this.canvasRenderer.setGrid(e.target.checked);
    });

    // Save & Load
    document.getElementById('btn_save')?.addEventListener('click', () => {
      this.saveProjectToServer();
    });

    // Generate C++
    document.getElementById('btn_generate')?.addEventListener('click', () => {
      this.generateCpp();
    });

    // Validate
    document.getElementById('btn_validate')?.addEventListener('click', () => {
      this.showValidationReport();
    });

    // Interactive Preview
    document.getElementById('btn_preview')?.addEventListener('click', () => {
      this.previewRuntime.show();
    });

    // Undo / Redo
    document.getElementById('btn_undo')?.addEventListener('click', () => {
      this.model.history.undo();
      this.canvasRenderer.render();
    });
    document.getElementById('btn_redo')?.addEventListener('click', () => {
      this.model.history.redo();
      this.canvasRenderer.render();
    });

    // New Screen
    document.getElementById('btn_new_screen')?.addEventListener('click', () => {
      const id = prompt('Enter new Screen ID (e.g. BattleScreen, StarterSelect):');
      if (id && id.trim()) {
        try {
          this.model.createScreen(id.trim());
          this._populateScreenSelector();
          this.canvasRenderer.render();
          this.hierarchy.render();
          this.updateStatus(`Screen "${id.trim()}" created.`);
        } catch (err) {
          alert(err.message);
        }
      }
    });

    // Screen selector
    document.getElementById('screen_selector')?.addEventListener('change', (e) => {
      this.model.setActiveScreen(e.target.value);
      this.selection.clear();
      this.canvasRenderer.render();
      this.hierarchy.render();
      this.updateStatus(`Switched to screen "${e.target.value}".`);
    });

    // Model listener to re-render canvas on changes
    this.model.subscribe(() => {
      this.canvasRenderer.render();
      this._updateUndoRedoButtons();
    });

    this.selection.subscribe(() => {
      this.canvasRenderer.render();
    });

    this.model.history.subscribe(() => {
      this._updateUndoRedoButtons();
    });
  }

  _updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn_undo');
    const redoBtn = document.getElementById('btn_redo');
    if (undoBtn) undoBtn.disabled = !this.model.history.canUndo();
    if (redoBtn) redoBtn.disabled = !this.model.history.canRedo();
  }

  _setActiveViewBtn(btn) {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  setStudioMode(mode) {
    this.currentMode = mode;
    const gameView = document.getElementById('game_view');
    const uiView = document.getElementById('ui_studio_view');
    const dataView = document.getElementById('data_studio_view');
    const battleView = document.getElementById('battle_lab_view');

    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));

    if (mode === 'game') {
      document.getElementById('mode_game_player')?.classList.add('active');
      if (gameView) gameView.style.display = 'flex';
      if (uiView) uiView.style.display = 'none';
      if (dataView) dataView.style.display = 'none';
      if (battleView) battleView.style.display = 'none';
      this.updateStatus('Game Play Mode active — Nintendo 3DS Dual Viewport (Waves 1-10).');
    } else if (mode === 'ui') {
      document.getElementById('mode_ui_studio')?.classList.add('active');
      if (gameView) gameView.style.display = 'none';
      if (uiView) uiView.style.display = 'flex';
      if (dataView) dataView.style.display = 'none';
      if (battleView) battleView.style.display = 'none';
      this.canvasRenderer.resizeToContainer();
      this.canvasRenderer.render();
      this.updateStatus('UI Studio active — Designing 3DS screens & components.');
    } else if (mode === 'data') {
      document.getElementById('mode_data_studio')?.classList.add('active');
      if (gameView) gameView.style.display = 'none';
      if (uiView) uiView.style.display = 'none';
      if (dataView) dataView.style.display = 'block';
      if (battleView) battleView.style.display = 'none';
      this.dataStudio.render();
      this.updateStatus('Data Studio active — Canonical PokéRogue species, moves & abilities.');
    } else if (mode === 'battle') {
      document.getElementById('mode_battle_lab')?.classList.add('active');
      if (gameView) gameView.style.display = 'none';
      if (uiView) uiView.style.display = 'none';
      if (dataView) dataView.style.display = 'none';
      if (battleView) battleView.style.display = 'block';
      this.battleLab.render();
      this.updateStatus('Battle Lab active — Simulating combat, phase queue & damage debugger.');
    }
  }


  _populateScreenSelector() {
    const sel = document.getElementById('screen_selector');
    if (!sel) return;
    sel.innerHTML = '';
    for (const [id, screen] of this.model.screensMap.entries()) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = screen.name || id;
      if (id === this.model.activeScreenId) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  _bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if typing in text inputs or textareas
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      // Ctrl+Z: Undo
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.model.history.undo();
        this.canvasRenderer.render();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if ((e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        this.model.history.redo();
        this.canvasRenderer.render();
        return;
      }

      // Ctrl+D: Duplicate
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const primary = this.selection.getSelectedComponents()[0];
        if (primary) {
          const cloned = this.model.duplicateComponent(primary.id);
          if (cloned) this.selection.select(cloned.id);
          this.canvasRenderer.render();
        }
        return;
      }

      // Ctrl+S: Save
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveProjectToServer();
        return;
      }

      // Delete or Backspace: Remove selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const selected = this.selection.getSelectedIds();
        for (const id of selected) {
          this.model.removeComponent(id);
        }
        this.selection.clear();
        this.canvasRenderer.render();
        return;
      }
    });
  }

  _bindWindowResize() {
    window.addEventListener('resize', () => {
      this.canvasRenderer.resizeToContainer();
      this.canvasRenderer.render();
    });
  }

  updateStatus(msg) {
    const el = document.getElementById('status_message');
    if (el) el.textContent = msg;
  }

  _showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `studio-toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }

  _downloadFile(filename, text) {
    const el = document.createElement('a');
    el.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    el.setAttribute('download', filename);
    el.style.display = 'none';
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new StudioApp();
});
