// DEAD SIGNAL - rendering: procedural textures, models, facility meshes
'use strict';
const R3 = {};
(function () {
  function canvasTex(size, draw, repeat) {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 4; return t;
  }
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed & 0xffff) / 0x10000; };
  function grime(g, s, n, col, maxR) { for (let i = 0; i < n; i++) { const x = rnd() * s, y = rnd() * s, r = rnd() * maxR + 2; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }
  function speckle(g, s, n, a) { for (let i = 0; i < n; i++) { const v = (rnd() * 255) | 0; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 2, 1 + rnd() * 2); } }
  R3.makeTextures = function () {
    const T = {};
    T.wall = canvasTex(256, (g, s) => {
      g.fillStyle = '#6f7368'; g.fillRect(0, 0, s, s); speckle(g, s, 4000, 0.08);
      g.fillStyle = '#4f5a4d'; g.fillRect(0, s * 0.62, s, s * 0.38); // lower paint band
      g.fillStyle = '#2d302a'; g.fillRect(0, s * 0.6, s, 4); g.fillRect(0, s - 10, s, 10);
      g.strokeStyle = 'rgba(30,30,25,.55)'; g.lineWidth = 2; for (let x = 0; x <= s; x += s / 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke(); }
      grime(g, s, 30, 'rgba(25,20,10,.35)', 40); grime(g, s, 8, 'rgba(60,40,20,.35)', 20);
      for (let i = 0; i < 12; i++) { const x = rnd() * s; g.fillStyle = 'rgba(30,25,15,.25)'; g.fillRect(x, s * 0.1 + rnd() * 40, 2 + rnd() * 3, 40 + rnd() * 120); } // drips
    }, true);
    T.floor = canvasTex(256, (g, s) => {
      g.fillStyle = '#3b3c37'; g.fillRect(0, 0, s, s); const n = 4, w = s / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 52 + rnd() * 18; g.fillStyle = `rgb(${v},${v + 2},${v - 4})`; g.fillRect(x * w + 2, y * w + 2, w - 4, w - 4); }
      speckle(g, s, 3000, 0.1); grime(g, s, 25, 'rgba(10,8,5,.45)', 45);
    }, true);
    T.ceil = canvasTex(256, (g, s) => {
      g.fillStyle = '#4a4b46'; g.fillRect(0, 0, s, s); g.strokeStyle = '#262723'; g.lineWidth = 4; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * s / 2, 0); g.lineTo(i * s / 2, s); g.stroke(); g.beginPath(); g.moveTo(0, i * s / 2); g.lineTo(s, i * s / 2); g.stroke(); }
      speckle(g, s, 2500, 0.08); grime(g, s, 20, 'rgba(40,30,10,.4)', 35);
    }, true);
    T.door = canvasTex(256, (g, s) => {
      g.fillStyle = '#4b4f52'; g.fillRect(0, 0, s, s); speckle(g, s, 2000, 0.1);
      for (let i = -s; i < s * 2; i += 32) { g.fillStyle = '#b8901c'; g.beginPath(); g.moveTo(i, s * 0.82); g.lineTo(i + 16, s * 0.82); g.lineTo(i + 16 + 30, s); g.lineTo(i + 30, s); g.fill(); }
      g.fillStyle = '#222'; g.fillRect(s / 2 - 2, 0, 4, s * 0.82); g.fillStyle = '#7a1c1c'; g.fillRect(s * 0.38, s * 0.25, s * 0.24, s * 0.1);
      g.fillStyle = '#e8e0c8'; g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.fillText('SEALED', s / 2, s * 0.33); grime(g, s, 20, 'rgba(20,15,5,.5)', 40);
    });
    T.eye = canvasTex(256, (g, s) => {
      g.fillStyle = '#2a2c2e'; g.fillRect(0, 0, s, s); speckle(g, s, 2000, 0.1);
      g.strokeStyle = '#d9d2bd'; g.lineWidth = 7; g.beginPath(); g.moveTo(s * 0.15, s * 0.45); g.quadraticCurveTo(s / 2, s * 0.15, s * 0.85, s * 0.45); g.quadraticCurveTo(s / 2, s * 0.75, s * 0.15, s * 0.45); g.stroke();
      g.fillStyle = '#8a1010'; g.beginPath(); g.arc(s / 2, s * 0.45, s * 0.12, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(s / 2, s * 0.45, s * 0.05, 0, 7); g.fill();
      g.fillStyle = 'rgba(217,210,189,.8)'; g.font = 'bold 15px monospace'; g.textAlign = 'center'; g.fillText('DO NOT WATCH', s / 2, s * 0.78);
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(120,0,0,.6)'; g.fillRect(s * 0.3 + rnd() * s * 0.4, s * 0.55, 2, 20 + rnd() * 50); }
      grime(g, s, 20, 'rgba(10,5,0,.5)', 40);
    });
    T.exit = canvasTex(256, (g, s) => {
      g.fillStyle = '#3d4246'; g.fillRect(0, 0, s, s); speckle(g, s, 2000, 0.1);
      g.fillStyle = '#16191b'; g.fillRect(s * 0.18, s * 0.28, s * 0.64, s * 0.72);
      g.fillStyle = '#585e63'; g.fillRect(s * 0.21, s * 0.31, s * 0.58, s * 0.69);
      g.fillStyle = '#2b2f32'; g.fillRect(s * 0.66, s * 0.6, s * 0.06, s * 0.05);
      g.fillStyle = '#3a0505'; g.fillRect(s * 0.3, s * 0.06, s * 0.4, s * 0.15); g.fillStyle = '#ff3a2a'; g.font = 'bold 34px monospace'; g.textAlign = 'center'; g.fillText('EXIT', s / 2, s * 0.18);
      grime(g, s, 20, 'rgba(10,5,0,.45)', 40);
    });
    T.blood = canvasTex(128, (g, s) => { for (let i = 0; i < 40; i++) { const x = s / 2 + (rnd() - 0.5) * s * 0.7, y = s / 2 + (rnd() - 0.5) * s * 0.7, r = rnd() * 18 + 3; g.fillStyle = `rgba(${70 + rnd() * 40 | 0},5,5,${0.5 + rnd() * 0.4})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } });
    T.glow = canvasTex(64, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
    T.screen = canvasTex(64, (g, s) => { g.fillStyle = '#062'; g.fillRect(0, 0, s, s); g.fillStyle = '#3f8'; for (let y = 6; y < s; y += 7) g.fillRect(4, y, 10 + rnd() * 44, 2); });
    return T;
  };
  const writingCache = {};
  R3.writingTex = function (text, color) {
    const k = text + color; if (writingCache[k]) return writingCache[k];
    writingCache[k] = canvasTex(256, (g, s) => {
      g.clearRect(0, 0, s, s); g.font = 'bold 30px "Courier New",monospace'; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
      const words = text.split(' '); const lines = []; let cur = '';
      for (const w of words) { if ((cur + ' ' + w).trim().length > 12) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; } lines.push(cur.trim());
      lines.forEach((l, i) => { g.save(); g.translate(s / 2, s / 2 + (i - (lines.length - 1) / 2) * 36); g.rotate((rnd() - 0.5) * 0.12); g.fillText(l, 0, 0); g.restore(); });
      // drips
      for (let i = 0; i < 8; i++) { g.fillStyle = color; g.globalAlpha = 0.6; g.fillRect(30 + rnd() * 200, s / 2 + rnd() * 30, 2, 10 + rnd() * 40); }
    });
    return writingCache[k];
  };

  // ---------- models ----------
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  R3.box = box;
  R3.human = function (opts = {}) { // the player's double: orange jumpsuit
    const g = new THREE.Group(); const suit = new THREE.MeshLambertMaterial({ color: opts.color || 0x9a5a22 }); const skin = new THREE.MeshLambertMaterial({ color: 0xb59a86 }); const dark = new THREE.MeshLambertMaterial({ color: 0x1d1b19 });
    const sit = !!opts.sitting;
    const torso = box(0.46, 0.62, 0.26, suit, 0, sit ? 0.82 : 1.2, 0); g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skin); head.position.set(0, sit ? 1.3 : 1.68, 0); head.scale.set(1, 1.15, 1); g.add(head); g.userData.head = head;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, 1.4), dark); hair.position.copy(head.position).add(new THREE.Vector3(0, 0.03, 0.01)); g.add(hair);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); const eyes = new THREE.Group();
    [-0.055, 0.055].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), eyeMat); e.position.set(x, 0.02, -0.14); eyes.add(e); });
    eyes.position.copy(head.position); eyes.visible = opts.eyes !== false; g.add(eyes); g.userData.eyes = eyes;
    if (sit) {
      [-0.12, 0.12].forEach(x => { g.add(box(0.17, 0.17, 0.5, suit, x, 0.5, -0.2)); g.add(box(0.16, 0.48, 0.17, suit, x, 0.24, -0.42)); g.add(box(0.17, 0.08, 0.26, dark, x, 0.03, -0.48)); });
      [-0.3, 0.3].forEach(x => g.add(box(0.13, 0.5, 0.14, suit, x, 0.72, -0.12)));
    } else {
      [-0.12, 0.12].forEach(x => { g.add(box(0.17, 0.9, 0.19, suit, x, 0.45, 0)); g.add(box(0.18, 0.08, 0.27, dark, x, 0.04, -0.04)); });
      const armL = box(0.13, 0.62, 0.14, suit, -0.31, 1.18, 0), armR = box(0.13, 0.62, 0.14, suit, 0.31, 1.18, 0); armR.rotation.x = -0.9; armR.position.z = -0.2; armR.position.y = 1.25; g.add(armL, armR);
      const torch = box(0.06, 0.06, 0.22, dark, 0.31, 1.15, -0.5); g.add(torch);
    }
    return g;
  };
  R3.witness = function () {
    const g = new THREE.Group(); const black = new THREE.MeshLambertMaterial({ color: 0x050506 }); const pale = new THREE.MeshLambertMaterial({ color: 0xc9c4b8, emissive: 0x202020 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, 1.9, 8), black); body.position.y = 1.15; g.add(body);
    const sh = box(0.62, 0.14, 0.24, black, 0, 2.08, 0); g.add(sh);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.25, 6), black); neck.position.y = 2.25; g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), pale); head.scale.set(0.85, 1.35, 0.9); head.position.y = 2.5; g.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    [-0.06, 0.06].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeMat); e.position.set(x, 2.53, -0.14); g.add(e); });
    const mouth = box(0.08, 0.012, 0.01, new THREE.MeshBasicMaterial({ color: 0x000000 }), 0, 2.38, -0.152); g.add(mouth);
    [-0.33, 0.33].forEach(x => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.55, 6), black); a.position.set(x, 1.3, 0); a.rotation.z = x > 0 ? 0.06 : -0.06; g.add(a);
      for (let f = 0; f < 3; f++) { const fi = box(0.015, 0.22, 0.015, black, x + (f - 1) * 0.03 * Math.sign(x), 0.45, (f - 1) * 0.02); g.add(fi); } });
    g.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    return g;
  };
  R3.husk = function () {
    const g = new THREE.Group(); const flesh = new THREE.MeshLambertMaterial({ color: 0x7c7466 }); const rag = new THREE.MeshLambertMaterial({ color: 0x34372f }); const eye = new THREE.MeshBasicMaterial({ color: 0xff2a10 });
    const hip = new THREE.Group(); hip.position.y = 0.85; g.add(hip);
    const torso = box(0.44, 0.6, 0.28, rag, 0, 0.3, 0); hip.add(torso); hip.rotation.x = 0.45;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), flesh); head.position.set(0, 0.72, -0.08); head.scale.set(1, 1.1, 1.05); hip.add(head);
    [-0.05, 0.05].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), eye); e.position.set(x, 0.74, -0.22); hip.add(e); });
    const jaw = box(0.12, 0.05, 0.06, new THREE.MeshBasicMaterial({ color: 0x150505 }), 0, 0.62, -0.2); hip.add(jaw);
    const arms = []; [-0.3, 0.3].forEach(x => { const p = new THREE.Group(); p.position.set(x, 0.55, 0); const a = box(0.11, 0.8, 0.11, flesh, 0, -0.4, 0); p.add(a); p.rotation.x = -1.1; hip.add(p); arms.push(p); });
    const legs = []; [-0.12, 0.12].forEach(x => { const p = new THREE.Group(); p.position.set(x, 0.85, 0); p.add(box(0.15, 0.85, 0.16, rag, 0, -0.42, 0)); g.add(p); legs.push(p); });
    g.userData = { hip, arms, legs };
    return g;
  };
  R3.keycard = function (color, T) {
    const g = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color });
    const card = box(0.32, 0.02, 0.2, m); card.rotation.z = 0.3; g.add(card); const stripe = box(0.33, 0.025, 0.04, new THREE.MeshBasicMaterial({ color: 0x111111 }), 0, 0, 0.05); stripe.rotation.z = 0.3; g.add(stripe);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.scale.set(1.4, 1.4, 1); g.add(glow); g.userData.glow = glow;
    return g;
  };
  R3.pickup = function (type) {
    const g = new THREE.Group();
    if (type === 'ammo') { g.add(box(0.3, 0.16, 0.18, new THREE.MeshLambertMaterial({ color: 0x3d4a2a }), 0, 0.08, 0)); g.add(box(0.31, 0.04, 0.19, new THREE.MeshLambertMaterial({ color: 0xb08a2a }), 0, 0.12, 0)); }
    else { g.add(box(0.32, 0.2, 0.22, new THREE.MeshLambertMaterial({ color: 0xd8d8d0 }), 0, 0.1, 0)); g.add(box(0.12, 0.21, 0.04, new THREE.MeshBasicMaterial({ color: 0xc01818 }), 0, 0.1, -0.1)); g.add(box(0.04, 0.21, 0.12, new THREE.MeshBasicMaterial({ color: 0xc01818 }), 0, 0.1, -0.1)); }
    return g;
  };
  R3.gun = function () {
    const g = new THREE.Group(); const metal = new THREE.MeshLambertMaterial({ color: 0x1c1d1f }); const grip = new THREE.MeshLambertMaterial({ color: 0x1a1612 });
    g.add(box(0.07, 0.09, 0.32, metal, 0, 0, -0.08)); g.add(box(0.06, 0.16, 0.08, grip, 0, -0.1, 0.03)); g.add(box(0.02, 0.025, 0.02, metal, 0, 0.055, -0.22));
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.16, 8), new THREE.MeshLambertMaterial({ color: 0x404448 })); torch.rotation.x = Math.PI / 2; torch.position.set(0, -0.06, -0.15); g.add(torch);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.024, 10), new THREE.MeshBasicMaterial({ color: 0xfff5d0 })); lens.position.set(0, -0.06, -0.232); lens.rotation.y = Math.PI; g.add(lens); g.userData.lens = lens;
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffc070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flash.scale.set(0.25, 0.25, 1); flash.position.set(0, 0.01, -0.3); flash.visible = false; g.add(flash); g.userData.flash = flash;
    g.traverse(o => { if (o.material) { o.material.depthTest = true; } o.renderOrder = 10; });
    return g;
  };
  // ---------- facility meshes ----------
  R3.buildFacility = function (F, T, mats, rng, opts) {
    const group = new THREE.Group(); const tw = F.tw, th = F.th, W = tw * TILE, H = th * TILE;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mats.floor); fl.rotation.x = -Math.PI / 2; fl.position.set(W / 2, 0, H / 2); group.add(fl);
    T.floor.repeat.set(tw, th); T.ceil.repeat.set(tw, th);
    const ce = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mats.ceil); ce.rotation.x = Math.PI / 2; ce.position.set(W / 2, WALLH, H / 2); group.add(ce);
    const open = t => t === T_FLOOR || t === T_EYE || t === T_SEALED || t === T_EXIT;
    const walls = [];
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const t = F.tile(x, y); if (t !== T_WALL && t !== T_VOID) continue;
      let vis = false; for (let dy = -1; dy <= 1 && !vis; dy++) for (let dx = -1; dx <= 1; dx++) if (open(F.tile(x + dx, y + dy)) && (x + dx >= 0 && y + dy >= 0 && x + dx < tw && y + dy < th)) { vis = true; break; }
      if (vis) walls.push([x, y]);
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, WALLH, TILE), mats.wall, walls.length); const m4 = new THREE.Matrix4();
    walls.forEach(([x, y], i) => { m4.makeTranslation(F.tw2w(x), WALLH / 2, F.tw2w(y)); im.setMatrixAt(i, m4); }); group.add(im);
    const eyeDoors = [], lamps = [], doors = [];
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const t = F.tile(x, y); if (t !== T_SEALED && t !== T_EYE) continue;
      const alongX = x % 2 === 0; // H edge: passage runs along x, panel faces x
      const m = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.3 : TILE, WALLH, alongX ? TILE : 0.3), t === T_EYE ? mats.eye : mats.door);
      m.position.set(F.tw2w(x), WALLH / 2, F.tw2w(y)); group.add(m);
      if (t === T_EYE) eyeDoors.push({ tx: x, ty: y, mesh: m, watched: true }); else doors.push(m);
    }
    // exit door in the east boundary
    const e = F.exitTile(); const ex = new THREE.Mesh(new THREE.BoxGeometry(0.3, WALLH, TILE), mats.exit); ex.position.set(e.tx * TILE + 0.15, WALLH / 2, F.tw2w(e.ty)); group.add(ex);
    const leds = []; for (let i = 0; i < 3; i++) { const l = box(0.04, 0.09, 0.09, new THREE.MeshBasicMaterial({ color: 0x550000 }), e.tx * TILE - 0.02, 1.35, F.tw2w(e.ty) + 0.75 + (i - 1) * 0.16); group.add(l); leds.push(l); }
    const exitLight = new THREE.PointLight(0xff2010, 2.5, 7, 1.6); exitLight.position.set(e.tx * TILE - 0.8, 2.6, F.tw2w(e.ty)); group.add(exitLight);
    // lamps: one per open cell + room centres
    const lampGeo = new THREE.BoxGeometry(1.3, 0.06, 0.35);
    const addLamp = (x, z, key) => { const r = rng(); const state = r < 0.66 ? 'on' : r < 0.82 ? 'flicker' : 'off'; const m = new THREE.Mesh(lampGeo, state === 'off' ? mats.lampOff : mats.lampOn); m.position.set(x, WALLH - 0.04, z); group.add(m); lamps.push({ x, z, state, mesh: m, key, ph: rng() * 10 }); };
    for (let cy = 0; cy < F.ch; cy++) for (let cx = 0; cx < F.cw; cx++) { if (F.void[cy][cx] || F.roomAt(cx, cy)) continue; const c = F.cellCenter(cx, cy); addLamp(c.x, c.z, cx + ',' + cy); }
    for (const r of F.rooms) { const c = F.roomCenter(r); addLamp(c.x - 2, c.z, 'r' + r.id); addLamp(c.x + 2, c.z, 'r' + r.id); }
    for (const f of F.fixed) { const l = lamps.find(l => l.key === f.cx + ',' + f.cy); if (!l) continue; if (f.kind === 'dark') { l.state = 'off'; l.mesh.material = mats.lampOff; } if (f.kind === 'eye') { l.state = 'flicker'; } if (f.kind === 'exit') { l.state = 'flicker'; } }
    for (const l of lamps) if (l.key === 'r0') { l.state = rng() < 0.5 ? 'on' : 'flicker'; l.mesh.material = mats.lampOn; }
    // props
    const P = mats.props;
    const startChair = {};
    for (const r of F.rooms) {
      const c = F.roomCenter(r); let s = r.id * 9973 + 17; const rr = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      if (r.kind === 'start') {
        // chair (the one you wake up in), desk with a monitor, cot, cabinets
        const ch = new THREE.Group(); ch.add(box(0.5, 0.06, 0.5, P.metal, 0, 0.46, 0)); ch.add(box(0.5, 0.55, 0.06, P.metal, 0, 0.75, 0.24));
        [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].forEach(([a, b]) => ch.add(box(0.04, 0.46, 0.04, P.metal, a, 0.23, b)));
        ch.position.set(c.x, 0, c.z + 1); ch.rotation.y = 0; group.add(ch); startChair.x = c.x; startChair.z = c.z + 1;
        group.add(box(1.6, 0.06, 0.7, P.wood, c.x + 2.6, 0.78, c.z + 3.4)); group.add(box(1.5, 0.74, 0.6, P.metal, c.x + 2.6, 0.37, c.z + 3.4));
        const mon = box(0.55, 0.4, 0.05, P.dark, c.x + 2.6, 1.05, c.z + 3.55); group.add(mon); const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), P.screen); scr.position.set(c.x + 2.6, 1.05, c.z + 3.52); scr.rotation.y = Math.PI; group.add(scr);
        group.add(box(0.9, 0.35, 2.0, P.cloth, c.x - 3.2, 0.3, c.z - 2.5)); group.add(box(0.6, 1.9, 0.5, P.metal, c.x + 3.6, 0.95, c.z - 3.6));
        // straps hanging off the chair
        group.add(box(0.04, 0.4, 0.02, P.dark, c.x - 0.27, 0.4, c.z + 0.9)); group.add(box(0.04, 0.4, 0.02, P.dark, c.x + 0.27, 0.4, c.z + 0.9));
        continue;
      }
      const n = 3 + ((rr() * 4) | 0);
      for (let i = 0; i < n; i++) {
        const x = c.x + (rr() - 0.5) * 6.5, z = c.z + (rr() - 0.5) * 6.5; const k = rr();
        if (Math.hypot(x - c.x, z - c.z) < 1.4) continue; // keep centre clear for items
        if (r.kind === 'lab' && k < 0.5) { group.add(box(1.8, 0.08, 0.8, P.metal, x, 0.9, z)); group.add(box(0.08, 0.9, 0.7, P.metal, x - 0.8, 0.45, z)); group.add(box(0.08, 0.9, 0.7, P.metal, x + 0.8, 0.45, z)); if (rr() < 0.6) group.add(box(0.2, 0.3, 0.2, P.glass, x, 1.09, z)); }
        else if (r.kind === 'storage' || k < 0.35) { const s2 = 0.6 + rr() * 0.4; const b = box(s2, s2, s2, P.crate, x, s2 / 2, z); b.rotation.y = rr(); group.add(b); if (rr() < 0.5) { const b2 = box(s2 * 0.8, s2 * 0.8, s2 * 0.8, P.crate, x, s2 + s2 * 0.4, z); b2.rotation.y = rr(); group.add(b2); } }
        else if (k < 0.7) { group.add(box(1.4, 0.06, 0.7, P.wood, x, 0.76, z)); group.add(box(0.06, 0.74, 0.6, P.metal, x - 0.6, 0.37, z)); group.add(box(0.06, 0.74, 0.6, P.metal, x + 0.6, 0.37, z)); const mon = box(0.45, 0.32, 0.05, P.dark, x, 0.98, z); group.add(mon); }
        else { const ch = box(0.45, 0.5, 0.45, P.metal, x, 0.25, z); ch.rotation.set(rr() < 0.4 ? Math.PI / 2 : 0, rr() * 3, 0); group.add(ch); }
      }
      if (rr() < 0.8) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), P.blood); b.rotation.x = -Math.PI / 2; b.rotation.z = rr() * 6; b.position.set(c.x + (rr() - 0.5) * 4, 0.01, c.z + (rr() - 0.5) * 4); group.add(b); }
    }
    // corridor clutter, blood, pipes
    for (let cy = 0; cy < F.ch; cy++) for (let cx = 0; cx < F.cw; cx++) {
      if (F.void[cy][cx] || F.roomAt(cx, cy)) continue; const c = F.cellCenter(cx, cy); const k = rng();
      if (k < 0.12) { const b = box(0.5, 0.5, 0.5, P.crate, c.x + (rng() - 0.5) * 1.6, 0.25, c.z + (rng() - 0.5) * 1.6); b.rotation.y = rng(); group.add(b); }
      else if (k < 0.2) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), P.blood); b.rotation.x = -Math.PI / 2; b.rotation.z = rng() * 6; b.position.set(c.x + (rng() - 0.5), 0.012, c.z + (rng() - 0.5)); group.add(b); }
      else if (k < 0.26) { const p = box(0.4, 0.02, 0.3, P.paper, c.x + (rng() - 0.5) * 2, 0.012, c.z + (rng() - 0.5) * 2); p.rotation.y = rng() * 3; group.add(p); }
    }
    // pipes along walls of some corridors
    for (let i = 0; i < Math.floor(F.cw * F.ch / 6); i++) {
      const cx = (rng() * F.cw) | 0, cy = (rng() * F.ch) | 0; if (F.void[cy][cx]) continue; const c = F.cellCenter(cx, cy);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, TILE * 3, 6), P.pipe); if (rng() < 0.5) { pipe.rotation.z = Math.PI / 2; pipe.position.set(c.x, WALLH - 0.25, c.z - 1.3); } else { pipe.rotation.x = Math.PI / 2; pipe.position.set(c.x + 1.3, WALLH - 0.25, c.z); } group.add(pipe);
    }
    // wall writing
    const msgs = opts.writings; let placed = 0;
    for (let t = 0; t < 400 && placed < opts.writingCount; t++) {
      const tx = (rng() * tw) | 0, ty = (rng() * th) | 0; if (F.tile(tx, ty) !== T_FLOOR) continue;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => F.tile(tx + dx, ty + dy) === T_WALL); if (!dirs.length) continue;
      const [dx, dy] = dirs[(rng() * dirs.length) | 0]; const msg = msgs[(rng() * msgs.length) | 0];
      const mat = new THREE.MeshLambertMaterial({ map: R3.writingTex(msg, rng() < 0.6 ? 'rgba(130,12,8,.9)' : 'rgba(225,222,205,.85)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), mat);
      pl.position.set(F.tw2w(tx) + dx * (TILE / 2 - 0.02), 1.5 + (rng() - 0.5) * 0.4, F.tw2w(ty) + dy * (TILE / 2 - 0.02)); pl.lookAt(F.tw2w(tx), pl.position.y, F.tw2w(ty)); group.add(pl); placed++;
    }
    return { group, eyeDoors, lamps, leds, exitMesh: ex, startChair, exitLight };
  };
})();
