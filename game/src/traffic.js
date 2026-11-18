// Traffic: civilian cars that follow the road grid, keep a gap to the
// car ahead, and pause at busy intersections. They never leave the
// roads, which keeps them readable and out of the buildings.

import { CAR_TYPES, ROAD_W } from "./config.js";
import { pick, range } from "./random.js";
import { nearestNode } from "./world.js";
import { driveCar, makeCar } from "./vehicles.js";

export function spawnTraffic(state, count) {
  const rng = state.rng;
  const types = ["sedan", "sedan", "taxi", "van", "sport", "truck"];
  for (let i = 0; i < count; i += 1) {
    const type = pick(rng, types);
    const node = pick(rng, state.world.nodes);
    const car = makeCar(type, node.x + range(rng, -20, 20), node.y + range(rng, -20, 20), range(rng, 0, Math.PI * 2), pick(rng, CAR_TYPES[type].colors));
    car.role = "traffic";
    car.targetSpeed = range(rng, 130, 200);
    car.route = randomRoute(state, node, 6);
    car.routeIndex = 0;
    state.cars.push(car);
  }
}

function randomRoute(state, fromNode, length) {
  const route = [fromNode];
  let cur = fromNode;
  const rng = state.rng;
  for (let i = 0; i < length; i += 1) {
    const neighbours = state.world.nodes.filter((n) => {
      const sameRow = n.y === cur.y && Math.abs(n.x - cur.x) === 600;
      const sameCol = n.x === cur.x && Math.abs(n.y - cur.y) === 600;
      return sameRow || sameCol;
    });
    if (neighbours.length === 0) break;
    cur = pick(rng, neighbours);
    route.push(cur);
  }
  return route;
}

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function updateTraffic(state, dt) {
  const player = state.player;
  for (const car of state.cars) {
    if (car.role !== "traffic") continue;
    if (player.inCar === car) continue;
    if (!car.route || car.routeIndex >= car.route.length) {
      car.route = randomRoute(state, nearestNode(state.world, car.x, car.y), 6);
      car.routeIndex = 0;
    }
    const target = car.route[car.routeIndex];
    const dist = Math.hypot(target.x - car.x, target.y - car.y);
    if (dist < 46) {
      car.routeIndex += 1;
      continue;
    }
    // Keep a gap: slow or stop when something is just ahead.
    const aheadX = car.x + Math.cos(car.angle) * 74;
    const aheadY = car.y + Math.sin(car.angle) * 74;
    let blocked = false;
    for (const other of state.cars) {
      if (other === car) continue;
      if (Math.hypot(other.x - aheadX, other.y - aheadY) < 42) { blocked = true; break; }
    }
    if (!blocked && player.inCar === null) {
      if (Math.hypot(player.x - aheadX, player.y - aheadY) < 36) blocked = true;
    }
    const want = angleTo(car.x, car.y, target.x, target.y);
    const diff = angleDiff(want, car.angle);
    const steer = Math.max(-1, Math.min(1, diff * 2.4));
    let throttle = 0;
    if (blocked) {
      throttle = car.speed > 4 ? -0.9 : 0;
    } else if (car.speed < car.targetSpeed) {
      throttle = Math.abs(diff) > 1.1 ? 0.25 : 0.8;
    } else {
      throttle = 0;
    }
    // Nudge onto the road centre when drifting wide.
    driveCar(state, car, dt, throttle, steer, false);
    if (car.health <= 0) {
      // A wrecked traffic car pulls over and stops being traffic.
      car.role = "parked";
      car.speed = 0;
    }
  }
}
