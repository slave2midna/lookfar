// cacheManager.js

const LOOKFAR_FLAG_SCOPE = "lookfar";

// Loot Cache (Items)
const LOOKFAR_CACHE_SYSTEM = "loot-cache";
const LOOKFAR_CACHE_NAME   = "Lookfar Loot Cache";
const LOOKFAR_STYLE_ID     = "lookfar-hide-cache-style";

// NPC Cache (Actors)
const LOOKFAR_NPC_CACHE_SYSTEM = "npc-cache";
const LOOKFAR_NPC_CACHE_NAME   = "Lookfar NPC Cache";
const LOOKFAR_NPC_STYLE_ID     = "lookfar-hide-npc-cache-style";

const LOG = "[Lookfar Cache]";

// ---- Public API ----
export const cacheManager = {
  _hooksInstalled: false,       // Loot cache stealth hooks
  _npcHooksInstalled: false,    // NPC cache stealth hooks

  // Loot Cache folder
  _getCacheFolderSync() {
    return game.folders.find(f =>
      f?.type === "Item" &&
      (f.getFlag?.(LOOKFAR_FLAG_SCOPE, "system") === LOOKFAR_CACHE_SYSTEM ||
       f.name === LOOKFAR_CACHE_NAME)
    );
  },

  // NPC Cache folder
  _getNpcCacheFolderSync() {
    return game.folders.find(f =>
      f?.type === "Actor" &&
      (f.getFlag?.(LOOKFAR_FLAG_SCOPE, "system") === LOOKFAR_NPC_CACHE_SYSTEM ||
       f.name === LOOKFAR_NPC_CACHE_NAME)
    );
  },

  // ------------------------------------------------------------
  // Loot Cache Folder Setup
  // ------------------------------------------------------------
  async getOrCreateCacheFolder() {
    if (!game?.folders || typeof game.folders.find !== "function") {
      console.warn(`${LOG} Folders collection not ready yet; skipping cache folder ensure for now.`);
      return null;
    }

    // 1) Check for folder
    let folder =
      game.folders.find(f =>
        f?.type === "Item" &&
        f.getFlag?.(LOOKFAR_FLAG_SCOPE, "system") === LOOKFAR_CACHE_SYSTEM
      ) ??
      game.folders.find(f =>
        f?.type === "Item" &&
        f.name === LOOKFAR_CACHE_NAME
      );

    // 2) Create if missing
    if (!folder) {
      folder = await Folder.create({
        name: LOOKFAR_CACHE_NAME,
        type: "Item",
        sorting: "a",
        parent: null,
        color: "#999999",
        flags: { [LOOKFAR_FLAG_SCOPE]: { system: LOOKFAR_CACHE_SYSTEM, hidden: true } }
      });
      console.log(`${LOG} Created loot cache folder: ${folder.name}`);
    }

    // 3) Normalize ownership
    try {
      if (folder.getFlag?.(LOOKFAR_FLAG_SCOPE, "system") !== LOOKFAR_CACHE_SYSTEM) {
        await folder.setFlag?.(LOOKFAR_FLAG_SCOPE, "system", LOOKFAR_CACHE_SYSTEM);
      }
      if (folder.getFlag?.(LOOKFAR_FLAG_SCOPE, "hidden") !== true) {
        await folder.setFlag?.(LOOKFAR_FLAG_SCOPE, "hidden", true);
      }

      const NONE = (CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE ?? 0);
      if ((folder.ownership?.default ?? 0) !== NONE) {
        await folder.update({
          ownership: {
            ...(folder.ownership ?? {}),
            default: NONE
          }
        });
      }
    } catch (e) {
      console.warn(`${LOG} Could not normalize loot cache folder flags/ownership`, e);
    }
    this._installCacheHider();
    return folder;
  },

  // ------------------------------------------------------------
  // NPC Cache Folder Setup
  // ------------------------------------------------------------
  async getOrCreateNpcCacheFolder() {
    if (!game?.folders || typeof game.folders.find !== "function") {
      console.warn(`${LOG} Folders collection not ready yet; skipping NPC cache ensure for now.`);
      return null;
    }

    // 1) Check for NPC cache by flag or name
    let folder =
      game.folders.find(f =>
        f?.type === "Actor" &&
        f.getFlag?.(LOOKFAR_FLAG_SCOPE, "system") === LOOKFAR_NPC_CACHE_SYSTEM
      ) ??
      game.folders.find(f =>
        f?.type === "Actor" &&
        f.name === LOOKFAR_NPC_CACHE_NAME
      );

    // 2) Create if missing
    if (!folder) {
      folder = await Folder.create({
        name: LOOKFAR_NPC_CACHE_NAME,
        type: "Actor",
        sorting: "a",
        parent: null,
        color: "#999999",
        flags: { [LOOKFAR_FLAG_SCOPE]: { system: LOOKFAR_NPC_CACHE_SYSTEM, hidden: true } }
      });
      console.log(`${LOG} Created NPC cache folder: ${folder.name}`);
    }

    // 3) Normalize ownership
    try {
      if (folder.getFlag?.(LOOKFAR_FLAG_SCOPE, "system") !== LOOKFAR_NPC_CACHE_SYSTEM) {
        await folder.setFlag?.(LOOKFAR_FLAG_SCOPE, "system", LOOKFAR_NPC_CACHE_SYSTEM);
      }
      if (folder.getFlag?.(LOOKFAR_FLAG_SCOPE, "hidden") !== true) {
        await folder.setFlag?.(LOOKFAR_FLAG_SCOPE, "hidden", true);
      }
      const NONE = (CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE ?? 0);
      if ((folder.ownership?.default ?? 0) !== NONE) {
        await folder.update({
          ownership: {
            ...(folder.ownership ?? {}),
            default: NONE
          }
        });
      }
    } catch (e) {
      console.warn(`${LOG} Could not normalize NPC cache folder flags/ownership`, e);
    }
    return folder;
  },

  // ------------------------------------------------------------
  // Clear Loot Cache Folder
  // ------------------------------------------------------------
  async clearCacheFolder() {
    const activeGM = game.users?.activeGM;
    if (!activeGM || game.user.id !== activeGM.id) {
      console.debug(`${LOG} clearCacheFolder skipped; user is not active GM.`);
      return;
    }

    const folder = await this.getOrCreateCacheFolder();
    if (!folder) {
      console.debug(`${LOG} clearCacheFolder: no loot cache folder found.`);
      return;
    }

    const items = game.items.filter(i => i.folder?.id === folder.id);
    if (!items.length) {
      console.log(`${LOG} No cached loot items to clear in "${folder.name}".`);
      return;
    }

    try {
      await Item.deleteDocuments(items.map(i => i.id));
      console.log(`${LOG} Cleared ${items.length} cached loot items from "${folder.name}".`);
    } catch (err) {
      console.warn(`${LOG} Failed to clear loot cache (GM-only operation):`, err);
    }
  },

  // ------------------------------------------------------------
  // Clear NPC Cache Folder
  // ------------------------------------------------------------
  async clearNpcCacheFolder() {
    const activeGM = game.users?.activeGM;
    if (!activeGM || game.user.id !== activeGM.id) {
      console.debug(`${LOG} clearNpcCacheFolder skipped; user is not active GM.`);
      return;
    }

    const folder = await this.getOrCreateNpcCacheFolder();
    if (!folder) {
      console.debug(`${LOG} clearNpcCacheFolder: no NPC cache folder found.`);
      return;
    }

    const npcs = game.actors.filter(a => a.folder?.id === folder.id);
    if (!npcs.length) {
      console.log(`${LOG} No cached NPCs to clear in "${folder.name}".`);
      return;
    }

    try {
      await Actor.deleteDocuments(npcs.map(a => a.id));
      console.log(`${LOG} Cleared ${npcs.length} cached NPCs from "${folder.name}".`);
    } catch (err) {
      console.warn(`${LOG} Failed to clear NPC cache (GM-only operation):`, err);
    }
  },

  // ------------------------------------------------------------
  // Hide Loot Cache Folder
  // ------------------------------------------------------------
  _installCacheHider() {
    try {
      // Always reinject CSS based on the current folder ID
      this._injectHiderStyle();

      if (this._hooksInstalled) return;

      // Scrub on Item Directory render
      Hooks.on("renderItemDirectory", (_app, html) => this._scrubDirectoryDOM(html));

      // Sidebar initial render
      Hooks.on("renderSidebarTab", (app, html) => {
        if (app?.id === "items") this._scrubDirectoryDOM(html);
      });

      // v13 safety net
      Hooks.on("renderApplicationV2", (app, html) => {
        if (app?.id === "items" ||
            app?.constructor?.name?.includes?.("ItemDirectory")) {
          this._scrubDirectoryDOM(html);
        }
      });

      // Remove folder as a drop target
      Hooks.on("renderItemDirectory", (app) => {
        const folder = this._getCacheFolderSync();
        if (!folder) return;

        const dd = app._dragDrop?.[0];
        if (!dd?.dropTargets) return;

        const sel = `li.folder[data-folder-id="${folder.id}"]`;
        const idx = dd.dropTargets.indexOf(sel);
        if (idx >= 0) dd.dropTargets.splice(idx, 1);
      });

      // Update CSS if folder moves/renames
      Hooks.on("updateFolder", (folder) => {
        if (
          folder?.type === "Item" &&
          (folder.getFlag?.(LOOKFAR_FLAG_SCOPE, "system") === LOOKFAR_CACHE_SYSTEM ||
           folder.name === LOOKFAR_CACHE_NAME)
        ) {
          this._injectHiderStyle();
        }
      });
      Hooks.on("createFolder", () => this._injectHiderStyle());
      Hooks.on("deleteFolder", () => this._injectHiderStyle());

      this._hooksInstalled = true;
    } catch (e) {
      console.warn(`${LOG} Failed to install cache hider`, e);
    }
  },

  _injectHiderStyle() {
    const folder = this._getCacheFolderSync();
    const folderId = folder?.id;
    if (!folderId) return;

    let style = document.getElementById(LOOKFAR_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = LOOKFAR_STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      section#items li[data-folder-id="${folderId}"] {
        display: none !important;
      }
    `;
  },

  _scrubDirectoryDOM(htmlLike) {
    const folder = this._getCacheFolderSync();
    const folderId = folder?.id;
    if (!folderId) return;

    const rootEl = htmlLike?.[0] ?? htmlLike;
    if (!(rootEl instanceof Element)) return;

    // Remove loot cache folder
    rootEl.querySelectorAll(`li.folder[data-folder-id="${folderId}"]`)
      .forEach(el => el.remove());

    // Remove its children if any leaked
    rootEl.querySelectorAll(`li[data-folder-id="${folderId}"]`)
      .forEach(el => {
        if (!el.classList.contains("folder")) el.remove();
      });
  },

  // ------------------------------------------------------------
  // Hide NPC Cache Folder
  // ------------------------------------------------------------
  _installNpcCacheHider() {
    try {
      this._injectNpcHiderStyle();

      if (this._npcHooksInstalled) return;

      // Scrub on Actor Directory render
      Hooks.on("renderActorDirectory", (_app, html) => this._scrubNpcDirectoryDOM(html));

      // Sidebar initial render for Actors tab
      Hooks.on("renderSidebarTab", (app, html) => {
        if (app?.id === "actors") this._scrubNpcDirectoryDOM(html);
      });

      // v13 safety net for alternate actor directories
      Hooks.on("renderApplicationV2", (app, html) => {
        if (app?.id === "actors" ||
            app?.constructor?.name?.includes?.("ActorDirectory")) {
          this._scrubNpcDirectoryDOM(html);
        }
      });

      // Update CSS if NPC cache folder moves/renames
      Hooks.on("updateFolder", (folder) => {
        if (
          folder?.type === "Actor" &&
          (folder.getFlag?.(LOOKFAR_FLAG_SCOPE, "system") === LOOKFAR_NPC_CACHE_SYSTEM ||
           folder.name === LOOKFAR_NPC_CACHE_NAME)
        ) {
          this._injectNpcHiderStyle();
        }
      });
      Hooks.on("createFolder", () => this._injectNpcHiderStyle());
      Hooks.on("deleteFolder", () => this._injectNpcHiderStyle());

      this._npcHooksInstalled = true;
    } catch (err) {
      console.warn(`${LOG} Failed to install NPC cache hider:`, err);
    }
  },

  _injectNpcHiderStyle() {
    const folder = this._getNpcCacheFolderSync();
    const folderId = folder?.id;
    if (!folderId) return;

    let style = document.getElementById(LOOKFAR_NPC_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = LOOKFAR_NPC_STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      section#actors li[data-folder-id="${folderId}"] {
        display: none !important;
      }
    `;
  },

  _scrubNpcDirectoryDOM(htmlLike) {
    const folder = this._getNpcCacheFolderSync();
    const folderId = folder?.id;
    if (!folderId) return;

    const rootEl = htmlLike?.[0] ?? htmlLike;
    if (!(rootEl instanceof Element)) return;

    // Remove NPC cache folder
    rootEl.querySelectorAll(`li.folder[data-folder-id="${folderId}"]`)
      .forEach(el => el.remove());

    // Remove its children if any leaked
    rootEl.querySelectorAll(`li[data-folder-id="${folderId}"]`)
      .forEach(el => {
        if (!el.classList.contains("folder")) el.remove();
      });
  }
};

// ---- Setup Cache Early
Hooks.once("init", async () => {
  await cacheManager.getOrCreateCacheFolder();
});

// ---- Auto-clear on world ready
Hooks.once("ready", async () => {
  await cacheManager.clearCacheFolder();
  await cacheManager.clearNpcCacheFolder();

  cacheManager._installCacheHider();
  cacheManager._installNpcCacheHider();
});
