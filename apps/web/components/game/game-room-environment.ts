import type {Mesh} from "three";

import {ROOM} from "./game-scene-config";
import {createRightWallMap} from "./game-visitor-map";
import {createConcreteTexture} from "./game-textures";
import {roundRect} from "./game-canvas-utils";

export function createOfficeBackdrop(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const rainStreaks: Mesh[] = [];
  const wallMaterial = new THREE.MeshStandardMaterial({color: 0x111319, roughness: 0.92});
  const floorTexture = createConcreteTexture(THREE);
  const floorMaterial = new THREE.MeshStandardMaterial({map: floorTexture, color: 0x7a7c7d, roughness: 0.9, metalness: 0.02, bumpMap: floorTexture, bumpScale: 0.025});
  const ceilingMaterial = new THREE.MeshStandardMaterial({color: 0x080a0f, roughness: 0.9});

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, ROOM.floorY, -0.05);
  floor.receiveShadow = true;
  group.add(floor);

  const rearWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.height), wallMaterial);
  rearWall.position.set(0, ROOM.height / 2, ROOM.depth / 2 - 0.05);
  rearWall.rotation.y = Math.PI;
  rearWall.receiveShadow = true;
  group.add(rearWall);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, ROOM.height, -0.05);
  ceiling.receiveShadow = true;
  group.add(ceiling);

  const sideGlassMaterial = new THREE.MeshStandardMaterial({
    color: 0x111a24,
    emissive: 0x07111f,
    emissiveIntensity: 0.7,
    roughness: 0.22,
    metalness: 0.02,
    transparent: true,
    opacity: 0.6
  });

  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.depth, ROOM.height), sideGlassMaterial.clone());
  sideWall.position.set(ROOM.leftWindowX, ROOM.height / 2, -0.05);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.receiveShadow = true;
  group.add(sideWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.depth, ROOM.height), wallMaterial);
  rightWall.position.set(ROOM.rightWallX, ROOM.height / 2, -0.05);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  group.add(rightWall);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.height),
    new THREE.MeshStandardMaterial({
      color: 0x1a2a34,
      emissive: 0x0b1c2e,
      emissiveIntensity: 0.8,
      roughness: 0.18,
      metalness: 0.02,
      transparent: true,
      opacity: 0.72
    })
  );
  glass.position.set(0, ROOM.height / 2, ROOM.backWindowZ);
  group.add(glass);

  const backCity = createCityView(THREE, "back");
  const leftCity = createCityView(THREE, "left");
  rainStreaks.push(...backCity.rainStreaks, ...leftCity.rainStreaks);
  group.add(backCity.group);
  group.add(leftCity.group);

  const frameMaterial = new THREE.MeshStandardMaterial({color: 0x242a2e, roughness: 0.44, metalness: 0.22});
  for (const [x, y, width, height] of [
    [0, ROOM.height, ROOM.width, 0.16],
    [0, 0, ROOM.width, 0.16],
    [-ROOM.width / 2, ROOM.height / 2, 0.16, ROOM.height],
    [ROOM.width / 2, ROOM.height / 2, 0.16, ROOM.height],
    [0, ROOM.height / 2, 0.11, ROOM.height],
    [-2.65, ROOM.height / 2, 0.075, ROOM.height],
    [2.65, ROOM.height / 2, 0.075, ROOM.height]
  ] as const) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.1), frameMaterial);
    rail.position.set(x, y, ROOM.backWindowZ + 0.18);
    rail.castShadow = true;
    group.add(rail);
  }

  const sideFrameMaterial = new THREE.MeshStandardMaterial({color: 0x1a1d22, roughness: 0.45, metalness: 0.25});
  for (const side of [-1]) {
    for (const [z, y, width, height] of [
      [-0.05, ROOM.height, ROOM.depth, 0.11],
      [-0.05, 0, ROOM.depth, 0.11],
      [-ROOM.depth / 2, ROOM.height / 2, 0.09, ROOM.height],
      [ROOM.depth / 2, ROOM.height / 2, 0.09, ROOM.height],
      [-1.65, ROOM.height / 2, 0.075, ROOM.height],
      [1.65, ROOM.height / 2, 0.075, ROOM.height]
    ] as const) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.08), sideFrameMaterial);
      frame.position.set(side * (ROOM.width / 2 - 0.08), y, z);
      frame.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
      group.add(frame);
    }
  }

  const mapPanel = createRightWallMap(THREE);
  group.add(mapPanel.group);

  return {group, rainStreaks, mapGroup: mapPanel.group, mapTexture: mapPanel.texture};
}

