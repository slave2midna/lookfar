// Lookfar GM: Battle Summon Dialog (Foundry v13+)
// - Shows a preview of the current scene (background + first terrain tile) and a music dropdown.
// - Lets you pick a point on the canvas by clicking.
// - Creates tokens directly on the active scene from the actor's prototype token.
// - Adjusts level, rank, HP/MP on the token's synthetic actor.

// ----- CONFIG -----
const LOOKFAR_SUMMONER_CONFIG = {
  folderName: "Bestiary", // Replace with your actor folder name if needed
  playlistNames: ["Normal Battle", "Decisive Battle", "Final Battle"] // For the music dropdown
};
// ------------------

// Helper: get all actors in a folder (recursively)
function lookfarGetAllActorsInFolder(folder) {
  const actors = game.actors.filter(actor => actor.folder?.id === folder.id);

  const subfolders = game.folders.filter(f => f.type === "Actor" && f.folder?.id === folder.id);
  for (const subfolder of subfolders) {
    actors.push(...lookfarGetAllActorsInFolder(subfolder));
  }
  return actors;
}

// Helper: let the user click on the canvas to choose a position
async function lookfarPickCanvasPosition() {
  if (!canvas?.scene) {
    ui.notifications.error("No active scene to place the summon on.");
    throw new Error("No active scene");
  }

  return new Promise(resolve => {
    ui.notifications.info("Click on the scene to place the summon.");

    const stage = canvas.app.stage;
    const originalMode = stage.eventMode ?? "auto";

    // Ensure the stage itself receives pointer events
    stage.eventMode = "static";

    const handler = event => {
      // Clean up listener & restore mode
      stage.off("pointerdown", handler);
      stage.eventMode = originalMode;

      // Get coordinates in token-layer space
      const pos = event.getLocalPosition(canvas.tokens);
      const snapped = canvas.grid.getSnappedPosition(pos.x, pos.y, 1);

      resolve({ x: snapped.x, y: snapped.y });
    };

    stage.on("pointerdown", handler);
  });
}

