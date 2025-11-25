// ============================================================================
// Lookfar GM: Conflict Builder (Foundry v13+)
// Cleaned version – all UI now powered by conflict-builder.hbs + lookfar.css
// ============================================================================

import { cacheManager } from "./cacheManager.js";

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const LOOKFAR_CONFLICT_BUILDER_CONFIG = {
  playlistNames: ["Normal Battle", "Decisive Battle", "Final Battle"]
};

// HTML escape helper
const lfEsc = (s) => {
  try { return foundry.utils.escapeHTML(String(s)); }
  catch { return String(s); }
};

// ---------------------------------------------------------------------------
// MONKEY PATCH – Suppress Foundry’s thumbnail progress bar
// ---------------------------------------------------------------------------
(function patchLookfarTextureLoader() {
  try {
    const TL = globalThis.TextureLoader ?? CONFIG.Canvas?.textureLoader;
    if (!TL || !TL.prototype?.load) return;

    if (TL.prototype._lookfarPatched) return;
    const original = TL.prototype.load;

    TL.prototype.load = function (...args) {
      try {
        if (globalThis._lookfarSuppressTextureProgress) {
          let opts = args[1];
          if (!opts || typeof opts !== "object") {
            opts = {};
            args[1] = opts;
          }
          opts.displayProgress = false;
        }
      } catch (e) {
        console.warn("Lookfar Conflict Builder | Texture suppression failed:", e);
      }

      return original.apply(this, args);
    };

    TL.prototype._lookfarPatched = true;
  } catch (e) {
    console.warn("Lookfar Conflict Builder | Patch failed:", e);
  }
})();

