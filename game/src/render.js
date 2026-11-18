// Canvas rendering: the city, its cars and people, effects and the
// warm daylight that ties it together. Everything is drawn in code —
// no image files. Only what the camera can see is drawn.

import {
  PALETTE, PARK, ROAD_W, ROAD_XS, ROAD_YS, SAND_Y, WATER_Y, WORLD_H, WORLD_W,
} from "./config.js";
import { currentObjective, missionPickupMarker } from "./missions.js";
import { shakeOffset } from "./effects.js";

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function hashN(seed, i) {
  let h = (seed * 2654435761 + i * 40503) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function render(state, ctx, viewW, viewH) {
  const cam = state.camera;
  const zoom = cam.zoom || 1;
  const worldW = viewW / zoom;
  const worldH = viewH / zoom;
  const shake = shakeOffset(state);
  const cx = cam.x + shake.x;
  const cy = cam.y + shake.y;
  const left = cx - worldW / 2;
  const top = cy - worldH / 2;
  const right = cx + worldW / 2;
  const bottom = cy + worldH / 2;

  ctx.save();
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.fillStyle = "#6f9e52";
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.translate(Math.round(viewW / 2), Math.round(viewH / 2));
  ctx.scale(zoom, zoom);
  ctx.translate(Math.round(-cx), Math.round(-cy));

  drawGround(state, ctx, left, top, right, bottom);
  drawProps(state, ctx, left, top, right, bottom);
  drawTrees(state, ctx, left, top, right, bottom);
  drawBuildings(state, ctx, left, top, right, bottom);
  drawSkids(state, ctx);
  drawWaypoint(state, ctx);
  drawPickupMarker(state, ctx);
  drawCars(state, ctx, left, top, right, bottom);
  drawPeople(state, ctx, left, top, right, bottom);
  drawBullets(state, ctx);
  drawParticles(state, ctx);
  drawFloats(state, ctx);
  ctx.restore();

  drawLighting(state, ctx, viewW, viewH);
  drawEdgeArrow(state, ctx, viewW, viewH);
}

function drawGround(state, ctx, left, top, right, bottom) {
  // Base grass.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Mown stripes for a sun-baked feel.
  ctx.fillStyle = PALETTE.grassDark;
  for (let y = 0; y < WORLD_H; y += 240) {
    ctx.fillRect(0, y, WORLD_W, 120);
  }
  // City blocks: sidewalk slabs with inner lots.
  for (let ix = 0; ix < ROAD_XS.length - 1; ix += 1) {
    for (let iy = 0; iy < ROAD_YS.length - 1; iy += 1) {
      const bx = ROAD_XS[ix] + ROAD_W / 2;
      const by = ROAD_YS[iy] + ROAD_W / 2;
      const bw = ROAD_XS[ix + 1] - ROAD_XS[ix] - ROAD_W;
      const bh = ROAD_YS[iy + 1] - ROAD_YS[iy] - ROAD_W;
      if (bx > right || bx + bw < left || by > bottom || by + bh < top) continue;
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = PALETTE.lot;
      ctx.fillRect(bx + 12, by + 12, bw - 24, bh - 24);
    }
  }
  // Park.
  ctx.fillStyle = PALETTE.parkGrass;
  ctx.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);
  ctx.strokeStyle = "#d8d2c4";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(PARK.x, PARK.y + PARK.h / 2);
  ctx.lineTo(PARK.x + PARK.w, PARK.y + PARK.h / 2);
  ctx.moveTo(PARK.x + PARK.w / 2, PARK.y);
  ctx.lineTo(PARK.x + PARK.w / 2, PARK.y + PARK.h);
  ctx.stroke();
  // Sand and water.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, SAND_Y, WORLD_W, WATER_Y - SAND_Y);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, WATER_Y, WORLD_W, WORLD_H - WATER_Y);
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(0, WATER_Y + 130, WORLD_W, WORLD_H - WATER_Y - 130);
  // Animated wave lines.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  const t = state.time;
  for (let i = 0; i < 14; i += 1) {
    const wy = WATER_Y + 30 + i * 20;
    ctx.beginPath();
    for (let x = 0; x <= WORLD_W; x += 90) {
      const yy = wy + Math.sin(x / 160 + t * 1.4 + i) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, SAND_Y);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = PALETTE.dash;
  for (const rx of ROAD_XS) {
    for (let y = 30; y < SAND_Y; y += 64) {
      if (isNearIntersectionY(y)) continue;
      ctx.fillRect(rx - 3, y, 6, 30);
    }
  }
  for (const ry of ROAD_YS) {
    for (let x = 30; x < WORLD_W; x += 64) {
      if (isNearIntersectionX(x)) continue;
      ctx.fillRect(x, ry - 3, 30, 6);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = "rgba(232,228,218,0.85)";
  for (const rx of ROAD_XS) {
    for (const ry of ROAD_YS) {
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(rx - ROAD_W / 2 + 8, ry - 34 + i * 15, 22, 8);
        ctx.fillRect(rx + ROAD_W / 2 - 30, ry - 34 + i * 15, 22, 8);
        ctx.fillRect(rx - 34 + i * 15, ry - ROAD_W / 2 + 8, 8, 22);
        ctx.fillRect(rx - 34 + i * 15, ry + ROAD_W / 2 - 30, 8, 22);
      }
    }
  }
  // Pier planks.
  ctx.fillStyle = "#8a6a4a";
  ctx.fillRect(2360, SAND_Y - 10, 80, WATER_Y - SAND_Y + 150);
  ctx.fillStyle = "#75563c";
  for (let y = SAND_Y; y < WATER_Y + 140; y += 26) ctx.fillRect(2360, y, 80, 4);
}

function isNearIntersectionY(y) {
  for (const ry of ROAD_YS) if (Math.abs(y - ry) < 70) return true;
  return false;
}
function isNearIntersectionX(x) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) < 70) return true;
  return false;
}

