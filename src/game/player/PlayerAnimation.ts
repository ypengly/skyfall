import * as THREE from 'three';
import { clamp, damp } from '../../utils/math';
import type { PlayerPhysics } from './PlayerPhysics';

/** Procedural wingsuit jumper; pose blends smoothly with flight mode, speed and steering. */
export class PlayerAnimation {
  root = new THREE.Group();
  private pitchG = new THREE.Group();
  private bodyG = new THREE.Group();
  private armL = new THREE.Group(); private armR = new THREE.Group();
  private legL = new THREE.Group(); private legR = new THREE.Group();
  private wingL: THREE.Mesh; private wingR: THREE.Mesh;
  private alpha = 0; private armA = 0.05; private legA = 0.02; private wing = 0; private t = 0;

  constructor() {
    const suit = new THREE.MeshLambertMaterial({ color: 0xe8552b });
    const dark = new THREE.MeshLambertMaterial({ color: 0x23262e });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe3b48f });
    const wingMat = new THREE.MeshLambertMaterial({ color: 0xff9b2f, side: THREE.DoubleSide });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.8, 0.26), suit); torso.position.y = 0.1;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin); head.position.y = 0.68;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), dark); helmet.position.y = 0.7;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.14), dark); pack.position.set(0, 0.15, 0.2);
    this.bodyG.add(torso, head, helmet, pack);

    const mkLimb = (g: THREE.Group, x: number, y: number, len: number, w: number, mat: THREE.Material) => {
      g.position.set(x, y, 0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat); m.position.y = -len / 2;
      g.add(m); this.bodyG.add(g);
    };
    mkLimb(this.armL, 0.28, 0.4, 0.62, 0.13, suit); mkLimb(this.armR, -0.28, 0.4, 0.62, 0.13, suit);
    mkLimb(this.legL, 0.12, -0.3, 0.85, 0.17, dark); mkLimb(this.legR, -0.12, -0.3, 0.85, 0.17, dark);

    // wing membrane: shoulder (0,0.4) -> wrist (1.3,0.4) -> ankle (0.5,-1.1) -> hip (0.1,-0.25)
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.4, 0, 1.3, 0.4, 0, 0.5, -1.1, 0, 0, -0.25, 0]), 3));
    wg.setIndex([0, 1, 3, 1, 2, 3]); wg.computeVertexNormals();
    this.wingL = new THREE.Mesh(wg, wingMat); this.wingL.position.x = 0.26;
    this.wingR = new THREE.Mesh(wg, wingMat); this.wingR.position.x = -0.26; this.wingR.scale.x = -1;
    this.bodyG.add(this.wingL, this.wingR);

    this.pitchG.add(this.bodyG); this.root.add(this.pitchG);
    this.root.scale.setScalar(1.4);
  }

  update(dt: number, p: PlayerPhysics) {
    this.t += dt;
    const D = Math.PI / 180;
    let a = 0, arm = 0.05, leg = 0.02, wing = 0;
    const pa = clamp(p.pathAngle, -0.2, 1.5);
    switch (p.mode) {
      case 'standing': case 'landed': case 'crashed': a = 0; arm = 0.08; leg = 0.04; wing = 0; break;
      case 'freefall': a = -88 * D; arm = 1.15 + Math.sin(this.t * 9) * 0.04; leg = 0.3; wing = 0.25; break;
      case 'dive': a = -90 * D - 0.9 * pa; arm = 0.12; leg = 0.04; wing = 0; break;
      case 'glide': a = -90 * D - 0.8 * pa; arm = 1.5; leg = 0.35; wing = 1; break;
      case 'brake': a = -72 * D; arm = 1.4; leg = 0.6; wing = 0.55; break;
    }
    const k = p.mode === 'standing' ? 8 : 5;
    this.alpha = damp(this.alpha, a, k, dt); this.armA = damp(this.armA, arm, k, dt);
    this.legA = damp(this.legA, leg, k, dt); this.wing = damp(this.wing, wing, k, dt);
    this.root.rotation.y = -p.yaw;
    this.pitchG.rotation.x = this.alpha;
    this.bodyG.rotation.y = p.roll * 0.55;
    this.armL.rotation.z = this.armA; this.armR.rotation.z = -this.armA;
    this.legL.rotation.z = this.legA; this.legR.rotation.z = -this.legA;
    const w = Math.max(0.001, this.wing);
    this.wingL.scale.x = w; this.wingR.scale.x = -w;
    this.wingL.visible = this.wingR.visible = this.wing > 0.03;
    this.wingL.position.x = 0.26; this.wingR.position.x = -0.26;
    this.wingL.rotation.z = -(this.armA - 1.5) * 0.0; // membrane stays in body plane
    this.root.position.set(p.pos.x, p.pos.y, p.pos.z);
  }

  setVisible(v: boolean) { this.root.visible = v; }
  setShadows(on: boolean) { this.root.traverse((o: any) => { if (o.isMesh) o.castShadow = on; }); }
}
