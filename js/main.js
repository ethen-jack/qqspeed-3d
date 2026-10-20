import * as THREE from 'three';
import { buildTrack } from './track.js';
import { buildProps } from './props.js';
import { buildScenery } from './scenery.js';
import { buildKart } from './kart.js';
import { Racer, aiDrive, BASE_MAX } from './racer.js';
import { Particles, SkidMarks } from './fx.js';
import { Sfx } from './audio.js';

const el = (id) => document.getElementById(id), hide = (id) => el(id).classList.add('hidden'), show = (id) => el(id).classList.remove('hidden');
const qs = (s, r = document) => r.querySelector(s), qsa = (s, r = document) => [...r.querySelectorAll(s)];

// —— 主程序 ——
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xa8d8ff, 400, 1400);
const camera = new THREE.PerspectiveCamera(70, 1, .5, 2500); let camMode = 0;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const resize = () => { const w = window.innerWidth, h = window.innerHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); };
window.addEventListener('resize', resize); resize();
el('app').appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, .42));
const sun = new THREE.DirectionalLight(0xffffff, 1.08); sun.position.set(-180, 320, -200);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0005;
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 700 }); sun.shadow.camera.updateProjectionMatrix();
const SUN_OFF = new THREE.Vector3(-180, 320, -200); scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xbfe6ff, 0x5a8a3a, .35));

const track = buildTrack(scene);
const { pads, update: propsUpdate } = buildProps(scene, track);
const { update: sceneryUpdate } = buildScenery(scene, track);
const part = new Particles(scene), skid = new SkidMarks(scene), sfx = new Sfx();

let state = 'MENU', racers = [], player = null;
let start0 = 0, cnt = 3;
const laps = 3;

const startRace = (withAI) => {
  racers = [];
  const colors = [[0xff3030, 0xffffff], [0x3030ff, 0xffcc00], [0x00cc33, 0x111111], [0xff40ff, 0xee9900]];
  const kartP = buildKart(...colors[0]); scene.add(kartP);
  player = new Racer(kartP, track, 'Player'); racers.push(player);
  if (withAI) {
    const names = ['CPU-Alpha', 'CPU-Beta', 'CPU-Gamma'];
    for (let k = 0; k < 3; k++) {
      const ck = buildKart(...colors[k + 1]); scene.add(ck);
      const ai = new Racer(ck, track, names[k], true);
      ai.aiOffset = (k - 1) * 1.2; ai.aiSkill = .94 + k * .04;
      racers.push(ai);
    }
  }
  racers.forEach((r, i) => r.spawn(track.wrap(-6 - i * 5), i % 2 ? -3.2 : 3.2));
  racers.forEach(r => { r.startTime = 0; r.lapStarts = []; r.bestLap = Infinity; r.rank = 0; });
  state = 'COUNTDOWN'; cnt = 3; start0 = performance.now(); sfx.init();
  hide('menu'); show('hud'); el('countdown').textContent = '';
};

el('startBtn').onclick = () => startRace(el('aiChk').checked);
el('resumeBtn').onclick = () => { state = 'RACE'; hide('pause'); };
el('restartBtn').onclick = el('restartBtn2').onclick = () => {
  state = 'MENU'; hide('pause'); hide('result'); show('menu');
  racers.forEach(r => scene.remove(r.kart)); racers = []; player = null;
};

