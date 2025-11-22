// Lookfar GM: Conflict Builder (Foundry v13+)
// - Provides a tool to rapidly assemble and inspect enemy groups for scenes.
// - Uses a configured Actor compendium as the bestiary source.
// - Uses a configured Scene for preview, falling back to the active scene.
// - Includes stat preview, quantity controls, and creature selection UI.

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const LOOKFAR_CONFLICT_BUILDER_CONFIG = {
  playlistNames: ["Normal Battle", "Decisive Battle", "Final Battle"] // Optional music dropdown
};

// Simple HTML escape helper
const lfEsc = (s) => {
  try {
    return foundry.utils.escapeHTML(String(s));
  } catch {
    return String(s);
  }
};

// ---------------------------------------------------------------------------
// MAIN FUNCTION — Conflict Builder Dialog
// ---------------------------------------------------------------------------
async function openConflictBuilderDialog() {
  const { playlistNames } = LOOKFAR_CONFLICT_BUILDER_CONFIG;

  // -------------------------------------------------------------------------
  // Resolve battle scene (settings → active scene)
  // -------------------------------------------------------------------------
  const sceneSettingId = game.settings.get("lookfar", "battleSceneName") || "";
  let previewScene = null;

  if (sceneSettingId && game.scenes?.get(sceneSettingId)) {
    previewScene = game.scenes.get(sceneSettingId);
  } else {
    previewScene = canvas.scene;
  }

  if (!previewScene) {
    ui.notifications.error("No valid battle scene or active scene is available.");
    return;
  }

  const currentBackground = previewScene.background?.src || "";
  const currentTerrain = previewScene.tiles?.contents[0]?.texture?.src || "";

  // -------------------------------------------------------------------------
  // Resolve monster compendium (Actor pack only)
  // -------------------------------------------------------------------------
  const compendiumKey = game.settings.get("lookfar", "monsterCompendium") || "";
  const pack = game.packs?.get(compendiumKey);

  if (!pack || pack.documentName !== "Actor") {
    ui.notifications.error("Selected Monster Compendium is invalid or missing.");
    return;
  }

  // Use compendium index (name + img) instead of loading full documents
  const index = await pack.getIndex({ fields: ["img"] });
  const indexEntries = Array.from(index.values());

  if (!indexEntries.length) {
    ui.notifications.error(`No actors found in compendium "${pack.title || pack.collection}".`);
    return;
  }

  // -------------------------------------------------------------------------
  // Compendium folder support (for filtering)
  // -------------------------------------------------------------------------
  // Build folder -> Set(actorId) map from *compendium* folders, not world folders
  const folderMap = new Map();
  let compFolders = [];

  if (pack.folders) {
    compFolders = Array.from(pack.folders); // Folder docs for this pack only

    // Sort folders alphabetically by name
    compFolders.sort((a, b) => a.name.localeCompare(b.name));

    for (const folder of compFolders) {
      const docs = folder.contents || [];
      const ids = docs.map(d => d._id);
      if (ids.length) folderMap.set(folder.id, new Set(ids));
    }
  }

  const folderOptions =
    `<option value="all">${lfEsc("All Types")}</option>` +
    compFolders.map(f =>
      `<option value="${f.id}">${lfEsc(f.name)}</option>`
    ).join("");

  // Index-level actor data (no full docs yet)
  const actorIndexData = indexEntries
    .map(e => ({
      id: e._id,
      name: e.name,
      img: e.img || "icons/svg/mystery-man.svg"
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const renderOptions = {
    id: "conflictBuilderDialog",
    height: "600px",
    width: "400px"
  };

  // -------------------------------------------------------------------------
  // Playlist dropdown options
  // -------------------------------------------------------------------------
  const playlistOptions =
    `<option value="default">Default</option>` +
    game.playlists
      .filter(pl => playlistNames.includes(pl.name))
      .map(pl => `<option value="${pl.id}">${lfEsc(pl.name)}</option>`)
      .join("");

  // -------------------------------------------------------------------------
  // Dialog Content
  // -------------------------------------------------------------------------
  const dialogData = {
    title: "Conflict Builder",
    content: `
      <form>
        <style>
          #conflictBuilderDialog .dialog-body {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            width: 380px;
            height: 190px;
            gap: 8px;
          }
          #conflictBuilderDialog .preview-image {
            width: 190px;
            height: 190px;
            object-fit: contain;
            display: block;
          }
          #conflictBuilderDialog .form-fields {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            width: 190px;
            height: 297px;
            gap: 4px; /* tighter vertical spacing */
          }
          #conflictBuilderDialog .form-group {
            margin-bottom: 2px; /* small buffer between controls */
          }
          #conflictBuilderDialog .scrollable-list {
            width: 100%;
            height: 297px;
            overflow-y: auto;
            padding: 2px;
            border: 1px solid #ccc;
            border-radius: 4px;
          }
          #conflictBuilderDialog .list-item {
            padding: 2px 4px;
            cursor: pointer;
            border-radius: 3px;
            margin-bottom: 2px;
          }
          #conflictBuilderDialog .list-item:hover {
            background: #e0e0e0;
          }
          #conflictBuilderDialog .list-item.selected {
            background: #3b82f6;
            color: #ffffff;
          }
          #conflictBuilderDialog .actor-attributes {
            font-size: 14px;
            margin-top: 8px;
            margin-bottom: 10px; /* extra space above the Fight button */
            text-align: left;
            width: 190px;
          }
          /* Preview token overlay */
          #conflictBuilderDialog #conflict-preview {
            position: relative;
            width: 100%;
            height: 200px;
            border: 1px solid #ccc;
            overflow: hidden;
          }
          #conflictBuilderDialog #preview-tokens-layer {
            position: absolute;
            inset: 0;
            z-index: 3;
            pointer-events: none;
          }
          #conflictBuilderDialog .preview-token {
            position: absolute;
            width: 64px;
            height: 64px;
            object-fit: contain;
            pointer-events: none;
          }
        </style>

        <!-- Scene Preview -->
        <div style="margin-bottom: 10px;">
          <div style="padding: 5px; border: 1px solid #ccc; margin-bottom: 8px;">
            <h4 style="margin: 0 0 4px 0;">Scene Preview</h4>
            <div id="conflict-preview">
              <img id="background-preview" src="${currentBackground}"
                   style="position:absolute; width:100%; height:100%; object-fit:cover; z-index:1;" />
              <img id="terrain-preview" src="${currentTerrain}"
                   style="position:absolute; width:100%; height:100%; object-fit:cover; z-index:2;" />
              <div id="preview-tokens-layer"></div>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <label for="playlist-select">Music:</label>
            <select id="playlist-select" style="flex:1;">
              ${playlistOptions}
            </select>
          </div>
        </div>

        <!-- Creature Selection -->
        <div class="dialog-body">
          <div>
            <img id="creature-image" src="${actorIndexData[0].img}" class="preview-image">
          </div>

          <div class="form-fields">
            <div class="form-group">
              <label for="folder-filter">Subfolder:</label>
              <select id="folder-filter" style="width:100%;">
                ${folderOptions}
              </select>
            </div>

            <div class="form-group">
              <input type="text" id="search-input" placeholder="Search..." style="width:100%; padding:4px;">
            </div>

            <div class="scrollable-list">
              ${actorIndexData.map(a => `
                <div class="list-item" data-id="${a.id}">
                  ${lfEsc(a.name)}
                </div>`).join("")}
            </div>

            <div class="form-group" style="display:flex; align-items:center; gap:4px;">
              <label style="flex:0 0 auto;">Quantity:</label>
              <input
                type="number"
                id="creature-quantity"
                value="1"
                min="1"
                max="10"
                style="flex:1; padding:4px;"
              >
              <button type="button" id="add-to-encounter" style="flex:0 0 60px;">Add</button>
            </div>
          </div>
        </div>

        <!-- Stat Preview -->
        <div class="actor-attributes">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td>HP:</td><td id="creature-hp">--</td>
              <td>MP:</td><td id="creature-mp">--</td>
              <td>Init:</td><td id="creature-init">--</td>
            </tr>
          </table>

          <div style="margin-top:4px;">
            <label style="width:35px;">Level:</label>
            <button id="decrease-level" type="button" style="width:22px; padding:0;">-</button>
            <input type="number" id="creature-level" value="5" min="5" max="60" step="5" style="width:40px; text-align:center;">
            <button id="increase-level" type="button" style="width:22px; padding:0;">+</button>
          </div>

          <div style="margin-top:5px; display:flex; align-items:center;">
            <label style="width:35px;">Rank:</label>
            <select id="creature-rank" style="width:95px;">
              <option value="soldier">Soldier</option>
              <option value="elite">Elite</option>
              <option value="champion">Champion</option>
            </select>

            <div id="replaced-soldiers-cell" style="display:none; padding-left:5px;">
              <input type="number" id="replaced-soldiers" value="1" min="1" max="6" style="width:40px; text-align:center;">
            </div>
          </div>
        </div>
      </form>
    `,

    // -----------------------------------------------------------------------
    // Buttons
    // -----------------------------------------------------------------------
    buttons: {
      summon: {
        label: "Fight",
        callback: async (html) => {
          // For now, we only validate that something is selected.
          const $html = html instanceof HTMLElement ? $(html) : html;
          const selected = $html.find(".list-item.selected");
          if (!selected.length) {
            ui.notifications.error("No creature selected.");
          }
          // Future wiring for encounter-building / combat start can go here.
        }
      }
    },

    default: "summon",

    // -----------------------------------------------------------------------
    // RENDER HOOK
    // -----------------------------------------------------------------------
    render: html => {
      const $html = html instanceof HTMLElement ? $(html) : html;

      const levelInput    = $html.find("#creature-level");
      const rankSelect    = $html.find("#creature-rank");
      const replacedInput = $html.find("#replaced-soldiers");
      const imageElement  = $html.find("#creature-image");
      const listItems     = $html.find(".list-item");
      const searchInput   = $html.find("#search-input");
      const folderSelect  = $html.find("#folder-filter");
      const addButton     = $html.find("#add-to-encounter");
      const tokensLayer   = $html.find("#preview-tokens-layer");

      if (listItems.length) {
        listItems.first().addClass("selected");
      }

      async function updateStatsForId(id, level, rank, replacedSoldiers) {
        // Fetch the full actor doc only for the one we care about
        const actor = await pack.getDocument(id);
        if (!actor) return;

        const { dex, ins, mig, wlp } = actor.system.attributes;
        const initBase   = (dex.base + ins.base) / 2;
        const maxHpBase  = (level * 2) + (mig.base * 5);
        const maxMpBase  = level + (wlp.base * 5);

        let init = initBase;
        let hp   = maxHpBase;
        let mp   = maxMpBase;

        if (rank === "elite") {
          init += 2;
          hp   *= 2;
        } else if (rank === "champion") {
          init += replacedSoldiers;
          hp   *= replacedSoldiers;
          mp   *= 2;
        }

        $html.find("#creature-hp").text(Math.round(hp));
        $html.find("#creature-mp").text(Math.round(mp));
        $html.find("#creature-init").text(Math.round(init));
      }

      // Combined search + folder filter
      function filterList() {
        const searchTerm     = (searchInput.val() || "").toString().toLowerCase();
        const selectedFolder = folderSelect.val();

        listItems.each(function() {
          const item      = $(this);
          const id        = item.data("id");
          const nameMatch = item.text().toLowerCase().includes(searchTerm);

          let folderMatch = true;
          if (selectedFolder && selectedFolder !== "all") {
            const idsSet = folderMap.get(selectedFolder);
            folderMatch  = idsSet ? idsSet.has(id) : false;
          }

          item.toggle(nameMatch && folderMatch);
        });
      }

      // Level +/- buttons
      $html.find("#increase-level").on("click", async () => {
        const v = Math.min(60, parseInt(levelInput.val(), 10) + 5);
        levelInput.val(v);
        const selected = $html.find(".list-item.selected");
        const id = selected.data("id");
        if (id) {
          await updateStatsForId(
            id,
            v,
            rankSelect.val(),
            parseInt(replacedInput.val(), 10) || 1
          );
        }
      });

      $html.find("#decrease-level").on("click", async () => {
        const v = Math.max(5, parseInt(levelInput.val(), 10) - 5);
        levelInput.val(v);
        const selected = $html.find(".list-item.selected");
        const id = selected.data("id");
        if (id) {
          await updateStatsForId(
            id,
            v,
            rankSelect.val(),
            parseInt(replacedInput.val(), 10) || 1
          );
        }
      });

      // List selection
      listItems.on("click", async function() {
        listItems.removeClass("selected");
        $(this).addClass("selected");

        const id         = $(this).data("id");
        const indexEntry = actorIndexData.find(a => a.id === id);
        if (indexEntry) {
          imageElement.attr("src", indexEntry.img);
        }

        const lvl  = parseInt(levelInput.val(), 10) || 5;
        const rank = rankSelect.val();
        const repl = parseInt(replacedInput.val(), 10) || 1;
        await updateStatsForId(id, lvl, rank, repl);
      });

      // Filters (search + folder)
      searchInput.on("input", filterList);
      folderSelect.on("change", () => {
        filterList();
        // Optionally, auto-select first visible entry in that folder
        const visible = $html.find(".list-item:visible").first();
        if (visible.length) {
          listItems.removeClass("selected");
          visible.addClass("selected");
        }
      });

      // Rank change → show/hide replaced soldiers and recompute stats
      rankSelect.on("change", async () => {
        const isChamp = rankSelect.val() === "champion";
        $html.find("#replaced-soldiers-cell").toggle(isChamp);

        const selected = $html.find(".list-item.selected");
        const id = selected.data("id");
        if (id) {
          const lvl  = parseInt(levelInput.val(), 10) || 5;
          const repl = parseInt(replacedInput.val(), 10) || 1;
          await updateStatsForId(id, lvl, rankSelect.val(), repl);
        }
      });

      // Add button → add small prototype token previews onto the scene preview
      addButton.on("click", async () => {
        const selected = $html.find(".list-item.selected");
        if (!selected.length) {
          ui.notifications.error("No creature selected to add.");
          return;
        }

        const id = selected.data("id");
        const qty = Math.max(1, parseInt($html.find("#creature-quantity").val(), 10) || 1);

        const actor = await pack.getDocument(id);
        if (!actor) {
          ui.notifications.error("Actor not found in compendium.");
          return;
        }

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

          const $img = $(
            `<img class="preview-token" src="${lfEsc(texSrc)}">`
          );

          $img.css({
            left: `${left}px`,
            top: `${top}px`
          });

          tokensLayer.append($img);
        }
      });

      // Initial filter pass
      filterList();
    }
  };

  new Dialog(dialogData, renderOptions).render(true);
}

// ---------------------------------------------------------------------------
// Hook Registration
// ---------------------------------------------------------------------------
Hooks.once("ready", () => {
  game.lookfar ??= {};

  // Expose function
  game.lookfar.conflictBuilder = openConflictBuilderDialog;

  // Toolbar button hook
  Hooks.on("lookfarShowConflictBuilderDialog", openConflictBuilderDialog);
});
