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

const PAPER_WIDTH = 3.05;
const PAPER_HEIGHT = 4.45;
const DESK_SURFACE_Y = 1.08;
const PAPER_Y = DESK_SURFACE_Y + 0.045;
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
  const startedRef = useRef(false);
  const worksheetFocusedRef = useRef(false);
  const pointerLockedRef = useRef(false);
  const [selectedLessonId, setSelectedLessonId] = useState<GameLessonId | null>(null);
  const [lockedMessage, setLockedMessage] = useState(false);
  const [started, setStarted] = useState(false);
  const [worksheetFocused, setWorksheetFocused] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
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
    let steamGroup: Group | null = null;
    let clockTexture: Texture | null = null;
    let lofiContext: AudioContext | null = null;
    let lofiTimer: number | null = null;
    let hoveredChoiceId: GameLessonId | null = null;
    const pointerTarget = {x: 1.08, z: 0.82};
    const cameraTarget = {x: 0, y: 2.85, z: 5.45};
    const lookTarget = {x: 0, y: 1.52, z: -2.25};
    const lookAngles = {yaw: 0, pitch: -0.2};
    const cleanupCallbacks: Array<() => void> = [];

    function setFocusMode(focused: boolean) {
      worksheetFocusedRef.current = focused;
      setWorksheetFocused(focused);
      setLockedMessage(false);
      if (!focused) {
        hoveredChoiceId = null;
        setSelectedLessonId(null);
        refreshPaperTexture(paperTexture, null, null);
      }
    }

    function applyRoomLook(pointerX: number, pointerY: number) {
      cameraTarget.x = 0;
      cameraTarget.y = 2.85;
      cameraTarget.z = 5.45;
      lookTarget.x = Math.sin(lookAngles.yaw) * 4.1 + pointerX * 0.18;
      lookTarget.y = 1.66 + Math.sin(lookAngles.pitch) * 2.2 + pointerY * 0.12;
      lookTarget.z = -1.25 - Math.cos(lookAngles.yaw) * 2.15 - Math.cos(lookAngles.pitch) * 0.2;
    }

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
      scene.background = new THREE.Color(0x090b12);

      camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.1, 80);
      camera.position.set(0, 2.85, 5.45);
      camera.lookAt(0, 1.52, -2.25);

      try {
        renderer = new THREE.WebGLRenderer({alpha: false, antialias: true});
      } catch {
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.78;
      renderer.shadowMap.enabled = true;
      renderer.domElement.className = "absolute inset-0 h-full w-full cursor-none";
      mount.append(renderer.domElement);

      const hemiLight = new THREE.HemisphereLight(0x9fb7d8, 0x0d0908, 0.42);
      scene.add(hemiLight);

      const overheadTarget = new THREE.Object3D();
      overheadTarget.position.set(0, 0.05, -0.2);
      scene.add(overheadTarget);

      const overheadLight = new THREE.SpotLight(0xffe2a8, 7.2, 13, Math.PI / 5.8, 0.6, 1.2);
      overheadLight.position.set(0.25, 6.5, 1.5);
      overheadLight.target = overheadTarget;
      overheadLight.castShadow = true;
      overheadLight.shadow.mapSize.set(2048, 2048);
      overheadLight.shadow.camera.near = 0.5;
      overheadLight.shadow.camera.far = 15;
      scene.add(overheadLight);

      const windowGlow = new THREE.DirectionalLight(0x8bbcff, 1.45);
      windowGlow.position.set(0, 3.2, -4.3);
      scene.add(windowGlow);

      const neonFill = new THREE.PointLight(0xc946ff, 2.1, 9, 2.1);
      neonFill.position.set(3.7, 2.4, -3.8);
      scene.add(neonFill);

      scene.add(createOfficeBackdrop(THREE));
      scene.add(createDeskSurface(THREE));
      const supplies = createDeskSupplies(THREE);
      steamGroup = supplies.steamGroup;
      clockTexture = supplies.clockTexture;
      scene.add(supplies.group);

      const clockTimer = window.setInterval(() => refreshClockTexture(clockTexture), 15_000);
      cleanupCallbacks.push(() => window.clearInterval(clockTimer));

      paperTexture = createWorksheetTexture(THREE, selectedLessonId, null);
      paperMesh = createPaper(THREE, paperTexture);
      scene.add(paperMesh);

      penGroup = createPenHand(THREE);
      penGroup.visible = worksheetFocusedRef.current;
      scene.add(penGroup);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      applyRoomLook(0, 0);

      function updatePointer(event: PointerEvent) {
        if (!renderer || !camera || !paperMesh) {
          return;
        }
        const rect = renderer.domElement.getBoundingClientRect();
        if (pointerLockedRef.current && !worksheetFocusedRef.current) {
          lookAngles.yaw = Math.max(-0.9, Math.min(0.9, lookAngles.yaw + event.movementX * 0.0022));
          lookAngles.pitch = Math.max(-0.78, Math.min(0.45, lookAngles.pitch - event.movementY * 0.0022));
          pointer.set(0, 0);
        } else {
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        }
        if (worksheetFocusedRef.current) {
          cameraTarget.x = pointer.x * 0.12;
          cameraTarget.y = 7.15;
          cameraTarget.z = 3.75 + pointer.y * 0.06;
          lookTarget.x = 0;
          lookTarget.y = DESK_SURFACE_Y + 0.02;
          lookTarget.z = -0.35;
        } else {
          if (!pointerLockedRef.current) {
            lookAngles.yaw = pointer.x * 0.58;
            lookAngles.pitch = Math.max(-0.78, Math.min(0.45, -0.28 + pointer.y * 0.58));
          }
          applyRoomLook(pointer.x, pointer.y);
        }
        raycaster.setFromCamera(pointer, camera);
        const [hit] = raycaster.intersectObject(paperMesh);
        if (!hit || !hit.uv || !worksheetFocusedRef.current) {
          hoveredChoiceId = null;
          refreshPaperTexture(paperTexture, selectedLessonId, hoveredChoiceId);
          return;
        }
        pointerTarget.x = hit.point.x + 0.72;
        pointerTarget.z = hit.point.z + 0.62;
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
        if (!startedRef.current) {
          return;
        }
        startLofiLoop();
        if (worksheetFocusedRef.current) {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        } else if (!pointerLockedRef.current) {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        } else {
          pointer.set(0, 0);
        }
        raycaster.setFromCamera(pointer, camera);
        const [hit] = raycaster.intersectObject(paperMesh);
        if (!hit?.uv) {
          if (!worksheetFocusedRef.current && pointerLockedRef.current && lookAngles.pitch < -0.33) {
            setFocusMode(true);
            document.exitPointerLock?.();
            return;
          }
          if (!worksheetFocusedRef.current && !pointerLockedRef.current) {
            void renderer.domElement.requestPointerLock();
          }
          return;
        }
        if (!worksheetFocusedRef.current) {
          setFocusMode(true);
          document.exitPointerLock?.();
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

      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter" && !startedRef.current) {
          startedRef.current = true;
          setStarted(true);
          startLofiLoop();
          void renderer?.domElement.requestPointerLock();
          return;
        }
        if (event.key === "Escape") {
          setFocusMode(false);
        }
      }
      window.addEventListener("keydown", handleKeyDown);
      cleanupCallbacks.push(() => window.removeEventListener("keydown", handleKeyDown));

      function handlePointerLockChange() {
        const isLocked = document.pointerLockElement === renderer?.domElement;
        pointerLockedRef.current = isLocked;
        setPointerLocked(isLocked);
      }
      document.addEventListener("pointerlockchange", handlePointerLockChange);
      cleanupCallbacks.push(() => document.removeEventListener("pointerlockchange", handlePointerLockChange));

      function startLofiLoop() {
        if (lofiContext) {
          return;
        }
        const AudioContextClass = window.AudioContext ?? (window as Window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
        if (!AudioContextClass) {
          return;
        }
        lofiContext = new AudioContextClass();
        const masterGain = lofiContext.createGain();
        const lowpass = lofiContext.createBiquadFilter();
        masterGain.gain.value = 0.026;
        lowpass.type = "lowpass";
        lowpass.frequency.value = 1250;
        lowpass.Q.value = 0.6;
        lowpass.connect(masterGain);
        masterGain.connect(lofiContext.destination);

        const chords = [
          [261.63, 329.63, 392.0],
          [220.0, 261.63, 329.63],
          [246.94, 293.66, 369.99],
          [196.0, 246.94, 329.63]
        ];
        let chordIndex = 0;
        const playChord = () => {
          if (!lofiContext) {
            return;
          }
          const now = lofiContext.currentTime;
          const notes = chords[chordIndex % chords.length];
          chordIndex += 1;
          for (const [index, note] of notes.entries()) {
            const oscillator = lofiContext.createOscillator();
            const noteGain = lofiContext.createGain();
            oscillator.type = index === 0 ? "sine" : "triangle";
            oscillator.frequency.value = note / 2;
            noteGain.gain.setValueAtTime(0, now);
            noteGain.gain.linearRampToValueAtTime(0.18 / notes.length, now + 0.08);
            noteGain.gain.exponentialRampToValueAtTime(0.001, now + 2.1);
            oscillator.connect(noteGain);
            noteGain.connect(lowpass);
            oscillator.start(now);
            oscillator.stop(now + 2.15);
          }
        };
        playChord();
        lofiTimer = window.setInterval(playChord, 2200);
      }

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
        camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);
        if (penGroup) {
          penGroup.visible = worksheetFocusedRef.current;
          penGroup.position.x += (pointerTarget.x - penGroup.position.x) * 0.18;
          penGroup.position.z += (pointerTarget.z - penGroup.position.z) * 0.18;
          penGroup.rotation.z = -0.5 + (pointerTarget.x - 0.6) * 0.018;
        }
        if (steamGroup) {
          const elapsed = performance.now() / 1000;
          for (const [index, child] of steamGroup.children.entries()) {
            const baseY = typeof child.userData.baseY === "number" ? child.userData.baseY : child.position.y;
            child.position.y = baseY + Math.sin(elapsed * 1.2 + index) * 0.06;
            child.rotation.y = Math.sin(elapsed * 0.8 + index * 0.7) * 0.28;
          }
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
      if (lofiTimer !== null) {
        window.clearInterval(lofiTimer);
      }
      void lofiContext?.close();
    };
  }, [selectedLessonId]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#1c120a] text-zinc-100">
      <div aria-label="POV worksheet lesson selector" className="absolute inset-0" ref={mountRef}>
        <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.18),rgba(24,15,9,1)_72%)] text-sm text-zinc-300">
          Loading desk scene
        </div>
      </div>

      {!started ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-zinc-950/72 backdrop-blur-[2px]">
          <div className="rounded border border-white/15 bg-zinc-950/45 px-8 py-5 text-center shadow-2xl">
            <p className="font-mono text-sm uppercase tracking-[0.28em] text-zinc-100">Press Enter</p>
            <p className="mt-2 text-sm text-zinc-400">Start seated look mode</p>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-5 top-5 rounded border border-amber-200/20 bg-black/25 px-4 py-3 backdrop-blur-sm">
        <p className="font-mono text-[11px] uppercase tracking-wide text-amber-100/80">Worksheet POV Lab</p>
        <p className="mt-1 text-xs text-amber-50/70">
          {worksheetFocused
            ? "Click a checkbox to choose a lesson. Press Escape to look around."
            : pointerLocked
              ? "Look around with the mouse. Center the worksheet and click to focus."
              : "Click once to enter seated look mode. Press Escape to release."}
        </p>
      </div>

      {!worksheetFocused ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-8 w-8 -translate-x-1/2 -translate-y-1/2">
          <span className="absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 bg-amber-50/80 shadow-[0_0_10px_rgba(255,244,210,0.45)]" />
          <span className="absolute bottom-0 left-1/2 h-2.5 w-px -translate-x-1/2 bg-amber-50/80 shadow-[0_0_10px_rgba(255,244,210,0.45)]" />
          <span className="absolute left-0 top-1/2 h-px w-2.5 -translate-y-1/2 bg-amber-50/80 shadow-[0_0_10px_rgba(255,244,210,0.45)]" />
          <span className="absolute right-0 top-1/2 h-px w-2.5 -translate-y-1/2 bg-amber-50/80 shadow-[0_0_10px_rgba(255,244,210,0.45)]" />
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-50/70 bg-black/20" />
        </div>
      ) : null}

      {pointerLocked && !worksheetFocused ? (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded border border-white/10 bg-zinc-950/45 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-zinc-300/75 backdrop-blur-sm">
          Esc releases cursor
        </div>
      ) : null}

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

