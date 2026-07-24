// Player physics, AABB collision, and voxel raycasting.
import { isSolid, isLiquid } from "./blocks.js";
import { HEIGHT } from "./world.js";

const EPS = 1e-3;

export class Player {
  constructor(x, y, z) {
    this.pos = { x, y, z }; // feet position (x,z centered, y at bottom)
    this.vel = { x: 0, y: 0, z: 0 };
    this.half = 0.3;
    this.height = 1.8;
    this.eye = 1.62;
    this.onGround = false;
    this.flying = false;
    this.inWater = false;
    this.yaw = 0;
    this.pitch = 0;
  }

  eyePosition() {
    return { x: this.pos.x, y: this.pos.y + this.eye, z: this.pos.z };
  }

  headBlockIsWater(world) {
    return isLiquid(world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + this.eye), Math.floor(this.pos.z)));
  }

  update(dt, input, world) {
    dt = Math.min(dt, 0.05);
    const speed = this.flying ? 9 : input.sprint ? 6.5 : 4.3;
    // desired horizontal velocity from input, rotated by yaw
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // forward is -Z when yaw 0
    let fx = -sin * input.forward + cos * input.right;
    let fz = -cos * input.forward - sin * input.right;
    const len = Math.hypot(fx, fz);
    if (len > 1) {
      fx /= len;
      fz /= len;
    }
    this.vel.x = fx * speed;
    this.vel.z = fz * speed;

    this.inWater = isLiquid(world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.5), Math.floor(this.pos.z)));

    if (this.flying) {
      let vy = 0;
      if (input.jump) vy += 1;
      if (input.crouch) vy -= 1;
      this.vel.y = vy * speed;
    } else {
      const g = this.inWater ? 9 : 26;
      this.vel.y -= g * dt;
      if (this.inWater) {
        this.vel.x *= 0.6;
        this.vel.z *= 0.6;
        if (this.vel.y < -3) this.vel.y = -3; // slow sinking
        if (input.jump) this.vel.y = 4.5; // swim up
      } else if (input.jump && this.onGround) {
        this.vel.y = 8.6;
        this.onGround = false;
      }
    }

    // integrate with per-axis collision
    this.onGround = false;
    this._moveAxis(world, "x", this.vel.x * dt);
    this._moveAxis(world, "z", this.vel.z * dt);
    this._moveAxis(world, "y", this.vel.y * dt);

    // safety: never fall out of the world
    if (this.pos.y < -20) {
      this.pos.y = HEIGHT + 5;
      this.vel.y = 0;
    }
  }

  _solids(world, ai) {
    const half = this.half,
      h = this.height;
    const minX = this.pos.x - half,
      maxX = this.pos.x + half;
    const minY = this.pos.y,
      maxY = this.pos.y + h;
    const minZ = this.pos.z - half,
      maxZ = this.pos.z + half;
    const x0 = Math.floor(minX),
      x1 = Math.floor(maxX);
    const y0 = Math.floor(minY),
      y1 = Math.floor(maxY - EPS);
    const z0 = Math.floor(minZ),
      z1 = Math.floor(maxZ);
    let found = false,
      lo = Infinity,
      hi = -Infinity;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          if (!isSolid(world.getBlock(x, y, z))) continue;
          found = true;
          const c = ai === "x" ? x : ai === "y" ? y : z;
          if (c < lo) lo = c;
          if (c > hi) hi = c;
        }
      }
    }
    return found ? { lo, hi } : null;
  }

  _moveAxis(world, ai, disp) {
    if (disp === 0) return;
    this.pos[ai] += disp;
    const s = this._solids(world, ai);
    if (!s) return;
    const half = this.half,
      h = this.height;
    if (ai === "y") {
      if (disp > 0) {
        this.pos.y = s.lo - h - EPS;
      } else {
        this.pos.y = s.hi + 1 + EPS;
        this.onGround = true;
      }
      this.vel.y = 0;
    } else if (ai === "x") {
      if (disp > 0) this.pos.x = s.lo - half - EPS;
      else this.pos.x = s.hi + 1 + half + EPS;
      this.vel.x = 0;
    } else {
      if (disp > 0) this.pos.z = s.lo - half - EPS;
      else this.pos.z = s.hi + 1 + half + EPS;
      this.vel.z = 0;
    }
  }
}

// Voxel DDA raycast. Returns { hit:[x,y,z], place:[x,y,z], id } or null.
export function raycast(world, origin, dir, maxDist = 6) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = Math.sign(dir.x) || 1;
  const stepY = Math.sign(dir.y) || 1;
  const stepZ = Math.sign(dir.z) || 1;
  const invX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const invY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const invZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  const distTo = (i, o, s) => (s > 0 ? i + 1 - o : o - i);
  let tMaxX = dir.x !== 0 ? distTo(x, origin.x, stepX) * invX : Infinity;
  let tMaxY = dir.y !== 0 ? distTo(y, origin.y, stepY) * invY : Infinity;
  let tMaxZ = dir.z !== 0 ? distTo(z, origin.z, stepZ) * invZ : Infinity;

  let prev = [x, y, z];
  let t = 0;
  while (t <= maxDist) {
    const id = world.getBlock(x, y, z);
    if (isSolid(id)) {
      return { hit: [x, y, z], place: prev, id };
    }
    prev = [x, y, z];
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += invX;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += invY;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += invZ;
    }
  }
  return null;
}