// ---------------------------------------------------------------------------
// MAIN DIALOG
// ---------------------------------------------------------------------------
async function openConflictBuilderDialog() {
  const { playlistNames } = LOOKFAR_CONFLICT_BUILDER_CONFIG;

  // -------------------------------------------------------------
  // Battle Scene Resolution
  // -------------------------------------------------------------
  const sceneSettingId = game.settings.get("lookfar", "battleSceneName") || "";
  let previewScene = game.scenes?.get(sceneSettingId) || canvas.scene;

  if (!previewScene) {
    ui.notifications.error("No valid battle scene available.");
    return;
  }

  // -------------------------------------------------------------
  // Thumbnail Sizing
  // -------------------------------------------------------------
  const dims = previewScene.dimensions ?? canvas?.dimensions;
  const sceneW = dims?.sceneWidth ?? 1920;
  const sceneH = dims?.sceneHeight ?? 1080;

  const MAX_W = 380;
  const MAX_H = 214;

  const sceneAspect = sceneW / sceneH;
  const frameAspect = MAX_W / MAX_H;

  let previewW, previewH;
  if (!Number.isFinite(sceneAspect)) {
    previewW = MAX_W; previewH = MAX_H;
  } else if (sceneAspect >= frameAspect) {
    previewW = MAX_W;
    previewH = Math.round(MAX_W / sceneAspect);
  } else {
    previewH = MAX_H;
    previewW = Math.round(MAX_H * sceneAspect);
  }

  // -------------------------------------------------------------
  // Generate Scene Thumbnail
  // -------------------------------------------------------------
  let sceneThumb = "";
  try {
    globalThis._lookfarSuppressTextureProgress = true;

    const t = await previewScene.createThumbnail({ width: previewW, height: previewH });
    sceneThumb = t?.thumb ?? "";
  } catch (e) {
    console.warn("Conflict Builder: Thumbnail generation failed.", e);
  } finally {
    globalThis._lookfarSuppressTextureProgress = false;
  }

  // -------------------------------------------------------------
  // Monster Compendium
  // -------------------------------------------------------------
  const compKey = game.settings.get("lookfar", "monsterCompendium") || "";
  const pack = game.packs?.get(compKey);

  if (!pack || pack.documentName !== "Actor") {
    ui.notifications.error("Invalid Monster Compendium selected.");
    return;
  }

  const index = await pack.getIndex({ fields: ["img"] });
  const actorEntries = Array.from(index.values())
    .map(e => ({
      id: e._id,
      name: e.name,
      img: e.img || "icons/svg/mystery-man.svg"
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!actorEntries.length) {
    ui.notifications.error("No actors in the selected compendium.");
    return;
  }

  // -------------------------------------------------------------
  // Folder Filter Support
  // -------------------------------------------------------------
  const folderMap = new Map();
  let folders = [];

  if (pack.folders) {
    folders = Array.from(pack.folders).sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of folders) {
      const docs = folder.contents ?? [];
      const ids = docs.map(d => d._id);
      if (ids.length) folderMap.set(folder.id, new Set(ids));
    }
  }

  // -------------------------------------------------------------
  // Playlist Options
  // -------------------------------------------------------------
  const playlistData = game.playlists
    .filter(pl => playlistNames.includes(pl.name))
    .map(pl => ({ id: pl.id, name: pl.name }));

  // -------------------------------------------------------------
  // NPC Cache
  // -------------------------------------------------------------
  const ActorCls = CONFIG.Actor?.documentClass ?? Actor;
  const npcCache = await cacheManager.getOrCreateNpcCacheFolder().catch(() => null);

  async function ensureWorldActor(actorId) {
    const src = await pack.getDocument(actorId);
    if (!src) return null;
    if (!npcCache) return src;

    let w = game.actors.find(a =>
      a.folder?.id === npcCache.id &&
      a.getFlag?.("lookfar", "sourcePack") === pack.collection &&
      a.getFlag?.("lookfar", "sourceId") === actorId
    );

    if (w) return w;

    const data = src.toObject();
    delete data._id;
    data.folder = npcCache.id;

    data.flags ??= {};
    data.flags.lookfar ??= {};
    data.flags.lookfar.sourcePack = pack.collection;
    data.flags.lookfar.sourceId = actorId;

    return ActorCls.create(data);
  }

  // -------------------------------------------------------------
  // RENDER HBS TEMPLATE
  // -------------------------------------------------------------
  const template = await renderTemplate(
    "modules/lookfar/templates/conflict-builder.hbs",
    {
      previewWidth: previewW,
      previewHeight: previewH,
      sceneThumb,
      playlists: playlistData,
      folders: folders.map(f => ({ id: f.id, name: f.name })),
      actors: actorEntries,
      initialActorImg: actorEntries[0]?.img || ""
    }
  );

  const dialogData = {
    title: "Conflict Builder",
    content: template,
    buttons: {
      summon: {
        label: "Fight",
        callback: async (html) => await summonCreatures(html, previewScene, ensureWorldActor, folderMap, actorEntries, pack)
      }
    },
    default: "summon",
    render: html => setupConflictBuilderUI(html, actorEntries, pack, folderMap)
  };

  new Dialog(dialogData, { id: "conflictBuilderDialog", width: 400, height: "auto" }).render(true);
}

// ============================================================================
// UI SETUP LOGIC (moved out of inline style)
// ============================================================================
function setupConflictBuilderUI(html, actorEntries, pack, folderMap) {
  const $html = html instanceof HTMLElement ? $(html) : html;

  const levelInput       = $html.find("#creature-level");
  const rankSelect       = $html.find("#creature-rank");
  const replacedInput    = $html.find("#replaced-soldiers");
  const imageElement     = $html.find("#creature-image");
  const listItems        = $html.find(".list-item");
  const searchInput      = $html.find("#search-input");
  const folderSelect     = $html.find("#folder-filter");
  const addButton        = $html.find("#add-to-encounter");
  const tokensLayer      = $html.find("#preview-tokens-layer");
  const previewContainer = $html.find("#conflict-preview");

  let dragState = null;

  if (listItems.length) listItems.first().addClass("selected");

  // ---------------- STAT PREVIEW ----------------
  async function updateStats(id, level, rank, replaced) {
    const actor = await pack.getDocument(id);
    if (!actor) return;

    const { dex, ins, mig, wlp } = actor.system.attributes;
    const initBase = (dex.base + ins.base) / 2;
    const hpBase   = (level * 2) + (mig.base * 5);
    const mpBase   = level + (wlp.base * 5);

    let init = initBase;
    let hp = hpBase;
    let mp = mpBase;

    if (rank === "elite") {
      init += 2; hp *= 2;
    } else if (rank === "champion") {
      init += replaced; hp *= replaced; mp *= 2;
    }

    $html.find("#creature-hp").text(Math.round(hp));
    $html.find("#creature-mp").text(Math.round(mp));
    $html.find("#creature-init").text(Math.round(init));
  }

  // ---------------- FILTER LIST ----------------
  function filterList() {
    const search = (searchInput.val() || "").toLowerCase();
    const folder = folderSelect.val();

    listItems.each(function () {
      const item = $(this);
      const id   = item.data("id");
      const matchName = item.text().toLowerCase().includes(search);

      let matchFolder = true;
      if (folder !== "all") {
        const set = folderMap.get(folder);
        matchFolder = set?.has(id);
      }

      item.toggle(matchName && matchFolder);
    });
  }

  searchInput.on("input", filterList);
  folderSelect.on("change", () => {
    filterList();
    const visible = $html.find(".list-item:visible").first();
    if (visible.length) {
      listItems.removeClass("selected");
      visible.addClass("selected");
    }
  });

  // ---------------- SELECT LIST ITEM ----------------
  listItems.on("click", async function () {
    listItems.removeClass("selected");
    $(this).addClass("selected");

    const id = $(this).data("id");
    const entry = actorEntries.find(a => a.id === id);
    if (entry) imageElement.attr("src", entry.img);

    await updateStats(
      id,
      parseInt(levelInput.val(), 10) || 5,
      rankSelect.val(),
      parseInt(replacedInput.val(), 10) || 1
    );
  });

  // ---------------- LEVEL ADJUST ----------------
  $html.find("#increase-level").on("click", async () => {
    const v = Math.min(60, parseInt(levelInput.val(), 10) + 5);
    levelInput.val(v);
    const id = $html.find(".list-item.selected").data("id");
    if (id) updateStats(id, v, rankSelect.val(), parseInt(replacedInput.val(), 10) || 1);
  });

  $html.find("#decrease-level").on("click", async () => {
    const v = Math.max(5, parseInt(levelInput.val(), 10) - 5);
    levelInput.val(v);
    const id = $html.find(".list-item.selected").data("id");
    if (id) updateStats(id, v, rankSelect.val(), parseInt(replacedInput.val(), 10) || 1);
  });

  // ---------------- RANK CHANGE ----------------
  rankSelect.on("change", async () => {
    const isChamp = rankSelect.val() === "champion";
    $html.find("#replaced-soldiers-cell").toggle(isChamp);

    const id = $html.find(".list-item.selected").data("id");
    if (id) updateStats(
      id,
      parseInt(levelInput.val(), 10) || 5,
      rankSelect.val(),
      parseInt(replacedInput.val(), 10) || 1
    );
  });

  // ---------------- ADD PREVIEW TOKENS ----------------
  addButton.on("click", async () => {
    const selected = $html.find(".list-item.selected");
    if (!selected.length) return ui.notifications.error("No creature selected.");

    const id = selected.data("id");
    const qty = Math.max(1, parseInt($html.find("#creature-quantity").val(), 10) || 1);

    const actor = await pack.getDocument(id);
    if (!actor) return ui.notifications.error("Actor not found.");

    const texSrc =
      actor.prototypeToken?.texture?.src ||
      actor.img ||
      "icons/svg/mystery-man.svg";

    const existing = tokensLayer.find(".preview-token").length;

    for (let i = 0; i < qty; i++) {
      const idx = existing + i;
      const col = idx % 5;
      const row = Math.floor(idx / 5);

      const left = 4 + col * 68;
      const top  = 4 + row * 68;

      const $img = $(`<img class="preview-token" src="${lfEsc(texSrc)}">`);
      $img.css({ left: `${left}px`, top: `${top}px` });
      $img.data("actorId", id);
      tokensLayer.append($img);
    }
  });

  // ---------------- DRAG TOKENS ----------------
  tokensLayer.on("mousedown", ".preview-token", ev => {
    if (ev.button !== 0) return;
    ev.preventDefault();

    const $token = $(ev.currentTarget);

    dragState = {
      $token,
      startMouseX: ev.pageX,
      startMouseY: ev.pageY,
      startLeft: parseFloat($token.css("left")) || 0,
      startTop: parseFloat($token.css("top")) || 0,
      containerWidth: previewContainer.width(),
      containerHeight: previewContainer.height(),
      tokenWidth: $token.outerWidth(),
      tokenHeight: $token.outerHeight()
    };

    $(document).on("mousemove.conflictDrag", onDragMove);
    $(document).on("mouseup.conflictDrag", onDragEnd);
  });

  function onDragMove(ev) {
    if (!dragState) return;
    ev.preventDefault();

    const dx = ev.pageX - dragState.startMouseX;
    const dy = ev.pageY - dragState.startMouseY;

    let left = dragState.startLeft + dx;
    let top  = dragState.startTop + dy;

    const maxLeft = Math.max(0, dragState.containerWidth - dragState.tokenWidth);
    const maxTop  = Math.max(0, dragState.containerHeight - dragState.tokenHeight);

    left = Math.max(0, Math.min(maxLeft, left));
    top  = Math.max(0, Math.min(maxTop, top));

    dragState.$token.css({ left: `${left}px`, top: `${top}px` });
  }

  function onDragEnd() {
    $(document).off(".conflictDrag");
    dragState = null;
  }

  // ---------------- RIGHT CLICK INTERACTIONS ----------------
  tokensLayer.on("contextmenu", ".preview-token", ev => {
    ev.preventDefault();
    const e = ev.originalEvent || ev;
    const $token = $(ev.currentTarget);

    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl) {
      const flipped = $token.data("lfFlipped") === true;
      if (flipped) {
        $token.css("transform", "");
        $token.data("lfFlipped", false);
      } else {
        $token.css("transform", "scaleX(-1)");
        $token.data("lfFlipped", true);
      }
    } else {
      $token.remove();
    }
  });

  // Initial filter
  filterList();
}

