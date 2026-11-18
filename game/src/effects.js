// Particles, skid marks, floating score text and screen shake. These
// are purely cosmetic: they never change gameplay, only how it reads.

export function burst(state, x, y, opts) {
  const o = opts || {};
  const n = o.count || 10;
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = (o.speed || 120) * (0.4 + Math.random() * 0.8);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: (o.life || 0.5) * (0.6 + Math.random() * 0.7),
      maxLife: o.life || 0.5,
      size: (o.size || 3) * (0.7 + Math.random() * 0.6),
      color: o.color || "#ffd76e",
      gravity: o.gravity || 0,
      drag: o.drag || 2.2,
    });
  }
  if (state.particles.length > 420) state.particles.splice(0, state.particles.length - 420);
}

export function smokePuff(state, x, y) {
  state.particles.push({
    x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 20, vy: -18 - Math.random() * 16,
    life: 0.7, maxLife: 0.7, size: 7 + Math.random() * 5,
    color: "#d8d8d8", gravity: -12, drag: 1.2,
  });
}

export function addSkid(state, x, y, angle) {
  const last = state.skids[state.skids.length - 1];
  if (last && Math.hypot(last.x - x, last.y - y) < 9 && Math.abs(last.angle - angle) < 0.4) return;
  state.skids.push({ x, y, angle, life: 7 });
  if (state.skids.length > 500) state.skids.splice(0, state.skids.length - 500);
}

export function addFloat(state, x, y, text, color) {
  state.floats.push({ x, y, text, color: color || "#ffffff", life: 1.4 });
  if (state.floats.length > 24) state.floats.shift();
}

export function addShake(state, amount) {
  state.shake = Math.min(18, state.shake + amount);
}

export function updateEffects(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) { state.particles.splice(i, 1); continue; }
    const dragK = Math.max(0, 1 - p.drag * dt);
    p.vx *= dragK;
    p.vy = p.vy * dragK + p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = state.skids.length - 1; i >= 0; i -= 1) {
    state.skids[i].life -= dt;
    if (state.skids[i].life <= 0) state.skids.splice(i, 1);
  }
  for (let i = state.floats.length - 1; i >= 0; i -= 1) {
    const f = state.floats[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) state.floats.splice(i, 1);
  }
  state.shake = Math.max(0, state.shake - 42 * dt);
}

export function shakeOffset(state) {
  if (state.shake <= 0.2) return { x: 0, y: 0 };
  return {
    x: (Math.random() - 0.5) * state.shake,
    y: (Math.random() - 0.5) * state.shake,
  };
}