function createCityView(THREE: typeof import("three"), side: "back" | "left") {
  const group = new THREE.Group();
  const rainStreaks: Mesh[] = [];
  const skylineMaterial = new THREE.MeshStandardMaterial({color: 0x121927, emissive: 0x0b1425, emissiveIntensity: 0.9, roughness: 0.82});
  const facadeMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b2435,
    emissive: 0x101a32,
    emissiveIntensity: 0.55,
    roughness: 0.7,
    depthWrite: false
  });
  const rainMaterial = new THREE.MeshBasicMaterial({color: 0xa9d8ff, transparent: true, opacity: side === "left" ? 0.48 : 0.35, side: THREE.DoubleSide});
  const buildingBaseY = side === "left" ? -0.28 : 0.72;
  const litWindowBaseY = side === "left" ? 0.2 : 0.9;
  const cityBackZ = ROOM.backWindowZ - 0.34;
  const cityLeftX = ROOM.leftWindowX - 0.34;

  const buildingCount = side === "left" ? 58 : 34;
  for (let index = 0; index < buildingCount; index += 1) {
    const width = 0.22 + (index % 5) * 0.06;
    const depth = 0.12 + (index % 4) * 0.05;
    const height = (0.8 + ((index * 7) % 12) * 0.18) * (side === "left" ? 1.15 : 1);
    const x = -4.9 + index * 0.31;
    const z = side === "left" ? -ROOM.depth / 2 + 0.14 + index * (ROOM.depth / Math.max(1, buildingCount - 1)) : ROOM.backWindowZ - 0.32 + index * 0.15;
    const building =
      side === "back"
        ? new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), skylineMaterial)
        : new THREE.Mesh(new THREE.BoxGeometry(depth, height, width), skylineMaterial);
    building.position.set(side === "back" ? x : cityLeftX, buildingBaseY + height / 2, side === "back" ? cityBackZ : z);
    group.add(building);

    if (index % 3 === 0) {
      const facade =
        side === "back"
          ? new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, height * 0.24, 0.022), facadeMaterial)
          : new THREE.Mesh(new THREE.BoxGeometry(0.022, height * 0.24, width * 0.72), facadeMaterial);
      const sideFacadeX = cityLeftX + depth / 2 + 0.025;
      facade.position.set(
        side === "back" ? x : sideFacadeX,
        buildingBaseY + height * 0.72,
        side === "back" ? cityBackZ + depth / 2 + 0.018 : z
      );
      group.add(facade);
    }

    const windowRows = Math.max(2, Math.floor(height / 0.24));
    const windowCols = side === "back" ? 2 : 3;
    const windowColor = index % 5 === 0 ? 0xff58d2 : index % 3 === 0 ? 0x76f0ff : 0xffe186;
    for (let row = 0; row < windowRows; row += 1) {
      for (let col = 0; col < windowCols; col += 1) {
        if ((row + col + index) % 4 === 0) {
          continue;
        }
        const windowWidth = side === "back" ? width * 0.26 : width * 0.2;
        const windowHeight = side === "back" ? 0.028 : 0.04;
        const litWindow = new THREE.Mesh(
          new THREE.PlaneGeometry(windowWidth, windowHeight),
          new THREE.MeshBasicMaterial({
            color: windowColor,
            transparent: true,
            opacity: side === "left" ? 0.95 : 0.68,
            side: THREE.DoubleSide,
            depthWrite: false
          })
        );
        const columnOffset = (col - (windowCols - 1) / 2) * (side === "back" ? width * 0.28 : width * 0.22);
        const sideWindowX = cityLeftX + depth / 2 + 0.036;
        litWindow.position.set(
          side === "back" ? x + columnOffset : sideWindowX,
          litWindowBaseY + row * 0.19,
          side === "back" ? cityBackZ + depth / 2 + 0.062 : z + columnOffset
        );
        if (side === "left") {
          litWindow.rotation.y = Math.PI / 2;
        }
        group.add(litWindow);
      }
    }
  }

  if (side === "back") {
    const signTexture = createNeonSignTexture(THREE, "quadratics.xyz");
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.45, 0.34),
      new THREE.MeshBasicMaterial({map: signTexture, transparent: true, side: THREE.DoubleSide})
    );
    sign.position.set(-1.34, 3.62, cityBackZ + 0.16);
    group.add(sign);
  }

  const rainCount = side === "left" ? 280 : 115;
  for (let index = 0; index < rainCount; index += 1) {
    const rain = new THREE.Mesh(new THREE.PlaneGeometry(0.006, 0.34), rainMaterial);
    const insideLeftRain = side === "left" && index % 3 === 0;
    rain.position.set(
      side === "back" ? -ROOM.width / 2 + Math.random() * ROOM.width : insideLeftRain ? ROOM.leftWindowX + 0.045 : ROOM.leftWindowX - 0.12 - (index % 3) * 0.1,
      ROOM.floorY + 0.12 + Math.random() * (ROOM.height - 0.18),
      side === "back" ? ROOM.backWindowZ - 0.08 : -ROOM.depth / 2 + Math.random() * ROOM.depth
    );
    rain.rotation.z = -0.24;
    if (side === "left") {
      rain.rotation.y = Math.PI / 2;
    }
    rain.userData.speed = 0.012 + Math.random() * 0.018;
    rainStreaks.push(rain);
    group.add(rain);
  }

  return {group, rainStreaks};
}

function createNeonSignTexture(THREE: typeof import("three"), label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const glow = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 24, canvas.width / 2, canvas.height / 2, 460);
    glow.addColorStop(0, "rgba(31,255,188,0.22)");
    glow.addColorStop(0.42, "rgba(31,255,188,0.08)");
    glow.addColorStop(1, "rgba(31,255,188,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(91,255,214,0.62)";
    context.lineWidth = 4;
    roundRect(context, 38, 50, canvas.width - 76, canvas.height - 100, 22);
    context.stroke();
    context.font = "900 78px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = "rgba(80,255,210,0.95)";
    context.shadowBlur = 24;
    context.fillStyle = "#b7ffed";
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 4);
    context.shadowBlur = 0;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
