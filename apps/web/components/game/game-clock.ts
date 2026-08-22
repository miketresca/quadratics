import type {Texture} from "three";

import {formatPomodoroClock, type PomodoroState} from "./game-runtime-storage";

export function createClock(THREE: typeof import("three"), clockTexture: Texture) {
  const group = new THREE.Group();
  const caseMaterial = new THREE.MeshStandardMaterial({color: 0x111827, roughness: 0.34, metalness: 0.42});
  const trimMaterial = new THREE.MeshStandardMaterial({color: 0x35f2ff, emissive: 0x0b8ea3, emissiveIntensity: 1.3, roughness: 0.22, metalness: 0.35});
  const shadowMaterial = new THREE.MeshStandardMaterial({color: 0x02040a, roughness: 0.52, metalness: 0.2});

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.54, 0.42), caseMaterial);
  body.position.set(0, 0.3, 0);
  body.rotation.x = -0.1;
  body.castShadow = true;
  group.add(body);

  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.31), new THREE.MeshBasicMaterial({map: clockTexture, transparent: true}));
  face.position.set(0, 0.34, 0.256);
  face.rotation.x = -0.1;
  group.add(face);

  const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.025, 0.02), trimMaterial);
  glowStrip.position.set(0, 0.055, 0.215);
  glowStrip.rotation.x = -0.1;
  group.add(glowStrip);

  const footLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.18), shadowMaterial);
  footLeft.position.set(-0.27, 0.02, 0.14);
  footLeft.rotation.z = 0.18;
  footLeft.castShadow = true;
  group.add(footLeft);

  const footRight = footLeft.clone();
  footRight.position.x = 0.27;
  footRight.rotation.z = -0.18;
  group.add(footRight);

  return group;
}

export function createClockTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  drawClockTexture(canvas, null);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function refreshClockTexture(texture: Texture | null, pomodoro: PomodoroState | null = null) {
  if (!texture?.image || !(texture.image instanceof HTMLCanvasElement)) {
    return;
  }
  drawClockTexture(texture.image, pomodoro);
  texture.needsUpdate = true;
}

function drawClockTexture(canvas: HTMLCanvasElement, pomodoro: PomodoroState | null) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#020712";
  roundRect(context, 18, 18, canvas.width - 36, canvas.height - 36, 84);
  context.fill();
  context.strokeStyle = "rgba(56, 242, 255, 0.7)";
  context.lineWidth = 8;
  context.stroke();
  context.strokeStyle = "rgba(255, 60, 210, 0.32)";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(58, 52);
  context.lineTo(canvas.width - 58, 52);
  context.moveTo(74, canvas.height - 50);
  context.lineTo(canvas.width - 74, canvas.height - 50);
  context.stroke();

  const timeLabel = pomodoro?.endsAt ? formatPomodoroClock(Math.max(0, pomodoro.endsAt - Date.now())) : new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());

  context.font = "700 112px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#7fffe6";
  context.shadowColor = "rgba(77,246,255,0.86)";
  context.shadowBlur = 22;
  context.fillText(timeLabel, canvas.width / 2, canvas.height / 2 + 4);
  if (pomodoro?.endsAt) {
    context.font = "700 24px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillStyle = "#ff72cf";
    context.shadowBlur = 8;
    context.fillText("FOCUS", canvas.width / 2, canvas.height - 42);
  }
  context.shadowBlur = 0;
  context.textAlign = "start";
  context.textBaseline = "alphabetic";
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const resolvedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.lineTo(x + width - resolvedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + resolvedRadius);
  context.lineTo(x + width, y + height - resolvedRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - resolvedRadius, y + height);
  context.lineTo(x + resolvedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - resolvedRadius);
  context.lineTo(x, y + resolvedRadius);
  context.quadraticCurveTo(x, y, x + resolvedRadius, y);
  context.closePath();
}
