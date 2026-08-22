import type {Texture} from "three";
import type {CSS3DRenderer} from "three/examples/jsm/renderers/CSS3DRenderer.js";

import {PHONE_FOCUS_QUOTES} from "./game-scene-config";
import type {PhoneScreenMode} from "./game-types";

export function createDeskPhone(THREE: typeof import("three")) {
  const group = new THREE.Group();
  group.name = "desk-phone";
  group.position.set(3.72, 0.055, 1.64);
  group.rotation.y = -0.56;

  const bodyMaterial = new THREE.MeshStandardMaterial({color: 0x0b1118, roughness: 0.48, metalness: 0.22});
  const sideMaterial = new THREE.MeshStandardMaterial({color: 0x121a22, roughness: 0.42, metalness: 0.18});
  const edgeMaterial = new THREE.MeshStandardMaterial({color: 0x05080b, roughness: 0.4, metalness: 0.28});

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.045, 0.94), bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.61, 0.035, 0.99), edgeMaterial);
  edge.position.y = -0.012;
  edge.castShadow = true;
  group.add(edge);

  const screenTexture = createPhoneScreenTexture(THREE, "off");
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.78),
    new THREE.MeshBasicMaterial({map: screenTexture, color: 0xffffff, side: THREE.DoubleSide})
  );
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = 0.028;
  screen.position.z = -0.012;
  group.add(screen);

  const notch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.006, 0.018), sideMaterial);
  notch.position.set(0, 0.033, -0.38);
  group.add(notch);

  return {group, screenTexture};
}

function createPhoneScreenTexture(
  THREE: typeof import("three"),
  mode: PhoneScreenMode,
  quote?: {author: string; text: string}
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 832;
  drawPhoneScreen(canvas, mode, quote);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function refreshPhoneScreenTexture(texture: Texture | null, mode: PhoneScreenMode, quote?: {author: string; text: string}) {
  if (!texture) {
    return;
  }
  const image = texture.image;
  if (!(image instanceof HTMLCanvasElement)) {
    return;
  }
  drawPhoneScreen(image, mode, quote);
  texture.needsUpdate = true;
}

export function setCssRendererInteraction(renderer: CSS3DRenderer | null, enabled: boolean) {
  if (!renderer) {
    return;
  }
  const pointerEvents = enabled ? "auto" : "none";
  renderer.domElement.style.pointerEvents = pointerEvents;
  renderer.domElement.style.cursor = enabled ? "auto" : "none";
  for (const element of Array.from(renderer.domElement.querySelectorAll<HTMLElement>("*"))) {
    element.style.pointerEvents = pointerEvents;
  }
}

export function setCssRendererVisibility(renderer: CSS3DRenderer | null, visible: boolean) {
  if (!renderer) {
    return;
  }
  renderer.domElement.style.opacity = visible ? "1" : "0";
  renderer.domElement.style.visibility = visible ? "visible" : "hidden";
}

function drawPhoneScreen(canvas: HTMLCanvasElement, mode: PhoneScreenMode, quote?: {author: string; text: string}) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const active = mode !== "off";
  context.clearRect(0, 0, canvas.width, canvas.height);
  const glass = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  glass.addColorStop(0, active ? "#071720" : "#101820");
  glass.addColorStop(0.55, active ? "#061015" : "#17222b");
  glass.addColorStop(1, active ? "#030608" : "#0a0f14");
  context.fillStyle = glass;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(context, canvas.width / 2 - 58, 22, 116, 12, 6);
  context.fill();

  if (!active) {
    return;
  }

  const glow = context.createRadialGradient(canvas.width / 2, 280, 10, canvas.width / 2, 280, 360);
  glow.addColorStop(0, "rgba(52,255,191,0.2)");
  glow.addColorStop(1, "rgba(52,255,191,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(94,255,214,0.42)";
  context.lineWidth = 3;
  roundRect(context, 48, 80, canvas.width - 96, canvas.height - 160, 30);
  context.stroke();

  if (mode === "reward" || mode === "rickroll") {
    context.font = "700 28px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillStyle = "#7fffe6";
    context.textAlign = "left";
    context.fillText("LESSON COMPLETE", 76, 142);

    context.font = "900 42px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillStyle = "#f8fafc";
    wrapCanvasText(
      context,
      mode === "rickroll" ? "Prize unlocked." : "Tap the gift to claim your prize.",
      76,
      238,
      canvas.width - 152,
      54
    );

    context.fillStyle = mode === "rickroll" ? "#38bdf8" : "#facc15";
    roundRect(context, 168, 500, 176, 128, 24);
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.6)";
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(256, 500);
    context.lineTo(256, 628);
    context.moveTo(168, 564);
    context.lineTo(344, 564);
    context.stroke();

    context.font = "800 24px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillStyle = mode === "rickroll" ? "#dbeafe" : "#fef9c3";
    context.textAlign = "center";
    context.fillText(mode === "rickroll" ? "NEVER GONNA GIVE YOU UP" : "OPEN", canvas.width / 2, 700);
    return;
  }

  context.font = "700 28px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#7fffe6";
  context.textAlign = "left";
  context.fillText("OPAL BLOCK", 76, 142);

  context.font = "800 42px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#f8fafc";
  wrapCanvasText(context, "Deep work session active.", 76, 225, canvas.width - 152, 52);

  context.font = "600 30px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#cbd5e1";
  const quoteEndY = wrapCanvasText(context, quote?.text ?? PHONE_FOCUS_QUOTES[0].text, 76, 435, canvas.width - 152, 42);

  context.font = "700 24px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#8be8d1";
  context.fillText(`- ${quote?.author ?? PHONE_FOCUS_QUOTES[0].author}`, 76, quoteEndY + 46);
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    context.fillText(line, x, currentY);
  }
  return currentY;
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
