import * as THREE from 'three';
import { WALL } from './track.js';

export const BASE_MAX = 46;   // 普通极速 m/s
const ACCEL = 26, BRAKE = 48, REV_MAX = 12;
const GRIP = 9, DRIFT_GRIP = 1.35;
const LIMIT = WALL - 1.05;
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

export class Racer {
  constructor(kart, track, name, isAI = false) {
    Object.assign(this, { kart, track, name, isAI });
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.reset();
    this.events = []; // 给 UI/音效的事件
  }
  reset() {
    this.angle = 0; this.steer = 0; this.i = 0; this.lat = 0;
    this.in = { up: 0, down: 0, left: 0, right: 0, drift: 0, nitro: 0, upTap: 0, nitroTap: 0 };
    this.drifting = false; this.driftDir = 0; this.driftT = 0; this.recover = 0;
    this.charge = 0; this.nitro = 0; this.boostT = 0; this.miniT = 0; this.padT = 0;
    this.miniWin = 0; this.combo = 0; this.comboT = 0; this.doubleWin = 0;
    this.crossings = 0; this.finished = false; this.finishTime = 0; this.wrongT = 0; this.stuckT = 0;
    this.lean = 0; this.slip = 0; this.hit = 0; this.capMul = 1;
  }
  spawn(i, lat) {
    const T = this.track; this.reset();
    this.i = i; const p = T.P[i], n = T.Nn[i];
    this.pos.set(p.x + n.x * lat, p.y, p.z + n.z * lat); this.vel.set(0, 0, 0);
    this.angle = Math.atan2(T.T[i].x, T.T[i].z);
    this.place();
  }
  respawn() {
    const T = this.track, i = this.i, p = T.P[i];
    this.pos.set(p.x, p.y, p.z); this.vel.set(0, 0, 0); this.angle = Math.atan2(T.T[i].x, T.T[i].z);
    this.drifting = false; this.boostT = 0; this.stuckT = 0; this.wrongT = 0;
  }
  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get progress() { return this.crossings * this.track.N + this.i; }
  emit(type, v) { this.events.push([type, v]); }

