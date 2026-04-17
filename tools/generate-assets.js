#!/usr/bin/env node
'use strict';

/**
 * generate-assets.js
 *
 * Generates all placeholder PNG sprite-sheets, atlas PNGs + JSONs, and
 * assets/asset-manifest.json for "That One Game".
 *
 * Run:  node tools/generate-assets.js
 *
 * Outputs (deterministic, safe to re-run):
 *   assets/spritesheets/rw/*.png
 *   assets/spritesheets/gw/*.png
 *   assets/atlas/rw/atlas_rw_world.{png,json}
 *   assets/atlas/rw/atlas_rw_ui.{png,json}
 *   assets/atlas/gw/atlas_gw_world.{png,json}
 *   assets/atlas/gw/atlas_gw_ui.{png,json}
 *   assets/asset-manifest.json
 */

const { createCanvas } = require('canvas');
const fs   = require('fs');
const path = require('path');

// ─── PATHS ────────────────────────────────────────────────────────────────────
const ROOT       = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets');
const SS_RW      = path.join(ASSETS_DIR, 'spritesheets', 'rw');
const SS_GW      = path.join(ASSETS_DIR, 'spritesheets', 'gw');
const ATLAS_RW   = path.join(ASSETS_DIR, 'atlas', 'rw');
const ATLAS_GW   = path.join(ASSETS_DIR, 'atlas', 'gw');

// ─── SPRITE-SHEET SPEC ───────────────────────────────────────────────────────
const DIR_ROWS  = ['down', 'left', 'right', 'up'];   // Row 0-3
const ANIMS     = { idle: 4, walk: 8, run: 8, attack: 8 };
const FX_FRAMES = 8;

// ─── CHARACTER DEFINITIONS ───────────────────────────────────────────────────
/**
 * Each character definition:
 *   world     – 'rw' | 'gw'  (determines output subdir and style)
 *   style     – 'cartoon' | 'pixel'
 *   frameSize – 32 | 64
 *   body      – torso / suit colour
 *   head      – skin colour
 *   hair      – hair colour (also used as accent)
 *   eyes      – eye colour  (red for enemies)
 *   legs      – leg / trouser colour
 *   tie       – tie / detail colour (optional)
 *   boss      – true if boss-tier (gets a slightly different silhouette)
 */
const CHARS = {
  // ── Player ────────────────────────────────────────────────────────────────
  player_rw: {
    world: 'rw', style: 'cartoon', frameSize: 32,
    body: '#2277DD', head: '#FFCC99', hair: '#FF6600',
    eyes: '#333333', legs: '#4444AA', tie: null,
  },
  player_gw: {
    world: 'gw', style: 'pixel', frameSize: 32,
    body: '#2277DD', head: '#FFCC99', hair: '#FF6600',
    eyes: '#333333', legs: '#4444AA', tie: null,
  },
  // ── Regular enemies ───────────────────────────────────────────────────────
  enemy_intern: {
    world: 'gw', style: 'pixel', frameSize: 32,
    body: '#AAAAAA', head: '#FFCC99', hair: '#555555',
    eyes: '#FF0000', legs: '#888888', tie: '#CC0000',
  },
  enemy_hr: {
    world: 'gw', style: 'pixel', frameSize: 32,
    body: '#CC4488', head: '#FFCC99', hair: '#881133',
    eyes: '#FF0000', legs: '#AA2266', tie: '#FF88BB',
  },
  enemy_dev: {
    world: 'gw', style: 'pixel', frameSize: 32,
    body: '#33AA33', head: '#FFCC99', hair: '#115511',
    eyes: '#FF0000', legs: '#226622', tie: '#88FF44',
  },
  enemy_security: {
    world: 'gw', style: 'pixel', frameSize: 32,
    body: '#111122', head: '#FFCC99', hair: '#000000',
    eyes: '#FF0000', legs: '#080815', tie: '#FF0000',
  },
  enemy_accountant: {
    world: 'gw', style: 'pixel', frameSize: 32,
    body: '#774400', head: '#FFCC99', hair: '#442200',
    eyes: '#FF0000', legs: '#553300', tie: '#FFCC00',
  },
  // ── Mini-boss VP (32×32) ──────────────────────────────────────────────────
  miniboss_vp: {
    world: 'gw', style: 'pixel', frameSize: 32,
    body: '#111166', head: '#FFCC99', hair: '#000033',
    eyes: '#FF0000', legs: '#0A0A44', tie: '#FFCC00', boss: true,
  },
  // ── Boss CEO (64×64) ──────────────────────────────────────────────────────
  boss_ceo: {
    world: 'gw', style: 'pixel', frameSize: 64,
    body: '#0A0A0A', head: '#CCAA88', hair: '#000000',
    eyes: '#FF0000', legs: '#050505', tie: '#CC0000', boss: true,
  },
};

// ─── FX DEFINITIONS ──────────────────────────────────────────────────────────
const FX_DEFS = {
  fx_hitspark:   { colors: ['#FFFF44','#FFAA00','#FF4400','#CC0000'], shape: 'spark'   },
  fx_slasharc:   { colors: ['#FFFFFF','#CCDDFF','#88AAFF','#4466DD'], shape: 'arc'     },
  fx_projectile: { colors: ['#00FFFF','#00AAFF','#0055FF','#002299'], shape: 'orb'     },
  fx_pickup:     { colors: ['#FFFF88','#FFCCFF','#FF88FF','#AA44FF'], shape: 'sparkle' },
};