function drawProps(state, ctx, left, top, right, bottom) {
  for (const p of state.world.props) {
    if (p.x + p.w < left || p.x - p.w > right || p.y + p.h < top || p.y - p.h > bottom) continue;
    if (p.kind === "pond") {
      ctx.fillStyle = "#4d9ec4";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e6d199";
      ctx.lineWidth = 5;
      ctx.stroke();
    } else if (p.kind === "bandstand") {
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(p.x + 6, p.y + 8, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8e4da";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c96f7d";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.w / 2 - 10, p.h / 2 - 10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "kiosk") {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(p.x - p.w / 2 + 5, p.y - p.h / 2 + 7, p.w, p.h);
      ctx.fillStyle = "#e8a34c";
      ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
      ctx.fillStyle = "#d97b5f";
      ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, 12);
    } else if (p.kind === "bench") {
      ctx.fillStyle = "#7a5a3a";
      ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    } else if (p.kind === "crate") {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(p.x - p.w / 2 + 4, p.y - p.h / 2 + 5, p.w, p.h);
      ctx.fillStyle = "#a8834a";
      ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
      ctx.strokeStyle = "#7a5f30";
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
      ctx.beginPath();
      ctx.moveTo(p.x - p.w / 2, p.y - p.h / 2);
      ctx.lineTo(p.x + p.w / 2, p.y + p.h / 2);
      ctx.moveTo(p.x + p.w / 2, p.y - p.h / 2);
      ctx.lineTo(p.x - p.w / 2, p.y + p.h / 2);
      ctx.stroke();
    } else if (p.kind === "boat") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.ellipse(3, 6, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f2ede2";
      ctx.beginPath();
      ctx.ellipse(0, 0, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c94f43";
      ctx.fillRect(-p.w * 0.2, -p.h * 0.28, p.w * 0.3, p.h * 0.56);
      ctx.restore();
    }
  }
  // Street lamps.
  for (const lamp of state.world.lamps) {
    if (lamp.x < left || lamp.x > right || lamp.y < top || lamp.y > bottom) continue;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(lamp.x + 4, lamp.y + 5, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a42";
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe9a3";
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrees(state, ctx, left, top, right, bottom) {
  for (const tree of state.world.trees) {
    if (tree.x < left - 60 || tree.x > right + 60 || tree.y < top - 60 || tree.y > bottom + 60) continue;
    const s = tree.s;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(tree.x + 8 * s, tree.y + 10 * s, 20 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    if (tree.palm) {
      ctx.strokeStyle = "#7a5a3a";
      ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(tree.x, tree.y);
      ctx.quadraticCurveTo(tree.x + 6 * s, tree.y - 16 * s, tree.x + 10 * s, tree.y - 26 * s);
      ctx.stroke();
      ctx.strokeStyle = "#4e8a3c";
      ctx.lineWidth = 4 * s;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(tree.x + 10 * s, tree.y - 26 * s);
        ctx.quadraticCurveTo(
          tree.x + 10 * s + Math.cos(a) * 16 * s, tree.y - 26 * s + Math.sin(a) * 16 * s - 4,
          tree.x + 10 * s + Math.cos(a) * 26 * s, tree.y - 26 * s + Math.sin(a) * 26 * s + 6,
        );
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = "#5d8f43";
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, 22 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6da34e";
      ctx.beginPath();
      ctx.arc(tree.x - 6 * s, tree.y - 6 * s, 14 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7cb85a";
      ctx.beginPath();
      ctx.arc(tree.x - 10 * s, tree.y - 10 * s, 7 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBuildings(state, ctx, left, top, right, bottom) {
  const sorted = state.world.buildings;
  for (const b of sorted) {
    if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
    const lift = b.tall ? 22 : 12;
    ctx.fillStyle = "rgba(0,0,0,0.20)";
    ctx.fillRect(b.x + lift * 0.7, b.y + lift, b.w, b.h);
    // Walls.
    ctx.fillStyle = "#8f887c";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // Roof detail: vents and skylights from the building seed.
    const cols = Math.max(2, Math.floor(b.w / 46));
    const rows = Math.max(2, Math.floor(b.h / 46));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const h1 = hashN(b.winSeed, i * 31 + j * 7);
        if (h1 < 0.4) {
          ctx.fillStyle = h1 < 0.2 ? "#e8f0f2" : "rgba(255,255,255,0.35)";
          ctx.fillRect(b.x + 12 + i * ((b.w - 24) / cols), b.y + 12 + j * ((b.h - 24) / rows), 16, 12);
        }
      }
    }
    if (b.awning) {
      ctx.fillStyle = "#e8e4da";
      ctx.fillRect(b.x + b.w * 0.3, b.y + b.h - 4, b.w * 0.4, 10);
      ctx.fillStyle = "#d97b5f";
      for (let x = b.x + b.w * 0.3; x < b.x + b.w * 0.7; x += 12) {
        ctx.fillRect(x, b.y + b.h - 4, 6, 10);
      }
    }
  }
}

function drawSkids(state, ctx) {
  ctx.fillStyle = "rgba(20,20,24,0.4)";
  for (const s of state.skids) {
    const alpha = Math.min(0.4, (s.life / 7) * 0.4);
    ctx.fillStyle = "rgba(20,20,24," + alpha.toFixed(2) + ")";
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillRect(-7, -2, 14, 4);
    ctx.restore();
  }
}

function drawWaypoint(state, ctx) {
  const obj = currentObjective(state);
  if (obj.x === null) return;
  const pulse = 1 + Math.sin(state.time * 4) * 0.15;
  const gx = obj.x;
  const gy = obj.y;
  // Ground ring.
  ctx.strokeStyle = "#ffd23d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(gx, gy, 34 * pulse, 20 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,210,61,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(gx, gy, 46 * pulse, 27 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Beacon column.
  const grad = ctx.createLinearGradient(gx, gy - 150, gx, gy);
  grad.addColorStop(0, "rgba(255,210,61,0)");
  grad.addColorStop(1, "rgba(255,210,61,0.55)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(gx - 10, gy);
  ctx.lineTo(gx - 4, gy - 150);
  ctx.lineTo(gx + 4, gy - 150);
  ctx.lineTo(gx + 10, gy);
  ctx.closePath();
  ctx.fill();
  // Diamond marker.
  ctx.fillStyle = "#ff5a3c";
  ctx.save();
  ctx.translate(gx, gy - 150 + Math.sin(state.time * 3) * 5);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-9, -9, 18, 18);
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("▼", gx, gy - 128);
}

function drawPickupMarker(state, ctx) {
  const m = missionPickupMarker(state);
  if (!m) return;
  const bob = Math.sin(state.time * 3) * 3;
  ctx.save();
  ctx.translate(m.x, m.y + bob);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(2, 14, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (m.item === "briefcase") {
    ctx.fillStyle = "#6b4226";
    rr(ctx, -14, -8, 28, 18, 3);
    ctx.fill();
    ctx.strokeStyle = "#3a2413";
    ctx.lineWidth = 2;
    ctx.strokeRect(-6, -13, 12, 6);
    ctx.fillStyle = "#d9b23c";
    ctx.fillRect(-3, -2, 6, 4);
  } else if (m.item === "loot") {
    ctx.fillStyle = "#c9a23c";
    ctx.beginPath();
    ctx.arc(0, 2, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a6a1c";
    ctx.fillRect(-6, -14, 12, 7);
    ctx.fillStyle = "#fff3b0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("$", 0, 7);
  } else {
    ctx.fillStyle = "#c9a86a";
    rr(ctx, -13, -9, 26, 18, 2);
    ctx.fill();
    ctx.fillStyle = "#a8834a";
    ctx.fillRect(-2, -9, 4, 18);
  }
  ctx.restore();
}

function drawCars(state, ctx, left, top, right, bottom) {
  const cars = state.cars.slice().sort((a, b) => a.y - b.y);
  for (const car of cars) {
    if (car.x < left - 80 || car.x > right + 80 || car.y < top - 80 || car.y > bottom + 80) continue;
    drawCar(state, ctx, car);
  }
}

export function drawCar(state, ctx, car) {
  const def = car.def;
  const w = def.w;
  const h = def.h;
  ctx.save();
  ctx.translate(car.x, car.y);
  // Shadow.
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  rr(ctx, -w / 2 + 4, -h / 2 + 6, w, h, 8);
  ctx.fill();
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = "#1c1c20";
  const ww = 9;
  const wh = 5;
  ctx.fillRect(w / 2 - 14, -h / 2 - 2, ww, wh);
  ctx.fillRect(w / 2 - 14, h / 2 - 3, ww, wh);
  ctx.fillRect(-w / 2 + 5, -h / 2 - 2, ww, wh);
  ctx.fillRect(-w / 2 + 5, h / 2 - 3, ww, wh);
  // Body.
  ctx.fillStyle = car.color;
  rr(ctx, -w / 2, -h / 2, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Hood shading and roof.
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  rr(ctx, w * 0.18, -h / 2 + 3, w * 0.22, h - 6, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  rr(ctx, -w * 0.16, -h / 2 + 3, w * 0.3, h - 6, 4);
  ctx.fill();
  // Windshield and rear window.
  ctx.fillStyle = "#bcd6e2";
  rr(ctx, w * 0.06, -h / 2 + 3, 8, h - 6, 2);
  ctx.fill();
  ctx.fillStyle = "#9fb8c4";
  rr(ctx, -w * 0.3, -h / 2 + 3, 6, h - 6, 2);
  ctx.fill();
  // Headlights and taillights.
  ctx.fillStyle = "#fff8d0";
  ctx.fillRect(w / 2 - 3, -h / 2 + 3, 3, 5);
  ctx.fillRect(w / 2 - 3, h / 2 - 8, 3, 5);
  ctx.fillStyle = "#d92b2b";
  ctx.fillRect(-w / 2, -h / 2 + 3, 3, 5);
  ctx.fillRect(-w / 2, h / 2 - 8, 3, 5);
  if (car.type === "taxi") {
    ctx.fillStyle = "#222831";
    ctx.fillRect(-6, -4, 12, 8);
    ctx.fillStyle = "#e8b93c";
    ctx.font = "bold 6px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TAXI", 0, 2);
  }
  if (car.type === "police") {
    ctx.fillStyle = "#e8e4da";
    rr(ctx, -w * 0.1, -h / 2 + 2, w * 0.34, h - 4, 3);
    ctx.fill();
    const flash = Math.floor(state.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? "#e82b2b" : "#2b6fd9";
    ctx.fillRect(-4, -h / 2 - 1, 8, 4);
    ctx.fillStyle = flash ? "#2b6fd9" : "#e82b2b";
    ctx.fillRect(-4, h / 2 - 3, 8, 4);
    // Light glow.
    ctx.fillStyle = flash ? "rgba(232,43,43,0.10)" : "rgba(43,111,217,0.10)";
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.type === "van" || car.type === "truck") {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(-w / 2 + 6, -h / 2 + 4, w * 0.5, h - 8);
  }
  ctx.restore();
  // Damage smoke is handled by particles; a wreck shows a dark tint.
  if (car.health < 30) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = "rgba(20,20,20,0.25)";
    rr(ctx, -w / 2, -h / 2, w, h, 8);
    ctx.fill();
    ctx.restore();
  }
}

function drawPeople(state, ctx, left, top, right, bottom) {
  const p = state.player;
  const drawables = [];
  for (const ped of state.peds) drawables.push({ kind: "ped", o: ped });
  for (const e of state.enemies) drawables.push({ kind: "enemy", o: e });
  for (const o of state.officers) drawables.push({ kind: "officer", o });
  if (!p.inCar) drawables.push({ kind: "player", o: p });
  drawables.sort((a, b) => a.o.y - b.o.y);
  for (const d of drawables) {
    const o = d.o;
    if (o.x < left - 40 || o.x > right + 40 || o.y < top - 40 || o.y > bottom + 40) continue;
    if (d.kind === "ped") drawPerson(ctx, o, o.shirt, o.pants, o.skin, o.down, o.stepT, false);
    else if (d.kind === "enemy") {
      drawPerson(ctx, o, "#7a2e2e", "#222831", o.skin, false, state.time * 4, true);
      if (o.hp < o.maxHp) drawHealthBar(ctx, o.x, o.y - 26, o.hp / o.maxHp);
    } else if (d.kind === "officer") {
      drawPerson(ctx, o, "#2b4d7a", "#20242c", "#e0ac69", false, state.time * 4, true);
      drawCap(ctx, o);
    } else {
      drawPerson(ctx, o, "#1f8a8a", "#2c3e50", "#f2c89b", false, state.time * 6, p.weapon === "pistol");
      drawPlayerExtras(state, ctx, o);
    }
  }
}

function drawPerson(ctx, o, shirt, pants, skin, down, stepPhase, armed) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(2, 5, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (down) {
    ctx.rotate(o.angle);
    ctx.fillStyle = shirt;
    rr(ctx, -14, -6, 28, 12, 5);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(16, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(o.angle);
  const swing = Math.sin(stepPhase) * 3;
  // Legs.
  ctx.fillStyle = pants;
  ctx.fillRect(-8, -7 + swing * 0.4, 12, 5);
  ctx.fillRect(-8, 2 - swing * 0.4, 12, 5);
  // Torso.
  ctx.fillStyle = shirt;
  rr(ctx, -9, -8, 18, 16, 6);
  ctx.fill();
  // Arms: one reaches forward when armed.
  ctx.fillStyle = skin;
  if (armed) {
    ctx.fillRect(6, -3, 12, 5);
    ctx.fillStyle = "#2b2b30";
    ctx.fillRect(16, -2, 8, 3);
  } else {
    ctx.fillRect(2, -11, 9, 4);
    ctx.fillRect(2, 7, 9, 4);
  }
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(2, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.arc(0, -2, 6, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCap(ctx, o) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.angle);
  ctx.fillStyle = "#1c2f4a";
  ctx.beginPath();
  ctx.arc(2, 0, 7.5, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  ctx.restore();
}

function drawPlayerExtras(state, ctx, p) {
  // Melee swing arc.
  if (p.meleeAnim > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.strokeStyle = "rgba(255,255,255," + Math.min(0.8, p.meleeAnim * 4).toFixed(2) + ")";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 30, -0.9, 0.9);
    ctx.stroke();
    ctx.restore();
  }
  // Muzzle flash.
  if (p.muzzleT > 0) {
    const mx = p.x + Math.cos(p.angle) * 26;
    const my = p.y + Math.sin(p.angle) * 26;
    ctx.fillStyle = "#ffe9a3";
    ctx.beginPath();
    ctx.arc(mx, my, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff9a3c";
    ctx.beginPath();
    ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Direction ring so the player reads at a glance.
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHealthBar(ctx, x, y, frac) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - 16, y, 32, 5);
  ctx.fillStyle = frac > 0.4 ? "#7ddb6a" : "#e82b2b";
  ctx.fillRect(x - 16, y, 32 * Math.max(0, frac), 5);
}

function drawBullets(state, ctx) {
  ctx.strokeStyle = "#ffe9a3";
  ctx.lineWidth = 2;
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
    ctx.stroke();
  }
}

function drawParticles(state, ctx) {
  for (const p of state.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloats(state, ctx) {
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const f of state.floats) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = "#222";
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawLighting(state, ctx, viewW, viewH) {
  // Warm afternoon sun: a soft amber wash, stronger at the top.
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, "rgba(255,214,130,0.10)");
  grad.addColorStop(0.6, "rgba(255,214,130,0.03)");
  grad.addColorStop(1, "rgba(30,40,80,0.08)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  // Vignette.
  const vg = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.42, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(20,16,8,0.28)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, viewW, viewH);
  // Hurt flash.
  const p = state.player;
  if (p.hp < 30 && p.hp > 0) {
    const pulse = 0.10 + Math.sin(state.time * 5) * 0.05;
    ctx.fillStyle = "rgba(200,30,20," + pulse.toFixed(3) + ")";
    ctx.fillRect(0, 0, viewW, viewH);
  }
}

function drawEdgeArrow(state, ctx, viewW, viewH) {
  const obj = currentObjective(state);
  if (obj.x === null) return;
  const cam = state.camera;
  const zoom = cam.zoom || 1;
  const sx = (obj.x - cam.x) * zoom + viewW / 2;
  const sy = (obj.y - cam.y) * zoom + viewH / 2;
  if (sx > 40 && sx < viewW - 40 && sy > 40 && sy < viewH - 40) return;
  const cx = viewW / 2;
  const cy = viewH / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(ang) * (Math.min(viewW, viewH) / 2 - 50);
  const ey = cy + Math.sin(ang) * (Math.min(viewW, viewH) / 2 - 50);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.fillStyle = "#ffd23d";
  ctx.strokeStyle = "#7a5a00";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -11);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-8, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  const dist = Math.round(Math.hypot(obj.x - cam.x, obj.y - cam.y));
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(dist + "m", ex, ey + 28);
}