function createDeskSurface(THREE: typeof import("three")) {
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
    new THREE.BoxGeometry(3.85, 0.035, 4.55),
    new THREE.MeshStandardMaterial({map: matTexture, color: 0x24231f, roughness: 0.94, metalness: 0.03, bumpMap: matTexture, bumpScale: 0.035})
  );
  mat.position.set(0, DESK_SURFACE_Y + 0.006, 0.06);
  mat.receiveShadow = true;
  group.add(mat);

  return group;
}

function createOfficeBackdrop(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const wallMaterial = new THREE.MeshStandardMaterial({color: 0x111319, roughness: 0.92});
  const floorTexture = createWoodTexture(THREE, 0x5d3f27, 0x2c1b14);
  const floorMaterial = new THREE.MeshStandardMaterial({map: floorTexture, roughness: 0.82, metalness: 0.02});

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.31, -2.4);
  floor.receiveShadow = true;
  group.add(floor);

  const sideGlassMaterial = new THREE.MeshStandardMaterial({
    color: 0x111a24,
    emissive: 0x07111f,
    emissiveIntensity: 0.7,
    roughness: 0.22,
    metalness: 0.02,
    transparent: true,
    opacity: 0.78
  });

  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.2), sideGlassMaterial.clone());
  sideWall.position.set(-5.3, 2.55, -1.6);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.receiveShadow = true;
  group.add(sideWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 5.35), wallMaterial);
  rightWall.position.set(5.75, 2.55, -1.55);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  group.add(rightWall);

  const rightWallGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.1),
    new THREE.MeshBasicMaterial({color: 0x5e2384, transparent: true, opacity: 0.08})
  );
  rightWallGlow.position.set(5.73, 2.62, -2.2);
  rightWallGlow.rotation.y = -Math.PI / 2;
  group.add(rightWallGlow);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(9.9, 4.7),
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
  glass.position.set(0, 3.25, -4.31);
  group.add(glass);

  group.add(createCityView(THREE, "back"));
  group.add(createCityView(THREE, "left"));

  for (const x of [-4.25, -3.1, 3.35, 4.4]) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.82),
      new THREE.MeshBasicMaterial({color: x < 0 ? 0x58e6ff : 0xff4fd8, transparent: true, opacity: 0.52})
    );
    sign.position.set(x, 3.35 + Math.abs(x) * 0.08, -4.12);
    group.add(sign);
  }

  const frameMaterial = new THREE.MeshStandardMaterial({color: 0x242a2e, roughness: 0.44, metalness: 0.22});
  for (const [x, y, width, height] of [
    [0, 5.58, 10.15, 0.16],
    [0, 0.92, 10.15, 0.16],
    [-5.05, 3.25, 0.16, 4.82],
    [5.05, 3.25, 0.16, 4.82],
    [0, 3.25, 0.11, 4.7],
    [-2.5, 3.25, 0.075, 4.6],
    [2.5, 3.25, 0.075, 4.6]
  ] as const) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.1), frameMaterial);
    rail.position.set(x, y, -4.04);
    rail.castShadow = true;
    group.add(rail);
  }

  const sideFrameMaterial = new THREE.MeshStandardMaterial({color: 0x1a1d22, roughness: 0.45, metalness: 0.25});
  for (const side of [-1]) {
    for (const [z, y, width, height] of [
      [-1.6, 5.02, 10.1, 0.11],
      [-1.6, 0.92, 10.1, 0.11],
      [-3.8, 2.98, 0.09, 4.18],
      [0.62, 2.98, 0.09, 4.18]
    ] as const) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.08), sideFrameMaterial);
      frame.position.set(side * 5.12, y, z);
      frame.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
      group.add(frame);
    }
  }

  return group;
}

