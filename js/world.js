// DEAD SIGNAL - facility model: macro-cell maze graph -> tile grid, rearrangement ops, pathing, line of sight.
// Pure logic (no rendering) so it can be tested headlessly.
'use strict';
const TILE = 3, WALLH = 3.2;
// tile types
const T_FLOOR = 0, T_WALL = 1, T_SEALED = 2, T_EYE = 3, T_EXIT = 4, T_VOID = 5;
// edge values
const E_WALL = 0, E_OPEN = 1, E_SEALED = 2, E_EYE = 3;

function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

class Facility {
  constructor(seed = 1, size = 9) {
    this.seed = seed; this.rng = mulberry(seed); this.cw = size; this.ch = size; this.shifts = 0; this.maxSize = 13;
    this.void = []; this.H = []; this.V = [];
    for (let y = 0; y < this.ch; y++) { this.void.push(new Array(this.cw).fill(false)); this.H.push(new Array(this.cw - 1).fill(0)); if (y < this.ch - 1) this.V.push(new Array(this.cw).fill(0)); }
    this.rooms = []; this.fixed = []; this.exit = null; this.protected = new Set();
    this.generate(); this.build();
  }
  r() { return this.rng(); }
  ri(n) { return (this.rng() * n) | 0; }
  pick(a) { return a[this.ri(a.length)]; }
  key(x, y) { return x + ',' + y; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.cw && y < this.ch; }
  // edge accessor between neighbouring cells
  getE(x, y, dx, dy) { if (dx === 1) return this.H[y][x]; if (dx === -1) return this.H[y][x - 1]; if (dy === 1) return this.V[y][x]; return this.V[y - 1][x]; }
  setE(x, y, dx, dy, v) { if (dx === 1) this.H[y][x] = v; else if (dx === -1) this.H[y][x - 1] = v; else if (dy === 1) this.V[y][x] = v; else this.V[y - 1][x] = v; }
  roomAt(x, y) { return this.rooms.find(r => x >= r.cx && x <= r.cx + 1 && y >= r.cy && y <= r.cy + 1) || null; }
  fixedAt(x, y) { return this.fixed.find(f => f.cx === x && f.cy === y) || null; }
  edges() { // all interior edges as [x,y,dx,dy]
    const out = []; for (let y = 0; y < this.ch; y++) for (let x = 0; x < this.cw; x++) { if (x < this.cw - 1) out.push([x, y, 1, 0]); if (y < this.ch - 1) out.push([x, y, 0, 1]); } return out;
  }
  isRoomInternal(x, y, dx, dy) { const a = this.roomAt(x, y), b = this.roomAt(x + dx, y + dy); return a && a === b; }

