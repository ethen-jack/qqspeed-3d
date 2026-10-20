import * as THREE from 'three';
import { HALF, WALL, canvasTex } from './track.js';

function place(obj, track, i, lat = 0, h = 0) {
  const p = track.P[i], n = track.Nn[i], t = track.T[i];
  obj.position.set(p.x + n.x * lat, p.y + h, p.z + n.z * lat);
  obj.rotation.y = Math.atan2(t.x, t.z);
  return obj;
}

function bannerTex(text, sub, c1 = '#0a5fd8', c2 = '#18b4ff') {
  return canvasTex(1024, 192, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c2); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic 900 92px sans-serif'; g.fillStyle = '#7a3500'; g.fillText(text, w / 2 + 5, h * .42 + 5);
    g.fillStyle = '#ffe14a'; g.fillText(text, w / 2, h * .42);
    g.font = 'bold 36px sans-serif'; g.fillStyle = '#fff'; g.fillText(sub, w / 2, h * .82);
  }, false);
}

export function buildProps(scene, track) {
  const N = track.N;
  // 起终点格子线
  const chk = canvasTex(256, 32, (g, w, h) => { const s = 16; for (let x = 0; x < w / s; x++) for (let y = 0; y < h / s; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * s, y * s, s, s); } }, false);
  chk.magFilter = THREE.NearestFilter;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 2.25), new THREE.MeshStandardMaterial({ map: chk }));
  line.rotation.x = -Math.PI / 2; line.receiveShadow = true;
  const g0 = place(new THREE.Group(), track, 0, 0, .07); g0.add(line); scene.add(g0);

  // 起点拱门
  const arch = place(new THREE.Group(), track, 0, 0, 0);
  const W = WALL + 1.4, pm = new THREE.MeshStandardMaterial({ color: 0xff8a00, roughness: .4, metalness: .3 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 10, 1.4), pm); p.position.set(s * W, 5, 0); p.castShadow = true; arch.add(p);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 1.4, 3, 1.2), new THREE.MeshStandardMaterial({ color: 0x0b3d8c }));
  beam.position.y = 10.5; beam.castShadow = true; arch.add(beam);
  const bt = bannerTex('QQ飞车', 'START · FINISH  海滨小镇');
  const bm = new THREE.MeshBasicMaterial({ map: bt });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 2.8), bm); f.position.set(0, 10.5, -.62); f.rotation.y = Math.PI; arch.add(f);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 2.8), bm); b.position.set(0, 10.5, .62); arch.add(b);
  scene.add(arch);

  // 广告牌
  const ads = [['QQ飞车', '极速漂移 · 挑战巅峰'], ['N₂O', '集满氮气 一喷到底'], ['漂移之王', '小喷 · 双喷 · 断位漂移'], ['海滨小镇', 'SEASIDE TOWN'], ['SPEED', 'RACING CHAMPIONSHIP']];
  const postM = new THREE.MeshStandardMaterial({ color: 0x666b73, metalness: .6, roughness: .4 });
  for (let k = 0; k < 10; k++) {
    const i = Math.floor(N * (k + .5) / 10), side = k % 2 ? 1 : -1, n = track.Nn[i], p = track.P[i];
    const [a, s] = ads[k % ads.length];
    const gpo = new THREE.Group();
    gpo.position.set(p.x + n.x * side * (WALL + 5), p.y, p.z + n.z * side * (WALL + 5));
    gpo.rotation.y = Math.atan2(-n.x * side, -n.z * side);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: bannerTex(a, s, k % 2 ? '#c2185b' : '#0a5fd8', k % 2 ? '#ff5f8f' : '#18b4ff'), side: THREE.DoubleSide }));
    board.position.y = 6; gpo.add(board);
    for (const x of [-5, 5]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, 6, 8), postM); po.position.set(x, 3, -.1); gpo.add(po); }
    scene.add(gpo);
  }

  // 路灯（实例化）
  const lampIdx = []; for (let i = 0; i < N; i += 32) lampIdx.push(i);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .16, 7, 6), postM, lampIdx.length * 2);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .25, 1.6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c0, emissiveIntensity: .8 }), lampIdx.length * 2);
  const d = new THREE.Object3D(); let c = 0;
  for (const i of lampIdx) for (const s of [-1, 1]) {
    const p = track.P[i], n = track.Nn[i], L = s * (WALL + .9);
    d.position.set(p.x + n.x * L, p.y + 3.5, p.z + n.z * L); d.rotation.set(0, Math.atan2(n.x, n.z), 0); d.updateMatrix(); poles.setMatrixAt(c, d.matrix);
    d.position.set(p.x + n.x * (L - s * .7), p.y + 7, p.z + n.z * (L - s * .7)); d.updateMatrix(); heads.setMatrixAt(c, d.matrix); c++;
  }
  scene.add(poles, heads);

  // 加速带
  const padTex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = 'rgba(0,120,255,.35)'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#bff'; g.lineWidth = 16; g.lineJoin = 'round';
    for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(14, y + 10); g.lineTo(w / 2, y + 50); g.lineTo(w - 14, y + 10); g.stroke(); }
  });
  const padM = new THREE.MeshBasicMaterial({ map: padTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pads = [];
  [[.06, 0], [.2, 4], [.33, -4], [.5, 0], [.66, 3], [.82, -3], [.93, 0]].forEach(([fr, lat]) => {
    const i = Math.floor(N * fr);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 8), padM); m.rotation.x = -Math.PI / 2;
    const gp = place(new THREE.Group(), track, track.wrap(i + 4), lat, .09); gp.add(m); scene.add(gp);
    pads.push({ i: track.wrap(i + 4), lat });
  });

  return { pads, update(dt) { padTex.offset.y += dt * 1.5; } };
}