// ─── ATLAS FRAME DEFINITIONS ─────────────────────────────────────────────────
// Each entry: { name, w, h, color, shape, detail }
//   shape  – hint for the placeholder drawing routine
//   detail – accent / line colour

const ATLAS_RW_WORLD_FRAMES = [
  // Buildings
  { name: 'building_office',     w: 64, h: 96,  color: '#CCE0FF', shape: 'building', detail: '#3366AA' },
  { name: 'building_shop',       w: 64, h: 80,  color: '#FFEEDD', shape: 'building', detail: '#CC6633' },
  { name: 'building_house',      w: 64, h: 64,  color: '#EEDDCC', shape: 'building', detail: '#885533' },
  { name: 'building_apartment',  w: 48, h: 96,  color: '#DDEECC', shape: 'building', detail: '#447733' },
  // Props
  { name: 'prop_desk',           w: 48, h: 32,  color: '#AA7755', shape: 'rect',     detail: '#774433' },
  { name: 'prop_chair',          w: 32, h: 32,  color: '#3355AA', shape: 'rect',     detail: '#112266' },
  { name: 'prop_computer',       w: 32, h: 32,  color: '#222244', shape: 'rect',     detail: '#00AAFF' },
  { name: 'prop_plant',          w: 32, h: 48,  color: '#33AA33', shape: 'rect',     detail: '#226622' },
  { name: 'prop_filing_cabinet', w: 32, h: 48,  color: '#AAAACC', shape: 'rect',     detail: '#666688' },
  { name: 'prop_coffee_machine', w: 32, h: 48,  color: '#333333', shape: 'rect',     detail: '#FF6600' },
  { name: 'prop_water_cooler',   w: 24, h: 48,  color: '#AADDFF', shape: 'rect',     detail: '#3399FF' },
  { name: 'prop_printer',        w: 48, h: 32,  color: '#CCCCCC', shape: 'rect',     detail: '#666666' },
  // Tiles
  { name: 'tile_floor_office',   w: 32, h: 32,  color: '#EEEEFF', shape: 'tile',     detail: '#CCCCEE' },
  { name: 'tile_floor_carpet',   w: 32, h: 32,  color: '#5566AA', shape: 'tile',     detail: '#3344AA' },
  { name: 'tile_wall_office',    w: 32, h: 32,  color: '#DDDDEE', shape: 'tile',     detail: '#BBBBCC' },
  { name: 'tile_floor_sidewalk', w: 32, h: 32,  color: '#CCCCBB', shape: 'tile',     detail: '#AAAAAA' },
  { name: 'tile_floor_road',     w: 32, h: 32,  color: '#444444', shape: 'tile',     detail: '#666666' },
  { name: 'tile_grass',          w: 32, h: 32,  color: '#44AA44', shape: 'tile',     detail: '#338833' },
  // Environmental
  { name: 'env_tree',            w: 48, h: 64,  color: '#226622', shape: 'tree',     detail: '#774422' },
  { name: 'env_streetlight',     w: 16, h: 64,  color: '#888866', shape: 'rect',     detail: '#FFFF88' },
  { name: 'env_bench',           w: 48, h: 32,  color: '#AA7744', shape: 'rect',     detail: '#774422' },
  { name: 'env_trash_can',       w: 24, h: 32,  color: '#555555', shape: 'rect',     detail: '#333333' },
  { name: 'env_mailbox',         w: 24, h: 32,  color: '#1133AA', shape: 'rect',     detail: '#0022AA' },
];

const ATLAS_RW_UI_FRAMES = [
  { name: 'ui_button_normal',    w: 120, h: 40,  color: '#4477FF', shape: 'button',  detail: '#FFFFFF' },
  { name: 'ui_button_hover',     w: 120, h: 40,  color: '#5599FF', shape: 'button',  detail: '#FFFFFF' },
  { name: 'ui_button_pressed',   w: 120, h: 40,  color: '#2255CC', shape: 'button',  detail: '#DDDDFF' },
  { name: 'ui_panel',            w: 200, h: 150, color: '#1A2244', shape: 'panel',   detail: '#3355AA' },
  { name: 'ui_panel_header',     w: 200, h: 40,  color: '#223366', shape: 'panel',   detail: '#4477CC' },
  { name: 'ui_health_bar_bg',    w: 100, h: 16,  color: '#442222', shape: 'bar',     detail: '#661111' },
  { name: 'ui_health_bar_fill',  w: 100, h: 16,  color: '#FF3333', shape: 'bar',     detail: '#FF6666' },
  { name: 'ui_icon_health',      w: 24,  h: 24,  color: '#FF3333', shape: 'icon',    detail: '#FF6666' },
  { name: 'ui_icon_stamina',     w: 24,  h: 24,  color: '#33FF33', shape: 'icon',    detail: '#66FF66' },
  { name: 'ui_icon_coin',        w: 24,  h: 24,  color: '#FFCC00', shape: 'icon',    detail: '#FFEE88' },
  { name: 'ui_icon_key',         w: 24,  h: 24,  color: '#FFAA44', shape: 'icon',    detail: '#FFCC88' },
  { name: 'ui_dialog_box',       w: 300, h: 80,  color: '#1A2244', shape: 'panel',   detail: '#3355AA' },
  { name: 'ui_cursor',           w: 32,  h: 32,  color: '#FFFFFF', shape: 'cursor',  detail: '#4477FF' },
  { name: 'ui_minimap_bg',       w: 128, h: 128, color: '#0A1122', shape: 'panel',   detail: '#1A2244' },
  { name: 'ui_minimap_player',   w: 8,   h: 8,   color: '#00FF88', shape: 'rect',    detail: '#00FF88' },
];

