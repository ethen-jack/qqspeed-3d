import * as THREE from 'three';

export const HALF = 9;          // 路面半宽（米）
export const WALL = HALF + 0.6; // 护栏位置
const WALL_MIR = [0, 1];

// 海滨小镇风格赛道控制点 [x, y, z]：长直道 → 高架大弯 → S 弯 → 海边发卡弯 → 回到起点
const CTRL = [
  [0,0,150],[0,0,-100],[10,0,-220],[60,2,-300],[150,6,-325],[240,10,-285],[282,12,-200],
  [262,12,-120],[205,10,-82],[170,8,-20],[212,5,42],[300,2,62],[362,0,132],[342,0,232],
  [262,0,272],[182,0,228],[120,0,282],[58,0,302],[8,0,262]
];

export function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

export function buildTrack(scene) {
  const curve = new THREE.CatmullRomCurve3(CTRL.map(p => new THREE.Vector3(...p)), true, 'centripetal');
  const len = curve.getLength();
  const N = Math.round(len);
  const pts = curve.getSpacedPoints(N); pts.pop();
  const step = len / N;
  const P = [], T = [], Nn = [], K = [];
  for (let i = 0; i < N; i++) {
    const t = pts[(i + 1) % N].clone().sub(pts[(i - 1 + N) % N]).normalize();
    P.push(pts[i]); T.push(t); Nn.push(new THREE.Vector3(t.z, 0, -t.x).normalize()); // Nn = 左侧法线
  }
  for (let i = 0; i < N; i++) {
    const a = T[i], b = T[(i + 6) % N];
    K.push(-Math.asin(THREE.MathUtils.clamp(a.x * b.z - a.z * b.x, -1, 1)) / (6 * step)); // >0 左弯
  }

  const track = {
    curve, N, step, len, P, T, Nn, K,
    nearest(pos, hint = -1) {
      let best = 1e18, bi = 0;
      const scan = (i) => { const p = P[i], dx = pos.x - p.x, dz = pos.z - p.z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } };
      if (hint < 0) for (let i = 0; i < N; i++) scan(i);
      else for (let o = -40; o <= 40; o++) scan((hint + o + N) % N);
      return bi;
    },
    // 赛道局部坐标：lat>0 在左侧
    local(pos, i) {
      const p = P[i], t = T[i], n = Nn[i], dx = pos.x - p.x, dz = pos.z - p.z;
      const h2 = t.x * t.x + t.z * t.z;
      return { lat: dx * n.x + dz * n.z, y: p.y + (dx * t.x + dz * t.z) * t.y / h2 };
    },
    wrap(i) { return ((i % N) + N) % N; },
  };

  // —— 纹理 ——
  const roadTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#505359'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 9000; k++) { const v = 60 + Math.random() * 50 | 0; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#f2f2f2'; g.fillRect(w * .035, 0, w * .022, h); g.fillRect(w * .943, 0, w * .022, h);
    g.fillStyle = '#ffd23a'; g.fillRect(w * .488, 0, w * .024, h * .55);
    g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(w * .26, 0, w * .012, h * .3); g.fillRect(w * .73, 0, w * .012, h * .3);
  });
  const curbTex = canvasTex(16, 64, (g, w, h) => { g.fillStyle = '#e8262b'; g.fillRect(0, 0, w, h / 2); g.fillStyle = '#fff'; g.fillRect(0, h / 2, w, h / 2); });
  const wallTexFn = (mir) => canvasTex(64, 1024, (g, w, h) => {
    g.fillStyle = '#1679e0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
    g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); if (mir) g.scale(-1, 1);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic 900 34px sans-serif'; g.fillStyle = '#ffe14a'; g.fillText('QQ飞车  SPEED', -250, 0);
    g.fillStyle = '#fff'; g.fillText('海滨小镇  RACING', 250, 0); g.restore();
  });
  const grassTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#5fae3c'; g.fillRect(0, 0, w, h); for (let k = 0; k < 1500; k++) { g.fillStyle = Math.random() < .5 ? '#6bbd45' : '#529a33'; g.fillRect(Math.random() * w, Math.random() * h, 2, 3); } });

  function ribbon(oA, hA, oB, hB, texLen, mat, absB = false) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const j = i % N, p = P[j], n = Nn[j];
      pos.push(p.x + n.x * oA, p.y + hA, p.z + n.z * oA, p.x + n.x * oB, absB ? hB : p.y + hB, p.z + n.z * oB);
      const v = i * step / texLen; uv.push(0, v, 1, v);
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m); return m;
  }
  const S = THREE.DoubleSide;
  ribbon(HALF, .02, -HALF, .02, 14, new THREE.MeshStandardMaterial({ map: roadTex, roughness: .85, side: S }));
  const curbM = new THREE.MeshStandardMaterial({ map: curbTex, roughness: .6, side: S });
  ribbon(HALF, .05, HALF - 1, .05, 3, curbM); ribbon(-HALF + 1, .05, -HALF, .05, 3, curbM);
  const shM = new THREE.MeshStandardMaterial({ map: grassTex, side: S });
  ribbon(WALL, .03, HALF, .03, 4, shM); ribbon(-HALF, .03, -WALL, .03, 4, shM);
  ribbon(WALL, 1.3, WALL, 0, 34, new THREE.MeshStandardMaterial({ map: wallTexFn(WALL_MIR[0]), roughness: .5, side: S }));
  ribbon(-WALL, 1.3, -WALL, 0, 34, new THREE.MeshStandardMaterial({ map: wallTexFn(WALL_MIR[1]), roughness: .5, side: S }));
  const skirtM = new THREE.MeshStandardMaterial({ color: 0xbfc4cc, roughness: .9, side: S });
  ribbon(WALL, 0, WALL, -1, 10, skirtM, true); ribbon(-WALL, 0, -WALL, -1, 10, skirtM, true);
  ribbon(WALL, 1.3, WALL + .3, 1.3, 10, skirtM); ribbon(-WALL, 1.3, -WALL - .3, 1.3, 10, skirtM);

  // 高架桥墩
  const pillarGeo = new THREE.CylinderGeometry(1.1, 1.4, 1, 12);
  for (let i = 0; i < N; i += 14) if (P[i].y > 1.5) {
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(pillarGeo, skirtM); m.scale.y = P[i].y;
      m.position.set(P[i].x + Nn[i].x * s * 5, P[i].y / 2, P[i].z + Nn[i].z * s * 5); m.castShadow = true; scene.add(m);
    }
  }
  return track;
}
