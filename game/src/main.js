// Harbor City entry point: builds the world, owns the game loop, and
// wires every system together — input, driving, combat, police,
// missions, HUD, saving and the menus.

import { AudioSys } from "./audio.js";
import { Input } from "./input.js";
import { PLAYER, START_CASH, START_POS, WEAPONS, WORLD_H, WORLD_W } from "./config.js";
import { makeRng } from "./random.js";
import { buildWorld, collideCircle } from "./world.js";
import { driveCar, makeCar, nearestCar, spawnParkedCars } from "./vehicles.js";
import { spawnTraffic, updateTraffic } from "./traffic.js";
import { scarePeds, spawnPeds, updatePeds } from "./pedestrians.js";
import { addWanted, clearWanted, updatePolice } from "./police.js";
import {
  damagePlayer, finishReload, spawnBullet, startReload, tryMelee, tryShoot,
  updateBullets, updateEnemies,
} from "./combat.js";
import { startMission, updateMissions } from "./missions.js";
import { addFloat, addShake, burst, updateEffects } from "./effects.js";
import { applySave, clearSave, hasSave, loadSave, saveGame } from "./save.js";
import { hideBriefing, initHud, showBriefing, toast, updateHud } from "./hud.js";
import { render } from "./render.js";
import { sceneParams, selfTestReport, stageScene } from "./scenes.js";

const STEP = 1 / 60;

function createPlayer() {
  return {
    x: START_POS.x, y: START_POS.y, angle: 0,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    inCar: null, weapon: "fists",
    ammo: WEAPONS.pistol.mag, reserve: 24,
    meleeCd: 0, shootCd: 0, reloadT: 0,
    meleeAnim: 0, muzzleT: 0, hurtT: 99,
  };
}

function createState(seed) {
  const world = buildWorld(seed);
  return {
    seed,
    rng: makeRng(seed ^ 0x51ab),
    world,
    time: 0,
    mode: "menu",
    started: false,
    helpOpen: false,
    sceneStaged: false,
    player: createPlayer(),
    cars: [],
    peds: [],
    officers: [],
    enemies: [],
    bullets: [],
    particles: [],
    skids: [],
    floats: [],
    wanted: 0,
    heat: 0,
    unseenT: 0,
    bustT: 0,
    cash: START_CASH,
    missionIndex: 0,
    mission: null,
    pendingMission: null,
    pendingMissionT: 0,
    completedMissions: [],
    storyComplete: false,
    camera: { x: START_POS.x, y: START_POS.y, zoom: 1.3 },
    shake: 0,
    viewW: 1280,
    viewH: 720,
    autosaveT: 20,
    briefingT: 0,
    respawn: null,
    input: new Input(),
    audio: new AudioSys(),
    hud: null,
    toastT: 0,
    toastQueue: [],
  };
}

function bindStateHelpers(state) {
  state.hudToast = (text) => toast(state, text);
  state.showBriefing = (def) => showBriefing(state, def);
  state.hideBriefing = () => hideBriefing(state);
  state.saveGame = () => saveGame(state);
  state.spawnBullet = (x, y, a, friendly, dmg) => spawnBullet(state, x, y, a, friendly, dmg);
  state.bustPlayer = () => bustPlayer(state);
  state.wastePlayer = () => wastePlayer(state);
  state.showEndScreen = (kind) => showEndScreen(state, kind);
  state.hideMenus = () => {
    document.getElementById("menu").classList.add("hidden");
    document.getElementById("pause-menu").classList.add("hidden");
    document.getElementById("end-screen").classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");
  };
  state.showMenus = () => {
    document.getElementById("menu").classList.remove("hidden");
    document.getElementById("hud").classList.add("hidden");
  };
}

function populate(state) {
  spawnParkedCars(state, 40);
  spawnTraffic(state, 20);
  spawnPeds(state, 46);
}

