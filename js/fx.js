import * as THREE from 'three';

// 粒子：漂移烟、火花、氮气尾焰
export class Particles {
  constructor(scene, max = 1400) {
    this.max = max; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grow = new Float32Array(max);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: `attribute float size;attribute float alpha;attribute vec3 color;varying vec3 vc;varying float va;
        void main(){vc=color;va=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*600./-mv.z;gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vc;varying float va;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vc,va*smoothstep(.5,.1,d));}`
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; scene.add(this.points);
    this.geo = g;
  }
  spawn(p, v, color, size, life, grow = 1) {
    const i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.pos.set([p.x, p.y, p.z], i * 3); this.v.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.size[i] = size; this.life[i] = this.maxLife[i] = life; this.grow[i] = grow;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { // 与末尾交换
        const j = --this.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[j * 3 + k]; this.v[i * 3 + k] = this.v[j * 3 + k]; this.col[i * 3 + k] = this.col[j * 3 + k]; }
          this.size[i] = this.size[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.grow[i] = this.grow[j];
        }
        i--; continue;
      }
      this.pos[i * 3] += this.v[i * 3] * dt; this.pos[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.v[i * 3 + 1] -= dt * (this.grow[i] < 0 ? 9 : 0);
      this.size[i] += Math.abs(this.grow[i]) * dt;
      this.alpha[i] = this.life[i] / this.maxLife[i] * (this.grow[i] < 0 ? 1 : .55);
    }
    this.geo.setDrawRange(0, this.n);
    for (const a of ['position', 'color', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
  }
}

// 轮胎刹车印
export class SkidMarks {
  constructor(scene, max = 1600) {
    this.max = max; this.k = 0;
    this.pos = new Float32Array(max * 4 * 3);
    const idx = [];
    for (let i = 0; i < max; i++) { const b = i * 4; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setIndex(idx);
    this.geo = g;
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.frustumCulled = false; scene.add(m);
    this.last = new Map();
  }
  add(id, p, side) {
    const prev = this.last.get(id);
    this.last.set(id, { p: p.clone(), side: side.clone() });
    if (!prev || prev.p.distanceToSquared(p) > 9) return;
    const i = this.k++ % this.max, o = i * 12, w = .14;
    const a = [prev.p.x - prev.side.x * w, prev.p.y + .06, prev.p.z - prev.side.z * w, prev.p.x + prev.side.x * w, prev.p.y + .06, prev.p.z + prev.side.z * w,
      p.x - side.x * w, p.y + .06, p.z - side.z * w, p.x + side.x * w, p.y + .06, p.z + side.z * w];
    this.pos.set(a, o); this.geo.attributes.position.needsUpdate = true;
  }
  cut(id) { this.last.delete(id); }
}
