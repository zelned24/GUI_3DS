/**
 * PropertySystem - Reusable property definitions with validation, metadata,
 * and automatic UI widget generation capabilities for the 3DS Studio Inspector.
 */

export const PropertyTypes = {
  INTEGER: 'integer',
  FLOAT: 'float',
  BOOLEAN: 'boolean',
  STRING: 'string',
  COLOR: 'color',
  ENUM: 'enum',
  VECTOR2: 'vector2',
  SIZE: 'size',
  ACTION: 'action',
  JSON: 'json'
};

export class PropertyDefinition {
  /**
   * @param {Object} config
   * @param {string} config.type - One of PropertyTypes
   * @param {string} config.displayName - Human readable name
   * @param {*} config.defaultValue - Default value
   * @param {string} [config.category='General'] - Grouping category in Inspector
   * @param {number} [config.min] - Minimum numeric value
   * @param {number} [config.max] - Maximum numeric value
   * @param {number} [config.step=1] - Numeric step size
   * @param {Array<string|{value: any, label: string}>} [config.options] - Enum choices
   * @param {boolean} [config.readonly=false] - Whether property is editable
   * @param {string} [config.description=''] - Tooltip / documentation
   */
  constructor(config = {}) {
    this.type = config.type || PropertyTypes.STRING;
    this.displayName = config.displayName || 'Property';
    this.defaultValue = config.defaultValue;
    this.category = config.category || 'General';
    this.min = config.min;
    this.max = config.max;
    this.step = config.step ?? (this.type === PropertyTypes.INTEGER ? 1 : 0.1);
    this.options = config.options || [];
    this.readonly = Boolean(config.readonly);
    this.description = config.description || '';
  }

  /**
   * Sanitizes and validates a given raw value according to type rules.
   */
  sanitize(val) {
    if (val === undefined || val === null) {
      return this.defaultValue;
    }

    switch (this.type) {
      case PropertyTypes.INTEGER: {
        let n = parseInt(val, 10);
        if (isNaN(n)) n = this.defaultValue ?? 0;
        if (this.min !== undefined) n = Math.max(this.min, n);
        if (this.max !== undefined) n = Math.min(this.max, n);
        return n;
      }
      case PropertyTypes.FLOAT: {
        let f = parseFloat(val);
        if (isNaN(f)) f = this.defaultValue ?? 0.0;
        if (this.min !== undefined) f = Math.max(this.min, f);
        if (this.max !== undefined) f = Math.min(this.max, f);
        return f;
      }
      case PropertyTypes.BOOLEAN:
        return Boolean(val);

      case PropertyTypes.STRING:
      case PropertyTypes.ACTION:
        return String(val);

      case PropertyTypes.COLOR: {
        const str = String(val).trim();
        if (/^#[0-9a-fA-F]{3,8}$/.test(str)) {
          return str;
        }
        return this.defaultValue || '#ffffff';
      }

      case PropertyTypes.ENUM: {
        if (this.options.length > 0) {
          const allowed = this.options.map(opt => (typeof opt === 'object' ? opt.value : opt));
          if (!allowed.includes(val)) {
            return this.defaultValue || allowed[0];
          }
        }
        return val;
      }

      default:
        return val;
    }
  }
}

/**
 * Factory helpers for concise schema declarations.
 */
export const Props = {
  integer(displayName, defaultValue = 0, options = {}) {
    return new PropertyDefinition({
      type: PropertyTypes.INTEGER,
      displayName,
      defaultValue,
      ...options
    });
  },

  float(displayName, defaultValue = 0.0, options = {}) {
    return new PropertyDefinition({
      type: PropertyTypes.FLOAT,
      displayName,
      defaultValue,
      ...options
    });
  },

  boolean(displayName, defaultValue = true, options = {}) {
    return new PropertyDefinition({
      type: PropertyTypes.BOOLEAN,
      displayName,
      defaultValue,
      ...options
    });
  },

  string(displayName, defaultValue = '', options = {}) {
    return new PropertyDefinition({
      type: PropertyTypes.STRING,
      displayName,
      defaultValue,
      ...options
    });
  },

  color(displayName, defaultValue = '#ffffff', options = {}) {
    return new PropertyDefinition({
      type: PropertyTypes.COLOR,
      displayName,
      defaultValue,
      ...options
    });
  },

  enum(displayName, optionsList, defaultValue, options = {}) {
    return new PropertyDefinition({
      type: PropertyTypes.ENUM,
      displayName,
      options: optionsList,
      defaultValue: defaultValue ?? (typeof optionsList[0] === 'object' ? optionsList[0].value : optionsList[0]),
      ...options
    });
  },

  action(displayName, defaultValue = 'DEFAULT_ACTION', options = {}) {
    return new PropertyDefinition({
      type: PropertyTypes.ACTION,
      displayName,
      defaultValue,
      ...options
    });
  },

  json(displayName, defaultValue = null, options = {}) {
    return new PropertyDefinition({
      type: PropertyTypes.JSON,
      displayName,
      defaultValue,
      ...options
    });
  }
};