function bustPlayer(state) {
  if (state.mode !== "playing") return;
  const fine = Math.max(50, Math.round(state.cash * 0.15));
  state.cash = Math.max(0, state.cash - fine);
  state.audio.busted();
  state.audio.setSiren(false);
  state.respawn = { x: 4080, y: 2200, reason: "busted", fine };
  state.mode = "busted";
  showEndScreen(state, "busted");
}

function wastePlayer(state) {
  if (state.mode !== "playing") return;
  const fee = Math.max(40, Math.round(state.cash * 0.1));
  state.cash = Math.max(0, state.cash - fee);
  state.audio.busted();
  state.audio.setSiren(false);
  state.respawn = { x: 3480, y: 1000, reason: "wasted", fine: fee };
  state.mode = "wasted";
  showEndScreen(state, "wasted");
}

function showEndScreen(state, kind) {
  const screen = document.getElementById("end-screen");
  const title = document.getElementById("end-title");
  const text = document.getElementById("end-text");
  const btn = document.getElementById("btn-end");
  if (kind === "busted") {
    title.textContent = "BUSTED";
    text.textContent = "The Harbor Precinct caught up with you. Fine paid: $" + (state.respawn ? state.respawn.fine : 0) + ". Vera is not impressed.";
    btn.textContent = "Walk free";
  } else if (kind === "wasted") {
    title.textContent = "WASTED";
    text.textContent = "Harbor General patched you up. Medical bill: $" + (state.respawn ? state.respawn.fine : 0) + ". The city is still out there.";
    btn.textContent = "Back on your feet";
  } else {
    title.textContent = "STORY COMPLETE";
    text.textContent = "Otto's loot is safe, Vera is paid, and Harbor City is yours. Keep driving — free roam never ends.";
    btn.textContent = "Keep driving";
  }
  screen.classList.remove("hidden");
}

function applyRespawn(state) {
  const r = state.respawn;
  const p = state.player;
  if (p.inCar) p.inCar = null;
  if (r) {
    p.x = r.x;
    p.y = r.y;
  }
  p.hp = p.maxHp;
  p.hurtT = 99;
  clearWanted(state);
  state.enemies.length = 0;
  state.respawn = null;
  state.camera.x = p.x;
  state.camera.y = p.y;
  state.saveGame();
}

function enterCar(state) {
  const p = state.player;
  const car = nearestCar(state, p.x, p.y, 64);
  if (!car) return;
  p.inCar = car;
  if (car.role === "traffic") {
    car.role = "parked";
    car.stolen = true;
    car.route = null;
  } else if (!car.stolen && car.role === "parked") {
    car.stolen = true;
  }
  state.audio.door();
  state.hudToast(car.def.name + " — W/S drive, A/D steer, Space handbrake, E to get out");
  // Witnesses report a stolen car.
  let seen = false;
  for (const o of state.officers) {
    if (Math.hypot(o.x - p.x, o.y - p.y) < 420) { seen = true; break; }
  }
  if (!seen) {
    for (const c of state.cars) {
      if (c.role === "police" && Math.hypot(c.x - p.x, c.y - p.y) < 480) { seen = true; break; }
    }
  }
  if (!seen) {
    for (const ped of state.peds) {
      if (!ped.down && Math.hypot(ped.x - p.x, ped.y - p.y) < 130) { seen = true; break; }
    }
  }
  if (seen) addWanted(state, 1, "Car stolen — a witness called it in.");
  else state.hudToast("No witnesses. Nice and quiet.");
  state.statsCarsStolen = (state.statsCarsStolen || 0) + 1;
}

function exitCar(state) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  const side = 1;
  const px = car.x + Math.cos(car.angle + Math.PI / 2) * 34 * side;
  const py = car.y + Math.sin(car.angle + Math.PI / 2) * 34 * side;
  const fixed = collideCircle(state.world, px, py, PLAYER.radius);
  p.x = fixed.x;
  p.y = fixed.y;
  p.angle = car.angle;
  p.inCar = null;
  car.speed *= 0.2;
  state.audio.door();
}

