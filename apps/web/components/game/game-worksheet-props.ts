import type {Mesh, Object3D, Texture, Vector3} from "three";

import {DESK_RIG_Z, DESK_SURFACE_Y, PAPER_HEIGHT, PAPER_WIDTH, PAPER_Y} from "./game-scene-config";

export function createPaper(THREE: typeof import("three"), paperTexture: Texture) {
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(PAPER_WIDTH, PAPER_HEIGHT),
    new THREE.MeshStandardMaterial({map: paperTexture, color: 0xffffff, roughness: 0.9, metalness: 0})
  );
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(0, PAPER_Y, -0.15);
  paper.receiveShadow = true;
  return paper;
}

export function createDeskPenModel(THREE: typeof import("three"), source: Object3D) {
  const group = new THREE.Group();
  group.name = "desk-pen";
  group.position.set(2.1, DESK_SURFACE_Y + 0.095, 0.68);
  group.rotation.set(0, 0, 0);

  const model = createNormalizedBlueOfficePen(THREE, source, 0.82);
  group.add(model);
  return group;
}

function createNormalizedBlueOfficePen(THREE: typeof import("three"), source: Object3D, targetLength: number) {
  const wrapper = new THREE.Group();
  const model = cloneBlueOfficePen(THREE, source);
  model.traverse((child) => {
    const mesh = child as Mesh & {castShadow?: boolean; receiveShadow?: boolean};
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const longestSide = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetLength / longestSide;
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  wrapper.add(model);
  return wrapper;
}

function cloneBlueOfficePen(THREE: typeof import("three"), source: Object3D) {
  const allowedMeshNames = new Set(["Cylinder006_1", "Cylinder006_1_1", "Box006", "Object003"]);
  const group = new THREE.Group();
  source.updateMatrixWorld(true);
  source.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !allowedMeshNames.has(mesh.name)) {
      return;
    }
    const clonedMesh = mesh.clone();
    clonedMesh.geometry = mesh.geometry.clone();
    if (Array.isArray(mesh.material)) {
      clonedMesh.material = mesh.material.map((material) => material.clone());
    } else {
      clonedMesh.material = mesh.material.clone();
    }
    clonedMesh.applyMatrix4(mesh.matrixWorld);
    group.add(clonedMesh);
  });
  return group;
}

export function createRaisedPenCursor(THREE: typeof import("three")) {
  const group = new THREE.Group();
  group.name = "worksheet-cursor-pen";
  group.position.set(1.08, DESK_SURFACE_Y + 0.12, 0.82 + DESK_RIG_Z);

  const black = new THREE.MeshStandardMaterial({color: 0x050607, roughness: 0.42, metalness: 0.08});
  const blue = new THREE.MeshStandardMaterial({color: 0x22c7d3, roughness: 0.5, metalness: 0.12});
  const metal = new THREE.MeshStandardMaterial({color: 0x111827, roughness: 0.28, metalness: 0.35});
  const axis = new THREE.Vector3(0.46, 0.42, -0.38).normalize();

  // The local origin is the exact writing point. Every part of the pen extends
  // away from this point so the screen reticle and visual tip stay calibrated.
  const tipBase = axis.clone().multiplyScalar(0.13);
  const tip = createConeBetween(THREE, tipBase, new THREE.Vector3(0, 0, 0), 0.038, black);
  const barrel = createCylinderBetween(THREE, axis.clone().multiplyScalar(0.13), axis.clone().multiplyScalar(0.64), 0.041, blue);
  const grip = createCylinderBetween(THREE, axis.clone().multiplyScalar(0.64), axis.clone().multiplyScalar(0.9), 0.052, black);
  const clip = createCylinderBetween(
    THREE,
    axis.clone().multiplyScalar(0.34).add(new THREE.Vector3(0.035, 0.03, 0.028)),
    axis.clone().multiplyScalar(0.72).add(new THREE.Vector3(0.035, 0.03, 0.028)),
    0.01,
    metal
  );
  const endCap = new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 12), black);
  endCap.position.copy(axis.clone().multiplyScalar(0.93));
  group.add(tip, barrel, grip, clip, endCap);
  group.traverse((child) => {
    const mesh = child as Mesh & {castShadow?: boolean; receiveShadow?: boolean};
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return group;
}

function createCylinderBetween(
  THREE: typeof import("three"),
  start: Vector3,
  end: Vector3,
  radius: number,
  material: import("three").Material
) {
  const length = start.distanceTo(end);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 18), material);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start).normalize();
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  return mesh;
}

function createConeBetween(
  THREE: typeof import("three"),
  base: Vector3,
  tip: Vector3,
  radius: number,
  material: import("three").Material
) {
  const length = base.distanceTo(tip);
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 20), material);
  const midpoint = base.clone().add(tip).multiplyScalar(0.5);
  const direction = tip.clone().sub(base).normalize();
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  return mesh;
}
