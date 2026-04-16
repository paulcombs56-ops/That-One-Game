/**
 * AssetLoader.js
 *
 * Phaser 3 helper – reads assets/asset-manifest.json and loads all
 * sprite-sheets and atlases in a scene's preload() method.
 *
 * Usage (plain ES module):
 *
 *   import { preloadAssets } from './AssetLoader.js';
 *
 *   // Inside a Phaser.Scene subclass:
 *   preload() {
 *     preloadAssets(this);
 *   }
 *
 * The manifest path can be overridden via the second argument.
 */

'use strict';

/** Default path to the asset manifest, relative to the Phaser base URL. */
const DEFAULT_MANIFEST_PATH = 'assets/asset-manifest.json';

/**
 * Loads all assets declared in asset-manifest.json.
 *
 * @param {Phaser.Scene} scene           – The Phaser scene (provides this.load).
 * @param {string}       [manifestPath]  – Optional override for the manifest URL.
 */
function preloadAssets(scene, manifestPath) {
  const url = manifestPath || DEFAULT_MANIFEST_PATH;

  // Use Phaser's built-in JSON loader so the manifest is fetched
  // asynchronously alongside other assets.
  scene.load.json('__asset_manifest__', url);

  // Once the manifest arrives we kick off the real asset loads.
  scene.load.once('filecomplete-json-__asset_manifest__', function (key, type, data) {
    _loadFromManifest(scene, data);
  });
}

/**
 * Loads all assets described in a manifest object.
 * Can be called directly if you have the manifest data already.
 *
 * @param {Phaser.Scene}  scene
 * @param {object}        manifest – { spritesheets: [...], atlases: [...] }
 */
function loadFromManifest(scene, manifest) {
  _loadFromManifest(scene, manifest);
}

// ─── INTERNAL ────────────────────────────────────────────────────────────────

function _loadFromManifest(scene, manifest) {
  const loader = scene.load;

  // Sprite-sheets
  for (const ss of (manifest.spritesheets || [])) {
    if (!loader.textureManager.exists(ss.key)) {
      loader.spritesheet(ss.key, ss.path, {
        frameWidth:  ss.frameWidth,
        frameHeight: ss.frameHeight,
      });
    }
  }

  // Atlases (TexturePacker hash format)
  for (const atlas of (manifest.atlases || [])) {
    if (!loader.textureManager.exists(atlas.key)) {
      loader.atlas(atlas.key, atlas.png, atlas.json);
    }
  }

  // Restart the loader if it is not already running so the new entries
  // are fetched immediately (necessary when called from filecomplete).
  if (!loader.isLoading()) {
    loader.start();
  }
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

// Support both CommonJS (Node / bundler) and plain browser ES modules.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { preloadAssets, loadFromManifest };
} else if (typeof window !== 'undefined') {
  window.AssetLoader = { preloadAssets, loadFromManifest };
}