function worldMouse(state) {
  const inp = state.input;
  const zoom = state.camera.zoom || 1;
  return {
    x: inp.mouseX / zoom + state.camera.x - state.viewW / zoom / 2,
    y: inp.mouseY / zoom + state.camera.y - state.viewH / zoom / 2,
  };
}

function updatePlayer(state, dt) {
  const p = state.player;
  const inp = state.input;
  p.meleeCd = Math.max(0, p.meleeCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.meleeAnim = Math.max(0, p.meleeAnim - dt);
  p.muzzleT = Math.max(0, p.muzzleT - dt);
  p.hurtT += dt;
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      p.reloadT = 0;
      finishReload(state);
    }
  }
  // Slow health recovery out of trouble.
  if (p.hurtT > PLAYER.regenDelay && p.hp > 0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + PLAYER.regenRate * dt);
  }

  if (inp.justPressed("e", "E")) {
    if (state.briefingT > 0) hideBriefing(state);
    else if (p.inCar) exitCar(state);
    else enterCar(state);
  }
  if (inp.justPressed("1")) p.weapon = "fists";
  if (inp.justPressed("2")) p.weapon = "pistol";
  if (inp.justPressed("q", "Q")) p.weapon = p.weapon === "pistol" ? "fists" : "pistol";
  if (inp.justPressed("r", "R")) startReload(state);
  if (inp.justPressed("g", "G") && p.inCar) state.audio.horn();

  if (p.inCar) {
    const car = p.inCar;
    let throttle = (inp.isDown("w", "ArrowUp") ? 1 : 0) - (inp.isDown("s", "ArrowDown") ? 1 : 0);
    let steer = (inp.isDown("d", "ArrowRight") ? 1 : 0) - (inp.isDown("a", "ArrowLeft") ? 1 : 0);
    let handbrake = inp.isDown(" ");
    if (throttle !== 0 || steer !== 0 || handbrake) state.autodrive = false;
    if (state.autodrive) {
      // Staged chase: hold speed and stay on the avenue.
      throttle = 1;
      steer = Math.max(-0.6, Math.min(0.6, (1500 - car.y) * 0.004));
      handbrake = false;
      if (car.x > 4300) {
        steer = 1;
        if (car.angle > Math.PI / 2) state.autodrive = false;
      }
    }
    const crashed = driveCar(state, car, dt, throttle, steer, handbrake);
    if (crashed) scarePeds(state, car.x, car.y, 180);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    state.audio.setEngine(Math.abs(car.speed) / car.def.maxSpeed, true);
    // Running over a pedestrian is a crime.
    for (const ped of state.peds) {
      if (ped.down) continue;
      if (Math.abs(car.speed) > 60 && Math.hypot(ped.x - car.x, ped.y - car.y) < 26) {
        ped.down = true;
        burst(state, ped.x, ped.y, { count: 10, color: "#ff6a5a", speed: 130 });
        addShake(state, 6);
        state.audio.crash();
        addWanted(state, 1, "Hit and run — the precinct is on its way.");
        scarePeds(state, car.x, car.y, 320);
      }
    }
    if (car.health <= 0) {
      car.speed = 0;
      state.hudToast("The car is wrecked.");
      exitCar(state);
    }
    return;
  }

  state.audio.setEngine(0, false);
  // On foot: aim at the mouse, move with WASD.
  const wm = worldMouse(state);
  p.angle = Math.atan2(wm.y - p.y, wm.x - p.x);
  const ax = inp.axisX();
  const ay = inp.axisY();
  const moving = ax !== 0 || ay !== 0;
  if (moving) {
    const len = Math.hypot(ax, ay);
    const run = inp.isDown("Shift");
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = p.x + (ax / len) * speed * dt;
    const ny = p.y + (ay / len) * speed * dt;
    const fixed = collideCircle(state.world, nx, ny, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
  }
  if (inp.justPressed("f", "F") || (inp.mouseDown && p.weapon === "fists")) tryMelee(state);
  if (inp.mouseDown && p.weapon === "pistol") tryShoot(state, p.angle);
}

