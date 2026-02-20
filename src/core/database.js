// src/core/database.js — Baca/tulis file JSON di GitHub sebagai tabel

export class GithubDatabase {
  constructor(config, token) {
    this.config  = config;
    this._token  = token;
  }

  _base() {
    const { repoOwner, repoName } = this.config;
    return `https://api.github.com/repos/${repoOwner}/${repoName}/contents`;
  }

  _headers(extra = {}) {
    return {
      Authorization:  `Bearer ${this._token}`,
      Accept:         'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async read(filePath) {
    const res = await fetch(`${this._base()}/${filePath}`, { headers: this._headers() });

    if (res.status === 404) return { data: [], sha: null };
    if (!res.ok) throw new Error(`Gagal membaca ${filePath} (HTTP ${res.status})`);

    const raw  = await res.json();
    const data = JSON.parse(atob(raw.content.replace(/\n/g, '')));
    return { data: Array.isArray(data) ? data : [], sha: raw.sha };
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  async write(filePath, data, sha, commitMessage) {
    // btoa tidak support karakter non-latin, gunakan encodeURIComponent + unescape
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body    = { message: commitMessage, content };
    if (sha) body.sha = sha;  // wajib ada saat update file yang sudah ada

    const res = await fetch(`${this._base()}/${filePath}`, {
      method:  'PUT',
      headers: this._headers(),
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Gagal menyimpan ${filePath}`);
    }

    const result = await res.json();
    return result.content.sha;  // SHA baru setelah commit
  }

  // ── Collection shortcuts ──────────────────────────────────────────────────

  async getAll(collection) {
    return this.read(collection.file);
  }

  async insert(collection, record, userLogin) {
    const { data, sha } = await this.read(collection.file);

    // Auto-increment: cari nilai id tertinggi + 1
    const autoField = collection.schema?.find(f => f.auto);
    if (autoField) {
      record[autoField.key] = data.reduce((max, r) => Math.max(max, Number(r[autoField.key]) || 0), 0) + 1;
    }

    if (collection.timestamps) {
      record.createdAt = new Date().toISOString();
      record.updatedAt = new Date().toISOString();
    }

    const newData = [...data, record];
    const newSha  = await this.write(
      collection.file, newData, sha,
      `[github-crud] Add to ${collection.label} by @${userLogin}`
    );
    return { record, sha: newSha };
  }

  async update(collection, id, patch, userLogin) {
    const { data, sha } = await this.read(collection.file);
    const idKey = collection.schema?.find(f => f.auto)?.key || 'id';
    const idx   = data.findIndex(r => String(r[idKey]) === String(id));

    if (idx === -1) throw new Error(`Record dengan id=${id} tidak ditemukan.`);

    if (collection.timestamps) patch.updatedAt = new Date().toISOString();
    data[idx] = { ...data[idx], ...patch };

    const newSha = await this.write(
      collection.file, data, sha,
      `[github-crud] Update ${collection.label}#${id} by @${userLogin}`
    );
    return { record: data[idx], sha: newSha };
  }

  async remove(collection, id, userLogin) {
    const { data, sha } = await this.read(collection.file);
    const idKey    = collection.schema?.find(f => f.auto)?.key || 'id';
    const filtered = data.filter(r => String(r[idKey]) !== String(id));

    if (filtered.length === data.length) throw new Error(`Record dengan id=${id} tidak ditemukan.`);

    const newSha = await this.write(
      collection.file, filtered, sha,
      `[github-crud] Delete ${collection.label}#${id} by @${userLogin}`
    );
    return { sha: newSha };
  }

  // ── Query dengan filter, sort, paginasi ──────────────────────────────────

  async query(collection, { filter, sort, order = 'asc', limit, offset = 0 } = {}) {
    const { data } = await this.read(collection.file);
    let rows = [...data];

    if (filter) {
      rows = rows.filter(r =>
        Object.entries(filter).every(([k, v]) => String(r[k]) === String(v))
      );
    }

    if (sort) {
      rows.sort((a, b) => {
        const cmp = String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), undefined, { numeric: true });
        return order === 'desc' ? -cmp : cmp;
      });
    }

    const total = rows.length;
    if (offset) rows = rows.slice(offset);
    if (limit)  rows = rows.slice(0, limit);
    return { data: rows, total };
  }
}
