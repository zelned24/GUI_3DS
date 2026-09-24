/**
 * Inspector - Two-way property binding inspector for 3DS UI components.
 */
export class Inspector {
  constructor(containerElement, projectModel, selectionManager) {
    this.container = containerElement;
    this.model = projectModel;
    this.selection = selectionManager;
    this.isEditing = false;

    this._setupSubscriptions();
  }

  _setupSubscriptions() {
    this.selection.subscribe(({ primary }) => {
      this.render(primary);
    });

    this.model.subscribe((type, data) => {
      if (type === 'componentUpdated' && !this.isEditing) {
        const primary = this.selection.getSelectedComponents()[0];
        if (primary && primary.id === data.component?.id) {
          this.render(primary);
        }
      }
    });
  }

  render(comp) {
    if (!comp) {
      this.container.innerHTML = `
        <div class="inspector-empty">
          <div class="empty-icon">🎯</div>
          <p>No element selected</p>
          <span class="hint">Click any component on the dual canvas or hierarchy tree to inspect and edit its properties.</span>
        </div>
      `;
      return;
    }

    const p = comp.properties || {};

    let html = `
      <div class="inspector-header">
        <div class="badge-type">${comp.type}</div>
        <div class="badge-screen ${comp.screen}">${comp.screen.toUpperCase()}</div>
      </div>

      <div class="inspector-section">
        <div class="section-title">Identity & Layout</div>
        
        <div class="field-row">
          <label>ID</label>
          <input type="text" id="prop_id" class="input-text" value="${comp.id}" />
        </div>

        <div class="field-row">
          <label>Screen</label>
          <select id="prop_screen" class="input-select">
            <option value="top" ${comp.screen === 'top' ? 'selected' : ''}>Top (400×240)</option>
            <option value="bottom" ${comp.screen === 'bottom' ? 'selected' : ''}>Bottom (320×240)</option>
          </select>
        </div>

        <div class="field-grid-2">
          <div class="field-row">
            <label>X (px)</label>
            <input type="number" id="prop_x" class="input-num" value="${comp.x}" step="1" />
          </div>
          <div class="field-row">
            <label>Y (px)</label>
            <input type="number" id="prop_y" class="input-num" value="${comp.y}" step="1" />
          </div>
        </div>

        <div class="field-grid-2">
          <div class="field-row">
            <label>Width</label>
            <input type="number" id="prop_width" class="input-num" value="${comp.width}" min="1" step="1" />
          </div>
          <div class="field-row">
            <label>Height</label>
            <input type="number" id="prop_height" class="input-num" value="${comp.height}" min="1" step="1" />
          </div>
        </div>

        <div class="field-grid-2">
          <div class="field-row">
            <label>Z-Index</label>
            <input type="number" id="prop_zIndex" class="input-num" value="${comp.zIndex}" step="1" />
          </div>
          <div class="field-row checkbox-row">
            <label>Visible</label>
            <input type="checkbox" id="prop_visible" ${comp.visible !== false ? 'checked' : ''} />
          </div>
        </div>
      </div>
    `;

    // Type-specific properties section
    html += `<div class="inspector-section">
      <div class="section-title">${comp.type} Properties</div>
    `;

    if (comp.type === 'RogueBox') {
      html += `
        <div class="field-row">
          <label>Background</label>
          <div class="color-picker-wrap">
            <input type="color" id="prop_bg" value="${p.backgroundColor || '#1e2230'}" />
            <input type="text" id="prop_bg_text" class="input-color-hex" value="${p.backgroundColor || '#1e2230'}" />
          </div>
        </div>
        <div class="field-row">
          <label>Border Color</label>
          <div class="color-picker-wrap">
            <input type="color" id="prop_border" value="${p.borderColor || '#c83834'}" />
            <input type="text" id="prop_border_text" class="input-color-hex" value="${p.borderColor || '#c83834'}" />
          </div>
        </div>
        <div class="field-grid-2">
          <div class="field-row">
            <label>Border Width</label>
            <input type="number" id="prop_borderWidth" class="input-num" value="${p.borderWidth ?? 2}" min="0" max="16" />
          </div>
          <div class="field-row">
            <label>Radius</label>
            <input type="number" id="prop_borderRadius" class="input-num" value="${p.borderRadius ?? 4}" min="0" max="24" />
          </div>
        </div>
      `;
    } else if (comp.type === 'PixelText') {
      html += `
        <div class="field-row">
          <label>Text</label>
          <input type="text" id="prop_text" class="input-text" value="${this._escapeHtml(p.text || '')}" />
        </div>
        <div class="field-grid-2">
          <div class="field-row">
            <label>Font Size</label>
            <input type="number" id="prop_fontSize" class="input-num" value="${p.fontSize || 14}" min="8" max="64" />
          </div>
          <div class="field-row">
            <label>Align</label>
            <select id="prop_align" class="input-select">
              <option value="left" ${p.align === 'left' ? 'selected' : ''}>Left</option>
              <option value="center" ${p.align === 'center' ? 'selected' : ''}>Center</option>
              <option value="right" ${p.align === 'right' ? 'selected' : ''}>Right</option>
            </select>
          </div>
        </div>
        <div class="field-row">
          <label>Color</label>
          <div class="color-picker-wrap">
            <input type="color" id="prop_color" value="${p.color || '#ffffff'}" />
            <input type="text" id="prop_color_text" class="input-color-hex" value="${p.color || '#ffffff'}" />
          </div>
        </div>
      `;
    } else if (comp.type === 'TouchButton') {
      html += `
        <div class="field-row">
          <label>Label</label>
          <input type="text" id="prop_label" class="input-text" value="${this._escapeHtml(p.label || '')}" />
        </div>
        <div class="field-grid-2">
          <div class="field-row">
            <label>Focus ID</label>
            <input type="number" id="prop_focusId" class="input-num" value="${p.focusId ?? 0}" min="0" />
          </div>
          <div class="field-row">
            <label>Action Tag</label>
            <input type="text" id="prop_action" class="input-text" value="${this._escapeHtml(p.action || 'ON_CLICK')}" />
          </div>
        </div>
        <div class="field-row">
          <label>Button Color</label>
          <div class="color-picker-wrap">
            <input type="color" id="prop_btn_bg" value="${p.backgroundColor || '#2b3040'}" />
            <input type="text" id="prop_btn_bg_text" class="input-color-hex" value="${p.backgroundColor || '#2b3040'}" />
          </div>
        </div>
        <div class="field-row">
          <label>Border Color</label>
          <div class="color-picker-wrap">
            <input type="color" id="prop_btn_border" value="${p.borderColor || '#e84545'}" />
            <input type="text" id="prop_btn_border_text" class="input-color-hex" value="${p.borderColor || '#e84545'}" />
          </div>
        </div>
        <div class="field-row">
          <label>Text Color</label>
          <div class="color-picker-wrap">
            <input type="color" id="prop_btn_txt" value="${p.textColor || '#ffffff'}" />
            <input type="text" id="prop_btn_txt_text" class="input-color-hex" value="${p.textColor || '#ffffff'}" />
          </div>
        </div>
      `;
    }

    html += `</div>`;

    // Action buttons (duplicate, delete)
    html += `
      <div class="inspector-actions">
        <button id="btn_duplicate_comp" class="btn btn-secondary">Duplicate (Ctrl+D)</button>
        <button id="btn_delete_comp" class="btn btn-danger">Delete</button>
      </div>
    `;

    this.container.innerHTML = html;
    this._attachInputHandlers(comp);
  }

