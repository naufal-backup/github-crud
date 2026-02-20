# ⬡ github-crud

**Ubah GitHub repo menjadi database JSON dengan UI CRUD lengkap — tanpa server.**

Auth via GitHub OAuth · Data tersimpan di repo JSON · Role-based access · Gratis selamanya.

[![npm](https://img.shields.io/npm/v/github-crud)](https://www.npmjs.com/package/github-crud)
[![license](https://img.shields.io/npm/l/github-crud)](LICENSE)

---

## Cara Kerja

```
User klik Tambah/Edit/Hapus
  → github-crud commit perubahan ke repo GitHub kamu
  → data tersimpan sebagai file JSON
  → riwayat perubahan tercatat di GitHub history
```

Tidak ada server. Tidak ada database. Hanya file JSON + GitHub API.

---

## Prasyarat

Kamu butuh **3 hal** — semuanya **gratis**:

| Yang dibutuhkan | Untuk apa | Cara dapat |
|---|---|---|
| GitHub repo | Menyimpan data JSON | Buat repo baru di github.com |
| GitHub OAuth App | Login user via GitHub | [Tahap 1](#tahap-1--buat-github-oauth-app) |
| Cloudflare Workers | Menyimpan client_secret dengan aman | [Tahap 2](#tahap-2--deploy-cloudflare-workers) |

---

## Tahap 1 — Buat GitHub OAuth App

1. Buka: **github.com → Settings → Developer settings → OAuth Apps → New OAuth App**

2. Isi form:

   | Field | Nilai |
   |---|---|
   | Application name | Nama app kamu |
   | Homepage URL | `https://USERNAME.github.io/REPO` |
   | Authorization callback URL | `https://USERNAME.github.io/REPO/callback.html` |

3. Klik **Register application**, lalu catat:
   - **Client ID** → dipakai di kode frontend
   - **Client Secret** → hanya untuk Cloudflare Workers (klik "Generate a new client secret")

> ⚠️ **Client Secret jangan di-commit ke repo publik.**

---

## Tahap 2 — Deploy Cloudflare Workers

Worker bertugas sebagai auth proxy: menerima OAuth code dari browser, menukarnya ke access_token menggunakan client_secret yang tersimpan aman di server.

```bash
# Install wrangler & login
npm install -g wrangler
wrangler login

# Deploy worker
npx wrangler deploy worker/index.js --name github-crud-auth

# Masukkan secrets (terminal akan meminta input satu per satu)
npx wrangler secret put GH_CLIENT_ID       # ← Client ID dari OAuth App
npx wrangler secret put GH_CLIENT_SECRET   # ← Client Secret dari OAuth App
npx wrangler secret put ALLOWED_ORIGIN     # ← https://USERNAME.github.io
```

Setelah deploy, kamu dapat URL seperti:
```
https://github-crud-auth.namakamu.workers.dev
```

---

## Tahap 3 — Integrasi ke Project

### 🅰 Tanpa Bundler (HTML + CDN)

Cocok untuk: GitHub Pages statis, prototyping cepat.

Lihat contoh lengkap: **[examples/no-bundler/](examples/no-bundler/)**

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <link rel="stylesheet" href="https://unpkg.com/github-crud@1/dist/github-crud.css"/>
</head>
<body>
  <div id="app"></div>

  <script type="module">
    import GithubCRUD from 'https://unpkg.com/github-crud@1/dist/github-crud.es.js';

    const gc = new GithubCRUD({
      clientId:  'CLIENT_ID_KAMU',
      workerUrl: 'https://github-crud-auth.namakamu.workers.dev',
      repoOwner: 'username-kamu',
      repoName:  'nama-repo-data',
      roles:     ['admin', 'editor'],
    });

    const PRODUK = {
      id: 'produk', label: 'Produk', file: 'data/produk.json',
      roles: { admin: 'all', editor: 'write' },
      schema: [
        { key: 'id',    label: 'ID',    type: 'number', auto: true, readonly: true },
        { key: 'nama',  label: 'Nama',  type: 'text',   required: true },
        { key: 'harga', label: 'Harga', type: 'number', min: 0 },
      ],
    };

    const session = await gc.init();
    if (!session) {
      gc.renderLoginCard('#app');
    } else {
      gc.mountTable(PRODUK, '#app');
    }
  </script>
</body>
</html>
```

Kamu juga butuh file `callback.html` — lihat [examples/no-bundler/callback.html](examples/no-bundler/callback.html).

---

### 🅱 Dengan Bundler (Vite / webpack)

Cocok untuk: React, Vue, Svelte, atau project JavaScript modern.

```bash
npm install github-crud
```

```js
// src/main.js
import GithubCRUD from 'github-crud';
import 'github-crud/style';

const gc = new GithubCRUD({
  clientId:  import.meta.env.VITE_GH_CLIENT_ID,
  workerUrl: import.meta.env.VITE_WORKER_URL,
  repoOwner: import.meta.env.VITE_REPO_OWNER,
  repoName:  import.meta.env.VITE_REPO_NAME,
  roles:     ['admin', 'editor'],
});
```

```env
# .env  (jangan di-commit!)
VITE_GH_CLIENT_ID=Ov23li...
VITE_WORKER_URL=https://github-crud-auth.namakamu.workers.dev
VITE_REPO_OWNER=username-kamu
VITE_REPO_NAME=nama-repo-data
```

Lihat contoh lengkap: **[examples/with-bundler/](examples/with-bundler/)**

---

## Schema — Semua Tipe Field

```js
schema: [
  // Auto-increment ID
  { key: 'id', label: 'ID', type: 'number', auto: true, readonly: true },

  // Teks
  { key: 'nama',      label: 'Nama',        type: 'text',     required: true, maxLength: 120 },
  { key: 'deskripsi', label: 'Deskripsi',   type: 'textarea', rows: 4 },

  // Angka
  { key: 'harga', label: 'Harga', type: 'number', min: 0, max: 999999999 },

  // Format khusus
  { key: 'email',   label: 'Email',   type: 'email' },
  { key: 'website', label: 'Website', type: 'url' },
  { key: 'tgl',     label: 'Tanggal', type: 'date' },

  // Toggle on/off
  { key: 'aktif', label: 'Aktif', type: 'boolean', default: true,
    trueLabel: 'Aktif', falseLabel: 'Nonaktif' },

  // Dropdown
  { key: 'kategori', label: 'Kategori', type: 'select',
    options: ['Elektronik', 'Pakaian', 'Makanan'] },

  // Dropdown dengan value berbeda dari label
  { key: 'status', label: 'Status', type: 'select',
    options: [
      { value: 'active',   label: 'Aktif' },
      { value: 'inactive', label: 'Nonaktif' },
    ], default: 'active' },
]
```

---

## Roles & Permissions

```js
// Di definisi collection:
roles: {
  admin:  'all',    // Lihat ✓  Tambah ✓  Edit ✓  Hapus ✓
  editor: 'write',  // Lihat ✓  Tambah ✓  Edit ✓  Hapus ✗
  viewer: 'read',   // Lihat ✓  Tambah ✗  Edit ✗  Hapus ✗
  banned: 'none',   // Tidak bisa akses sama sekali
}
```

Tombol di UI otomatis muncul/hilang sesuai role yang sedang login.

**Cara tentukan role per user:** Buat collection `users` dengan field `github` dan `role`:

```js
const USERS = {
  id: 'users', label: 'Users', file: 'data/users.json',
  roles: { admin: 'all' },
  schema: [
    { key: 'id',     label: 'ID',     type: 'number', auto: true, readonly: true },
    { key: 'github', label: 'GitHub', type: 'text',   required: true },
    { key: 'role',   label: 'Role',   type: 'select',
      options: ['admin', 'editor', 'viewer'] },
  ],
};
```

---

## API Reference

### Inisialisasi

```js
const gc = new GithubCRUD({
  clientId:    string,    // GitHub OAuth App Client ID (wajib)
  workerUrl:   string,    // Cloudflare Workers URL (wajib)
  repoOwner:   string,    // GitHub username/org (wajib)
  repoName:    string,    // Nama repo penyimpan JSON (wajib)
  roles:       string[],  // Daftar role dari paling ke paling kurang privileged (wajib)
  collections: object[],  // Definisi collections (opsional)
  redirectUri: string,    // OAuth callback URL (opsional, auto-detect)
  scope:       string,    // OAuth scope (default: 'repo')
});
```

### Auth

```js
const session = await gc.init();  // → { user, role, token } atau null
gc.login();                        // Redirect ke GitHub login
gc.logout();                       // Hapus sesi + reload

gc.user        // Profil user GitHub
gc.role        // Role user saat ini
gc.isLoggedIn  // true | false
```

### Database

```js
// Baca semua
const { data, sha } = await gc.getAll(collection);

// Query dengan filter & sort
const { data, total } = await gc.query(collection, {
  filter: { status: 'active' },
  sort: 'nama', order: 'asc',
  limit: 10, offset: 0,
});

// CRUD
await gc.insert(collection, { nama: 'Baru', harga: 50000 });
await gc.update(collection, id, { harga: 75000 });
await gc.remove(collection, id);
```

### UI

```js
// Mount tabel CRUD ke elemen DOM
gc.mountTable(collection, '#container');

// Render login card
gc.renderLoginCard('#container', {
  title: 'Nama App',
  description: 'Deskripsi custom.',
  errorMessage: 'Pesan error jika ada.',
});

// Toast notification
gc.toast('Berhasil!', 'success');  // 'success' | 'error' | 'warn' | 'info'
```

### Events

```js
document.addEventListener('gc:status', (e) => {
  const { state, label } = e.detail;
  // state: 'loading' | 'saving' | 'ready' | 'error'
});
```

---

## Deploy ke GitHub Pages

### Tanpa bundler (langsung dari repo)

```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

Buka repo → **Settings → Pages → Source: main / (root) → Save**

### Dengan Vite + GitHub Actions

Buat `vite.config.js`:
```js
import { defineConfig } from 'vite'
export default defineConfig({
  base: '/NAMA-REPO/',
})
```

Buat `.github/workflows/deploy.yml` — lihat [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

---

## Struktur Data

Setiap collection = satu file JSON berisi array of objects:

```json
[
  { "id": 1, "nama": "Laptop Pro", "harga": 15000000, "aktif": true },
  { "id": 2, "nama": "Mouse",      "harga": 250000,   "aktif": true }
]
```

File tidak perlu dibuat manual — otomatis terbuat saat data pertama ditambahkan.

---

## FAQ

**Q: Apakah data aman?**  
Data tersimpan di repo GitHub kamu sendiri. Hanya collaborator yang kamu undang yang bisa login. Setiap perubahan tercatat di commit history.

**Q: Berapa biayanya?**  
Gratis. GitHub Pages gratis. Cloudflare Workers free tier: 100.000 request/hari.

**Q: Kalau 2 orang edit bersamaan?**  
Yang kedua akan gagal karena SHA berubah. Klik Refresh dan coba lagi — ini trade-off arsitektur tanpa server.

**Q: Bisa untuk repo private?**  
Ya, OAuth scope `repo` sudah mencakup repo private.

**Q: Bisa custom tampilan?**  
Ya. Semua CSS class diawali `gc-` dan bisa di-override.

---

## Undang Collaborator

Hanya collaborator repo yang bisa login:

1. Buka repo → **Settings → Collaborators → Add people**
2. Masukkan username GitHub mereka
3. Mereka terima email undangan → harus diterima dulu

---

## Contributing

```bash
git checkout -b fitur/nama-fitur
git commit -m "feat: deskripsi"
git push origin fitur/nama-fitur
# Buat Pull Request
```

## License

MIT © github-crud contributors
