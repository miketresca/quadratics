"use client";

import type {GameLessonId} from "@quadratics/types";
import {useEffect, useRef, useState} from "react";
import type {Group, Mesh, PerspectiveCamera, Scene, Texture, WebGLRenderer} from "three";

import {getGameLesson} from "@/lib/game/lessons";

type LessonChoice = {
  id: GameLessonId;
  title: string;
  subtitle: string;
  locked: boolean;
  box: {x: number; y: number; width: number; height: number};
};

const PAPER_WIDTH = 4.25;
const PAPER_HEIGHT = 5.8;
const WORKSHEET_CANVAS_WIDTH = 1200;
const WORKSHEET_CANVAS_HEIGHT = 1600;
const LESSON_CHOICES: LessonChoice[] = [
  {
    id: "volume-cubes-lesson-1",
    title: "Lesson 1: Volume With Cubes",
    subtitle: "Open the guided-notes worksheet",
    locked: false,
    box: {x: 118, y: 385, width: 964, height: 188}
  },
  {
    id: "dynamic-lesson-locked",
    title: "Lesson 2: Generated Worksheet",
    subtitle: "Locked until the worksheet pipeline exists",
    locked: true,
    box: {x: 118, y: 625, width: 964, height: 188}
  }
];

export function GameShell() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<GameLessonId | null>(null);
  const [lockedMessage, setLockedMessage] = useState(false);
  const selectedLesson = selectedLessonId ? getGameLesson(selectedLessonId) : null;

  useEffect(() => {
    let disposed = false;
    let renderer: WebGLRenderer | null = null;
    let scene: Scene | null = null;
    let camera: PerspectiveCamera | null = null;
    let animationFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let paperMesh: Mesh | null = null;
    let paperTexture: Texture | null = null;
    let penGroup: Group | null = null;
    let hoveredChoiceId: GameLessonId | null = null;
    const pointerTarget = {x: 0.9, z: 0.65};
    const cameraTarget = {x: 0, y: 7.55, z: 4.9};
    const cleanupCallbacks: Array<() => void> = [];

    async function setupScene() {
      const mount = mountRef.current;
      if (!mount) {
        return;
      }

      const THREE = await import("three");
      if (disposed || !mountRef.current) {
        return;
      }

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0c27b);

      camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 80);
      camera.position.set(0, 7.55, 4.9);
      camera.lookAt(0, 0.05, -0.55);

      try {
        renderer = new THREE.WebGLRenderer({alpha: false, antialias: true});
      } catch {
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.domElement.className = "absolute inset-0 h-full w-full cursor-none";
      mount.append(renderer.domElement);

      const hemiLight = new THREE.HemisphereLight(0xfff5e0, 0x7c4a23, 1.45);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xfff3cf, 2.8);
      keyLight.position.set(-3.5, 7, 5.5);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.85);
      fillLight.position.set(4, 3.5, -2);
      scene.add(fillLight);

      scene.add(createDesk(THREE));
      scene.add(createDeskSupplies(THREE));

      paperTexture = createWorksheetTexture(THREE, selectedLessonId, null);
      paperMesh = createPaper(THREE, paperTexture);
      scene.add(paperMesh);

      penGroup = createPenHand(THREE);
      scene.add(penGroup);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      function updatePointer(event: PointerEvent) {
        if (!renderer || !camera || !paperMesh) {
          return;
        }
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        cameraTarget.x = pointer.x * 0.18;
        cameraTarget.z = 4.9 + pointer.y * 0.08;
        raycaster.setFromCamera(pointer, camera);
        const [hit] = raycaster.intersectObject(paperMesh);
        if (!hit || !hit.uv) {
          hoveredChoiceId = null;
          refreshPaperTexture(paperTexture, selectedLessonId, hoveredChoiceId);
          return;
        }
        pointerTarget.x = hit.point.x + 0.58;
        pointerTarget.z = hit.point.z + 0.54;
        const canvasX = hit.uv.x * WORKSHEET_CANVAS_WIDTH;
        const canvasY = (1 - hit.uv.y) * WORKSHEET_CANVAS_HEIGHT;
        const nextHover = choiceAtCanvasPoint(canvasX, canvasY)?.id ?? null;
        if (nextHover !== hoveredChoiceId) {
          hoveredChoiceId = nextHover;
          refreshPaperTexture(paperTexture, selectedLessonId, hoveredChoiceId);
        }
      }

      function activatePointer(event: PointerEvent) {
        if (!renderer || !camera || !paperMesh) {
          return;
        }
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const [hit] = raycaster.intersectObject(paperMesh);
        if (!hit?.uv) {
          return;
        }
        const canvasX = hit.uv.x * WORKSHEET_CANVAS_WIDTH;
        const canvasY = (1 - hit.uv.y) * WORKSHEET_CANVAS_HEIGHT;
        const choice = choiceAtCanvasPoint(canvasX, canvasY);
        if (!choice) {
          return;
        }
        if (choice.locked) {
          setLockedMessage(true);
          setSelectedLessonId(null);
          refreshPaperTexture(paperTexture, null, choice.id);
          return;
        }
        setLockedMessage(false);
        setSelectedLessonId(choice.id);
        refreshPaperTexture(paperTexture, choice.id, choice.id);
      }

      renderer.domElement.addEventListener("pointermove", updatePointer);
      renderer.domElement.addEventListener("pointerdown", activatePointer);
      cleanupCallbacks.push(() => renderer?.domElement.removeEventListener("pointermove", updatePointer));
      cleanupCallbacks.push(() => renderer?.domElement.removeEventListener("pointerdown", activatePointer));

      const resize = () => {
        if (!mountRef.current || !renderer || !camera) {
          return;
        }
        const rect = mountRef.current.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / Math.max(1, rect.height);
        camera.updateProjectionMatrix();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);
      resize();

      const animate = () => {
        if (!renderer || !scene || !camera) {
          return;
        }
        camera.position.x += (cameraTarget.x - camera.position.x) * 0.045;
        camera.position.y += (cameraTarget.y - camera.position.y) * 0.045;
        camera.position.z += (cameraTarget.z - camera.position.z) * 0.045;
        camera.lookAt(0, 0.05, -0.55);
        if (penGroup) {
          penGroup.position.x += (pointerTarget.x - penGroup.position.x) * 0.18;
          penGroup.position.z += (pointerTarget.z - penGroup.position.z) * 0.18;
          penGroup.rotation.z = -0.44 + (pointerTarget.x - 0.6) * 0.022;
        }
        renderer.render(scene, camera);
        animationFrame = requestAnimationFrame(animate);
      };
      animate();
    }

    void setupScene();

    return () => {
      disposed = true;
      for (const cleanup of cleanupCallbacks) {
        cleanup();
      }
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
      resizeObserver?.disconnect();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      scene?.traverse((child) => {
        const mesh = child as Mesh & {
          geometry?: {dispose: () => void};
          material?: {dispose?: () => void} | Array<{dispose?: () => void}>;
        };
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          for (const material of mesh.material) {
            material.dispose?.();
          }
        } else {
          mesh.material?.dispose?.();
        }
      });
      paperTexture?.dispose();
    };
  }, [selectedLessonId]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#1c120a] text-zinc-100">
      <div aria-label="POV worksheet lesson selector" className="absolute inset-0" ref={mountRef}>
        <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.18),rgba(24,15,9,1)_72%)] text-sm text-zinc-300">
          Loading desk scene
        </div>
      </div>

      <div className="pointer-events-none absolute left-5 top-5 rounded border border-amber-200/20 bg-black/25 px-4 py-3 backdrop-blur-sm">
        <p className="font-mono text-[11px] uppercase tracking-wide text-amber-100/80">Worksheet POV Lab</p>
        <p className="mt-1 text-xs text-amber-50/70">Move the pen over the paper. Click a checkbox to choose a lesson.</p>
      </div>

      {lockedMessage ? (
        <div className="pointer-events-none absolute bottom-6 left-1/2 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 rounded border border-amber-300/40 bg-[#211307]/85 px-4 py-3 text-sm text-amber-50 shadow-2xl backdrop-blur-md">
          Lesson 2 is locked while the generated worksheet pipeline is being designed.
        </div>
      ) : null}

      {selectedLesson?.pdfUrl ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 p-5 backdrop-blur-sm">
          <div className="flex h-[min(86vh,900px)] w-[min(72rem,calc(100vw-2rem))] flex-col overflow-hidden rounded border border-amber-200/30 bg-[#120d08] shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-amber-200/20 px-4 py-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-wide text-amber-200/70">Selected worksheet</p>
                <h2 className="text-lg font-semibold text-amber-50">{selectedLesson.title}</h2>
              </div>
              <button
                className="rounded border border-amber-100/30 px-3 py-2 text-sm text-amber-50 hover:bg-amber-100/10"
                onClick={() => setSelectedLessonId(null)}
                type="button"
              >
                Back to desk
              </button>
            </div>
            <object className="min-h-0 flex-1 bg-zinc-950" data={selectedLesson.pdfUrl} type="application/pdf">
              <div className="grid h-full place-items-center p-8 text-center">
                <a className="rounded border border-amber-200/50 px-4 py-3 text-amber-50" href={selectedLesson.pdfUrl} rel="noreferrer" target="_blank">
                  Open worksheet PDF
                </a>
              </div>
            </object>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function createDesk(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const deskGeometry = new THREE.BoxGeometry(9.4, 0.28, 7.4);
  const deskMaterial = new THREE.MeshStandardMaterial({color: 0xc47a33, roughness: 0.82, metalness: 0.02});
  const desk = new THREE.Mesh(deskGeometry, deskMaterial);
  desk.position.set(0, -0.18, 0);
  desk.receiveShadow = true;
  group.add(desk);

  const grainMaterial = new THREE.MeshBasicMaterial({color: 0x8f4f20, transparent: true, opacity: 0.22});
  for (let index = 0; index < 26; index += 1) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(THREE.MathUtils.randFloat(1.1, 2.8), 0.006, 0.012), grainMaterial);
    line.position.set(THREE.MathUtils.randFloatSpread(8.4), -0.032, THREE.MathUtils.randFloatSpread(6.4));
    line.rotation.y = THREE.MathUtils.randFloat(-0.08, 0.08);
    group.add(line);
  }
  return group;
}

