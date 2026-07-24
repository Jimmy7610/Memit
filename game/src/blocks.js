// Block definitions.
// Each block has an id, name, and the texture tile used for each face.
// Tile indices refer to the procedurally generated texture atlas (textures.js).

export const TILES = {
  grass_top: 0,
  grass_side: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  log_top: 5,
  log_side: 6,
  leaves: 7,
  planks: 8,
  cobble: 9,
  glass: 10,
  brick: 11,
  water: 12,
  bedrock: 13,
  snow: 14,
  gravel: 15,
  coal: 16,
  iron: 17,
  gold: 18,
  diamond: 19,
  pumpkin_side: 20,
  pumpkin_top: 21,
};

// faces order used by the mesher: [px, nx, py, ny, pz, nz]
// (px = +x, nx = -x, py = +y/top, ny = -y/bottom, pz = +z, nz = -z)
function uniform(t) {
  return [t, t, t, t, t, t];
}
function topSideBottom(top, side, bottom) {
  return [side, side, top, bottom, side, side];
}

export const BLOCKS = {
  0: { name: "air", solid: false, transparent: true },
  1: { name: "grass", faces: topSideBottom(TILES.grass_top, TILES.grass_side, TILES.dirt), solid: true },
  2: { name: "dirt", faces: uniform(TILES.dirt), solid: true },
  3: { name: "stone", faces: uniform(TILES.stone), solid: true },
  4: { name: "sand", faces: uniform(TILES.sand), solid: true },
  5: { name: "wood", faces: topSideBottom(TILES.log_top, TILES.log_side, TILES.log_top), solid: true },
  6: { name: "leaves", faces: uniform(TILES.leaves), solid: true, transparent: true },
  7: { name: "planks", faces: uniform(TILES.planks), solid: true },
  8: { name: "cobblestone", faces: uniform(TILES.cobble), solid: true },
  9: { name: "glass", faces: uniform(TILES.glass), solid: true, transparent: true },
  10: { name: "brick", faces: uniform(TILES.brick), solid: true },
  11: { name: "water", faces: uniform(TILES.water), solid: false, transparent: true, liquid: true },
  12: { name: "bedrock", faces: uniform(TILES.bedrock), solid: true, unbreakable: true },
  13: { name: "snow", faces: topSideBottom(TILES.snow, TILES.snow, TILES.dirt), solid: true },
  14: { name: "gravel", faces: uniform(TILES.gravel), solid: true },
  15: { name: "coal ore", faces: uniform(TILES.coal), solid: true },
  16: { name: "iron ore", faces: uniform(TILES.iron), solid: true },
  17: { name: "gold ore", faces: uniform(TILES.gold), solid: true },
  18: { name: "diamond ore", faces: uniform(TILES.diamond), solid: true },
  19: { name: "pumpkin", faces: topSideBottom(TILES.pumpkin_top, TILES.pumpkin_side, TILES.pumpkin_top), solid: true },
};

export const BLOCK_IDS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WOOD: 5,
  LEAVES: 6,
  PLANKS: 7,
  COBBLE: 8,
  GLASS: 9,
  BRICK: 10,
  WATER: 11,
  BEDROCK: 12,
  SNOW: 13,
  GRAVEL: 14,
  COAL: 15,
  IRON: 16,
  GOLD: 17,
  DIAMOND: 18,
  PUMPKIN: 19,
};

export function isSolid(id) {
  const b = BLOCKS[id];
  return b ? !!b.solid : false;
}
export function isTransparent(id) {
  const b = BLOCKS[id];
  return b ? !!b.transparent || id === 0 : true;
}
export function isLiquid(id) {
  const b = BLOCKS[id];
  return b ? !!b.liquid : false;
}