const ATLAS_GW_WORLD_FRAMES = [
  // Buildings (pixel, game world)
  { name: 'gw_building_server',  w: 64, h: 96,  color: '#112233', shape: 'building', detail: '#00AAFF' },
  { name: 'gw_building_arena',   w: 96, h: 96,  color: '#221133', shape: 'building', detail: '#AA00FF' },
  { name: 'gw_building_portal',  w: 48, h: 64,  color: '#003322', shape: 'building', detail: '#00FF88' },
  // Props
  { name: 'gw_prop_terminal',    w: 32, h: 48,  color: '#112244', shape: 'rect',     detail: '#00AAFF' },
  { name: 'gw_prop_chest',       w: 32, h: 32,  color: '#885500', shape: 'rect',     detail: '#FFCC00' },
  { name: 'gw_prop_barrel',      w: 24, h: 32,  color: '#553300', shape: 'rect',     detail: '#886644' },
  { name: 'gw_prop_crate',       w: 32, h: 32,  color: '#665533', shape: 'rect',     detail: '#998866' },
  { name: 'gw_prop_crystal',     w: 24, h: 32,  color: '#8800FF', shape: 'diamond',  detail: '#CC88FF' },
  // Items
  { name: 'item_sword',          w: 16, h: 32,  color: '#AAAAAA', shape: 'sword',    detail: '#CCCCCC' },
  { name: 'item_shield',         w: 24, h: 24,  color: '#3355AA', shape: 'shield',   detail: '#6688CC' },
  { name: 'item_potion_red',     w: 16, h: 24,  color: '#FF3333', shape: 'potion',   detail: '#FF6666' },
  { name: 'item_potion_blue',    w: 16, h: 24,  color: '#3333FF', shape: 'potion',   detail: '#6666FF' },
  { name: 'item_coin',           w: 16, h: 16,  color: '#FFCC00', shape: 'circle',   detail: '#FFEE88' },
  { name: 'item_key',            w: 16, h: 24,  color: '#FFAA44', shape: 'rect',     detail: '#FFCC88' },
  { name: 'item_badge',          w: 24, h: 24,  color: '#334455', shape: 'rect',     detail: '#FF0000' },
  { name: 'item_power_chip',     w: 16, h: 16,  color: '#001133', shape: 'rect',     detail: '#00AAFF' },
  // Tiles
  { name: 'gw_tile_floor_dungeon',  w: 32, h: 32, color: '#221122', shape: 'tile',   detail: '#332233' },
  { name: 'gw_tile_floor_circuit',  w: 32, h: 32, color: '#001122', shape: 'tile',   detail: '#002244' },
  { name: 'gw_tile_wall_dungeon',   w: 32, h: 32, color: '#332233', shape: 'tile',   detail: '#443344' },
  { name: 'gw_tile_wall_circuit',   w: 32, h: 32, color: '#112233', shape: 'tile',   detail: '#223355' },
  { name: 'gw_tile_floor_boss',     w: 32, h: 32, color: '#110011', shape: 'tile',   detail: '#330022' },
  // Environmental
  { name: 'gw_env_pillar',      w: 32, h: 48,  color: '#334455', shape: 'rect',     detail: '#556677' },
  { name: 'gw_env_spike',       w: 32, h: 32,  color: '#AA2222', shape: 'diamond',  detail: '#FF3333' },
  { name: 'gw_env_portal_ring', w: 48, h: 48,  color: '#8800FF', shape: 'ring',     detail: '#CC88FF' },
  { name: 'gw_env_data_stream', w: 16, h: 64,  color: '#00FF88', shape: 'rect',     detail: '#00FFCC' },
];

const ATLAS_GW_UI_FRAMES = [
  { name: 'gw_ui_button_normal',    w: 120, h: 40,  color: '#220033', shape: 'button',  detail: '#AA00FF' },
  { name: 'gw_ui_button_hover',     w: 120, h: 40,  color: '#330044', shape: 'button',  detail: '#CC44FF' },
  { name: 'gw_ui_button_pressed',   w: 120, h: 40,  color: '#110022', shape: 'button',  detail: '#8800DD' },
  { name: 'gw_ui_panel',            w: 200, h: 150, color: '#0A0022', shape: 'panel',   detail: '#220055' },
  { name: 'gw_ui_health_bar_bg',    w: 100, h: 16,  color: '#330000', shape: 'bar',     detail: '#440000' },
  { name: 'gw_ui_health_bar_fill',  w: 100, h: 16,  color: '#FF0033', shape: 'bar',     detail: '#FF4466' },
  { name: 'gw_ui_energy_bar_bg',    w: 100, h: 16,  color: '#001133', shape: 'bar',     detail: '#002244' },
  { name: 'gw_ui_energy_bar_fill',  w: 100, h: 16,  color: '#0099FF', shape: 'bar',     detail: '#44BBFF' },
  { name: 'gw_ui_icon_hp',          w: 24,  h: 24,  color: '#FF0033', shape: 'icon',    detail: '#FF4466' },
  { name: 'gw_ui_icon_mp',          w: 24,  h: 24,  color: '#0099FF', shape: 'icon',    detail: '#44BBFF' },
  { name: 'gw_ui_icon_exp',         w: 24,  h: 24,  color: '#FFCC00', shape: 'icon',    detail: '#FFEE88' },
  { name: 'gw_ui_icon_gold',        w: 24,  h: 24,  color: '#FFAA00', shape: 'icon',    detail: '#FFCC44' },
  { name: 'gw_ui_dialog_box',       w: 300, h: 80,  color: '#0A0022', shape: 'panel',   detail: '#220055' },
  { name: 'gw_ui_cursor',           w: 32,  h: 32,  color: '#AA00FF', shape: 'cursor',  detail: '#CC88FF' },
  { name: 'gw_ui_minimap_bg',       w: 128, h: 128, color: '#050011', shape: 'panel',   detail: '#110033' },
  { name: 'gw_ui_hud_frame',        w: 256, h: 64,  color: '#0A0022', shape: 'panel',   detail: '#330066' },
  { name: 'gw_ui_level_up_banner',  w: 200, h: 48,  color: '#220044', shape: 'panel',   detail: '#FF44FF' },
];

