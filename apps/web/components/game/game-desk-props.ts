import {createClock, createClockTexture} from "./game-clock";
import {createCoffeeCup} from "./game-coffee";
import {createDeskPhone} from "./game-phone";
import {DESK_SURFACE_Y} from "./game-scene-config";

export function createDeskSupplies(THREE: typeof import("three")) {
  const group = new THREE.Group();
  group.position.y = DESK_SURFACE_Y;

  const clockTexture = createClockTexture(THREE);
  const clock = createClock(THREE, clockTexture);
  clock.position.set(3.22, 0.03, -2.05);
  clock.rotation.y = -0.26;
  group.add(clock);

  const coffee = createCoffeeCup(THREE);
  coffee.group.position.set(3.22, 0.03, -0.54);
  coffee.group.rotation.y = -0.32;
  group.add(coffee.group);

  const phone = createDeskPhone(THREE);
  group.add(phone.group);

  return {
    group,
    steamGroup: coffee.steamGroup,
    clockTexture,
    clock,
    coffeeGroup: coffee.group,
    phoneGroup: phone.group,
    phoneScreenTexture: phone.screenTexture
  };
}

export function createDeskLaptop(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({color: 0x9aa8af, roughness: 0.42, metalness: 0.36});
  const dark = new THREE.MeshStandardMaterial({color: 0x101820, roughness: 0.5, metalness: 0.16});
  const keyboard = new THREE.MeshStandardMaterial({color: 0x0b1015, roughness: 0.68, metalness: 0.08});

  const base = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 1.76), shell);
  base.position.y = 0.03;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const screen = new THREE.Mesh(new THREE.BoxGeometry(2.92, 1.62, 0.08), dark);
  screen.position.set(0, 0.88, -0.72);
  screen.rotation.x = 0.12;
  screen.castShadow = true;
  group.add(screen);

  const display = new THREE.Mesh(new THREE.PlaneGeometry(2.48, 1.28), new THREE.MeshBasicMaterial({color: 0x1a2a35}));
  display.position.set(0, 0.88, -0.67);
  display.rotation.x = 0.12;
  group.add(display);

  const trackpad = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.012, 0.42), new THREE.MeshStandardMaterial({color: 0x5d6d77, roughness: 0.5, metalness: 0.2}));
  trackpad.position.set(0, 0.09, 0.42);
  group.add(trackpad);

  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 14; col += 1) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.02, 0.065), keyboard);
      key.position.set(-0.8 + col * 0.123, 0.1, -0.06 - row * 0.092);
      group.add(key);
    }
  }

  group.name = "desk-laptop";
  group.position.set(-3.32, DESK_SURFACE_Y + 0.06, -0.92);
  group.rotation.set(0, 0.56, 0);
  group.scale.setScalar(1.08);
  return group;
}

export function createGlobe(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const standMaterial = new THREE.MeshStandardMaterial({color: 0xb4a27a, roughness: 0.36, metalness: 0.52});
  const globeTexture = createGlobeTexture(THREE);
  const globeMaterial = new THREE.MeshStandardMaterial({map: globeTexture, roughness: 0.58, metalness: 0.02});

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 20), globeMaterial);
  sphere.position.y = 0.62;
  sphere.rotation.set(0.16, -0.72, -0.18);
  sphere.castShadow = true;
  group.add(sphere);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.025, 10, 48), standMaterial);
  ring.position.y = 0.62;
  ring.rotation.set(Math.PI / 2.35, 0.16, -0.35);
  ring.castShadow = true;
  group.add(ring);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 12), standMaterial);
  stem.position.y = 0.26;
  stem.castShadow = true;
  group.add(stem);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.07, 28), standMaterial);
  base.position.y = 0.035;
  base.castShadow = true;
  group.add(base);

  return group;
}

function createGlobeTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  if (context) {
    const ocean = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    ocean.addColorStop(0, "#173a5f");
    ocean.addColorStop(0.5, "#1f7aa5");
    ocean.addColorStop(1, "#0f314e");
    context.fillStyle = ocean;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "rgba(205,236,255,0.18)";
    context.lineWidth = 1.5;
    for (let x = 0; x <= canvas.width; x += 64) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 48; y < canvas.height; y += 48) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }

    const continents = [
      {x: 92, y: 96, points: [[0, 20], [44, -26], [100, -14], [130, 32], [92, 82], [28, 74]]},
      {x: 180, y: 190, points: [[0, 0], [42, -34], [88, -6], [76, 60], [36, 96], [-10, 60]]},
      {x: 348, y: 110, points: [[0, 18], [52, -28], [130, -18], [190, 24], [170, 90], [86, 108], [22, 72]]},
      {x: 430, y: 224, points: [[0, 0], [52, -20], [96, 22], [68, 84], [18, 70]]},
      {x: 578, y: 132, points: [[0, 0], [48, -28], [118, 0], [136, 56], [88, 92], [26, 64]]},
      {x: 626, y: 258, points: [[0, 0], [54, -16], [90, 18], [74, 58], [26, 62]]}
    ];
    for (const continent of continents) {
      context.beginPath();
      context.moveTo(continent.x + continent.points[0][0], continent.y + continent.points[0][1]);
      for (const [x, y] of continent.points.slice(1)) {
        context.lineTo(continent.x + x, continent.y + y);
      }
      context.closePath();
      context.fillStyle = "#6ea45f";
      context.fill();
      context.strokeStyle = "rgba(236,218,157,0.6)";
      context.lineWidth = 4;
      context.stroke();
      context.fillStyle = "rgba(213,179,93,0.45)";
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
