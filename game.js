// QQ飞车风格 3D 竞速 · 海滨小镇
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries as _merge } from 'three/addons/utils/BufferGeometryUtils.js';
// 合并前统一为非索引、相同属性集，避免不同几何体类型冲突
function mergeGeometries(list) {
  return _merge(list.map(g => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    if (!n.attributes.normal) n.computeVertexNormals();
    return n;
  }));
}

const $ = id => document.getElementById(id);
const V3 = THREE.Vector3;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const wrapAng = a => Math.atan2(Math.sin(a), Math.cos(a));
const rand = (a, b) => a + Math.random() * (b - a);
let seed = 7;
const srand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ---------- 渲染器 ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.3, 9000);

// 天空 + 环境光照
const sky = new Sky();
sky.scale.setScalar(8000);
const su = sky.material.uniforms;
su.turbidity.value = 2; su.rayleigh.value = 2.2; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.85;
const sunDir = new V3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(210));
su.sunPosition.value.copy(sunDir);
scene.add(sky);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(scene, 0.02).texture;
scene.fog = new THREE.Fog(0xa9cfee, 700, 3200);

scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x5d7a3a, 0.35));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 600 });
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

// 后期：泛光
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.4, 0.97);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- 程序化贴图 ----------
function canvasTex(w, h, draw, rx = 1, ry = 1, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noise(g, w, h, n, cols, smin = 1, smax = 3) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const s = rand(smin, smax); g.fillRect(Math.random() * w, Math.random() * h, s, s); }
}
const roadTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#4a4d55'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 9000, ['#3d4048', '#575a62', '#44474f', '#5e6169']);
  g.fillStyle = '#f4f4f4'; g.fillRect(14, 0, 9, h); g.fillRect(w - 23, 0, 9, h);
  g.fillStyle = '#ffffff';
  for (const x of [w / 3, 2 * w / 3]) for (let y = 0; y < h; y += 128) g.fillRect(x - 3, y, 6, 64);
  g.globalAlpha = 0.18; g.fillStyle = '#222';
  g.fillRect(w * 0.2, 0, 26, h); g.fillRect(w * 0.47, 0, 26, h); g.fillRect(w * 0.74, 0, 26, h);
});
const curbTex = canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#e8262b'; g.fillRect(0, 0, w, h / 2); g.fillStyle = '#fafafa'; g.fillRect(0, h / 2, w, h / 2);
});
const railTex = canvasTex(1024, 128, (g, w, h) => {
  const ads = [['#1677ff', 'QQ飞车'], ['#ffffff', 'SPEED'], ['#ff7a00', '海滨小镇'], ['#12b886', 'DRIFT!'], ['#7048e8', 'QQ飞车'], ['#fcc419', 'NITRO']];
  const pw = w / ads.length;
  ads.forEach(([c, t], i) => {
    g.fillStyle = c; g.fillRect(i * pw, 0, pw, h);
    g.fillStyle = c === '#ffffff' || c === '#fcc419' ? '#123' : '#fff';
    g.font = 'italic 900 64px PingFang SC,Microsoft YaHei,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t, i * pw + pw / 2, h / 2 + 4);
  });
  g.fillStyle = '#0c2a5a'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
});
const grassTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#6cae3e'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 14000, ['#5f9f36', '#79bb48', '#68a83b', '#86c653', '#4f8f2c'], 1, 4);
}, 160, 160);
const sandTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#ecd9a6'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 6000, ['#e2cc93', '#f4e4b8', '#d8c086'], 1, 2);
}, 120, 120);
const rockTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#6f7d58'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 5000, ['#5f6b4a', '#8a9670', '#7b8a5e', '#52603e', '#958c74'], 2, 8);
}, 1, 1);
const concreteTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b9bcc2'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 4000, ['#a7aab0', '#c9ccd2', '#9da0a6'], 1, 3);
  g.fillStyle = '#8c8f95'; for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 2);
});
const waterNormal = canvasTex(256, 256, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = x / w * Math.PI * 2, b = y / h * Math.PI * 2;
    const nx = Math.sin(a * 3 + Math.sin(b * 2) * 1.5) * 0.5 + Math.sin(a * 7 + b * 5) * 0.25;
    const ny = Math.cos(b * 4 + Math.sin(a * 3) * 1.2) * 0.5 + Math.cos(b * 9 - a * 6) * 0.25;
    const i = (y * w + x) * 4;
    img.data[i] = 128 + nx * 90; img.data[i + 1] = 128 + ny * 90; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}, 60, 60, false);
const arrowTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#ffb000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff36a';
  for (let k = 0; k < 2; k++) { const y = k * 128; g.beginPath(); g.moveTo(10, y + 110); g.lineTo(w / 2, y + 20); g.lineTo(w - 10, y + 110); g.lineTo(w - 40, y + 110); g.lineTo(w / 2, y + 60); g.lineTo(40, y + 110); g.fill(); }
});
const checkerTex = canvasTex(256, 64, (g, w, h) => {
  for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); }
});
// ---------- 赛道 ----------
const CP = [[-200,0,0],[0,0,0],[200,0,0],[330,0,-20],[420,2,-90],[450,8,-200],[430,16,-300],[350,22,-372],[250,24,-372],
  [180,22,-300],[150,18,-220],[80,14,-170],[-10,12,-200],[-60,12,-290],[-150,14,-380],[-280,14,-420],[-400,12,-390],
  [-470,8,-300],[-480,4,-180],[-430,1,-70],[-330,0,-10]];
const curve = new THREE.CatmullRomCurve3(CP.map(p => new V3(p[0], p[1], p[2])), true, 'centripetal');
const TRACK_LEN = curve.getLength();
const N = Math.floor(TRACK_LEN / 1.5);
const HW = 14;               // 半路宽
const WALL = HW + 1.6;       // 护栏位置
const P = [], T = [], S = [], CUM = [], CURV = [];
{
  const pts = curve.getSpacedPoints(N); pts.pop();
  for (let i = 0; i < N; i++) P.push(pts[i]);
  for (let i = 0; i < N; i++) {
    const t = P[(i + 1) % N].clone().sub(P[(i - 1 + N) % N]).normalize(); T.push(t);
    S.push(new V3().crossVectors(t, new V3(0, 1, 0)).normalize());
    CUM.push(i * TRACK_LEN / N);
  }
  for (let i = 0; i < N; i++) {
    const a = T[(i - 6 + N) % N], b = T[(i + 6) % N];
    CURV.push(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z) / 18); // 有符号曲率(rad/单位)
  }
}
const START_I = 0;
// 最近采样点（局部搜索）
function nearestIdx(pos, hint = -1, win = 40) {
  let best = 1e18, bi = 0;
  if (hint < 0) { for (let i = 0; i < N; i++) { const d = P[i].distanceToSquared(pos); if (d < best) { best = d; bi = i; } } return bi; }
  for (let k = -win; k <= win; k++) {
    const i = (hint + k + N) % N, dx = P[i].x - pos.x, dz = P[i].z - pos.z, dy = (P[i].y - pos.y) * 0.3;
    const d = dx * dx + dz * dz + dy * dy; if (d < best) { best = d; bi = i; }
  }
  return bi;
}
// 返回路面信息：高度、横向偏移、切线
const _tmp = new V3();
function trackInfo(pos, idx) {
  const j = (idx + 1) % N, a = P[idx], b = P[j];
  const abx = b.x - a.x, abz = b.z - a.z;
  let t = ((pos.x - a.x) * abx + (pos.z - a.z) * abz) / (abx * abx + abz * abz);
  let i0 = idx;
  if (t < 0) { i0 = (idx - 1 + N) % N; const c = P[i0]; const cx = a.x - c.x, cz = a.z - c.z; t = ((pos.x - c.x) * cx + (pos.z - c.z) * cz) / (cx * cx + cz * cz); }
  t = clamp(t, 0, 1);
  const p0 = P[i0], p1 = P[(i0 + 1) % N];
  _tmp.lerpVectors(p0, p1, t);
  const side = S[i0];
  const lat = (pos.x - _tmp.x) * side.x + (pos.z - _tmp.z) * side.z;
  return { y: _tmp.y, lat, side, tan: T[i0], i0, t, cx: _tmp.x, cz: _tmp.z };
}

// 隧道区间
const TUN_C = nearestIdx(new V3(-285, 14, -418));
const TUN_H = Math.floor(95 / (TRACK_LEN / N));
const inTunnel = i => { let d = Math.abs(i - TUN_C); d = Math.min(d, N - d); return d < TUN_H; };