function createDeskSupplies(THREE: typeof import("three")) {
  const group = new THREE.Group();

  const eraser = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.38), new THREE.MeshStandardMaterial({color: 0xfca5a5, roughness: 0.68}));
  eraser.position.set(-2.65, 0.1, -2.55);
  eraser.rotation.y = -0.45;
  eraser.castShadow = true;
  group.add(eraser);

  const eraserCap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.225, 0.39), new THREE.MeshStandardMaterial({color: 0x86efac, roughness: 0.7}));
  eraserCap.position.set(-2.38, 0.104, -2.7);
  eraserCap.rotation.y = -0.45;
  eraserCap.castShadow = true;
  group.add(eraserCap);

  const notebook = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 2.2), new THREE.MeshStandardMaterial({color: 0x8dd7ff, roughness: 0.72}));
  notebook.position.set(-3.85, 0.02, 0.3);
  notebook.rotation.y = 0.1;
  notebook.castShadow = true;
  group.add(notebook);

  const sticky = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.035, 0.9), new THREE.MeshStandardMaterial({color: 0xfef08a, roughness: 0.78}));
  sticky.position.set(3.05, 0.02, -2.25);
  sticky.rotation.y = 0.22;
  sticky.castShadow = true;
  group.add(sticky);

  const ruler = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.035, 0.22), new THREE.MeshStandardMaterial({color: 0xd6a365, roughness: 0.8}));
  ruler.position.set(3.65, 0.04, -2.55);
  ruler.rotation.y = -0.24;
  ruler.castShadow = true;
  group.add(ruler);

  return group;
}

