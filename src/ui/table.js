// src/ui/table.js — Sortable, searchable, paginated CRUD table

import { FormBuilder } from './form.js';

const PER_PAGE = 25;

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export class TableRenderer {
  constructor({ collection, db, permissions, user, onStatus, onToast }) {
    this.col = collection; this.db = db; this.perm = permissions; this.user = user;
    this.onStatus = onStatus || (() => {}); this.onToast = onToast || (() => {});
    this._data = []; this._sha = null; this._sort = null; this._dir = 'asc';
    this._q = ''; this._page = 1; this._root = null; this._modal = null;
  }

  mount(container, modal) {
    this._root  = typeof container === 'string' ? document.querySelector(container) : container;
    this._modal = typeof modal === 'string' ? document.querySelector(modal) : modal;
    if (!this._root) throw new Error(`[github-crud] Container "${container}" tidak ditemukan.`);
    this.refresh(); return this;
  }

  async refresh() {
    this.onStatus('loading');
    try {
      const { data, sha } = await this.db.getAll(this.col);
      this._data = data; this._sha = sha; this._draw();
      this.onStatus('ready', data.length);
    } catch (e) { this.onStatus('error', e.message); this.onToast(e.message, 'error'); }
  }

  _draw() {
    const { col, perm } = this;
    const schema = col.schema || [], visible = schema.filter(f => !f.hidden);
    const canR = perm.canRead(col), canW = perm.canWrite(col), canD = perm.canDelete(col);
    let rows = [...this._data];
    if (this._q) { const q = this._q.toLowerCase(); rows = rows.filter(r => visible.some(f => String(r[f.key] ?? '').toLowerCase().includes(q))); }
    if (this._sort) { rows.sort((a, b) => { const c = String(a[this._sort] ?? '').localeCompare(String(b[this._sort] ?? ''), undefined, { numeric: true }); return this._dir === 'desc' ? -c : c; }); }
    const total = rows.length, pages = Math.max(1, Math.ceil(total / PER_PAGE));
    this._page = Math.min(this._page, pages);
    const sliced = rows.slice((this._page - 1) * PER_PAGE, this._page * PER_PAGE);
    this._root.innerHTML = `<div class="gc-wrap">${this._drawToolbar(total, canW)}${!canR ? `<div class="gc-empty"><span>🔒</span><p>Kamu tidak punya akses ke tabel ini.</p></div>` : sliced.length === 0 ? this._drawEmpty(canW) : `<div class="gc-scroll"><table class="gc-table">${this._drawHead(visible, canW || canD)}${this._drawBody(sliced, visible, canW, canD)}</table></div>${pages > 1 ? this._drawPager(total, pages) : ''}`}</div>`;
    this._bind();
  }

  _drawToolbar(total, canW) {
    return `<div class="gc-toolbar"><input class="gc-search" placeholder="Cari…" value="${esc(this._q)}" data-gc="search"/><div class="gc-toolbar-r"><span class="gc-count">${total} baris</span><button class="gc-btn gc-ghost gc-sm" data-gc="refresh">↻ Refresh</button>${canW ? `<button class="gc-btn gc-primary gc-sm" data-gc="add">+ Tambah</button>` : ''}</div></div>`;
  }

  _drawEmpty(canW) {
    return `<div class="gc-empty"><span>📭</span><p>${this._q ? 'Tidak ada hasil.' : 'Belum ada data di tabel ini.'}</p>${canW && !this._q ? `<button class="gc-btn gc-primary" data-gc="add" style="margin-top:.75rem">+ Tambah data pertama</button>` : ''}</div>`;
  }

  _drawHead(visible, hasActions) {
    const ths = visible.map(f => `<th class="gc-th ${this._sort === f.key ? `gc-sort-${this._dir}` : ''}" data-gc="sort" data-key="${f.key}">${esc(f.label)}</th>`).join('');
    return `<thead><tr>${ths}${hasActions ? '<th class="gc-th gc-th-act">Aksi</th>' : ''}</tr></thead>`;
  }

  _drawBody(rows, visible, canW, canD) {
    const idKey = this.col.schema?.find(f => f.auto)?.key || 'id';
    return `<tbody>${rows.map(row => {
      const id = row[idKey];
      const cells = visible.map(f => `<td class="gc-td" title="${esc(String(row[f.key] ?? ''))}">${this._cell(f, row[f.key])}</td>`).join('');
      const act = (canW || canD) ? `<td class="gc-td gc-td-act">${canW ? `<button class="gc-btn gc-outline gc-sm" data-gc="edit" data-id="${id}">✏ Edit</button>` : ''}${canD ? `<button class="gc-btn gc-danger gc-sm" data-gc="del" data-id="${id}">✕</button>` : ''}</td>` : '';
      return `<tr class="gc-tr">${cells}${act}</tr>`;
    }).join('')}</tbody>`;
  }

  _cell(f, val) {
    if (val === null || val === undefined) return `<span class="gc-null">–</span>`;
    if (f.type === 'boolean') return val ? `<span class="gc-badge gc-badge-ok">✓ Ya</span>` : `<span class="gc-badge gc-badge-off">✗ Tidak</span>`;
    if (f.type === 'select') return `<span class="gc-badge">${esc(String(val))}</span>`;
    if (f.type === 'url') return `<a class="gc-link" href="${esc(String(val))}" target="_blank" rel="noopener">${esc(String(val))}</a>`;
    if (f.type === 'date' || f.type === 'datetime') { try { return new Date(val).toLocaleString('id-ID', { dateStyle:'medium', ...(f.type==='datetime'?{timeStyle:'short'}:{}) }); } catch { return esc(String(val)); } }
    const s = String(val); return esc(s.length > 64 ? s.slice(0, 61) + '…' : s);
  }

  _drawPager(total, pages) {
    const p = this._page, lo = (p-1)*PER_PAGE+1, hi = Math.min(p*PER_PAGE, total);
    let btns = '';
    for (let i = 1; i <= pages; i++) {
      if (i===1||i===pages||Math.abs(i-p)<=1) btns += `<button class="gc-pg ${i===p?'gc-pg-on':''}" data-gc="page" data-p="${i}">${i}</button>`;
      else if (Math.abs(i-p)===2) btns += `<span class="gc-pg-dot">…</span>`;
    }
    return `<div class="gc-pager"><button class="gc-pg" data-gc="page" data-p="${p-1}" ${p<=1?'disabled':''}>‹</button>${btns}<button class="gc-pg" data-gc="page" data-p="${p+1}" ${p>=pages?'disabled':''}>›</button><span class="gc-pager-info">${lo}–${hi} dari ${total}</span></div>`;
  }

  _bind() {
    const on = (sel, ev, fn) => this._root.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn));
    let t;
    this._root.querySelector('[data-gc="search"]')?.addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { this._q = e.target.value; this._page = 1; this._draw(); }, 220); });
    on('[data-gc="refresh"]', 'click', () => this.refresh());
    on('[data-gc="add"]',     'click', () => this._openForm(null));
    on('[data-gc="sort"]', 'click', e => { const key = e.currentTarget.dataset.key; this._dir = this._sort === key && this._dir === 'asc' ? 'desc' : 'asc'; this._sort = key; this._draw(); });
    on('[data-gc="edit"]', 'click', e => { const idKey = this.col.schema?.find(f => f.auto)?.key || 'id'; const rec = this._data.find(r => String(r[idKey]) === e.currentTarget.dataset.id); if (rec) this._openForm(rec); });
    on('[data-gc="del"]',  'click', e => this._confirmDel(e.currentTarget.dataset.id));
    on('[data-gc="page"]', 'click', e => { const p = Number(e.currentTarget.dataset.p), pages = Math.ceil(this._data.length / PER_PAGE); if (p >= 1 && p <= pages) { this._page = p; this._draw(); } });
  }

  _ensureModal() {
    if (!this._modal) { this._modal = document.createElement('div'); this._modal.className = 'gc-modal'; document.body.appendChild(this._modal); }
    return this._modal;
  }

  _openForm(record) {
    const modal = this._ensureModal(), isEdit = record !== null, schema = this.col.schema || [];
    modal.innerHTML = `<div class="gc-modal-box"><div class="gc-modal-head"><span class="gc-modal-title">${isEdit ? `✏ Edit — ${esc(this.col.label)}` : `+ Tambah — ${esc(this.col.label)}`}</span><button class="gc-modal-x" data-gc="close">✕</button></div><div class="gc-modal-body">${FormBuilder.build(schema, record || {})}</div><div class="gc-modal-foot"><button class="gc-btn gc-ghost gc-sm" data-gc="close">Batal</button><button class="gc-btn gc-primary gc-sm" data-gc="submit">Simpan</button></div></div>`;
    modal.classList.add('gc-open');
    FormBuilder.bindToggles(modal);
    modal.querySelectorAll('[data-gc="close"]').forEach(b => b.addEventListener('click', () => this._closeModal()));
    modal.querySelector('[data-gc="submit"]')?.addEventListener('click', () => this._submit(schema, record));
  }

  _closeModal() { this._modal?.classList.remove('gc-open'); }

  async _submit(schema, existing) {
    const body = this._modal.querySelector('.gc-modal-body');
    const raw = FormBuilder.collect(schema, body), err = FormBuilder.validate(schema, raw);
    if (err) { this.onToast(err, 'warn'); return; }
    this._closeModal(); this.onStatus('saving');
    try {
      const idKey = schema.find(f => f.auto)?.key || 'id';
      if (existing) { await this.db.update(this.col, existing[idKey], raw, this.user.login); this.onToast('Data berhasil diperbarui.', 'success'); }
      else           { await this.db.insert(this.col, raw, this.user.login); this.onToast('Data berhasil ditambahkan.', 'success'); }
      await this.refresh();
    } catch (e) { this.onStatus('error', e.message); this.onToast(e.message, 'error'); }
  }

  async _confirmDel(id) {
    const idKey = this.col.schema?.find(f => f.auto)?.key || 'id';
    const record = this._data.find(r => String(r[idKey]) === id);
    const label = record ? Object.values(record).slice(1, 3).join(' · ') : `id=${id}`;
    const yes = await this._confirm('Hapus data ini?', `${label}\n\nTindakan ini tidak dapat dibatalkan.`);
    if (!yes) return;
    this.onStatus('saving');
    try { await this.db.remove(this.col, id, this.user.login); this.onToast('Data berhasil dihapus.', 'success'); await this.refresh(); }
    catch (e) { this.onStatus('error', e.message); this.onToast(e.message, 'error'); }
  }

  _confirm(title, msg) {
    return new Promise(resolve => {
      const modal = this._ensureModal();
      modal.innerHTML = `<div class="gc-modal-box gc-modal-sm"><div class="gc-modal-head"><span class="gc-modal-title">${esc(title)}</span></div><div class="gc-modal-body"><p class="gc-confirm-msg">${esc(msg)}</p></div><div class="gc-modal-foot"><button class="gc-btn gc-ghost gc-sm" data-ans="false">Batal</button><button class="gc-btn gc-danger gc-sm" data-ans="true">Ya, Hapus</button></div></div>`;
      modal.classList.add('gc-open');
      modal.querySelectorAll('[data-ans]').forEach(b => b.addEventListener('click', () => { this._closeModal(); resolve(b.dataset.ans === 'true'); }));
    });
  }
}