function ribbon(fnL, fnR, vScale, mat, uSign = 0) {
  const step = 1;
  const pos = [], uv = [], idx = [];
  let n = 0;
  for (let i = 0; i <= N; i += step) {
    const k = i % N, l = fnL(k), r = fnR(k);
    pos.push(l.x, l.y, l.z, r.x, r.y, r.z);
    const v = (i * TRACK_LEN / N) / vScale;
    if (uSign) uv.push(uSign * v, 0, uSign * v, 1); else uv.push(0, v, 1, v);
    if (n > 0) { const b = (n - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); scene.add(m); return m;
}
const off = (i, d, h = 0) => new V3(P[i].x + S[i].x * d, P[i].y + h, P[i].z + S[i].z * d);
// 路面
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.82, metalness: 0.05 });
const road = ribbon(i => off(i, -HW, 0), i => off(i, HW, 0), HW * 2, roadMat);
road.receiveShadow = true;
// 路肩红白
const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.6 });
curbTex.repeat.set(1, 1);
ribbon(i => off(i, -HW - 1.6, 0.04), i => off(i, -HW, 0.04), 6, curbMat).receiveShadow = true;
ribbon(i => off(i, HW, 0.04), i => off(i, HW + 1.6, 0.04), 6, curbMat).receiveShadow = true;
// 护栏广告牌（隧道内不显示）
const railMat = new THREE.MeshStandardMaterial({ map: railTex, roughness: 0.5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: railTex, emissiveIntensity: 0.12 });
railTex.repeat.set(1, 1);
const railH = i => inTunnel(i) ? 0.01 : 1.3;
ribbon(i => off(i, -WALL, 0), i => off(i, -WALL, railH(i)), 18, railMat, 1).castShadow = true;
ribbon(i => off(i, WALL, 0), i => off(i, WALL, railH(i)), 18, railMat, -1).castShadow = true;
// 护栏顶部金属条
const metal = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 0.9, roughness: 0.25 });
ribbon(i => off(i, -WALL - 0.3, railH(i) + 0.02), i => off(i, -WALL + 0.3, railH(i) + 0.02), 10, metal);
ribbon(i => off(i, WALL - 0.3, railH(i) + 0.02), i => off(i, WALL + 0.3, railH(i) + 0.02), 10, metal);
// 高架侧壁 + 桥墩
const concMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9 });
ribbon(i => off(i, -WALL - 0.3, -0.02), i => off(i, -WALL - 0.3, -P[i].y - 2), 8, concMat);
ribbon(i => off(i, WALL + 0.3, -P[i].y - 2), i => off(i, WALL + 0.3, -0.02), 8, concMat);
ribbon(i => off(i, WALL + 0.3, -1.2), i => off(i, -WALL - 0.3, -1.2), 8, concMat); // 桥底
{
  const pg = []; const base = new THREE.CylinderGeometry(1.6, 2, 1, 12);
  for (let i = 0; i < N; i += 20) {
    if (P[i].y < 4 || inTunnel(i)) continue;
    for (const d of [-HW + 3, HW - 3]) {
      const h = P[i].y + 1; const g = base.clone(); g.scale(1, h, 1);
      const o = off(i, d); g.translate(o.x, h / 2 - 2.2, o.z); pg.push(g);
    }
  }
  if (pg.length) { const m = new THREE.Mesh(mergeGeometries(pg), concMat); m.castShadow = m.receiveShadow = true; scene.add(m); }
}
// ---------- 地形 / 海 / 小镇 ----------
const PS = P.filter((_, i) => i % 3 === 0);
function trackDist(x, z) {
  let best = 1e18, bi = 0;
  for (let i = 0; i < PS.length; i++) { const dx = PS[i].x - x, dz = PS[i].z - z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
  return [Math.sqrt(best), PS[bi].y, bi * 3];
}
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), u), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v);
}
const fbm = (x, z) => vnoise(x, z) * 0.5 + vnoise(x * 2.1, z * 2.1) * 0.25 + vnoise(x * 4.3, z * 4.3) * 0.125;
const SHORE = 75;
function baseHeight(x, z) {
  let h = -0.5 + (fbm(x * 0.01, z * 0.01) - 0.4) * 3;
  if (z > SHORE - 30) h -= Math.pow(Math.max(0, z - (SHORE - 30)) * 0.09, 1.25);
  const far = Math.max(0, -z - 380) + Math.max(0, x - 500) + Math.max(0, -x - 520);
  h += Math.min(far * 0.35, 140) * (0.55 + fbm(x * 0.006, z * 0.006));
  const tdx = x + 285, tdz = z + 418, td = Math.sqrt(tdx * tdx + tdz * tdz); // 隧道山
  if (td < 190) h = Math.max(h, 62 * Math.pow(Math.cos(td / 190 * Math.PI / 2), 1.4) * (0.8 + 0.4 * fbm(x * 0.02, z * 0.02)));
  if (td < 90) h = Math.max(h, 36);
  return h;
}
function terrainHeight(x, z) {
  const [d, ty, ti] = trackDist(x, z);
  let h = baseHeight(x, z);
  if (inTunnel(ti) && h > ty + 12) return h;
  const corridor = WALL + 4;
  if (d < corridor) h = Math.min(h, ty - 1.5);
  else if (d < corridor + 30 && h > ty - 1.5) h = lerp(ty - 1.5, h, Math.pow((d - corridor) / 30, 0.8));
  else if (d < corridor + 25 && ty < 2) h = lerp(ty - 0.3, h, (d - corridor) / 25);
  return h;
}
const detailTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 16000, ['#c4c4c4', '#ececec', '#b8b8b8', '#f6f6f6'], 1, 4);
}, 220, 220);
{
  const SZ = 2400, RES = 260;
  const g = new THREE.PlaneGeometry(SZ, SZ, RES, RES); g.rotateX(-Math.PI / 2); g.translate(0, 0, -150);
  const pa = g.attributes.position, col = [];
  const cGrass = new THREE.Color(0x6db33f), cGrass2 = new THREE.Color(0x4f9a34), cSand = new THREE.Color(0xf0dca6), cRock = new THREE.Color(0x8b8f7a), cSnow = new THREE.Color(0xf4f6f8), c = new THREE.Color();
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), z = pa.getZ(i), h = terrainHeight(x, z); pa.setY(i, h);
    const n = fbm(x * 0.03, z * 0.03);
    c.copy(cGrass).lerp(cGrass2, n);
    const sandK = clamp((z - (SHORE - 45)) / 25, 0, 1) * clamp((2.5 - h) / 3, 0, 1);
    c.lerp(cSand, sandK);
    if (h > 25) c.lerp(cRock, clamp((h - 25) / 30, 0, 1));
    if (h > 95) c.lerp(cSnow, clamp((h - 95) / 25, 0, 1));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: detailTex, vertexColors: true, roughness: 0.95 }));
  m.receiveShadow = true; scene.add(m);
}
// 海
const waterMat = new THREE.MeshStandardMaterial({ color: 0x0b6fae, roughness: 0.15, metalness: 0.1, envMapIntensity: 0.6, normalMap: waterNormal, normalScale: new THREE.Vector2(0.5, 0.5), transparent: true, opacity: 0.88 });
const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 6000), waterMat);
sea.rotation.x = -Math.PI / 2; sea.position.set(0, -2.2, 2500); scene.add(sea);
// 浪花
const foam = new THREE.Mesh(new THREE.PlaneGeometry(2400, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
foam.rotation.x = -Math.PI / 2; foam.position.set(0, -2.1, 99); scene.add(foam);

// ---- 隧道 ----
{
  const R = WALL + 0.6, seg = 14, pos = [], uv = [], idx = [], pos2 = [], idx2 = [];
  const i0 = (TUN_C - TUN_H + N) % N; let row = 0;
  for (let k = 0; k <= TUN_H * 2; k++) {
    const i = (i0 + k) % N;
    for (let s = 0; s <= seg; s++) {
      const a = Math.PI * s / seg, lx = Math.cos(a) * R, ly = Math.sin(a) * R * 0.62;
      const p = off(i, lx, ly); pos.push(p.x, p.y, p.z); uv.push(s / seg * 4, k * 0.25);
      const q = off(i, Math.cos(a) * (R + 2.5), Math.sin(a) * (R * 0.62 + 2.5)); pos2.push(q.x, q.y, q.z);
    }
    if (row > 0) for (let s = 0; s < seg; s++) {
      const a = (row - 1) * (seg + 1) + s, b = a + seg + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b); idx2.push(a, b, a + 1, a + 1, b, b + 1);
    }
    row++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const tunTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#3a3e46'; c.fillRect(0, 0, w, h); noise(c, w, h, 3000, ['#30343b', '#454952'], 1, 3);
    c.fillStyle = '#d9d2b0'; c.fillRect(0, 0, w, 40);
  });
  const tun = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tunTex, roughness: 0.9, side: THREE.DoubleSide }));
  tun.castShadow = true; scene.add(tun);
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos2, 3)); g2.setIndex(idx2); g2.computeVertexNormals();
  scene.add(new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ color: 0x6f7a55, map: rockTex, roughness: 1 })));
  // 灯带
  const lg = [], lamp = new THREE.BoxGeometry(0.5, 0.25, 3);
  for (let k = 0; k <= TUN_H * 2; k += 6) for (const a of [0.62, 2.52]) {
    const i = (i0 + k) % N, p = off(i, Math.cos(a) * (R - 0.3), Math.sin(a) * (R * 0.62 - 0.3));
    const m = lamp.clone(); m.lookAt(T[i]); m.translate(p.x, p.y, p.z); lg.push(m);
  }
  scene.add(new THREE.Mesh(mergeGeometries(lg), new THREE.MeshBasicMaterial({ color: 0xffd27a })));
  // 洞口
  for (const k of [0, TUN_H * 2]) {
    const i = (i0 + k) % N, ring = new THREE.Mesh(new THREE.TorusGeometry(R + 1.2, 1.4, 6, 20, Math.PI), concMat);
    ring.position.copy(P[i]); ring.scale.set(1, 0.62, 1); ring.lookAt(P[i].clone().add(T[i])); scene.add(ring);
  }
}
// ---------- 场景物件 ----------
const anim = []; // 每帧更新的物件
function okSpot(x, z, minD) { const [d] = trackDist(x, z); return d > minD; }
// 椰子树（合并几何）
function makePalms(spots) {
  const trunks = [], leaves = [];
  const seg = new THREE.CylinderGeometry(0.35, 0.5, 1, 7);
  const leaf = new THREE.PlaneGeometry(1.4, 6, 1, 4);
  { const p = leaf.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 3; p.setY(i, y); p.setZ(i, -0.04 * y * y); p.setX(i, p.getX(i) * Math.sin(Math.PI * y / 6) * 1.2); } leaf.rotateX(-Math.PI / 2); leaf.computeVertexNormals(); }
  for (const [x, z, s] of spots) {
    const y = terrainHeight(x, z) - 0.3, h = 9 * s, bend = rand(-0.25, 0.25), dir = rand(0, 6.28);
    let px = x, pz = z, py = y;
    for (let k = 0; k < 6; k++) {
      const g = seg.clone(); g.scale(s, h / 6, s);
      const tilt = bend * k / 6;
      g.rotateZ(tilt); g.rotateY(dir); g.translate(px, py + h / 12, pz);
      trunks.push(g); py += h / 6; px += Math.sin(tilt) * h / 6 * -Math.cos(dir); pz += Math.sin(tilt) * h / 6 * Math.sin(dir);
    }
    for (let k = 0; k < 8; k++) { const g = leaf.clone(); g.scale(s, s, s); g.rotateZ(rand(-0.15, 0.15)); g.rotateY(k / 8 * 6.28 + rand(0, 0.4)); g.translate(px, py, pz); leaves.push(g); }
  }
  const tm = new THREE.Mesh(mergeGeometries(trunks), new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 }));
  const lm = new THREE.Mesh(mergeGeometries(leaves), new THREE.MeshStandardMaterial({ color: 0x3f9e3a, roughness: 0.8, side: THREE.DoubleSide }));
  tm.castShadow = lm.castShadow = true; scene.add(tm, lm);
}
{
  const spots = [];
  for (let i = 0; i < N; i += 14) for (const sd of [-1, 1]) {
    if (inTunnel(i) || P[i].y > 3) continue;
    const d = WALL + rand(6, 14); const x = P[i].x + S[i].x * d * sd, z = P[i].z + S[i].z * d * sd;
    if (okSpot(x, z, WALL + 4)) spots.push([x, z, rand(0.8, 1.2)]);
  }
  for (let k = 0; k < 160; k++) { const x = rand(-700, 700), z = rand(SHORE - 50, SHORE - 15); if (okSpot(x, z, WALL + 6)) spots.push([x, z, rand(0.8, 1.3)]); }
  makePalms(spots);
}
// 普通树（圆锥 + 球）
{
  const g1 = [], g2 = [];
  const cone = new THREE.ConeGeometry(3, 8, 7), ball = new THREE.IcosahedronGeometry(3.4, 1), trunk = new THREE.CylinderGeometry(0.4, 0.5, 3, 6);
  for (let k = 0; k < 900; k++) {
    const x = rand(-900, 900), z = rand(-900, SHORE - 60);
    if (!okSpot(x, z, WALL + 10)) continue;
    const y = terrainHeight(x, z); if (y > 90) continue;
    const s = rand(0.7, 1.5), t = trunk.clone(); t.scale(s, s, s); t.translate(x, y + 1.5 * s, z); g1.push(t);
    const c = (k % 3 ? cone : ball).clone(); c.scale(s, s, s); c.translate(x, y + (k % 3 ? 6.5 : 5.5) * s, z); g2.push(c);
  }
  const a = new THREE.Mesh(mergeGeometries(g1), new THREE.MeshStandardMaterial({ color: 0x6b4a2b }));
  const b = new THREE.Mesh(mergeGeometries(g2), new THREE.MeshStandardMaterial({ color: 0x3d8a35, roughness: 0.9, flatShading: true }));
  a.castShadow = b.castShadow = true; b.receiveShadow = true; scene.add(a, b);
}
// 海滨小镇房屋：白墙彩色屋顶
const winTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = ['#f3eadb', '#e9dcc4'][0]; g.fillRect(0, 0, w, h);
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) { g.fillStyle = '#5c8fb8'; g.fillRect(16 + x * 64, 14 + y * 64, 32, 38); g.fillStyle = '#e8eef4'; g.fillRect(16 + x * 64, 14 + y * 64, 32, 5); g.fillStyle = '#c9b48a'; g.fillRect(12 + x * 64, 52 + y * 64, 40, 5); }
});
{
  const roofCols = [0xe0473c, 0x2f7fd9, 0xf29f05, 0x2bb3a3, 0xd64f9a, 0x7a5cd6];
  const walls = [], roofs = roofCols.map(() => []);
  const box = new THREE.BoxGeometry(1, 1, 1), roof = new THREE.ConeGeometry(0.75, 1, 4); roof.rotateY(Math.PI / 4);
  let placed = 0;
  for (let k = 0; k < 2000 && placed < 230; k++) {
    let x, z;
    if (k % 2) { x = rand(-430, 400); z = rand(-360, -40); } else { x = rand(-650, 650); z = rand(-40, SHORE - 50); if (Math.abs(z) < 30) continue; }
    if (!okSpot(x, z, WALL + 14)) continue;
    const y = terrainHeight(x, z); if (y > 20) continue;
    const w = rand(8, 16), d = rand(8, 14), h = rand(6, 20), ry = Math.round(rand(0, 3)) * Math.PI / 2 + rand(-0.1, 0.1);
    const g = box.clone(); g.scale(w, h, d);
    const uvs = g.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * w / 6, uvs.getY(i) * h / 6);
    g.rotateY(ry); g.translate(x, y + h / 2 - 0.5, z); walls.push(g);
    const r = roof.clone(); r.scale(Math.max(w, d) * 1.0, rand(3, 6), Math.max(w, d) * 1.0); r.scale(w / Math.max(w, d), 1, d / Math.max(w, d));
    r.rotateY(ry); r.translate(x, y + h - 0.5 + 2, z); roofs[k % roofCols.length].push(r);
    placed++;
  }
  winTex.repeat.set(1, 1);
  const wm = new THREE.Mesh(mergeGeometries(walls), new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.9, color: 0xe6ddd0, envMapIntensity: 0.4 }));
  wm.castShadow = wm.receiveShadow = true; scene.add(wm);
  roofs.forEach((r, i) => { if (!r.length) return; const m = new THREE.Mesh(mergeGeometries(r), new THREE.MeshStandardMaterial({ color: roofCols[i], roughness: 0.6 })); m.castShadow = true; scene.add(m); });
}
// 灯塔
{
  const x = 120, z = 175, grp = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(18, 1), new THREE.MeshStandardMaterial({ color: 0x7d7a70, map: rockTex, flatShading: true }));
  rock.scale.set(1.3, 0.5, 1.1); rock.position.y = -3; grp.add(rock);
  for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(3.6 - k * 0.3, 3.9 - k * 0.3, 6, 20), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xd9302c : 0xfafafa, roughness: 0.5 }));
    m.position.y = 6 + k * 6; m.castShadow = true; grp.add(m);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.5, 16), new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffe680, emissiveIntensity: 1.5 }));
  top.position.y = 40.5; grp.add(top);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3.2, 4, 16), new THREE.MeshStandardMaterial({ color: 0x223355, metalness: 0.6 })); cap.position.y = 44; grp.add(cap);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 90, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.rotation.z = Math.PI / 2; beam.position.x = 45; const bp = new THREE.Group(); bp.position.y = 40.5; bp.add(beam); grp.add(bp);
  grp.position.set(x, 0, z); scene.add(grp);
  anim.push(dt => bp.rotation.y += dt * 0.8);
}
// 摩天轮
{
  const grp = new THREE.Group(), wheel = new THREE.Group(), R = 34;
  const steel = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.3 });
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.7, 8, 64), steel));
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(R - 3, 0.4, 6, 64), steel));
  const neon = new THREE.Mesh(new THREE.TorusGeometry(R + 0.8, 0.25, 6, 96), new THREE.MeshBasicMaterial({ color: 0xff5ec8 })); wheel.add(neon);
  const cabins = [];
  const cc = [0xff4d4d, 0xffc53d, 0x40a9ff, 0x73d13d, 0x9254de, 0xff85c0];
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, R, 4), steel); sp.position.set(Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0); sp.rotation.z = a + Math.PI / 2; wheel.add(sp);
    const cab = new THREE.Mesh(new RoundedBoxGeometry(3.6, 3.6, 3.6, 2, 0.8), new THREE.MeshStandardMaterial({ color: cc[k % 6], roughness: 0.4 }));
    cab.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); wheel.add(cab); cabins.push(cab);
  }
  wheel.position.y = R + 6; grp.add(wheel);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, R + 10, 8), steel); leg.position.set(s * 12, (R + 6) / 2, 0); leg.rotation.z = s * 0.33; grp.add(leg); }
  const x = 40, z = -290; grp.position.set(x, terrainHeight(x, z), z); grp.rotation.y = 0.5; scene.add(grp);
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  anim.push(dt => { wheel.rotation.z += dt * 0.12; cabins.forEach(c => c.rotation.z = -wheel.rotation.z); });
}
// 风车
for (const [x, z] of [[-620, -500], [-560, -560], [600, -480], [650, -400], [-200, -620], [120, -640]]) {
  const y = terrainHeight(x, z), grp = new THREE.Group(), w = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.6, 50, 10), w); tower.position.y = 25; grp.add(tower);
  const rot = new THREE.Group(); rot.position.set(0, 50, 2);
  for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 24, 0.4), w); b.position.y = 12; const h = new THREE.Group(); h.rotation.z = k * Math.PI * 2 / 3; h.add(b); rot.add(h); }
  grp.add(rot); grp.position.set(x, y, z); grp.lookAt(0, y, 0); scene.add(grp);
  const sp = rand(0.8, 1.4); anim.push(dt => rot.rotation.z += dt * sp);
}
// 帆船
for (let k = 0; k < 12; k++) {
  const grp = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 10), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xffffff : 0x2255aa })); grp.add(hull);
  const sail = new THREE.Mesh(new THREE.ConeGeometry(3.5, 12, 3), new THREE.MeshStandardMaterial({ color: [0xffffff, 0xff6b6b, 0xffd43b][k % 3] })); sail.position.y = 7; sail.scale.z = 0.15; grp.add(sail);
  const bx = rand(-900, 900), bz = rand(200, 900), ph = rand(0, 6); grp.position.set(bx, -2, bz); grp.rotation.y = rand(0, 6.28); scene.add(grp);
  anim.push((dt, t) => { grp.position.y = -1.9 + Math.sin(t * 1.3 + ph) * 0.3; grp.rotation.z = Math.sin(t + ph) * 0.06; grp.translateZ(dt * 2); });
}
// 云
{
  const cg = [], ball = new THREE.IcosahedronGeometry(1, 2);
  for (let k = 0; k < 40; k++) {
    const cx = rand(-2500, 2500), cz = rand(-2500, 2500), cy = rand(260, 420);
    for (let j = 0; j < 7; j++) { const b = ball.clone(); const s = rand(25, 55); b.scale(s, s * 0.55, s); b.translate(cx + rand(-70, 70), cy + rand(-10, 10), cz + rand(-35, 35)); cg.push(b); }
  }
  scene.add(new THREE.Mesh(mergeGeometries(cg), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xc8d8ea, emissiveIntensity: 0.5, roughness: 1, fog: false })));
}
// ---------- 赛道设施：起点拱门、加速带、氮气箱、弯道指示牌 ----------
{
  const i = START_I, grp = new THREE.Group();
  const blue = new THREE.MeshStandardMaterial({ color: 0x1677ff, metalness: 0.4, roughness: 0.3 });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 14, 2.2), blue); p.position.set(s * (WALL + 1.5), 7, 0); grp.add(p); }
  const bannerTex = canvasTex(1024, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a8cff'); gr.addColorStop(1, '#0040b0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.font = 'italic 900 84px PingFang SC,Microsoft YaHei,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffd84a'; g.fillText('QQ飞车 · START', w / 2, h / 2 + 4);
  });
  const ban = new THREE.Mesh(new THREE.BoxGeometry(WALL * 2 + 5, 3.4, 1.2), [blue, blue, blue, blue, new THREE.MeshStandardMaterial({ map: bannerTex, emissive: 0xffffff, emissiveMap: bannerTex, emissiveIntensity: 0.6 }), new THREE.MeshStandardMaterial({ map: bannerTex, emissive: 0xffffff, emissiveMap: bannerTex, emissiveIntensity: 0.6 })]);
  ban.position.y = 13; grp.add(ban);
  const lights = [];
  for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0x000000 })); l.position.set((k - 1) * 3, 10.4, 0.7); grp.add(l); lights.push(l); }
  grp.position.copy(P[i]); grp.lookAt(P[i].clone().add(T[i])); scene.add(grp);
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  window.__startLights = lights;
  // 起跑线棋盘格
  const sl = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, 3), new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.7 }));
  checkerTex.repeat.set(4, 1);
  sl.rotation.x = -Math.PI / 2; const h = new THREE.Group(); h.add(sl); h.position.copy(P[i]).y += 0.03; h.lookAt(P[i].clone().add(T[i]).setY(P[i].y + 0.03)); scene.add(h);
}
// 加速带：采样索引 + 横向位置
const PADS = [], BOXES = [];
const ds = TRACK_LEN / N;
for (const [m, lat] of [[120, 0], [520, -6], [760, 6], [1180, 0], [1500, -5], [1900, 5], [2250, 0]]) {
  const i = Math.floor(m / ds) % N;
  if (inTunnel(i)) continue;
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(6, 12), new THREE.MeshStandardMaterial({ map: arrowTex, emissive: 0xffaa00, emissiveMap: arrowTex, emissiveIntensity: 0.9, transparent: true }));
  arrowTex.repeat.set(1, 1);
  const o = off(i, lat, 0.05), g = new THREE.Group(); pad.rotation.set(-Math.PI / 2, 0, Math.PI); g.add(pad); g.position.copy(o);
  g.lookAt(o.clone().add(T[i]).setY(o.y)); scene.add(g); PADS.push({ i, lat });
}
// 氮气箱（问号箱）
const boxTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#7ff'); gr.addColorStop(1, '#06f');
  g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#fff'; g.font = '900 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N₂O', w / 2, h / 2 + 2);
});
const boxGeo = new RoundedBoxGeometry(2.4, 2.4, 2.4, 3, 0.4);
const boxMat = new THREE.MeshStandardMaterial({ map: boxTex, emissive: 0x2299ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.92, metalness: 0.2, roughness: 0.2 });
for (const m of [330, 980, 1350, 1700, 2100]) {
  const i = Math.floor(m / ds) % N;
  for (const lat of [-8, -2.7, 2.7, 8]) {
    const mesh = new THREE.Mesh(boxGeo, boxMat); const o = off(i, lat, 1.8); mesh.position.copy(o); mesh.castShadow = true; scene.add(mesh);
    BOXES.push({ i, lat, mesh, cd: 0 });
  }
}
// 弯道指示牌（黄黑箭头）
const chevTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#ffcc00'; g.fillRect(0, 0, w, h); g.fillStyle = '#111';
  for (let k = 0; k < 2; k++) { const x = 18 + k * 48; g.beginPath(); g.moveTo(x, 14); g.lineTo(x + 30, h / 2); g.lineTo(x, h - 14); g.lineTo(x + 16, h - 14); g.lineTo(x + 46, h / 2); g.lineTo(x + 16, 14); g.fill(); }
});
{
  const gl = [], gr = [], plane = new THREE.PlaneGeometry(3, 3);
  for (let i = 0; i < N; i += 8) {
    const c = CURV[i]; if (Math.abs(c) < 0.012 || inTunnel(i)) continue;
    // 牌子放在弯道外侧，面朝来车
    const sd = c > 0 ? -1 : 1, o = off(i, sd * (WALL + 0.6), 2.9);
    const g = plane.clone(); const m = new THREE.Matrix4().lookAt(new V3(), T[i], new V3(0, 1, 0)); g.applyMatrix4(m);
    if (c < 0) { g.scale(1, 1, 1); }
    g.translate(o.x, o.y, o.z); (c > 0 ? gl : gr).push(g);
  }
  const mat = new THREE.MeshStandardMaterial({ map: chevTex, emissive: 0x332200, side: THREE.DoubleSide });
  const flipTex = chevTex.clone(); flipTex.repeat.set(-1, 1); flipTex.needsUpdate = true;
  const mat2 = new THREE.MeshStandardMaterial({ map: flipTex, emissive: 0x332200, side: THREE.DoubleSide });
  if (gl.length) scene.add(new THREE.Mesh(mergeGeometries(gl), mat));
  if (gr.length) scene.add(new THREE.Mesh(mergeGeometries(gr), mat2));
}
// 路灯
{
  const pg = [], hg = [], pole = new THREE.CylinderGeometry(0.15, 0.2, 9, 6), head = new THREE.BoxGeometry(0.6, 0.3, 2.4);
  for (let i = 10; i < N; i += 34) {
    if (inTunnel(i)) continue;
    for (const sd of [-1, 1]) {
      const o = off(i, sd * (WALL + 1.2), 4.5); const g = pole.clone(); g.translate(o.x, o.y, o.z); pg.push(g);
      const hh = head.clone(); const ho = off(i, sd * (WALL), 9); hh.applyMatrix4(new THREE.Matrix4().lookAt(new V3(), S[i], new V3(0, 1, 0))); hh.translate(ho.x, ho.y, ho.z); hg.push(hh);
    }
  }
  scene.add(new THREE.Mesh(mergeGeometries(pg), metal));
  scene.add(new THREE.Mesh(mergeGeometries(hg), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 0.6 })));
}
// ---------- 赛车模型 ----------
const CARS = [
  { name: '雷诺', body: 0xe8262b, accent: 0xffd84a, top: 1.0, charge: 1.0, accel: 1.0 },
  { name: '天行者', body: 0x1a6dff, accent: 0x31f2ff, top: 0.99, charge: 1.15, accel: 1.0 },
  { name: '圣光', body: 0xf5f5f5, accent: 0xffc531, top: 1.04, charge: 0.95, accel: 0.97 },
  { name: '暗夜', body: 0x2a2140, accent: 0xb46bff, top: 1.0, charge: 1.0, accel: 1.0 },
  { name: '小绿', body: 0x2fb35a, accent: 0xffffff, top: 1.0, charge: 1.0, accel: 1.0 },
];
function buildCar(spec) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color: spec.body, metalness: 0.5, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  const accent = new THREE.MeshPhysicalMaterial({ color: spec.accent, metalness: 0.6, roughness: 0.3, clearcoat: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.6, metalness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.15 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x223a5a, metalness: 0.2, roughness: 0.05, transmission: 0, clearcoat: 1, opacity: 0.85, transparent: true });
  const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  // 底盘 + 车身
  add(new RoundedBoxGeometry(2.0, 0.35, 4.0, 3, 0.15), dark, 0, 0.42, 0);
  add(new RoundedBoxGeometry(1.75, 0.55, 3.3, 4, 0.25), paint, 0, 0.72, 0.1);
  const nose = add(new RoundedBoxGeometry(1.3, 0.35, 1.3, 4, 0.16), paint, 0, 0.6, 1.95); nose.rotation.x = 0.12;
  add(new RoundedBoxGeometry(2.1, 0.12, 0.6, 2, 0.05), accent, 0, 0.42, 2.45); // 前翼
  for (const s of [-1, 1]) { // 侧箱
    add(new RoundedBoxGeometry(0.42, 0.42, 1.9, 3, 0.18), paint, s * 1.0, 0.62, -0.2);
    add(new RoundedBoxGeometry(0.1, 0.18, 1.6, 2, 0.05), accent, s * 1.22, 0.66, -0.2);
  }
  // 座舱
  const cock = add(new THREE.SphereGeometry(0.62, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0.98, 0.65); cock.scale.set(1.05, 0.7, 1.55);
  // 车手（头盔）
  const helmet = add(new THREE.SphereGeometry(0.36, 20, 16), new THREE.MeshPhysicalMaterial({ color: 0xffffff, clearcoat: 1, roughness: 0.2 }), 0, 1.35, -0.2);
  add(new THREE.SphereGeometry(0.37, 20, 16, 0, Math.PI, 0.6, 1.1), new THREE.MeshPhysicalMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.05, clearcoat: 1 }), 0, 1.35, -0.2).rotation.y = 0;
  add(new THREE.TorusGeometry(0.36, 0.05, 6, 24), accent, 0, 1.35, -0.2).rotation.y = Math.PI / 2;
  add(new RoundedBoxGeometry(0.85, 0.5, 0.5, 2, 0.15), paint, 0, 1.0, -0.35); // 肩/靠背
  // 尾翼
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.08, 0.6, 0.35), dark, s * 0.6, 1.15, -1.75);
  add(new RoundedBoxGeometry(2.1, 0.09, 0.6, 2, 0.04), accent, 0, 1.48, -1.8).rotation.x = -0.12;
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.4, 0.7), paint, s * 1.06, 1.42, -1.8);
  // 排气管
  const exhausts = [];
  for (const s of [-1, 1]) { const e = add(new THREE.CylinderGeometry(0.13, 0.16, 0.6, 12), chrome, s * 0.35, 0.68, -1.95); e.rotation.x = Math.PI / 2; exhausts.push(new V3(s * 0.35, 0.68, -2.3)); }
  // 尾灯 + 车灯
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 0.6 });
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.35, 0.12, 0.05), tailMat, s * 0.65, 0.68, -1.56);
  // 车轮
  const wheels = [];
  const tire = new THREE.CylinderGeometry(0.46, 0.46, 0.42, 22); tire.rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.28, 0.28, 0.44, 10); rim.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9 });
  for (const [x, z, front] of [[-1.08, 1.35, 1], [1.08, 1.35, 1], [-1.12, -1.3, 0], [1.12, -1.3, 0]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.46, z); root.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    const t = new THREE.Mesh(front ? tire : tire.clone().scale(1.15, 1, 1), tireMat); t.castShadow = true; spin.add(t);
    const r = new THREE.Mesh(rim, chrome); spin.add(r);
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.08), accent); spin.add(sp);
    wheels.push({ pivot, spin, front });
  }
  // 车底霓虹
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.6), new THREE.MeshBasicMaterial({ color: spec.accent, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.visible = false;
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.05; root.add(glow);
  scene.add(root);
  return { root, body, wheels, exhausts, tailMat };
}

// ---------- 粒子系统 ----------
class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0; this.i = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.ttl = new Float32Array(max); this.size = new Float32Array(max); this.grow = new Float32Array(max);
    this.a = new Float32Array(max); this.s = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.a, 1)); g.setAttribute('size', new THREE.BufferAttribute(this.s, 1));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: innerHeight / 2 } }, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, vertexColors: true,
      vertexShader: `attribute float alpha; attribute float size; varying float vA; varying vec3 vC; uniform float scale;
        void main(){ vA=alpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 d=gl_PointCoord-.5; float r=length(d); if(r>.5) discard; float a=smoothstep(.5,.0,r)*vA; gl_FragColor=vec4(vC,a); }`,
    });
    this.mat = mat;
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; scene.add(this.points);
  }
  emit(p, v, color, size, ttl, grow = 1) {
    const i = this.i; this.i = (this.i + 1) % this.max;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3); this.col.set([color.r, color.g, color.b], i * 3);
    this.life[i] = ttl; this.ttl[i] = ttl; this.size[i] = size; this.grow[i] = grow;
  }
  update(dt, drag = 1.5, alphaMul = 1) {
    const k = Math.exp(-drag * dt);
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.a[i] = 0; continue; }
      this.life[i] -= dt; const f = Math.max(0, this.life[i] / this.ttl[i]);
      for (let j = 0; j < 3; j++) { this.vel[i * 3 + j] *= k; this.pos[i * 3 + j] += this.vel[i * 3 + j] * dt; }
      this.vel[i * 3 + 1] += 0.6 * dt;
      this.a[i] = f * alphaMul; this.s[i] = this.size[i] * (1 + (1 - f) * this.grow[i]);
    }
    this.geo.attributes.position.needsUpdate = this.geo.attributes.alpha.needsUpdate = this.geo.attributes.size.needsUpdate = this.geo.attributes.color.needsUpdate = true;
  }
}
const smoke = new Particles(900, false), fire = new Particles(700, true), sparks = new Particles(300, true);

