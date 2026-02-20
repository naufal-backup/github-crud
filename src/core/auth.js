// src/core/auth.js — GitHub OAuth + session management + role detection

export class GithubAuth {
  constructor(config) {
    this.config = config;
    // Prefix key sessionStorage: gc:owner/repo
    this._k = `gc:${config.repoOwner}/${config.repoName}`;
  }

  // ── Token storage (sessionStorage) ───────────────────────────────────────

  getToken()  { return sessionStorage.getItem(`${this._k}:token`); }
  setToken(t) { sessionStorage.setItem(`${this._k}:token`, t); }

  clearSession() {
    ['token', 'user', 'role'].forEach(k => sessionStorage.removeItem(`${this._k}:${k}`));
  }

  // ── OAuth flow ────────────────────────────────────────────────────────────

  /** Redirect ke halaman GitHub OAuth */
  login() {
    const redirect = this.config.redirectUri
      || `${location.origin}${location.pathname.replace(/\/[^/]*$/, '')}/callback.html`;

    const params = new URLSearchParams({
      client_id:    this.config.clientId,
      redirect_uri: redirect,
      scope:        this.config.scope || 'repo',
    });

    location.href = `https://github.com/login/oauth/authorize?${params}`;
  }

  logout() { this.clearSession(); location.reload(); }

  /** Tukar OAuth code dengan access_token via Cloudflare Worker */
  async exchangeCode(code) {
    const url = this.config.workerUrl.replace(/\/$/, '') + '/exchange';
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error(data.error || 'Token tidak diterima dari worker.');
    return data.access_token;
  }

  // ── GitHub API ────────────────────────────────────────────────────────────

  async _gh(path, token, opts = {}) {
    return fetch(`https://api.github.com${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept:        'application/vnd.github+json',
        ...opts.headers,
      },
    });
  }

  async getUser(token) {
    const res = await this._gh('/user', token);
    if (!res.ok) throw new Error('Gagal mengambil profil GitHub. Coba login ulang.');
    return res.json();
  }

  /** Cek apakah user adalah collaborator repo */
  async isCollaborator(token, username) {
    const { repoOwner, repoName } = this.config;
    const res = await this._gh(`/repos/${repoOwner}/${repoName}/collaborators/${username}`, token);
    return res.status === 204;
  }

  /**
   * Deteksi role user berdasarkan collection users (jika ada),
   * atau fallback ke role pertama jika pemilik repo, atau role terakhir.
   */
  async detectRole(token, username) {
    const { collections = [], roles = [], repoOwner, repoName } = this.config;

    // Cari collection yang punya field 'github' atau 'username'
    const usersColl = collections.find(c =>
      c.schema?.some(f => ['github', 'username'].includes(f.key))
    );

    if (usersColl) {
      try {
        const res = await this._gh(`/repos/${repoOwner}/${repoName}/contents/${usersColl.file}`, token);
        if (res.ok) {
          const raw  = await res.json();
          const data = JSON.parse(atob(raw.content.replace(/\n/g, '')));
          const row  = data.find(u => u.github === username || u.username === username);
          if (row?.role && roles.includes(row.role)) return row.role;
        }
      } catch {
        // Gagal baca collection users — lanjut ke fallback
      }
    }

    // Fallback: pemilik repo → role pertama, user lain → role terakhir
    if (username === repoOwner && roles.length) return roles[0];
    return roles[roles.length - 1] || 'viewer';
  }

  // ── Main init ─────────────────────────────────────────────────────────────

  /** Panggil di setiap page load. Return sesi atau null. */
  async init() {
    const token = this.getToken();
    if (!token) return null;

    // Gunakan cache sessionStorage jika ada
    const cachedUser = sessionStorage.getItem(`${this._k}:user`);
    if (cachedUser) {
      return {
        user:  JSON.parse(cachedUser),
        role:  sessionStorage.getItem(`${this._k}:role`),
        token,
      };
    }

    // Verifikasi token & cek collaborator
    const user = await this.getUser(token);
    const ok   = await this.isCollaborator(token, user.login);

    if (!ok) {
      this.clearSession();
      throw new Error(`@${user.login} bukan collaborator repo ${this.config.repoOwner}/${this.config.repoName}.`);
    }

    const role = await this.detectRole(token, user.login);

    // Cache di sessionStorage agar tidak perlu re-fetch setiap halaman
    sessionStorage.setItem(`${this._k}:user`, JSON.stringify(user));
    sessionStorage.setItem(`${this._k}:role`, role);

    return { user, role, token };
  }
}
