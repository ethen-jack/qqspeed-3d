import * as THREE from 'three';
import { canvasTex, rng } from './track.js';

export function buildScenery(scene, track) {
  const R = rng(20240607);
  // 天空渐变
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x1f74e0) }, mid: { value: new THREE.Color(0x8fd0ff) }, bot: { value: new THREE.Color(0xdff3ff) } },
    vertexShader: 'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top,mid,bot;varying vec3 vp;void main(){float h=vp.y;vec3 c=h>0.?mix(mid,top,pow(h,.6)):bot;c=mix(bot,c,smoothstep(-.02,.12,h));gl_FragColor=vec4(c,1.);}'
  }));
  sky.renderOrder = -1; scene.add(sky);

  // 岛屿、沙滩、海面
  const C = new THREE.Vector3(180, 0, -10);
  const grass = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#62b23f'; g.fillRect(0, 0, w, h); for (let k = 0; k < 5000; k++) { g.fillStyle = ['#70c24a', '#559d35', '#7acb55'][k % 3]; g.fillRect(Math.random() * w, Math.random() * h, 2, 3); } });
  grass.repeat.set(80, 80);
  const island = new THREE.Mesh(new THREE.CircleGeometry(520, 72), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  island.rotation.x = -Math.PI / 2; island.position.set(C.x, -.05, C.z); island.receiveShadow = true; scene.add(island);
  const sand = new THREE.Mesh(new THREE.RingGeometry(515, 590, 72), new THREE.MeshStandardMaterial({ color: 0xf0dca0, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(C.x, -.25, C.z); scene.add(sand);
  const waterTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#1f8fd0'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; for (let k = 0; k < 60; k++) { const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.arc(x, y, 6 + Math.random() * 10, .2, 1.2); g.stroke(); } });
  waterTex.repeat.set(120, 120);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.MeshStandardMaterial({ map: waterTex, roughness: .15, metalness: .35, color: 0xbfe8ff }));
  water.rotation.x = -Math.PI / 2; water.position.set(C.x, -.7, C.z); scene.add(water);

  // 远山小岛
  for (let k = 0; k < 18; k++) {
    const a = k / 18 * Math.PI * 2 + R() * .3, r = 1300 + R() * 700, h = 80 + R() * 220;
    const m = new THREE.Mesh(new THREE.ConeGeometry(h * 1.6, h, 7), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(.32 + R() * .08, .35, .32 + R() * .1), flatShading: true }));
    m.position.set(C.x + Math.cos(a) * r, h / 2 - 5, C.z + Math.sin(a) * r); scene.add(m);
  }

  const minDist = (x, z) => { let b = 1e9; for (let i = 0; i < track.N; i += 3) { const p = track.P[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < b) b = d; } return Math.sqrt(b); };
  const ferris = new THREE.Vector3(345, 0, -40);

  // 城镇建筑
  const winTex = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 16) for (let x = 6; x < w; x += 16) { g.fillStyle = Math.random() < .3 ? '#ffe9a8' : '#6fa7d8'; g.fillRect(x, y, 9, 10); } });
  const pal = [0xffb3b3, 0xffe0a3, 0xb7e3ff, 0xd7c4ff, 0xfff1d6, 0xc8f0c0, 0xffffff, 0xf7c6e0];
  const box = new THREE.BoxGeometry(1, 1, 1), roofM = new THREE.MeshStandardMaterial({ color: 0xd2543c });
  let placed = 0;
  for (let k = 0; k < 900 && placed < 150; k++) {
    const i = Math.floor(R() * track.N), side = R() < .5 ? -1 : 1, dist = 24 + R() * 110;
    const p = track.P[i], n = track.Nn[i], x = p.x + n.x * side * dist, z = p.z + n.z * side * dist;
    const w = 10 + R() * 14, d = 10 + R() * 14, h = 10 + R() * (dist > 60 ? 70 : 30);
    if (Math.hypot(x - C.x, z - C.z) > 480 || Math.hypot(x - ferris.x, z - ferris.z) < 50) continue;
    if (minDist(x, z) < 14 + Math.max(w, d) * .75) continue;
    const t = winTex.clone(); t.needsUpdate = true; t.repeat.set(Math.round(w / 4), Math.round(h / 8));
    const m = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ map: t, color: pal[placed % pal.length], roughness: .7 }));
    m.scale.set(w, h, d); m.position.set(x, h / 2, z); m.rotation.y = Math.atan2(n.x, n.z) + (R() - .5) * .3;
    m.castShadow = m.receiveShadow = true; scene.add(m);
    if (h < 24) { const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * .72, 6, 4), roofM); r.position.set(x, h + 3, z); r.rotation.y = m.rotation.y + Math.PI / 4; r.castShadow = true; scene.add(r); }
    placed++;
  }

  // 椰子树（实例化）
  const palms = [];
  for (let k = 0; k < 600 && palms.length < 170; k++) {
    const i = Math.floor(R() * track.N), side = R() < .5 ? -1 : 1, dist = 13 + R() * 22;
    const p = track.P[i], n = track.Nn[i], x = p.x + n.x * side * dist, z = p.z + n.z * side * dist;
    if (p.y > 1 || minDist(x, z) < 12.5) continue;
    palms.push([x, z, 6 + R() * 4, R() * 6]);
  }
  for (let k = 0; k < 90; k++) { const a = R() * Math.PI * 2, r = 500 + R() * 70; palms.push([C.x + Math.cos(a) * r, C.z + Math.sin(a) * r, 6 + R() * 4, R() * 6]); }
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.22, .38, 1, 6), new THREE.MeshStandardMaterial({ color: 0x8a6237 }), palms.length);
  const leafGeo = new THREE.ConeGeometry(.7, 4.2, 4); leafGeo.translate(0, 2.1, 0); leafGeo.scale(1, 1, .25);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0x2f9a3a, flatShading: true }), palms.length * 7);
  const d = new THREE.Object3D(); let li = 0;
  palms.forEach(([x, z, h, a], k) => {
    d.position.set(x, h / 2, z); d.rotation.set(0, 0, 0); d.scale.set(1, h, 1); d.updateMatrix(); trunk.setMatrixAt(k, d.matrix);
    for (let j = 0; j < 7; j++) { d.position.set(x, h, z); d.scale.set(1, 1, 1); d.rotation.set(0, a + j * Math.PI * 2 / 7, 1.95, 'YXZ'); d.updateMatrix(); leaves.setMatrixAt(li++, d.matrix); }
  });
  trunk.castShadow = leaves.castShadow = true; scene.add(trunk, leaves);

  // 摩天轮
  const fw = new THREE.Group(); fw.position.set(ferris.x, 34, ferris.z);
  const steel = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .5, roughness: .3 });
  const wheel = new THREE.Group(); fw.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(28, .5, 8, 64), steel));
  const cabs = [];
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, sp = new THREE.Mesh(new THREE.BoxGeometry(.3, 28, .3), steel);
    sp.position.set(Math.cos(a) * 14, Math.sin(a) * 14, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 2.6), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(k / 16, .8, .6) }));
    cab.position.set(Math.cos(a) * 28, Math.sin(a) * 28 - 1.6, 0); wheel.add(cab); cabs.push(cab);
  }
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1, 40, 1), steel); leg.position.set(s * 10, -16, 0); leg.rotation.z = s * .28; fw.add(leg); }
  fw.rotation.y = .9; scene.add(fw);

  // 云
  const cloudTex = canvasTex(256, 128, (g, w, h) => { for (let k = 0; k < 14; k++) { const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 22 + Math.random() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } }, false);
  for (let k = 0; k < 26; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false }));
    const a = R() * Math.PI * 2, r = 300 + R() * 1200; s.position.set(C.x + Math.cos(a) * r, 160 + R() * 160, C.z + Math.sin(a) * r);
    s.scale.set(260 + R() * 200, 110 + R() * 60, 1); scene.add(s);
  }

  // 帆船
  const boats = [];
  for (let k = 0; k < 8; k++) {
    const b = new THREE.Group(), a = R() * Math.PI * 2, r = 640 + R() * 300;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 9), new THREE.MeshStandardMaterial({ color: 0xffffff })); b.add(hull);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(3, 9, 3), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xff5050 : 0xfff2a0, flatShading: true })); sail.position.y = 5.5; sail.scale.z = .15; b.add(sail);
    b.position.set(C.x + Math.cos(a) * r, -.2, C.z + Math.sin(a) * r); b.userData = { a, r }; scene.add(b); boats.push(b);
  }

  return {
    update(dt, t, cam) {
      if (cam) sky.position.copy(cam.position);
      wheel.rotation.z += dt * .08; for (const c of cabs) c.rotation.z = -wheel.rotation.z;
      waterTex.offset.x = t * .004; waterTex.offset.y = t * .002;
      for (const b of boats) { b.userData.a += dt * .006; const { a, r } = b.userData; b.position.x = C.x + Math.cos(a) * r; b.position.z = C.z + Math.sin(a) * r; b.rotation.y = -a; b.position.y = -.2 + Math.sin(t * 1.3 + r) * .15; }
    }
  };
}
