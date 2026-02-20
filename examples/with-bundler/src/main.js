// examples/with-bundler/src/main.js
// Contoh penggunaan dengan Vite / webpack / Rollup / Parcel

import GithubCRUD from 'github-crud';
import 'github-crud/style';

// ── Konfigurasi ──────────────────────────────────────────────────────────────
// Simpan nilai sensitif di .env (jangan commit ke repo!)
// Vite  → import.meta.env.VITE_xxx
// CRA   → process.env.REACT_APP_xxx
// Parcel → process.env.xxx

const gc = new GithubCRUD({
  clientId:  import.meta.env?.VITE_GH_CLIENT_ID  || 'GANTI_CLIENT_ID',
  workerUrl: import.meta.env?.VITE_WORKER_URL     || 'https://worker.kamu.workers.dev',
  repoOwner: import.meta.env?.VITE_REPO_OWNER     || 'username',
  repoName:  import.meta.env?.VITE_REPO_NAME      || 'repo-data',
  roles: ['admin', 'editor', 'viewer'],
});

// ── Collection definitions ────────────────────────────────────────────────────
export const COLLECTIONS = {
  produk: {
    id: 'produk', label: 'Produk', file: 'data/produk.json', icon: '📦',
    roles: { admin: 'all', editor: 'write', viewer: 'read' },
    schema: [
      { key: 'id',       label: 'ID',         type: 'number',  auto: true, readonly: true },
      { key: 'nama',     label: 'Nama',        type: 'text',    required: true },
      { key: 'harga',    label: 'Harga',       type: 'number',  required: true, min: 0 },
      { key: 'stok',     label: 'Stok',        type: 'number',  min: 0, default: 0 },
      { key: 'aktif',    label: 'Aktif',       type: 'boolean', default: true },
    ],
  },
  users: {
    id: 'users', label: 'Users', file: 'data/users.json', icon: '👤',
    roles: { admin: 'all', editor: 'none', viewer: 'none' },
    schema: [
      { key: 'id',     label: 'ID',     type: 'number', auto: true, readonly: true },
      { key: 'nama',   label: 'Nama',   type: 'text',   required: true },
      { key: 'github', label: 'GitHub', type: 'text',   required: true },
      { key: 'role',   label: 'Role',   type: 'select',
        options: ['admin', 'editor', 'viewer'], required: true },
    ],
  },
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

  // Render nav + tabs
  document.getElementById('app').innerHTML = `
    <nav class="nav">
      <span class="nav-brand">My App</span>
      <button class="nav-tab active" data-tab="produk">📦 Produk</button>
      <button class="nav-tab"        data-tab="users">👤 Users</button>
      <div class="nav-user">
        <img src="${gc.user.avatar_url}" alt="" style="width:26px;height:26px;border-radius:50%"/>
        @${gc.user.login} · ${gc.role}
        <button onclick="gc.logout()">Keluar</button>
      </div>
    </nav>
    <div id="pane-produk" class="pane active"></div>
    <div id="pane-users"  class="pane"></div>`;

  // Mount tables
  gc.mountTable(COLLECTIONS.produk, '#pane-produk');
  gc.mountTable(COLLECTIONS.users,  '#pane-users');

  // Tab switching
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab,.pane').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`pane-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

boot();

// ── Example: using the DB API directly ───────────────────────────────────────
// (uncomment to try in console after boot)
//
// window.gcExample = async () => {
//   // Get all
//   const { data } = await gc.getAll(COLLECTIONS.produk);
//   console.log('All produk:', data);
//
//   // Query
//   const { data: aktif } = await gc.query(COLLECTIONS.produk, {
//     filter: { aktif: true },
//     sort: 'harga', order: 'asc',
//   });
//   console.log('Produk aktif (sorted by harga):', aktif);
//
//   // Insert
//   const { record } = await gc.insert(COLLECTIONS.produk, {
//     nama: 'Produk Baru', harga: 99000, stok: 10, aktif: true,
//   });
//   console.log('Inserted:', record);
//
//   // Update
//   await gc.update(COLLECTIONS.produk, record.id, { stok: 5 });
//
//   // Remove
//   await gc.remove(COLLECTIONS.produk, record.id);
// };