// 刹车痕
const SKID_MAX = 3000;
const skidPos = new Float32Array(SKID_MAX * 6 * 3);
const skidGeo = new THREE.BufferGeometry(); skidGeo.setAttribute('position', new THREE.BufferAttribute(skidPos, 3));
const skidMesh = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
skidMesh.frustumCulled = false; scene.add(skidMesh);
let skidI = 0;
function addSkid(a0, a1, b0, b1) { // 两条边的旧/新点
  const o = skidI * 18; skidI = (skidI + 1) % SKID_MAX;
  skidPos.set([a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z, a1.x, a1.y, a1.z], o);
  skidGeo.attributes.position.needsUpdate = true;
}
// ---------- 音频（WebAudio 合成） ----------
const Audio = {
  ctx: null, music: true,
  init() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0.6; this.master.connect(ctx.destination);
    // 引擎
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilt = ctx.createBiquadFilter(); this.engFilt.type = 'lowpass'; this.engFilt.frequency.value = 900;
    this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = ctx.createOscillator(); this.o2.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    this.o1.connect(this.engFilt); this.o2.connect(g2).connect(this.engFilt);
    this.engFilt.connect(this.engGain).connect(this.master); this.o1.start(); this.o2.start();
    // 噪声
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const mkNoise = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(this.master); s.start(); return { g, fl }; };
    this.skid = mkNoise('bandpass', 1800, 3);
    this.wind = mkNoise('highpass', 2500, 0.5);
    this.jet = mkNoise('bandpass', 600, 0.8);
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0.22; this.musicGain.connect(this.master);
    this.startMusic();
  },
  update(speedR, slip, nitro, onRace) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const gear = Math.min(5, Math.floor(speedR * 5)), within = speedR * 5 - gear;
    const f = 55 + within * 70 + gear * 12 + (nitro ? 25 : 0);
    this.o1.frequency.setTargetAtTime(f, t, 0.05); this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engFilt.frequency.setTargetAtTime(500 + speedR * 1800, t, 0.1);
    this.engGain.gain.setTargetAtTime(onRace ? 0.13 + speedR * 0.08 : 0, t, 0.1);
    this.skid.g.gain.setTargetAtTime(onRace ? clamp(slip, 0, 1) * 0.22 : 0, t, 0.05);
    this.wind.g.gain.setTargetAtTime(onRace ? speedR * speedR * 0.08 : 0, t, 0.2);
    this.jet.g.gain.setTargetAtTime(onRace && nitro ? 0.35 : 0, t, 0.08);
  },
  beep(freq, dur = 0.15, type = 'square', vol = 0.3) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur);
  },
  whoosh(vol = 0.5, dur = 0.6) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3500, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + dur);
  },
  thud() { this.beep(70, 0.25, 'sine', 0.6); this.whoosh(0.25, 0.2); },
  startMusic() {
    const ctx = this.ctx, bpm = 128, step = 60 / bpm / 4;
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    let next = ctx.currentTime + 0.1, n = 0;
    const note = (m, t, d, type, v) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = mtof(m);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(this.musicGain); o.start(t); o.stop(t + d + 0.02);
    };
    const drum = (t, kick) => {
      if (kick) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g).connect(this.musicGain); o.start(t); o.stop(t + 0.22); }
      else { const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f).connect(g).connect(this.musicGain); s.start(t, Math.random()); s.stop(t + 0.06); }
    };
    setInterval(() => {
      while (next < ctx.currentTime + 0.2) {
        const bar = Math.floor(n / 16) % 4, s = n % 16, ch = chords[bar];
        if (s % 4 === 0) drum(next, true);
        if (s % 2 === 1) drum(next, false);
        if (s % 2 === 0) note(ch[0] - 24, next, step * 1.8, 'sawtooth', 0.16);
        note(ch[[0, 1, 2, 1][s % 4]] + 12 + (s >= 8 ? 12 : 0), next, step * 0.9, 'square', 0.05);
        if (s === 0) ch.forEach(m => note(m, next, step * 15, 'triangle', 0.05));
        next += step; n++;
      }
    }, 50);
  },
  toggleMusic() { this.music = !this.music; if (this.musicGain) this.musicGain.gain.value = this.music ? 0.22 : 0; },
};