// —— 输入 ——
const keys = {}, kmap = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ShiftLeft: 'drift', ShiftRight: 'drift', ControlLeft: 'nitro', ControlRight: 'nitro', Space: 'nitro' };
addEventListener('keydown', e => {
  if (state === 'MENU') return;
  if (e.code === 'KeyP' || e.code === 'Escape') { if (state === 'RACE') { state = 'PAUSE'; show('pause'); } else if (state === 'PAUSE') { state = 'RACE'; hide('pause'); } e.preventDefault(); return; }
  if (e.code === 'KeyM') { const m = sfx.toggleMute(); showMsg(m ? '静音' : '音效开启', .8); e.preventDefault(); return; }
  if (e.code === 'KeyC' && state === 'RACE') { camMode = (camMode + 1) % 3; e.preventDefault(); return; }
  if (e.code === 'KeyR' && state === 'RACE' && player) { player.respawn(); e.preventDefault(); return; }
  const n = kmap[e.code]; if (n) { if (!keys[n]) { keys[n] = 1; if (n === 'up' && player) player.in.upTap = 1; if (n === 'nitro' && player) player.in.nitroTap = 1; } e.preventDefault(); }
});
addEventListener('keyup', e => { const n = kmap[e.code]; if (n) { keys[n] = 0; if (player) player.in[n] = 0; } });
// 触屏
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) { show('touch'); hide('keys'); qsa('#touch button').forEach(b => { const k = b.dataset.k; b.addEventListener('touchstart', e => { e.preventDefault(); keys[k] = 1; if (k === 'up' && player) player.in.upTap = 1; if (k === 'nitro' && player) player.in.nitroTap = 1; }); b.addEventListener('touchend', e => { e.preventDefault(); keys[k] = 0; if (player) player.in[k] = 0; }); }); }

