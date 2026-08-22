export function createCoffeeCup(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const steamGroup = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({color: 0x15120f, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide});
  const gold = new THREE.MeshStandardMaterial({color: 0xb98437, roughness: 0.34, metalness: 0.55});
  const coffeeMaterial = new THREE.MeshStandardMaterial({color: 0x1b0a04, roughness: 0.38, metalness: 0.01});
  const coffeeHighlightMaterial = new THREE.MeshBasicMaterial({color: 0x5a2a10, transparent: true, opacity: 0.34});
  const coasterMaterial = new THREE.MeshStandardMaterial({color: 0x5b3721, roughness: 0.75});
  const steamTexture = createSteamTexture(THREE);
  const steamMaterial = new THREE.MeshBasicMaterial({
    map: steamTexture,
    color: 0xe7eef0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.62, 0.045, 32), coasterMaterial);
  coaster.position.y = 0.02;
  coaster.castShadow = true;
  group.add(coaster);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.31, 0.45, 48, 1, true), ceramic);
  cup.position.y = 0.28;
  cup.castShadow = true;
  group.add(cup);

  const cupInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.315, 0.27, 0.4, 48, 1, true),
    new THREE.MeshStandardMaterial({color: 0x090806, roughness: 0.72, metalness: 0.02, side: THREE.DoubleSide})
  );
  cupInner.position.y = 0.285;
  group.add(cupInner);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.026, 10, 36), gold);
  rim.position.y = 0.51;
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  group.add(rim);

  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.312, 48), coffeeMaterial);
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.472;
  group.add(coffee);

  const coffeeShine = new THREE.Mesh(new THREE.CircleGeometry(0.085, 28), coffeeHighlightMaterial);
  coffeeShine.rotation.x = -Math.PI / 2;
  coffeeShine.scale.set(1.42, 0.34, 1);
  coffeeShine.position.set(-0.08, 0.475, 0.052);
  group.add(coffeeShine);

  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.34, 0.42, 0.01),
    new THREE.Vector3(0.52, 0.41, 0.01),
    new THREE.Vector3(0.61, 0.31, 0.01),
    new THREE.Vector3(0.52, 0.21, 0.01),
    new THREE.Vector3(0.34, 0.2, 0.01)
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 44, 0.036, 14, false), ceramic);
  handle.castShadow = true;
  group.add(handle);

  for (const y of [0.42, 0.2]) {
    const connector = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.16, 16), ceramic);
    connector.position.set(0.32, y, 0.01);
    connector.rotation.z = Math.PI / 2;
    connector.castShadow = true;
    group.add(connector);
  }

  const professorMark = createMugMark(THREE);
  professorMark.position.set(0, 0.31, 0.361);
  group.add(professorMark);

  for (let index = 0; index < 7; index += 1) {
    const wispMaterial = steamMaterial.clone();
    wispMaterial.opacity = 0.1 + index * 0.018;
    const wisp = new THREE.Mesh(new THREE.PlaneGeometry(0.22 + index * 0.035, 0.84 + index * 0.08), wispMaterial);
    wisp.position.set(-0.18 + index * 0.065, 0.95 + index * 0.055, -0.03 + (index % 2) * 0.035);
    wisp.rotation.set(-0.35, 0.12 + index * 0.18, -0.18 + index * 0.08);
    wisp.userData.baseY = wisp.position.y;
    steamGroup.add(wisp);
  }
  group.add(steamGroup);

  return {group, steamGroup};
}

function createSteamTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 5; index += 1) {
      const x = 38 + Math.sin(index * 1.7) * 24;
      const y = 430 - index * 78;
      const gradient = context.createRadialGradient(x, y, 2, x, y, 46 + index * 7);
      gradient.addColorStop(0, "rgba(255,255,255,0.34)");
      gradient.addColorStop(0.45, "rgba(210,222,224,0.16)");
      gradient.addColorStop(1, "rgba(210,222,224,0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(x, y, 33 + index * 5, 56 + index * 9, -0.25 + index * 0.14, 0, Math.PI * 2);
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createMugMark(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const halo = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 8, canvas.width / 2, canvas.height / 2, 70);
    halo.addColorStop(0, "rgba(255, 224, 119, 0.55)");
    halo.addColorStop(0.58, "rgba(255, 186, 73, 0.2)");
    halo.addColorStop(1, "rgba(255, 186, 73, 0)");
    context.fillStyle = halo;
    context.beginPath();
    context.arc(canvas.width / 2, canvas.height / 2, 74, 0, Math.PI * 2);
    context.fill();

    const eggGradient = context.createRadialGradient(109, 55, 6, 130, 82, 56);
    eggGradient.addColorStop(0, "#fff8c7");
    eggGradient.addColorStop(0.32, "#ffd85c");
    eggGradient.addColorStop(0.72, "#d9941c");
    eggGradient.addColorStop(1, "#8f5812");
    context.fillStyle = eggGradient;
    context.strokeStyle = "rgba(255,246,186,0.95)";
    context.lineWidth = 6;
    context.shadowColor = "rgba(255, 214, 82, 0.95)";
    context.shadowBlur = 18;
    context.beginPath();
    context.ellipse(canvas.width / 2, canvas.height / 2 + 5, 34, 49, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    const shine = context.createLinearGradient(102, 36, 144, 96);
    shine.addColorStop(0, "rgba(255,255,255,0.92)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.22)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = shine;
    context.shadowBlur = 0;
    context.beginPath();
    context.ellipse(116, 58, 10, 21, 0.62, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22), new THREE.MeshBasicMaterial({map: texture, transparent: true}));
}