// ---------- 输入 ----------
const keys = {}, pressed = {};
const map = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'drift', ShiftRight: 'drift', ControlLeft: 'nitro', ControlRight: 'nitro', Space: 'nitro', KeyR: 'reset', KeyC: 'cam', KeyM: 'music', KeyP: 'pause', Escape: 'pause', KeyH: 'help' };
addEventListener('keydown', e => {
  const k = map[e.code]; if (!k) return;
  e.preventDefault();
  if (!keys[k] && !e.repeat) pressed[k] = true;
  keys[k] = true;
});
addEventListener('keyup', e => { const k = map[e.code]; if (k) { keys[k] = false; e.preventDefault(); } });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
// ---------- 车辆物理（街机漂移模型） ----------
const LAPS = 3;
const BASE_TOP = 50;          // m/s  ≈180 km/h
const DRIFT_MIN_SPEED = 14;
const C_SMOKE = new THREE.Color(0xe8e8e8), C_FIRE1 = new THREE.Color(0x3aa0ff), C_FIRE2 = new THREE.Color(0xffffff), C_JET = new THREE.Color(0xffb020), C_SPARK = new THREE.Color(0xffd27a);
const fwd = h => new V3(Math.sin(h), 0, Math.cos(h));
const tanAng = i => Math.atan2(T[i].x, T[i].z);

