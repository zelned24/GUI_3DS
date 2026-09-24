import { PropertyTypes } from '../core/PropertySystem.js';

/**
 * Inspector - Schema-driven two-way property binding inspector for 3DS UI components & nodes.
 * Automatically constructs property controls from Component schemas.
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
      if ((type === 'componentUpdated' || type === 'hierarchyChanged') && !this.isEditing) {
        const primary = this.selection.getSelectedComponents()[0];
        if (primary && (!data.component || primary.id === data.component.id)) {
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

    const schema = comp.constructor.schema || { properties: {} };
    const screen = this.model.getActiveScreen();

    // Potential container parents on the same physical screen
    const potentialParents = (screen?.components || []).filter(c => 
      c.id !== comp.id && 
      c.screen === comp.screen && 
      !c.isDescendantOf(comp.id, this.model)
    );

    let html = `
      <div class="inspector-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">${schema.icon || '📦'}</span>
          <div>
            <div class="badge-type">${schema.displayName || comp.type}</div>
            <div style="font-size: 10px; color: var(--text-dim);">${comp.id}</div>
          </div>
        </div>
        <div class="badge-screen ${comp.screen}">${comp.screen.toUpperCase()}</div>
      </div>

      <!-- IDENTITY & HIERARCHY -->
      <div class="inspector-section">
        <div class="section-title">Identity & Hierarchy</div>
        
        <div class="field-row">
          <label>ID</label>
          <input type="text" id="prop_id" class="input-text" value="${comp.id}" />
        </div>

        <div class="field-row">
          <label>Display Name</label>
          <input type="text" id="prop_name" class="input-text" value="${comp.name || comp.id}" />
        </div>

        <div class="field-row">
          <label>Parent Container</label>
          <select id="prop_parent" class="input-select">
            <option value="" ${!comp.parent ? 'selected' : ''}>(None - Root Level)</option>
            ${potentialParents.map(p => `
              <option value="${p.id}" ${comp.parent === p.id ? 'selected' : ''}>${p.id} (${p.type})</option>
            `).join('')}
          </select>
        </div>

        <div class="field-row">
          <label>Screen Target</label>
          <select id="prop_screen" class="input-select">
            <option value="top" ${comp.screen === 'top' ? 'selected' : ''}>Top (400×240)</option>
            <option value="bottom" ${comp.screen === 'bottom' ? 'selected' : ''}>Bottom (320×240)</option>
          </select>
        </div>
      </div>

      <!-- 3DS TRANSFORM -->
      <div class="inspector-section">
        <div class="section-title">3DS Spatial Transform</div>

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
            <label>Width (px)</label>
            <input type="number" id="prop_width" class="input-num" value="${comp.width}" min="1" step="1" />
          </div>
          <div class="field-row">
            <label>Height (px)</label>
            <input type="number" id="prop_height" class="input-num" value="${comp.height}" min="1" step="1" />
          </div>
        </div>

        <div class="field-grid-2">
          <div class="field-row">
            <label>Scale X</label>
            <input type="number" id="prop_scaleX" class="input-num" value="${comp.transform.scaleX}" step="0.05" />
          </div>
          <div class="field-row">
            <label>Scale Y</label>
            <input type="number" id="prop_scaleY" class="input-num" value="${comp.transform.scaleY}" step="0.05" />
          </div>
        </div>

        <div class="field-grid-2">
          <div class="field-row">
            <label>Rotation (°)</label>
            <input type="number" id="prop_rotation" class="input-num" value="${comp.transform.rotation}" step="1" />
          </div>
          <div class="field-row">
            <label>Opacity</label>
            <input type="number" id="prop_opacity" class="input-num" value="${comp.opacity}" min="0" max="1" step="0.05" />
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

    // Group schema properties by category
    const categories = new Map();
    const schemaProps = schema.properties || {};

    for (const [propKey, propDef] of Object.entries(schemaProps)) {
      const cat = propDef.category || 'Properties';
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat).push({ key: propKey, def: propDef });
    }

    for (const [catName, propList] of categories.entries()) {
      html += `
        <div class="inspector-section">
          <div class="section-title">${catName}</div>
          ${propList.map(({ key, def }) => this._renderPropertyWidget(comp, key, def)).join('')}
        </div>
      `;
    }

    // Action buttons (duplicate, delete)
    html += `
      <div class="inspector-actions">
        <button id="btn_duplicate_comp" class="btn btn-secondary">Duplicate (Ctrl+D)</button>
        <button id="btn_delete_comp" class="btn btn-danger">Delete</button>
      </div>
    `;

    this.container.innerHTML = html;
    this._attachInputHandlers(comp, schema);
  }

  _renderPropertyWidget(comp, key, def) {
    const val = comp.properties[key] !== undefined ? comp.properties[key] : def.defaultValue;
    const inputId = `prop_custom_${key}`;

    switch (def.type) {
      case PropertyTypes.BOOLEAN:
        return `
          <div class="field-row checkbox-row">
            <label>${def.displayName}</label>
            <input type="checkbox" id="${inputId}" data-prop="${key}" ${val ? 'checked' : ''} />
          </div>
        `;

      case PropertyTypes.INTEGER:
        return `
          <div class="field-row">
            <label>${def.displayName}</label>
            <input type="number" id="${inputId}" data-prop="${key}" class="input-num" value="${val}" 
              ${def.min !== undefined ? `min="${def.min}"` : ''} 
              ${def.max !== undefined ? `max="${def.max}"` : ''} 
              step="${def.step || 1}" />
          </div>
        `;

      case PropertyTypes.FLOAT:
        return `
          <div class="field-row">
            <label>${def.displayName}</label>
            <input type="number" id="${inputId}" data-prop="${key}" class="input-num" value="${val}" 
              ${def.min !== undefined ? `min="${def.min}"` : ''} 
              ${def.max !== undefined ? `max="${def.max}"` : ''} 
              step="${def.step || 0.1}" />
          </div>
        `;

      case PropertyTypes.COLOR:
        return `
          <div class="field-row">
            <label>${def.displayName}</label>
            <div class="color-picker-wrap">
              <input type="color" id="${inputId}" data-prop="${key}" value="${val || '#ffffff'}" />
              <input type="text" id="${inputId}_text" class="input-color-hex" value="${val || '#ffffff'}" />
            </div>
          </div>
        `;

      case PropertyTypes.ENUM:
        return `
          <div class="field-row">
            <label>${def.displayName}</label>
            <select id="${inputId}" data-prop="${key}" class="input-select">
              ${def.options.map(opt => {
                const optVal = typeof opt === 'object' ? opt.value : opt;
                const optLabel = typeof opt === 'object' ? opt.label : opt;
                return `<option value="${optVal}" ${val === optVal ? 'selected' : ''}>${optLabel}</option>`;
              }).join('')}
            </select>
          </div>
        `;

      case PropertyTypes.STRING:
      case PropertyTypes.ACTION:
      default:
        return `
          <div class="field-row">
            <label>${def.displayName}</label>
            <input type="text" id="${inputId}" data-prop="${key}" class="input-text" value="${this._escapeHtml(val ?? '')}" />
          </div>
        `;
    }
  }

  _attachInputHandlers(comp, schema) {
    const bindDirect = (id, propKey, isNumeric = false, isBool = false) => {
      const el = this.container.querySelector(`#${id}`);
      if (!el) return;

      const handler = () => {
        this.isEditing = true;
        let val;
        if (isBool) {
          val = el.checked;
        } else if (isNumeric) {
          val = parseFloat(el.value) || 0;
        } else {
          val = el.value;
        }

        this.model.updateComponent(comp.id, { [propKey]: val });
        setTimeout(() => { this.isEditing = false; }, 50);
      };

      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    };

    // Standard Node & Transform properties
    bindDirect('prop_id', 'id');
    bindDirect('prop_name', 'name');
    bindDirect('prop_screen', 'screen');
    bindDirect('prop_x', 'x', true);
    bindDirect('prop_y', 'y', true);
    bindDirect('prop_width', 'width', true);
    bindDirect('prop_height', 'height', true);
    bindDirect('prop_scaleX', 'scaleX', true);
    bindDirect('prop_scaleY', 'scaleY', true);
    bindDirect('prop_rotation', 'rotation', true);
    bindDirect('prop_opacity', 'opacity', true);
    bindDirect('prop_zIndex', 'zIndex', true);
    bindDirect('prop_visible', 'visible', false, true);

    // Parent reparenting binding
    const parentSelect = this.container.querySelector('#prop_parent');
    if (parentSelect) {
      parentSelect.addEventListener('change', () => {
        const newParent = parentSelect.value || null;
        this.model.reparentNode(comp.id, newParent);
      });
    }

    // Dynamic schema property bindings
    const schemaProps = schema.properties || {};
    for (const [key, propDef] of Object.entries(schemaProps)) {
      const inputId = `prop_custom_${key}`;
      const el = this.container.querySelector(`#${inputId}`);
      if (!el) continue;

      if (propDef.type === PropertyTypes.COLOR) {
        const textEl = this.container.querySelector(`#${inputId}_text`);
        el.addEventListener('input', () => {
          if (textEl) textEl.value = el.value;
          this.model.updateComponent(comp.id, { properties: { [key]: el.value } });
        });
        if (textEl) {
          textEl.addEventListener('input', () => {
            if (/^#[0-9a-fA-F]{6}$/.test(textEl.value)) {
              el.value = textEl.value;
              this.model.updateComponent(comp.id, { properties: { [key]: textEl.value } });
            }
          });
        }
      } else {
        const handler = () => {
          this.isEditing = true;
          let val = el.value;
          if (propDef.type === PropertyTypes.BOOLEAN) {
            val = el.checked;
          } else if (propDef.type === PropertyTypes.INTEGER || propDef.type === PropertyTypes.FLOAT) {
            val = parseFloat(el.value);
          }
          const sanitized = propDef.sanitize(val);
          this.model.updateComponent(comp.id, { properties: { [key]: sanitized } });
          setTimeout(() => { this.isEditing = false; }, 50);
        };

        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
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
