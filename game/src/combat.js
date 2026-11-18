// Combat: fists and the pistol, bullets, and the hired guards who
// defend mission locations. Hits are simple circle tests; damage
// numbers stay small and readable.

import { PLAYER, WEAPONS } from "./config.js";
import { addFloat, addShake, burst } from "./effects.js";
import { scarePeds } from "./pedestrians.js";
import { addWanted } from "./police.js";
import { collideCircle } from "./world.js";

export function spawnBullet(state, x, y, angle, friendly, damage) {
  state.bullets.push({
    x, y,
    vx: Math.cos(angle) * WEAPONS.pistol.bulletSpeed,
    vy: Math.sin(angle) * WEAPONS.pistol.bulletSpeed,
    friendly: !!friendly,
    damage: damage || WEAPONS.pistol.damage,
    life: WEAPONS.pistol.range / WEAPONS.pistol.bulletSpeed,
  });
}

export function tryMelee(state) {
  const p = state.player;
  if (p.inCar || p.meleeCd > 0) return false;
  p.meleeCd = WEAPONS.fists.cooldown;
  p.meleeAnim = 0.22;
  state.audio.punch();
  const range = PLAYER.punchRange + 14;
  let hitSomething = false;
  const tryHit = (tx, ty, radius) => {
    const d = Math.hypot(tx - p.x, ty - p.y);
    if (d > range + radius) return false;
    const a = Math.atan2(ty - p.y, tx - p.x);
    let diff = a - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < PLAYER.punchArc;
  };
  for (const e of state.enemies) {
    if (e.hp > 0 && tryHit(e.x, e.y, 13)) {
      damageEnemy(state, e, WEAPONS.fists.damage);
      hitSomething = true;
    }
  }
  for (const o of state.officers) {
    if (tryHit(o.x, o.y, 13)) {
      o.hp -= WEAPONS.fists.damage;
      burst(state, o.x, o.y, { count: 6, color: "#ffd76e", speed: 90 });
      hitSomething = true;
      addWanted(state, 1, "You struck an officer.");
    }
  }
  for (const ped of state.peds) {
    if (!ped.down && tryHit(ped.x, ped.y, 12)) {
      ped.down = true;
      burst(state, ped.x, ped.y, { count: 8, color: "#ffd76e", speed: 100 });
      hitSomething = true;
      addWanted(state, 1, "Assault in broad daylight.");
      scarePeds(state, p.x, p.y, 260);
    }
  }
  if (hitSomething) {
    addShake(state, 3);
    state.audio.hit();
  }
  return hitSomething;
}

export function tryShoot(state, angle) {
  const p = state.player;
  if (p.inCar || p.weapon !== "pistol") return false;
  if (p.shootCd > 0 || p.reloadT > 0) return false;
  if (p.ammo <= 0) {
    startReload(state);
    return false;
  }
  p.shootCd = WEAPONS.pistol.cooldown;
  p.ammo -= 1;
  p.muzzleT = 0.06;
  const spread = (Math.random() - 0.5) * 2 * WEAPONS.pistol.spread;
  const mx = p.x + Math.cos(angle) * 20;
  const my = p.y + Math.sin(angle) * 20;
  spawnBullet(state, mx, my, angle + spread, true, WEAPONS.pistol.damage);
  state.audio.shoot();
  addShake(state, 1.5);
  burst(state, mx, my, { count: 3, color: "#ffe9a3", speed: 60, life: 0.12, size: 2 });
  scarePeds(state, p.x, p.y, 320);
  addWanted(state, 1, "Shots fired — someone called it in.");
  return true;
}

export function startReload(state) {
  const p = state.player;
  if (p.weapon !== "pistol" || p.reloadT > 0) return;
  if (p.ammo >= WEAPONS.pistol.mag || p.reserve <= 0) return;
  p.reloadT = WEAPONS.pistol.reload;
  state.audio.reload();
}

export function finishReload(state) {
  const p = state.player;
  const need = WEAPONS.pistol.mag - p.ammo;
  const take = Math.min(need, p.reserve);
  p.ammo += take;
  p.reserve -= take;
}

