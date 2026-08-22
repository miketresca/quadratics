import type {LessonChoice, VisitorMapPin} from "./game-types";

export const PAPER_WIDTH = 2.68;
export const PAPER_HEIGHT = 3.9;
export const DESK_SURFACE_Y = 1.08;
export const PAPER_Y = DESK_SURFACE_Y + 0.045;
export const DESK_RIG_Z = -1.18;
export const SEATED_CAMERA_Z = 5.45 + DESK_RIG_Z;
export const WORKSHEET_CANVAS_WIDTH = 1200;
export const WORKSHEET_CANVAS_HEIGHT = 1600;
export const WORKSHEET_NEXT_PAGE_RECT = {height: 74, width: 312, x: 792, y: 1402};
export const WORKSHEET_COMPLETE_RECT = {height: 74, width: 348, x: 756, y: 1402};
export const ALARM_SOUND_URL = "/game/assets/audio/alarm_sound.wav";
export const PHONE_VIBRATION_SOUND_URL = "/game/assets/audio/mobile-phone-vibration.mp3";

// The room is authored as a seated coordinate box. Keep new objects in this frame:
// X moves left/right across the desk, Y moves floor/ceiling, and Z moves from the user toward the windows.
export const ROOM = {
  width: 10.6,
  depth: 9.4,
  height: 5.8,
  floorY: 0,
  backWindowZ: -4.32,
  leftWindowX: -5.3,
  rightWallX: 5.3,
  deskZ: 0.04
} as const;

export const LESSON_CHOICES: LessonChoice[] = [
  {
    id: "volume-cubes-lesson-1",
    title: "Lesson 1: Volume With Cubes",
    subtitle: "Open the guided-notes worksheet",
    locked: false,
    box: {x: 118, y: 320, width: 964, height: 150}
  },
  {
    id: "dynamic-lesson-locked",
    title: "Lesson 2: Generated Worksheet",
    subtitle: "Locked until the worksheet pipeline exists",
    locked: true,
    box: {x: 118, y: 520, width: 964, height: 150}
  },
  {
    id: "dynamic-lesson-3-locked",
    title: "Lesson 3: Future Challenge",
    subtitle: "Locked for a later worksheet",
    locked: true,
    box: {x: 118, y: 720, width: 964, height: 150}
  }
];

export const VISITOR_HISTORY_PINS: VisitorMapPin[] = [
  {label: "United States", latitude: 39.8, longitude: -98.6},
  {label: "Argentina", latitude: -38.4, longitude: -63.6},
  {label: "United Kingdom", latitude: 55.4, longitude: -3.4},
  {label: "Germany", latitude: 51.2, longitude: 10.4},
  {label: "Brazil", latitude: -14.2, longitude: -51.9},
  {label: "Japan", latitude: 36.2, longitude: 138.3},
  {label: "Australia", latitude: -25.3, longitude: 133.8}
];

export const PHONE_FOCUS_QUOTES = [
  {author: "Marcus Aurelius", text: "The impediment to action advances action."},
  {author: "Seneca", text: "No great thing is created suddenly."},
  {author: "Epictetus", text: "If you seek tranquility, do less, better."},
  {author: "David Goggins", text: "Be more than motivated. Be more than driven."},
  {author: "James Clear", text: "You do not rise to your goals. You fall to your systems."},
  {author: "Cal Newport", text: "Clarity about what matters provides clarity about what does not."}
];

export const GAME_LESSON_TEMPLATE_ID = "volume-cubes-lesson-1";