class Racer {
  constructor(specIdx, isPlayer, name) {
    this.spec = CARS[specIdx]; this.isPlayer = isPlayer; this.name = name;
    this.car = buildCar(this.spec);
    this.pos = new V3(); this.h = 0; this.moveAng = 0; this.speed = 0;
    this.idx = 0; this.cross = 0; this.finished = false; this.finishT = 0;
    this.drift = 0; this.driftDir = 0; this.slip = 0; this.driftTime = 0;
    this.gauge = 0; this.slots = 0;
    this.boost = { nitro: 0, jet: 0, pad: 0, start: 0 };
    this.jetWindow = 0; this.jetStage = 0; this.roll = 0; this.pitch = 0; this.steerVis = 0;
    this.wrongT = 0; this.wheelRot = 0; this.lastSkid = null; this.vy = 0; this.y = 0;
  }
  place(i, lat) {
    this.idx = i; const o = off(i, lat); this.pos.copy(o); this.y = o.y;
    this.h = this.moveAng = tanAng(i); this.speed = 0;
  }
  get progress() { return (this.cross - 1) * TRACK_LEN + CUM[this.idx]; }
  topSpeed() {
    let m = this.spec.top;
    if (this.boost.nitro > 0) m *= 1.42;
    else if (this.boost.pad > 0 || this.boost.start > 0) m *= 1.3;
    if (this.boost.jet > 0) m *= this.jetStage >= 2 ? 1.24 : 1.17;
    return BASE_TOP * m;
  }
  boosting() { return this.boost.nitro > 0 || this.boost.pad > 0 || this.boost.start > 0 || this.boost.jet > 0; }
}

