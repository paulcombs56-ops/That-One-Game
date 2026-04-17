/**
 * AnimationHelper.js
 *
 * Phaser 3 helper – creates all character and FX animations based on the
 * sprite-sheet layout defined in the asset spec.
 *
 * Sprite-sheet layout (all characters):
 *   Row 0 = down  |  Row 1 = left  |  Row 2 = right  |  Row 3 = up
 *   Columns = animation frames (4 for idle, 8 for walk/run/attack)
 *
 * Phaser frame indices are left-to-right, top-to-bottom, so:
 *   idle   (4 cols): down 0-3, left 4-7, right 8-11, up 12-15
 *   others (8 cols): down 0-7, left 8-15, right 16-23, up 24-31
 *
 * FX sheets are a single row of 8 frames (no direction).
 *
 * Animation key convention:
 *   Characters : "<charId>/<animName>/<dir>"   e.g. "player_rw/idle/down"
 *   FX         : "<fxId>"                      e.g. "fx_hitspark"
 *
 * Usage (plain ES module):
 *
 *   import { createAllAnimations } from './AnimationHelper.js';
 *
 *   // Inside a Phaser.Scene subclass:
 *   create() {
 *     createAllAnimations(this);
 *   }
 */

'use strict';

// ─── SPEC (mirrors tools/generate-assets.js) ─────────────────────────────────

/** Direction rows, in order. */
const DIR_ROWS = ['down', 'left', 'right', 'up'];

/** Animation name → number of frames per direction. */
const ANIMS = { idle: 4, walk: 8, run: 8, attack: 8 };

/** Suggested frame-rates per animation. */
const FRAME_RATES = {
  idle:   6,
  walk:  12,
  run:   18,
  attack:14,
};

/** repeat: -1 = loop, 0 = play once */
const ANIM_REPEAT = {
  idle:   -1,
  walk:   -1,
  run:    -1,
  attack:  0,
};

/** All character spritesheet base IDs. */
const CHAR_IDS = [
  'player_rw',
  'player_gw',
  'enemy_intern',
  'enemy_hr',
  'enemy_dev',
  'enemy_security',
  'enemy_accountant',
  'miniboss_vp',
  'boss_ceo',
];

/** FX spritesheet IDs (single-row, 8 frames, no direction). */
const FX_IDS = [
  'fx_hitspark',
  'fx_slasharc',
  'fx_projectile',
  'fx_pickup',
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Create 4-directional animations for one character + one animation.
 *
 * @param {Phaser.Scene} scene
 * @param {string}       charId     – e.g. "player_gw"
 * @param {string}       animName   – e.g. "walk"
 * @param {number}       numFrames  – frames per direction (4 or 8)
 */
function make4DirAnim(scene, charId, animName, numFrames) {
  const sheetKey  = `${charId}_${animName}`;
  const frameRate = FRAME_RATES[animName] || 8;
  const repeat    = ANIM_REPEAT[animName] !== undefined ? ANIM_REPEAT[animName] : -1;

  DIR_ROWS.forEach(function (dir, rowIdx) {
    const key   = `${charId}/${animName}/${dir}`;
    const start = rowIdx * numFrames;
    const end   = start + numFrames - 1;

    if (scene.anims.exists(key)) return;   // idempotent

    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(sheetKey, { start, end }),
      frameRate,
      repeat,
    });
  });
}

/**
 * Create a single-row FX animation.
 *
 * @param {Phaser.Scene} scene
 * @param {string}       fxId  – e.g. "fx_hitspark"
 */
function makeFxAnim(scene, fxId) {
  const key = fxId;
  if (scene.anims.exists(key)) return;

  scene.anims.create({
    key,
    frames:    scene.anims.generateFrameNumbers(fxId, { start: 0, end: 7 }),
    frameRate: 16,
    repeat:    0,
  });
}

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

/**
 * Create every animation defined by the asset spec.
 * Safe to call multiple times (existing keys are skipped).
 *
 * @param {Phaser.Scene} scene
 */
function createAllAnimations(scene) {
  // Character animations
  CHAR_IDS.forEach(function (charId) {
    Object.entries(ANIMS).forEach(function ([animName, numFrames]) {
      make4DirAnim(scene, charId, animName, numFrames);
    });
  });

  // FX animations
  FX_IDS.forEach(function (fxId) {
    makeFxAnim(scene, fxId);
  });
}

/**
 * Create animations for a single character.
 * Useful when loading characters lazily.
 *
 * @param {Phaser.Scene} scene
 * @param {string}       charId
 */
function createCharAnimations(scene, charId) {
  Object.entries(ANIMS).forEach(function ([animName, numFrames]) {
    make4DirAnim(scene, charId, animName, numFrames);
  });
}

/**
 * Return the animation key for a character, animation, and direction.
 * Convenience wrapper to avoid typos in game code.
 *
 * @param {string} charId    – e.g. "player_gw"
 * @param {string} animName  – "idle" | "walk" | "run" | "attack"
 * @param {string} dir       – "down" | "left" | "right" | "up"
 * @returns {string}
 */
function animKey(charId, animName, dir) {
  return `${charId}/${animName}/${dir}`;
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createAllAnimations,
    createCharAnimations,
    animKey,
    CHAR_IDS,
    FX_IDS,
    ANIMS,
    DIR_ROWS,
  };
} else if (typeof window !== 'undefined') {
  window.AnimationHelper = {
    createAllAnimations,
    createCharAnimations,
    animKey,
    CHAR_IDS,
    FX_IDS,
    ANIMS,
    DIR_ROWS,
  };
}
