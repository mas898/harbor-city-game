// Missions and the Harbor City story. Milo Kade drives courier vans
// for a living until Vera Sol, who runs the fish market's back room,
// offers better-paying work. Five jobs, one chain: each mission is a
// list of steps the engine below walks through, with a waypoint, a
// briefing and a cash reward at the end.

import { PLACES } from "./config.js";
import { addFloat } from "./effects.js";
import { spawnGuard } from "./combat.js";
import { makeCar } from "./vehicles.js";
import { addWanted, clearWanted } from "./police.js";

export const STORY = {
  hero: "Milo Kade",
  fixer: "Vera Sol",
  rival: "Otto Brandt",
};

export const MISSIONS = [
  {
    id: "first-job",
    title: "A Job From Vera",
    giver: "Vera Sol",
    briefing: "Vera runs the back room at the fish market. Her regular driver quit, and a parcel needs to reach Rook's Garage before noon. Walk the city, pick it up, and drive it over. Easy money — if you keep it clean.",
    reward: 250,
    ammoBonus: 12,
    steps: [
      { kind: "goto", x: 1080, y: 1620, radius: 70, text: "Go to the Fish Market and meet Vera's contact" },
      { kind: "pickup", x: 1080, y: 1620, radius: 60, text: "Pick up the parcel", item: "parcel" },
      { kind: "goto", x: PLACES.garage.x, y: PLACES.garage.y, radius: 80, text: "Deliver the parcel to Rook's Garage" },
    ],
  },
  {
    id: "borrowed-wheels",
    title: "Borrowed, Not Stolen",
    giver: "Vera Sol",
    briefing: "A client wants a Vela GT, and the depot has one sitting pretty. Take it — quietly, if you can — and bring it to the garage. The police notice stolen sports cars. They notice fast drivers more.",
    reward: 350,
    ammoBonus: 0,
    steps: [
      { kind: "goto", x: PLACES.depot.x, y: PLACES.depot.y, radius: 90, text: "Go to the Bus Depot" },
      { kind: "steal", carType: "sport", text: "Take the Vela GT parked at the depot" },
      { kind: "deliverCar", x: PLACES.garage.x, y: PLACES.garage.y, radius: 90, text: "Bring the Vela GT to Rook's Garage" },
    ],
  },
  {
    id: "park-exchange",
    title: "The Park Exchange",
    giver: "Vera Sol",
    briefing: "Otto Brandt's crew left a briefcase by the bandstand, and Otto's crew is coming back for it. Get there first, take the case, and do not let his guards take it back. Then lie low at the hideout.",
    reward: 500,
    ammoBonus: 24,
    steps: [
      { kind: "goto", x: 1140, y: 1140, radius: 70, text: "Go to the bandstand in the park" },
      { kind: "pickup", x: 1140, y: 1140, radius: 60, text: "Take the briefcase", item: "briefcase" },
      {
        kind: "defeat", count: 2, text: "Otto's guards arrived — deal with them",
        spawns: [{ x: 1240, y: 1060 }, { x: 1060, y: 1260 }],
      },
      { kind: "goto", x: PLACES.hideout.x, y: PLACES.hideout.y, radius: 80, text: "Take the briefcase to the hideout" },
    ],
  },
  {
    id: "heat-wave",
    title: "Heat Wave",
    giver: "Vera Sol",
    briefing: "The depot job tripped an alarm, and the precinct wants a word. Vera's advice: do not get caught. Lose the patrol cars, stay out of sight until the heat dies down, then slip back to the hideout.",
    reward: 450,
    ammoBonus: 0,
    steps: [
      { kind: "goto", x: PLACES.depot.x, y: PLACES.depot.y, radius: 90, text: "Check the depot — something tripped the alarm" },
      { kind: "escape", text: "Lose the police: break line of sight and stay hidden" },
      { kind: "goto", x: PLACES.hideout.x, y: PLACES.hideout.y, radius: 80, text: "Slip back to the hideout" },
    ],
  },
  {
    id: "harbor-job",
    title: "The Harbor Job",
    giver: "Vera Sol",
    briefing: "One last job, and Milo is out clean. Otto's loot sits in a warehouse by Salt Pier, guarded by his best. Take it, carry it to the hideout, and Harbor City is yours to drive in peace.",
    reward: 800,
    ammoBonus: 36,
    steps: [
      { kind: "goto", x: 2400, y: 3020, radius: 80, text: "Go to the warehouse by Salt Pier" },
      {
        kind: "defeat", count: 4, text: "Clear the warehouse guards",
        spawns: [
          { x: 2320, y: 2960 }, { x: 2480, y: 2960 },
          { x: 2320, y: 3080 }, { x: 2480, y: 3080 },
        ],
      },
      { kind: "pickup", x: 2400, y: 3020, radius: 60, text: "Take Otto's loot", item: "loot" },
      { kind: "goto", x: PLACES.hideout.x, y: PLACES.hideout.y, radius: 80, text: "Carry the loot to the hideout" },
    ],
  },
];

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  state.missionIndex = index;
  state.mission = {
    def,
    stepIndex: 0,
    stepT: 0,
    pickupT: 0,
    kills: 0,
    targetCar: null,
    guards: [],
    onEnemyDown: null,
    done: false,
  };
  beginStep(state);
  state.showBriefing(def);
  state.hudToast("New job: " + def.title);
  return true;
}