function updateCamera(state, dt) {
  const p = state.player;
  const focus = p.inCar ? p.inCar : p;
  let lookX = 0;
  let lookY = 0;
  if (p.inCar) {
    lookX = Math.cos(p.inCar.angle) * Math.abs(p.inCar.speed) * 0.22;
    lookY = Math.sin(p.inCar.angle) * Math.abs(p.inCar.speed) * 0.22;
  }
  const tx = focus.x + lookX;
  const ty = focus.y + lookY;
  const k = Math.min(1, dt * 5);
  state.camera.x += (tx - state.camera.x) * k;
  state.camera.y += (ty - state.camera.y) * k;
  const zoom = state.camera.zoom || 1;
  const hw = state.viewW / zoom / 2;
  const hh = state.viewH / zoom / 2;
  state.camera.x = Math.max(hw - 200, Math.min(WORLD_W - hw + 200, state.camera.x));
  state.camera.y = Math.max(hh - 200, Math.min(WORLD_H - hh + 200, state.camera.y));
}

function update(state, dt) {
  state.time += dt;
  const inp = state.input;
  if (state.mode === "playing") {
    if (inp.justPressed("p", "P", "Escape")) {
      pauseGame(state);
      inp.endFrame();
      return;
    }
    updatePlayer(state, dt);
    updateTraffic(state, dt);
    updatePeds(state, dt);
    updatePolice(state, dt);
    updateBullets(state, dt);
    updateEnemies(state, dt);
    updateMissions(state, dt);
    updateEffects(state, dt);
    updateCamera(state, dt);
    state.audio.setSiren(state.wanted > 0);
    state.autosaveT -= dt;
    if (state.autosaveT <= 0) {
      state.autosaveT = 20;
      state.saveGame();
    }
  } else if (state.mode === "menu") {
    // The menu drifts over the city while traffic keeps moving.
    state.camera.x = WORLD_W / 2 + Math.cos(state.time * 0.05) * 700;
    state.camera.y = WORLD_H / 2 + Math.sin(state.time * 0.04) * 500;
    updateTraffic(state, dt);
    updatePeds(state, dt);
    updateEffects(state, dt);
  } else {
    updateEffects(state, dt);
  }
  inp.endFrame();
}

function pauseGame(state) {
  if (state.mode !== "playing") return;
  state.mode = "paused";
  state.saveGame();
  document.getElementById("pause-menu").classList.remove("hidden");
  state.audio.setEngine(0, false);
  state.audio.setSiren(false);
}

function resumeGame(state) {
  if (state.mode !== "paused") return;
  state.mode = "playing";
  document.getElementById("pause-menu").classList.add("hidden");
}

function startNewGame(state) {
  state.started = true;
  state.mode = "playing";
  state.hideMenus();
  state.audio.ensure();
  startMission(state, 0);
}

function continueGame(state) {
  if (state.started) {
    state.mode = "playing";
    state.hideMenus();
    return;
  }
  const data = loadSave();
  if (!data) return;
  const nextIndex = applySave(state, data);
  state.started = true;
  state.mode = "playing";
  state.hideMenus();
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  state.audio.ensure();
  if (!state.storyComplete && nextIndex < 5) startMission(state, nextIndex);
  else state.hudToast("Welcome back to Harbor City.");
}