function updatePlayer(r, dt, ctrl) {
  const speedAbs = Math.abs(r.speed);
  const steer = (ctrl.left ? 1 : 0) - (ctrl.right ? 1 : 0);
  // --- 漂移状态机 ---
  if (!r.drift && ctrl.drift && steer !== 0 && r.speed > DRIFT_MIN_SPEED) {
    r.drift = 1; r.driftDir = steer; r.driftTime = 0;
    r.h += steer * 0.12; // 甩尾起漂
  }
  if (r.drift) {
    r.driftTime += dt;
    const same = steer === r.driftDir, opp = steer === -r.driftDir;
    // 松开方向键或反打 → 结束漂移（反打回正更快）
    if ((!same && !ctrl.drift) || opp || r.speed < DRIFT_MIN_SPEED * 0.6) {
      r.drift = 0;
      if (r.driftTime > 0.25) { r.jetWindow = 0.55; r.jetStage = 0; }
      if (opp) r.h -= r.driftDir * Math.min(Math.abs(r.slip) * 0.35, 0.18);
    }
  }
  // --- 转向 ---
  let yawRate;
  const spdK = clamp(speedAbs / 12, 0, 1);
  if (r.drift) {
    const same = steer === r.driftDir ? 1 : 0;
    yawRate = r.driftDir * (1.25 + same * 0.85) * spdK;
  } else {
    yawRate = steer * (1.9 - clamp(speedAbs / BASE_TOP, 0, 1.4) * 0.75) * spdK * Math.sign(r.speed || 1);
  }
  r.h += yawRate * dt;
  r.ctrlDown = ctrl.down && r.speed > 0;
  // 速度方向向车头靠拢（抓地力）
  const grip = r.drift ? 2.3 : (r.jetWindow > 0 ? 7 : 11);
  let slip = wrapAng(r.h - r.moveAng);
  r.moveAng += slip * Math.min(1, grip * dt);
  slip = wrapAng(r.h - r.moveAng);
  const maxSlip = 0.78;
  if (Math.abs(slip) > maxSlip) { r.moveAng = r.h - Math.sign(slip) * maxSlip; slip = Math.sign(slip) * maxSlip; }
  r.slip = slip;
  // 集气
  if (r.drift && r.slots < 2) {
    r.gauge += Math.abs(slip) * clamp(r.speed / BASE_TOP, 0, 1.2) * 0.5 * r.spec.charge * dt;
    if (r.gauge >= 1) { r.gauge -= 1; r.slots++; if (r.isPlayer) { flash('氮气 +1', '#5cf'); Audio.beep(880, 0.12, 'triangle', 0.3); Audio.beep(1320, 0.18, 'triangle', 0.25); } }
  }
  if (r.slots >= 2) r.gauge = Math.min(r.gauge, 0.999);
  // --- 小喷 / 双喷 ---
  if (r.jetWindow > 0) {
    r.jetWindow -= dt;
    if (ctrl.upTap) {
      if (r.jetStage === 0) { r.jetStage = 1; r.boost.jet = 0.55; r.jetWindow = 0.7; r.jetCD = 0.15; if (r.isPlayer) { combo('小喷'); Audio.whoosh(0.35, 0.4); } }
      else if (r.jetStage === 1 && r.jetCD <= 0) { r.jetStage = 2; r.boost.jet = 0.8; r.jetWindow = 0; if (r.isPlayer) { combo('双喷 !'); Audio.whoosh(0.5, 0.6); } r.gauge = Math.min(r.slots < 2 ? 1.2 : 0.999, r.gauge + 0.05); }
    }
    if (r.jetCD > 0) r.jetCD -= dt;
  }
  // --- 氮气 ---
  if (ctrl.nitroTap && r.slots > 0 && r.boost.nitro <= 0.3) {
    r.slots--; r.boost.nitro = 3.0; if (r.isPlayer) { flash('NITRO!', '#0ff'); Audio.whoosh(0.8, 1.0); shake = 0.4; }
  }
  // --- 纵向 ---
  const top = r.topSpeed();
  const anyBoost = r.boosting();
  if (anyBoost && r.speed < top) r.speed += (r.boost.nitro > 0 ? 34 : 28) * dt;
  if (ctrl.up && !anyBoost) {
    if (r.speed < 0) r.speed += 40 * dt;
    else if (r.speed < top) r.speed += 26 * r.spec.accel * (1 - Math.pow(r.speed / top, 2.2)) * dt + 2 * dt;
  } else if (ctrl.down) {
    if (r.speed > 0) r.speed -= (r.drift ? 14 : 38) * dt;
    else r.speed = Math.max(-14, r.speed - 12 * dt);
  } else if (!anyBoost) {
    r.speed -= Math.sign(r.speed) * Math.min(Math.abs(r.speed), 5 * dt);
  }
  if (r.speed > top) r.speed = Math.max(top, r.speed - 9 * dt);
  // 漂移损速（侧滑越大损越多，QQ飞车式保速）
  if (r.drift) r.speed -= Math.abs(Math.sin(slip)) * 4.5 * dt;
  for (const k in r.boost) r.boost[k] = Math.max(0, r.boost[k] - dt);
  // --- 积分 ---
  const v = fwd(r.moveAng).multiplyScalar(r.speed);
  r.pos.addScaledVector(v, dt);
  return { steer, slip };
}
// 道路约束：高度、护栏碰撞、圈数
function constrain(r, dt) {
  const prevIdx = r.idx;
  r.idx = nearestIdx(r.pos, r.idx, 30);
  const ti = trackInfo(r.pos, r.idx);
  const lim = WALL - 1.25;
  if (Math.abs(ti.lat) > lim) {
    const sgn = Math.sign(ti.lat), pen = Math.abs(ti.lat) - lim;
    r.pos.x -= ti.side.x * pen * sgn; r.pos.z -= ti.side.z * pen * sgn;
    // 速度方向投影到切线方向
    const ta = Math.atan2(ti.tan.x, ti.tan.z) + (Math.cos(r.moveAng - Math.atan2(ti.tan.x, ti.tan.z)) < 0 ? Math.PI : 0);
    const into = Math.abs(Math.sin(wrapAng(r.moveAng - ta)));
    if (into > 0.05) {
      r.speed *= 1 - clamp(into * 1.1, 0.04, 0.6);
      r.moveAng = lerp(r.moveAng, r.moveAng + wrapAng(ta - r.moveAng), 0.8);
      r.h += wrapAng(ta - r.h) * 0.35;
      if (r.isPlayer && r.speed > 8) {
        const hp = r.pos.clone().addScaledVector(ti.side, sgn * 1.1).setY(r.y + 0.6);
        for (let k = 0; k < 14; k++) sparks.emit(hp, new V3(rand(-8, 8), rand(2, 9), rand(-8, 8)), C_SPARK, 0.25, 0.4, 0);
        if (into > 0.2) { Audio.thud(); shake = Math.max(shake, into * 0.6); }
        if (r.drift && into > 0.3) r.drift = 0;
      }
    }
  }
  // 高度
  r.lat = ti.lat;
  const ty = ti.y;
  r.y = lerp(r.y, ty, Math.min(1, dt * 20));
  r.pos.y = r.y;
  // 圈数
  if (prevIdx > N * 0.8 && r.idx < N * 0.2) r.cross++;
  else if (prevIdx < N * 0.2 && r.idx > N * 0.8) r.cross--;
  return ti;
}

// ---------- AI ----------
function aiControl(r, dt, player, raceT) {
  const look = Math.floor(clamp(r.speed * 1.0, 18, 60) / ds);
  let cmax = 0, csum = 0;
  for (let k = 4; k < look; k += 2) { const c = CURV[(r.idx + k) % N]; if (Math.abs(c) > Math.abs(cmax)) cmax = c; csum += c; }
  const R = 1 / Math.max(Math.abs(cmax), 1e-4);
  const vCorner = Math.sqrt(r.aiGrip * R);
  // 动态难度
  const gap = r.progress - player.progress;
  const band = clamp(1 - gap / 900, 0.86, 1.08);
  r.spec = { ...r.spec, top: r.aiTop * band };
  const target = Math.min(r.topSpeed(), vCorner);
  // 目标横向位置：入弯走内线
  const ti = trackInfo(r.pos, r.idx);
  let wantLat = clamp(csum * 40, -1, 1) * HW * 0.55 + r.aiLane;
  wantLat = clamp(wantLat, -HW + 2.5, HW - 2.5);
  // 简单避让
  for (const o of racers) if (o !== r) {
    const d = o.progress - r.progress;
    if (d > 0 && d < 12 && Math.abs(o.lat - ti.lat) < 2.6) wantLat += (ti.lat > o.lat ? 1 : -1) * 3.5;
  }
  // 朝向前方目标点
  const aIdx = (r.idx + Math.floor(clamp(r.speed * 0.45, 8, 26) / ds)) % N;
  const tp = off(aIdx, wantLat);
  const desired = Math.atan2(tp.x - r.pos.x, tp.z - r.pos.z);
  const err = wrapAng(desired - r.h);
  const ctrl = { up: r.speed < target, down: r.speed > target + 6, left: err > 0.03, right: err < -0.03, drift: false };
  // 弯道急时漂移
  if (Math.abs(cmax) > 0.016 && r.speed > 28 && Math.abs(err) > 0.06) ctrl.drift = true;
  // 氮气：直道使用
  ctrl.nitroTap = r.slots > 0 && Math.abs(cmax) < 0.006 && raceT > 4 && Math.random() < dt * 0.8;
  ctrl.upTap = r.jetWindow > 0 && Math.random() < dt * 6 * r.aiSkill;
  return ctrl;
}

