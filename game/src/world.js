// Voxel world: chunk storage, terrain generation, and meshing.
import * as THREE from "three";
import { Noise } from "./noise.js";
import { BLOCKS, BLOCK_IDS, isSolid, isTransparent } from "./blocks.js";
import { tileUV } from "./textures.js";

export const CHUNK = 16;
export const HEIGHT = 64;
export const WATER_LEVEL = 26;

const B = BLOCK_IDS;

// Cube face table. For each of the 6 faces: normal, two tangent axes, and the
// four corner offsets. AO samples are derived generically from these.
const AXES = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// Build face descriptors: for normal along each axis (+/-)
function buildFaces() {
  const faces = [];
  const dirs = [
    { n: [1, 0, 0], u: AXES.y, v: AXES.z, shade: 0.8 },
    { n: [-1, 0, 0], u: AXES.y, v: AXES.z, shade: 0.8 },
    { n: [0, 1, 0], u: AXES.x, v: AXES.z, shade: 1.0 },
    { n: [0, -1, 0], u: AXES.x, v: AXES.z, shade: 0.5 },
    { n: [0, 0, 1], u: AXES.x, v: AXES.y, shade: 0.65 },
    { n: [0, 0, -1], u: AXES.x, v: AXES.y, shade: 0.65 },
  ];
  for (let fi = 0; fi < dirs.length; fi++) {
    const { n, u, v, shade } = dirs[fi];
    // base corner: positive axis face sits at coord 1 along that axis
    const base = [0, 0, 0];
    for (let k = 0; k < 3; k++) if (n[k] > 0) base[k] = 1;
    // four corners in (tu,tv) = (0,0),(1,0),(1,1),(0,1)
    const tc = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const corners = tc.map(([tu, tv]) => [
      base[0] + tu * u[0] + tv * v[0],
      base[1] + tu * u[1] + tv * v[1],
      base[2] + tu * u[2] + tv * v[2],
    ]);
    // winding so geometric normal matches n
    const cn = cross(
      [corners[1][0] - corners[0][0], corners[1][1] - corners[0][1], corners[1][2] - corners[0][2]],
      [corners[2][0] - corners[0][0], corners[2][1] - corners[0][1], corners[2][2] - corners[0][2]]
    );
    const flip = dot(cn, n) < 0;
    // AO sample offsets per corner: N + Udir + Vdir
    const ao = tc.map(([tu, tv]) => {
      const ud = tu === 1 ? 1 : -1;
      const vd = tv === 1 ? 1 : -1;
      const s1 = [n[0] + u[0] * ud, n[1] + u[1] * ud, n[2] + u[2] * ud];
      const s2 = [n[0] + v[0] * vd, n[1] + v[1] * vd, n[2] + v[2] * vd];
      const c = [
        n[0] + u[0] * ud + v[0] * vd,
        n[1] + u[1] * ud + v[1] * vd,
        n[2] + u[2] * ud + v[2] * vd,
      ];
      return { s1, s2, c };
    });
    faces.push({ n, shade, corners, ao, flip, faceIndex: fi });
  }
  return faces;
}
const FACES = buildFaces();

function occludes(id) {
  return isSolid(id) && !isTransparent(id);
}
function vertexAO(s1, s2, c) {
  if (s1 && s2) return 0;
  return 3 - (s1 + s2 + c);
}
const AO_LEVELS = [0.45, 0.65, 0.82, 1.0];