function bindMenus(state) {
  const $ = (id) => document.getElementById(id);
  const btnNew = $("btn-new");
  const btnContinue = $("btn-continue");
  if (!hasSave() && !state.started) {
    btnContinue.disabled = true;
    btnContinue.textContent = "Continue (no save yet)";
  }
  btnNew.addEventListener("click", () => {
    state.audio.ensure();
    state.audio.click();
    if (state.started) {
      clearSave();
      window.location.href = window.location.pathname;
      return;
    }
    startNewGame(state);
  });
  btnContinue.addEventListener("click", () => {
    state.audio.ensure();
    state.audio.click();
    continueGame(state);
  });
  $("btn-help").addEventListener("click", () => openHelp(state));
  $("btn-help-2").addEventListener("click", () => openHelp(state));
  $("btn-close-help").addEventListener("click", () => closeHelp(state));
  $("btn-resume").addEventListener("click", () => { state.audio.click(); resumeGame(state); });
  $("btn-save").addEventListener("click", () => {
    state.saveGame();
    state.audio.click();
    $("btn-save").textContent = "Saved!";
    setTimeout(() => { $("btn-save").textContent = "Save game"; }, 1200);
  });
  $("btn-quit").addEventListener("click", () => {
    state.saveGame();
    state.audio.click();
    state.mode = "menu";
    $("pause-menu").classList.add("hidden");
    $("menu").classList.remove("hidden");
    $("hud").classList.add("hidden");
    btnContinue.disabled = false;
    btnContinue.textContent = "Continue";
  });
  $("btn-end").addEventListener("click", () => {
    state.audio.click();
    $("end-screen").classList.add("hidden");
    if (state.mode === "busted" || state.mode === "wasted") applyRespawn(state);
    state.mode = "playing";
    state.hideMenus();
  });
  $("btn-mute").addEventListener("click", () => {
    const muted = !state.audio.muted;
    state.audio.setMuted(muted);
    $("btn-mute").textContent = muted ? "Sound: off" : "Sound: on";
  });
  $("briefing-dismiss").addEventListener("click", () => hideBriefing(state));
  // First gesture unlocks audio anywhere on the page.
  document.addEventListener("pointerdown", () => state.audio.ensure(), { once: false });
  document.addEventListener("keydown", () => state.audio.ensure(), { once: false });
}

function openHelp(state) {
  state.helpOpen = true;
  document.getElementById("help-overlay").classList.remove("hidden");
}

function closeHelp(state) {
  state.helpOpen = false;
  document.getElementById("help-overlay").classList.add("hidden");
}