// ─── UTILITY ─────────────────────────────────────────────────────────────────

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function savePNG(canvas, filePath) {
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buf);
  console.log('  wrote', path.relative(path.join(__dirname, '..'), filePath));
}

// ─── CHARACTER DRAWING ───────────────────────────────────────────────────────

/**
 * Compute per-frame animation offsets.
 * Returns { bodyDY, legToggle, strikePhase }
 */
function animOffsets(animName, frameIdx, p) {
  const pat4 = [0, -p * 0.25, -p * 0.5, -p * 0.25];
  if (animName === 'idle') {
    return { bodyDY: pat4[frameIdx % 4], legToggle: false, strikePhase: false };
  }
  if (animName === 'walk') {
    return { bodyDY: (frameIdx % 2) * (-p * 0.5), legToggle: frameIdx % 2 === 1, strikePhase: false };
  }
  if (animName === 'run') {
    return { bodyDY: (frameIdx % 2) * (-p), legToggle: frameIdx % 2 === 1, strikePhase: false };
  }
  if (animName === 'attack') {
    const strike = frameIdx >= 4;
    return { bodyDY: strike ? -p * 0.25 : 0, legToggle: false, strikePhase: strike };
  }
  return { bodyDY: 0, legToggle: false, strikePhase: false };
}

/**
 * Draw one pixel-art character frame at canvas pixel offset (ox, oy).
 * sz = frameSize (32 or 64).
 */