function createCityView(THREE: typeof import("three"), side: "back" | "left") {
  const group = new THREE.Group();
  const skylineMaterial = new THREE.MeshStandardMaterial({color: 0x172030, emissive: 0x101c31, emissiveIntensity: 0.72, roughness: 0.8});
  const rainMaterial = new THREE.MeshBasicMaterial({color: 0xa9d8ff, transparent: true, opacity: 0.35});

  for (let index = 0; index < 28; index += 1) {
    const width = 0.18 + (index % 4) * 0.055;
    const height = 0.7 + ((index * 7) % 10) * 0.17;
    const x = -4.45 + index * 0.34;
    const building =
      side === "back"
        ? new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.06), skylineMaterial)
        : new THREE.Mesh(new THREE.BoxGeometry(0.06, height, width), skylineMaterial);
    building.position.set(side === "back" ? x : -5.02, 1.02 + height / 2, side === "back" ? -4.18 : -4.35 + index * 0.18);
    group.add(building);

    const windowRows = Math.max(2, Math.floor(height / 0.28));
    const windowColor = index % 5 === 0 ? 0xff58d2 : index % 3 === 0 ? 0x76f0ff : 0xffe186;
    for (let row = 0; row < windowRows; row += 1) {
      if ((row + index) % 3 === 0) {
        continue;
      }
      const litWindow = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.46, 0.035), new THREE.MeshBasicMaterial({color: windowColor, transparent: true, opacity: 0.72}));
      litWindow.position.set(side === "back" ? x : -4.97, 1.08 + row * 0.22, side === "back" ? -4.13 : -4.35 + index * 0.18);
      if (side === "left") {
        litWindow.rotation.y = Math.PI / 2;
      }
      group.add(litWindow);
    }
  }

  for (let index = 0; index < 115; index += 1) {
    const rain = new THREE.Mesh(new THREE.PlaneGeometry(0.006, 0.34), rainMaterial);
    rain.position.set(side === "back" ? -4.8 + Math.random() * 9.6 : -4.96, 1.05 + Math.random() * 4.15, side === "back" ? -4.08 : -4.3 + Math.random() * 4.6);
    rain.rotation.z = -0.24;
    if (side === "left") {
      rain.rotation.y = Math.PI / 2;
    }
    group.add(rain);
  }

  return group;
}

