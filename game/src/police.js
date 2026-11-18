// The wanted system and the police who answer it. Crimes raise heat;
// heat becomes stars; stars bring patrol cars and officers who chase,
// ram, and try to bust the player. Break line of sight and stay hidden
// and the heat cools off, one star at a time.

import { WANTED } from "./config.js";
import { driveCar, makeCar } from "./vehicles.js";
import { collideCircle, nearestNode, onRoad } from "./world.js";
import { addFloat, burst } from "./effects.js";
import { scarePeds } from "./pedestrians.js";

export function addWanted(state, stars, reason) {
  if (state.mode !== "playing" && !state.sceneStaged) return;
  const before = state.wanted;
  state.wanted = Math.min(WANTED.maxStars, state.wanted + stars);
  state.heat = 100;
  state.unseenT = 0;
  if (state.wanted > before) {
    state.audio.setSiren(true);
    addFloat(state, state.player.x, state.player.y - 30, "WANTED " + "★".repeat(state.wanted), "#ffd23d");
    if (reason) state.hudToast(reason);
    ensurePolice(state, true);
  }
}

export function clearWanted(state) {
  state.wanted = 0;
  state.heat = 0;
  state.bustT = 0;
  state.audio.setSiren(false);
  for (const car of state.cars) {
    if (car.role === "police") car.chasing = false;
  }
  state.officers.length = 0;
}

function policeCarCount(state) {
  return state.cars.filter((c) => c.role === "police").length;
}

// Top up police units to the wanted level. Cars top up every frame so
// a chase never runs dry; officers only join when the heat rises, so a
// hiding player is not magically found by fresh spawns.
export function ensurePolice(state, includeOfficers) {
  const want = WANTED.carsPerStar[state.wanted] || 0;
  const have = policeCarCount(state);
  const player = state.player;
  for (let i = have; i < want; i += 1) {
    // Spawn on a road near the player but off screen.
    const a = Math.random() * Math.PI * 2;
    const d = 620 + Math.random() * 260;
    const x = player.x + Math.cos(a) * d;
    const y = player.y + Math.sin(a) * d;
    const near = nearestNode(state.world, x, y);
    const car = makeCar("police", near.x, near.y, Math.atan2(player.y - near.y, player.x - near.x), "#20242c");
    car.role = "police";
    car.chasing = true;
    car.targetSpeed = 480;
    state.cars.push(car);
  }
  if (!includeOfficers) return;
  const wantOfficers = WANTED.officersPerStar[state.wanted] || 0;
  while (state.officers.length < wantOfficers) {
    const a = Math.random() * Math.PI * 2;
    state.officers.push({
      x: player.x + Math.cos(a) * 420,
      y: player.y + Math.sin(a) * 420,
      angle: 0, hp: 60, speed: 235, state: "chase", shootT: 1 + Math.random(),
    });
  }
}