function drawPixelChar(ctx, char, dir, animName, frameIdx, ox, oy, sz) {
  const p  = sz >= 64 ? 8 : 4;          // one "logical pixel" in actual pixels
  const { bodyDY, legToggle, strikePhase } = animOffsets(animName, frameIdx, p);
  const snap = (v) => Math.round(v / p) * p;
  const bdy  = snap(bodyDY);

  // Layout (in actual pixels within the sz×sz frame)
  const headW = 2 * p, headH = 2 * p;
  const bodyW = 3 * p, bodyH = 2 * p;
  const legW  = p,     legH  = 2 * p;

  const headX = snap((sz - headW) / 2);
  const headY = p + bdy;
  const bodyX = snap((sz - bodyW) / 2);
  const bodyY = headY + headH;
  const legY  = bodyY + bodyH;

  const fill = (x, y, w, h, color) => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(ox + Math.round(x), oy + Math.round(y),
                 Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  };

  // Shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(ox + sz / 2, oy + sz - p * 0.4, sz * 0.28, p * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Legs
  if (dir === 'left' || dir === 'right') {
    fill(bodyX + p * 0.5, legY, bodyW - p, legH, char.legs);
  } else {
    const l1DY = legToggle ? p * 0.5 : 0;
    const l2DY = legToggle ? 0 : p * 0.5;
    fill(bodyX,                  legY + l1DY, legW, legH - l1DY, char.legs);
    fill(bodyX + bodyW - legW,   legY + l2DY, legW, legH - l2DY, char.legs);
  }

  // Body
  if (dir === 'left' || dir === 'right') {
    fill(bodyX + p * 0.25, bodyY, bodyW - p * 0.5, bodyH, char.body);
  } else {
    fill(bodyX, bodyY, bodyW, bodyH, char.body);
  }
  // Tie stripe
  if (char.tie) {
    fill(bodyX + snap(bodyW * 0.38), bodyY, p * 0.5, bodyH, char.tie);
  }

  // Boss crown / aura indicator (extra decoration for boss-tier characters)
  if (char.boss && sz >= 32) {
    const crownW = p, crownH = p * 0.5;
    fill(headX + headW * 0.25, headY - crownH, crownW, crownH, char.tie || char.hair);
    fill(headX + headW * 0.75 - crownW * 0.5, headY - crownH, crownW, crownH, char.tie || char.hair);
  }

  // Attack arm
  if (animName === 'attack') {
    const armW = p * 1.5, armH = p;
    const armY = bodyY + p * 0.5;
    if (strikePhase) {
      let armX;
      if (dir === 'left')        armX = bodyX - armW;
      else if (dir === 'right')  armX = bodyX + bodyW;
      else                       armX = bodyX + bodyW;   // down / up
      fill(armX, armY, armW, armH, char.head);
      // Weapon tip (bright accent)
      const wpX = dir === 'left' ? armX - p * 0.5 : armX + armW;
      fill(wpX, armY - p * 0.5, p * 0.5, armH * 2, char.hair);
    } else {
      // Wind-up: arm on opposite side
      let armX;
      if (dir === 'left')        armX = bodyX + bodyW;
      else                       armX = bodyX - p * 1.5;
      fill(armX, armY, armW, armH, char.head);
    }
  }

  // Head
  fill(headX, headY, headW, headH, char.head);
  // Hair (top half)
  fill(headX, headY, headW, Math.max(p * 0.5, Math.round(headH * 0.4)), char.hair);

  // Eyes
  const eyeSize = Math.max(1, Math.round(p * 0.5));
  const eyeY    = headY + Math.round(headH * 0.55);
  if (dir === 'down') {
    fill(headX + Math.round(p * 0.3), eyeY, eyeSize, eyeSize, char.eyes);
    fill(headX + headW - Math.round(p * 0.3) - eyeSize, eyeY, eyeSize, eyeSize, char.eyes);
  } else if (dir === 'left') {
    fill(headX + Math.round(p * 0.3), eyeY, eyeSize, eyeSize, char.eyes);
  } else if (dir === 'right') {
    fill(headX + headW - Math.round(p * 0.3) - eyeSize, eyeY, eyeSize, eyeSize, char.eyes);
  }
  // dir === 'up': no eyes visible

  // Direction indicator: small teal dot at edge of frame
  ctx.save();
  ctx.fillStyle = 'rgba(0,255,160,0.55)';
  ctx.beginPath();
  const dr = Math.max(1.5, p * 0.35);
  let dx = ox + sz * 0.5, dy = oy + sz * 0.5;
  if (dir === 'down')  dy = oy + sz - dr - 1;
  if (dir === 'up')    dy = oy + dr + 1;
  if (dir === 'left')  dx = ox + dr + 1;
  if (dir === 'right') dx = ox + sz - dr - 1;
  ctx.arc(dx, dy, dr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw one cartoon-style character frame at (ox, oy).
 * Uses smooth arcs instead of pixel blocks.
 */
function drawCartoonChar(ctx, char, dir, animName, frameIdx, ox, oy, sz) {
  const u = sz / 32;
  const p = 4 * u;
  const { bodyDY, legToggle, strikePhase } = animOffsets(animName, frameIdx, p);

  const bodyW = 12 * u, bodyH = 10 * u;
  const bodyX = (sz - bodyW) / 2;
  const bodyY = sz * 0.45 + bodyDY;
  const headR  = 6.5 * u;
  const headCX = sz * 0.5;
  const headCY = bodyY - headR;
  const legW = 4.5 * u, legH = 8 * u;
  const legY = bodyY + bodyH;

  const fillRect = (x, y, w, h, color) => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(ox + x, oy + y, w, h);
  };
  const fillCircle = (cx, cy, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ox + cx, oy + cy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // Shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(ox + sz * 0.5, oy + sz - 2 * u, sz * 0.28, 2.5 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Legs
  if (dir === 'left' || dir === 'right') {
    fillRect(bodyX + legW * 0.5, legY, bodyW - legW, legH, char.legs);
  } else {
    const l1DY = legToggle ? p * 0.5 : 0;
    const l2DY = legToggle ? 0 : p * 0.5;
    fillRect(bodyX + u,            legY + l1DY, legW, legH - l1DY, char.legs);
    fillRect(bodyX + bodyW - legW - u, legY + l2DY, legW, legH - l2DY, char.legs);
  }

  // Body (rounded rect approximated as rect)
  fillRect(bodyX, bodyY, bodyW, bodyH, char.body);
  // Tie
  if (char.tie) {
    fillRect(bodyX + bodyW * 0.42, bodyY, 2 * u, bodyH, char.tie);
  }

  // Attack arm
  if (animName === 'attack') {
    const armW = 9 * u, armH = 4 * u;
    const armY = bodyY + bodyH * 0.2;
    if (strikePhase) {
      let armX = dir === 'left' ? bodyX - armW : bodyX + bodyW;
      fillRect(armX, armY, armW, armH, char.head);
      const wpX = dir === 'left' ? armX - p * 0.5 : armX + armW;
      fillRect(wpX, armY - p * 0.4, p * 0.4, armH * 2, char.hair);
    } else {
      let armX = dir === 'left' ? bodyX + bodyW : bodyX - 9 * u;
      fillRect(armX, armY, armW, armH, char.head);
    }
  }

  // Head
  fillCircle(headCX, headCY, headR, char.head);
  // Hair (upper half arc)
  ctx.save();
  ctx.fillStyle = char.hair;
  ctx.beginPath();
  ctx.arc(ox + headCX, oy + headCY, headR, Math.PI, 2 * Math.PI);
  ctx.fill();
  ctx.restore();

  // Eyes
  if (dir !== 'up') {
    const eyeR = Math.max(1.5, 1.5 * u);
    const eyeY = headCY + headR * 0.35;
    if (dir === 'down') {
      fillCircle(headCX - headR * 0.38, eyeY, eyeR, char.eyes);
      fillCircle(headCX + headR * 0.38, eyeY, eyeR, char.eyes);
    } else if (dir === 'left') {
      fillCircle(headCX - headR * 0.3, eyeY, eyeR, char.eyes);
    } else {
      fillCircle(headCX + headR * 0.3, eyeY, eyeR, char.eyes);
    }
  }

  // Direction dot
  ctx.save();
  ctx.fillStyle = 'rgba(0,255,160,0.55)';
  ctx.beginPath();
  const dr = Math.max(1.5, 2 * u);
  let dx = ox + sz * 0.5, dy = oy + sz * 0.5;
  if (dir === 'down')  dy = oy + sz - dr - 1;
  if (dir === 'up')    dy = oy + dr + 1;
  if (dir === 'left')  dx = ox + dr + 1;
  if (dir === 'right') dx = ox + sz - dr - 1;
  ctx.arc(dx, dy, dr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw one character frame – dispatches to pixel or cartoon renderer.
 */
function drawCharFrame(ctx, char, dir, animName, frameIdx, ox, oy, sz) {
  if (char.style === 'pixel') {
    drawPixelChar(ctx, char, dir, animName, frameIdx, ox, oy, sz);
  } else {
    drawCartoonChar(ctx, char, dir, animName, frameIdx, ox, oy, sz);
  }
}

// ─── FX DRAWING ──────────────────────────────────────────────────────────────

/**
 * Draw one FX frame at (ox, oy) on a 32×32 cell.
 * frame 0 = start, 7 = end.
 */
function drawFxFrame(ctx, fxDef, frameIdx, ox, oy) {
  const sz    = 32;
  const t     = frameIdx / (FX_FRAMES - 1);   // 0..1
  const tinv  = 1 - t;
  const cx    = ox + sz * 0.5, cy = oy + sz * 0.5;
  const col   = fxDef.colors[Math.min(frameIdx, fxDef.colors.length - 1)];

  ctx.save();

  switch (fxDef.shape) {
    case 'spark': {
      // Expanding burst of lines
      const numRays = 6;
      const maxR    = sz * 0.45 * t;
      ctx.strokeStyle = col;
      ctx.lineWidth   = Math.max(1, 2 * tinv);
      ctx.globalAlpha = tinv * 0.9 + 0.1;
      for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        const r0    = maxR * 0.2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
        ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
        ctx.stroke();
      }
      // Center flash
      ctx.fillStyle  = fxDef.colors[0];
      ctx.globalAlpha = tinv * 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, sz * 0.12 * tinv, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'arc': {
      // Growing + fading slash arc
      const maxR = sz * 0.4;
      const r    = maxR * Math.min(1, t * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth   = Math.max(1, 4 * tinv);
      ctx.globalAlpha = tinv;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI * 0.75, Math.PI * 0.25);
      ctx.stroke();
      break;
    }
    case 'orb': {
      // Glowing projectile with trail
      const posX = ox + sz * 0.1 + sz * 0.8 * t;
      ctx.globalAlpha = 0.9;
      // Trail
      ctx.fillStyle = fxDef.colors[2];
      ctx.globalAlpha = tinv * 0.5;
      ctx.fillRect(ox + sz * 0.1, cy - 3, sz * 0.8 * t, 4);
      // Core
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(posX + 4, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sparkle': {
      // Growing / fading star points
      const numPts = 4;
      const maxR   = sz * 0.4 * Math.sin(t * Math.PI);
      ctx.fillStyle   = col;
      ctx.globalAlpha = Math.sin(t * Math.PI);
      for (let i = 0; i < numPts; i++) {
        const a  = (i / numPts) * Math.PI * 2;
        const px = cx + Math.cos(a) * maxR;
        const py = cy + Math.sin(a) * maxR;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1, 2 * Math.sin(t * Math.PI)), 0, Math.PI * 2);
        ctx.fill();
      }
      // Center
      ctx.fillStyle = fxDef.colors[0];
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, 3 * Math.sin(t * Math.PI)), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      ctx.fillStyle = col;
      ctx.globalAlpha = tinv;
      ctx.fillRect(ox + 4, oy + 4, sz - 8, sz - 8);
  }

  ctx.restore();
}

// ─── ATLAS FRAME DRAWING ─────────────────────────────────────────────────────

/**
 * Draw one atlas placeholder frame at (ox, oy) with given w × h dimensions.
 */
function drawAtlasFrame(ctx, frame, ox, oy) {
  const { w, h, color, detail, shape, name } = frame;

  ctx.save();

  switch (shape) {
    case 'building': {
      // Main structure
      ctx.fillStyle = color;
      ctx.fillRect(ox + 2, oy + h * 0.25, w - 4, h * 0.75 - 2);
      // Roof
      ctx.fillStyle = detail;
      ctx.fillRect(ox + 2, oy + 2, w - 4, h * 0.25);
      // Windows (2×2 grid)
      const winColor = detail + 'CC';
      const cols = 2, rows = 2;
      const winW = Math.max(4, Math.floor((w - 8) / (cols * 1.5)));
      const winH = Math.max(4, Math.floor((h * 0.5) / (rows * 1.5)));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = ox + 4 + c * (winW + 4);
          const wy = oy + h * 0.35 + r * (winH + 4);
          ctx.fillStyle = winColor;
          ctx.fillRect(wx, wy, winW, winH);
        }
      }
      break;
    }
    case 'tile': {
      ctx.fillStyle = color;
      ctx.fillRect(ox, oy, w, h);
      ctx.strokeStyle = detail;
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + 1, oy + 1, w - 2, h - 2);
      // Cross lines
      ctx.beginPath();
      ctx.moveTo(ox + w * 0.5, oy);
      ctx.lineTo(ox + w * 0.5, oy + h);
      ctx.moveTo(ox, oy + h * 0.5);
      ctx.lineTo(ox + w, oy + h * 0.5);
      ctx.stroke();
      break;
    }
    case 'tree': {
      // Trunk
      ctx.fillStyle = detail;
      ctx.fillRect(ox + w * 0.38, oy + h * 0.6, w * 0.24, h * 0.4);
      // Canopy (layered circles)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ox + w * 0.5, oy + h * 0.55, w * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ox + w * 0.5, oy + h * 0.38, w * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'button': {
      // Background fill
      ctx.fillStyle = color;
      ctx.fillRect(ox + 2, oy + 2, w - 4, h - 4);
      // Border
      ctx.strokeStyle = detail;
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + 2, oy + 2, w - 4, h - 4);
      // Highlight line
      ctx.strokeStyle = detail + '88';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox + 4, oy + 4);
      ctx.lineTo(ox + w - 4, oy + 4);
      ctx.stroke();
      break;
    }
    case 'panel': {
      ctx.fillStyle = color;
      ctx.fillRect(ox + 1, oy + 1, w - 2, h - 2);
      ctx.strokeStyle = detail;
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + 1, oy + 1, w - 2, h - 2);
      // Inner border
      ctx.strokeStyle = detail + '66';
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + 4, oy + 4, w - 8, h - 8);
      break;
    }
    case 'bar': {
      ctx.fillStyle = color;
      ctx.fillRect(ox, oy, w, h);
      ctx.fillStyle = detail;
      ctx.fillRect(ox, oy, w * 0.7, h);
      ctx.strokeStyle = detail;
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + 0.5, oy + 0.5, w - 1, h - 1);
      break;
    }
    case 'icon': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ox + w * 0.5, oy + h * 0.5, Math.min(w, h) * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = detail;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'cursor': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ox + 4,     oy + 4);
      ctx.lineTo(ox + 4,     oy + h - 4);
      ctx.lineTo(ox + w * 0.5, oy + h * 0.65);
      ctx.lineTo(ox + w - 4, oy + h - 4);
      ctx.lineTo(ox + w * 0.6, oy + h * 0.6);
      ctx.lineTo(ox + w - 4, oy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = detail;
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case 'diamond': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ox + w * 0.5, oy + 2);
      ctx.lineTo(ox + w - 2,   oy + h * 0.5);
      ctx.lineTo(ox + w * 0.5, oy + h - 2);
      ctx.lineTo(ox + 2,       oy + h * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = detail;
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case 'ring': {
      ctx.strokeStyle = color;
      ctx.lineWidth   = 5;
      ctx.beginPath();
      ctx.arc(ox + w * 0.5, oy + h * 0.5, Math.min(w, h) * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = detail;
      ctx.lineWidth   = 2;
      ctx.stroke();
      break;
    }
    case 'sword': {
      // Blade
      ctx.fillStyle = color;
      ctx.fillRect(ox + w * 0.38, oy + 2, w * 0.24, h * 0.75);
      // Guard
      ctx.fillStyle = detail;
      ctx.fillRect(ox + 2, oy + h * 0.7, w - 4, h * 0.08);
      // Handle
      ctx.fillStyle = '#AA7744';
      ctx.fillRect(ox + w * 0.38, oy + h * 0.78, w * 0.24, h * 0.2);
      break;
    }
    case 'shield': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ox + w * 0.5, oy + 2);
      ctx.lineTo(ox + w - 2, oy + h * 0.45);
      ctx.quadraticCurveTo(ox + w - 2, oy + h - 2, ox + w * 0.5, oy + h - 2);
      ctx.quadraticCurveTo(ox + 2, oy + h - 2, ox + 2, oy + h * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = detail;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'potion': {
      // Bottle body
      ctx.fillStyle = color + 'CC';
      ctx.beginPath();
      ctx.arc(ox + w * 0.5, oy + h * 0.65, w * 0.38, 0, Math.PI * 2);
      ctx.fill();
      // Neck
      ctx.fillStyle = detail + '99';
      ctx.fillRect(ox + w * 0.3, oy + h * 0.1, w * 0.4, h * 0.3);
      // Cork
      ctx.fillStyle = '#AA8844';
      ctx.fillRect(ox + w * 0.3, oy + 2, w * 0.4, h * 0.12);
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(ox + w * 0.38, oy + h * 0.55, w * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'circle': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ox + w * 0.5, oy + h * 0.5, Math.min(w, h) * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = detail;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    default: { // 'rect' and fallback
      ctx.fillStyle = color;
      ctx.fillRect(ox + 1, oy + 1, w - 2, h - 2);
      ctx.strokeStyle = detail;
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + 1, oy + 1, w - 2, h - 2);
      break;
    }
  }

  ctx.restore();
}

// ─── SPRITESHEET GENERATION ──────────────────────────────────────────────────

/**
 * Generate one spritesheet PNG for a given character + animation combo.
 * Returns { key, path, frameWidth, frameHeight, cols, rows }
 */
function generateCharSheet(charId, char, animName, numFrames, outputDir) {
  const sz   = char.frameSize;
  const cols = numFrames;
  const rows = DIR_ROWS.length;
  const canvas = createCanvas(cols * sz, rows * sz);
  const ctx    = canvas.getContext('2d');

  // Transparent background (default for canvas)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Optional: light checkerboard to confirm transparency visually (skip for real output)

  for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
    const dir = DIR_ROWS[rowIdx];
    for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
      const ox = frameIdx * sz;
      const oy = rowIdx  * sz;
      drawCharFrame(ctx, char, dir, animName, frameIdx, ox, oy, sz);
    }
  }

  const key      = `${charId}_${animName}`;
  const fileName = `${key}.png`;
  const filePath = path.join(outputDir, fileName);
  savePNG(canvas, filePath);

  return {
    key,
    path:        `assets/spritesheets/${char.world}/${fileName}`,
    frameWidth:  sz,
    frameHeight: sz,
  };
}