// ============================================================================
// SUMMON CREATURES ACTION
// ============================================================================
async function summonCreatures(html, previewScene, ensureWorldActor, folderMap, actorEntries, pack) {
  const $html = html instanceof HTMLElement ? $(html) : html;

  const $tokensLayer = $html.find("#preview-tokens-layer");
  const $preview = $html.find("#conflict-preview");
  const $tokens = $tokensLayer.find(".preview-token");

  if (!$tokens.length) {
    ui.notifications.error("No creatures added.");
    return;
  }

  const previewEl = $preview[0];
  const previewRect = previewEl?.getBoundingClientRect();
  if (!previewRect?.width || !previewRect?.height) {
    ui.notifications.error("Invalid preview area.");
    return;
  }

  const previewW = previewRect.width;
  const previewH = previewRect.height;

  // Gather normalized positions
  const previewTokens = [];
  for (const el of $tokens.toArray()) {
    const $tok = $(el);
    const actorId = $tok.data("actorId");
    if (!actorId) continue;

    const tokRect = el.getBoundingClientRect();

    let cx = (tokRect.left + tokRect.width / 2) - previewRect.left;
    let cy = (tokRect.top + tokRect.height / 2) - previewRect.top;

    let u = cx / previewW;
    let v = cy / previewH;

    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
    previewTokens.push({
      actorId,
      u: Math.min(0.999, Math.max(0, u)),
      v: Math.min(0.999, Math.max(0, v)),
      flipped: $tok.data("lfFlipped") === true
    });
  }

  if (!previewTokens.length) {
    ui.notifications.error("No valid preview tokens.");
    return;
  }

  // Activate scene
  try {
    if (!previewScene.active) await previewScene.update({ active: true });
  } catch (e) {
    console.warn("Conflict Builder: scene activation failed.", e);
  }

  await new Promise(r => setTimeout(r, 750));

  const dims = canvas.dimensions;
  if (!dims) {
    ui.notifications.error("Canvas dimensions not ready.");
    return;
  }

  const createdTokens = [];
  const actorCache = new Map();

  const level = parseInt($html.find("#creature-level").val(), 10) || 5;
  const rank = $html.find("#creature-rank").val() || "soldier";
  const replacedSoldiers = rank === "champion"
    ? Math.max(1, parseInt($html.find("#replaced-soldiers").val(), 10) || 1)
    : 1;

  for (const pt of previewTokens) {
    const { actorId, u, v, flipped } = pt;

    let actor = actorCache.get(actorId);
    if (!actor) {
      actor = await ensureWorldActor(actorId);
      if (!actor) continue;
      actorCache.set(actorId, actor);
    }

    const proto = actor.prototypeToken.toObject();

    const tokenPxW = (proto.width ?? 1) * dims.size;
    const tokenPxH = (proto.height ?? 1) * dims.size;

    const maxX = Math.max(0, dims.sceneWidth - tokenPxW);
    const maxY = Math.max(0, dims.sceneHeight - tokenPxH);

    let x = Math.min(maxX, Math.max(0, u * maxX));
    let y = Math.min(maxY, Math.max(0, v * maxY));

    proto.x = (dims.sceneX ?? 0) + x;
    proto.y = (dims.sceneY ?? 0) + y;
    proto.alpha = 0;

    if (flipped) proto.mirrorX = !proto.mirrorX;

    createdTokens.push(proto);
  }

  if (!createdTokens.length) {
    ui.notifications.error("No creatures could be placed.");
    return;
  }

  const created = await previewScene.createEmbeddedDocuments("Token", createdTokens);

  // Apply stats
  for (const token of created) {
    const actor = token.actor;
    if (!actor) continue;

    await actor.update({
      "system.level.value": level,
      "system.rank.value": rank,
      "system.rank.replacedSoldiers": replacedSoldiers
    });

    const maxHP = actor.system.resources.hp.max;
    const maxMP = actor.system.resources.mp.max;

    await actor.update({
      "system.resources.hp.value": maxHP,
      "system.resources.mp.value": maxMP
    });
  }

  // Fade-in animation
  try {
    async function waitPlaceables(docs, timeout = 3000) {
      const ids = new Set(docs.map(d => d.id));
      const start = Date.now();

      while (Date.now() - start < timeout) {
        const found = canvas.tokens.placeables.filter(t => ids.has(t.document.id));
        if (found.length) return found;
        await new Promise(r => setTimeout(r, 50));
      }
      return [];
    }

    const placeables = await waitPlaceables(created);

    if (!placeables.length) return;

    await previewScene.updateEmbeddedDocuments(
      "Token",
      placeables.map(t => ({ _id: t.document.id, alpha: 0 }))
    );

    const fadeSteps = 10;
    const duration = 2000;

    for (let i = 1; i <= fadeSteps; i++) {
      const alpha = i / fadeSteps;
      setTimeout(() => {
        previewScene.updateEmbeddedDocuments(
          "Token",
          placeables.map(t => ({ _id: t.document.id, alpha }))
        );
      }, (duration / fadeSteps) * i);
    }

  } catch (e) {
    console.warn("Conflict Builder fade-in failed:", e);
  }
}

// ---------------------------------------------------------------------------
// HOOKS
// ---------------------------------------------------------------------------
Hooks.once("ready", () => {
  game.lookfar ??= {};
  game.lookfar.conflictBuilder = openConflictBuilderDialog;
  Hooks.on("lookfarShowConflictBuilderDialog", openConflictBuilderDialog);
});