  step(dt, frozen, pads) {
    const I = this.in, T = this.track;
    const fx = Math.sin(this.angle), fz = Math.cos(this.angle);
    let vf = this.vel.x * fx + this.vel.z * fz;           // 纵向速度
    let vl = this.vel.x * fz - this.vel.z * fx;           // 侧向速度（左为正）
    const sp = Math.abs(vf);
    const sIn = frozen ? 0 : I.right - I.left;
    this.steer += THREE.MathUtils.clamp(sIn - this.steer, -dt * 7, dt * 7);
    const s = this.steer;

    // —— 漂移状态机 ——
    if (!frozen && !this.drifting && I.drift && Math.abs(sIn) > .3 && vf > 14) {
      this.drifting = true; this.driftDir = Math.sign(sIn); this.driftT = 0;
      if (this.comboT > 0) { this.combo++; this.emit('combo', this.combo); } else this.combo = 1;
      this.emit('driftStart');
    }
    if (this.drifting) {
      this.driftT += dt;
      const counter = sIn !== 0 && Math.sign(sIn) !== this.driftDir;
      const hold = I.drift || (sIn === this.driftDir && this.driftT > .25);
      if (counter && !I.drift || !hold && this.driftT > .25 || vf < 9) {
        this.drifting = false; this.recover = counter ? .12 : .35;
        if (this.driftT > .35 && vf > 12) { this.miniWin = .5; this.emit('driftEnd'); }
      }
    }
    if (this.recover > 0) this.recover -= dt;

    // —— 小喷 / 氮气 ——
    if (this.miniWin > 0) {
      if (I.upTap) {
        const perfect = this.miniWin > .32;
        this.miniT = perfect ? .9 : .55; this.miniWin = 0; this.comboT = 1.1;
        this.charge = Math.min(100, this.charge + (perfect ? 6 : 3));
        this.emit('mini', perfect);
      }
      this.miniWin -= dt;
    }
    if (this.comboT > 0) this.comboT -= dt;
    if (I.nitroTap && this.nitro > 0 && this.boostT <= 0 && !frozen) {
      this.nitro--; this.boostT = 3.2; this.doubleWin = .45; this.emit('nitro');
    }
    if (this.doubleWin > 0) {
      if (I.upTap && this.boostT > 0 && this.boostT < 3.05) { this.boostT += .6; this.doubleWin = 0; this.emit('double'); }
      this.doubleWin -= dt;
    }
    I.upTap = 0; I.nitroTap = 0;
    if (this.boostT > 0) this.boostT -= dt;
    if (this.miniT > 0) this.miniT -= dt;
    if (this.padT > 0) this.padT -= dt;

    // 加速带
    if (this.padT <= .3) for (const pd of pads) {
      let d = Math.abs(this.i - pd.i); d = Math.min(d, T.N - d);
      if (d < 4 && Math.abs(this.lat - pd.lat) < 2.6) { if (this.padT <= 0) this.emit('pad'); this.padT = 1.3; }
    }

    // —— 纵向 ——
    const boosting = this.boostT > 0, mini = this.miniT > 0, pad = this.padT > 0;
    let cap = BASE_MAX * this.capMul;
    if (mini) cap = Math.max(cap, 55); if (pad) cap = Math.max(cap, 60); if (boosting) cap = Math.max(cap, 66);
    const gas = frozen ? 0 : I.up - I.down;
    if (boosting || mini || pad) { if (vf < cap) vf += (boosting ? 40 : 34) * dt; }
    if (gas > 0) { if (vf < cap) vf += ACCEL * Math.max(.25, 1 - .72 * vf / BASE_MAX) * dt; }
    else if (gas < 0) { vf -= (vf > 0 ? BRAKE : 14) * dt; if (vf < -REV_MAX) vf = -REV_MAX; }
    else vf -= Math.sign(vf) * Math.min(Math.abs(vf), (frozen ? 30 : 7) * dt);
    if (vf > cap) vf -= Math.min(vf - cap, (vf - cap) * 1.6 * dt + 3 * dt);
    if (this.drifting) vf -= vf * .05 * dt;

    // —— 转向 ——
    const sf = Math.min(1, sp / 9) * (1 - .38 * Math.min(sp, 66) / 66);
    let yaw;
    if (this.drifting) yaw = (this.driftDir * 1.25 + s * .95) * Math.min(1, sp / 12);
    else yaw = s * 2.0 * sf * Math.sign(vf || 1);
    this.angle = wrapA(this.angle - yaw * dt);

    // 速度向量随车头重新分解（侧滑来自车头转得比速度快）
    const nfx = Math.sin(this.angle), nfz = Math.cos(this.angle);
    const vx = nfx * vf + nfz * vl, vz = nfz * vf - nfx * vl;
    vf = vx * nfx + vz * nfz; vl = vx * nfz - vz * nfx;
    const grip = this.drifting ? DRIFT_GRIP : this.recover > 0 ? 4 : GRIP;
    const nvl = vl * Math.exp(-grip * dt);
    if (this.drifting) vf += Math.abs(vl - nvl) * .55 * Math.sign(vf); // 漂移能量保持
    vl = nvl;
    this.slip = Math.atan2(Math.abs(vl), Math.abs(vf) + .1);
    this.vel.set(nfx * vf + nfz * vl, 0, nfz * vf - nfx * vl);

    // 集气
    if (this.drifting && !boosting && vf > 12) {
      this.charge += (6 + this.slip * 70) * dt * Math.min(1, vf / 30);
      if (this.charge >= 100) {
        if (this.nitro < 2) { this.nitro++; this.emit('gotNitro'); }
        this.charge = this.nitro < 2 ? 0 : 99.9;
      }
    }
    this.lean += ((this.drifting ? this.driftDir * .14 : s * .07 * Math.min(1, sp / 20)) - this.lean) * Math.min(1, dt * 8);

    // —— 积分 + 赛道约束 ——
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const prevI = this.i;
    this.i = T.nearest(this.pos, this.i);
    const loc = T.local(this.pos, this.i); this.lat = loc.lat; this.pos.y = loc.y;
    if (Math.abs(loc.lat) > LIMIT) {
      const n = T.Nn[this.i], sg = Math.sign(loc.lat), over = Math.abs(loc.lat) - LIMIT;
      this.pos.x -= n.x * sg * over; this.pos.z -= n.z * sg * over; this.lat = sg * LIMIT;
      const vn = (this.vel.x * n.x + this.vel.z * n.z) * sg;
      if (vn > 0) {
        this.vel.x -= n.x * sg * vn * 1.25; this.vel.z -= n.z * sg * vn * 1.25;
        this.vel.multiplyScalar(vn > 8 ? .8 : .985);
        if (vn > 6) { this.hit = Math.min(1, vn / 20); this.emit('wall', vn); if (vn > 12) this.drifting = false; }
      }
    }
    // 过线计圈
    if (prevI > T.N * .8 && this.i < T.N * .2) { this.crossings++; this.emit('cross'); }
    else if (prevI < T.N * .2 && this.i > T.N * .8) this.crossings--;

    // 逆行 / 卡住
    const tf = T.T[this.i], dotT = nfx * tf.x + nfz * tf.z;
    this.wrongT = dotT < -.4 && sp > 4 ? this.wrongT + dt : 0;
    this.stuckT = !frozen && sp < 1.5 ? this.stuckT + dt : 0;
    if (this.hit > 0) this.hit -= dt * 2;
  }

