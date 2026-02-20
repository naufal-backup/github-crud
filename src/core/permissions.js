// src/core/permissions.js — Role-based access control

const LEVEL = { none: 0, read: 1, write: 2, all: 3 };

export class Permissions {
  constructor(userRole) {
    this.role = userRole;
  }

  _level(collection) {
    return LEVEL[collection.roles?.[this.role]] ?? 0;
  }

  canRead(collection)   { return this._level(collection) >= LEVEL.read; }
  canWrite(collection)  { return this._level(collection) >= LEVEL.write; }
  canDelete(collection) { return this._level(collection) >= LEVEL.all; }

  /** Kembalikan string permission: 'all' | 'write' | 'read' | 'none' */
  get(collection) { return collection.roles?.[this.role] || 'none'; }
}
