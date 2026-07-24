# VoxelCraft 🧱

A fully playable, Minecraft-like voxel game that runs in the browser. Built from
scratch with [Three.js](https://threejs.org/) — no game engine, no asset files
(every texture is generated procedurally at runtime).

![type: browser game](https://img.shields.io/badge/type-browser%20game-3aa0ff)
![engine: three.js](https://img.shields.io/badge/engine-three.js-000)

## Features

- **Infinite procedural world** — chunk-based terrain from layered Perlin noise:
  rolling hills, mountains, oceans, sandy beaches, snow-capped peaks.
- **Real voxel rendering** — per-chunk meshing with face culling and baked
  **ambient occlusion** for that soft, blocky Minecraft look.
- **Build & mine** — break any block (left-click / ⛏) and place from a 10-slot
  **hotbar** (right-click / ▲). Breaking blocks throws little particles.
- **20 block types** — grass, dirt, stone, sand, wood, leaves, planks,
  cobblestone, glass, brick, water, bedrock, snow, gravel, coal/iron/gold/diamond
  ore, pumpkin — all procedurally textured.
- **Trees & ores** — forests dot the grasslands; ores are buried by depth
  (diamonds run deep).
- **Physics** — gravity, jumping, AABB collision, swimming, and a creative
  **fly mode** (`F`).
- **Day / night cycle** — a moving sun & moon, a gradient sky dome, dynamic
  lighting and fog, plus an underwater tint when you dive.
- **Fully responsive** — desktop (pointer-lock mouse-look + keyboard) **and**
  mobile (on-screen joystick, drag-to-look, and touch action buttons).
- **Auto-save** — your world (terrain edits + position) persists in
  `localStorage`. Press `G` to save manually, or start a **New World**.

## Run it

The game uses ES modules, so it must be served over HTTP (opening `index.html`
directly with `file://` won't work). A tiny zero-dependency server is included:

```bash
cd game
node server.js
# then open http://localhost:5173
```

Any static server works just as well, e.g. `npx serve` or
`python3 -m http.server`.

> Needs an internet connection on first load: Three.js is loaded from a CDN via
> an import map (see `index.html`).

## Controls

### Desktop
| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Look | Mouse (click to capture) |
| Jump | `Space` |
| Sprint | `Shift` |
| Mine block | Left-click |
| Place block | Right-click |
| Select block | `1`–`0` or scroll wheel |
| Toggle fly | `F` |
| Save | `G` |

### Mobile
- **Left joystick** — move
- **Drag anywhere on the right** — look around
- **⛏ / ▲ / ⤴ / ✈** buttons — mine, place, jump, fly

## How it works

```
game/
├── index.html        # HUD, styles, mobile UI, Three.js import map
└── src/
    ├── main.js        # scene, lights, sky, day/night, hotbar, save/load, loop
    ├── world.js       # chunk storage, terrain generation, mesher (+ AO)
    ├── player.js      # physics, AABB collision, voxel DDA raycasting
    ├── controls.js    # desktop + mobile/touch input
    ├── blocks.js      # block + face-texture definitions
    ├── textures.js    # procedural texture atlas (drawn on a canvas)
    └── noise.js       # seedable Perlin / fBm noise
```

The core engine (generation, meshing, raycasting, collision) is covered by
headless logic tests during development.

## License

MIT
