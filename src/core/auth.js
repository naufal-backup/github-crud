// src/core/auth.js — GitHub OAuth + session + collaborator validation

export class GithubAuth {
  constructor(config) {
    this.config = config;
    this._k = `gc:${config.repoOwner}/${config.repoName}`;
  }

  // ── Token storage ─────────────────────────────────────────────
  getToken()     { return sessionStorage.getItem(`${this._k}:token`); }
  setToken(t)    { sessionStorage.setItem(`${this._k}:token`, t); }
  clearSession() {
    ['token', 'user', 'role'].forEach(k => sessionStorage.removeItem(`${this._k}:${k}`));
  }

  // ── OAuth ─────────────────────────────────────────────────────
  login() {
    const redirect = this.config.redirectUri
      || `${location.origin}${location.pathname.replace(/\/[^/]*$/, '')}/callback.html`;
    const p = new URLSearchParams({
      client_id:    this.config.clientId,
      redirect_uri: redirect,
      scope:        this.config.scope || 'repo',
    });
    location.href = `https://github.com/login/oauth/authorize?${p}`;
  }

  logout() { this.clearSession(); location.reload(); }

  async exchangeCode(code) {
    const url = this.config.workerUrl.replace(/\/$/, '') + '/exchange';
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code }),
    });
    const d = await res.json();
    if (!d.access_token) throw new Error(d.error || 'Token tidak diterima dari worker.');
    return d.access_token;
  }

  // ── GitHub API ────────────────────────────────────────────────
  async _gh(path, token, opts = {}) {
    return fetch(`https://api.github.com${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        ...opts.headers,
      },
    });
  }

  async getUser(token) {
    const r = await this._gh('/user', token);
    if (!r.ok) throw new Error('Gagal mengambil profil GitHub. Coba login ulang.');
    return r.json();
  }

  async isCollaborator(token, username) {
    const { repoOwner, repoName } = this.config;
    const r = await this._gh(`/repos/${repoOwner}/${repoName}/collaborators/${username}`, token);
    return r.status === 204;
  }

  async detectRole(token, username) {
    const { collections = [], roles = [], repoOwner } = this.config;

    // Cari di collection yang punya field 'github' atau 'username'
    const usersColl = collections.find(c =>
      c.schema?.some(f => ['github', 'username'].includes(f.key))
    );
    if (usersColl) {
      try {
        const { repoName } = this.config;
        const r = await this._gh(`/repos/${repoOwner}/${repoName}/contents/${usersColl.file}`, token);
        if (r.ok) {
          const d    = await r.json();
          const data = JSON.parse(atob(d.content.replace(/\n/g, '')));
          const row  = data.find(u => u.github === username || u.username === username);
          if (row?.role && roles.includes(row.role)) return row.role;
        }
      } catch {}
    }

    if (username === repoOwner && roles.length) return roles[0];
    return roles[roles.length - 1] || 'viewer';
  }

  // ── Main init — call on every page load ───────────────────────
  async init() {
    const token = this.getToken();
    if (!token) return null;

    const cachedUser = sessionStorage.getItem(`${this._k}:user`);
    if (cachedUser) {
      return {
        user:  JSON.parse(cachedUser),
        role:  sessionStorage.getItem(`${this._k}:role`),
        token,
      };
    }

    const user = await this.getUser(token);
    const ok   = await this.isCollaborator(token, user.login);
    if (!ok) {
      this.clearSession();
      throw new Error(`@${user.login} bukan collaborator repo ${this.config.repoOwner}/${this.config.repoName}.`);
    }

    const role = await this.detectRole(token, user.login);
    sessionStorage.setItem(`${this._k}:user`, JSON.stringify(user));
    sessionStorage.setItem(`${this._k}:role`, role);
    return { user, role, token };
  }
}