  place() {
    const k = this.kart, u = k.userData, T = this.track.T[this.i];
    k.position.copy(this.pos);
    k.rotation.order = 'YXZ'; k.rotation.y = this.angle;
    const dir = Math.sign(Math.sin(this.angle) * T.x + Math.cos(this.angle) * T.z) || 1;
    k.rotation.x = -Math.asin(T.y) * dir;
    u.body.rotation.z = this.lean; u.body.position.y = Math.sin(performance.now() * .03) * .008 * Math.min(1, this.speed / 20);
    const vf = this.vel.x * Math.sin(this.angle) + this.vel.z * Math.cos(this.angle);
    for (const w of u.wheels) w.rotation.x += vf * .016 / .34;
    const st = this.drifting ? this.driftDir * .35 : -this.steer * .45;
    for (const p of u.pivots) p.rotation.y = st;
    u.head.rotation.y = -this.steer * .3;
    const fl = this.boostT > 0 || this.miniT > 0 || this.padT > 0;
    for (const f of u.flames) { f.visible = fl; if (fl) { const sc = (this.boostT > 0 ? 1.1 : .6) * (.8 + Math.random() * .4); f.scale.set(1, 1, sc); } }
  }
}

// —— AI 驾驶 ——
export function aiDrive(r, skill, dt) {
  const T = r.track, sp = r.speed, I = r.in;
  const look = 7 + Math.floor(sp * .42), j = T.wrap(r.i + look);
  let ks = 0; for (let o = -12; o <= 12; o += 3) ks += T.K[T.wrap(j + o)]; ks /= 9;
  const lineLat = THREE.MathUtils.clamp(ks * 380, -1, 1) * 5.2 + r.aiOffset;
  const p = T.P[j], n = T.Nn[j];
  const tx = p.x + n.x * lineLat - r.pos.x, tz = p.z + n.z * lineLat - r.pos.z;
  const err = wrapA(Math.atan2(tx, tz) - r.angle);
  const st = THREE.MathUtils.clamp(-err * 2.8, -1, 1);
  I.right = st > .08 ? Math.min(1, st) : 0; I.left = st < -.08 ? Math.min(1, -st) : 0;
  let kmax = 0; for (let o = 4; o < 70; o += 3) kmax = Math.max(kmax, Math.abs(T.K[T.wrap(r.i + o)]));
  const vTurn = 2.25 / (kmax + .0145) * skill;
  const target = Math.min(BASE_MAX * skill * 1.02, vTurn);
  I.up = sp < target + 2 ? 1 : 0; I.down = sp > target + 7 ? 1 : 0;
  const wantDrift = kmax > .018 && sp > 26 && Math.abs(err) > .07;
  I.drift = wantDrift && !(r.drifting && Math.abs(err) < .03) ? 1 : 0;
  if (r.miniWin > 0 && r.miniWin < .42 && Math.random() < .3) I.upTap = 1;
  if (r.nitro > 0 && kmax < .006 && r.boostT <= 0 && Math.random() < dt * 1.2) I.nitroTap = 1;
  if (r.stuckT > 2.5 || r.wrongT > 1.5) r.respawn();
}
