// cacheManager.js

// ---- Constants ----
const LOOKFAR_FLAG_SCOPE   = "lookfar";
const LOOKFAR_CACHE_SYSTEM = "loot-cache";
const LOOKFAR_CACHE_NAME   = "Lookfar Loot Cache";
const LOOKFAR_STYLE_ID     = "lookfar-hide-cache-style";

// ---- Public API ----
export const cacheManager = {
  _hooksInstalled: false,

  // Synchronous finder used by UI filters (no awaits during render)
  _getCacheFolderSync() {
    return game.folders.find(f =>
      f?.type === "Item" &&
      (f.getFlag?.(LOOKFAR_FLAG_SCOPE, "system") === LOOKFAR_CACHE_SYSTEM || f.name === LOOKFAR_CACHE_NAME)
    );
  },

  async getOrCreateCacheFolder() {
  if (!game?.folders || typeof game.folders.find !== "function") {
    console.warn("[Lookfar] Folders collection not ready yet; skipping cache folder ensure for now.");
    return null;
  }

  // 1) Set Cache folder by flag; or exact name
  let folder =
    game.folders.find(f => f?.type === "Item" && f.getFlag?.(LOOKFAR_FLAG_SCOPE, "system") === LOOKFAR_CACHE_SYSTEM) ??
    game.folders.find(f => f?.type === "Item" && f.name === LOOKFAR_CACHE_NAME);

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
      console.log("[Lookfar] Created loot cache folder:", folder.name);
    }

    // 3) Secure folder ownership
    try {
      if (folder.getFlag?.(LOOKFAR_FLAG_SCOPE, "system") !== LOOKFAR_CACHE_SYSTEM) {
        await folder.setFlag?.(LOOKFAR_FLAG_SCOPE, "system", LOOKFAR_CACHE_SYSTEM);
      }
      if (folder.getFlag?.(LOOKFAR_FLAG_SCOPE, "hidden") !== true) {
        await folder.setFlag?.(LOOKFAR_FLAG_SCOPE, "hidden", true);
      }
      const NONE = (CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE ?? 0);
      if ((folder.ownership?.default ?? 0) !== NONE) {
        await folder.update({ ownership: { ...(folder.ownership ?? {}), default: NONE } });
      }
    } catch (e) {
      console.warn("[Lookfar] Could not normalize cache folder flags/ownership", e);
    }

    // 4) Ensure the UI hider is installed
    this._installCacheHider();

    return folder;
  },

  // Clear the Folder on startup (can be triggered by macro)
  async clearCacheFolder() {
  const activeGM = game.users?.activeGM;
  if (!activeGM || game.user.id !== activeGM.id) {
    return;
  }

  const folder = await this.getOrCreateCacheFolder();
  if (!folder) return;

  const items = game.items.filter(i => i.folder?.id === folder.id);
  if (!items.length) {
    console.log("[Lookfar] No cached items to clear.");
    return;
  }

  try {
    await Item.deleteDocuments(items.map(i => i.id));
    console.log(
      `[Lookfar] Cleared ${items.length} cached items from "${folder.name}".`
    );
  } catch (err) {
    console.warn("[Lookfar] Failed to clear loot cache (GM-only operation):", err);
  }
},

  // ------- Hooks & Wiring -------

  _installCacheHider() {
    try {
      // Always (re)inject CSS with the current folder id
      this._injectHiderStyle();

      if (this._hooksInstalled) return;

      // Scrub on every Item Directory render
      Hooks.on("renderItemDirectory", (_app, html) => this._scrubDirectoryDOM(html));

      // Also catch initial Items tab paint
      Hooks.on("renderSidebarTab", (app, html) => {
        if (app?.id === "items") this._scrubDirectoryDOM(html);
      });

      // Safety net for custom/alternate directories in v13
      Hooks.on("renderApplicationV2", (app, html) => {
        if (app?.id === "items" || app?.constructor?.name?.includes?.("ItemDirectory")) {
          this._scrubDirectoryDOM(html);
        }
      });

      // Optional: prevent it being a drop target
      Hooks.on("renderItemDirectory", (app) => {
        const folder = this._getCacheFolderSync();
        if (!folder) return;
        const dd = app._dragDrop?.[0];
        if (!dd?.dropTargets) return;
        const sel = `li.folder[data-folder-id="${folder.id}"]`;
        const idx = dd.dropTargets.indexOf(sel);
        if (idx >= 0) dd.dropTargets.splice(idx, 1);
      });

      // Keep the CSS updated if the folder is moved/renamed/recreated
      Hooks.on("updateFolder", (folder) => {
        if (folder?.type === "Item" &&
            (folder.getFlag?.(LOOKFAR_FLAG_SCOPE, "system") === LOOKFAR_CACHE_SYSTEM ||
             folder.name === LOOKFAR_CACHE_NAME)) {
          this._injectHiderStyle();
        }
      });
      Hooks.on("createFolder", () => this._injectHiderStyle());
      Hooks.on("deleteFolder", () => this._injectHiderStyle());

      this._hooksInstalled = true;
    } catch (e) {
      console.warn("[Lookfar] Failed to install cache hider", e);
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
      section#items li[data-folder-id="${folderId}"] { display: none !important; }
    `;
  },

  _scrubDirectoryDOM(htmlLike) {
    const folder = this._getCacheFolderSync();
    const folderId = folder?.id;
    if (!folderId) return;

    const rootEl = htmlLike?.[0] ?? htmlLike;
    if (!(rootEl instanceof Element)) return;

    rootEl.querySelectorAll(`li.folder[data-folder-id="${folderId}"]`).forEach(el => el.remove());

    rootEl.querySelectorAll(`li[data-folder-id="${folderId}"]`).forEach(el => {
      if (!el.classList.contains("folder")) el.remove();
    });
  }
};

// Install early so the first render can’t show the folder
Hooks.once("init", async () => {
  await cacheManager.getOrCreateCacheFolder();
});

// Auto-Clear Cache on World Load
Hooks.once("ready", async () => {
  await cacheManager.clearCacheFolder();
});