// ---------- 车辆视觉更新 ----------
function updateVisual(r, dt, steer) {
  const c = r.car;
  c.root.position.set(r.pos.x, r.y, r.pos.z);
  const i = r.idx, t = T[i];
  const pitchT = -Math.asin(clamp(t.y, -1, 1));
  r.pitch = lerp(r.pitch, pitchT, Math.min(1, dt * 8));
  const latG = (r.drift ? -r.slip * 0.22 : -steer * clamp(r.speed / BASE_TOP, 0, 1) * 0.06);
  r.roll = lerp(r.roll, latG, Math.min(1, dt * 6));
  c.root.rotation.set(r.pitch, r.h, 0, 'YXZ');
  c.body.rotation.z = r.roll;
  c.body.rotation.x = r.boosting() ? -0.04 : 0;
  r.steerVis = lerp(r.steerVis, (r.drift ? -r.driftDir * 0.35 : steer * 0.42), Math.min(1, dt * 10));
  r.wheelRot += r.speed * dt / 0.46;
  for (const w of c.wheels) { w.spin.rotation.x = r.wheelRot; if (w.front) w.pivot.rotation.y = r.steerVis; }
  c.tailMat.emissiveIntensity = r.ctrlDown ? 3 : 0.6;
  // 漂移烟雾 + 胎痕
  const rearL = new V3(-1.1, 0.05, -1.3).applyEuler(c.root.rotation).add(c.root.position);
  const rearR = new V3(1.1, 0.05, -1.3).applyEuler(c.root.rotation).add(c.root.position);
  const sliding = (r.drift && Math.abs(r.slip) > 0.15) || (r.ctrlDown && r.speed > 15);
  if (sliding) {
    for (const p of [rearL, rearR]) if (Math.random() < 0.9) smoke.emit(p.clone().setY(p.y + 0.3), new V3(rand(-1.5, 1.5), rand(0.5, 2), rand(-1.5, 1.5)), C_SMOKE, rand(1.2, 2.0), rand(0.8, 1.3), 2.2);
    if (r.lastSkid) {
      const sd = new V3(0.17, 0, 0).applyAxisAngle(new V3(0, 1, 0), r.h);
      for (const [a, b] of [[r.lastSkid[0], rearL], [r.lastSkid[1], rearR]]) {
        const a1 = a.clone().setY(r.y + 0.03), b1 = b.clone().setY(r.y + 0.03);
        addSkid(a1.clone().sub(sd), b1.clone().sub(sd), a1.clone().add(sd), b1.clone().add(sd));
      }
    }
    r.lastSkid = [rearL, rearR];
    // 漂移火花（集气提示）
    if (r.drift && r.isPlayer && r.driftTime > 0.4) for (const p of [rearL, rearR]) if (Math.random() < 0.5)
      sparks.emit(p.clone().setY(p.y + 0.2), new V3(rand(-3, 3), rand(1, 4), rand(-3, 3)), r.driftTime > 1.2 ? C_FIRE1 : C_JET, 0.22, 0.3, 0);
  } else r.lastSkid = null;
  // 尾焰
  const nitro = r.boost.nitro > 0, jet = r.boost.jet > 0 || r.boost.pad > 0 || r.boost.start > 0;
  if (nitro || jet) {
    const back = fwd(r.h).multiplyScalar(-r.speed * 0.5 - 14);
    for (const e of c.exhausts) {
      const p = e.clone().applyEuler(c.root.rotation).add(c.root.position);
      for (let k = 0; k < (nitro ? 3 : 2); k++)
        fire.emit(p, back.clone().add(new V3(rand(-1, 1), rand(-0.5, 1), rand(-1, 1))), nitro ? (k ? C_FIRE1 : C_FIRE2) : C_JET, nitro ? 1.0 : 0.7, rand(0.12, 0.22), -0.6);
    }
  }
}
// ---------- 比赛 ----------
let racers = [], player, state = 'menu', raceT = 0, countdown = 0, shake = 0, camMode = 0, startBoostOK = false, lapStart = 0, lapTimes = [];
let selCar = 0;
const AI_NAMES = ['小橘子', '夜风', '酷酷龙'];
function setupRace() {
  racers.forEach(r => scene.remove(r.car.root));
  racers = [];
  const grid = [[-6, -7], [6, -7], [-6, -18], [6, -18]]; // 玩家最后一排左侧
  const order = [3, 1, 2, 0];
  for (let k = 0; k < 4; k++) {
    const isP = k === 0;
    const r = new Racer(isP ? selCar : [3, 4, (selCar + 1) % 3][k - 1], isP, isP ? '我' : AI_NAMES[k - 1]);
    const [lat, back] = grid[order[k]];
    r.place((START_I - Math.round(-back / ds) + N) % N, lat);
    r.cross = 0;
    if (!isP) { r.aiTop = [0.975, 0.99, 1.0][k - 1]; r.aiGrip = [15, 16, 17][k - 1]; r.aiLane = rand(-2, 2); r.aiSkill = 0.6 + k * 0.1; }
    racers.push(r);
  }
  player = racers[0];
  raceT = 0; countdown = 3.999; startBoostOK = false; lapTimes = []; lapStart = 0;
  smoke.life.fill(0); fire.life.fill(0); skidPos.fill(0); skidGeo.attributes.position.needsUpdate = true;
  window.__startLights.forEach(l => { l.material.color.set(0x330000); l.material.emissive.set(0); });
}

