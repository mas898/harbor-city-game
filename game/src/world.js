// Harbor City layout: a road grid, building blocks, a park, and a
// waterfront. Generation is seeded, so the same seed always builds the
// same city. This module also answers collision and road queries.

import {
  DISTRICTS, PALETTE, PARK, PLACES, ROAD_W, ROAD_XS, ROAD_YS, SAND_Y, WATER_Y,
  WORLD_H, WORLD_W,
} from "./config.js";
import { chance, makeRng, pick, range, rangeInt } from "./random.js";

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE];

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const props = [];

  // Blocks sit between neighbouring roads. Each block gets up to four
  // buildings around a small courtyard, or stays open as a lot.
  for (let ix = 0; ix < ROAD_XS.length - 1; ix += 1) {
    for (let iy = 0; iy < ROAD_YS.length - 1; iy += 1) {
      const bx = ROAD_XS[ix] + ROAD_W / 2 + 14;
      const by = ROAD_YS[iy] + ROAD_W / 2 + 14;
      const bw = ROAD_XS[ix + 1] - ROAD_XS[ix] - ROAD_W - 28;
      const bh = ROAD_YS[iy + 1] - ROAD_YS[iy] - ROAD_W - 28;
      const isPark = bx <= PARK.x + 2 && by <= PARK.y + 2 && bx + bw >= PARK.x + PARK.w - 2;
      if (isPark) {
        buildPark(trees, props, rng);
        continue;
      }
      const open = chance(rng, 0.14);
      if (open) {
        // Open lot: a few trees and a kiosk block.
        for (let t = 0; t < 4; t += 1) {
          trees.push({ x: range(rng, bx + 30, bx + bw - 30), y: range(rng, by + 30, by + bh - 30), s: range(rng, 0.8, 1.25) });
        }
        props.push({ kind: "kiosk", x: bx + bw / 2, y: by + bh / 2, w: 60, h: 44 });
        continue;
      }
      const cols = chance(rng, 0.5) ? 2 : 2;
      const rows = 2;
      const gap = 34;
      const cw = (bw - gap * (cols + 1)) / cols;
      const ch = (bh - gap * (rows + 1)) / rows;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if (chance(rng, 0.08)) {
            trees.push({
              x: bx + gap + cx * (cw + gap) + cw / 2,
              y: by + gap + cy * (ch + gap) + ch / 2,
              s: range(rng, 0.9, 1.3),
            });
            continue;
          }
          const w = range(rng, cw * 0.8, cw);
          const h = range(rng, ch * 0.8, ch);
          const x = bx + gap + cx * (cw + gap) + (cw - w) / 2;
          const y = by + gap + cy * (ch + gap) + (ch - h) / 2;
          buildings.push({
            x, y, w, h,
            roof: pick(rng, ROOFS),
            tall: chance(rng, 0.3),
            winSeed: rangeInt(rng, 1, 9999),
            awning: chance(rng, 0.35),
          });
        }
      }
    }
  }

  // Street lamps at intersections and trees along the promenade.
  for (const rx of ROAD_XS) {
    for (const ry of ROAD_YS) {
      lamps.push({ x: rx + ROAD_W / 2 + 8, y: ry + ROAD_W / 2 + 8 });
    }
  }
  for (let x = 160; x < WORLD_W; x += 190) {
    trees.push({ x: x + range(rng, -30, 30), y: SAND_Y - 60 + range(rng, -14, 14), s: range(rng, 0.9, 1.3), palm: true });
  }
  // Boats anchored off the pier.
  props.push({ kind: "boat", x: 2250, y: WATER_Y + 130, w: 90, h: 30, angle: 0.2 });
  props.push({ kind: "boat", x: 2620, y: WATER_Y + 190, w: 70, h: 26, angle: -0.3 });
  props.push({ kind: "boat", x: 3050, y: WATER_Y + 120, w: 110, h: 34, angle: 0.05 });

  // Warehouses on the waterfront strip, with a loading yard between them.
  buildings.push({ x: 2030, y: 2850, w: 260, h: 180, roof: "#a85a4a", tall: false, winSeed: 4242, awning: false });
  buildings.push({ x: 2570, y: 2860, w: 240, h: 160, roof: "#7a6a4f", tall: false, winSeed: 777, awning: false });
  buildings.push({ x: 3200, y: 2850, w: 280, h: 170, roof: "#8c8c84", tall: false, winSeed: 1234, awning: false });
  props.push({ kind: "crate", x: 2330, y: 2910, w: 30, h: 30 });
  props.push({ kind: "crate", x: 2366, y: 2914, w: 30, h: 30 });
  props.push({ kind: "crate", x: 2490, y: 2990, w: 30, h: 30 });
  props.push({ kind: "crate", x: 2340, y: 3050, w: 30, h: 30 });

  // Intersection nodes for traffic routing.
  const nodes = [];
  for (const rx of ROAD_XS) {
    for (const ry of ROAD_YS) {
      nodes.push({ x: rx, y: ry });
    }
  }

  return {
    seed, buildings, trees, lamps, props, nodes,
    places: PLACES,
  };
}