export class World {
  constructor(scene, atlas, seed = 20240724) {
    this.scene = scene;
    this.noise = new Noise(seed);
    this.oreNoise = new Noise(seed + 7);
    this.treeNoise = new Noise(seed + 99);
    this.seed = seed;
    this.chunks = new Map();
    this.edits = {}; // player edits: "x,y,z" -> block id (for saving)

    this.opaqueMat = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
    });
    this.transMat = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }

  key(cx, cz) {
    return cx + "," + cz;
  }

  ensureChunk(cx, cz) {
    const k = this.key(cx, cz);
    let ch = this.chunks.get(k);
    if (ch) return ch;
    ch = {
      cx,
      cz,
      blocks: new Uint8Array(CHUNK * CHUNK * HEIGHT),
      mesh: null,
      trans: null,
      dirty: true,
    };
    this.chunks.set(k, ch);
    this.generate(ch);
    this.applyEdits(ch);
    return ch;
  }

  idx(x, y, z) {
    return x + z * CHUNK + y * CHUNK * CHUNK;
  }

  generate(ch) {
    const { cx, cz, blocks } = ch;
    const N = this.noise;
    for (let lx = 0; lx < CHUNK; lx++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        const wx = cx * CHUNK + lx;
        const wz = cz * CHUNK + lz;
        // continental + hills
        const cont = N.fbm2(wx * 0.0035, wz * 0.0035, 4);
        const hills = N.fbm2(wx * 0.02, wz * 0.02, 4);
        const mountainMask = Math.max(0, N.fbm2(wx * 0.0016, wz * 0.0016, 2));
        let h = WATER_LEVEL + 2 + cont * 10 + hills * 6 + mountainMask * mountainMask * 26;
        h = Math.max(1, Math.min(HEIGHT - 2, Math.floor(h)));

        for (let y = 0; y <= h; y++) {
          let id = B.STONE;
          if (y === 0) id = B.BEDROCK;
          else if (y > h - 4 && y < h) id = B.DIRT;
          else if (y === h) {
            if (h <= WATER_LEVEL + 1) id = B.SAND;
            else if (h > WATER_LEVEL + 22) id = B.SNOW;
            else id = B.GRASS;
          }
          if (id === B.STONE) {
            id = this.pickOre(wx, y, wz, h);
          }
          blocks[this.idx(lx, y, lz)] = id;
        }
        // water fill
        for (let y = h + 1; y <= WATER_LEVEL; y++) {
          blocks[this.idx(lx, y, lz)] = B.WATER;
        }
        // trees on grass, away from chunk borders so leaves stay in-chunk
        if (
          blocks[this.idx(lx, h, lz)] === B.GRASS &&
          lx > 2 && lx < CHUNK - 3 && lz > 2 && lz < CHUNK - 3 &&
          h > WATER_LEVEL + 1
        ) {
          const t = this.treeNoise.noise2(wx * 0.9, wz * 0.9);
          if (t > 0.72) this.placeTree(blocks, lx, h + 1, lz);
        }
      }
    }
  }

  pickOre(wx, y, wz, h) {
    if (y > h - 5) return B.STONE;
    const n = this.oreNoise.noise3(wx * 0.1, y * 0.1, wz * 0.1);
    if (y < 14 && n > 0.72) return B.DIAMOND;
    if (y < 22 && n > 0.66) return B.GOLD;
    if (y < 40 && n > 0.6) return B.IRON;
    if (n > 0.55) return B.COAL;
    return B.STONE;
  }

  placeTree(blocks, x, y, z) {
    const th = 4 + (Math.floor(this.treeNoise.noise2(x * 7.3, z * 3.1) * 3 + 3) % 3);
    for (let i = 0; i < th; i++) {
      const yy = y + i;
      if (yy < HEIGHT) blocks[this.idx(x, yy, z)] = B.WOOD;
    }
    const top = y + th;
    for (let dy = -2; dy <= 1; dy++) {
      const r = dy < 0 ? 2 : 1;
      const ly = top + dy;
      if (ly < 0 || ly >= HEIGHT) continue;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy < 1) continue;
          if (Math.abs(dx) === r && Math.abs(dz) === r && Math.random() > 0.5) continue;
          const bx = x + dx,
            bz = z + dz;
          if (bx < 0 || bx >= CHUNK || bz < 0 || bz >= CHUNK) continue;
          const i2 = this.idx(bx, ly, bz);
          if (blocks[i2] === B.AIR) blocks[i2] = B.LEAVES;
        }
      }
    }
  }

  applyEdits(ch) {
    const base = "";
    for (let lx = 0; lx < CHUNK; lx++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let y = 0; y < HEIGHT; y++) {
          const wx = ch.cx * CHUNK + lx;
          const wz = ch.cz * CHUNK + lz;
          const e = this.edits[wx + "," + y + "," + wz];
          if (e !== undefined) ch.blocks[this.idx(lx, y, lz)] = e;
        }
      }
    }
  }

  worldToChunk(wx, wz) {
    return [Math.floor(wx / CHUNK), Math.floor(wz / CHUNK)];
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= HEIGHT) return B.AIR;
    const [cx, cz] = this.worldToChunk(wx, wz);
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch) {
      // generate on demand for neighbor lookups
      const c2 = this.ensureChunk(cx, cz);
      return c2.blocks[this.idx(wx - cx * CHUNK, wy, wz - cz * CHUNK)];
    }
    return ch.blocks[this.idx(wx - cx * CHUNK, wy, wz - cz * CHUNK)];
  }

  setBlock(wx, wy, wz, id, record = true) {
    if (wy < 0 || wy >= HEIGHT) return;
    const [cx, cz] = this.worldToChunk(wx, wz);
    const ch = this.ensureChunk(cx, cz);
    const lx = wx - cx * CHUNK;
    const lz = wz - cz * CHUNK;
    ch.blocks[this.idx(lx, wy, lz)] = id;
    if (record) this.edits[wx + "," + wy + "," + wz] = id;
    ch.dirty = true;
    // mark neighbor chunks dirty if on the border
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK - 1) this.markDirty(cx, cz + 1);
  }

  markDirty(cx, cz) {
    const ch = this.chunks.get(this.key(cx, cz));
    if (ch) ch.dirty = true;
  }

  faceVisible(cur, nb) {
    if (nb === B.AIR) return true;
    const nbT = isTransparent(nb);
    if (!nbT) return false;
    const curT = isTransparent(cur);
    if (!curT) return true;
    return cur !== nb; // both transparent: only show boundary between different types
  }

  buildMesh(ch) {
    const { cx, cz, blocks } = ch;
    const op = { pos: [], norm: [], uv: [], col: [], idx: [] };
    const tr = { pos: [], norm: [], uv: [], col: [], idx: [] };
    const ox = cx * CHUNK;
    const oz = cz * CHUNK;

    for (let y = 0; y < HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const cur = blocks[this.idx(lx, y, lz)];
          if (cur === B.AIR) continue;
          const wx = ox + lx,
            wz = oz + lz;
          const def = BLOCKS[cur];
          const target = isTransparent(cur) ? tr : op;
          for (const f of FACES) {
            const nx = wx + f.n[0],
              ny = y + f.n[1],
              nz = wz + f.n[2];
            const nb = this.getBlock(nx, ny, nz);
            if (!this.faceVisible(cur, nb)) continue;

            const tile = def.faces[f.faceIndex];
            const uv = tileUV(tile);
            const uvc = [
              [uv.u0, uv.v0],
              [uv.u1, uv.v0],
              [uv.u1, uv.v1],
              [uv.u0, uv.v1],
            ];
            const startVert = target.pos.length / 3;
            const aoVals = [];
            for (let ci = 0; ci < 4; ci++) {
              const corner = f.corners[ci];
              target.pos.push(wx + corner[0], y + corner[1], wz + corner[2]);
              target.norm.push(f.n[0], f.n[1], f.n[2]);
              target.uv.push(uvc[ci][0], uvc[ci][1]);
              // AO
              const a = f.ao[ci];
              const s1 = occludes(this.getBlock(wx + a.s1[0], y + a.s1[1], wz + a.s1[2])) ? 1 : 0;
              const s2 = occludes(this.getBlock(wx + a.s2[0], y + a.s2[1], wz + a.s2[2])) ? 1 : 0;
              const cc = occludes(this.getBlock(wx + a.c[0], y + a.c[1], wz + a.c[2])) ? 1 : 0;
              const ao = AO_LEVELS[vertexAO(s1, s2, cc)];
              aoVals.push(ao);
              const b = f.shade * ao;
              target.col.push(b, b, b);
            }
            // choose triangle split to reduce AO artifacts
            let tri;
            if (aoVals[0] + aoVals[2] > aoVals[1] + aoVals[3]) {
              tri = [0, 1, 2, 0, 2, 3];
            } else {
              tri = [1, 2, 3, 1, 3, 0];
            }
            if (f.flip) tri = [tri[2], tri[1], tri[0], tri[5], tri[4], tri[3]];
            for (const t of tri) target.idx.push(startVert + t);
          }
        }
      }
    }

    ch.mesh = this.replaceMesh(ch.mesh, op, this.opaqueMat);
    ch.trans = this.replaceMesh(ch.trans, tr, this.transMat);
    ch.dirty = false;
  }

  replaceMesh(old, data, material) {
    if (old) {
      this.scene.remove(old);
      old.geometry.dispose();
    }
    if (data.idx.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(data.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(data.norm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(data.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(data.col, 3));
    g.setIndex(data.idx);
    const mesh = new THREE.Mesh(g, material);
    mesh.frustumCulled = true;
    this.scene.add(mesh);
    return mesh;
  }

  // Ensure chunks within radius exist and are meshed. Returns work done count.
  update(centerX, centerZ, radius, budget = 2) {
    const [ccx, ccz] = this.worldToChunk(centerX, centerZ);
    let built = 0;
    // spiral-ish nearest first
    const candidates = [];
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const d = dx * dx + dz * dz;
        if (d > radius * radius + radius) continue;
        candidates.push([ccx + dx, ccz + dz, d]);
      }
    }
    candidates.sort((a, b) => a[2] - b[2]);
    for (const [cx, cz] of candidates) {
      const ch = this.ensureChunk(cx, cz);
      if (ch.dirty) {
        this.buildMesh(ch);
        if (++built >= budget) break;
      }
    }
    // unload far chunks
    const maxD = (radius + 2) * (radius + 2);
    for (const [k, ch] of this.chunks) {
      const dd = (ch.cx - ccx) * (ch.cx - ccx) + (ch.cz - ccz) * (ch.cz - ccz);
      if (dd > maxD) {
        if (ch.mesh) {
          this.scene.remove(ch.mesh);
          ch.mesh.geometry.dispose();
        }
        if (ch.trans) {
          this.scene.remove(ch.trans);
          ch.trans.geometry.dispose();
        }
        this.chunks.delete(k);
      }
    }
    return built;
  }

  // rebuild meshes for any dirty chunks immediately (after an edit)
  flushDirtyNear(wx, wz) {
    const [ccx, ccz] = this.worldToChunk(wx, wz);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ch = this.chunks.get(this.key(ccx + dx, ccz + dz));
        if (ch && ch.dirty) this.buildMesh(ch);
      }
    }
  }
}