function beginStep(state) {
  const m = state.mission;
  const step = m.def.steps[m.stepIndex];
  if (!step) return;
  m.stepT = 0;
  m.pickupT = 0;
  m.kills = 0;
  if (step.kind === "defeat") {
    m.guards = step.spawns.map((s) => spawnGuard(state, s.x, s.y, {}));
    m.onEnemyDown = () => {
      m.kills += 1;
      state.hudToast("Guard down (" + m.kills + "/" + step.count + ")");
    };
  } else {
    m.onEnemyDown = null;
  }
  if (step.kind === "steal") {
    // Make sure the target car exists at the depot.
    const depot = PLACES.depot;
    let found = state.cars.find((c) => c.type === step.carType && Math.hypot(c.x - depot.x, c.y - depot.y) < 220);
    if (!found) {
      found = makeCar(step.carType, depot.x + 40, depot.y + 30, 0, "#d92b2b");
      found.role = "parked";
      state.cars.push(found);
    }
    m.targetCar = found;
  }
  if (step.kind === "escape") {
    if (state.wanted < 3) addWanted(state, 3 - state.wanted, "The alarm went up — patrol cars are coming.");
  }
}

function advanceStep(state) {
  const m = state.mission;
  m.stepIndex += 1;
  if (m.stepIndex >= m.def.steps.length) {
    completeMission(state);
    return;
  }
  beginStep(state);
  const step = m.def.steps[m.stepIndex];
  state.hudToast(step.text);
}

function completeMission(state) {
  const m = state.mission;
  const def = m.def;
  state.cash += def.reward;
  if (def.ammoBonus) state.player.reserve += def.ammoBonus;
  state.completedMissions.push(def.id);
  state.audio.missionDone();
  addFloat(state, state.player.x, state.player.y - 40, "+$" + def.reward, "#7ddb6a");
  state.hudToast("Job complete: " + def.title + " (+$" + def.reward + ")");
  state.mission = null;
  state.saveGame();
  const next = state.missionIndex + 1;
  if (next < MISSIONS.length) {
    state.pendingMission = next;
    state.pendingMissionT = 3;
  } else {
    state.storyComplete = true;
    state.showEndScreen("story");
  }
}

export function updateMissions(state, dt) {
  if (state.pendingMission !== null && state.pendingMission !== undefined) {
    state.pendingMissionT -= dt;
    if (state.pendingMissionT <= 0) {
      const idx = state.pendingMission;
      state.pendingMission = null;
      startMission(state, idx);
    }
    return;
  }
  const m = state.mission;
  if (!m) return;
  const step = m.def.steps[m.stepIndex];
  if (!step) return;
  m.stepT += dt;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;

  if (step.kind === "goto" || step.kind === "deliverCar") {
    const d = Math.hypot(step.x - px, step.y - py);
    if (step.kind === "deliverCar" && p.inCar !== m.targetCar && !(p.inCar && p.inCar.type === "sport")) {
      // Wrong car: wait for the right one.
      return;
    }
    if (d < step.radius) {
      state.audio.pickup();
      advanceStep(state);
    }
    return;
  }
  if (step.kind === "pickup") {
    if (p.inCar) return;
    const d = Math.hypot(step.x - px, step.y - py);
    if (d < step.radius) {
      m.pickupT += dt;
      if (m.pickupT > 0.8) {
        state.audio.pickup();
        advanceStep(state);
      }
    } else {
      m.pickupT = 0;
    }
    return;
  }
  if (step.kind === "steal") {
    if (p.inCar && (!step.carType || p.inCar.type === step.carType)) {
      m.targetCar = p.inCar;
      advanceStep(state);
    }
    return;
  }
  if (step.kind === "defeat") {
    if (m.kills >= step.count) advanceStep(state);
    return;
  }
  if (step.kind === "escape") {
    if (state.wanted === 0 && m.stepT > 2) advanceStep(state);
    return;
  }
}

export function currentObjective(state) {
  if (state.pendingMission !== null && state.pendingMission !== undefined) {
    return { text: "Vera is lining up the next job…", x: null, y: null };
  }
  const m = state.mission;
  if (!m) {
    if (state.storyComplete) return { text: "Story complete — Harbor City is yours. Free roam!", x: null, y: null };
    return { text: "Free roam — explore Harbor City", x: null, y: null };
  }
  const step = m.def.steps[m.stepIndex];
  if (!step) return { text: m.def.title, x: null, y: null };
  let text = step.text;
  if (step.kind === "defeat") text += " (" + m.kills + "/" + step.count + ")";
  if (step.kind === "escape") text += " — " + state.wanted + "★";
  const wx = step.x !== undefined ? step.x : (m.targetCar ? m.targetCar.x : null);
  const wy = step.y !== undefined ? step.y : (m.targetCar ? m.targetCar.y : null);
  return { text, x: wx, y: wy };
}

export function missionPickupMarker(state) {
  const m = state.mission;
  if (!m) return null;
  const step = m.def.steps[m.stepIndex];
  if (!step || step.kind !== "pickup") return null;
  return { x: step.x, y: step.y, item: step.item || "parcel" };
}

export function resetMissionGuards(state) {
  state.enemies.length = 0;
}
