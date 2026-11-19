// DEAD SIGNAL - game logic, input, UI, radio director
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouch) document.body.classList.add('touch');
  // ---------- settings ----------
  const S = Object.assign({ sens: 1, vol: 0.8, invert: false, blackout: 150, quality: isTouch ? 'low' : 'high' }, (() => { try { return JSON.parse(localStorage.getItem('deadsignal.settings') || '{}'); } catch (e) { return {}; } })());
  const saveS = () => { try { localStorage.setItem('deadsignal.settings', JSON.stringify(S)); } catch (e) { } };

  // ---------- three setup ----------
  let renderer, scene, camera, flash, ambient, muzzle, gun, TEX, MATS, frustum = new THREE.Frustum(), projView = new THREE.Matrix4();
  const lightPool = [];
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
  } catch (e) { $('err').classList.remove('hidden'); $('err').textContent = 'DEAD SIGNAL needs WebGL, and this browser could not start it. Try Chrome or Edge with hardware acceleration on.'; return; }
  renderer.setPixelRatio(S.quality === 'high' ? Math.min(devicePixelRatio, 2) : 1);
  renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace;
  $('stage').appendChild(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x020203); scene.fog = new THREE.FogExp2(0x030304, 0.085);
  camera = new THREE.PerspectiveCamera(isTouch ? 80 : 75, innerWidth / innerHeight, 0.05, 70); camera.rotation.order = 'YXZ'; scene.add(camera);
  ambient = new THREE.AmbientLight(0x8890a0, 0.1); scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0x404850, 0x100c08, 0.15); scene.add(hemi);
  flash = new THREE.SpotLight(0xfff0d0, 30, 26, 0.48, 0.55, 1.4); flash.position.set(0.15, -0.12, -0.8); camera.add(flash); const ft = new THREE.Object3D(); ft.position.set(0.05, -0.1, -5); camera.add(ft); flash.target = ft;
  const fill = new THREE.PointLight(0xfff0d0, 0.3, 1.2, 2); camera.add(fill); // tiny bounce so the gun isn't pitch black
  muzzle = new THREE.PointLight(0xffb060, 0, 9, 1.5); muzzle.position.set(0.15, -0.1, -0.6); camera.add(muzzle);
  for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffe6c0, 0, 10, 1.6); l.position.set(0, -50, 0); scene.add(l); lightPool.push(l); }
  TEX = R3.makeTextures();
  const L = (o) => new THREE.MeshLambertMaterial(o);
  MATS = {
    wall: L({ map: TEX.wall }), floor: L({ map: TEX.floor }), ceil: L({ map: TEX.ceil }), door: L({ map: TEX.door }),
    eye: L({ map: TEX.eye, emissive: 0x2a0505 }), exit: L({ map: TEX.exit, emissive: 0x200404 }),
    lampOn: new THREE.MeshBasicMaterial({ color: 0xfff1d6 }), lampOff: L({ color: 0x1e1f1c }),
    props: { metal: L({ color: 0x5b5f60 }), wood: L({ color: 0x5a4632 }), dark: L({ color: 0x18191a }), crate: L({ color: 0x6b5a3a }), cloth: L({ color: 0x55584a }), glass: L({ color: 0x6fa0a0, transparent: true, opacity: 0.5 }),
      screen: new THREE.MeshBasicMaterial({ map: TEX.screen }), blood: L({ map: TEX.blood, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), paper: L({ color: 0xbdb7a2 }), pipe: L({ color: 0x3f4a44 }) }
  };
  gun = R3.gun(); gun.scale.setScalar(0.8); gun.position.set(0.22, -0.2, -0.42); camera.add(gun);

  // ---------- state ----------
  const G = { state: 'title', loop: 1, t: 0, paused: false, manual: false, seed: null, lightLevel: 1, flick: 1 };
  let F, P, world = null, keys = [], pickups = [], husks = [], W, fig, double = null, sparks = [];
  const input = { f: 0, b: 0, l: 0, r: 0, run: false, jx: 0, jy: 0, fire: false };
  const KEYDEF = { A: { color: 0xff3030, name: 'red' }, B: { color: 0x30e0ff, name: 'cyan' }, C: { color: 0xffd030, name: 'yellow' } };
  const WRITINGS = ['IT ONLY MOVES WHEN YOU LOOK AWAY', "DON'T TRUST THE EXIT", 'WHO IS ON THE RADIO', "I'VE BEEN HERE BEFORE", 'LIGHTS OUT = IT CHANGES', 'WALK IN BACKWARDS', 'IIII IIII IIII II', 'TURN YOUR LIGHT OFF', 'LOOK AT IT', 'THE HALLS GROW', 'COUNT THE DOORS'];
  const WRITINGS2 = ["HE'S IN THE CHAIR", 'YOU AGAIN', 'LOOP', 'STOP LISTENING', 'IT REMEMBERS YOU', 'WE ALREADY LEFT'];

  function newRun(loop, seed) {
    G.loop = loop; G.t = 0; G.paused = false; G.seed = seed != null ? seed : (DS.forceSeed != null ? DS.forceSeed + loop : (Date.now() ^ (loop * 7919)) >>> 0);
    F = new Facility(G.seed);
    const st = F.roomCenter(F.rooms[0]);
    P = { x: st.x, z: st.z + 1, yaw: 0, pitch: -0.5, hp: 100, mag: 8, reserve: loop > 1 ? 12 : 16, flash: true, keys: new Set(), wake: 2.6, bob: 0, stepAcc: 0, reloadT: 0, shootCd: 0, lastProgress: 0, kick: 0, cause: '' };
    // clear entities
    [...keys, ...pickups, ...husks].forEach(e => scene.remove(e.mesh)); keys = []; pickups = []; husks = []; sparks.forEach(s => scene.remove(s.m)); sparks = [];
    if (double) { scene.remove(double); double = null; }
    // keys: A in a lab/office room, B in the dark vault, C behind the eye door
    const room = F.rooms.filter(r => r.kind !== 'start').sort((a, b) => (b.cx + b.cy) - (a.cx + a.cy))[0] || F.rooms[1];
    const rc = F.roomCenter(room); addKey('A', rc.x, rc.z, false);
    const dv = F.fixed.find(f => f.kind === 'dark'), ev = F.fixed.find(f => f.kind === 'eye');
    const dc = F.cellCenter(dv.cx, dv.cy), ec = F.cellCenter(ev.cx, ev.cy); addKey('B', dc.x, dc.z, true); addKey('C', ec.x, ec.z, false);
    // pickups
    for (const r of F.rooms) { if (r.kind === 'start') continue; const c = F.roomCenter(r); addPickup(Math.random() < 0.6 ? 'ammo' : 'med', c.x + 1.5, c.z - 1.5); }
    for (let cy = 0; cy < F.ch; cy++) for (let cx = 0; cx < F.cw; cx++) {
      if (F.roomAt(cx, cy) || F.fixedAt(cx, cy)) continue; let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (F.inb(cx + dx, cy + dy) && [1, 3].includes(F.getE(cx, cy, dx, dy))) n++;
      if (n === 1 && Math.random() < 0.45) { const c = F.cellCenter(cx, cy); addPickup(Math.random() < 0.65 ? 'ammo' : 'med', c.x, c.z); }
    }
    // the Witness
    if (!W) { W = { mesh: R3.witness() }; scene.add(W.mesh); }
    Object.assign(W, { x: -100, z: -100, phase: 'watching', away: true, awayT: loop > 1 ? 12 : 22, watched: false, inView: false, wasSeen: false, stepAcc: 0, stingCd: 0, vanishes: 0, visT: 0, seenOnce: false, touchCd: 0 }); W.mesh.visible = false;
    if (!fig) { fig = { mesh: R3.human({ eyes: true }) }; fig.light = new THREE.SpotLight(0xfff0d0, 0, 18, 0.35, 0.5, 1.5); fig.light.target = new THREE.Object3D(); scene.add(fig.mesh, fig.light, fig.light.target); }
    Object.assign(fig, { active: false, t: 0, watchT: 0 }); fig.mesh.visible = false; fig.light.intensity = 0;
    rebuildWorld();
    const nH = loop > 1 ? 6 : 4; for (let i = 0; i < nH; i++) spawnHusk(20);
    G.bo = { phase: 'none', t: 0, next: loop > 1 ? 55 : 70, count: 0, shiftedThis: false, ops: [], last: null };
    radio.reset(); G.objective = false; $('objective').classList.add('hidden');
    $('loopTag').textContent = loop > 1 ? 'LOOP ' + loop : '';
    G.flowKey = ''; G.lastShift = null; G.endingDone = false;
    G.state = 'play'; showOnly('hud'); updateHUD(true);
    $('blackfade').style.transition = 'none'; $('blackfade').style.opacity = 1; requestAnimationFrame(() => { $('blackfade').style.transition = 'opacity 2.4s'; $('blackfade').style.opacity = 0; });
  }
  function addKey(id, x, z, dark) { const m = R3.keycard(KEYDEF[id].color, TEX); m.position.set(x, 1.0, z); scene.add(m); keys.push({ id, x, z, dark, mesh: m, taken: false }); }
  function addPickup(type, x, z) { if (F.solidAt(x, z, true)) return; const m = R3.pickup(type); m.position.set(x, 0, z); scene.add(m); pickups.push({ type, x, z, mesh: m }); }
  function spawnHusk(minD) {
    for (let t = 0; t < 40; t++) {
      const c = F.randomFloorCell({ x: P.x, z: P.z }, minD); if (!c) return; if (F.roomAt(c.cx, c.cy) && F.roomAt(c.cx, c.cy).kind === 'start') continue;
      if (G.state === 'play' && inFrustum(c.x, 1, c.z, 1)) continue;
      makeHusk(c.x, c.z); return;
    }
  }
  function makeHusk(x, z) { const m = R3.husk(); m.position.set(x, 0, z); scene.add(m); const h = { x, z, hp: 3, mesh: m, alive: true, atkCd: 0, alert: false, wander: null, anim: Math.random() * 6, dieT: 0, hitT: 0, growlCd: 2 + Math.random() * 5 }; husks.push(h); return h; }
  function rebuildWorld() {
    if (world) { scene.remove(world.group); world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material.map.isCanvasTexture && o.material.transparent && o.material !== MATS.props.blood) o.material.dispose(); }); }
    const rng = mulberry((G.seed + F.shifts * 101) >>> 0);
    const writings = G.loop > 1 ? WRITINGS.concat(WRITINGS2, WRITINGS2) : WRITINGS;
    world = R3.buildFacility(F, TEX, MATS, rng, { writings, writingCount: 8 });
    scene.add(world.group); G.lampSortT = 0; G.flowKey = '';
  }

  // ---------- helpers ----------
  const camFwd = new THREE.Vector3();
  function updateCamMatrices() { camera.updateMatrixWorld(); projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projView); camera.getWorldDirection(camFwd); }
  const _sph = new THREE.Sphere();
  function inFrustum(x, y, z, r) { _sph.center.set(x, y, z); _sph.radius = r; return frustum.intersectsSphere(_sph); }
  function gazeAngle(x, y, z) { const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z; const d = Math.hypot(dx, dy, dz) || 1e-6; return { d, ang: Math.acos(clamp((dx * camFwd.x + dy * camFwd.y + dz * camFwd.z) / d, -1, 1)) * 180 / Math.PI }; }
  function eyeDoorAt(tx, ty) { return world.eyeDoors.find(d => d.tx === tx && d.ty === ty); }
  function overlapsTile(x, z, r, tx, ty) { return Math.abs(x - F.tw2w(tx)) < TILE / 2 + r && Math.abs(z - F.tw2w(ty)) < TILE / 2 + r; }
  const PR = 0.32;
  function solidPlayer(x, z) {
    const tx = F.w2t(x), tz = F.w2t(z), t = F.tile(tx, tz); if (t === T_FLOOR) return false;
    if (t === T_EYE) { const d = eyeDoorAt(tx, tz); return d ? (d.watched && !overlapsTile(P.x, P.z, PR, tx, tz)) : true; }
    return true;
  }
  const solidMonster = (x, z) => F.tile(F.w2t(x), F.w2t(z)) !== T_FLOOR;
  const hits = (x, z, r, fn) => fn(x - r, z - r) || fn(x + r, z - r) || fn(x - r, z + r) || fn(x + r, z + r);
  function moveCircle(e, dx, dz, r, fn) {
    if (hits(e.x, e.z, r, fn)) { e.x += dx; e.z += dz; return; } // already overlapping: never trap
    if (!hits(e.x + dx, e.z, r, fn)) e.x += dx; if (!hits(e.x, e.z + dz, r, fn)) e.z += dz;
  }
  function settle(e, okFn) { // move an entity to the nearest valid tile centre if a shift buried it
    const ok = okFn || (t => t === T_FLOOR); const tx = F.w2t(e.x), tz = F.w2t(e.z); if (ok(F.tile(tx, tz))) return;
    for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (ok(F.tile(tx + dx, tz + dy))) { e.x = F.tw2w(tx + dx); e.z = F.tw2w(tz + dy); return; } }
  }
  function flowAt(x, z) { const tx = F.w2t(x), tz = F.w2t(z); if (tx < 0 || tz < 0 || tx >= F.tw || tz >= F.th) return -1; return G.flow[tz * F.tw + tx]; }
  function updateFlow() { const k = F.w2t(P.x) + ',' + F.w2t(P.z) + ',' + F.version; if (k === G.flowKey) return; G.flowKey = k; G.flow = F.bfs(F.w2t(P.x), F.w2t(P.z), t => t === T_FLOOR); }
  function stepToward(e, step, r) { // follow the BFS flow field toward the player
    const here = flowAt(e.x, e.z); if (here < 0) return false; let tx = P.x, tz = P.z;
    if (here > 1) { const ex = F.w2t(e.x), ez = F.w2t(e.z); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const d = flowAt(F.tw2w(ex + dx), F.tw2w(ez + dy)); if (d >= 0 && d < here) { tx = F.tw2w(ex + dx); tz = F.tw2w(ez + dy); break; } } }
    const dx = tx - e.x, dz = tz - e.z, l = Math.hypot(dx, dz) || 1; const s = Math.min(step, l);
    moveCircle(e, dx / l * s, dz / l * s, r, solidMonster); e.face = Math.atan2(-dx, -dz); return true;
  }

  // ---------- radio ----------
  const LINES = {
    1: {
      hello: ['you', "...hello? Is this thing on. Okay. Listen to me. It's me. I know how that sounds. I'm you."],
      keys: ['you', "You're in the facility. There are three keycards. The exit door needs all three. I don't know where they are anymore."],
      moved: ['you', "Did the lights just go? Everything moves when the lights go. Doors. Halls. Rooms. Don't trust what you remember."],
      saw: ['you', "You saw it, didn't you. The tall one. It vanishes when you look right at it. It only moves when you look away."],
      dark: ['you', "One card. Good. Some things only show up in the dark. Turn your light off when you're lost."],
      eye: ['you', "That door with the eye. It only opens when nobody is watching it. Walk in backwards."],
      stop: ['other', "Stop listening to the radio."],
      notme: ['you', "That wasn't me."],
      almost: ['you', "You're almost there. Don't trust the exit."],
      exitlocked: ['you', "The exit wants all three cards. I counted. I always count."],
      idle1: ['you', "Keep moving. When the lights go out, the place rearranges. Use that. A sealed door won't stay sealed forever."],
      idle2: ['you', "The dark card glows. You won't see it with the light on. The eye door... back into it. Don't look."],
      hunt: ['other', "it's not watching anymore."],
    },
    2: {
      hello: ['you', "...it's me. Again. You won't remember this. You sat in that chair and watched yourself walk out. Now he's playing you."],
      keys: ['you', "Three cards. Same as last time. They've moved. Everything moved."],
      moved: ['you', "Lights again. Count the halls. They grow when you're not looking."],
      saw: ['you', "It remembers you. It's faster now. Look at it. Don't stop looking at it."],
      dark: ['you', "The cyan card hides from the light. It always did. Light off."],
      eye: ['you', "Eye door. Backwards. You know this."],
      stop: ['other', "Stop listening to the radio."],
      notme: ['you', "That wasn't me. ...Was it? I can't tell anymore."],
      almost: ['you', "You're almost there. Don't trust the exit. Last time I trusted the exit."],
      exitlocked: ['you', "Three. It's always three."],
      idle1: ['you', "Don't stand still. He didn't stand still."],
      idle2: ['other', "you could just stay. sit down. the chair's warm."],
      hunt: ['other', "it's looking for you now."],
    }
  };
  const radio = {
    q: [], cur: null, said: new Set(), cool: 0, log: [],
    reset() { this.q = []; this.cur = null; this.said = new Set(); this.cool = 0; this.log = []; $('radio').classList.add('hidden'); SFX.radioOn(false); },
    say(id, delay = 0, onDone) {
      if (this.said.has(id)) return; this.said.add(id); const set = LINES[Math.min(G.loop, 2)]; let [who, text] = set[id];
      if (id === 'hello' && G.loop > 2) text = `Loop ${G.loop}. ` + text;
      const item = { id, who, text, delay, onDone }; if (id === 'hello') this.q.unshift(item); else this.q.push(item);
    },
    update(dt) {
      this.cool -= dt;
      if (!this.cur) {
        if (!this.q.length) return; this.q[0].delay -= dt; if (this.q[0].delay > 0 || this.cool > 0) return;
        this.cur = this.q.shift(); Object.assign(this.cur, { t: 0, shown: 0, hold: 0 }); this.log.push(this.cur.id);
        SFX.radioBurst(); SFX.radioOn(true); $('radio').classList.remove('hidden'); $('radio').classList.toggle('other', this.cur.who === 'other');
        $('radioWho').textContent = this.cur.who === 'other' ? 'RADIO — ???' : 'RADIO — "YOU"'; return;
      }
      const c = this.cur; c.t += dt; const n = Math.min(c.text.length, Math.floor(c.t * 27));
      for (let i = c.shown; i < n; i++) if (i % 3 === 0 && c.text[i] !== ' ') SFX.syllable(c.who === 'other' ? 0.75 : 1, c.who === 'other');
      c.shown = n; const gl = c.who === 'other' ? 0.1 : 0.035; const junk = '#%&@/\\▒░█';
      let s = ''; for (let i = 0; i < n; i++) s += (c.text[i] !== ' ' && Math.random() < gl) ? junk[(Math.random() * junk.length) | 0] : c.text[i];
      $('radioText').textContent = s;
      if (n >= c.text.length) { c.hold += dt; if (c.hold > 2.0 + c.text.length * 0.022) { $('radio').classList.add('hidden'); SFX.radioOn(false); this.cur = null; this.cool = 1.2; if (c.onDone) c.onDone(); } }
    }
  };
  function radioDirector() {
    const nk = P.keys.size;
    if (G.t > 4) radio.say('hello');
    if (G.t > 15) radio.say('keys', 1);
    if (G.bo.count >= 1 && G.bo.phase === 'none') radio.say('moved', 1.5);
    if (nk >= 1) radio.say('dark', 1);
    if (nk >= 2) { radio.say('stop', 1.5); radio.say('notme', 2.0); }
    if (nk >= 3) radio.say('almost', 1, () => { G.objective = true; $('objective').classList.remove('hidden'); SFX.stinger(); });
    const ev = world.eyeDoors[0]; if (ev && Math.hypot(F.tw2w(ev.tx) - P.x, F.tw2w(ev.ty) - P.z) < 8 && F.los(P.x, P.z, F.tw2w(ev.tx), F.tw2w(ev.ty), [ev.tx, ev.ty])) radio.say('eye', 0.5);
    if (G.t - P.lastProgress > 200) radio.say('idle1'); if (G.t - P.lastProgress > 340) radio.say('idle2');
  }

  // ---------- the Witness ----------
  function placeWitnessWatching() {
    const tx = F.w2t(P.x), tz = F.w2t(P.z); const opts = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let n = 0; while (F.tile(tx + dx * (n + 1), tz + dz * (n + 1)) === T_FLOOR && n < 12) n++; if (n >= 4) { const x = F.tw2w(tx + dx * n), z = F.tw2w(tz + dz * n); if (!inFrustum(x, 1.3, z, 1.4)) opts.push({ x, z }); } }
    if (!opts.length) { W.away = true; W.awayT = 2; return; }
    const o = opts[(Math.random() * opts.length) | 0]; W.x = o.x; W.z = o.z; W.away = false; W.visT = 0;
  }
  function placeWitnessFar(minD) {
    for (let t = 0; t < 60; t++) { const c = F.randomFloorCell({ x: P.x, z: P.z }, minD); if (!c) break; if (flowAt(c.x, c.z) < 0) continue; if (inFrustum(c.x, 1.3, c.z, 1.4) && t < 40) continue; W.x = c.x; W.z = c.z; W.away = false; return; }
    W.away = true; W.awayT = 3;
  }
  function witnessSeen() { // looked at directly = near screen centre, in line of sight, and not in total darkness
    const dark = G.bo.phase === 'dark'; if (dark || W.away) return { watched: false, inView: false };
    const los = F.los(camera.position.x, camera.position.z, W.x, W.z); if (!los) return { watched: false, inView: false };
    const cone = isTouch ? 24 : 20; const a = Math.min(gazeAngle(W.x, 1.4, W.z).ang, gazeAngle(W.x, 2.4, W.z).ang); const d = Math.hypot(W.x - P.x, W.z - P.z);
    return { watched: a < cone && d < 45, inView: inFrustum(W.x, 1.4, W.z, 1.2), d };
  }
  function updateWitness(dt) {
    W.stingCd -= dt; W.touchCd -= dt;
    if (W.phase === 'watching' && (P.keys.size >= 1 || G.bo.count >= 2 || (G.loop > 1 && G.t > 45))) { W.phase = 'hunting'; W.away = true; W.awayT = 6; radio.say('hunt', 4); }
    if (W.away) { W.mesh.visible = false; W.watched = false; W.awayT -= dt; if (W.awayT <= 0) { if (W.phase === 'watching') placeWitnessWatching(); else placeWitnessFar(18); } return; }
    const s = witnessSeen(); W.watched = s.watched; W.inView = s.inView; const d = Math.hypot(W.x - P.x, W.z - P.z);
    if (s.watched) {
      if (W.mesh.visible && W.visT > 0.05) { SFX.flicker(); W.vanishes++; if (!W.seenOnce) { W.seenOnce = true; radio.say('saw', 1.5); } }
      W.mesh.visible = false; W.visT = 0;
      if (W.phase === 'watching') { W.away = true; W.awayT = 18 + Math.random() * 16; }
    } else {
      W.mesh.visible = true; W.visT += dt;
      if (W.phase === 'hunting') {
        if (W.wasSeen && !s.inView && d < 16 && W.stingCd <= 0) { SFX.stinger(); W.stingCd = 6; }
        const blackDark = G.bo.phase === 'dark';
        const speed = (2.0 + 0.3 * P.keys.size + 0.35 * (G.loop - 1)) * (s.inView ? 0.55 : 1);
        W.stepAcc += dt;
        if (W.stepAcc >= 0.16) { const step = speed * W.stepAcc; W.stepAcc = 0; if (!(blackDark && flowAt(W.x, W.z) <= 3)) stepToward(W, step, 0.28); }
        if (d < 7 && Math.random() < dt * 0.25) SFX.whisper();
      }
      if (d < 0.9 && W.touchCd <= 0 && G.bo.phase !== 'dark') { damage(45, 'THE WITNESS REACHED YOU'); SFX.stinger(); W.touchCd = 2; W.away = true; W.awayT = 6; }
    }
    W.wasSeen = s.watched || s.inView;
    W.mesh.position.set(W.x, 0, W.z); W.mesh.rotation.y = Math.atan2(-(P.x - W.x), -(P.z - W.z));
    SFX.setTension(W.phase === 'hunting' ? clamp(1 - d / 22, 0, 1) : 0);
  }

  // ---------- husks ----------
  function updateHusks(dt) {
    for (const h of husks) {
      const m = h.mesh, u = m.userData;
      if (!h.alive) { h.dieT += dt; u.hip.rotation.x = Math.min(1.5, 0.45 + h.dieT * 3); m.position.y = -Math.min(0.5, h.dieT * 0.8); if (h.dieT > 4) { scene.remove(m); h.gone = true; } continue; }
      h.atkCd -= dt; h.hitT -= dt; h.growlCd -= dt; const d = Math.hypot(P.x - h.x, P.z - h.z); const fd = flowAt(h.x, h.z);
      const sees = fd >= 0 && fd <= 10 && (fd <= 3 || F.los(h.x, h.z, P.x, P.z)) && G.bo.phase !== 'dark';
      if (sees && !h.alert) { h.alert = true; SFX.growl(clamp(0.4 - d / 50, 0.05, 0.4)); }
      if (fd < 0 || fd > 14) h.alert = false;
      let moving = false;
      if (h.hitT > 0) { /* flinch */ }
      else if (h.alert) { if (d > 0.95) { stepToward(h, (1.7 + 0.25 * (G.loop - 1)) * dt, 0.3); moving = true; } }
      else { // wander
        if (!h.wander || Math.random() < dt * 0.2) { const tx = F.w2t(h.x), tz = F.w2t(h.z); const ns = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => F.tile(tx + a, tz + b) === T_FLOOR); const n = ns[(Math.random() * ns.length) | 0]; h.wander = n ? { x: F.tw2w(tx + n[0]), z: F.tw2w(tz + n[1]) } : null; }
        if (h.wander) { const dx = h.wander.x - h.x, dz = h.wander.z - h.z, l = Math.hypot(dx, dz); if (l > 0.2) { moveCircle(h, dx / l * 0.6 * dt, dz / l * 0.6 * dt, 0.3, solidMonster); h.face = Math.atan2(-dx, -dz); moving = true; } }
      }
      if (h.alert && h.growlCd <= 0 && d < 15) { SFX.growl(clamp(0.3 - d / 60, 0.05, 0.3)); h.growlCd = 3 + Math.random() * 4; }
      if (d < 1.15 && h.atkCd <= 0 && h.alive) { h.atkCd = 1.1; damage(12, 'THE THINGS IN THE HALLS GOT YOU'); }
      h.anim += dt * (moving ? 6 : 1.5); u.legs[0].rotation.x = Math.sin(h.anim) * 0.5; u.legs[1].rotation.x = -Math.sin(h.anim) * 0.5; u.arms.forEach((a, i) => a.rotation.x = -1.1 + Math.sin(h.anim * 0.7 + i) * 0.25);
      m.position.set(h.x, 0, h.z); if (h.face != null) m.rotation.y = h.face; if (h.alert) m.rotation.y = Math.atan2(-(P.x - h.x), -(P.z - h.z));
      m.traverse(o => { if (o.material && o.material.emissive) o.material.emissive.setHex(h.hitT > 0 ? 0x550000 : 0x000000); });
    }
    husks = husks.filter(h => !h.gone);
  }

  // ---------- blackout & facility shifts ----------
  function startBlackout() { G.bo.phase = 'flicker'; G.bo.t = 0; G.bo.shiftedThis = false; G.bo.flashBefore = P.flash; }
  function applyShift(forceOps) {
    const bo = G.bo; let ops = forceOps;
    if (!ops) {
      if (bo.count === 0) ops = ['hall', 'door', 'figure'];
      else { const pool = ['hall', 'room', 'door', 'ammo', 'figure']; ops = []; while (ops.length < 3) { const o = pool[(Math.random() * pool.length) | 0]; if (!ops.includes(o)) ops.push(o); } if (!ops.includes('hall') && !ops.includes('room')) ops[0] = Math.random() < 0.5 ? 'hall' : 'room'; }
    }
    const res = { ops, done: [] };
    F.setProtected(P.x, P.z, 1);
    const ents = () => [P, W, fig, ...keys, ...pickups, ...husks];
    if (ops.includes('hall')) { const r = F.lengthenHall(P.x, P.z, P.yaw); if (r) { res.done.push('hall'); res.hall = r; for (const e of ents()) { if (r.axis === 'z' && e.z >= r.from) e.z += r.by; if (r.axis === 'x' && e.x >= r.from) e.x += r.by; } F.setProtected(P.x, P.z, 1); } }
    if (ops.includes('room')) { const r = F.moveRoom(); if (r) { res.done.push('room'); res.room = r; for (const e of ents()) { if (e === P) continue; if (e.x >= r.x0 && e.x < r.x1 && e.z >= r.z0 && e.z < r.z1) { e.x += r.dx; e.z += r.dz; } } } }
    F.reroute(); F.shifts++;
    if (ops.includes('door')) { const d = F.openSealedDoor(P.x, P.z); if (d) { res.done.push('door'); res.door = d; } }
    F.build(); rebuildWorld(); updateFlow();
    settle(P, t => t === T_FLOOR || t === T_EYE);
    for (const e of [...keys, ...pickups, ...husks]) settle(e);
    if (!W.away) settle(W);
    keys.forEach(k => k.mesh.position.set(k.x, 1.0, k.z)); pickups.forEach(p => p.mesh.position.set(p.x, 0, p.z));
    if (ops.includes('ammo')) { const deltas = [-5, -3, -2, 3, 4, 6]; const dd = deltas[(Math.random() * deltas.length) | 0]; P.reserve = Math.max(0, P.reserve + dd); P.mag = clamp(P.mag + ((Math.random() * 5) | 0) - 2, 0, 8); res.done.push('ammo'); res.ammo = dd; G.ammoGlitch = 2.5; }
    if (ops.includes('figure')) { const c = F.corridorEnd(P.x, P.z, P.yaw); if (c) { fig.active = true; fig.x = c.x; fig.z = c.z; fig.t = 0; fig.watchT = 0; res.done.push('figure'); } }
    if (W.phase === 'hunting' && !W.away && flowAt(W.x, W.z) < 0) placeWitnessFar(14);
    while (husks.filter(h => h.alive).length < (G.loop > 1 ? 6 : 4)) { const n = husks.length; spawnHusk(16); if (husks.length === n) break; }
    bo.count++; bo.last = res; G.lastShift = res; return res;
  }
  function updateBlackout(dt) {
    const bo = G.bo; bo.t += dt;
    if (bo.phase === 'none') { G.lightLevel = 1; if (G.t >= bo.next) startBlackout(); return; }
    if (bo.phase === 'flicker') { G.lightLevel = Math.random() < 0.5 - bo.t * 0.25 ? 1 : 0.05; if (Math.random() < dt * 8) SFX.flicker(); if (bo.t > 1.6) { bo.phase = 'dark'; bo.t = 0; SFX.powerDown(); } }
    else if (bo.phase === 'dark') { G.lightLevel = 0; if (!bo.shiftedThis && bo.t > 0.7) { bo.shiftedThis = true; applyShift(); } if (Math.floor(bo.t / 0.8) !== Math.floor((bo.t - dt) / 0.8)) SFX.heartbeat(); if (bo.t > 3.4) { bo.phase = 'restore'; bo.t = 0; SFX.powerUp(); } }
    else if (bo.phase === 'restore') { G.lightLevel = bo.t < 1.2 ? (Math.random() < bo.t / 1.2 ? 1 : 0.1) : 1; if (bo.t > 1.4) { bo.phase = 'none'; bo.t = 0; const iv = S.blackout * (G.loop > 1 ? 0.85 : 1); bo.next = G.t + iv * (0.85 + Math.random() * 0.3); } }
  }
  function scheduleSoonBlackout(sec) { if (G.bo.phase === 'none' && G.bo.next > G.t + sec) G.bo.next = G.t + sec; }

  // ---------- figure at the end of the corridor ----------
  function updateFigure(dt) {
    if (!fig.active) { fig.mesh.visible = false; fig.light.intensity = 0; return; }
    fig.t += dt; const d = Math.hypot(fig.x - P.x, fig.z - P.z);
    fig.mesh.visible = G.bo.phase !== 'dark'; fig.mesh.position.set(fig.x, 0, fig.z); fig.mesh.rotation.y = Math.atan2(-(P.x - fig.x), -(P.z - fig.z));
    fig.light.position.set(fig.x, 1.2, fig.z); fig.light.target.position.set(P.x, 1.2, P.z); fig.light.intensity = fig.mesh.visible ? 12 : 0;
    const g = gazeAngle(fig.x, 1.5, fig.z); if (g.ang < 15 && F.los(P.x, P.z, fig.x, fig.z)) fig.watchT += dt;
    if (d < 7 || fig.watchT > 2.2 || fig.t > 45) vanishFigure();
  }
  function vanishFigure() { if (!fig.active) return; fig.active = false; SFX.whisper(); SFX.flicker(); }

  // ---------- player ----------
  function damage(n, cause) {
    if (G.state !== 'play') return; P.hp -= n; P.cause = cause; SFX.hurt(); G.hurt = 1;
    if (P.hp <= 0) { P.hp = 0; die(); }
  }
  function die() { G.state = 'dead'; $('deadWhy').textContent = P.cause || ''; exitLock(); showOnly('dead'); SFX.radioOn(false); SFX.setTension(0); }
  function shoot() {
    if (G.state !== 'play' || G.paused || P.reloadT > 0 || P.shootCd > 0 || P.wake > 0.6) return;
    if (P.mag <= 0) { SFX.empty(); P.shootCd = 0.25; if (P.reserve > 0) reload(); return; }
    P.mag--; P.shootCd = 0.3; P.kick = 1; SFX.shot(); G.muzzleT = 0.06;
    updateCamMatrices(); const o = camera.position, dvec = camFwd;
    // wall / floor / ceiling distance
    const hl = Math.hypot(dvec.x, dvec.z); let tWall = hl > 1e-4 ? F.rayWall(o.x, o.z, dvec.x, dvec.z, 60) / hl : 99;
    if (dvec.y < -1e-4) tWall = Math.min(tWall, o.y / -dvec.y); if (dvec.y > 1e-4) tWall = Math.min(tWall, (WALLH - o.y) / dvec.y);
    let best = null, bt = tWall;
    const sphereHit = (cx, cy, cz, r) => { const lx = cx - o.x, ly = cy - o.y, lz = cz - o.z; const tc = lx * dvec.x + ly * dvec.y + lz * dvec.z; if (tc < 0) return -1; const d2 = lx * lx + ly * ly + lz * lz - tc * tc; if (d2 > r * r) return -1; return tc - Math.sqrt(r * r - d2); };
    for (const h of husks) { if (!h.alive) continue; const tb = sphereHit(h.x, 1.0, h.z, 0.45), th = sphereHit(h.x - Math.sin(h.mesh.rotation.y) * 0.3, 1.45, h.z - Math.cos(h.mesh.rotation.y) * 0.3, 0.26);
      for (const [t, head] of [[tb, false], [th, true]]) if (t > 0 && t < bt) { bt = t; best = { h, head }; } }
    if (fig.active) { const t = sphereHit(fig.x, 1.2, fig.z, 0.5); if (t > 0 && t < bt) { bt = t; best = { fig: true }; } }
    if (best && best.h) { const h = best.h; h.hp -= best.head ? 2 : 1; h.hitT = 0.25; h.alert = true; SFX.hit(); const dx = h.x - P.x, dz = h.z - P.z, l = Math.hypot(dx, dz) || 1; moveCircle(h, dx / l * 0.3, dz / l * 0.3, 0.3, solidMonster);
      if (h.hp <= 0) { h.alive = false; SFX.enemyDie(); if (Math.random() < 0.45) addPickup('ammo', h.x, h.z); } }
    else if (best && best.fig) vanishFigure();
    const p = new THREE.Vector3().copy(o).addScaledVector(dvec, bt - 0.05); spark(p);
    // gunshots draw attention
    for (const h of husks) if (h.alive && Math.hypot(h.x - P.x, h.z - P.z) < 14) h.alert = true;
  }
  function spark(p) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffcc88, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.set(0.3, 0.3, 1); m.position.copy(p); scene.add(m); sparks.push({ m, t: 0 }); }
  function reload() { if (P.reloadT > 0 || P.mag >= 8 || P.reserve <= 0) return; P.reloadT = 1.3; SFX.reload(); }
  function toggleFlash() { if (G.state !== 'play' || G.paused) return; P.flash = !P.flash; SFX.click(); }
  function interact() {
    if (G.state !== 'play' || G.paused) return; const ex = exitInfo();
    if (ex.near) { if (P.keys.size >= 3) startEnding(); else { SFX.denied(); G.ledBlink = 1; radio.say('exitlocked', 0.3); } }
  }
  function exitInfo() { const e = F.exitTile(); const x = e.tx * TILE - TILE / 2, z = F.tw2w(e.ty); const d = Math.hypot(P.x - x, P.z - z); return { x, z, d, near: d < 1.9 }; }
  function updatePlayer(dt) {
    if (P.wake > 0) { P.wake -= dt; const k = clamp(P.wake / 2.6, 0, 1); P.pitch = P.pitch * (1 - dt * 2) + (-0.5 * k) * dt * 2; }
    let mf = input.f - input.b + (-input.jy), ms = input.r - input.l + input.jx; const ml = Math.hypot(mf, ms); if (ml > 1) { mf /= ml; ms /= ml; }
    if (P.wake > 1.2) { mf = 0; ms = 0; }
    const run = input.run && mf > 0.3; const sp = run ? 5.0 : 3.1;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const dx = (fx * mf + rx * ms) * sp * dt, dz = (fz * mf + rz * ms) * sp * dt; const ox = P.x, oz = P.z;
    moveCircle(P, dx, dz, PR, solidPlayer);
    const moved = Math.hypot(P.x - ox, P.z - oz); P.bob += moved * (run ? 2.6 : 2.9); P.stepAcc += moved;
    if (P.stepAcc > (run ? 2.3 : 1.9)) { P.stepAcc = 0; SFX.step(run); }
    P.shootCd -= dt; if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) { const n = Math.min(8 - P.mag, P.reserve); P.mag += n; P.reserve -= n; } }
    if (input.fire && isTouch) shoot();
    // pickups
    for (const k of keys) { if (k.taken) continue; const d = Math.hypot(k.x - P.x, k.z - P.z); const vis = !k.dark || !P.flash || G.lightLevel < 0.2 && !flashOn();
      if (d < 1.3 && vis) { k.taken = true; P.keys.add(k.id); scene.remove(k.mesh); SFX.key(); P.lastProgress = G.t; if (P.keys.size < 3) scheduleSoonBlackout(8); } }
    for (const p of pickups) { if (p.taken) continue; if (Math.hypot(p.x - P.x, p.z - P.z) < 1.0) { if (p.type === 'med' && P.hp >= 100) continue; p.taken = true; scene.remove(p.mesh); SFX.pickup(); if (p.type === 'ammo') P.reserve += 8; else P.hp = Math.min(100, P.hp + 35); } }
    pickups = pickups.filter(p => !p.taken);
    syncCamera(dt); updateCamMatrices();
    // eye doors: solid + visible only while watched
    for (const d of world.eyeDoors) { const x = F.tw2w(d.tx), z = F.tw2w(d.ty); const vis = inFrustum(x, WALLH / 2, z, 1.6) && F.los(camera.position.x, camera.position.z, x, z, [d.tx, d.ty]) && Math.hypot(x - P.x, z - P.z) < 30; d.watched = vis || overlapsTile(P.x, P.z, PR, d.tx, d.ty) && false; d.mesh.visible = d.watched; }
    const ex = exitInfo(); const pr = $('prompt');
    if (ex.near) { pr.classList.remove('hidden'); pr.textContent = P.keys.size >= 3 ? (isTouch ? 'USE — OPEN' : '[E] OPEN') : `LOCKED  ${P.keys.size}/3`; } else pr.classList.add('hidden');
  }
  const flashOn = () => P.flash && G.bo.phase !== 'dark' && !(G.bo.phase === 'flicker' && Math.random() < 0.5);

  function syncCamera(dt) {
    const wakeK = clamp(P.wake / 2.6, 0, 1); const eye = 1.62 - wakeK * 0.55;
    camera.position.set(P.x, eye + Math.sin(P.bob) * 0.045, P.z);
    P.kick = Math.max(0, P.kick - (dt || 0) * 8);
    camera.rotation.set(P.pitch + P.kick * 0.035, P.yaw, Math.sin(P.bob * 0.5) * 0.006 + (G.hurt || 0) * 0.02 * Math.sin(G.t * 40));
    gun.position.set(0.22 + Math.cos(P.bob * 0.5) * 0.012, -0.2 + Math.abs(Math.sin(P.bob * 0.5)) * 0.012 - (P.reloadT > 0 ? 0.12 * Math.sin(Math.PI * clamp(1 - P.reloadT / 1.3, 0, 1)) : 0), -0.42 + P.kick * 0.06);
    gun.rotation.x = P.kick * 0.15 + (P.reloadT > 0 ? 0.6 * Math.sin(Math.PI * clamp(1 - P.reloadT / 1.3, 0, 1)) : 0);
  }
  // ---------- lighting ----------
  function updateLights(dt) {
    const lv = G.lightLevel; const nPool = S.quality === 'high' ? 6 : 3;
    ambient.intensity = 0.01 + 0.035 * lv; hemi.intensity = 0.01 + 0.05 * lv;
    G.lampSortT -= dt;
    if (G.lampSortT <= 0) { G.lampSortT = 0.25; G.near = world.lamps.filter(l => l.state !== 'off').map(l => [Math.hypot(l.x - P.x, l.z - P.z), l]).filter(a => a[0] < 20).sort((a, b) => a[0] - b[0]).slice(0, nPool).map(a => a[1]); }
    for (const l of world.lamps) { let on = l.state === 'on' ? 1 : l.state === 'flicker' ? (Math.sin(G.t * 23 + l.ph) + Math.sin(G.t * 7.3 + l.ph * 3) > 0.6 ? 0.15 : 1) : 0; l.cur = on * lv; const m = l.cur > 0.5 ? MATS.lampOn : MATS.lampOff; if (l.mesh.material !== m) l.mesh.material = m; }
    lightPool.forEach((pl, i) => { const l = (G.near || [])[i]; if (!l || i >= nPool) { pl.intensity = 0; pl.position.y = -50; return; } pl.position.set(l.x, WALLH - 0.4, l.z); pl.intensity = 4 * l.cur; });
    const fon = flashOn(); const jitter = Math.random() < 0.004 ? 0.2 : 1; flash.intensity = fon ? 20 * jitter : 0; gun.userData.lens.material.color.setHex(fon ? 0xfff5d0 : 0x222222);
    fill.intensity = 0.15 + 0.15 * lv;
    G.muzzleT = (G.muzzleT || 0) - dt; muzzle.intensity = G.muzzleT > 0 ? 25 : 0; gun.userData.flash.visible = G.muzzleT > 0; if (G.muzzleT > 0) gun.userData.flash.material.rotation = Math.random() * 6;
    scene.fog.density = 0.075 + (1 - lv) * 0.04;
    SFX.setLights(lv);
    // exit LEDs
    if (world.leds) { G.ledBlink = Math.max(0, (G.ledBlink || 0) - dt); world.leds.forEach((l, i) => l.material.color.setHex(i < P.keys.size ? 0x20ff40 : (G.ledBlink > 0 && Math.sin(G.t * 30) > 0 ? 0xff2020 : 0x550000))); world.exitLight.intensity = 2.5 * (0.4 + 0.6 * lv) * (G.objective ? 1.6 : 1); }
  }
  // ---------- HUD ----------
  function updateHUD(force) {
    $('mag').textContent = G.ammoGlitch > 0 && Math.random() < 0.5 ? '?' : P.mag; $('reserve').textContent = G.ammoGlitch > 0 && Math.random() < 0.5 ? '??' : P.reserve;
    $('reloadTxt').classList.toggle('hidden', !(P.reloadT > 0));
    $('hpfill').style.width = P.hp + '%'; $('hpfill').style.background = P.hp < 35 ? '#b33' : '#a9b89a';
    document.querySelectorAll('#keys .k').forEach(e => e.classList.toggle('got', P.keys.has(e.dataset.k)));
    $('hurt').style.opacity = clamp((G.hurt || 0) * 0.9 + (P.hp < 35 ? 0.25 + 0.1 * Math.sin(G.t * 5) : 0), 0, 1);
    $('tLight').classList.toggle('on', P.flash); $('tRun').classList.toggle('on', input.run);
  }
  // ---------- ending ----------
  const END = [[2.6, 'The door opens.'], [5.6, "You're back in the room you woke up in."], [9.0, 'Someone is sitting in your chair.'], [12.4, "He's wearing your clothes. Your flashlight is in his lap."], [15.8, 'He opens his eyes.']];
  function startEnding() {
    G.state = 'ending'; G.end = { t: 0, stage: 0, cap: -1 }; exitLock(); SFX.door(); SFX.radioOn(false); SFX.setTension(0);
    $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('blackfade').style.transition = 'opacity 1.2s'; $('blackfade').style.opacity = 1;
    $('radio').classList.add('hidden'); radio.q = []; radio.cur = null;
  }
  function updateEnding(dt) {
    const E = G.end; E.t += dt; const el = $('endText');
    if (E.stage === 0 && E.t > 1.4) {
      E.stage = 1; showOnly('ending'); $('hud').classList.add('hidden'); el.className = ''; el.textContent = '';
      const ch = world.startChair; double = R3.human({ sitting: true, eyes: false }); double.position.set(ch.x, 0, ch.z); scene.add(double);
      W.mesh.visible = false; W.away = true; fig.active = false; fig.mesh.visible = false; fig.light.intensity = 0; husks.forEach(h => h.mesh.visible = false); keys.forEach(k => k.mesh.visible = false);
      P.x = ch.x; P.z = ch.z - 3.4; P.yaw = Math.PI; P.pitch = -0.12; P.wake = 0; P.bob = 0; P.flash = true; G.lightLevel = 1; G.bo.phase = 'none';
      $('blackfade').style.transition = 'opacity 2s'; $('blackfade').style.opacity = 0; SFX.ending();
    }
    if (E.stage >= 1 && E.stage < 3) {
      const ch = world.startChair; P.z = Math.min(ch.z - 1.6, ch.z - 3.4 + E.t * 0.09); P.yaw = Math.PI + Math.sin(E.t * 0.4) * 0.02; syncCamera(dt); updateLights(dt);
      for (let i = END.length - 1; i >= 0; i--) if (E.t > END[i][0]) { if (E.cap !== i) { E.cap = i; el.textContent = END[i][1]; SFX.radioBurst(); } break; }
      if (E.stage === 1 && E.t > 16.3) { E.stage = 2; double.userData.eyes.visible = true; double.userData.head.rotation.x = -0.15; SFX.stinger(); G.lightLevel = 1; }
      if (E.stage === 2) { G.lightLevel = Math.random() < 0.9 ? 1 : 0; }
      if (E.stage === 2 && E.t > 19.5) { E.stage = 3; $('blackfade').style.transition = 'opacity .15s'; $('blackfade').style.opacity = 1; SFX.powerDown(); }
    }
    if (E.stage === 3 && E.t > 20.5) { E.stage = 4; el.textContent = 'He wakes up inside an abandoned research facility.'; SFX.radioBurst(); }
    if (E.stage === 4 && E.t > 24) { E.stage = 5; el.textContent = 'And now he is playing you.'; SFX.stinger(); }
    if (E.stage === 5 && E.t > 27.5) { E.stage = 6; el.className = 'big'; el.textContent = 'LOOP ' + (G.loop + 1); $('endContinue').classList.remove('hidden'); G.endingDone = true; }
  }
  // ---------- main update ----------
  function update(dt) {
    if (G.state === 'ending') { updateEnding(dt); return; }
    if (G.state !== 'play' || G.paused) return;
    G.t += dt; G.hurt = Math.max(0, (G.hurt || 0) - dt * 1.5); G.ammoGlitch = Math.max(0, (G.ammoGlitch || 0) - dt);
    updateBlackout(dt); updateFlow(); updatePlayer(dt);
    updateWitness(dt); updateHusks(dt); updateFigure(dt);
    for (const k of keys) { if (k.taken) continue; k.mesh.rotation.y += dt * 1.5; k.mesh.position.y = 1.0 + Math.sin(G.t * 2 + k.x) * 0.05; const vis = !k.dark || !flashOn(); k.mesh.visible = vis; }
    for (const p of pickups) p.mesh.rotation.y += dt * 0.6;
    for (const s of sparks) { s.t += dt; s.m.material.opacity = 1 - s.t / 0.25; if (s.t > 0.25) { scene.remove(s.m); s.m.material.dispose(); s.dead = true; } } sparks = sparks.filter(s => !s.dead);
    radioDirector(); radio.update(dt); updateLights(dt);
    // heartbeat when hurt or the Witness is close
    G.hbT = (G.hbT || 0) - dt; const wd = W.away ? 99 : Math.hypot(W.x - P.x, W.z - P.z);
    if ((P.hp < 35 || (W.phase === 'hunting' && wd < 9)) && G.hbT <= 0) { SFX.heartbeat(); G.hbT = wd < 5 ? 0.55 : 0.9; }
    updateHUD();
  }
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!G.manual) update(dt);
    if (G.state === 'play' || G.state === 'ending' || G.state === 'dead' || G.paused) renderer.render(scene, camera);
    else if (G.state === 'title') renderTitle(now / 1000);
  }
  function renderTitle(t) { // slow drift through an idle facility behind the title
    if (!F) return; P.yaw = t * 0.05; P.pitch = -0.05; syncCamera(0); G.lightLevel = Math.sin(t * 7) + Math.sin(t * 2.1) > 1.6 ? 0.1 : 1; updateLights(0.016); renderer.render(scene, camera);
  }
  // ---------- UI ----------
  const screens = ['title', 'pause', 'settings', 'dead', 'ending'];
  function showOnly(which) {
    screens.forEach(s => $(s).classList.toggle('hidden', s !== which));
    const playing = which === 'hud'; $('hud').classList.toggle('hidden', !(playing || which === 'pause' || which === 'settings') || G.state !== 'play');
    $('touch').classList.toggle('hidden', !(playing && isTouch)); if (which !== 'ending') $('endContinue').classList.add('hidden');
  }
  function lock() { if (isTouch) return; try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
  function exitLock() { G.ignoreUnlock = true; if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => G.ignoreUnlock = false, 100); }
  function pause() { if (G.state !== 'play' || G.paused) return; G.paused = true; exitLock(); showOnly('pause'); SFX.radioOn(false); }
  function resume() { G.paused = false; showOnly('hud'); lock(); if (radio.cur) SFX.radioOn(true); }
  function goFull() { if (!isTouch) return; const d = document.documentElement; try { (d.requestFullscreen || d.webkitRequestFullscreen).call(d).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { }); } catch (e) { } }
  $('startBtn').onclick = () => { SFX.init(); SFX.setVolume(S.vol); goFull(); newRun(1); lock(); };
  $('retryBtn').onclick = () => { SFX.init(); newRun(G.loop); lock(); };
  $('deadTitleBtn').onclick = toTitle; $('quitBtn').onclick = toTitle;
  $('resumeBtn').onclick = resume; $('pauseBtn').onclick = pause;
  $('endContinue').onclick = () => { newRun(G.loop + 1); lock(); };
  let settingsFrom = 'title';
  $('titleSettingsBtn').onclick = () => { settingsFrom = 'title'; openSettings(); }; $('pauseSettingsBtn').onclick = () => { settingsFrom = 'pause'; openSettings(); };
  $('settingsBack').onclick = () => { showOnly(settingsFrom); };
  function toTitle() { G.state = 'title'; G.paused = false; exitLock(); showOnly('title'); $('hud').classList.add('hidden'); SFX.radioOn(false); SFX.setTension(0); }
  function openSettings() {
    showOnly('settings'); const sync = () => { $('sSensV').textContent = (+S.sens).toFixed(2); $('sVolV').textContent = Math.round(S.vol * 100) + '%'; };
    $('sSens').value = S.sens; $('sVol').value = S.vol; $('sInv').checked = S.invert; $('sBlack').value = String(S.blackout); $('sQual').value = S.quality; sync();
    $('sSens').oninput = e => { S.sens = +e.target.value; sync(); saveS(); }; $('sVol').oninput = e => { S.vol = +e.target.value; SFX.setVolume(S.vol); sync(); saveS(); };
    $('sInv').onchange = e => { S.invert = e.target.checked; saveS(); }; $('sBlack').onchange = e => { S.blackout = +e.target.value; saveS(); };
    $('sQual').onchange = e => { S.quality = e.target.value; renderer.setPixelRatio(S.quality === 'high' ? Math.min(devicePixelRatio, 2) : 1); saveS(); };
  }
  // keyboard / mouse
  const keymap = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  addEventListener('keydown', e => {
    if (keymap[e.code]) { input[keymap[e.code]] = 1; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = true;
    if (e.repeat) return;
    if (e.code === 'KeyF') toggleFlash(); if (e.code === 'KeyR') reload(); if (e.code === 'KeyE') interact();
    if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') { G.paused ? resume() : pause(); } }
    if (e.code === 'Enter' && G.state === 'title' && !$('title').classList.contains('hidden')) $('startBtn').click();
  });
  addEventListener('keyup', e => { if (keymap[e.code]) input[keymap[e.code]] = 0; if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = false; });
  addEventListener('blur', () => { input.f = input.b = input.l = input.r = 0; input.run = false; });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && G.state === 'play' && !G.paused && !G.ignoreUnlock && !isTouch) pause(); });
  addEventListener('mousemove', e => { if (document.pointerLockElement !== renderer.domElement || G.state !== 'play' || G.paused) return; look(e.movementX * 0.0022, e.movementY * 0.0022); });
  renderer.domElement.addEventListener('mousedown', e => { if (G.state !== 'play' || G.paused || isTouch) return; if (document.pointerLockElement !== renderer.domElement) { lock(); return; } if (e.button === 0) shoot(); });
  function look(dx, dy) { if (P.wake > 1.2) return; P.yaw -= dx * S.sens; P.pitch -= dy * S.sens * (S.invert ? -1 : 1); P.pitch = clamp(P.pitch, -1.45, 1.45); }
  // touch
  (function touch() {
    const jz = $('joyZone'), knob = $('joyKnob'), base = $('joyBase'); let jid = null, jc = null; const lookIds = new Map();
    jz.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; jid = t.identifier; const r = base.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; moveJ(t); }, { passive: false });
    const moveJ = t => { const dx = t.clientX - jc.x, dy = t.clientY - jc.y, l = Math.hypot(dx, dy), m = 55, k = Math.min(1, l / m); const nx = l ? dx / l * k : 0, ny = l ? dy / l * k : 0; input.jx = Math.abs(nx) < 0.12 ? 0 : nx; input.jy = Math.abs(ny) < 0.12 ? 0 : ny; knob.style.transform = `translate(${nx * m}px,${ny * m}px)`; input.run = input.run || false; };
    jz.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === jid) moveJ(t); }, { passive: false });
    const endJ = e => { for (const t of e.changedTouches) if (t.identifier === jid) { jid = null; input.jx = input.jy = 0; knob.style.transform = ''; } };
    jz.addEventListener('touchend', endJ); jz.addEventListener('touchcancel', endJ);
    const lz = $('lookZone');
    lz.addEventListener('touchstart', e => { e.preventDefault(); for (const t of e.changedTouches) lookIds.set(t.identifier, { x: t.clientX, y: t.clientY }); }, { passive: false });
    lz.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) { const p = lookIds.get(t.identifier); if (!p) continue; if (G.state === 'play' && !G.paused) look((t.clientX - p.x) * 0.0055, (t.clientY - p.y) * 0.0055); p.x = t.clientX; p.y = t.clientY; } }, { passive: false });
    const endL = e => { for (const t of e.changedTouches) lookIds.delete(t.identifier); }; lz.addEventListener('touchend', endL); lz.addEventListener('touchcancel', endL);
    const btn = (id, down, up) => { const b = $(id); b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false }); if (up) { b.addEventListener('touchend', e => { e.preventDefault(); up(); }); b.addEventListener('touchcancel', up); } b.addEventListener('click', e => { if (!('ontouchstart' in window)) down(); }); };
    btn('tFire', () => { input.fire = true; shoot(); }, () => { input.fire = false; });
    btn('tLight', toggleFlash); btn('tUse', interact); btn('tReload', reload); btn('tRun', () => { input.run = !input.run; });
  })();
  function onResize() {
    renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    $('rotate').classList.toggle('hidden', !(isTouch && innerHeight > innerWidth));
  }
  addEventListener('resize', onResize); addEventListener('orientationchange', () => setTimeout(onResize, 200)); onResize();
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // ---------- boot: an idle facility behind the title ----------
  F = new Facility(12345); P = { x: F.tw2w(1) + 1, z: F.tw2w(1) + 1, yaw: 0, pitch: 0, wake: 0, bob: 0, kick: 0, reloadT: 0, keys: new Set(), flash: true, mag: 8, reserve: 16, hp: 100 };
  G.seed = 12345; G.bo = { phase: 'none' }; rebuildWorld();
  W = { mesh: R3.witness() }; W.mesh.visible = false; scene.add(W.mesh);
  showOnly('title'); requestAnimationFrame(frame);

  // ---------- test / debug API ----------
  const DS = window.DS = {
    G, S, get F() { return F; }, get P() { return P; }, get W() { return W; }, get keys() { return keys; }, get husks() { return husks; }, get pickups() { return pickups; }, get fig() { return fig; }, get world() { return world; }, radio,
    forceSeed: null, start(loop = 1, seed) { SFX.init(); newRun(loop, seed); }, setManual(v) { G.manual = v; },
    step(dt = 1 / 60, n = 1, each) { for (let i = 0; i < n; i++) { if (each) each(); update(dt); } renderer.render(scene, camera); },
    shift(ops) { return applyShift(ops); }, blackoutNow() { G.bo.next = G.t; },
    face(x, y, z) { const dx = x - P.x, dz = z - P.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(y - camera.position.y, Math.hypot(dx, dz)); syncCamera(0); updateCamMatrices(); },
    faceAway(x, z) { const dx = x - P.x, dz = z - P.z; P.yaw = Math.atan2(dx, dz); P.pitch = 0; syncCamera(0); updateCamMatrices(); },
    teleport(x, z) { P.x = x; P.z = z; P.wake = 0; syncCamera(0); updateCamMatrices(); updateFlow(); },
    witnessSeen() { syncCamera(0); updateCamMatrices(); return witnessSeen(); },
    setWitness(x, z, phase) { W.x = x; W.z = z; W.away = false; W.phase = phase || W.phase; W.mesh.visible = true; W.visT = 0; },
    exitInfo, interact, shoot, reload, toggleFlash, flowAt, damage, input, pause, resume,
    giveKey(id) { const k = keys.find(k => k.id === id); if (k && !k.taken) { k.taken = true; P.keys.add(id); scene.remove(k.mesh); } },
    reachable(x, z) { return F.reachable(P.x, P.z, x, z); }, makeHusk,
  };
})();