// Main entry point: opens the dialog
async function openBattleSummonDialog() {
  const { folderName, playlistNames } = LOOKFAR_SUMMONER_CONFIG;

  // ---- SCENE PREVIEW DATA ----
  const scene = canvas.scene;
  if (!scene) {
    ui.notifications.error("No active scene.");
    return;
  }

  const currentBackground = scene.background?.src || "";
  const currentTerrain = scene.tiles?.contents[0]?.texture?.src || "";

  // Music dropdown options (no behavior wired yet)
  const playlistOptions =
    `<option value="default">Default</option>` +
    game.playlists
      .filter(pl => playlistNames.includes(pl.name))
      .map(pl => `<option value="${pl.id}">${pl.name}</option>`)
      .join("");

  // ---- FOLDER LOOKUP ----
  const folder = game.folders.find(f => f.name === folderName && f.type === "Actor");
  if (!folder) {
    ui.notifications.error(`Folder "${folderName}" not found.`);
    return;
  }

  const actorsInFolder = lookfarGetAllActorsInFolder(folder);
  if (!actorsInFolder.length) {
    ui.notifications.error(`No actors found in folder "${folderName}" or its subfolders.`);
    return;
  }

  // ---- PREP DATA FOR DIALOG ----
  const actorData = actorsInFolder.map(actor => ({
    name: actor.name,
    id: actor.id,
    img: actor.img || "icons/svg/mystery-man.svg",
    folder: actor.folder?.id || "root"
  })).sort((a, b) => a.name.localeCompare(b.name));

  const renderOptions = {
    id: "summonDialogID",
    height: "600px",
    width: "400px"
  };

  const dialogData = {
    title: `Summon Creature`,
    content: `
      <form>
        <style>
          #summonDialogID .dialog-body {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            width: 380px;
            height: 190px;
            gap: 8px;
          }
          #summonDialogID .preview-image {
            width: 190px;
            height: 190px;
            object-fit: contain;
            overflow: hidden;
            display: block;
          }
          #summonDialogID .form-fields {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            width: 190px;
            height: 297px;
            gap: 8px;
          }
          #summonDialogID .form-group {
            margin-bottom: 6px;
          }
          #summonDialogID .scrollable-list {
            width: 100%;
            height: 297px;
            overflow-y: auto;
            padding: 4px;
          }
          #summonDialogID .list-item {
            padding: 4px;
            cursor: pointer;
            border-radius: 4px;
            margin-bottom: 4px;
          }
          #summonDialogID .actor-attributes {
            font-size: 14px;
            margin-top: 8px;
            text-align: left;
            width: 190px;
          }
        </style>

        <!-- TOP: Scene Preview + Music -->
        <div style="margin-bottom: 10px;">
          <div style="padding: 5px; border: 1px solid #ccc; margin-bottom: 8px;">
            <h4 style="margin: 0 0 4px 0;">Scene Preview</h4>
            <div style="position: relative; width: 100%; height: 200px; margin: 0 auto; border: 1px solid #ccc; overflow: hidden;">
              <img id="background-preview" src="${currentBackground}" 
                   style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; object-fit: cover; z-index: 1;" />
              <img id="terrain-preview" src="${currentTerrain}" 
                   style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; object-fit: cover; z-index: 2;" />
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label for="playlist-select" style="white-space: nowrap;">Music:</label>
            <select id="playlist-select" style="flex: 1; box-sizing: border-box;">
              ${playlistOptions}
            </select>
          </div>
        </div>

        <!-- MIDDLE: Monster preview + list (existing two-column layout) -->
        <div class="dialog-body">
          <div>
            <img id="creature-image" src="${actorData[0].img}" alt="Creature Image" class="preview-image">
          </div>
          <div class="form-fields">
            <div class="form-group">
              <label for="folder-filter" style="margin-bottom: 2px;">Select Type:</label>
              <select id="folder-filter" style="width: 100%;">
                <option value="all">All</option>
                ${game.folders
                  .filter(f => f.type === "Actor" && f.folder?.id === folder.id)
                  .map(f => `<option value="${f.id}">${f.name}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <input type="text" id="search-input" placeholder="Search..." style="width: 100%; padding: 4px;">
            </div>
            <div class="scrollable-list">
              ${actorData.map(actor => `
                <div class="list-item" data-id="${actor.id}" data-folder="${actor.folder}">
                  ${actor.name}
                </div>
              `).join("")}
            </div>

            <div class="form-group">
              <label>Quantity:</label>
              <input type="number" id="creature-quantity" value="1" min="1" max="10" style="width: 100%; padding: 4px;">
            </div>
          </div>
        </div>

        <!-- BOTTOM: Stat preview + level/rank controls -->
        <div class="actor-attributes">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 30px; padding-right: 5px;">HP:</td>
              <td id="creature-hp" style="text-align: left; width: auto;">--</td>
              <td style="width: 30px; padding-right: 5px;">MP:</td>
              <td id="creature-mp" style="text-align: left; width: auto;">--</td>
              <td style="width: 30px; padding-right: 5px;">Init:</td>
              <td id="creature-init" style="text-align: left; width: auto;">--</td>
            </tr>
          </table>

          <div style="display: flex; align-items: center; justify-content: flex-start; width: 100%; margin: 4px 0 0 0; padding: 0;">
            <label for="creature-level" style="width: 35px;">Level:</label>
            <div style="display: flex; align-items: center; margin-left: 10px; gap: 4px;">
              <button id="decrease-level" type="button" style="width: 30px;">-</button>
              <input type="number" id="creature-level" value="5" min="5" max="60" step="5" style="width: 40px; text-align: center;">
              <button id="increase-level" type="button" style="width: 30px;">+</button>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: flex-start; width: 100%; margin-top: 5px; padding: 0; margin-bottom: 5px;">
            <label for="creature-rank" style="width: 35px;">Rank:</label>
            <div style="display: flex; align-items: center; margin-left: 10px;">
              <select id="creature-rank" style="width: 95px; margin-right: 0px;">
                <option value="soldier">Soldier</option>
                <option value="elite">Elite</option>
                <option value="champion">Champion</option>
              </select>
            </div>
            <div id="replaced-soldiers-cell" style="display: none; padding-left: 5px; width: 50px;">
              <input type="number" id="replaced-soldiers" value="1" min="1" max="6" style="width: 40px; text-align: center;" placeholder="1">
            </div>
          </div>
        </div>
      </form>
    `,
    buttons: {
      summon: {
        label: "Summon",
        callback: async (html) => {
          const $html = html instanceof HTMLElement ? $(html) : html;

          const selectedItem = $html.find(".list-item.selected");
          const actorId = selectedItem.data("id");
          const quantity = parseInt($html.find("#creature-quantity").val(), 10);
          const level = parseInt($html.find("#creature-level").val(), 10);
          const rank = $html.find("#creature-rank").val();
          const replacedSoldiers = rank === "champion"
            ? Math.max(1, parseInt($html.find("#replaced-soldiers").val() || 1, 10))
            : 1;

          const originalActor = game.actors.get(actorId);
          if (!originalActor) {
            ui.notifications.error("Actor not found.");
            return;
          }

          if (!canvas?.scene) {
            ui.notifications.error("No active scene.");
            return;
          }

          // Ask user where to place the summon
          const basePos = await lookfarPickCanvasPosition();

          // Build token data array from the actor's prototype token
          const baseTokenData = originalActor.prototypeToken.toObject();
          const tokenSize = canvas.grid.size;

          const tokensToCreate = [];
          for (let i = 0; i < quantity; i++) {
            const dx = (i % 5) * tokenSize;
            const dy = Math.floor(i / 5) * tokenSize;

            const tokenData = foundry.utils.duplicate(baseTokenData);
            tokenData.x = basePos.x + dx;
            tokenData.y = basePos.y + dy;

            tokensToCreate.push(tokenData);
          }

          // Create tokens on the scene
          const createdTokenDocs = await canvas.scene.createEmbeddedDocuments("Token", tokensToCreate);

          // Update each token's synthetic actor with level/rank and set HP/MP to max
          for (const tokenDoc of createdTokenDocs) {
            const syntheticActor = tokenDoc.actor;
            if (!syntheticActor) continue;

            await syntheticActor.update({
              "system.level.value": level,
              "system.rank.value": rank,
              "system.rank.replacedSoldiers": replacedSoldiers
            });

            const maxHP = syntheticActor.system.resources.hp.max;
            const maxMP = syntheticActor.system.resources.mp.max;

            await syntheticActor.update({
              "system.resources.hp.value": maxHP,
              "system.resources.mp.value": maxMP
            });

            console.log(`Summoned ${syntheticActor.name} at (${tokenDoc.x}, ${tokenDoc.y}) with level ${level}, rank ${rank}.`);
          }

          // NOTE: playlist-select exists but is *not* wired yet, per your request.
        }
      },
      cancel: {
        label: "Cancel"
      }
    },
    default: "summon",
    render: html => {
      const $html = html instanceof HTMLElement ? $(html) : html;

      const levelInput = $html.find("#creature-level");
      const rankSelect = $html.find("#creature-rank");
      const replacedSoldiersInput = $html.find("#replaced-soldiers");
      const imageElement = $html.find("#creature-image");
      const listItems = $html.find(".list-item");
      const searchInput = $html.find("#search-input");

      listItems.first().addClass("selected");

      $html.find("#increase-level").on("click", function() {
        let currentValue = parseInt(levelInput.val(), 10);
        if (currentValue < 60) {
          levelInput.val(currentValue + 5);
        }
      });

      $html.find("#decrease-level").on("click", function() {
        let currentValue = parseInt(levelInput.val(), 10);
        if (currentValue > 5) {
          levelInput.val(currentValue - 5);
        }
      });

      function filterList() {
        const searchTerm = (searchInput.val() || "").toString().toLowerCase();
        const selectedFolder = $html.find("#folder-filter").val();

        listItems.each(function() {
          const item = $(this);
          const itemName = item.text().toLowerCase();
          const itemFolder = item.data("folder");

          const matchesSearch = itemName.includes(searchTerm);
          const matchesFolder = selectedFolder === "all" || itemFolder === selectedFolder;

          if (matchesSearch && matchesFolder) {
            item.show();
          } else {
            item.hide();
          }
        });
      }

      searchInput.on("input", filterList);
      $html.find("#folder-filter").on("change", filterList);

      listItems.on("click", async function() {
        listItems.removeClass("selected");
        $(this).addClass("selected");

        const selectedId = $(this).data("id");
        const selectedActorData = actorData.find(actor => actor.id === selectedId);
        imageElement.attr("src", selectedActorData.img);
        const actorDocument = game.actors.get(selectedId);

        if (!actorDocument) {
          ui.notifications.error("Actor not found.");
          return;
        }

        levelInput.val(actorDocument.system.level.value ?? 5);

        const dex = actorDocument.system.attributes.dex.base;
        const ins = actorDocument.system.attributes.ins.base;
        const mig = actorDocument.system.attributes.mig.base;
        const wlp = actorDocument.system.attributes.wlp.base;

        function calculateStats(level, rank, replacedSoldiers = 1) {
          const initBase = (dex + ins) / 2;
          const maxHpBase = (level * 2) + (mig * 5);
          const maxMpBase = level + (wlp * 5);

          let init, maxHp, maxMp;
          if (rank === "soldier") {
            init = initBase;
            maxHp = maxHpBase;
            maxMp = maxMpBase;
          } else if (rank === "elite") {
            init = initBase + 2;
            maxHp = maxHpBase * 2;
            maxMp = maxMpBase;
          } else if (rank === "champion") {
            init = initBase + replacedSoldiers;
            maxHp = maxHpBase * replacedSoldiers;
            maxMp = maxMpBase * 2;
          }

          return {
            init: Math.round(init),
            maxHp: Math.round(maxHp),
            maxMp: Math.round(maxMp)
          };
        }

        function updateDisplayedStats() {
          const level = parseInt(levelInput.val(), 10);
          const rank = rankSelect.val();
          const replacedSoldiers =
            rank === "champion" ? (parseInt(replacedSoldiersInput.val(), 10) || 1) : 1;

          const { init, maxHp, maxMp } = calculateStats(level, rank, replacedSoldiers);
          $html.find("#creature-hp").text(maxHp);
          $html.find("#creature-mp").text(maxMp);
          $html.find("#creature-init").text(init);
        }

        updateDisplayedStats();

        $html.find("#increase-level, #decrease-level").off("click.stats").on("click.stats", updateDisplayedStats);
        rankSelect.off("change.stats").on("change.stats", updateDisplayedStats);
        replacedSoldiersInput.off("input.stats").on("input.stats", updateDisplayedStats);
      });

      rankSelect.on("change", () => {
        const cell = $html.find("#replaced-soldiers-cell");
        if (rankSelect.val() === "champion") {
          cell.show();
          replacedSoldiersInput.val(replacedSoldiersInput.val() || 1);
        } else {
          cell.hide();
        }
      });
    }
  };

  new Dialog(dialogData, renderOptions).render(true);
}

// Expose to the Lookfar GM module (or any other caller)
Hooks.once("ready", () => {
  game.lookfar ??= {};

  // Direct function access (if you ever want to call it from elsewhere)
  game.lookfar.battleSummoner = openBattleSummonDialog;

  // This is what your toolbar button calls:
  // Hooks.call("lookfarShowQuickEncounterDialog");
  Hooks.on("lookfarShowQuickEncounterDialog", openBattleSummonDialog);
});