function createPaper(THREE: typeof import("three"), paperTexture: Texture) {
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(PAPER_WIDTH, PAPER_HEIGHT),
    new THREE.MeshBasicMaterial({map: paperTexture})
  );
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(0, 0.01, -0.15);
  paper.receiveShadow = true;
  return paper;
}

function createPenHand(THREE: typeof import("three")) {
  const group = new THREE.Group();
  group.position.set(1.25, 0.24, 1.05);
  group.rotation.set(-0.08, -0.34, -0.44);
  group.scale.setScalar(0.78);

  const skin = new THREE.MeshStandardMaterial({color: 0xf3b27d, roughness: 0.64});
  const shadowSkin = new THREE.MeshStandardMaterial({color: 0xdf9464, roughness: 0.7});
  const penBlue = new THREE.MeshStandardMaterial({color: 0x2563eb, roughness: 0.38, metalness: 0.05});
  const penWhite = new THREE.MeshStandardMaterial({color: 0xf8fafc, roughness: 0.3});
  const penTip = new THREE.MeshStandardMaterial({color: 0x334155, roughness: 0.4, metalness: 0.15});

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), skin);
  palm.scale.set(1.0, 0.42, 0.7);
  palm.position.set(0.2, 0.2, 0.08);
  palm.castShadow = true;
  group.add(palm);

  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 1.28, 12, 24), skin);
  wrist.position.set(0.86, 0.13, 0.45);
  wrist.rotation.z = Math.PI / 2.75;
  wrist.castShadow = true;
  group.add(wrist);

  for (let index = 0; index < 4; index += 1) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.36 - index * 0.018, 8, 16), index === 0 ? shadowSkin : skin);
    finger.position.set(-0.02 - index * 0.07, 0.085, -0.09 + index * 0.052);
    finger.rotation.set(0.95, 0.22, -0.62);
    finger.castShadow = true;
    group.add(finger);

    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), skin);
    knuckle.position.set(0.08 - index * 0.07, 0.105, -0.03 + index * 0.047);
    knuckle.scale.set(1, 0.65, 0.9);
    knuckle.castShadow = true;
    group.add(knuckle);
  }

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.45, 8, 16), shadowSkin);
  thumb.position.set(0.08, 0.1, -0.26);
  thumb.rotation.set(0.48, -0.34, 0.74);
  thumb.castShadow = true;
  group.add(thumb);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.45, 18), penWhite);
  barrel.position.set(-0.22, 0.055, -0.26);
  barrel.rotation.set(Math.PI / 2, 0, -0.8);
  barrel.castShadow = true;
  group.add(barrel);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.38, 18), penBlue);
  grip.position.set(-0.78, 0.03, -0.62);
  grip.rotation.copy(barrel.rotation);
  grip.castShadow = true;
  group.add(grip);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 18), penTip);
  tip.position.set(-1, 0.018, -0.76);
  tip.rotation.copy(barrel.rotation);
  tip.castShadow = true;
  group.add(tip);

  const clicker = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 18), penBlue);
  clicker.position.set(0.32, 0.085, 0.06);
  clicker.rotation.copy(barrel.rotation);
  clicker.castShadow = true;
  group.add(clicker);

  const endCap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), penTip);
  endCap.position.set(0.5, 0.092, 0.18);
  endCap.scale.set(1, 0.7, 1);
  endCap.castShadow = true;
  group.add(endCap);

  return group;
}