function pursuitTarget(state, car, playerPos, dist) {
  // Close in directly when near, or when the player is on the same road.
  if (dist < 300) return playerPos;
  const world = state.world;
  const playerNode = nearestNode(world, playerPos.x, playerPos.y);
  if (!onRoad(car.x, car.y)) {
    // Off-road: head for the nearest intersection first.
    return nearestNode(world, car.x, car.y);
  }
  // On the grid: hop between intersections toward the player's node.
  if (!car.routeNode || Math.hypot(car.routeNode.x - car.x, car.routeNode.y - car.y) < 80) {
    const myNode = nearestNode(world, car.x, car.y);
    if (myNode.x === playerNode.x && myNode.y === playerNode.y) return playerPos;
    const neighbours = world.nodes.filter((n) => {
      const sameRow = n.y === myNode.y && Math.abs(n.x - myNode.x) === 600;
      const sameCol = n.x === myNode.x && Math.abs(n.y - myNode.y) === 600;
      return sameRow || sameCol;
    });
    let best = null;
    let bestD = Infinity;
    for (const n of neighbours) {
      const d = Math.hypot(n.x - playerNode.x, n.y - playerNode.y);
      if (d < bestD) { bestD = d; best = n; }
    }
    car.routeNode = best || playerNode;
  }
  return car.routeNode;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function updatePolice(state, dt) {
  const player = state.player;
  const playerPos = playerPosOf(state);
  if (!state.lastKnown) state.lastKnown = { x: playerPos.x, y: playerPos.y };
  if (state.lostT === undefined) state.lostT = 0;

  let seen = false;
  if (state.wanted > 0) {
    ensurePolice(state, false);
    // Heat cools only while no police unit is close enough to see.
    for (const car of state.cars) {
      if (car.role === "police" && Math.hypot(car.x - playerPos.x, car.y - playerPos.y) < 520) { seen = true; break; }
    }
    if (!seen) {
      for (const o of state.officers) {
        if (Math.hypot(o.x - playerPos.x, o.y - playerPos.y) < 420) { seen = true; break; }
      }
    }
    if (seen) {
      state.unseenT = 0;
      state.lostT = 0;
      state.lastKnown = { x: playerPos.x, y: playerPos.y };
    } else {
      state.lostT += dt;
      state.unseenT += dt;
      if (state.unseenT > WANTED.decayDelay) {
        state.unseenT = WANTED.decayDelay - WANTED.decayStep;
        state.wanted = Math.max(0, state.wanted - 1);
        if (state.wanted === 0) {
          clearWanted(state);
          state.hudToast("You lost them. The heat is off.");
          addFloat(state, playerPos.x, playerPos.y - 30, "CLEAR", "#7ddb6a");
        } else {
          state.hudToast("Heat dropping: " + state.wanted + " star" + (state.wanted > 1 ? "s" : ""));
        }
      }
    }
  }

  // Police hunt the real position while they can see the player, and
  // the last known position once sight is broken — that is what makes
  // hiding work.
  const huntPos = state.lostT > 2.5 ? state.lastKnown : playerPos;

  // Patrol cars pursue: follow the road grid toward the player, then
  // close in directly. A stuck car reverses out and tries again.
  for (const car of state.cars) {
    if (car.role !== "police") continue;
    if (player.inCar === car) continue;
    if (state.wanted === 0) {
      // Stand down: slow to a stop and wait.
      driveCar(state, car, dt, car.speed > 4 ? -0.8 : 0, 0, false);
      continue;
    }
    const dist = Math.hypot(huntPos.x - car.x, huntPos.y - car.y);
    let target = pursuitTarget(state, car, huntPos, dist);
    if (dist < 220) {
      // Close in alongside instead of ploughing through the same spot:
      // each car aims a little to one side of the player.
      const side = car.id % 2 === 0 ? 36 : -36;
      const pa = player.inCar ? player.inCar.angle : player.angle;
      target = {
        x: huntPos.x + Math.cos(pa + Math.PI / 2) * side,
        y: huntPos.y + Math.sin(pa + Math.PI / 2) * side,
      };
    }
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    const diff = angleDiff(want, car.angle);
    let steer = Math.max(-1, Math.min(1, diff * 2.2));
    let throttle = 0.9;
    if (dist < 70) throttle = 0.55;
    if (Math.abs(diff) > 1.4 && car.speed > 200) throttle = 0.3;
    // Stuck recovery: reverse briefly when pushing against a wall.
    car.stuckT = (car.stuckT || 0) + (Math.abs(car.speed) < 25 && throttle > 0.5 ? dt : -dt);
    car.stuckT = Math.max(0, car.stuckT);
    if (car.stuckT > 0.9) {
      car.unstuckT = 0.8;
      car.stuckT = 0;
    }
    if (car.unstuckT > 0) {
      car.unstuckT -= dt;
      throttle = -0.9;
      steer = -steer;
    }
    const crashed = driveCar(state, car, dt, throttle, steer, false);
    if (crashed && dist < 120) {
      scarePeds(state, car.x, car.y, 200);
    }
    // Ram damage: a hard crash against the player costs hull, once per
    // impact; brushing past does not drain health continuously.
    const realDist = Math.hypot(playerPos.x - car.x, playerPos.y - car.y);
    if (crashed && realDist < 60) {
      if (player.inCar) {
        player.inCar.health -= 5;
        addFloat(state, playerPos.x, playerPos.y - 26, "RAMMED", "#ff8a5a");
      } else if (realDist < 40) {
        hurtPlayer(state, 8);
      }
    }
  }

  // Officers on foot chase and try to bust the player.
  let busting = false;
  for (let i = state.officers.length - 1; i >= 0; i -= 1) {
    const o = state.officers[i];
    if (o.hp <= 0) {
      burst(state, o.x, o.y, { count: 8, color: "#9db8d9", speed: 90 });
      state.officers.splice(i, 1);
      addWanted(state, 1, "Officer down — the precinct is furious.");
      continue;
    }
    const d = Math.hypot(playerPos.x - o.x, playerPos.y - o.y);
    if (state.wanted === 0) {
      state.officers.splice(i, 1);
      continue;
    }
    // Officers walk to the hunt position (last known when sight broke).
    const hd = Math.hypot(huntPos.x - o.x, huntPos.y - o.y);
    o.angle = Math.atan2(huntPos.y - o.y, huntPos.x - o.x);
    if (hd > 30) {
      const step = Math.min(hd, o.speed * dt);
      const nx = o.x + Math.cos(o.angle) * step;
      const ny = o.y + Math.sin(o.angle) * step;
      const fixed = collideCircle(state.world, nx, ny, 12);
      o.x = fixed.x;
      o.y = fixed.y;
    }
    // Officers shoot when they can see an armed player at range.
    o.shootT -= dt;
    if (seen && d > 120 && d < 420 && player.weapon === "pistol" && o.shootT <= 0) {
      o.shootT = 1.4 + Math.random() * 0.8;
      state.spawnBullet(o.x, o.y, Math.atan2(playerPos.y - o.y, playerPos.x - o.x) + (Math.random() - 0.5) * 0.16, false, 10);
      state.audio.shoot();
    }
    // Bust: an officer close to a slow, wanted player on foot.
    const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : 0;
    if (!player.inCar && d < WANTED.bustRadius && playerSpeed < 10) {
      busting = true;
    }
  }
  if (busting && state.wanted > 0) {
    state.bustT += dt;
    if (state.bustT >= WANTED.bustTime) {
      state.bustPlayer();
    }
  } else {
    state.bustT = Math.max(0, state.bustT - dt * 2);
  }

  // Remove distant stood-down patrol cars so the city stays tidy.
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const c = state.cars[i];
    if (c.role === "police" && state.wanted === 0 && Math.hypot(c.x - playerPos.x, c.y - playerPos.y) > 1500) {
      state.cars.splice(i, 1);
    }
  }
}

function playerPosOf(state) {
  if (state.player.inCar) return { x: state.player.inCar.x, y: state.player.inCar.y };
  return { x: state.player.x, y: state.player.y };
}

function hurtPlayer(state, amount) {
  state.player.hp -= amount;
  state.player.hurtT = 0;
  if (state.player.hp <= 0) state.wastePlayer();
}
