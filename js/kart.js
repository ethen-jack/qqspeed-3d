import * as THREE from 'three';

// 卡丁车模型（车头朝 +z）
export function buildKart(color = 0xff2a2a, helmet = 0xffffff) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, metalness: .55, roughness: .28 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: .6, metalness: .3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: .15 });
  const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

  add(new THREE.BoxGeometry(1.5, .28, 2.7), dark, 0, .32, 0);                       // 底盘
  const nose = add(new THREE.CylinderGeometry(.18, .55, 1.2, 4, 1), paint, 0, .5, 1.2); // 车头
  nose.rotation.set(Math.PI / 2, Math.PI / 4, 0); nose.scale.set(1.5, 1, .6);
  add(new THREE.BoxGeometry(1.25, .35, 1.3), paint, 0, .58, .1);                    // 车身
  for (const s of [-1, 1]) {
    const pod = add(new THREE.BoxGeometry(.38, .32, 1.5), paint, s * .72, .5, -.05); pod.rotation.y = s * .06; // 侧箱
    add(new THREE.BoxGeometry(.06, .42, .5), chrome, s * .75, 1.2, -1.15);            // 尾翼支架
  }
  add(new THREE.BoxGeometry(1.7, .07, .5), paint, 0, 1.43, -1.2);                     // 尾翼
  add(new THREE.BoxGeometry(1.5, .2, .35), dark, 0, .45, 1.72);                       // 前保险杠
  add(new THREE.BoxGeometry(.9, .45, .5), dark, 0, .75, -.6);                         // 座椅靠背
  add(new THREE.BoxGeometry(.9, .45, .4), dark, 0, .55, -1.1);                        // 发动机
  // 排气管 + 氮气火焰
  const flames = [];
  const flameM = new THREE.MeshBasicMaterial({ color: 0x55ccff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of [-1, 1]) {
    const ex = add(new THREE.CylinderGeometry(.09, .11, .5, 10), chrome, s * .28, .6, -1.4); ex.rotation.x = Math.PI / 2;
    const fg = new THREE.Group(); fg.position.set(s * .28, .6, -1.65); body.add(fg);
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(.18, 1.6, 10), flameM); f1.rotation.x = -Math.PI / 2; f1.position.z = -.8; fg.add(f1);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(.09, .9, 8), coreM); f2.rotation.x = -Math.PI / 2; f2.position.z = -.45; fg.add(f2);
    fg.visible = false; flames.push(fg);
  }
  // 车手
  const suit = new THREE.MeshStandardMaterial({ color: 0x2b55d6, roughness: .6 });
  add(new THREE.CylinderGeometry(.28, .33, .6, 10), suit, 0, 1.0, -.35);
  const head = add(new THREE.SphereGeometry(.3, 16, 12), new THREE.MeshStandardMaterial({ color: helmet, metalness: .3, roughness: .25 }), 0, 1.5, -.3);
  const visor = add(new THREE.SphereGeometry(.31, 16, 8, Math.PI * .15, Math.PI * .7, Math.PI * .35, Math.PI * .3), new THREE.MeshStandardMaterial({ color: 0x111a33, metalness: .9, roughness: .05 }), 0, 1.5, -.3);
  visor.rotation.y = 0;
  for (const s of [-1, 1]) { const arm = add(new THREE.CylinderGeometry(.08, .08, .6, 6), suit, s * .28, 1.0, .05); arm.rotation.x = 1.1; }
  const wheelSteer = add(new THREE.TorusGeometry(.2, .035, 6, 16), dark, 0, 1.0, .35); wheelSteer.rotation.x = -.6;

  // 车轮
  const wheels = [], pivots = [];
  const tireGeo = new THREE.CylinderGeometry(.34, .34, .32, 20); tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(.2, .2, .34, 8); rimGeo.rotateZ(Math.PI / 2);
  const tireM = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .9 });
  const rimM = new THREE.MeshStandardMaterial({ color: 0xffd200, metalness: .8, roughness: .2 });
  for (const [x, z, front] of [[-.82, 1.0, 1], [.82, 1.0, 1], [-.85, -1.0, 0], [.85, -1.0, 0]]) {
    const pv = new THREE.Group(); pv.position.set(x, .34, z); root.add(pv);
    const w = new THREE.Group(); pv.add(w);
    const t = new THREE.Mesh(tireGeo, tireM); t.castShadow = true; w.add(t);
    w.add(new THREE.Mesh(rimGeo, rimM));
    if (!front) w.scale.set(1.25, 1.08, 1.08);
    wheels.push(w); if (front) pivots.push(pv);
  }
  root.userData = { body, wheels, pivots, flames, head };
  return root;
}