function createDeskSupplies(THREE: typeof import("three")) {
  const group = new THREE.Group();
  group.position.y = DESK_SURFACE_Y;

  const globe = createGlobe(THREE);
  globe.position.set(-3.2, 0.03, -2.14);
  group.add(globe);

  const stickyShadow = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.02, 0.88), new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0.18}));
  stickyShadow.position.set(-3.2, 0.025, -0.55);
  stickyShadow.rotation.y = -0.02;
  group.add(stickyShadow);

  for (let index = 0; index < 5; index += 1) {
    const sticky = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.018, 0.82), new THREE.MeshStandardMaterial({color: 0xf4edaa, roughness: 0.86}));
    sticky.position.set(-3.25 + index * 0.018, 0.055 + index * 0.008, -0.58 - index * 0.016);
    sticky.rotation.y = -0.045 + index * 0.012;
    sticky.castShadow = true;
    group.add(sticky);
  }

  const clockTexture = createClockTexture(THREE);
  const clock = createClock(THREE, clockTexture);
  clock.position.set(3.22, 0.03, -2.05);
  clock.rotation.y = -0.26;
  group.add(clock);

  const coffee = createCoffeeCup(THREE);
  coffee.group.position.set(3.22, 0.03, -0.54);
  coffee.group.rotation.y = -0.32;
  group.add(coffee.group);

  return {group, steamGroup: coffee.steamGroup, clockTexture};
}

