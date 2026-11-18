// Cars: definitions, parked spawns, driving physics and collisions.
// A car is a plain object; traffic and police add their own fields and
// steer through the same physics.

import { CAR_TYPES, ROAD_W, ROAD_XS, ROAD_YS, WORLD_H, WORLD_W } from "./config.js";
import { pick, range } from "./random.js";
import { rectHitsBuilding } from "./world.js";
import { addShake, addSkid, burst, smokePuff } from "./effects.js";

let nextCarId = 1;

export function makeCar(type, x, y, angle, color) {
  const def = CAR_TYPES[type];
  const car = {
    id: nextCarId,
    type,
    def,
    x, y, angle,
    speed: 0,
    color: color || def.colors[0],
    role: "parked",
    driver: null,
    health: 100,
    smokeT: 0,
    route: null,
    routeIndex: 0,
    waitT: 0,
    siren: type === "police",
    targetSpeed: 0,
    stolen: false,
  };
  nextCarId += 1;
  return car;
}

export function spawnParkedCars(state, count) {
  const rng = state.rng;
  const types = ["sedan", "sedan", "taxi", "van", "sport", "truck"];
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 30) {
    tries += 1;
    const vertical = rng() < 0.5;
    const type = pick(rng, types);
    let x;
    let y;
    let angle;
    if (vertical) {
      const rx = pick(rng, ROAD_XS);
      const side = rng() < 0.5 ? -1 : 1;
      x = rx + side * (ROAD_W / 2 - 16);
      y = range(rng, 160, 2900);
      angle = side < 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      const ry = pick(rng, ROAD_YS);
      const side = rng() < 0.5 ? -1 : 1;
      y = ry + side * (ROAD_W / 2 - 16);
      x = range(rng, 160, WORLD_W - 160);
      angle = side < 0 ? Math.PI : 0;
    }
    if (tooCloseToCar(state, x, y, 70)) continue;
    const car = makeCar(type, x, y, angle, pick(rng, CAR_TYPES[type].colors));
    state.cars.push(car);
    placed += 1;
  }
}

function tooCloseToCar(state, x, y, d) {
  for (const c of state.cars) {
    if (Math.hypot(c.x - x, c.y - y) < d) return true;
  }
  return false;
}

export function nearestCar(state, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const c of state.cars) {
    if (c.role === "police" && c.chasing) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Drive one car with throttle (-1..1), steer (-1..1) and handbrake.
// Handles walls, other cars and skid marks; returns true on a hard hit.
export function driveCar(state, car, dt, throttle, steer, handbrake) {
  const def = car.def;
  const prevX = car.x;
  const prevY = car.y;
  const prevAngle = car.angle;

  if (throttle > 0) car.speed += def.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 8) car.speed += def.accel * 1.6 * throttle * dt;
    else car.speed += def.accel * 0.6 * throttle * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 90 * dt);
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 420 * dt);
  }
  const maxF = def.maxSpeed;
  const maxR = -def.reverse;
  car.speed = Math.max(maxR, Math.min(maxF, car.speed));

  const speedFrac = Math.min(1, Math.abs(car.speed) / def.maxSpeed);
  const steerAuthority = def.steer * (0.35 + 0.65 * (1 - speedFrac * 0.55));
  car.angle += steer * steerAuthority * dt * Math.sign(car.speed || 1) * Math.min(1, Math.abs(car.speed) / 60 + 0.15);

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Skid marks while sliding or handbraking at speed.
  const sliding = handbrake && Math.abs(car.speed) > 120;
  const hardTurn = Math.abs(steer) > 0.85 && Math.abs(car.speed) > def.maxSpeed * 0.55;
  if (sliding || hardTurn) {
    addSkid(state, car.x - Math.cos(car.angle) * def.w * 0.3, car.y - Math.sin(car.angle) * def.w * 0.3, car.angle);
  }

  let crashed = false;
  if (rectHitsBuilding(state.world, car.x, car.y, def.w, def.h, car.angle)) {
    car.x = prevX;
    car.y = prevY;
    car.angle = prevAngle;
    if (Math.abs(car.speed) > 130) {
      crashed = true;
      car.health -= 8;
      burst(state, car.x, car.y, { count: 12, color: "#ffcf5a", speed: 160 });
      addShake(state, 6);
      state.audio.crash();
    }
    car.speed *= -0.18;
  }

  // Car-to-car bumps.
  for (const other of state.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    const minD = (def.w + other.def.w) / 2 - 8;
    if (d > 0.01 && d < minD) {
      const push = (minD - d) / 2 + 1;
      const nx = dx / d;
      const ny = dy / d;
      car.x -= nx * push;
      car.y -= ny * push;
      other.x += nx * push;
      other.y += ny * push;
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 140) {
        crashed = true;
        car.health -= 6;
        other.health -= 6;
        burst(state, (car.x + other.x) / 2, (car.y + other.y) / 2, { count: 10, color: "#ffd76e", speed: 150 });
        addShake(state, 5);
        state.audio.crash();
      }
      // Glancing contact keeps momentum; only a hard hit scrubs speed.
      const keep = rel > 140 ? 0.72 : 0.88;
      car.speed *= keep;
      other.speed *= keep;
    }
  }

  // Keep inside the world and out of the water.
  car.x = Math.max(30, Math.min(WORLD_W - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD_H - 60, car.y));
  if (car.y > 3280) { car.y = 3280; car.speed *= 0.4; }

  // Damage smoke.
  if (car.health < 45) {
    car.smokeT -= dt;
    if (car.smokeT <= 0) {
      car.smokeT = 0.12;
      smokePuff(state, car.x + Math.cos(car.angle) * def.w * 0.35, car.y + Math.sin(car.angle) * def.w * 0.35);
    }
  }
  return crashed;
}

export function carFront(car) {
  return {
    x: car.x + Math.cos(car.angle) * car.def.w * 0.5,
    y: car.y + Math.sin(car.angle) * car.def.w * 0.5,
  };
}
