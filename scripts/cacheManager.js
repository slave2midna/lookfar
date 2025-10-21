// cacheManager.js
// Minimal, proven hider/manager for the Lookfar Loot Cache (mirrors your working dataLoader.js behavior)

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
    // 1) Prefer by flag; fallback by exact name "Lookfar Loot Cache"
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

    // 3) Normalize flags & secure ownership every time (handles older worlds)
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

    // 4) Ensure the UI hider is installed (idempotent & resilient)
    this._installCacheHider();

    return folder;
  },

  // Clear the Folder (Used on Startup or via Macro)
  async clearCacheFolder() {
    const folder = await this.getOrCreateCacheFolder();
    const items = game.items.filter(i => i.folder?.id === folder.id);
    for (const item of items) await item.delete();
    console.log(`[Lookfar] Cleared ${items.length} cached items from "${folder.name}".`);
  },

  // ------- UI Hiding Implementation -------

  _installCacheHider() {
    try {
      // Always (re)inject CSS with the current folder id (handles ID changes)
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

    // v13 Items tab is section#items.sidebar-tab
    // Hide the folder row AND any item rows inside that folder
    style.textContent = `
      section#items li[data-folder-id="${folderId}"] { display: none !important; }
    `;
  },

  _scrubDirectoryDOM(htmlLike) {
    const folder = this._getCacheFolderSync();
    const folderId = folder?.id;
    if (!folderId) return;

    const rootEl = htmlLike?.[0] ?? htmlLike; // jQuery or HTMLElement
    if (!(rootEl instanceof Element)) return;

    // Remove the folder row itself
    rootEl.querySelectorAll(`li.folder[data-folder-id="${folderId}"]`).forEach(el => el.remove());

    // Remove any item rows that belong to that folder
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