/**
 * Generate one FX spritesheet (single row, 8 frames, 32×32 each).
 */
function generateFxSheet(fxId, fxDef, outputDir) {
  const sz     = 32;
  const canvas = createCanvas(FX_FRAMES * sz, sz);
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let f = 0; f < FX_FRAMES; f++) {
    drawFxFrame(ctx, fxDef, f, f * sz, 0);
  }

  const fileName = `${fxId}.png`;
  const filePath = path.join(outputDir, fileName);
  savePNG(canvas, filePath);

  return {
    key:         fxId,
    path:        `assets/spritesheets/gw/${fileName}`,
    frameWidth:  sz,
    frameHeight: sz,
  };
}

// ─── ATLAS GENERATION ────────────────────────────────────────────────────────

const ATLAS_PADDING = 2;

/**
 * Simple greedy row packer.
 * Returns array of { name, w, h, x, y } and atlas { width, height }.
 */
function packFrames(frames, maxWidth) {
  let x = ATLAS_PADDING, y = ATLAS_PADDING, rowH = 0;
  const packed = [];

  for (const f of frames) {
    if (x + f.w + ATLAS_PADDING > maxWidth && x > ATLAS_PADDING) {
      x = ATLAS_PADDING;
      y += rowH + ATLAS_PADDING;
      rowH = 0;
    }
    packed.push({ ...f, x, y });
    x   += f.w + ATLAS_PADDING;
    rowH = Math.max(rowH, f.h);
  }

  const totalH = y + rowH + ATLAS_PADDING;
  return {
    frames:        packed,
    atlasWidth:  nextPow2(maxWidth),
    atlasHeight: nextPow2(totalH),
  };
}

