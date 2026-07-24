// Procedurally generated texture atlas.
// Everything is drawn onto a canvas at runtime so the game needs no image files.
import * as THREE from "three";
import { TILES } from "./blocks.js";

export const ATLAS_TILES = 8; // 8x8 grid of tiles
export const TILE_PX = 16; // pixels per tile (blocky look)
const ATLAS_PX = ATLAS_TILES * TILE_PX;

function shade(hex, amt) {
  const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((hex >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (hex & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

// Deterministic per-tile pseudo random so textures are stable.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// Fill a tile with a base color plus grain speckle.
function grain(ctx, ox, oy, base, spread, seed) {
  const r = rng(seed);
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const amt = Math.floor((r() - 0.5) * spread);
      px(ctx, ox + x, oy + y, shade(base, amt));
    }
  }
}

function drawTile(ctx, index, drawFn) {
  const tx = (index % ATLAS_TILES) * TILE_PX;
  const ty = Math.floor(index / ATLAS_TILES) * TILE_PX;
  ctx.save();
  ctx.translate(tx, ty);
  drawFn(ctx);
  ctx.restore();
}

export function buildAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_PX;
  canvas.height = ATLAS_PX;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // grass top
  drawTile(ctx, TILES.grass_top, (c) => grain(c, 0, 0, 0x5aa02c, 40, 11));
  // grass side (dirt with green top strip)
  drawTile(ctx, TILES.grass_side, (c) => {
    grain(c, 0, 0, 0x8a6a43, 34, 12);
    const r = rng(99);
    for (let x = 0; x < TILE_PX; x++) {
      const h = 3 + Math.floor(r() * 3);
      for (let y = 0; y < h; y++) px(c, x, y, shade(0x5aa02c, Math.floor((r() - 0.5) * 40)));
    }
  });
  // dirt
  drawTile(ctx, TILES.dirt, (c) => grain(c, 0, 0, 0x8a6a43, 34, 13));
  // stone
  drawTile(ctx, TILES.stone, (c) => grain(c, 0, 0, 0x888888, 30, 14));
  // sand
  drawTile(ctx, TILES.sand, (c) => grain(c, 0, 0, 0xdcd29a, 24, 15));
  // log top (rings)
  drawTile(ctx, TILES.log_top, (c) => {
    grain(c, 0, 0, 0xb08a4f, 18, 16);
    c.strokeStyle = shade(0x6e5230, 0);
    for (let r = 2; r < 8; r += 2) {
      c.beginPath();
      c.arc(8, 8, r, 0, Math.PI * 2);
      c.stroke();
    }
  });
  // log side (bark)
  drawTile(ctx, TILES.log_side, (c) => {
    grain(c, 0, 0, 0x6e5230, 26, 17);
    for (let x = 2; x < TILE_PX; x += 5) for (let y = 0; y < TILE_PX; y++) px(c, x, y, shade(0x4d3a20, 0));
  });
  // leaves
  drawTile(ctx, TILES.leaves, (c) => {
    const r = rng(18);
    for (let y = 0; y < TILE_PX; y++)
      for (let x = 0; x < TILE_PX; x++) {
        const v = r();
        px(c, x, y, v > 0.85 ? shade(0x2f6d1e, 30) : shade(0x357d22, Math.floor((v - 0.5) * 50)));
      }
  });
  // planks
  drawTile(ctx, TILES.planks, (c) => {
    grain(c, 0, 0, 0xb5905a, 18, 19);
    c.fillStyle = shade(0x6e5230, 0);
    for (let y = 0; y < TILE_PX; y += 4) c.fillRect(0, y, TILE_PX, 1);
    for (let y = 0; y < TILE_PX; y += 8) c.fillRect(y % 16, y, 1, 4);
  });
  // cobblestone
  drawTile(ctx, TILES.cobble, (c) => {
    grain(c, 0, 0, 0x7a7a7a, 44, 20);
    c.fillStyle = "rgba(40,40,40,0.6)";
    c.fillRect(0, 7, TILE_PX, 1);
    c.fillRect(7, 0, 1, 7);
    c.fillRect(3, 8, 1, 8);
    c.fillRect(11, 8, 1, 8);
  });
  // glass
  drawTile(ctx, TILES.glass, (c) => {
    c.clearRect(0, 0, TILE_PX, TILE_PX);
    c.fillStyle = "rgba(180,220,235,0.18)";
    c.fillRect(0, 0, TILE_PX, TILE_PX);
    c.strokeStyle = "rgba(210,235,245,0.85)";
    c.strokeRect(0.5, 0.5, TILE_PX - 1, TILE_PX - 1);
    c.strokeStyle = "rgba(255,255,255,0.4)";
    c.beginPath();
    c.moveTo(2, 13);
    c.lineTo(6, 3);
    c.stroke();
  });
  // brick
  drawTile(ctx, TILES.brick, (c) => {
    grain(c, 0, 0, 0xa2493b, 16, 21);
    c.fillStyle = "#c9c2b8";
    for (let y = 0; y < TILE_PX; y += 4) c.fillRect(0, y, TILE_PX, 1);
    for (let x = 0; x < TILE_PX; x += 8) c.fillRect(x, 0, 1, 4);
    for (let x = 4; x < TILE_PX; x += 8) c.fillRect(x, 4, 1, 4);
    for (let x = 0; x < TILE_PX; x += 8) c.fillRect(x, 8, 1, 4);
    for (let x = 4; x < TILE_PX; x += 8) c.fillRect(x, 12, 1, 4);
  });
  // water
  drawTile(ctx, TILES.water, (c) => {
    grain(c, 0, 0, 0x2a6fd6, 18, 22);
    c.fillStyle = "rgba(255,255,255,0.12)";
    for (let y = 2; y < TILE_PX; y += 5) c.fillRect(0, y, TILE_PX, 1);
  });
  // bedrock
  drawTile(ctx, TILES.bedrock, (c) => {
    const r = rng(23);
    for (let y = 0; y < TILE_PX; y++)
      for (let x = 0; x < TILE_PX; x++) px(c, x, y, shade(0x333333, Math.floor((r() - 0.5) * 90)));
  });
  // snow
  drawTile(ctx, TILES.snow, (c) => grain(c, 0, 0, 0xf3f6fb, 12, 24));
  // gravel
  drawTile(ctx, TILES.gravel, (c) => grain(c, 0, 0, 0x8f8880, 48, 25));

  // ores: stone base + colored speckles
  const ore = (idx, color, seed) =>
    drawTile(ctx, idx, (c) => {
      grain(c, 0, 0, 0x888888, 30, seed);
      const r = rng(seed + 1);
      for (let i = 0; i < 8; i++) {
        const x = Math.floor(r() * 13) + 1;
        const y = Math.floor(r() * 13) + 1;
        c.fillStyle = color;
        c.fillRect(x, y, 2, 2);
      }
    });
  ore(TILES.coal, "#222", 26);
  ore(TILES.iron, "#d8a06a", 27);
  ore(TILES.gold, "#f3d34a", 28);
  ore(TILES.diamond, "#5ef1e0", 29);

  // pumpkin
  drawTile(ctx, TILES.pumpkin_side, (c) => {
    grain(c, 0, 0, 0xe08a1e, 20, 30);
    c.fillStyle = shade(0xb56b12, 0);
    for (let x = 2; x < TILE_PX; x += 4) c.fillRect(x, 0, 1, TILE_PX);
  });
  drawTile(ctx, TILES.pumpkin_top, (c) => {
    grain(c, 0, 0, 0xd07d18, 18, 31);
    c.fillStyle = "#5a7d22";
    c.fillRect(6, 6, 4, 4);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// UV rectangle for a tile, slightly inset to avoid bleeding between neighbors.
export function tileUV(index) {
  const inset = 0.5 / ATLAS_PX;
  const col = index % ATLAS_TILES;
  const row = Math.floor(index / ATLAS_TILES);
  const s = 1 / ATLAS_TILES;
  const u0 = col * s + inset;
  const v1 = 1 - (row * s + inset);
  const u1 = (col + 1) * s - inset;
  const v0 = 1 - ((row + 1) * s - inset);
  return { u0, v0, u1, v1 };
}
