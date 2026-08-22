import {DESK_SURFACE_Y} from "./game-scene-config";
import {createLeatherTexture, createWoodTexture} from "./game-textures";

export function createDeskSurface(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const deskTexture = createWoodTexture(THREE, 0x82512b, 0x3f2518);
  deskTexture.repeat.set(3.2, 1.45);
  const deskMaterial = new THREE.MeshStandardMaterial({map: deskTexture, color: 0x8d5b34, roughness: 0.74, metalness: 0.03});
  const edgeMaterial = new THREE.MeshStandardMaterial({color: 0x2b1910, roughness: 0.8, metalness: 0.02});

  const desktop = new THREE.Mesh(new THREE.BoxGeometry(9.65, 0.18, 5.35), deskMaterial);
  desktop.position.set(0, DESK_SURFACE_Y - 0.09, 0.04);
  desktop.castShadow = true;
  desktop.receiveShadow = true;
  group.add(desktop);

  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(9.72, 0.16, 0.12), edgeMaterial);
  frontLip.position.set(0, DESK_SURFACE_Y - 0.12, 2.76);
  frontLip.castShadow = true;
  group.add(frontLip);

  const backLip = frontLip.clone();
  backLip.position.z = -2.68;
  group.add(backLip);

  const matTexture = createLeatherTexture(THREE);
  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(3.25, 0.035, 4.05),
    new THREE.MeshStandardMaterial({map: matTexture, color: 0x24231f, roughness: 0.94, metalness: 0.03, bumpMap: matTexture, bumpScale: 0.035})
  );
  mat.position.set(0, DESK_SURFACE_Y + 0.006, 0.06);
  mat.receiveShadow = true;
  group.add(mat);

  return group;
}
