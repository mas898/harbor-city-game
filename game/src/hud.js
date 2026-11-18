// The heads-up display: health, cash, wanted stars, weapon and ammo,
// the mission objective, and a live minimap. The HUD is DOM over the
// canvas so text stays crisp; the minimap is its own small canvas.

import { ROAD_W, ROAD_XS, ROAD_YS, SAND_Y, WATER_Y, WORLD_H, WORLD_W } from "./config.js";
import { currentObjective } from "./missions.js";
import { districtName } from "./world.js";

export function initHud(state) {
  const $ = (id) => document.getElementById(id);
  state.hud = {
    root: $("hud"),
    healthFill: $("health-fill"),
    healthText: $("health-text"),
    cash: $("cash"),
    stars: $("stars"),
    district: $("district"),
    weaponName: $("weapon-name"),
    ammo: $("ammo"),
    objective: $("objective-text"),
    objectiveBox: $("objective-box"),
    speed: $("speed"),
    toast: $("toast"),
    briefing: $("briefing"),
    briefingTitle: $("briefing-title"),
    briefingGiver: $("briefing-giver"),
    briefingText: $("briefing-text"),
    briefingReward: $("briefing-reward"),
    minimap: $("minimap"),
    bust: $("bust-meter"),
    bustFill: $("bust-fill"),
  };
  state.toastT = 0;
  state.toastQueue = [];
}

export function toast(state, text) {
  state.toastQueue.push(text);
}

export function showBriefing(state, def) {
  const h = state.hud;
  h.briefingTitle.textContent = def.title;
  h.briefingGiver.textContent = "From " + def.giver;
  h.briefingText.textContent = def.briefing;
  h.briefingReward.textContent = "Reward: $" + def.reward + (def.ammoBonus ? " + " + def.ammoBonus + " rounds" : "");
  h.briefing.classList.remove("hidden");
  state.briefingT = 9;
}

export function hideBriefing(state) {
  state.hud.briefing.classList.add("hidden");
  state.briefingT = 0;
}

function starString(n) {
  let s = "";
  for (let i = 0; i < 5; i += 1) s += i < n ? "★" : "☆";
  return s;
}

export function updateHud(state, dt) {
  const h = state.hud;
  const p = state.player;
  const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
  h.healthFill.style.width = hpPct + "%";
  h.healthFill.className = "fill" + (hpPct < 30 ? " low" : "");
  h.healthText.textContent = Math.ceil(Math.max(0, p.hp)) + "";
  h.cash.textContent = "$" + state.cash;
  h.stars.textContent = starString(state.wanted);
  h.stars.className = state.wanted > 0 ? "stars hot" : "stars";
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  h.district.textContent = districtName(px, py);
  if (p.inCar) {
    h.weaponName.textContent = p.inCar.def.name;
    h.ammo.textContent = Math.round(Math.abs(p.inCar.speed) * 0.36) + " km/h";
    h.speed.textContent = "Hull " + Math.max(0, Math.round(p.inCar.health)) + "%";
  } else if (p.weapon === "pistol") {
    h.weaponName.textContent = "P9 Pistol";
    h.ammo.textContent = p.reloadT > 0 ? "Reloading…" : p.ammo + " / " + p.reserve;
    h.speed.textContent = p.reloadT > 0 ? "Reloading" : "";
  } else {
    h.weaponName.textContent = "Fists";
    h.ammo.textContent = "—";
    h.speed.textContent = "";
  }
  const obj = currentObjective(state);
  h.objective.textContent = obj.text;
  h.objectiveBox.classList.toggle("has-target", obj.x !== null);

  // Toasts: one at a time, 3.5 seconds each.
  if (state.toastT > 0) {
    state.toastT -= dt;
    if (state.toastT <= 0) h.toast.classList.add("hidden");
  } else if (state.toastQueue.length > 0) {
    h.toast.textContent = state.toastQueue.shift();
    h.toast.classList.remove("hidden");
    state.toastT = 3.5;
  }

  // Briefing auto-hides after a while; any key or click dismisses it.
  if (state.briefingT > 0) {
    state.briefingT -= dt;
    if (state.briefingT <= 0) hideBriefing(state);
  }

  // Bust progress bar.
  if (state.bustT > 0 && state.wanted > 0) {
    h.bust.classList.remove("hidden");
    h.bustFill.style.width = Math.min(100, (state.bustT / 2.2) * 100) + "%";
  } else {
    h.bust.classList.add("hidden");
  }

  drawMinimap(state);
}

function drawMinimap(state) {
  const canvas = state.hud.minimap;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#8aa86a";
  ctx.fillRect(0, 0, w, h);
  // Water and sand.
  ctx.fillStyle = "#e6d199";
  ctx.fillRect(0, SAND_Y * sy, w, (WATER_Y - SAND_Y) * sy + 2);
  ctx.fillStyle = "#3d8fb8";
  ctx.fillRect(0, WATER_Y * sy, w, h - WATER_Y * sy);
  // Roads.
  ctx.fillStyle = "#5a5a64";
  for (const rx of ROAD_XS) ctx.fillRect(rx * sx - (ROAD_W * sx) / 2, 0, ROAD_W * sx, h);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry * sy - (ROAD_W * sx) / 2, w, ROAD_W * sx);
  // Buildings as faint blocks.
  ctx.fillStyle = "rgba(90,80,70,0.5)";
  for (const b of state.world.buildings) {
    ctx.fillRect(b.x * sx, b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  }
  // Objective blip (pulsing).
  const obj = currentObjective(state);
  if (obj.x !== null) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.2;
    ctx.fillStyle = "#ffd23d";
    ctx.beginPath();
    ctx.arc(obj.x * sx, obj.y * sy, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff5a3c";
    ctx.beginPath();
    ctx.arc(obj.x * sx, obj.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Traffic dots.
  ctx.fillStyle = "#e8e4da";
  for (const c of state.cars) {
    if (c.role === "traffic") ctx.fillRect(c.x * sx - 1, c.y * sy - 1, 2, 2);
  }
  // Police blips.
  ctx.fillStyle = "#4f8fe8";
  for (const c of state.cars) {
    if (c.role === "police") {
      ctx.beginPath();
      ctx.arc(c.x * sx, c.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player arrow.
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const ang = p.inCar ? p.inCar.angle : p.angle;
  ctx.save();
  ctx.translate(px * sx, py * sy);
  ctx.rotate(ang);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // View frame: the part of the city the main camera can see.
  const cam = state.camera;
  const zoom = cam.zoom || 1;
  const vw = (state.viewW || 1280) / zoom;
  const vh = (state.viewH || 720) / zoom;
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 1;
  ctx.strokeRect((cam.x - vw / 2) * sx, (cam.y - vh / 2) * sy, vw * sx, vh * sy);
}
