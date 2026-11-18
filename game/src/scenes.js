// Scene staging for screenshots, plus the self-test hook. Scenes use
// the game's own spawn and mission code to set up a real playable
// state — nothing is faked for the camera. The default load, with no
// parameters, always starts at the start screen.

import { PLACES, START_POS } from "./config.js";
import { startMission } from "./missions.js";
import { addWanted, ensurePolice } from "./police.js";
import { makeCar } from "./vehicles.js";
import { spawnGuard } from "./combat.js";
import { nearestCar } from "./vehicles.js";

export function sceneParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    scene: q.get("scene"),
    seed: q.get("seed") ? parseInt(q.get("seed"), 10) : 20261118,
    selftest: q.get("selftest") === "1",
    shot: q.get("shot") === "1",
  };
}

export function stageScene(state, name) {
  const p = state.player;
  state.sceneStaged = true;
  state.mode = "playing";
  state.hideMenus();

  if (name === "chase") {
    // Driving east on a downtown avenue, three stars, patrol cars closing.
    const car = makeCar("sport", 1800, 1500, 0, "#d92b2b");
    car.role = "parked";
    state.cars.push(car);
    p.inCar = car;
    car.speed = 380;
    p.x = car.x;
    p.y = car.y;
    state.camera.x = car.x - 60;
    state.camera.y = car.y;
    startMission(state, 3);
    // Jump straight to the escape step so the objective reads as a chase.
    state.mission.stepIndex = 1;
    state.mission.stepT = 3;
    state.hideBriefing();
    addWanted(state, 3, "Patrol cars are on you.");
    ensurePolice(state, true);
    // Line the patrol cars up behind the player, all chasing east.
    const patrol = state.cars.filter((c) => c.role === "police");
    const offsets = [[-215, 22], [-320, -22], [-430, 16]];
    patrol.forEach((pc, i) => {
      const off = offsets[i % offsets.length];
      pc.x = car.x + off[0];
      pc.y = car.y + off[1];
      pc.angle = 0;
      pc.speed = 470;
      pc.routeNode = null;
    });
    // Keep the getaway rolling until a real key press takes over.
    state.autodrive = true;
    state.hudToast("Lose the police: break line of sight and stay hidden");
    return "chase";
  }

  if (name === "explore") {
    // On foot at a downtown corner, traffic and pedestrians all around.
    p.x = 1560;
    p.y = 960;
    p.angle = 0.6;
    state.camera.x = p.x;
    state.camera.y = p.y;
    // Two traffic cars on the visible roads, driving their routes.
    const t1 = makeCar("sedan", 1180, 900, 0, "#3f6d9e");
    t1.role = "traffic";
    t1.targetSpeed = 170;
    t1.route = [{ x: 1500, y: 900 }, { x: 2100, y: 900 }, { x: 2700, y: 900 }];
    state.cars.push(t1);
    const t2 = makeCar("taxi", 1500, 560, Math.PI / 2, "#e8b93c");
    t2.role = "traffic";
    t2.targetSpeed = 160;
    t2.route = [{ x: 1500, y: 900 }, { x: 1500, y: 1500 }, { x: 1500, y: 2100 }];
    state.cars.push(t2);
    const parked = makeCar("sedan", 1250, 868, Math.PI, "#c94f43");
    parked.role = "parked";
    state.cars.push(parked);
    startMission(state, 0);
    state.hideBriefing();
    return "explore";
  }

  if (name === "mission") {
    // Mission briefing open, bandstand and waypoint beacon in view.
    p.x = 1300;
    p.y = 1330;
    p.angle = -2.3;
    state.camera.x = p.x - 30;
    state.camera.y = p.y + 10;
    startMission(state, 2);
    return "mission";
  }

  if (name === "combat") {
    // Pistol out in the warehouse yard, guards closing in.
    p.x = 2380;
    p.y = 2970;
    p.angle = -0.5;
    p.weapon = "pistol";
    p.ammo = 12;
    p.reserve = 48;
    state.camera.x = p.x + 20;
    state.camera.y = p.y - 10;
    startMission(state, 4);
    state.hideBriefing();
    state.mission.stepIndex = 1;
    state.mission.stepT = 1;
    spawnGuard(state, 2310, 2890, {});
    spawnGuard(state, 2490, 2890, {});
    spawnGuard(state, 2440, 3050, {});
    addWanted(state, 1, "Shots fired near the pier.");
    return "combat";
  }

  if (name === "start") {
    state.mode = "menu";
    state.showMenus();
    return "start";
  }

  return null;
}

// Self-test: scripted checks that run the real update loop with
// synthetic input and report pass/fail into the DOM. The harness reads
// #selftest and fails the run if any line says FAIL.
export function selfTestReport(state, results) {
  const el = document.getElementById("selftest");
  if (!el) return;
  el.classList.remove("hidden");
  el.textContent = results.map((r) => (r.ok ? "PASS " : "FAIL ") + r.name + (r.detail ? " — " + r.detail : "")).join("\n");
  el.dataset.done = "1";
  el.dataset.failed = results.some((r) => !r.ok) ? "1" : "0";
}