function createWorksheetTexture(THREE: typeof import("three"), checkedLessonId: GameLessonId | null, hoveredChoiceId: GameLessonId | null) {
  const canvas = document.createElement("canvas");
  canvas.width = WORKSHEET_CANVAS_WIDTH;
  canvas.height = WORKSHEET_CANVAS_HEIGHT;
  drawWorksheet(canvas, checkedLessonId, hoveredChoiceId);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function refreshPaperTexture(texture: Texture | null, checkedLessonId: GameLessonId | null, hoveredChoiceId: GameLessonId | null) {
  if (!texture?.image || !(texture.image instanceof HTMLCanvasElement)) {
    return;
  }
  drawWorksheet(texture.image, checkedLessonId, hoveredChoiceId);
  texture.needsUpdate = true;
}

function drawWorksheet(canvas: HTMLCanvasElement, checkedLessonId: GameLessonId | null, hoveredChoiceId: GameLessonId | null) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fffaf0";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#ded2bd";
  context.lineWidth = 5;
  context.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);

  context.fillStyle = "#24313f";
  context.font = "700 58px ui-rounded, system-ui, sans-serif";
  context.fillText("Today’s worksheet", 116, 190);
  context.font = "34px ui-rounded, system-ui, sans-serif";
  context.fillStyle = "#64748b";
  context.fillText("Choose a lesson to begin.", 116, 250);

  for (const choice of LESSON_CHOICES) {
    const active = choice.id === checkedLessonId;
    const hovered = choice.id === hoveredChoiceId;
    context.fillStyle = active ? "#e7f8ef" : hovered ? "#f4f0e7" : "#fffdf8";
    context.strokeStyle = choice.locked ? "#d6c7ae" : active ? "#2f9d65" : hovered ? "#7c5f35" : "#cdbfAA";
    context.lineWidth = hovered || active ? 8 : 4;
    roundRect(context, choice.box.x, choice.box.y, choice.box.width, choice.box.height, 24);
    context.fill();
    context.stroke();

    const checkboxX = choice.box.x + 42;
    const checkboxY = choice.box.y + 48;
    context.strokeStyle = choice.locked ? "#a9987f" : "#314155";
    context.lineWidth = 7;
    roundRect(context, checkboxX, checkboxY, 72, 72, 10);
    context.stroke();
    if (active) {
      context.strokeStyle = "#15803d";
      context.lineWidth = 13;
      context.beginPath();
      context.moveTo(checkboxX + 15, checkboxY + 38);
      context.lineTo(checkboxX + 33, checkboxY + 57);
      context.lineTo(checkboxX + 60, checkboxY + 17);
      context.stroke();
    }

    context.fillStyle = choice.locked ? "#8b8173" : "#1f2937";
    context.font = "700 42px ui-rounded, system-ui, sans-serif";
    context.fillText(choice.title, choice.box.x + 146, choice.box.y + 70);
    context.fillStyle = choice.locked ? "#a69b89" : "#64748b";
    context.font = "30px ui-rounded, system-ui, sans-serif";
    context.fillText(choice.subtitle, choice.box.x + 146, choice.box.y + 122);
  }

  context.strokeStyle = "#e7dac4";
  context.lineWidth = 3;
  for (let index = 0; index < 8; index += 1) {
    const y = 940 + index * 58;
    context.beginPath();
    context.moveTo(118, y);
    context.lineTo(1082, y);
    context.stroke();
  }

  context.fillStyle = "#9a8973";
  context.font = "28px ui-rounded, system-ui, sans-serif";
  context.fillText("Notes", 118, 892);
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function choiceAtCanvasPoint(x: number, y: number) {
  return LESSON_CHOICES.find((choice) => x >= choice.box.x && x <= choice.box.x + choice.box.width && y >= choice.box.y && y <= choice.box.y + choice.box.height) ?? null;
}