function createLeatherTexture(THREE: typeof import("three")) {
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

function createWoodTexture(THREE: typeof import("three"), baseColor: number, grainColor: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  if (context) {
    const base = `#${baseColor.toString(16).padStart(6, "0")}`;
    const grain = `#${grainColor.toString(16).padStart(6, "0")}`;
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, base);
    gradient.addColorStop(0.55, "#a86432");
    gradient.addColorStop(1, "#d5904d");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = grain;
    context.lineWidth = 3;
    for (let index = 0; index < 30; index += 1) {
      const y = 18 + index * 13 + Math.random() * 6;
      context.globalAlpha = 0.16 + Math.random() * 0.1;
      context.beginPath();
      context.moveTo(0, y);
      for (let x = 0; x <= canvas.width; x += 72) {
        context.lineTo(x, y + Math.sin(index * 0.7 + x * 0.018) * 11);
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

function createGlobe(THREE: typeof import("three")) {
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

function createClock(THREE: typeof import("three"), clockTexture: Texture) {
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

function createClockTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  drawClockTexture(canvas);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function refreshClockTexture(texture: Texture | null) {
  if (!texture?.image || !(texture.image instanceof HTMLCanvasElement)) {
    return;
  }
  drawClockTexture(texture.image);
  texture.needsUpdate = true;
}

function drawClockTexture(canvas: HTMLCanvasElement) {
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

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York"
  }).format(new Date());

  context.font = "700 112px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#7fffe6";
  context.shadowColor = "rgba(77,246,255,0.86)";
  context.shadowBlur = 22;
  context.fillText(timeLabel, canvas.width / 2, canvas.height / 2 + 4);
  context.shadowBlur = 0;
  context.textAlign = "start";
  context.textBaseline = "alphabetic";
}

function createCoffeeCup(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const steamGroup = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({color: 0x15120f, roughness: 0.5, metalness: 0.1});
  const gold = new THREE.MeshStandardMaterial({color: 0xb98437, roughness: 0.34, metalness: 0.55});
  const coffeeMaterial = new THREE.MeshStandardMaterial({color: 0x2b1a0f, roughness: 0.55});
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

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.31, 0.45, 32, 1, true), ceramic);
  cup.position.y = 0.28;
  cup.castShadow = true;
  group.add(cup);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.026, 10, 36), gold);
  rim.position.y = 0.51;
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  group.add(rim);

  const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.018, 32), coffeeMaterial);
  coffee.position.y = 0.51;
  group.add(coffee);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.032, 10, 28, Math.PI * 1.22), ceramic);
  handle.position.set(0.36, 0.31, 0.02);
  handle.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  handle.castShadow = true;
  group.add(handle);

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
    context.fillStyle = "rgba(127,255,230,0.92)";
    context.font = "700 76px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = "rgba(127,255,230,0.8)";
    context.shadowBlur = 14;
    context.fillText("π", canvas.width / 2, canvas.height / 2 + 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), new THREE.MeshBasicMaterial({map: texture, transparent: true}));
}

function createPaper(THREE: typeof import("three"), paperTexture: Texture) {
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(PAPER_WIDTH, PAPER_HEIGHT),
    new THREE.MeshStandardMaterial({map: paperTexture, color: 0xffffff, roughness: 0.9, metalness: 0})
  );
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(0, PAPER_Y, -0.15);
  paper.receiveShadow = true;
  return paper;
}

function createPenHand(THREE: typeof import("three")) {
  const group = new THREE.Group();
  group.position.set(1.26, DESK_SURFACE_Y + 0.3, 1.02);
  group.rotation.z = -0.12;

  const texture = new THREE.TextureLoader().load("/game/textures/teacher-hand-pen.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false});
  const hand = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.36), material);
  hand.rotation.x = -Math.PI / 2;
  hand.renderOrder = 5;
  group.add(hand);

  return group;
}

function roundedCanvasRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
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
