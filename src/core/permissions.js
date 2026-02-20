// src/core/permissions.js — Role-based access control

const LEVEL = { none: 0, read: 1, write: 2, all: 3 };

export class Permissions {
  constructor(userRole) {
    this.role = userRole;
  }

  _lv(collection) {
    return LEVEL[collection.roles?.[this.role]] ?? 0;
  }

  canRead(c)   { return this._lv(c) >= LEVEL.read; }
  canWrite(c)  { return this._lv(c) >= LEVEL.write; }
  canDelete(c) { return this._lv(c) >= LEVEL.all; }
  get(c)       { return collection.roles?.[this.role] || 'none'; }
}
