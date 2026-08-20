import type {GameFighterId} from "@quadratics/types";

export type GameAssetRole = "fighter" | "cursor" | "orb" | "background" | "screen" | "sfx";
export type GameAssetLegalStatus = "prototype_reference" | "original" | "licensed";

export type GameAsset = {
  id: string;
  displayName: string;
  role: GameAssetRole;
  src: string;
  width: number;
  height: number;
  sourceUrl: string;
  legalStatus: GameAssetLegalStatus;
  preload: boolean;
};

export type GameFighter = {
  id: GameFighterId;
  name: string;
  shortName: string;
  color: string;
  voiceCue: GameAudioCueId;
  jumpCue: GameAudioCueId;
  model: {
    directory: string;
    obj: string;
    mtl: string;
    scale: number;
    yOffset: number;
    rotationY: number;
  };
  portrait: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type GameAudioCueId =
  | "mario"
  | "donkey-kong"
  | "link"
  | "samus"
  | "captain-falcon"
  | "ness"
  | "yoshi"
  | "kirby"
  | "fox"
  | "pikachu"
  | "jigglypuff"
  | "luigi"
  | "mario-jump"
  | "donkey-kong-jump"
  | "link-jump"
  | "samus-jump"
  | "captain-falcon-jump"
  | "ness-jump"
  | "yoshi-jump"
  | "kirby-jump"
  | "fox-jump"
  | "pikachu-jump"
  | "luigi-jump"
  | "jigglypuff-jump"
  | "choose"
  | "start"
  | "select"
  | "denied"
  | "jump"
  | "orb"
  | "complete";

export const GAME_ASSETS: GameAsset[] = [
  {
    id: "character-select-screen",
    displayName: "Character Select Screen",
    role: "screen",
    src: "/game/assets/screens/character-select.png",
    width: 836,
    height: 497,
    sourceUrl: "assets/screens/character_select.png",
    legalStatus: "prototype_reference",
    preload: true
  },
  {
    id: "master-hand-cursor",
    displayName: "Master Hand Cursor",
    role: "cursor",
    src: "/game/assets/ui/hand-cursor.svg",
    width: 96,
    height: 96,
    sourceUrl: "https://models.spriters-resource.com/nintendo_64/ssb/asset/283437/",
    legalStatus: "prototype_reference",
    preload: true
  },
  {
    id: "lesson-orb",
    displayName: "Lesson Orb",
    role: "orb",
    src: "/game/assets/ui/smash-ball.png",
    width: 256,
    height: 256,
    sourceUrl: "assets/sprites/objects/smash_ball.zip",
    legalStatus: "prototype_reference",
    preload: false
  },
  {
    id: "locked-orb",
    displayName: "Locked Orb",
    role: "orb",
    src: "/game/assets/ui/locked-ball.svg",
    width: 96,
    height: 96,
    sourceUrl: "https://models.spriters-resource.com/wii/ssbb/asset/292971/",
    legalStatus: "prototype_reference",
    preload: false
  },
  {
    id: "final-destination-bg",
    displayName: "Final Destination Background",
    role: "background",
    src: "/game/assets/screens/background.jpg",
    width: 1280,
    height: 960,
    sourceUrl: "assets/screens/background.jpg",
    legalStatus: "prototype_reference",
    preload: false
  },
  {
    id: "audio-captain-falcon",
    displayName: "Captain Falcon announcer",
    role: "sfx",
    src: "/game/assets/audio/captain-falcon.wav",
    width: 0,
    height: 0,
    sourceUrl: "https://sounds.spriters-resource.com/nintendo_64/ssb/asset/396115/",
    legalStatus: "prototype_reference",
    preload: false
  },
  {
    id: "audio-jigglypuff",
    displayName: "Jigglypuff announcer",
    role: "sfx",
    src: "/game/assets/audio/jigglypuff.wav",
    width: 0,
    height: 0,
    sourceUrl: "https://sounds.spriters-resource.com/nintendo_64/ssb/asset/396115/",
    legalStatus: "prototype_reference",
    preload: false
  },
  {
    id: "audio-luigi",
    displayName: "Luigi announcer",
    role: "sfx",
    src: "/game/assets/audio/luigi.wav",
    width: 0,
    height: 0,
    sourceUrl: "https://sounds.spriters-resource.com/nintendo_64/ssb/asset/396115/",
    legalStatus: "prototype_reference",
    preload: false
  },
  {
    id: "audio-ui-sfx",
    displayName: "Common SSB64 UI and action effects",
    role: "sfx",
    src: "/game/assets/audio/",
    width: 0,
    height: 0,
    sourceUrl: "https://sounds.spriters-resource.com/nintendo_64/ssb/",
    legalStatus: "prototype_reference",
    preload: false
  }
];

export const GAME_AUDIO_CUES: Record<GameAudioCueId, string> = {
  mario: "/game/assets/audio/mario.wav",
  "donkey-kong": "/game/assets/audio/donkey-kong.wav",
  link: "/game/assets/audio/link.wav",
  samus: "/game/assets/audio/samus.wav",
  "captain-falcon": "/game/assets/audio/captain-falcon.wav",
  ness: "/game/assets/audio/ness.wav",
  yoshi: "/game/assets/audio/yoshi.wav",
  kirby: "/game/assets/audio/kirby.wav",
  fox: "/game/assets/audio/fox.wav",
  pikachu: "/game/assets/audio/pikachu.wav",
  luigi: "/game/assets/audio/luigi.wav",
  jigglypuff: "/game/assets/audio/jigglypuff.wav",
  "mario-jump": "/game/assets/audio/mario-jump.wav",
  "donkey-kong-jump": "/game/assets/audio/donkey-kong-jump.wav",
  "link-jump": "/game/assets/audio/link-jump.wav",
  "samus-jump": "/game/assets/audio/samus-jump.wav",
  "captain-falcon-jump": "/game/assets/audio/captain-falcon-jump.wav",
  "ness-jump": "/game/assets/audio/ness-jump.wav",
  "yoshi-jump": "/game/assets/audio/yoshi-jump.wav",
  "kirby-jump": "/game/assets/audio/kirby-jump.wav",
  "fox-jump": "/game/assets/audio/fox-jump.wav",
  "pikachu-jump": "/game/assets/audio/pikachu-jump.wav",
  "luigi-jump": "/game/assets/audio/luigi-jump.wav",
  "jigglypuff-jump": "/game/assets/audio/jigglypuff-jump.wav",
  choose: "/game/assets/audio/choose-your-character.wav",
  start: "/game/assets/audio/start.wav",
  select: "/game/assets/audio/select.wav",
  denied: "/game/assets/audio/denied.wav",
  jump: "/game/assets/audio/jump.wav",
  orb: "/game/assets/audio/orb.wav",
  complete: "/game/assets/audio/complete.wav"
};

const modelDirectory = (id: GameFighterId) => `/game/assets/models/characters/${id}/`;

export const GAME_FIGHTERS: GameFighter[] = [
  {
    id: "mario",
    name: "Mario",
    shortName: "MARIO",
    color: "#ef4444",
    voiceCue: "mario",
    jumpCue: "mario-jump",
    model: {directory: modelDirectory("mario"), obj: "mario.obj", mtl: "mario.mtl", scale: 0.09, yOffset: -0.35, rotationY: 0.15},
    portrait: {x: 1, y: 10, width: 42, height: 32}
  },
  {
    id: "donkey-kong",
    name: "Donkey Kong",
    shortName: "DK",
    color: "#f97316",
    voiceCue: "donkey-kong",
    jumpCue: "donkey-kong-jump",
    model: {directory: modelDirectory("donkey-kong"), obj: "donkey.obj", mtl: "donkey.mtl", scale: 0.075, yOffset: -0.42, rotationY: 0.15},
    portrait: {x: 93, y: 10, width: 42, height: 32}
  },
  {
    id: "link",
    name: "Link",
    shortName: "LINK",
    color: "#86efac",
    voiceCue: "link",
    jumpCue: "link-jump",
    model: {directory: modelDirectory("link"), obj: "link.obj", mtl: "link.mtl", scale: 0.09, yOffset: -0.35, rotationY: 0.15},
    portrait: {x: 231, y: 10, width: 42, height: 32}
  },
  {
    id: "samus",
    name: "Samus",
    shortName: "SAMUS",
    color: "#fb923c",
    voiceCue: "samus",
    jumpCue: "samus-jump",
    model: {directory: modelDirectory("samus"), obj: "samus.obj", mtl: "samus.mtl", scale: 0.09, yOffset: -0.35, rotationY: 0.15},
    portrait: {x: 323, y: 10, width: 42, height: 32}
  },
  {
    id: "captain-falcon",
    name: "Captain Falcon",
    shortName: "FALCON",
    color: "#facc15",
    voiceCue: "captain-falcon",
    jumpCue: "captain-falcon-jump",
    model: {directory: modelDirectory("captain-falcon"), obj: "cf.obj", mtl: "cf.mtl", scale: 0.09, yOffset: -0.35, rotationY: 0.15},
    portrait: {x: 139, y: 96, width: 42, height: 32}
  },
  {
    id: "ness",
    name: "Ness",
    shortName: "NESS",
    color: "#f43f5e",
    voiceCue: "ness",
    jumpCue: "ness-jump",
    model: {directory: modelDirectory("ness"), obj: "ness.obj", mtl: "ness.mtl", scale: 0.09, yOffset: -0.3, rotationY: 0.15},
    portrait: {x: 277, y: 96, width: 42, height: 32}
  },
  {
    id: "yoshi",
    name: "Yoshi",
    shortName: "YOSHI",
    color: "#4ade80",
    voiceCue: "yoshi",
    jumpCue: "yoshi-jump",
    model: {directory: modelDirectory("yoshi"), obj: "Yoshi.obj", mtl: "Yoshi.mtl", scale: 0.085, yOffset: -0.36, rotationY: 0.15},
    portrait: {x: 47, y: 53, width: 42, height: 32}
  },
  {
    id: "kirby",
    name: "Kirby",
    shortName: "KIRBY",
    color: "#f9a8d4",
    voiceCue: "kirby",
    jumpCue: "kirby-jump",
    model: {directory: modelDirectory("kirby"), obj: "kirby.obj", mtl: "kirby.mtl", scale: 0.11, yOffset: -0.28, rotationY: 0.15},
    portrait: {x: 139, y: 53, width: 42, height: 32}
  },
  {
    id: "fox",
    name: "Fox",
    shortName: "FOX",
    color: "#f59e0b",
    voiceCue: "fox",
    jumpCue: "fox-jump",
    model: {directory: modelDirectory("fox"), obj: "fox.obj", mtl: "fox.mtl", scale: 0.09, yOffset: -0.35, rotationY: 0.15},
    portrait: {x: 231, y: 53, width: 42, height: 32}
  },
  {
    id: "pikachu",
    name: "Pikachu",
    shortName: "PIKA",
    color: "#fde047",
    voiceCue: "pikachu",
    jumpCue: "pikachu-jump",
    model: {directory: modelDirectory("pikachu"), obj: "pika.obj", mtl: "pika.mtl", scale: 0.12, yOffset: -0.25, rotationY: 0.15},
    portrait: {x: 323, y: 53, width: 42, height: 32}
  },
  {
    id: "luigi",
    name: "Luigi",
    shortName: "LUIGI",
    color: "#22c55e",
    voiceCue: "luigi",
    jumpCue: "luigi-jump",
    model: {directory: modelDirectory("luigi"), obj: "luigi.obj", mtl: "luigi.mtl", scale: 0.09, yOffset: -0.35, rotationY: 0.15},
    portrait: {x: 47, y: 96, width: 42, height: 32}
  },
  {
    id: "jigglypuff",
    name: "Jigglypuff",
    shortName: "PUFF",
    color: "#f0abfc",
    voiceCue: "jigglypuff",
    jumpCue: "jigglypuff-jump",
    model: {directory: modelDirectory("jigglypuff"), obj: "jiggly.obj", mtl: "jiggly.mtl", scale: 0.13, yOffset: -0.24, rotationY: 0.15},
    portrait: {x: 47, y: 139, width: 42, height: 32}
  }
];

export function getAsset(assetId: string): GameAsset {
  const asset = GAME_ASSETS.find((candidate) => candidate.id === assetId);
  if (!asset) {
    throw new Error(`Unknown game asset: ${assetId}`);
  }
  return asset;
}

export function getFighter(fighterId: GameFighterId | null | undefined): GameFighter {
  return GAME_FIGHTERS.find((fighter) => fighter.id === fighterId) ?? GAME_FIGHTERS[0];
}
