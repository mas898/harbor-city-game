// Saving and loading through localStorage: cash, mission progress,
// health, ammo and the player's position. Saving never throws: a
// blocked or full store just means no save this time.

import { SAVE_KEY } from "./config.js";

export function saveGame(state) {
  try {
    const p = state.player;
    const data = {
      version: 1,
      cash: state.cash,
      // Missions run in order, so the next one is the count completed.
      missionIndex: state.completedMissions.length,
      completedMissions: state.completedMissions.slice(),
      storyComplete: !!state.storyComplete,
      x: p.inCar ? p.inCar.x : p.x,
      y: p.inCar ? p.inCar.y : p.y,
      hp: Math.max(1, Math.round(p.hp)),
      ammo: p.ammo,
      reserve: p.reserve,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // Nothing to do: no save means a fresh game anyway.
  }
}

export function applySave(state, data) {
  state.cash = data.cash;
  state.completedMissions = data.completedMissions.slice();
  state.storyComplete = !!data.storyComplete;
  state.player.x = data.x;
  state.player.y = data.y;
  state.player.hp = data.hp;
  state.player.ammo = data.ammo;
  state.player.reserve = data.reserve;
  return data.missionIndex;
}
