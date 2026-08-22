export function createLeatherTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#191917";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 7800; index += 1) {
      const shade = 28 + Math.floor(Math.random() * 32);
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade - 3}, ${0.12 + Math.random() * 0.18})`;
      context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 0.7 + Math.random() * 1.7, 0.7 + Math.random() * 1.7);
    }
    context.strokeStyle = "rgba(255,255,255,0.035)";
    context.lineWidth = 1;
    for (let index = 0; index < 95; index += 1) {
      const y = Math.random() * canvas.height;
      context.beginPath();
      context.moveTo(Math.random() * canvas.width, y);
      context.quadraticCurveTo(Math.random() * canvas.width, y + Math.random() * 18 - 9, Math.random() * canvas.width, y + Math.random() * 28 - 14);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createConcreteTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 768;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#777a7c";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 14_000; index += 1) {
      const shade = 86 + Math.floor(Math.random() * 68);
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.08 + Math.random() * 0.16})`;
      context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
    }
    context.strokeStyle = "rgba(40, 42, 45, 0.18)";
    context.lineWidth = 2;
    for (let index = 0; index < 18; index += 1) {
      context.beginPath();
      const y = Math.random() * canvas.height;
      context.moveTo(0, y);
      for (let x = 0; x <= canvas.width; x += 96) {
        context.lineTo(x, y + Math.sin(index + x * 0.01) * 10);
      }
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createWoodTexture(THREE: typeof import("three"), baseColor: number, grainColor: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  if (context) {
    const base = `#${baseColor.toString(16).padStart(6, "0")}`;
    const grain = `#${grainColor.toString(16).padStart(6, "0")}`;
    context.fillStyle = base;
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 4_200; index += 1) {
      const shade = 70 + Math.floor(Math.random() * 36);
      context.fillStyle = `rgba(${shade + 24}, ${shade + 8}, ${shade - 8}, ${0.025 + Math.random() * 0.055})`;
      context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 2.6, 0.7 + Math.random() * 1.8);
    }
    context.strokeStyle = grain;
    context.lineWidth = 2;
    for (let index = 0; index < 34; index += 1) {
      const y = 12 + index * 11 + Math.random() * 5;
      context.globalAlpha = 0.1 + Math.random() * 0.08;
      context.beginPath();
      context.moveTo(0, y);
      for (let x = 0; x <= canvas.width; x += 72) {
        context.lineTo(x, y + Math.sin(index * 0.7 + x * 0.018) * 7);
      }
      context.stroke();
    }
    context.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
