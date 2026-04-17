/**
 * main.js  –  That One Game  –  GitHub Spark entry point
 *
 * Scenes:
 *   BootScene    – tiny loading screen while the asset manifest is fetched
 *   PreloadScene – loads every spritesheet and atlas via AssetLoader
 *   GameScene    – registers all animations and shows a playable demo
 *
 * Keyboard controls (GameScene demo):
 *   Arrow keys / WASD  – move the player
 *   SHIFT              – hold to run
 *   SPACE              – attack
 *   X key              – toggle Real-World ↔ Game-World skin
 */

'use strict';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TILE   = 32;          // px per logical tile
const SPEED  = {walk: 80, run: 150};

// ─── BOOT SCENE ──────────────────────────────────────────────────────────────

class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // Show a simple loading bar while the manifest JSON is fetched
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.text(W / 2, H / 2 - 20, 'Loading…', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffffff',
    }).setOrigin(0.5);

    const bar = this.add.rectangle(W / 2, H / 2 + 10, 0, 10, 0x44ff88).setOrigin(0, 0.5);
    const bg  = this.add.rectangle(W / 2 - 150, H / 2 + 10, 300, 10, 0x336633).setOrigin(0, 0.5);
    bg.setDepth(0); bar.setDepth(1);

    this.load.on('progress', (v) => { bar.width = 300 * v; });

    // Hand off to AssetLoader (attached to window by AssetLoader.js)
    window.AssetLoader.preloadAssets(this);
  }

  create() {
    this.scene.start('GameScene');
  }
}

// ─── GAME SCENE ──────────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    const { width: W, height: H } = this.scale;
    const AH = window.AnimationHelper;

    // Register all animations (idempotent)
    AH.createAllAnimations(this);

    // ── Background ────────────────────────────────────────────────────────────
    this.add.rectangle(0, 0, W, H, 0x1a1a2e).setOrigin(0);

    // Draw a simple tiled floor from the atlas
    this._drawFloor(W, H);

    // ── Player sprite ─────────────────────────────────────────────────────────
    this._world  = 'rw';            // 'rw' or 'gw'
    this._dir    = 'down';
    this._moving = false;
    this._running = false;
    this._attacking = false;

    this.player = this.add.sprite(W / 2, H / 2, 'player_rw_idle')
      .setScale(3);

    this.player.play(AH.animKey('player_rw', 'idle', 'down'));

    // ── Input ─────────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys('W,A,S,D');
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.swapKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    // Attack fires once per keydown
    this.input.keyboard.on('keydown-SPACE', () => this._startAttack());

    // Swap world skin
    this.input.keyboard.on('keydown-X', () => this._swapWorld());

    // ── HUD ───────────────────────────────────────────────────────────────────
    this.worldLabel = this.add.text(10, 10,
      'World: Real  |  X = swap world  |  Arrows/WASD = move  |  SHIFT = run  |  SPACE = attack', {
        fontFamily: 'monospace', fontSize: '11px', color: '#aaffaa',
      });
  }

  update() {
    if (this._attacking) return;   // lock movement during attack

    const left  = this.cursors.left.isDown  || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up    = this.cursors.up.isDown    || this.wasd.W.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.S.isDown;
    const run   = this.shiftKey.isDown;

    const moving = left || right || up || down;
    const speed  = run ? SPEED.run : SPEED.walk;
    const animName = moving ? (run ? 'run' : 'walk') : 'idle';
    const AH = window.AnimationHelper;

    // Direction
    if (left)       this._dir = 'left';
    else if (right) this._dir = 'right';
    else if (up)    this._dir = 'up';
    else if (down)  this._dir = 'down';

    // Position
    const dt = this.game.loop.delta / 1000;
    if (left)  this.player.x -= speed * dt;
    if (right) this.player.x += speed * dt;
    if (up)    this.player.y -= speed * dt;
    if (down)  this.player.y += speed * dt;

    // Clamp to screen
    this.player.x = Phaser.Math.Clamp(this.player.x, 16, this.scale.width  - 16);
    this.player.y = Phaser.Math.Clamp(this.player.y, 16, this.scale.height - 16);

    // Play animation only when it changes
    const newKey = AH.animKey(`player_${this._world}`, animName, this._dir);
    if (this.player.anims.currentAnim?.key !== newKey) {
      this.player.play(newKey);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  _drawFloor(W, H) {
    // Draw a checkerboard pattern as a stand-in for tiles
    const cols = Math.ceil(W / TILE) + 1;
    const rows = Math.ceil(H / TILE) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const col = (r + c) % 2 === 0 ? 0x111122 : 0x0d0d1a;
        this.add.rectangle(c * TILE, r * TILE, TILE, TILE, col)
          .setOrigin(0).setAlpha(0.8);
      }
    }
  }

  _startAttack() {
    if (this._attacking) return;
    this._attacking = true;
    const key = window.AnimationHelper.animKey(`player_${this._world}`, 'attack', this._dir);
    this.player.play(key);
    this.player.once('animationcomplete', () => {
      this._attacking = false;
    });
  }

  _swapWorld() {
    this._world = this._world === 'rw' ? 'gw' : 'rw';
    const label = this._world === 'rw' ? 'Real' : 'Game';
    this.worldLabel.setText(
      `World: ${label}  |  X = swap world  |  Arrows/WASD = move  |  SHIFT = run  |  SPACE = attack`
    );
    // Reset to idle so the new texture loads cleanly
    const key = window.AnimationHelper.animKey(`player_${this._world}`, 'idle', this._dir);
    this.player.play(key);
    this._attacking = false;
  }
}

// ─── PHASER CONFIG ────────────────────────────────────────────────────────────

window.addEventListener('load', function () {
  new Phaser.Game({
    type:            Phaser.AUTO,
    width:           800,
    height:          500,
    backgroundColor: '#1a1a2e',
    scene:           [BootScene, GameScene],
    parent:          'game-container',
    scale: {
      mode:       Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
});
