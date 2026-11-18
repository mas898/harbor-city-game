// Keyboard and mouse state. The game reads this each frame; edge
// presses (justPressed) fire once per physical press. A small inject
// hook lets scripted tests drive the same path real keys use.

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.wheel = 0;
  }

  attach(target) {
    target.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.down.add(k);
      this.pressed.add(k);
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    });
    target.addEventListener("keyup", (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.down.delete(k);
    });
    target.addEventListener("blur", () => {
      this.down.clear();
      this.mouseDown = false;
    });
    return this;
  }

  attachMouse(canvas) {
    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    });
    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true;
      this.mouseClicked = true;
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    });
    window.addEventListener("mouseup", () => { this.mouseDown = false; });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    return this;
  }

  isDown(...keys) {
    return keys.some((k) => this.down.has(k));
  }

  justPressed(...keys) {
    return keys.some((k) => this.pressed.has(k));
  }

  // Movement axes: -1..1. Arrows mirror WASD.
  axisX() {
    let v = 0;
    if (this.isDown("a", "ArrowLeft")) v -= 1;
    if (this.isDown("d", "ArrowRight")) v += 1;
    return v;
  }

  axisY() {
    let v = 0;
    if (this.isDown("w", "ArrowUp")) v -= 1;
    if (this.isDown("s", "ArrowDown")) v += 1;
    return v;
  }

  inject(key) {
    const k = key.length === 1 ? key.toLowerCase() : key;
    this.down.add(k);
    this.pressed.add(k);
  }

  release(key) {
    const k = key.length === 1 ? key.toLowerCase() : key;
    this.down.delete(k);
  }

  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
    this.wheel = 0;
  }
}