/**
 * Build Phaser-compatible TexturePacker "hash" JSON for an atlas.
 */
function buildAtlasJson(packedFrames, atlasWidth, atlasHeight, imageName) {
  const frames = {};
  for (const f of packedFrames) {
    frames[f.name] = {
      frame:           { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated:         false,
      trimmed:         false,
      spriteSourceSize:{ x: 0, y: 0, w: f.w, h: f.h },
      sourceSize:      { w: f.w, h: f.h },
    };
  }
  return {
    frames,
    meta: {
      app:     'asset-generator',
      version: '1.0',
      image:   imageName,
      format:  'RGBA8888',
      size:    { w: atlasWidth, h: atlasHeight },
      scale:   '1',
    },
  };
}

/**
 * Generate one atlas (PNG + JSON) and return the manifest entry.
 */
function generateAtlas(atlasId, framesDefs, outputDir, relDir) {
  const maxWidth  = 512;
  const { frames: packed, atlasWidth, atlasHeight } = packFrames(framesDefs, maxWidth);

  const canvas = createCanvas(atlasWidth, atlasHeight);
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, atlasWidth, atlasHeight);

  for (const f of packed) {
    drawAtlasFrame(ctx, f, f.x, f.y);
  }

  const pngFile  = `${atlasId}.png`;
  const jsonFile = `${atlasId}.json`;
  const pngPath  = path.join(outputDir, pngFile);
  const jsonPath = path.join(outputDir, jsonFile);

  savePNG(canvas, pngPath);

  const json = buildAtlasJson(packed, atlasWidth, atlasHeight, pngFile);
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));
  console.log('  wrote', path.relative(path.join(__dirname, '..'), jsonPath));

  return {
    key:  atlasId,
    png:  `assets/atlas/${relDir}/${pngFile}`,
    json: `assets/atlas/${relDir}/${jsonFile}`,
  };
}