export function spawnGuard(state, x, y, opts) {
  const g = {
    x, y, angle: 0, hp: 70, maxHp: 70,
    speed: 150, state: "guard",
    shootT: 0.8 + Math.random() * 0.8,
    homeX: x, homeY: y,
    guardId: (opts && opts.guardId) || ("guard-" + state.enemies.length),
    shirt: "#7a2e2e", pants: "#222831", skin: "#e0ac69",
  };
  state.enemies.push(g);
  return g;
}

export function damageEnemy(state, enemy, amount) {
  enemy.hp -= amount;
  enemy.state = "attack";
  burst(state, enemy.x, enemy.y, { count: 6, color: "#ff6a5a", speed: 110 });
  addFloat(state, enemy.x, enemy.y - 24, "-" + Math.round(amount), "#ffb0a0");
  if (enemy.hp <= 0) {
    burst(state, enemy.x, enemy.y, { count: 16, color: "#c9b896", speed: 140 });
    state.audio.hit();
    if (state.mission && state.mission.onEnemyDown) state.mission.onEnemyDown(enemy);
  } else {
    state.audio.hit();
  }
}

export function damagePlayer(state, amount) {
  const p = state.player;
  if (p.hp <= 0) return;
  p.hp -= amount;
  p.hurtT = 0;
  addShake(state, 4);
  state.audio.hit();
  burst(state, p.x, p.y, { count: 5, color: "#ff6a5a", speed: 90 });
  if (p.hp <= 0) state.wastePlayer();
}

export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    // Walls stop bullets: sample the point against buildings.
    if (!dead) {
      const fixed = collideCircle(state.world, b.x, b.y, 2);
      if (Math.hypot(fixed.x - b.x, fixed.y - b.y) > 3) {
        burst(state, b.x, b.y, { count: 4, color: "#e8e4da", speed: 70, life: 0.25, size: 2 });
        dead = true;
      }
    }
    if (!dead && b.friendly) {
      for (const e of state.enemies) {
        if (e.hp > 0 && Math.hypot(e.x - b.x, e.y - b.y) < 15) {
          damageEnemy(state, e, b.damage);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const o of state.officers) {
          if (Math.hypot(o.x - b.x, o.y - b.y) < 15) {
            o.hp -= b.damage;
            burst(state, o.x, o.y, { count: 6, color: "#9db8d9", speed: 100 });
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of state.peds) {
          if (!ped.down && Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
            ped.down = true;
            burst(state, ped.x, ped.y, { count: 8, color: "#ff6a5a", speed: 110 });
            addWanted(state, 1, "A bystander is down.");
            scarePeds(state, ped.x, ped.y, 300);
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && !b.friendly) {
      const p = state.player;
      const px = p.inCar ? p.inCar.x : p.x;
      const py = p.inCar ? p.inCar.y : p.y;
      const r = p.inCar ? 24 : 14;
      if (Math.hypot(px - b.x, py - b.y) < r) {
        damagePlayer(state, b.damage);
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

export function updateEnemies(state, dt) {
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const e = state.enemies[i];
    if (e.hp <= 0) {
      state.enemies.splice(i, 1);
      continue;
    }
    const d = Math.hypot(px - e.x, py - e.y);
    if (e.state === "guard" && d < 300) e.state = "attack";
    if (e.state === "attack") {
      e.angle = Math.atan2(py - e.y, px - e.x);
      if (d > 170) {
        const step = e.speed * dt;
        const fixed = collideCircle(state.world, e.x + Math.cos(e.angle) * step, e.y + Math.sin(e.angle) * step, 12);
        e.x = fixed.x;
        e.y = fixed.y;
      }
      e.shootT -= dt;
      if (d < 430 && e.shootT <= 0) {
        e.shootT = 1.1 + Math.random() * 0.9;
        spawnBullet(state, e.x, e.y, e.angle + (Math.random() - 0.5) * 0.2, false, 9);
        state.audio.shoot();
      }
    } else {
      // Idle guards pace a short beat around their post.
      e.angle += Math.sin(state.time * 0.6 + e.homeX) * 0.01;
    }
  }
}