  generate() {
    const cw = this.cw, ch = this.ch;
    this.rooms.push({ id: 0, cx: 0, cy: 0, kind: 'start' });
    this.exit = { cx: cw - 1, cy: ch - 1 }; this.fixed.push({ cx: cw - 1, cy: ch - 1, kind: 'exit' }); this.H[ch - 1][cw - 2] = E_OPEN;
    // plain rooms
    let tries = 0; const kinds = ['lab', 'office', 'storage', 'lab', 'office'];
    while (this.rooms.length < 5 && tries++ < 400) {
      const x = this.ri(cw - 1), y = this.ri(ch - 1);
      if (!this.roomFree(x, y, true)) continue;
      this.rooms.push({ id: this.rooms.length, cx: x, cy: y, kind: kinds[this.rooms.length - 1] });
    }
    this.rooms.forEach(r => this.openRoom(r));
    // vaults: eye-door vault (key C) and dark vault (key B)
    const far = (x, y) => x + y >= Math.floor((cw + ch) / 2) - 1;
    for (const kind of ['eye', 'dark']) {
      for (let t = 0; t < 500; t++) {
        const x = this.ri(cw), y = this.ri(ch);
        if (!far(x, y) || this.roomAt(x, y) || this.fixedAt(x, y) || this.nearFixed(x, y)) continue;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => this.inb(x + dx, y + dy) && !this.fixedAt(x + dx, y + dy) && !this.nearFixed(x + dx, y + dy, true));
        if (!dirs.length) continue; const [dx, dy] = this.pick(dirs);
        this.fixed.push({ cx: x, cy: y, kind, door: [dx, dy] }); this.setE(x, y, dx, dy, kind === 'eye' ? E_EYE : E_OPEN); break;
      }
    }
    this.reroute(true);
  }
  nearFixed(x, y, strictSelf) { return this.fixed.some(f => Math.abs(f.cx - x) + Math.abs(f.cy - y) <= 1 && !(strictSelf && false)); }
  roomFree(x, y, gap, ignore) {
    if (x < 0 || y < 0 || x + 1 >= this.cw || y + 1 >= this.ch) return false;
    for (let yy = y; yy <= y + 1; yy++) for (let xx = x; xx <= x + 1; xx++) { if (this.void[yy][xx] || this.fixedAt(xx, yy) || this.nearFixed(xx, yy)) return false; }
    for (const r of this.rooms) { if (r === ignore) continue; const g = gap ? 1 : 0; if (x <= r.cx + 1 + g && x + 1 >= r.cx - g && y <= r.cy + 1 + g && y + 1 >= r.cy - g) return false; }
    return true;
  }
  openRoom(r) { this.H[r.cy][r.cx] = 1; this.H[r.cy + 1][r.cx] = 1; this.V[r.cy][r.cx] = 1; this.V[r.cy][r.cx + 1] = 1; }

  // Re-randomise every corridor connection that is not frozen. Frozen = touching a fixed cell, inside a room,
  // or touching a protected cell (around the player). Connectivity is guaranteed: the previous open graph was
  // connected and is a subset of (frozen-open + all free edges), so Kruskal over that always spans.
  reroute(initial) {
    const n = this.cw * this.ch, par = new Int32Array(n).map((_, i) => i);
    const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a === b) return false; par[a] = b; return true; };
    const id = (x, y) => y * this.cw + x;
    const free = [];
    for (const [x, y, dx, dy] of this.edges()) {
      const x2 = x + dx, y2 = y + dy;
      if (this.void[y][x] || this.void[y2][x2]) { this.setE(x, y, dx, dy, 0); continue; }
      const frozen = this.fixedAt(x, y) || this.fixedAt(x2, y2) || this.isRoomInternal(x, y, dx, dy) ||
        (!initial && (this.protected.has(this.key(x, y)) || this.protected.has(this.key(x2, y2))));
      if (this.isRoomInternal(x, y, dx, dy)) this.setE(x, y, dx, dy, 1);
      if (frozen) { const v = this.getE(x, y, dx, dy); if (v === E_OPEN || v === E_EYE) uni(id(x, y), id(x2, y2)); }
      else free.push([x, y, dx, dy]);
    }
    for (let i = free.length - 1; i > 0; i--) { const j = this.ri(i + 1); [free[i], free[j]] = [free[j], free[i]]; }
    for (const e of free) { const [x, y, dx, dy] = e; this.setE(x, y, dx, dy, uni(id(x, y), id(x + dx, y + dy)) ? 1 : 0); }
    for (const e of free) { const [x, y, dx, dy] = e; if (this.getE(x, y, dx, dy) === 0) { const p = this.r(); if (p < 0.13) this.setE(x, y, dx, dy, 1); else if (p < 0.21) this.setE(x, y, dx, dy, E_SEALED); } }
    this.ensureConnected();
  }
  // union-find over passable edges; opens edges if anything is cut off (safety net)
  components() {
    const n = this.cw * this.ch, par = new Int32Array(n).map((_, i) => i);
    const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    for (const [x, y, dx, dy] of this.edges()) { const v = this.getE(x, y, dx, dy); if ((v === 1 || v === 3) && !this.void[y][x] && !this.void[y + dy][x + dx]) { const a = find(y * this.cw + x), b = find((y + dy) * this.cw + x + dx); if (a !== b) par[a] = b; } }
    return { find, id: (x, y) => y * this.cw + x };
  }
  connected() { const { find, id } = this.components(); const root = find(id(0, 0)); for (let y = 0; y < this.ch; y++) for (let x = 0; x < this.cw; x++) if (!this.void[y][x] && find(id(x, y)) !== root) return false; return true; }
  ensureConnected() {
    let guard = 0; this.repairs = this.repairs || 0;
    while (!this.connected() && guard++ < 200) {
      const { find, id } = this.components();
      for (const [x, y, dx, dy] of this.edges()) {
        if (this.void[y][x] || this.void[y + dy][x + dx] || this.fixedAt(x, y) || this.fixedAt(x + dx, y + dy)) continue;
        if (find(id(x, y)) !== find(id(x + dx, y + dy))) { this.setE(x, y, dx, dy, 1); this.repairs++; break; }
      }
    }
  }

  // ---------- tile grid ----------
  get tw() { return this.cw * 2 + 1; } get th() { return this.ch * 2 + 1; }
  build() {
    const tw = this.tw, th = this.th, T = new Uint8Array(tw * th).fill(T_WALL);
    for (let y = 0; y < this.ch; y++) for (let x = 0; x < this.cw; x++) {
      T[(2 * y + 1) * tw + 2 * x + 1] = this.void[y][x] ? T_VOID : T_FLOOR;
      if (x < this.cw - 1) T[(2 * y + 1) * tw + 2 * x + 2] = [T_WALL, T_FLOOR, T_SEALED, T_EYE][this.H[y][x]];
      if (y < this.ch - 1) T[(2 * y + 2) * tw + 2 * x + 1] = [T_WALL, T_FLOOR, T_SEALED, T_EYE][this.V[y][x]];
    }
    for (const r of this.rooms) T[(2 * r.cy + 2) * tw + 2 * r.cx + 2] = T_FLOOR;
    T[(2 * this.exit.cy + 1) * tw + tw - 1] = T_EXIT; // exit door in the east boundary wall
    this.T = T; this.version = (this.version || 0) + 1; return T;
  }
  tile(tx, ty) { if (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) return T_WALL; return this.T[ty * this.tw + tx]; }
  exitTile() { return { tx: this.tw - 1, ty: 2 * this.exit.cy + 1 }; }
  // world helpers (tile centre)
  tw2w(t) { return t * TILE + TILE / 2; }
  w2t(v) { return Math.floor(v / TILE); }
  cellOf(x, z) { return { cx: Math.max(0, Math.min(this.cw - 1, Math.round((x / TILE - 1.5) / 2))), cy: Math.max(0, Math.min(this.ch - 1, Math.round((z / TILE - 1.5) / 2))) }; }
  cellCenter(cx, cy) { return { x: this.tw2w(2 * cx + 1), z: this.tw2w(2 * cy + 1) }; }
  roomCenter(r) { return { x: (2 * r.cx + 2.5) * TILE, z: (2 * r.cy + 2.5) * TILE }; }

  // BFS over tiles; pass(t) decides passability. returns Int16Array distances (-1 unreachable)
  bfs(tx, ty, pass) {
    const tw = this.tw, th = this.th, D = new Int16Array(tw * th).fill(-1), q = new Int32Array(tw * th); let h = 0, t = 0;
    if (tx < 0 || ty < 0 || tx >= tw || ty >= th) return D;
    D[ty * tw + tx] = 0; q[t++] = ty * tw + tx;
    while (h < t) { const i = q[h++], x = i % tw, y = (i / tw) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue; const j = ny * tw + nx; if (D[j] >= 0 || !pass(this.T[j])) continue; D[j] = D[i] + 1; q[t++] = j; } }
    return D;
  }
  // can the player get from (x,z) to the exit door (eye doors count as passable: you can walk through backwards)
  exitReachable(x, z) { const D = this.bfs(this.w2t(x), this.w2t(z), t => t === T_FLOOR || t === T_EYE || t === T_EXIT); const e = this.exitTile(); return D[e.ty * this.tw + e.tx] >= 0; }
  reachable(x, z, x2, z2) { const D = this.bfs(this.w2t(x), this.w2t(z), t => t === T_FLOOR || t === T_EYE); return D[this.w2t(z2) * this.tw + this.w2t(x2)] >= 0; }
  solidAt(x, z, eyeSolid) { const t = this.tile(this.w2t(x), this.w2t(z)); return t === T_WALL || t === T_VOID || t === T_SEALED || t === T_EXIT || (t === T_EYE && eyeSolid); }
  // grid DDA line of sight in xz; eye doors and sealed doors are opaque
  los(x0, z0, x1, z1, ignoreTile) {
    let tx = Math.floor(x0 / TILE), tz = Math.floor(z0 / TILE); const ex = Math.floor(x1 / TILE), ez = Math.floor(z1 / TILE);
    const dx = x1 - x0, dz = z1 - z0; const sx = Math.sign(dx), sz = Math.sign(dz);
    const tdx = dx !== 0 ? Math.abs(TILE / dx) : 1e9, tdz = dz !== 0 ? Math.abs(TILE / dz) : 1e9;
    let tmx = dx !== 0 ? ((sx > 0 ? (tx + 1) * TILE - x0 : x0 - tx * TILE) / Math.abs(dx)) : 1e9;
    let tmz = dz !== 0 ? ((sz > 0 ? (tz + 1) * TILE - z0 : z0 - tz * TILE) / Math.abs(dz)) : 1e9;
    for (let i = 0; i < 200; i++) {
      if (tx === ex && tz === ez) return true;
      if (tmx < tmz) { tmx += tdx; tx += sx; } else { tmz += tdz; tz += sz; }
      if (tmx > 1 && tmz > 1 && !(tx === ex && tz === ez)) { /* past end */ }
      if (tx === ex && tz === ez) return true;
      if (ignoreTile && tx === ignoreTile[0] && tz === ignoreTile[1]) continue;
      const t = this.tile(tx, tz); if (t !== T_FLOOR) return false;
    }
    return false;
  }
  // distance along a ray (xz) to the first solid tile
  rayWall(x0, z0, dx, dz, maxD = 60, eyeSolid = true) {
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len; let d = 0; const st = 0.05;
    while (d < maxD) { d += st; if (this.solidAt(x0 + dx * d, z0 + dz * d, eyeSolid)) return d; }
    return maxD;
  }

  // ---------- rearrangement ops (called during a blackout) ----------
  setProtected(px, pz, radius = 1) { this.protected.clear(); const c = this.cellOf(px, pz); for (let y = c.cy - radius; y <= c.cy + radius; y++) for (let x = c.cx - radius; x <= c.cx + radius; x++) if (this.inb(x, y)) this.protected.add(this.key(x, y)); return c; }
  openSealedDoor(px, pz) {
    const c = this.cellOf(px, pz); let best = null, bd = 1e9;
    for (const [x, y, dx, dy] of this.edges()) if (this.getE(x, y, dx, dy) === E_SEALED) { const d = Math.abs(x - c.cx) + Math.abs(y - c.cy); if (d < bd) { bd = d; best = [x, y, dx, dy]; } }
    if (!best) return null; this.setE(...best, E_OPEN); return best;
  }
  // insert a duplicated row (axis 'z') or column (axis 'x') after index k: every corridor crossing it gets 1 cell (6 m) longer
  canInsert(axis, k) {
    if (axis === 'z') { if (k < 0 || k >= this.ch - 1 || this.ch >= this.maxSize) return false; if (this.rooms.some(r => r.cy === k)) return false; if (this.V[k].some(v => v === 2 || v === 3)) return false; return this.V[k].some(v => v === 1); }
    if (k < 0 || k >= this.cw - 1 || this.cw >= this.maxSize) return false; if (this.rooms.some(r => r.cx === k)) return false; if (this.H.some(row => row[k] === 2 || row[k] === 3)) return false; return this.H.some(row => row[k] === 1);
  }
  insert(axis, k) {
    if (!this.canInsert(axis, k)) return false;
    if (axis === 'z') {
      this.void.splice(k + 1, 0, this.V[k].map(v => v !== 1)); this.H.splice(k + 1, 0, new Array(this.cw - 1).fill(0)); this.V.splice(k + 1, 0, this.V[k].map(v => v === 1 ? 1 : 0)); this.ch++;
      for (const o of [...this.rooms, ...this.fixed, this.exit]) if (o.cy > k) o.cy++;
    } else {
      for (let y = 0; y < this.ch; y++) { this.void[y].splice(k + 1, 0, this.H[y][k] !== 1); this.H[y].splice(k + 1, 0, this.H[y][k] === 1 ? 1 : 0); }
      for (let y = 0; y < this.ch - 1; y++) this.V[y].splice(k + 1, 0, 0); this.cw++;
      for (const o of [...this.rooms, ...this.fixed, this.exit]) if (o.cx > k) o.cx++;
    }
    // positions with world coord beyond this boundary must shift by +2 tiles
    return { axis, k, from: (2 * k + 3) * TILE, by: 2 * TILE };
  }
  // choose the insertion that lengthens the corridor the player is looking down, if possible
  lengthenHall(px, pz, yaw) {
    const c = this.cellOf(px, pz); const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const axis = Math.abs(fz) >= Math.abs(fx) ? 'z' : 'x', dir = axis === 'z' ? Math.sign(fz) : Math.sign(fx);
    const cands = [];
    for (let k = 0; k < (axis === 'z' ? this.ch : this.cw) - 1; k++) {
      if (!this.canInsert(axis, k)) continue;
      let score = this.r();
      const pc = axis === 'z' ? c.cy : c.cx;
      // ahead of the player and in a straight open run from the player's cell
      const ahead = dir > 0 ? k >= pc : k < pc;
      if (ahead) { score += 1; let open = true; const a = Math.min(pc, k + (dir > 0 ? 0 : 1)), b = Math.max(pc, k + (dir > 0 ? 1 : 0));
        for (let i = a; i < b; i++) { const v = axis === 'z' ? this.V[i][c.cx] : this.H[c.cy][i]; if (v !== 1) { open = false; break; } } if (open) score += 3; }
      cands.push([score, k]);
    }
    if (!cands.length) return null; cands.sort((a, b) => b[0] - a[0]);
    return this.insert(axis, cands[0][1]);
  }
  moveRoom() {
    const movable = this.rooms.filter(r => r.kind !== 'start' && ![0, 1].some(dy => [0, 1].some(dx => this.protected.has(this.key(r.cx + dx, r.cy + dy)))));
    if (!movable.length) return null; const r = this.pick(movable);
    for (let t = 0; t < 300; t++) {
      const x = this.ri(this.cw - 1), y = this.ri(this.ch - 1); if (Math.abs(x - r.cx) + Math.abs(y - r.cy) < 3) continue;
      if (!this.roomFree(x, y, false, r)) continue;
      if ([0, 1].some(dy => [0, 1].some(dx => this.protected.has(this.key(x + dx, y + dy))))) continue;
      const old = { cx: r.cx, cy: r.cy }; r.cx = x; r.cy = y; this.openRoom(r);
      return { room: r.id, dx: (x - old.cx) * 2 * TILE, dz: (y - old.cy) * 2 * TILE, x0: (2 * old.cx + 1) * TILE, z0: (2 * old.cy + 1) * TILE, x1: (2 * old.cx + 4) * TILE, z1: (2 * old.cy + 4) * TILE };
    }
    return null;
  }
  // longest straight run of floor from the player's tile, preferring the facing direction: where to stand a figure
  corridorEnd(px, pz, yaw) {
    const tx = this.w2t(px), tz = this.w2t(pz); const fx = -Math.sin(yaw), fz = -Math.cos(yaw); let best = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let n = 0; while (this.tile(tx + dx * (n + 1), tz + dz * (n + 1)) === T_FLOOR) n++;
      const score = n + (dx * fx + dz * fz) * 4; if (n >= 4 && (!best || score > best.score)) best = { score, n, x: this.tw2w(tx + dx * n), z: this.tw2w(tz + dz * n), dx, dz };
    }
    return best;
  }
  randomFloorCell(minDistFrom, minD) {
    for (let t = 0; t < 400; t++) { const x = this.ri(this.cw), y = this.ri(this.ch); if (this.void[y][x] || this.fixedAt(x, y)) continue; const c = this.cellCenter(x, y); if (minDistFrom && Math.hypot(c.x - minDistFrom.x, c.z - minDistFrom.z) < minD) continue; return { cx: x, cy: y, ...c }; }
    return null;
  }
}
if (typeof module !== 'undefined') module.exports = { Facility, TILE, T_FLOOR, T_WALL, T_SEALED, T_EYE, T_EXIT, T_VOID };
