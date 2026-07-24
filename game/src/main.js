import * as THREE from "three";
import { buildAtlas, tileUV, ATLAS_TILES } from "./textures.js";
import { World, CHUNK, HEIGHT, WATER_LEVEL } from "./world.js";
import { Player, raycast } from "./player.js";
import { Controls } from "./controls.js";
import { BLOCKS, BLOCK_IDS } from "./blocks.js";

const SAVE_KEY = "voxelcraft.save.v1";
const B = BLOCK_IDS;

// ---------- renderer / scene ----------
const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = "YXZ";

const fog = new THREE.Fog(0x88bbee, 40, 150);
scene.fog = fog;

// ---------- sky dome ----------
const skyUniforms = {
  topColor: { value: new THREE.Color(0x2a6bd6) },
  bottomColor: { value: new THREE.Color(0xbfe3ff) },
};
const skyGeo = new THREE.SphereGeometry(500, 24, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: skyUniforms,
  vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
  fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vP;
    void main(){ float h = normalize(vP).y; float t = smoothstep(-0.15, 0.55, h); gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);} `,
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// sun + moon
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(18, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xfff4c2, fog: false })
);
scene.add(sun);
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(12, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xdfe7ff, fog: false })
);
scene.add(moon);

// lights
const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
scene.add(sunLight);
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3a5a30, 0.6);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambient);

// ---------- world ----------
const atlas = buildAtlas();
let seed = 20240724;
const world = new World(scene, atlas, seed);

// ---------- highlight box ----------
const hlGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
const hlEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(hlGeo),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
);
hlEdges.visible = false;
scene.add(hlEdges);

// ---------- player ----------
function surfaceHeight(x, z) {
  for (let y = HEIGHT - 1; y >= 0; y--) {
    const id = world.getBlock(x, y, z);
    if (id !== B.AIR && id !== B.WATER) return y;
  }
  return WATER_LEVEL;
}
// make sure spawn chunks exist
world.ensureChunk(0, 0);
const spawnX = 8,
  spawnZ = 8;
const player = new Player(spawnX + 0.5, surfaceHeight(spawnX, spawnZ) + 2, spawnZ + 0.5);

// ---------- hotbar ----------
const HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.WOOD, B.LEAVES, B.SAND, B.GLASS, B.BRICK];
let selected = 0;

function makeIcon(blockId) {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const def = BLOCKS[blockId];
  const tile = def.faces ? def.faces[0] : 0; // side face
  const uv = tileUV(tile);
  const img = atlas.image;
  const s = 1 / ATLAS_TILES;
  const col = tile % ATLAS_TILES;
  const row = Math.floor(tile / ATLAS_TILES);
  ctx.drawImage(img, col * 16, row * 16, 16, 16, 0, 0, 32, 32);
  return c.toDataURL();
}

const hotbarEl = document.getElementById("hotbar");
function buildHotbar() {
  hotbarEl.innerHTML = "";
  HOTBAR.forEach((id, i) => {
    const slot = document.createElement("div");
    slot.className = "slot" + (i === selected ? " active" : "");
    const img = document.createElement("img");
    img.src = makeIcon(id);
    slot.appendChild(img);
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = i === 9 ? 0 : i + 1;
    slot.appendChild(num);
    slot.addEventListener("click", () => selectSlot(i));
    hotbarEl.appendChild(slot);
  });
  updateSelectedName();
}
function selectSlot(i) {
  selected = ((i % HOTBAR.length) + HOTBAR.length) % HOTBAR.length;
  [...hotbarEl.children].forEach((el, idx) => el.classList.toggle("active", idx === selected));
  updateSelectedName();
}
function updateSelectedName() {
  document.getElementById("selname").textContent = BLOCKS[HOTBAR[selected]].name;
}

// ---------- interactions ----------
function cameraDir() {
  return {
    x: -Math.sin(player.yaw) * Math.cos(player.pitch),
    y: Math.sin(player.pitch),
    z: -Math.cos(player.yaw) * Math.cos(player.pitch),
  };
}
function currentTarget() {
  return raycast(world, player.eyePosition(), cameraDir(), 7);
}
function onBreak() {
  const hit = currentTarget();
  if (!hit) return;
  const def = BLOCKS[hit.id];
  if (def && def.unbreakable) return;
  world.setBlock(hit.hit[0], hit.hit[1], hit.hit[2], B.AIR);
  world.flushDirtyNear(hit.hit[0], hit.hit[2]);
  spawnBreakFx(hit.hit, hit.id);
}
function onPlace() {
  const hit = currentTarget();
  if (!hit) return;
  const [px, py, pz] = hit.place;
  const existing = world.getBlock(px, py, pz);
  if (existing !== B.AIR && existing !== B.WATER) return;
  // don't place inside the player
  const half = player.half;
  const pminX = player.pos.x - half,
    pmaxX = player.pos.x + half;
  const pminZ = player.pos.z - half,
    pmaxZ = player.pos.z + half;
  const pminY = player.pos.y,
    pmaxY = player.pos.y + player.height;
  const overlaps =
    px + 1 > pminX && px < pmaxX && py + 1 > pminY && py < pmaxY && pz + 1 > pminZ && pz < pmaxZ;
  if (overlaps) return;
  world.setBlock(px, py, pz, HOTBAR[selected]);
  world.flushDirtyNear(px, pz);
}

// break particles
const fxGroup = new THREE.Group();
scene.add(fxGroup);
const fxParticles = [];
function spawnBreakFx(pos, id) {
  const def = BLOCKS[id];
  const tile = def.faces ? def.faces[0] : 0;
  const uv = tileUV(tile);
  const geo = new THREE.PlaneGeometry(0.18, 0.18);
  const mat = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0] + 0.5 + (Math.random() - 0.5) * 0.6, pos[1] + 0.5, pos[2] + 0.5 + (Math.random() - 0.5) * 0.6);
    m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 3 + 1, (Math.random() - 0.5) * 2);
    m.userData.life = 0.7;
    fxGroup.add(m);
    fxParticles.push(m);
  }
}
function updateFx(dt) {
  for (let i = fxParticles.length - 1; i >= 0; i--) {
    const m = fxParticles[i];
    m.userData.life -= dt;
    if (m.userData.life <= 0) {
      fxGroup.remove(m);
      fxParticles.splice(i, 1);
      continue;
    }
    m.userData.v.y -= 12 * dt;
    m.position.addScaledVector(m.userData.v, dt);
    m.rotation.x += dt * 4;
    m.rotation.y += dt * 4;
    m.material.opacity = Math.min(1, m.userData.life * 2);
  }
}

// ---------- controls ----------
const controls = new Controls(canvas, player, {
  onBreak,
  onPlace,
  onSelectSlot: selectSlot,
  onScrollSlot: (d) => selectSlot(selected + d),
  onToggleFly: () => {
    player.flying = !player.flying;
    player.vel.y = 0;
    flash(player.flying ? "Fly mode ON" : "Fly mode OFF");
  },
  onSave: saveWorld,
  onLockChange: (locked) => {
    document.getElementById("overlay").style.display = locked ? "none" : "flex";
  },
});

// ---------- save / load ----------
function saveWorld() {
  try {
    const data = {
      seed,
      edits: world.edits,
      pos: player.pos,
      yaw: player.yaw,
      pitch: player.pitch,
      selected,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    flash("World saved");
  } catch (e) {
    flash("Save failed");
  }
}
function loadWorld() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    world.edits = data.edits || {};
    player.pos = data.pos;
    player.yaw = data.yaw || 0;
    player.pitch = data.pitch || 0;
    selected = data.selected || 0;
    // regenerate loaded chunks with edits
    world.chunks.clear();
    return true;
  } catch (e) {
    return false;
  }
}

// ---------- HUD helpers ----------
let flashTimer = null;
function flash(msg) {
  const el = document.getElementById("flash");
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (el.style.opacity = "0"), 1400);
}

// ---------- day / night ----------
let timeOfDay = 0.28; // 0..1
const DAY_LENGTH = 210; // seconds
const dayTop = new THREE.Color(0x2a6bd6);
const dayBottom = new THREE.Color(0xbfe3ff);
const nightTop = new THREE.Color(0x05060f);
const nightBottom = new THREE.Color(0x1a2140);
const duskTop = new THREE.Color(0x24304f);
const duskBottom = new THREE.Color(0xe8955a);

function updateSky(dt) {
  timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;
  const ang = timeOfDay * Math.PI * 2;
  const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.25).normalize();
  const elev = sunDir.y; // -1..1
  const p = player.eyePosition();
  sun.position.set(p.x + sunDir.x * 400, p.y + sunDir.y * 400, p.z + sunDir.z * 400);
  moon.position.set(p.x - sunDir.x * 400, p.y - sunDir.y * 400, p.z - sunDir.z * 400);
  sunLight.position.copy(sun.position).sub(new THREE.Vector3(p.x, p.y, p.z)).normalize();

  const daylight = Math.max(0, elev);
  sunLight.intensity = 0.15 + daylight * 1.0;
  hemi.intensity = 0.25 + daylight * 0.5;
  ambient.intensity = 0.25 + daylight * 0.25;
  sunLight.color.setHSL(0.12, 0.4, 0.55 + daylight * 0.35);

  // sky color blend: night -> dusk -> day
  const top = new THREE.Color();
  const bottom = new THREE.Color();
  if (elev > 0.15) {
    top.copy(dayTop);
    bottom.copy(dayBottom);
  } else if (elev > -0.15) {
    const f = (elev + 0.15) / 0.3;
    top.copy(duskTop).lerp(dayTop, f);
    bottom.copy(duskBottom).lerp(dayBottom, f);
    if (elev < 0) {
      const g = (-elev) / 0.15;
      top.lerp(nightTop, g);
      bottom.lerp(nightBottom, g);
    }
  } else {
    top.copy(nightTop);
    bottom.copy(nightBottom);
  }
  skyUniforms.topColor.value.copy(top);
  skyUniforms.bottomColor.value.copy(bottom);
  fog.color.copy(bottom);
  sun.visible = elev > -0.2;
  moon.visible = elev < 0.2;
}

// ---------- underwater overlay ----------
const waterOverlay = document.getElementById("water-overlay");

// ---------- resize ----------
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

// ---------- main loop ----------
let last = performance.now();
let fpsAccum = 0,
  fpsFrames = 0,
  fpsDisplay = 0;
const renderRadius = controls.isTouch() ? 4 : 6;

function updateHighlight() {
  const hit = currentTarget();
  if (hit) {
    hlEdges.visible = true;
    hlEdges.position.set(hit.hit[0] + 0.5, hit.hit[1] + 0.5, hit.hit[2] + 0.5);
  } else {
    hlEdges.visible = false;
  }
}

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  player.update(dt, controls.input, world);

  const eye = player.eyePosition();
  camera.position.set(eye.x, eye.y, eye.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  sky.position.copy(camera.position);

  world.update(player.pos.x, player.pos.z, renderRadius, controls.isTouch() ? 1 : 2);
  updateHighlight();
  updateSky(dt);
  updateFx(dt);

  // underwater
  const underwater = player.headBlockIsWater(world);
  waterOverlay.style.opacity = underwater ? "1" : "0";

  renderer.render(scene, camera);

  // HUD
  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum >= 0.5) {
    fpsDisplay = Math.round(fpsFrames / fpsAccum);
    fpsAccum = 0;
    fpsFrames = 0;
    document.getElementById("hud").textContent =
      `FPS ${fpsDisplay}  |  XYZ ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}` +
      `  |  ${player.flying ? "FLY" : player.inWater ? "SWIM" : "WALK"}  |  ${Math.floor(timeOfDay * 24)}:00`;
  }

  requestAnimationFrame(loop);
}

// ---------- boot ----------
const loaded = loadWorld();
if (loaded) {
  world.ensureChunk(...world.worldToChunk(player.pos.x, player.pos.z));
  flash("Save loaded");
}
buildHotbar();
// autosave every 30s
setInterval(saveWorld, 30000);
window.addEventListener("beforeunload", saveWorld);

document.getElementById("play-btn").addEventListener("click", () => {
  if (!controls.isTouch()) canvas.requestPointerLock();
  document.getElementById("overlay").style.display = "none";
});
document.getElementById("reset-btn").addEventListener("click", () => {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
});
if (controls.isTouch()) {
  document.getElementById("overlay").style.display = "none";
  document.getElementById("desktop-help").style.display = "none";
}

requestAnimationFrame(loop);