// ─── ASSET MANIFEST ──────────────────────────────────────────────────────────

function buildManifest(spritesheets, atlases) {
  return { spritesheets, atlases };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

function main() {
  console.log('=== That One Game – Asset Generator ===\n');

  ensureDir(SS_RW);
  ensureDir(SS_GW);
  ensureDir(ATLAS_RW);
  ensureDir(ATLAS_GW);

  const spritesheets = [];

  // ── Character sprite-sheets ──────────────────────────────────────────────
  console.log('Generating character sprite-sheets…');
  for (const [charId, char] of Object.entries(CHARS)) {
    const outputDir = char.world === 'rw' ? SS_RW : SS_GW;
    for (const [animName, numFrames] of Object.entries(ANIMS)) {
      const entry = generateCharSheet(charId, char, animName, numFrames, outputDir);
      spritesheets.push(entry);
    }
  }

  // ── FX sprite-sheets ─────────────────────────────────────────────────────
  console.log('\nGenerating FX sprite-sheets…');
  for (const [fxId, fxDef] of Object.entries(FX_DEFS)) {
    const entry = generateFxSheet(fxId, fxDef, SS_GW);
    spritesheets.push(entry);
  }

  // ── Atlases ──────────────────────────────────────────────────────────────
  console.log('\nGenerating atlases…');
  const atlases = [];
  atlases.push(generateAtlas('atlas_rw_world', ATLAS_RW_WORLD_FRAMES, ATLAS_RW, 'rw'));
  atlases.push(generateAtlas('atlas_rw_ui',    ATLAS_RW_UI_FRAMES,    ATLAS_RW, 'rw'));
  atlases.push(generateAtlas('atlas_gw_world', ATLAS_GW_WORLD_FRAMES, ATLAS_GW, 'gw'));
  atlases.push(generateAtlas('atlas_gw_ui',    ATLAS_GW_UI_FRAMES,    ATLAS_GW, 'gw'));

  // ── Asset manifest ───────────────────────────────────────────────────────
  const manifest     = buildManifest(spritesheets, atlases);
  const manifestPath = path.join(ASSETS_DIR, 'asset-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('\n  wrote', path.relative(path.join(__dirname, '..'), manifestPath));

  console.log('\n✓ Done – generated', spritesheets.length, 'sprite-sheets and', atlases.length, 'atlases.');
}

main();