  _attachInputHandlers(comp) {
    const bind = (id, propKey, isNumeric = false, isBool = false, isNestedProp = false) => {
      const el = this.container.querySelector(`#${id}`);
      if (!el) return;

      const handler = () => {
        this.isEditing = true;
        let val;
        if (isBool) {
          val = el.checked;
        } else if (isNumeric) {
          val = Math.round(parseFloat(el.value) || 0);
        } else {
          val = el.value;
        }

        const updates = isNestedProp
          ? { properties: { [propKey]: val } }
          : { [propKey]: val };

        this.model.updateComponent(comp.id, updates);
        setTimeout(() => { this.isEditing = false; }, 50);
      };

      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    };

    // Standard properties
    bind('prop_id', 'id');
    bind('prop_screen', 'screen');
    bind('prop_x', 'x', true);
    bind('prop_y', 'y', true);
    bind('prop_width', 'width', true);
    bind('prop_height', 'height', true);
    bind('prop_zIndex', 'zIndex', true);
    bind('prop_visible', 'visible', false, true);

    // Color picker dual sync helper
    const bindColor = (pickerId, textId, propKey) => {
      const picker = this.container.querySelector(`#${pickerId}`);
      const text = this.container.querySelector(`#${textId}`);
      if (!picker || !text) return;

      picker.addEventListener('input', () => {
        text.value = picker.value;
        this.model.updateComponent(comp.id, { properties: { [propKey]: picker.value } });
      });

      text.addEventListener('input', () => {
        if (/^#[0-9a-fA-F]{6}$/.test(text.value)) {
          picker.value = text.value;
          this.model.updateComponent(comp.id, { properties: { [propKey]: text.value } });
        }
      });
    };

    // Component-specific properties
    if (comp.type === 'RogueBox') {
      bindColor('prop_bg', 'prop_bg_text', 'backgroundColor');
      bindColor('prop_border', 'prop_border_text', 'borderColor');
      bind('prop_borderWidth', 'borderWidth', true, false, true);
      bind('prop_borderRadius', 'borderRadius', true, false, true);
    } else if (comp.type === 'PixelText') {
      bind('prop_text', 'text', false, false, true);
      bind('prop_fontSize', 'fontSize', true, false, true);
      bind('prop_align', 'align', false, false, true);
      bindColor('prop_color', 'prop_color_text', 'color');
    } else if (comp.type === 'TouchButton') {
      bind('prop_label', 'label', false, false, true);
      bind('prop_action', 'action', false, false, true);
      bind('prop_focusId', 'focusId', true, false, true);
      bindColor('prop_btn_bg', 'prop_btn_bg_text', 'backgroundColor');
      bindColor('prop_btn_border', 'prop_btn_border_text', 'borderColor');
      bindColor('prop_btn_txt', 'prop_btn_txt_text', 'textColor');
    }

    // Action buttons
    const dupBtn = this.container.querySelector('#btn_duplicate_comp');
    if (dupBtn) {
      dupBtn.onclick = () => {
        const cloned = this.model.duplicateComponent(comp.id);
        if (cloned) this.selection.select(cloned.id);
      };
    }

    const delBtn = this.container.querySelector('#btn_delete_comp');
    if (delBtn) {
      delBtn.onclick = () => {
        this.model.removeComponent(comp.id);
        this.selection.clear();
      };
    }
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