function boot() {
  const params = sceneParams();
  const state = createState(params.seed);
  bindStateHelpers(state);
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.viewW = window.innerWidth;
    state.viewH = window.innerHeight;
  };
  window.addEventListener("resize", resize);
  resize();

  state.input.attach(window);
  state.input.attachMouse(canvas);
  initHud(state);
  populate(state);
  bindMenus(state);

  // Help key works from play and pause.
  window.addEventListener("keydown", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === "h" && state.mode !== "menu") {
      if (state.helpOpen) closeHelp(state);
      else openHelp(state);
    }
    if (k === "m") {
      const muted = !state.audio.muted;
      state.audio.setMuted(muted);
      document.getElementById("btn-mute").textContent = muted ? "Sound: off" : "Sound: on";
    }
    if (k === "Escape" && state.helpOpen) closeHelp(state);
  });

  if (params.scene) {
    state.started = true;
    stageScene(state, params.scene);
  }

  // Test hooks: scripted play-throughs drive the same state the game uses.
  window.__harbor = {
    state,
    startMission: (i) => startMission(state, i),
    addWanted: (n, r) => addWanted(state, n, r),
    clearWanted: () => clearWanted(state),
    saveGame: () => saveGame(state),
    loadSave,
    step: (dt) => update(state, dt || STEP),
  };

  if (params.selftest) {
    state.started = true;
    state.mode = "playing";
    state.hideMenus();
    runSelfTest(state);
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    if (!state.helpOpen) {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 4) {
        update(state, STEP);
        acc -= STEP;
        steps += 1;
      }
      if (steps === 4) acc = 0;
    }
    if (state.mode === "playing" || state.mode === "paused") updateHud(state, dt);
    render(state, ctx, state.viewW, state.viewH);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function runSelfTest(state) {
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail: detail || "" });
  const inp = state.input;
  const p = state.player;
  const stepN = (n) => { for (let i = 0; i < n; i += 1) update(state, STEP); };

  try {
    // 1. Walk.
    const y0 = p.y;
    inp.inject("w");
    stepN(30);
    inp.release("w");
    check("walk-forward", p.y < y0 - 20, "y " + Math.round(y0) + " -> " + Math.round(p.y));

    // 2. Enter a car.
    const car = state.cars.find((c) => c.role === "parked");
    p.x = car.x + 30;
    p.y = car.y;
    inp.inject("e");
    stepN(2);
    check("enter-car", p.inCar === car, car ? car.def.name : "no car");

    // 3. Drive.
    inp.inject("w");
    stepN(60);
    inp.release("w");
    check("drive-accelerates", Math.abs(car.speed) > 50, "speed " + Math.round(car.speed));

    // 4. Exit.
    inp.inject("e");
    stepN(2);
    check("exit-car", p.inCar === null, "");

    // 5. Wanted level brings police.
    const wantedBefore = state.wanted;
    addWanted(state, 2, "");
    stepN(10);
    const police = state.cars.filter((c) => c.role === "police");
    check("police-spawn", state.wanted === wantedBefore + 2 && police.length >= 1, "stars " + wantedBefore + " -> " + state.wanted + ", cars " + police.length);

    // 6. Lose the heat by hiding far away: police hold the last known
    // spot while the player stays out of sight.
    p.x = 300;
    p.y = 300;
    for (const c of police) { c.x = 4500; c.y = 2700; c.speed = 0; c.routeNode = null; }
    state.officers.length = 0;
    state.lastKnown = { x: 4500, y: 2700 };
    state.lostT = 99;
    state.unseenT = 0;
    stepN(60 * 30);
    check("wanted-decays", state.wanted === 0, "stars " + state.wanted);

    // 7. Punch.
    p.weapon = "fists";
    p.meleeCd = 0;
    tryMelee(state);
    check("punch", p.meleeCd > 0, "cooldown " + p.meleeCd.toFixed(2));

    // 8. Shoot.
    p.weapon = "pistol";
    p.ammo = 12;
    p.shootCd = 0;
    p.reloadT = 0;
    const ammo0 = p.ammo;
    const bullets0 = state.bullets.length;
    tryShoot(state, 0);
    check("shoot", p.ammo === ammo0 - 1 && state.bullets.length > bullets0, "ammo " + p.ammo);
    clearWanted(state);

    // 9. Mission chain: complete mission 1 by walking its steps.
    const cash0 = state.cash;
    startMission(state, 0);
    const m = state.mission;
    check("mission-starts", !!m && m.def.id === "first-job", m ? m.def.id : "none");
    p.x = 1080; p.y = 1620;
    stepN(5);
    check("mission-step-1", state.mission && state.mission.stepIndex === 1, "step " + (state.mission ? state.mission.stepIndex : "none"));
    stepN(60);
    check("mission-step-2", state.mission && state.mission.stepIndex === 2, "step " + (state.mission ? state.mission.stepIndex : "none"));
    p.x = 2280; p.y = 480;
    stepN(5);
    check("mission-completes", state.completedMissions.includes("first-job") && state.cash === cash0 + 250, "cash " + state.cash);

    // 10. Save and load round-trip.
    saveGame(state);
    const loaded = loadSave();
    check("save-load", !!loaded && loaded.cash === state.cash && loaded.completedMissions.length >= 1, loaded ? "cash " + loaded.cash : "no save");
  } catch (err) {
    results.push({ name: "exception", ok: false, detail: String(err && err.message ? err.message : err) });
  }
  selfTestReport(state, results);
}

boot();
