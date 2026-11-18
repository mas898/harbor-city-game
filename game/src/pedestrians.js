// Pedestrians: city folk who stroll the sidewalks, gather near the
// market and the pier, and run when they hear a shot or see a car
// bearing down on them.

import { PARK, ROAD_W, ROAD_XS, ROAD_YS, SAND_Y, WORLD_H, WORLD_W } from "./config.js";
import { chance, pick, range } from "./random.js";
import { collideCircle, onRoad } from "./world.js";

const SHIRTS = ["#d9534f", "#4f7dd9", "#e8a34c", "#6aa84f", "#9b59b6", "#e8e4da", "#3a3a3a", "#e86aa0"];
const PANTS = ["#2c3e50", "#5a4a3a", "#3a5a3a", "#222831", "#6b5a8c"];
const SKINS = ["#f2c89b", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];

let nextPedId = 1;

export function makePed(x, y, rng) {
  return {
    id: nextPedId,
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 34, 58),
    shirt: pick(rng, SHIRTS),
    pants: pick(rng, PANTS),
    skin: pick(rng, SKINS),
    state: "walk",
    tx: x, ty: y,
    waitT: 0,
    fleeT: 0,
    stepT: range(rng, 0, 1),
    down: false,
  };
}

export function spawnPeds(state, count) {
  const rng = state.rng;
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 40) {
    tries += 1;
    let x;
    let y;
    const r = rng();
    if (r < 0.22) {
      // Park strollers.
      x = range(rng, PARK.x, PARK.x + PARK.w);
      y = range(rng, PARK.y, PARK.y + PARK.h);
    } else if (r < 0.36) {
      // Promenade walkers.
      x = range(rng, 120, WORLD_W - 120);
      y = range(rng, SAND_Y - 110, SAND_Y - 20);
    } else {
      // Sidewalk: just off a road edge.
      if (rng() < 0.5) {
        x = pick(rng, ROAD_XS) + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 16);
        y = range(rng, 120, 2900);
      } else {
        y = pick(rng, ROAD_YS) + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 16);
        x = range(rng, 120, WORLD_W - 120);
      }
    }
    const fixed = collideCircle(state.world, x, y, 12);
    if (onRoad(fixed.x, fixed.y) && r >= 0.36) continue;
    const ped = makePed(fixed.x, fixed.y, rng);
    nextPedId += 1;
    pickNewTarget(state, ped);
    state.peds.push(ped);
    placed += 1;
  }
}

function pickNewTarget(state, ped) {
  const rng = state.rng;
  for (let i = 0; i < 8; i += 1) {
    const nx = ped.x + range(rng, -420, 420);
    const ny = ped.y + range(rng, -420, 420);
    const fixed = collideCircle(state.world, nx, ny, 12);
    if (fixed.y > SAND_Y - 8 && fixed.y < SAND_Y + 200) {
      ped.tx = fixed.x; ped.ty = fixed.y;
      return;
    }
    if (!onRoad(fixed.x, fixed.y)) {
      ped.tx = fixed.x; ped.ty = fixed.y;
      return;
    }
  }
  ped.tx = ped.x;
  ped.ty = ped.y;
}

export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = "flee";
      ped.fleeT = 2.5 + Math.random() * 1.5;
      const a = Math.atan2(ped.y - y, ped.x - x);
      ped.tx = ped.x + Math.cos(a) * 320;
      ped.ty = ped.y + Math.sin(a) * 320;
    }
  }
}

export function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.down) continue;
    ped.stepT += dt * (ped.state === "flee" ? 9 : 4.5);
    if (ped.state === "flee") {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) {
        ped.state = "walk";
        pickNewTarget(state, ped);
      }
    } else if (ped.waitT > 0) {
      ped.waitT -= dt;
      if (ped.waitT <= 0) pickNewTarget(state, ped);
      continue;
    }
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 14) {
      if (ped.state === "walk" && chance(state.rng, 0.4)) ped.waitT = range(state.rng, 1, 4);
      else pickNewTarget(state, ped);
      continue;
    }
    const speed = ped.state === "flee" ? ped.speed * 3.1 : ped.speed;
    const nx = ped.x + (dx / d) * speed * dt;
    const ny = ped.y + (dy / d) * speed * dt;
    const fixed = collideCircle(state.world, nx, ny, 12);
    ped.x = fixed.x;
    ped.y = fixed.y;
    ped.angle = Math.atan2(dy, dx);
    // A fast car nearby spooks walkers.
    if (ped.state === "walk") {
      for (const car of state.cars) {
        if (Math.abs(car.speed) > 220 && Math.hypot(car.x - ped.x, car.y - ped.y) < 90) {
          ped.state = "flee";
          ped.fleeT = 2;
          const a = Math.atan2(ped.y - car.y, ped.x - car.x);
          ped.tx = ped.x + Math.cos(a) * 300;
          ped.ty = ped.y + Math.sin(a) * 300;
          break;
        }
      }
    }
  }
}
