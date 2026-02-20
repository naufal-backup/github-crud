# ⬡ github-crud

**Turn any GitHub repo into a zero-backend JSON database with a full CRUD UI.**  
Auth via GitHub OAuth · Storage di repo JSON · Role-based access · Gratis selamanya.

[![npm](https://img.shields.io/npm/v/github-crud)](https://www.npmjs.com/package/github-crud)
[![license](https://img.shields.io/npm/l/github-crud)](LICENSE)

---

## Cara Kerja

```
Setiap perubahan data (tambah/edit/hapus)
    → di-commit langsung ke repo GitHub kamu
    → tersimpan sebagai file JSON
    → riwayat perubahan bisa dilihat di GitHub history
```

Tidak ada server. Tidak ada database. Hanya JSON files + GitHub API.

---

## Prasyarat

Sebelum mulai, kamu butuh **3 hal** yang semuanya **gratis**:

| Yang dibutuhkan | Untuk apa | Cara dapat |
|---|---|---|
| GitHub repo | Menyimpan data JSON | Buat repo baru di github.com |
| GitHub OAuth App | Login user via GitHub | Ikuti [Tahap 1](#tahap-1--buat-github-oauth-app) |
| Cloudflare Workers | Auth proxy (menyimpan client_secret dengan aman) | Ikuti [Tahap 2](#tahap-2--deploy-cloudflare-workers) |

---

## Tahap 1 — Buat GitHub OAuth App

1. Buka: **github.com → Settings → Developer settings → OAuth Apps → New OAuth App**

2. Isi form:

   | Field | Nilai |
   |---|---|
   | Application name | Nama app kamu |
   | Homepage URL | `https://USERNAME.github.io/REPO` |
   | Authorization callback URL | `https://USERNAME.github.io/REPO/callback.html` |

3. Klik **Register application**

4. Di halaman berikutnya:
   - Catat **Client ID** → dipakai di kode frontend
   - Klik **Generate a new client secret** → catat, hanya untuk Cloudflare Workers

> ⚠️ Client Secret **jangan** ditaruh di kode frontend atau di-commit ke repo publik.

---

## Tahap 2 — Deploy Cloudflare Workers

Workers adalah auth proxy: menerima OAuth code dari browser, menukarnya ke access_token menggunakan client_secret, lalu mengembalikan token ke browser. Client_secret tidak pernah menyentuh browser.

### 2a. Daftar Cloudflare (gratis)
Buka [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)

### 2b. Install Wrangler & login
```bash
npm install -g wrangler
wrangler login
```

### 2c. Salin file worker dari repo ini
```bash
cp worker/index.js     ./my-worker.js
cp worker/wrangler.toml ./wrangler.toml
```

Atau gunakan langsung dari folder `worker/`:
```bash
cd worker/
```

### 2d. Deploy + masukkan secrets
```bash
# Jika dari root repo:
npx wrangler deploy worker/index.js --name github-crud-auth

# Masukkan secrets (satu per satu, terminal akan meminta input):
npx wrangler secret put GH_CLIENT_ID       # ← isi Client ID dari OAuth App
npx wrangler secret put GH_CLIENT_SECRET   # ← isi Client Secret dari OAuth App
npx wrangler secret put ALLOWED_ORIGIN     # ← isi: https://USERNAME.github.io
```

Setelah deploy, kamu dapat URL seperti:
```
https://github-crud-auth.namakamu.workers.dev
```
**Catat URL ini** — dipakai di langkah selanjutnya.

---

## Tahap 3 — Pilih Cara Integrasi

Pilih salah satu sesuai setup project kamu:

### 🅰 Tanpa Bundler (HTML + CDN)

→ Cocok untuk: GitHub Pages statis, landing page sederhana, prototyping cepat.

Ikuti: **[examples/no-bundler/](examples/no-bundler/)**

### 🅱 Dengan Bundler (Vite / webpack / Parcel)

→ Cocok untuk: React, Vue, Svelte, atau project JavaScript modern.

Ikuti: **[examples/with-bundler/](examples/with-bundler/)**

---

## Panduan: Tanpa Bundler

### File yang dibutuhkan

```
repo-kamu/
├── index.html        ← app utama
├── callback.html     ← OAuth redirect handler
└── data/
    └── items.json    ← data awal (boleh kosong [])
```

### `callback.html`

```html
<!DOCTYPE html>
<html>
<head><title>Masuk…</title></head>
<body>
<p id="msg">Sedang masuk…</p>

<script type="module">
  const WORKER_URL = 'https://github-crud-auth.namakamu.workers.dev'; // ← ganti

  const code  = new URLSearchParams(location.search).get('code');
  const error = new URLSearchParams(location.search).get('error');

  if (error || !code) {
    document.getElementById('msg').textContent = 'Login gagal: ' + (error || 'tidak ada kode');
  } else {
    const res  = await fetch(`${WORKER_URL}/exchange`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();

    if (data.access_token) {
      // Key format: gc:OWNER/REPO:token
      sessionStorage.setItem('gc:USERNAME/REPO:token', data.access_token); // ← ganti USERNAME/REPO
      location.href = './';
    } else {
      document.getElementById('msg').textContent = 'Gagal: ' + data.error;
    }
  }
</script>
</body>
</html>
```

### `index.html`

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>My App</title>

  <!-- Load CSS -->
  <link rel="stylesheet" href="https://unpkg.com/github-crud@1/dist/github-crud.css"/>
</head>
<body>

<div id="login-view" style="display:flex;align-items:center;justify-content:center;min-height:100vh"></div>
<div id="app-view"   style="display:none;padding:1.5rem"></div>

<!-- Load library -->
<script type="module">
import GithubCRUD from 'https://unpkg.com/github-crud@1/dist/github-crud.es.js';

// ① Konfigurasi
const gc = new GithubCRUD({
  clientId:  'Ov23li_CLIENT_ID_KAMU',                      // ← ganti
  workerUrl: 'https://github-crud-auth.namakamu.workers.dev', // ← ganti
  repoOwner: 'username-kamu',                              // ← ganti
  repoName:  'nama-repo-data',                             // ← ganti
  roles:     ['admin', 'editor'],
});

// ② Definisi tabel
const ITEMS = {
  id: 'items', label: 'Items', file: 'data/items.json',
  roles: { admin: 'all', editor: 'write' },
  schema: [
    { key: 'id',   label: 'ID',   type: 'number', auto: true, readonly: true },
    { key: 'nama', label: 'Nama', type: 'text',   required: true },
    { key: 'aktif',label: 'Aktif',type: 'boolean',default: true },
  ],
};

// ③ Boot
const session = await gc.init();

if (!session) {
  gc.renderLoginCard('#login-view');
} else {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('app-view').style.display   = 'block';
  gc.mountTable(ITEMS, '#app-view');
}
</script>
</body>
</html>
```

### Deploy ke GitHub Pages

```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

Buka repo → **Settings → Pages → Source: main / (root) → Save**

---

## Panduan: Dengan Bundler (Vite)

```bash
# Buat project baru
npm create vite@latest my-app -- --template vanilla
cd my-app

# Install github-crud
npm install github-crud

# Tambah callback.html di root project (lihat contoh di atas)
```

Di `src/main.js`:

```javascript
import GithubCRUD from 'github-crud';
import 'github-crud/style';

const gc = new GithubCRUD({
  clientId:  import.meta.env.VITE_GH_CLIENT_ID,
  workerUrl: import.meta.env.VITE_WORKER_URL,
  repoOwner: import.meta.env.VITE_REPO_OWNER,
  repoName:  import.meta.env.VITE_REPO_NAME,
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
```

Buat `.env`:
```
VITE_GH_CLIENT_ID=Ov23li_CLIENT_ID_KAMU
VITE_WORKER_URL=https://github-crud-auth.namakamu.workers.dev
VITE_REPO_OWNER=username-kamu
VITE_REPO_NAME=nama-repo-data
```

> ⚠️ Tambahkan `.env` ke `.gitignore`

```bash
npm run dev    # development
npm run build  # production build → deploy isi folder dist/
```

---

## Schema — Semua Tipe Field

```javascript
schema: [
  // Auto-increment — tidak muncul di form create, readonly saat edit
  { key: 'id', label: 'ID', type: 'number', auto: true, readonly: true },

  // Teks biasa
  { key: 'nama', label: 'Nama', type: 'text', required: true, maxLength: 120 },

  // Teks panjang
  { key: 'deskripsi', label: 'Deskripsi', type: 'textarea', rows: 4 },

  // Angka dengan batas
  { key: 'harga', label: 'Harga', type: 'number', min: 0, max: 999999999 },

  // Email (divalidasi formatnya)
  { key: 'email', label: 'Email', type: 'email', required: true },

  // URL (harus https://)
  { key: 'website', label: 'Website', type: 'url' },

  // Tanggal
  { key: 'tgl_lahir', label: 'Tgl Lahir', type: 'date' },
  { key: 'dibuat',    label: 'Dibuat',    type: 'datetime' },

  // Toggle on/off
  { key: 'aktif', label: 'Aktif', type: 'boolean', default: true,
    trueLabel: 'Aktif', falseLabel: 'Nonaktif' },

  // Dropdown — pilihan sebagai array string
  { key: 'kategori', label: 'Kategori', type: 'select',
    options: ['Elektronik', 'Pakaian', 'Makanan'] },

  // Dropdown — pilihan dengan value berbeda dari label
  { key: 'status', label: 'Status', type: 'select',
    options: [
      { value: 'active',   label: 'Aktif' },
      { value: 'inactive', label: 'Nonaktif' },
    ], default: 'active' },

  // Field tersembunyi di tabel, tetap muncul di form
  { key: 'internal_notes', label: 'Catatan Internal', type: 'textarea', hidden: true },

  // Tidak bisa diubah setelah dibuat
  { key: 'created_by', label: 'Dibuat Oleh', type: 'text', readonly: true },
]
```

| `type` | Form | Tampilan di tabel |
|---|---|---|
| `text` | `<input type="text">` | Teks |
| `textarea` | `<textarea>` | Teks (terpotong) |
| `number` | `<input type="number">` | Angka |
| `email` | `<input type="email">` | Teks |
| `url` | `<input type="url">` | Link |
| `date` | `<input type="date">` | Tanggal |
| `datetime` | `<input type="datetime-local">` | Tanggal & jam |
| `boolean` | Toggle switch | Badge ✓/✗ |
| `select` | Dropdown | Badge |
| `color` | Color picker | Teks |
| `password` | `<input type="password">` | ••••• |

---

## Roles & Permissions

```javascript
roles: {
  admin:  'all',    // Lihat ✓  Tambah ✓  Edit ✓  Hapus ✓
  editor: 'write',  // Lihat ✓  Tambah ✓  Edit ✓  Hapus ✗
  viewer: 'read',   // Lihat ✓  Tambah ✗  Edit ✗  Hapus ✗
  banned: 'none',   // Tidak bisa akses sama sekali
}
```

Tombol di UI (Tambah, Edit, Hapus) **otomatis muncul/hilang** sesuai permission role yang sedang login.

**Cara menentukan role user:**

Secara default, pemilik repo (`repoOwner`) mendapat role pertama (paling privileged). User lain mendapat role terakhir (paling terbatas).

Untuk kontrol lebih detail, buat collection `users` dengan field `github` dan `role`:

```javascript
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

Saat user login, github-crud akan mencocokkan username GitHub mereka dengan field `github` di collection ini, lalu menetapkan role sesuai field `role`.

---

## API Lengkap

### Setup

```javascript
import GithubCRUD from 'github-crud';          // bundler
// atau
import GithubCRUD from 'https://unpkg.com/github-crud@1/dist/github-crud.es.js'; // CDN

const gc = new GithubCRUD({
  clientId:    string,     // GitHub OAuth App Client ID (wajib)
  workerUrl:   string,     // Cloudflare Workers URL (wajib)
  repoOwner:   string,     // GitHub username/org pemilik repo data (wajib)
  repoName:    string,     // Nama repo yang menyimpan JSON (wajib)
  roles:       string[],   // Daftar role, urutan dari paling ke paling kurang privileged (wajib)
  collections: object[],   // Definisi collections (opsional)
  redirectUri: string,     // OAuth redirect URI (opsional, auto-detect)
  scope:       string,     // OAuth scope (default: 'repo')
});
```

### Auth

```javascript
// Cek sesi di setiap page load
const session = await gc.init();
// → { user, role, token }  atau  null jika belum login

gc.login();    // Redirect ke GitHub login
gc.logout();   // Hapus sesi + reload halaman

gc.user        // { login, avatar_url, name, email, ... }
gc.role        // 'admin' | 'editor' | ... sesuai config roles
gc.isLoggedIn  // true | false
```

### Database

```javascript
// Baca semua data
const { data, sha } = await gc.getAll(collection);

// Query dengan filter, sort, paginasi
const { data, total } = await gc.query(collection, {
  filter: { status: 'active', kategori: 'Elektronik' },
  sort:   'nama',
  order:  'asc',    // atau 'desc'
  limit:  10,
  offset: 0,
});

// Tambah record baru
const { record } = await gc.insert(collection, {
  nama: 'Produk Baru', harga: 50000, aktif: true,
});

// Update sebagian field
await gc.update(collection, id, { harga: 75000 });

// Hapus record
await gc.remove(collection, id);
```

### UI Components

```javascript
// Mount tabel CRUD lengkap ke elemen DOM
const table = gc.mountTable(collection, '#container');
// atau dengan modal kustom:
const table = gc.mountTable(collection, '#container', '#my-modal');

// Refresh data tabel
table.refresh();

// Render login card
gc.renderLoginCard('#container', {
  title:        'Nama App',
  description:  'Deskripsi custom.',
  note:         'Catatan di bawah tombol.',
  errorMessage: 'Pesan error jika ada.',
});

// Tampilkan toast notification
gc.toast('Pesan', 'success');  // 'success' | 'error' | 'warn' | 'info'
```

### Events

```javascript
// Listen status perubahan (berguna untuk loading indicator kustom)
document.addEventListener('gc:status', (e) => {
  const { state, detail, label } = e.detail;
  // state: 'loading' | 'saving' | 'ready' | 'error'
  // label: nama collection
  // detail: jumlah baris (ready) atau pesan error (error)
});
```

---

## Undang Collaborator

Hanya collaborator repo yang bisa login.

1. Buka repo di GitHub
2. **Settings → Collaborators → Add people**
3. Masukkan username GitHub mereka
4. Mereka menerima email undangan → harus diterima dulu
5. Setelah diterima, mereka bisa login langsung

---

## FAQ

**Q: Apakah data aman?**  
Data tersimpan di GitHub repo kamu sendiri. Akses dikontrol oleh GitHub: hanya collaborator yang kamu undang yang bisa login. Setiap perubahan tercatat di commit history.

**Q: Berapa biayanya?**  
Gratis. GitHub Pages gratis. Cloudflare Workers free tier: 100.000 request/hari, lebih dari cukup untuk penggunaan normal.

**Q: Kalau 2 orang edit bersamaan?**  
Yang kedua akan gagal simpan karena SHA file berubah. Klik Refresh dan coba lagi. Ini adalah trade-off dari arsitektur tanpa server.

**Q: Bisa untuk repo private?**  
Ya. OAuth scope `repo` sudah mencakup repo private.

**Q: Bisa beberapa collection sekaligus?**  
Ya. Panggil `gc.mountTable()` berkali-kali dengan collection berbeda.

**Q: Bisa dipakai di luar GitHub Pages?**  
Ya. Works di Netlify, Vercel, Cloudflare Pages, atau server statis manapun, selama `callback.html` bisa diakses di URL yang didaftarkan di OAuth App.

**Q: Bisa custom tampilan?**  
Ya. Semua class CSS diawali `gc-` dan bisa di-override. Atau gunakan API database langsung (`gc.getAll`, `gc.insert`, dll.) dengan UI kustom kamu sendiri.

---

## Struktur File di Repo Data

Setiap collection disimpan sebagai satu file JSON:

```
data/
├── produk.json   → collection produk
├── orders.json   → collection orders
└── users.json    → collection users
```

Format: **array of objects**

```json
[
  { "id": 1, "nama": "Laptop Pro", "harga": 15000000, "aktif": true },
  { "id": 2, "nama": "Mouse",      "harga": 250000,   "aktif": true }
]
```

File tidak perlu ada sebelumnya — akan dibuat otomatis saat data pertama ditambahkan.

---

## Contributing

1. Fork repo ini
2. Buat branch: `git checkout -b fitur/nama-fitur`
3. Commit: `git commit -m "feat: deskripsi fitur"`
4. Push: `git push origin fitur/nama-fitur`
5. Buat Pull Request

---

## License

MIT © github-crud contributors
