// src/ui/form.js — Auto-generates forms from schema + validates input

const INPUT_TYPE = {
  text: 'text', email: 'email', url: 'url', number: 'number',
  date: 'date', datetime: 'datetime-local', color: 'color', password: 'password',
};

export class FormBuilder {
  static build(schema, values = {}) {
    return schema.map(f => FormBuilder._field(f, values)).join('');
  }

  static _field(f, values) {
    if (f.auto && values[f.key] === undefined) return '';
    const val      = values[f.key] ?? f.default ?? '';
    const readonly = f.readonly || (f.auto && values[f.key] !== undefined);
    const req      = f.required && !readonly ? '<span class="gc-req">*</span>' : '';
    const hint     = f.hint ? `<div class="gc-field-hint">${esc(f.hint)}</div>` : '';
    let ctrl;
    if (f.type === 'boolean') {
      const checked = (val === true || val === 'true') ? 'checked' : '';
      ctrl = `<div class="gc-toggle-wrap">
        <label class="gc-toggle">
          <input type="checkbox" name="${f.key}" ${checked} ${readonly ? 'disabled' : ''}>
          <span class="gc-toggle-track"></span>
        </label>
        <span class="gc-toggle-label" data-gc-toggle-label="${f.key}">
          ${(val === true || val === 'true') ? (f.trueLabel || 'Ya') : (f.falseLabel || 'Tidak')}
        </span>
      </div>`;
    } else if (f.type === 'select') {
      const opts = (f.options || []).map(o => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? o.label : o;
        return `<option value="${esc(v)}" ${v == val ? 'selected' : ''}>${esc(l)}</option>`;
      }).join('');
      ctrl = `<select name="${f.key}" class="gc-control gc-select" ${readonly ? 'disabled' : ''}>
        <option value="">— Pilih —</option>${opts}
      </select>`;
    } else if (f.type === 'textarea') {
      ctrl = `<textarea name="${f.key}" class="gc-control" rows="${f.rows || 3}"
        placeholder="${esc(f.placeholder || '')}"
        ${readonly ? 'readonly' : ''}
        ${f.required && !readonly ? 'required' : ''}
      >${esc(String(val))}</textarea>`;
    } else {
      const t = INPUT_TYPE[f.type] || 'text';
      ctrl = `<input type="${t}" name="${f.key}" class="gc-control"
        value="${esc(String(val))}"
        placeholder="${esc(f.placeholder || '')}"
        ${readonly ? 'readonly' : ''}
        ${f.required && !readonly ? 'required' : ''}
        ${f.min       !== undefined ? `min="${f.min}"`           : ''}
        ${f.max       !== undefined ? `max="${f.max}"`           : ''}
        ${f.step      !== undefined ? `step="${f.step}"`         : ''}
        ${f.minLength             ? `minlength="${f.minLength}"` : ''}
        ${f.maxLength             ? `maxlength="${f.maxLength}"` : ''}
        ${f.pattern               ? `pattern="${f.pattern}"`     : ''}
      />`;
    }
    return `<div class="gc-field" data-key="${f.key}">
      <label class="gc-label">${esc(f.label)} ${req}</label>
      ${ctrl}${hint}
    </div>`;
  }

  static collect(schema, container) {
    const out = {};
    for (const f of schema) {
      const el = container.querySelector(`[name="${f.key}"]`);
      if (!el) continue;
      if (f.type === 'boolean')     out[f.key] = el.checked;
      else if (f.type === 'number') out[f.key] = el.value === '' ? null : Number(el.value);
      else                          out[f.key] = el.value;
    }
    return out;
  }

  static validate(schema, data) {
    for (const f of schema) {
      if (f.auto || f.readonly) continue;
      const v     = data[f.key];
      const empty = v === null || v === undefined || v === '';
      if (f.required && empty) return `"${f.label}" wajib diisi.`;
      if (empty) continue;
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        return `"${f.label}" harus berformat email yang valid.`;
      if (f.type === 'url' && !/^https?:\/\/.+/.test(v))
        return `"${f.label}" harus diawali https://.`;
      if (f.type === 'number') {
        if (f.min !== undefined && v < f.min) return `"${f.label}" minimal ${f.min}.`;
        if (f.max !== undefined && v > f.max) return `"${f.label}" maksimal ${f.max}.`;
      }
      if (f.minLength && String(v).length < f.minLength)
        return `"${f.label}" minimal ${f.minLength} karakter.`;
      if (f.maxLength && String(v).length > f.maxLength)
        return `"${f.label}" maksimal ${f.maxLength} karakter.`;
      if (f.pattern && !new RegExp(f.pattern).test(v))
        return `"${f.label}" format tidak valid.`;
    }
    return null;
  }

  static bindToggles(container) {
    container.querySelectorAll('.gc-toggle input[type=checkbox]').forEach(cb => {
      const label  = container.querySelector(`[data-gc-toggle-label="${cb.name}"]`);
      if (!label) return;
      const schema = container._gcSchema?.find(f => f.key === cb.name);
      cb.addEventListener('change', () => {
        label.textContent = cb.checked ? (schema?.trueLabel || 'Ya') : (schema?.falseLabel || 'Tidak');
      });
    });
  }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