// —— HUD ——
function showMsg(txt, dur = 1.8, combo = '') {
  el('msg').textContent = txt; el('msg').style.opacity = '1';
  setTimeout(() => { el('msg').style.opacity = '0'; }, dur * 1000);
  if (combo) { el('combo').textContent = combo; el('combo').style.opacity = '1'; setTimeout(() => { el('combo').style.opacity = '0'; }, dur * 1000 * .8); }
}
function fmt(ms) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), mm = ms % 1000 | 0;
  return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}.${mm.toString().padStart(3, '0').slice(0, 2)}`;
}
function drawMinimap() {
  const c = el('minimap'), g = c.getContext('2d'), w = c.width, h = c.height;
  g.clearRect(0, 0, w, h);
  const pts = track.curve.getSpacedPoints(track.N);
  const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
  const mnx = Math.min(...xs), mxx = Math.max(...xs), mnz = Math.min(...zs), mxz = Math.max(...zs);
  const sc = Math.min(w / (mxx - mnx), h / (mxz - mnz)) * .8, ox = w / 2, oz = h / 2;
  const mx = (x) => ox + (x - (mnx + mxx) / 2) * sc, mz = (z) => oz + (z - (mnz + mxz) / 2) * sc;
  g.strokeStyle = '#fff5'; g.lineWidth = 3; g.beginPath(); pts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](mx(p.x), mz(p.z))); g.closePath(); g.stroke();
  g.fillStyle = '#0f0'; g.beginPath(); g.arc(mx(track.P[0].x), mz(track.P[0].z), 3, 0, 7); g.fill();
  racers.forEach(r => { g.fillStyle = r === player ? '#ff0' : '#fff'; g.beginPath(); g.arc(mx(r.pos.x), mz(r.pos.z), 4, 0, 7); g.fill(); });
}
function drawSpeedo() {
  const c = el('speedo'), g = c.getContext('2d'), w = c.width, h = c.height, r = 85, cx = w / 2, cy = h * .58;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 14; g.beginPath(); g.arc(cx, cy, r, .8 * Math.PI, 2.2 * Math.PI); g.stroke();
  if (!player) return;
  const sp = player.speed, rt = Math.min(sp / BASE_MAX, 1.35), a = .8 * Math.PI + rt * 1.4 * Math.PI;
  const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, '#4ff'); grd.addColorStop(.7, '#fff'); grd.addColorStop(1, '#f80');
  g.strokeStyle = grd; g.lineWidth = 18; g.beginPath(); g.arc(cx, cy, r, .8 * Math.PI, a); g.stroke();
  g.fillStyle = '#fff'; g.font = 'italic 900 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText((sp * 3.6 | 0).toString(), cx, cy);
  g.font = 'bold 18px sans-serif'; g.fillText('km/h', cx, cy + 28);
}

// —— 主循环 ——
let last = performance.now();
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now(), dt = Math.min((now - last) / 1000, .1); last = now;

  if (state === 'COUNTDOWN') {
    const t = (now - start0) / 1000;
    if (t < 1 && cnt === 3) { el('countdown').textContent = '3'; el('countdown').className = 'pop'; sfx.beep(660, .18); cnt = 2; }
    else if (t >= 1 && t < 2 && cnt === 2) { el('countdown').textContent = '2'; el('countdown').className = 'pop'; sfx.beep(660, .18); cnt = 1; }
    else if (t >= 2 && t < 3 && cnt === 1) { el('countdown').textContent = '1'; el('countdown').className = 'pop'; sfx.beep(660, .18); cnt = 0; }
    else if (t >= 3 && cnt === 0) { el('countdown').textContent = 'GO'; el('countdown').className = 'pop'; sfx.beep(880, .25); state = 'RACE'; racers.forEach(r => { r.startTime = now; r.lapStarts = [now]; }); cnt = -1; setTimeout(() => { el('countdown').textContent = ''; }, 800); }
  }

  if (state === 'RACE' || state === 'COUNTDOWN' || state === 'FINISH') {
    const frozen = state === 'COUNTDOWN';
    for (const n in keys) if (keys[n] && player) player.in[n] = keys[n];
    racers.forEach(r => {
      if (!frozen && (r.isAI || r.finished)) aiDrive(r, r.aiSkill || .95, dt);
      r.step(dt, frozen, pads);
      const ev = r.events; r.events = [];
      ev.forEach(([ty, v]) => {
        if (ty === 'driftStart') { sfx.beep(440, .12, 'triangle', .2); if (r === player) el('nitroLbl').textContent = '集气中…'; }
        else if (ty === 'driftEnd') { skid.cut(r.name + -.85); skid.cut(r.name + .85); sfx.whoosh(.35, .5); if (r === player) { showMsg('漂移结束 · 点↑释放小喷', .7); el('nitroLbl').textContent = '点↑释放小喷'; } }
        else if (ty === 'combo') { if (r === player) showMsg('连续漂移', 1, `连漂 ×${v}`); }
        else if (ty === 'mini') { sfx.whoosh(.55, v ? .85 : .6); if (r === player) { showMsg(v ? '完美小喷 ★' : '小喷', .8); el('nitroLbl').textContent = '集气 · 漂移积累氮气'; } }
        else if (ty === 'nitro') { sfx.whoosh(.75, .9); if (r === player) { showMsg('氮气加速 N₂O', 1.2); el('nitroLbl').textContent = '氮气加速中'; } }
        else if (ty === 'double') { sfx.whoosh(.5, .5); if (r === player) showMsg('双喷续航', .9); }
        else if (ty === 'gotNitro') { sfx.beep(1100, .15, 'sine', .35); if (r === player) { showMsg('获得氮气', 1); el('nitroLbl').textContent = '集气 · 漂移积累氮气'; } }
        else if (ty === 'pad') { sfx.whoosh(.4, .65); if (r === player) showMsg('加速带', .75); }
        else if (ty === 'wall') { sfx.hit(Math.min(.8, v / 25)); }
        else if (ty === 'cross') {
          const cross = r.crossings, t = now;
          if (cross >= 2 && cross - 1 === r.lapStarts.length && !r.finished) {
            const lapT = t - r.lapStarts[r.lapStarts.length - 1];
            r.bestLap = Math.min(r.bestLap, lapT); r.lapStarts.push(t);
            if (r === player && cross <= laps) { showMsg(cross === laps ? '最后一圈' : `第 ${cross - 1} 圈 ${fmt(lapT)}`, 1.4); sfx.beep(880, .2); }
            if (cross === laps + 1) {
              r.finished = true; r.finishTime = t;
              if (r === player) { state = 'FINISH'; setTimeout(() => showResult(), 1500); }
            }
          }
        }
      });
      r.place();
    });
    // 排名
    const score = r => r.finished ? 1e12 - r.finishTime : r.progress;
    racers.sort((a, b) => score(b) - score(a));
    racers.forEach((r, i) => r.rank = i + 1);
    // 粒子
    racers.forEach(r => {
      if (!r.drifting) { skid.cut(r.name + -.85); skid.cut(r.name + .85); }
      if (r.drifting || r.speed > 28 && (r.in.down || r.hit > 0)) {
        const K = r.kart, fx = Math.sin(r.angle), fz = Math.cos(r.angle);
        for (const [x, z] of [[-.82, -1], [.82, -1]]) {
          const lx = K.position.x + fx * z + fz * x, lz = K.position.z + fz * z - fx * x;
          const c = r.drifting ? new THREE.Color(.95, .95, .92) : new THREE.Color(.3, .3, .28);
          for (let k = 0; k < 2; k++) part.spawn({ x: lx, y: K.position.y + .1, z: lz }, { x: (Math.random() - .5) * 4, y: Math.random() * .8, z: (Math.random() - .5) * 4 }, c, 1.8 + Math.random() * .8, .45 + Math.random() * .3, 1);
        }
        if (r.drifting) for (const x of [-.85, .85]) skid.add(r.name + x, new THREE.Vector3(K.position.x - fx + fz * x, K.position.y, K.position.z - fz - fx * x), new THREE.Vector3(fz, 0, -fx));
      }
      if (r.boostT > 0 || r.miniT > 0 || r.padT > 0) {
        const K = r.kart, fx = Math.sin(r.angle), fz = Math.cos(r.angle);
        for (const [x, z] of [[-.28, -1.65], [.28, -1.65]]) {
          const lx = K.position.x + fx * z + fz * x, lz = K.position.z + fz * z - fx * x;
          const c = r.padT > 0 ? new THREE.Color(.4, .8, 1) : new THREE.Color(.65, .85, 1);
          part.spawn({ x: lx, y: K.position.y + .6, z: lz }, { x: -fx * 2 + (Math.random() - .5) * 2, y: Math.random() * .4, z: -fz * 2 + (Math.random() - .5) * 2 }, c, .8 + Math.random() * .5, .35 + Math.random() * .15, .75);
        }
      }
    });
    part.update(dt);
  }

  // —— 摄像机 ——
  if (player) {
    const p = player.pos, fx = Math.sin(player.angle), fz = Math.cos(player.angle);
    const modes = [[0, 4.5, -11], [0, 12, -19], [0, 8, 22]], [ox, oy, oz] = modes[camMode];
    camera.position.set(p.x + fx * oz + fz * ox, p.y + oy, p.z + fz * oz - fx * ox);
    camera.lookAt(p.x + fx * 5, p.y + 1.5, p.z + fz * 5);
    sun.position.copy(p).add(SUN_OFF); sun.target.position.copy(p);
    const sp = player.speed, sR = sp / BASE_MAX;
    sfx.engine(sR, player.in.up, player.drifting, player.boostT > 0 || player.miniT > 0);
    el('speedlines').style.opacity = Math.max(0, sR - .65) * 2.2;
    el('boostTint').style.opacity = player.boostT > 0 ? .35 : 0;
    el('lap').textContent = `${Math.max(1, Math.min(player.crossings, laps))}/${laps}`;
    const t = player.startTime ? (player.finished ? player.finishTime : now) - player.startTime : 0;
    el('time').textContent = fmt(t);
    if (player.lapStarts.length && !player.finished) el('lapTime').textContent = fmt(now - player.lapStarts[player.lapStarts.length - 1]);
    if (player.bestLap < Infinity) el('best').textContent = fmt(player.bestLap);
    el('rankNum').textContent = player.rank;
    el('rankTot').textContent = '/' + racers.length;
    el('nitroFill').style.width = player.charge + '%';
    el('slot0').className = player.nitro >= 1 ? 'slot on' : 'slot';
    el('slot1').className = player.nitro >= 2 ? 'slot on' : 'slot';
    drawMinimap(); drawSpeedo();
  }

  propsUpdate(dt); sceneryUpdate(dt, now / 1000, camera);
  renderer.render(scene, camera);
}
tick();

function showResult() {
  hide('hud'); show('result');
  const pR = player.rank;
  el('resTitle').textContent = pR === 1 ? '🏆 第一名！' : `第 ${pR} 名`;
  const lines = ['<div style="font-size:18px;margin-bottom:12px">成绩：</div>'];
  racers.forEach(r => {
    const t = r.finished ? fmt(r.finishTime - r.startTime) : 'DNF', best = r.bestLap < Infinity ? fmt(r.bestLap) : '--';
    const cls = r === player ? ' class="me"' : '';
    lines.push(`<div${cls}>${r.rank}. ${r.name} — 总时间 ${t} (最佳圈速 ${best})</div>`);
  });
  el('resBody').innerHTML = lines.join('');
}