// ---------- HUD ----------
const msgEl = $('msg'), comboEl = $('combo');
let msgT = 0, comboT = 0;
function flash(t, c = '#fff', dur = 1) { msgEl.textContent = t; msgEl.style.color = c; msgEl.style.opacity = 1; msgEl.style.transform = 'scale(1.15)'; setTimeout(() => msgEl.style.transform = 'scale(1)', 80); msgT = dur; }
function combo(t) { comboEl.textContent = t; comboEl.style.opacity = 1; comboT = 0.8; }
const fmt = t => { const m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0'); };

const mini = $('mini').getContext('2d');
let mmin = [1e9, 1e9], mmax = [-1e9, -1e9];
P.forEach(p => { mmin[0] = Math.min(mmin[0], p.x); mmin[1] = Math.min(mmin[1], p.z); mmax[0] = Math.max(mmax[0], p.x); mmax[1] = Math.max(mmax[1], p.z); });
const msc = 330 / Math.max(mmax[0] - mmin[0], mmax[1] - mmin[1]);
const mx = x => 220 + (x - (mmin[0] + mmax[0]) / 2) * msc, mz = z => 220 + (z - (mmin[1] + mmax[1]) / 2) * msc;
function drawMini() {
  mini.clearRect(0, 0, 440, 440);
  mini.lineJoin = 'round';
  for (const [w, c] of [[22, 'rgba(0,0,0,.5)'], [14, '#dfe8f5']]) {
    mini.strokeStyle = c; mini.lineWidth = w; mini.beginPath();
    P.forEach((p, i) => i % 4 === 0 && (i ? mini.lineTo(mx(p.x), mz(p.z)) : mini.moveTo(mx(p.x), mz(p.z)))); mini.closePath(); mini.stroke();
  }
  mini.fillStyle = '#fff'; mini.fillRect(mx(P[0].x) - 3, mz(P[0].z) - 14, 6, 28);
  racers.slice().reverse().forEach(r => {
    mini.save(); mini.translate(mx(r.pos.x), mz(r.pos.z)); mini.rotate(-r.h + Math.PI);
    mini.fillStyle = r.isPlayer ? '#ffd84a' : '#' + r.car.tailMat.color.getHexString();
    if (!r.isPlayer) mini.fillStyle = ['#b46bff', '#2fb35a', '#fff'][racers.indexOf(r) - 1] || '#f44';
    mini.strokeStyle = '#000'; mini.lineWidth = 3;
    const s = r.isPlayer ? 16 : 11;
    mini.beginPath(); mini.moveTo(0, s); mini.lineTo(s * 0.7, -s * 0.7); mini.lineTo(0, -s * 0.3); mini.lineTo(-s * 0.7, -s * 0.7); mini.closePath(); mini.fill(); mini.stroke();
    mini.restore();
  });
}
const sp = $('speedo').getContext('2d');
function drawSpeedo(kmh, r) {
  sp.clearRect(0, 0, 520, 520);
  const cx = 260, cy = 290, R = 200, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, maxK = 320;
  sp.lineCap = 'round';
  sp.strokeStyle = 'rgba(0,20,50,.6)'; sp.lineWidth = 46; sp.beginPath(); sp.arc(cx, cy, R, a0, a1); sp.stroke();
  const f = clamp(kmh / maxK, 0, 1);
  const g = sp.createLinearGradient(0, 520, 520, 0); g.addColorStop(0, '#29f'); g.addColorStop(0.6, '#0ff'); g.addColorStop(1, r.boost.nitro > 0 ? '#fff' : '#ff0');
  sp.strokeStyle = g; sp.lineWidth = 30; sp.shadowColor = '#0cf'; sp.shadowBlur = 20;
  sp.beginPath(); sp.arc(cx, cy, R, a0, a0 + (a1 - a0) * f); sp.stroke(); sp.shadowBlur = 0;
  sp.fillStyle = '#fff'; sp.font = '600 22px sans-serif'; sp.textAlign = 'center'; sp.textBaseline = 'middle';
  for (let k = 0; k <= 8; k++) { const a = a0 + (a1 - a0) * k / 8; sp.fillText(k * 40, cx + Math.cos(a) * (R - 52), cy + Math.sin(a) * (R - 52)); }
  sp.font = 'italic 900 112px sans-serif'; sp.fillStyle = r.boost.nitro > 0 ? '#9ff' : '#fff'; sp.shadowColor = '#08f'; sp.shadowBlur = 18;
  sp.fillText(Math.round(kmh), cx, cy - 6); sp.shadowBlur = 0;
  sp.font = '700 26px sans-serif'; sp.fillStyle = '#9cf'; sp.fillText('km/h', cx, cy + 62);
  if (r.drift) { sp.font = 'italic 900 34px sans-serif'; sp.fillStyle = '#ffd84a'; sp.fillText('DRIFT', cx, cy + 110); }
}
// 速度线
const fx = $('fx'), fxc = fx.getContext('2d');
function drawFX(intensity) {
  fxc.clearRect(0, 0, fx.width, fx.height);
  if (intensity <= 0.01) return;
  const cx = fx.width / 2, cy = fx.height * 0.45, R = Math.hypot(cx, cy);
  fxc.strokeStyle = `rgba(200,240,255,${0.22 * intensity})`;
  for (let k = 0; k < 45 * intensity; k++) {
    const a = Math.random() * Math.PI * 2, r0 = R * rand(0.45, 0.8), r1 = r0 + R * rand(0.15, 0.35);
    fxc.lineWidth = rand(1, 3);
    fxc.beginPath(); fxc.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); fxc.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); fxc.stroke();
  }
  const vg = fxc.createRadialGradient(cx, cy, R * 0.5, cx, cy, R);
  vg.addColorStop(0, 'rgba(0,120,255,0)'); vg.addColorStop(1, `rgba(0,140,255,${0.16 * intensity})`);
  fxc.fillStyle = vg; fxc.fillRect(0, 0, fx.width, fx.height);
}
// ---------- 摄像机 ----------
const camPos = new V3(), camLook = new V3();
let camYaw = 0, camFov = 65;
function updateCamera(dt, r) {
  // 漂移时镜头滞后于车头，看到车身侧滑
  const target = r.drift ? r.moveAng + r.slip * 0.35 : r.h;
  camYaw += wrapAng(target - camYaw) * Math.min(1, dt * (r.drift ? 3.2 : 6));
  const dist = [7.5, 12, 0.01][camMode], ht = [2.9, 4.8, 1.25][camMode];
  const back = fwd(camYaw), boostK = r.boost.nitro > 0 ? 1 : r.boosting() ? 0.5 : 0;
  const d = dist + boostK * 1.4 * (camMode < 2 ? 1 : 0);
  const want = new V3(r.pos.x - back.x * d, r.y + ht, r.pos.z - back.z * d);
  if (camMode === 2) want.copy(r.pos).addScaledVector(fwd(r.h), 0.3).setY(r.y + 1.3);
  if (state === 'count') camPos.copy(want); else camPos.lerp(want, Math.min(1, dt * (camMode === 2 ? 30 : 10)));
  // 不钻进地形：最低高度
  const ti = trackInfo(camPos, nearestIdx(camPos, r.idx, 20));
  if (camPos.y < ti.y + 1) camPos.y = ti.y + 1;
  camera.position.copy(camPos);
  if (shake > 0) { camera.position.add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake * 0.3)); shake = Math.max(0, shake - dt * 1.5); }
  camLook.copy(r.pos).addScaledVector(fwd(camMode === 2 ? r.h : camYaw), camMode === 2 ? 10 : 4).setY(r.y + (camMode === 2 ? 1.1 : 1.3));
  camera.lookAt(camLook);
  const kmh = Math.abs(r.speed) * 3.6;
  camFov = lerp(camFov, 62 + clamp(kmh / 300, 0, 1) * 14 + boostK * 8, Math.min(1, dt * 3));
  camera.fov = camFov; camera.updateProjectionMatrix();
  // 阴影相机跟随
  sun.position.copy(r.pos).addScaledVector(sunDir, 200); sun.target.position.copy(r.pos);
}

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let elapsed = 0;
const lights = () => window.__startLights;
function step(dt) {
  elapsed += dt;
  waterNormal.offset.x += dt * 0.01; waterNormal.offset.y += dt * 0.006;
  foam.material.opacity = 0.35 + Math.sin(elapsed * 1.2) * 0.15;
  anim.forEach(f => f(dt, elapsed));
  for (const b of BOXES) { b.mesh.rotation.y += dt * 1.6; b.mesh.rotation.x = Math.sin(elapsed * 2 + b.lat) * 0.3; b.mesh.position.y = off(b.i, b.lat).y + 1.8 + Math.sin(elapsed * 3 + b.i) * 0.25; if (b.cd > 0) { b.cd -= dt; b.mesh.visible = b.cd <= 0; } }

  if (state === 'count') {
    const prev = Math.ceil(countdown);
    countdown -= dt;
    const now = Math.ceil(countdown);
    if (now !== prev && now > 0) { flash(String(now), '#ffd84a', 0.9); Audio.beep(520, 0.25, 'square', 0.3); const L = lights()[3 - now]; L.material.color.set(0xff2020); L.material.emissive.set(0xff0000); L.material.emissiveIntensity = 3; }
    // 起步喷：最后 0.35 秒按下加速
    if (pressed.up) startBoostOK = countdown < 0.35 && countdown > 0;
    if (countdown <= 0) {
      state = 'race'; flash('GO!', '#5f5', 1); Audio.beep(1040, 0.5, 'square', 0.35);
      lights().forEach(l => { l.material.color.set(0x20ff40); l.material.emissive.set(0x00ff30); });
      if (startBoostOK && keys.up) { player.boost.start = 1.6; player.speed = 20; combo('完美起步 !'); Audio.whoosh(0.6, 0.8); }
      racers.forEach(r => { if (!r.isPlayer && Math.random() < 0.6) { r.boost.start = 1.2; r.speed = 15; } });
    }
  }
  const racing = state === 'race' || state === 'done';
  if (racing) raceT += dt;

  for (const r of racers) {
    let ctrl, st = 0;
    if (!racing || r.finished && !r.isPlayer) ctrl = { up: false, down: r.finished, left: false, right: false, drift: false };
    else if (r.isPlayer) {
      ctrl = state === 'done' ? { up: false, down: true } : { up: keys.up, down: keys.down, left: keys.left, right: keys.right, drift: keys.drift, upTap: pressed.up, nitroTap: pressed.nitro };
    } else ctrl = aiControl(r, dt, player, raceT);
    if (racing) { const res = updatePlayer(r, dt, ctrl); st = res.steer; }
    const ti = constrain(r, dt);
    // 加速带
    for (const p of PADS) { let di = r.idx - p.i; if (di < 0) di += N; if (di < 5 && Math.abs(ti.lat - p.lat) < 3.5 && r.boost.pad < 0.9) { r.boost.pad = 1.0; if (r.isPlayer) { combo('加速带'); Audio.whoosh(0.4, 0.5); } } }
    // 氮气箱
    for (const b of BOXES) if (b.cd <= 0 && r.pos.distanceToSquared(b.mesh.position) < 7) {
      b.cd = 4; b.mesh.visible = false;
      if (r.slots < 2) r.slots++; else r.gauge = 0.999;
      if (r.isPlayer) { flash('获得氮气', '#5cf', 0.7); Audio.beep(1200, 0.1, 'triangle', 0.3); Audio.beep(1600, 0.15, 'triangle', 0.25); }
    }
    // 圈数 / 完赛
    if (r.cross > (r.lapShown || 0) && !r.finished) {
      if (r.isPlayer && r.cross > 1) { lapTimes.push(raceT - lapStart); lapStart = raceT; }
      r.lapShown = r.cross;
      if (r.cross > LAPS) { r.finished = true; r.finishT = raceT; if (r.isPlayer) finishRace(); }
      else if (r.isPlayer && r.cross === LAPS) flash('最后一圈', '#f84', 1.4);
    }
    updateVisual(r, dt, st);
  }
  // 车与车碰撞
  for (let a = 0; a < racers.length; a++) for (let b = a + 1; b < racers.length; b++) {
    const A = racers[a], B = racers[b], dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < 5.5 && d2 > 1e-4) {
      const d = Math.sqrt(d2), push = (2.35 - d) / 2, nx = dx / d, nz = dz / d;
      A.pos.x -= nx * push; A.pos.z -= nz * push; B.pos.x += nx * push; B.pos.z += nz * push;
      const fa = Math.cos(A.moveAng) * nz + Math.sin(A.moveAng) * nx;
      if (fa > 0.5) { A.speed *= 0.97; } else if (fa < -0.5) B.speed *= 0.97;
      if ((A.isPlayer || B.isPlayer) && Math.abs(A.speed - B.speed) > 4) { Audio.thud(); shake = 0.25; }
    }
  }
  // 逆行检测
  const along = Math.cos(wrapAng(player.h - tanAng(player.idx)));
  player.wrongT = state === 'race' && along < -0.3 && player.speed > 3 ? player.wrongT + dt : 0;
  $('warn').style.display = player.wrongT > 1.2 ? 'block' : 'none';
  if (pressed.reset && racing && !player.finished) {
    const i = player.idx, ti = trackInfo(player.pos, i); player.place(i, clamp(ti.lat, -HW + 3, HW - 3)); player.drift = 0; flash('复位', '#fff', 0.6);
  }
  smoke.update(dt, 1.2, 0.5); fire.update(dt, 4, 1); sparks.update(dt, 1, 1);
  updateCamera(dt, player);
  Audio.update(clamp(player.speed / (BASE_TOP * 1.4), 0, 1), player.drift ? Math.abs(player.slip) * 1.6 : (player.ctrlDown && player.speed > 15 ? 0.6 : 0), player.boost.nitro > 0, racing || state === 'count');
  // HUD
  if (state !== 'menu') {
    const sorted = racers.slice().sort((a, b) => (b.finished - a.finished) || (a.finished ? a.finishT - b.finishT : b.progress - a.progress));
    const rank = sorted.indexOf(player) + 1;
    $('rank').innerHTML = rank + '<small>/' + racers.length + '</small>';
    $('lapN').textContent = clamp(player.cross, 1, LAPS);
    $('time').textContent = fmt(raceT);
    $('lapTimes').innerHTML = lapTimes.map((t, i) => `第${i + 1}圈 ${fmt(t)}`).join('<br>');
    $('nfill').style.width = (player.slots >= 2 ? 100 : player.gauge * 100) + '%';
    $('npct').textContent = (player.slots >= 2 ? '已满' : Math.floor(player.gauge * 100) + '%');
    $('s0').classList.toggle('on', player.slots >= 1); $('s1').classList.toggle('on', player.slots >= 2);
    drawSpeedo(Math.abs(player.speed) * 3.6, player); drawMini();
    drawFX(player.boost.nitro > 0 ? 1 : player.boosting() ? 0.45 : 0);
    window.__sorted = sorted;
  }
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) msgEl.style.opacity = 0; }
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) comboEl.style.opacity = 0; }
  bloom.strength = player && player.boost.nitro > 0 ? 0.42 : 0.3;
  for (const k in pressed) pressed[k] = false;
}
function finishRace() {
  state = 'done';
  flash('完成 !', '#ffd84a', 2.5);
  setTimeout(() => {
    racers.forEach(r => { if (!r.finished) { r.finished = true; r.finishT = raceT + (player.progress - r.progress) / Math.max(r.speed, 30); } });
    const s = racers.slice().sort((a, b) => a.finishT - b.finishT);
    $('rtab').innerHTML = '<tr><td>名次</td><td>车手</td><td>赛车</td><td>用时</td></tr>' + s.map((r, i) => `<tr class="${r.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td>${r.name}</td><td>${r.spec.name}</td><td>${fmt(r.finishT)}</td></tr>`).join('');
    $('result').style.display = 'flex';
  }, 3000);
}

let paused = false;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  if (pressed.pause && state !== 'menu') { paused = !paused; $('pause').style.display = paused ? 'flex' : 'none'; pressed.pause = false; if (Audio.ctx) paused ? Audio.ctx.suspend() : Audio.ctx.resume(); }
  if (pressed.cam) camMode = (camMode + 1) % 3;
  if (pressed.music) Audio.toggleMusic();
  if (pressed.help) { const k = $('keys'); k.style.display = k.style.display === 'none' ? '' : 'none'; }
  if (paused) { for (const k in pressed) pressed[k] = false; return; }
  if (state === 'menu') {
    // 菜单：环绕镜头
    elapsed += dt; anim.forEach(f => f(dt, elapsed));
    const a = elapsed * 0.08; camera.position.set(Math.cos(a) * 160 - 20, 45, Math.sin(a) * 120 - 60); camera.lookAt(0, 8, -100);
    sun.position.set(0, 0, 0).addScaledVector(sunDir, 200); sun.target.position.set(0, 0, 0);
    for (const k in pressed) pressed[k] = false;
  } else step(dt);
  composer.render();
}
function resize() {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  fx.width = innerWidth; fx.height = innerHeight;
  [smoke, fire, sparks].forEach(p => p.mat.uniforms.scale.value = innerHeight / 2);
}
addEventListener('resize', resize); resize();

document.querySelectorAll('.car').forEach(el => el.onclick = () => { document.querySelectorAll('.car').forEach(e => e.classList.remove('sel')); el.classList.add('sel'); selCar = +el.dataset.i; });
function start() {
  Audio.init(); Audio.ctx.resume();
  $('menu').style.display = 'none'; $('result').style.display = 'none'; $('hud').style.display = 'block';
  setupRace(); state = 'count'; camYaw = player.h; paused = false;
  flash('准备', '#fff', 0.9);
}
$('start').onclick = start; $('again').onclick = start;
$('loading').style.display = 'none';
window.__game = { get player() { return player; }, get state() { return state; }, keys, pressed, start, get racers() { return racers; } };
frame();
