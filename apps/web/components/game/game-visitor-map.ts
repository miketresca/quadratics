import type {Texture} from "three";

import {ROOM, VISITOR_HISTORY_PINS} from "./game-scene-config";
import type {VisitorLocation, VisitorMapPin, WorldMapGeoJson} from "./game-types";

export async function loadVisitorLocation(): Promise<VisitorLocation | null> {
  try {
    const response = await fetch("/api/visitor-location", {cache: "no-store"});
    if (!response.ok) {
      return null;
    }
    return await response.json() as VisitorLocation;
  } catch {
    return null;
  }
}

export async function loadWorldMapGeoJson(): Promise<WorldMapGeoJson | null> {
  try {
    const response = await fetch("/game/assets/maps/countries.geo.json", {cache: "force-cache"});
    if (!response.ok) {
      return null;
    }
    return await response.json() as WorldMapGeoJson;
  } catch {
    return null;
  }
}


export function createRightWallMap(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const texture = createWorldMapTexture(THREE, null);
  const frameMaterial = new THREE.MeshStandardMaterial({color: 0x11161f, roughness: 0.58, metalness: 0.2});
  const mapMaterial = new THREE.MeshBasicMaterial({map: texture, color: 0xffffff, side: THREE.DoubleSide});

  // The group is mounted on the right wall; child XY coordinates are the map face.
  const backing = new THREE.Mesh(new THREE.BoxGeometry(4.05, 2.24, 0.08), frameMaterial);
  backing.position.z = -0.035;
  backing.castShadow = true;
  backing.receiveShadow = true;
  group.add(backing);

  const map = new THREE.Mesh(new THREE.PlaneGeometry(3.76, 1.94), mapMaterial);
  map.position.z = 0.018;
  group.add(map);

  group.name = "visitor-world-map";
  group.position.set(ROOM.rightWallX - 0.09, 3.06, -1.7);
  group.rotation.y = -Math.PI / 2;
  return {group, texture};
}

export function createWorldMapTexture(THREE: typeof import("three"), location: VisitorLocation | null, worldMap: WorldMapGeoJson | null = null) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 720;
  drawWorldMap(canvas, location, worldMap);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function updateWorldMapTexture(texture: Texture, location: VisitorLocation | null, worldMap: WorldMapGeoJson | null = null) {
  if (!(texture.image instanceof HTMLCanvasElement)) {
    return;
  }
  drawWorldMap(texture.image, location, worldMap);
  texture.needsUpdate = true;
}

function drawWorldMap(canvas: HTMLCanvasElement, location: VisitorLocation | null, worldMap: WorldMapGeoJson | null) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#0f1724");
  background.addColorStop(1, "#070b12");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(127,255,230,0.075)";
  context.lineWidth = 1;
  for (let x = 82; x < canvas.width; x += 82) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 72; y < canvas.height; y += 72) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  const mapBounds = {x: 72, y: 104, width: canvas.width - 144, height: canvas.height - 166};
  context.save();
  context.beginPath();
  roundedCanvasRect(context, mapBounds.x, mapBounds.y, mapBounds.width, mapBounds.height, 18);
  context.clip();
  context.fillStyle = "rgba(8,14,24,0.74)";
  context.fillRect(mapBounds.x, mapBounds.y, mapBounds.width, mapBounds.height);
  if (worldMap) {
    drawGeoJsonMap(context, mapBounds, worldMap);
  } else {
    context.font = "800 34px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(219,234,254,0.54)";
    context.fillText("LOADING MAP DATA", mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2);
    context.textAlign = "start";
    context.textBaseline = "alphabetic";
  }
  context.restore();

  context.strokeStyle = "rgba(127,255,230,0.24)";
  context.lineWidth = 2;
  roundedCanvasRect(context, mapBounds.x, mapBounds.y, mapBounds.width, mapBounds.height, 18);
  context.stroke();

  context.fillStyle = "#dbeafe";
  context.font = "800 34px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText("VISITOR MAP", 54, 68);
  context.font = "500 24px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "rgba(219,234,254,0.62)";
  context.fillText(locationLabel(location), 54, 106);

  const pins = [...VISITOR_HISTORY_PINS];
  if (location !== null && location.latitude !== null && location.longitude !== null) {
    pins.push({
      current: true,
      label: locationLabel(location),
      latitude: location.latitude,
      longitude: location.longitude
    });
  }
  for (const pin of pins) {
    const point = projectGeoToCanvas(mapBounds, pin.latitude, pin.longitude);
    drawThumbtack(context, point.x, point.y, pin.current ? "#ffd76a" : "#ff4747", pin.current);
  }

  context.font = "700 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "rgba(219,234,254,0.58)";
  context.fillText("GOLD = CURRENT VISITOR", 54, canvas.height - 38);
  context.fillStyle = "rgba(255,120,120,0.74)";
  context.fillText("RED = RECORDED VISITS", 404, canvas.height - 38);
}

function drawGeoJsonMap(
  context: CanvasRenderingContext2D,
  bounds: {x: number; y: number; width: number; height: number},
  geoJson: WorldMapGeoJson
) {
  context.fillStyle = "#233852";
  context.strokeStyle = "rgba(151,215,255,0.5)";
  context.lineWidth = 1.8;
  for (const feature of geoJson.features) {
    const geometry = feature.geometry;
    if (!geometry) {
      continue;
    }
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    if (!isGeoJsonPolygons(polygons)) {
      continue;
    }
    for (const polygon of polygons) {
      drawGeoPolygon(context, bounds, polygon);
    }
  }
}

function isGeoJsonPolygons(value: unknown): value is number[][][][] {
  return Array.isArray(value);
}

function drawGeoPolygon(
  context: CanvasRenderingContext2D,
  bounds: {x: number; y: number; width: number; height: number},
  rings: number[][][]
) {
  context.beginPath();
  for (const ring of rings) {
    for (const [index, coordinate] of ring.entries()) {
      const [longitude, latitude] = coordinate;
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        continue;
      }
      const point = projectGeoToCanvas(bounds, latitude, longitude);
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    }
    context.closePath();
  }
  context.fill();
  context.stroke();
}

function projectGeoToCanvas(
  bounds: {x: number; y: number; width: number; height: number},
  latitude: number,
  longitude: number
) {
  const clampedLatitude = Math.max(-58, Math.min(78, latitude));
  return {
    x: bounds.x + ((longitude + 180) / 360) * bounds.width,
    y: bounds.y + ((78 - clampedLatitude) / 136) * bounds.height
  };
}

function drawThumbtack(context: CanvasRenderingContext2D, x: number, y: number, color: string, current = false) {
  context.save();
  context.shadowColor = current ? "rgba(255,215,106,0.95)" : "rgba(255,71,71,0.72)";
  context.shadowBlur = current ? 28 : 18;
  context.fillStyle = color;
  context.strokeStyle = current ? "#fff6bf" : "#fecaca";
  context.lineWidth = current ? 5 : 3;
  context.beginPath();
  context.arc(x, y - 18, current ? 17 : 13, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.beginPath();
  context.moveTo(x - 7, y - 4);
  context.lineTo(x + 7, y - 4);
  context.lineTo(x, y + 26);
  context.closePath();
  context.fillStyle = current ? "#d69b1f" : "#b91c1c";
  context.fill();
  context.restore();
}

function locationLabel(location: VisitorLocation | null) {
  if (!location || location.latitude === null || location.longitude === null) {
    return "LOCATION PENDING";
  }
  return [location.city, location.region, location.country].filter(Boolean).join(" / ") || "VISITOR LOCATION";
}


function roundedCanvasRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
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
