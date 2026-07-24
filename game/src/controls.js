// Unified input: desktop (pointer lock + keyboard + mouse) and mobile (touch).
const HALF_PI = Math.PI / 2 - 0.01;

export class Controls {
  constructor(canvas, player, callbacks) {
    this.canvas = canvas;
    this.player = player;
    this.cb = callbacks;
    this.input = { forward: 0, right: 0, jump: false, crouch: false, sprint: false };
    this.keys = {};
    this.locked = false;
    this.sensitivity = 0.0022;
    this.touch = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || "ontouchstart" in window;

    this._bindKeyboard();
    this._bindMouse();
    if (this.touch) this._buildTouchUI();
  }

  isTouch() {
    return this.touch;
  }

  _bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "KeyF") this.cb.onToggleFly();
      if (e.code === "KeyG") this.cb.onSave && this.cb.onSave();
      if (e.code.startsWith("Digit")) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) this.cb.onSelectSlot(n - 1);
        if (n === 0) this.cb.onSelectSlot(9);
      }
      this._updateKeyInput();
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      this._updateKeyInput();
    });
  }

  _updateKeyInput() {
    const k = this.keys;
    this.input.forward = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    this.input.right = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    this.input.jump = !!k.Space;
    this.input.sprint = !!(k.ShiftLeft || k.ShiftRight);
    this.input.crouch = !!(k.ControlLeft || k.ControlRight || k.KeyC);
  }

  _bindMouse() {
    this.canvas.addEventListener("click", () => {
      if (!this.touch && !this.locked) this.canvas.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.cb.onLockChange && this.cb.onLockChange(this.locked);
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.player.yaw -= e.movementX * this.sensitivity;
      this.player.pitch -= e.movementY * this.sensitivity;
      this.player.pitch = Math.max(-HALF_PI, Math.min(HALF_PI, this.player.pitch));
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (this.touch) return;
      if (!this.locked) return;
      if (e.button === 0) this.cb.onBreak();
      else if (e.button === 2) this.cb.onPlace();
    });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("wheel", (e) => {
      if (this.touch) return;
      this.cb.onScrollSlot(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });
  }

  _buildTouchUI() {
    const root = document.createElement("div");
    root.id = "touch-controls";
    root.innerHTML = `
      <div id="joystick"><div id="joy-knob"></div></div>
      <div id="touch-buttons">
        <button class="tbtn" data-act="place">▲<span>place</span></button>
        <button class="tbtn" data-act="jump">⤴<span>jump</span></button>
        <button class="tbtn" data-act="break">⛏<span>mine</span></button>
        <button class="tbtn" data-act="fly">✈<span>fly</span></button>
      </div>`;
    document.body.appendChild(root);

    const joy = root.querySelector("#joystick");
    const knob = root.querySelector("#joy-knob");
    let joyId = null;
    const joyCenter = { x: 0, y: 0 };

    const startJoy = (t) => {
      joyId = t.identifier;
      const r = joy.getBoundingClientRect();
      joyCenter.x = r.left + r.width / 2;
      joyCenter.y = r.top + r.height / 2;
      moveJoy(t);
    };
    const moveJoy = (t) => {
      let dx = t.clientX - joyCenter.x;
      let dy = t.clientY - joyCenter.y;
      const max = 45;
      const d = Math.hypot(dx, dy);
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.input.forward = -dy / max;
      this.input.right = dx / max;
    };
    const endJoy = () => {
      joyId = null;
      knob.style.transform = "translate(0,0)";
      this.input.forward = 0;
      this.input.right = 0;
    };

    // Look area = anywhere on the right side not on a button/joystick
    let lookId = null;
    let lastX = 0,
      lastY = 0;

    const onStart = (e) => {
      for (const t of e.changedTouches) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el && el.closest("#joystick") && joyId === null) {
          startJoy(t);
        } else if (el && el.closest(".tbtn")) {
          // handled by button listeners
        } else if (lookId === null) {
          lookId = t.identifier;
          lastX = t.clientX;
          lastY = t.clientY;
        }
      }
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) moveJoy(t);
        else if (t.identifier === lookId) {
          this.player.yaw -= (t.clientX - lastX) * 0.005;
          this.player.pitch -= (t.clientY - lastY) * 0.005;
          this.player.pitch = Math.max(-HALF_PI, Math.min(HALF_PI, this.player.pitch));
          lastX = t.clientX;
          lastY = t.clientY;
        }
      }
      e.preventDefault();
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) endJoy();
        if (t.identifier === lookId) lookId = null;
      }
    };
    window.addEventListener("touchstart", onStart, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);

    // buttons
    const bind = (act, downFn, upFn) => {
      const btn = root.querySelector(`[data-act="${act}"]`);
      btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        downFn();
      }, { passive: false });
      if (upFn)
        btn.addEventListener("touchend", (e) => {
          e.preventDefault();
          upFn();
        });
    };
    let mineTimer = null;
    bind("break", () => {
      this.cb.onBreak();
      mineTimer = setInterval(() => this.cb.onBreak(), 260);
    }, () => clearInterval(mineTimer));
    bind("place", () => this.cb.onPlace());
    bind("jump", () => (this.input.jump = true), () => (this.input.jump = false));
    bind("fly", () => this.cb.onToggleFly());
  }
}
