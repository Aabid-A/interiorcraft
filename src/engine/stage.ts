import * as THREE from "three";
import type { Plan, Vec3 } from "@/lib/types";
import { partDrawable } from "./drawable";

/** Static finished-product renderer retained for catalog image tooling. */
export type StageMode = { kind: "assembled"; view?: { az: number; el: number } };

export class Stage {
  renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 1, 100000);
  private root = new THREE.Group();
  private center = new THREE.Vector3();
  private radius = 1;

  constructor(el: HTMLElement, _options?: { offscreen?: boolean; loop?: boolean; labels?: boolean }) {
    void _options;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    el.appendChild(this.renderer.domElement);
    this.scene.add(this.root);
  }

  setPlan(plan: Plan) {
    this.root.clear();
    const types = new Map(plan.parts.map((part) => [part.id, part]));
    for (const item of plan.items) {
      if (item.kind !== "part") continue;
      const type = types.get(item.ref);
      if (!type) continue;
      const drawable = partDrawable(type, item.holes);
      drawable.root.position.set(...item.final.pos);
      drawable.root.rotation.set(...item.final.rot);
      this.root.add(drawable.root);
    }
    const bounds = new THREE.Box3().setFromObject(this.root);
    if (!bounds.isEmpty()) {
      bounds.getCenter(this.center);
      this.radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 1);
    }
  }

  setMode(mode: StageMode, _options?: { instant?: boolean }) {
    void _options;
    const az = mode.view?.az ?? Math.PI / 4;
    const el = mode.view?.el ?? 0.4;
    const distance = this.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.15;
    this.camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(distance).add(this.center);
    this.camera.lookAt(this.center);
  }

  snapshot(width: number, height: number) {
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.root.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      for (const entry of Array.isArray(material) ? material : material ? [material] : []) {
        const resolution = (entry as THREE.Material & { resolution?: THREE.Vector2 }).resolution;
        resolution?.set(width, height);
      }
    });
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL();
  }

  locate(point: Vec3) {
    const projected = new THREE.Vector3(...point).project(this.camera);
    const size = this.renderer.getSize(new THREE.Vector2());
    return { x: (projected.x + 1) * size.x / 2, y: (1 - projected.y) * size.y / 2 };
  }
}