function buildPark(trees, props, rng) {
  for (let i = 0; i < 16; i += 1) {
    trees.push({
      x: range(rng, PARK.x + 30, PARK.x + PARK.w - 30),
      y: range(rng, PARK.y + 30, PARK.y + PARK.h - 30),
      s: range(rng, 0.9, 1.4),
    });
  }
  props.push({ kind: "pond", x: PARK.x + PARK.w * 0.68, y: PARK.y + PARK.h * 0.6, w: 120, h: 80 });
  props.push({ kind: "bandstand", x: PARK.x + PARK.w * 0.3, y: PARK.y + PARK.h * 0.35, w: 70, h: 70 });
  props.push({ kind: "bench", x: PARK.x + PARK.w * 0.5, y: PARK.y + PARK.h * 0.5, w: 34, h: 14 });
}

export function onRoad(x, y) {
  for (const rx of ROAD_XS) {
    if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  }
  for (const ry of ROAD_YS) {
    if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  }
  return false;
}

export function inWater(x, y) {
  return y >= WATER_Y;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROAD_XS) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of ROAD_YS) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}

export function nearestNode(world, x, y) {
  let best = world.nodes[0];
  let bestD = Infinity;
  for (const n of world.nodes) {
    const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

// Push a circle out of buildings, props, water and the world edge.
// Returns the corrected position.
export function collideCircle(world, x, y, r) {
  let cx = Math.max(r, Math.min(WORLD_W - r, x));
  let cy = Math.max(r, Math.min(WORLD_H - r, y));
  if (cy + r > WATER_Y) cy = WATER_Y - r;
  for (const b of world.buildings) {
    cx = pushOutRect(cx, cy, r, b.x, b.y, b.w, b.h).x;
    cy = pushOutRect(cx, cy, r, b.x, b.y, b.w, b.h).y;
  }
  for (const p of world.props) {
    if (p.kind === "boat" || p.kind === "pond") continue;
    const res = pushOutRect(cx, cy, r, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    cx = res.x;
    cy = res.y;
  }
  return { x: cx, y: cy };
}

function pushOutRect(x, y, r, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(x, rx + rw));
  const ny = Math.max(ry, Math.min(y, ry + rh));
  const dx = x - nx;
  const dy = y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return { x, y };
  if (d2 === 0) {
    // Centre inside the rectangle: push out along the smallest overlap.
    const left = x - rx;
    const right = rx + rw - x;
    const top = y - ry;
    const bottom = ry + rh - y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: rx - r, y };
    if (m === right) return { x: rx + rw + r, y };
    if (m === top) return { x, y: ry - r };
    return { x, y: ry + rh + r };
  }
  const d = Math.sqrt(d2);
  return { x: nx + (dx / d) * r, y: ny + (dy / d) * r };
}

export function rectHitsBuilding(world, x, y, w, h, angle) {
  // Approximate a rotated car with its four corners plus centre.
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const hw = w / 2;
  const hh = h / 2;
  const pts = [
    { x, y },
    { x: x + c * hw - s * hh, y: y + s * hw + c * hh },
    { x: x + c * hw + s * hh, y: y + s * hw - c * hh },
    { x: x - c * hw - s * hh, y: y - s * hw + c * hh },
    { x: x - c * hw + s * hh, y: y - s * hw - c * hh },
  ];
  for (const p of pts) {
    if (p.y >= WATER_Y) return true;
    if (p.x < 0 || p.x > WORLD_W || p.y < 0 || p.y > WORLD_H) return true;
    for (const b of world.buildings) {
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return true;
    }
  }
  return false;
}

export function districtName(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return "Harbor City";
}
