// examples/with-bundler/src/main.js
// Contoh penggunaan dengan Vite

import GithubCRUD from 'github-crud';
import 'github-crud/style';

// ── Konfigurasi ──────────────────────────────────────────────────────────────
// Nilai diambil dari .env — jangan di-commit ke repo!
const gc = new GithubCRUD({
  clientId:  import.meta.env.VITE_GH_CLIENT_ID,
  workerUrl: import.meta.env.VITE_WORKER_URL,
  repoOwner: import.meta.env.VITE_REPO_OWNER,
  repoName:  import.meta.env.VITE_REPO_NAME,
  roles:     ['admin', 'editor', 'viewer'],
});

// ── Definisi Collections ─────────────────────────────────────────────────────
const PRODUK = {
  id: 'produk', label: 'Produk', file: 'data/produk.json',
  roles: { admin: 'all', editor: 'write', viewer: 'read' },
  schema: [
    { key: 'id',    label: 'ID',    type: 'number', auto: true, readonly: true },
    { key: 'nama',  label: 'Nama',  type: 'text',   required: true },
    { key: 'harga', label: 'Harga', type: 'number', min: 0, required: true },
    { key: 'stok',  label: 'Stok',  type: 'number', min: 0, default: 0 },
    { key: 'aktif', label: 'Aktif', type: 'boolean', default: true },
  ],
};

const USERS = {
  id: 'users', label: 'Users', file: 'data/users.json',
  roles: { admin: 'all', editor: 'none', viewer: 'none' },
  schema: [
    { key: 'id',     label: 'ID',     type: 'number', auto: true, readonly: true },
    { key: 'nama',   label: 'Nama',   type: 'text',   required: true },
    { key: 'github', label: 'GitHub', type: 'text',   required: true },
    { key: 'role',   label: 'Role',   type: 'select',
      options: ['admin', 'editor', 'viewer'], required: true },
  ],
};

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  let session;
  try {
    session = await gc.init();
  } catch (e) {
    gc.renderLoginCard('#app', { errorMessage: e.message });
    return;
  }

  if (!session) {
    gc.renderLoginCard('#app');
    return;
  }

  // Render shell aplikasi
  document.getElementById('app').innerHTML = `
    <nav style="background:#0f0f0f;padding:.7rem 1.5rem;display:flex;align-items:center;gap:.5rem;border-bottom:2px solid #000">
      <span style="font-style:italic;color:#c8401a;font-size:1rem;margin-right:.5rem">My App</span>
      <button class="nav-tab active" data-tab="produk">📦 Produk</button>
      <button class="nav-tab"        data-tab="users">👤 Users</button>
      <div style="margin-left:auto;display:flex;align-items:center;gap:.55rem;color:#777;font-size:.75rem">
        <img src="${gc.user.avatar_url}" style="width:26px;height:26px;border-radius:50%"/>
        @${gc.user.login} · ${gc.role}
        <button onclick="gc.logout()" style="background:none;border:none;color:#555;cursor:pointer;font-size:.75rem">Keluar</button>
      </div>
    </nav>
    <div id="pane-produk" style="padding:1.5rem"></div>
    <div id="pane-users"  style="padding:1.5rem;display:none"></div>`;

  gc.mountTable(PRODUK, '#pane-produk');
  gc.mountTable(USERS,  '#pane-users');

  // Tab switching
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[id^="pane-"]').forEach(p => p.style.display = 'none');
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      document.getElementById(`pane-${btn.dataset.tab}`).style.display = 'block';
      btn.classList.add('active');
    });
  });
}

boot();
