// src/index.js — github-crud public API

import { GithubAuth }     from './core/auth.js';
import { GithubDatabase } from './core/database.js';
import { Permissions }    from './core/permissions.js';
import { FormBuilder }    from './ui/form.js';
import { TableRenderer }  from './ui/table.js';

// ── Toast helper ──────────────────────────────────────────────────────────────
function makeToaster() {
  let wrap = document.querySelector('.gc-toasts');
  if (!wrap) {
    wrap = Object.assign(document.createElement('div'), { className: 'gc-toasts' });
    document.body.appendChild(wrap);
  }
  return function toast(msg, type = 'info', ms = 3500) {
    const icons = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' };
    const el = Object.assign(document.createElement('div'), {
      className: `gc-toast gc-toast-${type}`,
      innerHTML: `<span>${icons[type] || ''}</span><span>${msg}</span>`,
    });
    wrap.appendChild(el);
    setTimeout(() => el.remove(), ms);
  };
}

// ── Main class ────────────────────────────────────────────────────────────────
export class GithubCRUD {
  /**
   * @param {object} config
   * @param {string}   config.clientId      GitHub OAuth App client ID
   * @param {string}   config.workerUrl     Cloudflare Workers auth proxy URL
   * @param {string}   config.repoOwner     GitHub username/org pemilik repo data
   * @param {string}   config.repoName      Nama repo penyimpan JSON
   * @param {string[]} config.roles         Daftar role: index 0 = paling privileged
   * @param {object[]} [config.collections] Definisi collections (opsional)
   * @param {string}   [config.redirectUri] OAuth callback URL (auto-detect jika kosong)
   * @param {string}   [config.scope]       OAuth scope (default: 'repo')
   */
  constructor(config) {
    this._cfg    = config;
    this._auth   = new GithubAuth(config);
    this._db     = null;
    this._perm   = null;
    this._user   = null;
    this._role   = null;
    this._toast  = null;
    this._tables = new Map();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  /** Redirect user ke halaman login GitHub */
  login()  { this._auth.login(); }

  /** Hapus sesi dan reload halaman */
  logout() { this._auth.logout(); }

  /**
   * Panggil di setiap page load. Mengembalikan sesi atau null jika belum login.
   * @returns {Promise<{user, role, token} | null>}
   */
  async init() {
    const session = await this._auth.init();
    if (!session) return null;

    this._user  = session.user;
    this._role  = session.role;
    this._db    = new GithubDatabase(this._cfg, session.token);
    this._perm  = new Permissions(session.role);
    this._toast = makeToaster();
    return session;
  }

  get user()       { return this._user; }
  get role()       { return this._role; }
  get isLoggedIn() { return !!this._user; }

  // ── Database ──────────────────────────────────────────────────────────────

  get db() { return this._db; }

  async getAll(collection)             { return this._db.getAll(this._resolve(collection)); }
  async query(collection, opts)        { return this._db.query(this._resolve(collection), opts); }
  async insert(collection, record)     { this._checkPerm('write', collection);  return this._db.insert(this._resolve(collection), record, this._user.login); }
  async update(collection, id, patch)  { this._checkPerm('write', collection);  return this._db.update(this._resolve(collection), id, patch, this._user.login); }
  async remove(collection, id)         { this._checkPerm('delete', collection); return this._db.remove(this._resolve(collection), id, this._user.login); }

  // ── UI ────────────────────────────────────────────────────────────────────

  /**
   * Mount tabel CRUD lengkap ke elemen DOM.
   * @param {object}         collection  Definisi collection
   * @param {string|Element} container   Selector atau elemen target
   * @param {string|Element} [modal]     Elemen modal (dibuat otomatis jika kosong)
   * @returns {TableRenderer}
   */
  mountTable(collection, container, modal) {
    this._requireDb();
    const col = this._resolve(collection);

    const modalEl = modal
      ? (typeof modal === 'string' ? document.querySelector(modal) : modal)
      : (() => {
          const m = Object.assign(document.createElement('div'), { className: 'gc-modal' });
          document.body.appendChild(m);
          return m;
        })();

    const renderer = new TableRenderer({
      collection:  col,
      db:          this._db,
      permissions: this._perm,
      user:        this._user,
      onStatus:    (state, detail) => document.dispatchEvent(
        new CustomEvent('gc:status', { detail: { state, detail, label: col.label } })
      ),
      onToast: (msg, type) => this._toast(msg, type),
    });

    renderer.mount(container, modalEl);
    this._tables.set(col.id || col.file, renderer);
    return renderer;
  }

  /** Ambil instance TableRenderer yang sudah di-mount berdasarkan id/file collection */
  getTable(id) { return this._tables.get(id); }

  /**
   * Render login card ke elemen DOM.
   * @param {string|Element} container
   * @param {{ title?, description?, note?, errorMessage? }} [opts]
   */
  renderLoginCard(container, opts = {}) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    const { repoOwner, repoName } = this._cfg;
    el.innerHTML = `
      <div class="gc-login-card">
        ${opts.errorMessage ? `<div class="gc-login-err">⚠️ ${opts.errorMessage}</div>` : ''}
        <div class="gc-login-icon">⬡</div>
        <div class="gc-login-title">${opts.title || 'github<em>–</em>crud'}</div>
        <div class="gc-login-desc">${opts.description ||
          `Masuk dengan GitHub untuk melanjutkan.<br/>
           Hanya collaborator <strong>${repoOwner}/${repoName}</strong> yang dapat akses.`
        }</div>
        <button class="gc-login-btn">
          <svg height="18" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
              0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53
              .63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
              0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09
              2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65
              3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Masuk dengan GitHub
        </button>
        <div class="gc-login-note">${opts.note || 'Kamu perlu menerima undangan collaborator terlebih dahulu.'}</div>
      </div>`;
    el.querySelector('.gc-login-btn')?.addEventListener('click', () => this.login());
  }

  /** Tampilkan toast notification */
  toast(msg, type = 'info') { (this._toast || makeToaster())(msg, type); }

  // ── Internal helpers ──────────────────────────────────────────────────────

  _requireDb() {
    if (!this._db) throw new Error('[github-crud] Panggil await gc.init() terlebih dahulu.');
  }

  /** Resolve string id/file menjadi object collection */
  _resolve(c) {
    if (typeof c !== 'string') return c;
    return this._cfg.collections?.find(x => x.id === c || x.file === c)
      || { id: c, label: c, file: c, roles: {}, schema: [] };
  }

  _checkPerm(action, collection) {
    this._requireDb();
    const col = this._resolve(collection);
    const ok  = action === 'delete' ? this._perm.canDelete(col) : this._perm.canWrite(col);
    if (!ok) throw new Error(`Role "${this._role}" tidak punya izin "${action}" pada ${col.label}.`);
  }
}

// ── Named exports ─────────────────────────────────────────────────────────────
export { GithubAuth }     from './core/auth.js';
export { GithubDatabase } from './core/database.js';
export { Permissions }    from './core/permissions.js';
export { FormBuilder }    from './ui/form.js';
export { TableRenderer }  from './ui/table.js';
export default GithubCRUD;

// UMD global shim
if (typeof window !== 'undefined') window.GithubCRUD = GithubCRUD;
