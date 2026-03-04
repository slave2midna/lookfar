import { dataLoader } from "./dataLoader.js";

let _travelCheckDialog = null;
let currentDialog = null;

// Template paths (must match your module folder structure)
const TRAVEL_CHECK_TEMPLATE  = "modules/lookfar/templates/travel-check.hbs";
const TRAVEL_RESULT_TEMPLATE = "modules/lookfar/templates/travel-result.hbs";

// -----------------------------------------------------------------------------
// Utility functions
// -----------------------------------------------------------------------------

// Function to set default "Discovery" rolltable options. Will update for multiple table settings.
function getRollTableChoices() {
  const choices = { default: game.i18n.localize("LOOKFAR.Settings.DefaultRollTable") }; // Add "Default" option
  if (game.tables) {
    const tables = game.tables.contents; // Use .contents instead of .entities
    tables.forEach((table) => {
      choices[table.id] = table.name;
    });
  }
  return choices;
}

// Function to generate a unique list of items
function generateUniqueList(list, minCount, maxCount) {
  const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
  const shuffled = list.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// -----------------------------------------------------------------------------
// Socket handling
// -----------------------------------------------------------------------------

Hooks.once("ready", () => {
  game.socket.on("module.lookfar", (data) => {
    if (data?.type === "showResult") {
      const visibility = game.settings.get("lookfar", "resultVisibility"); // still using old key internally
      const isGM = game.user.isGM;

      // Show only to GM if setting is "gmOnly"
      if (visibility === "gmOnly" && !isGM) return;

      showRerollDialog(
        data.resultHtml,
        data.selectedDifficulty,
        data.groupLevel,
        data.keywords,
        data.outcomeType
      );
    } else if (data?.type === "closeDialog") {
      if (currentDialog) currentDialog.close();
    }
  });
});

// -----------------------------------------------------------------------------
// Travel Rolls definition
// -----------------------------------------------------------------------------

class TravelRolls {
  static travelChecks = {
    "LOOKFAR.TravelCheck.Difficulty.Minimal": "d6",
    "LOOKFAR.TravelCheck.Difficulty.Low": "d8",
    "LOOKFAR.TravelCheck.Difficulty.Medium": "d10",
    "LOOKFAR.TravelCheck.Difficulty.High": "d12",
    "LOOKFAR.TravelCheck.Difficulty.VeryHigh": "d20",
  };
}

// -----------------------------------------------------------------------------
// Travel Check Dialog
// -----------------------------------------------------------------------------

async function showTravelCheckDialog() {
  console.log("Opening Travel Check dialog...");

  // Build context for Handlebars template from existing TravelRolls map
  const travelChecks = Object.entries(TravelRolls.travelChecks).map(([labelKey, die]) => ({
    labelKey,
    die,
  }));

  const formHtml = await renderTemplate(TRAVEL_CHECK_TEMPLATE, { travelChecks });

  const dlg = new Dialog({
    title: game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TravelCheck.Title"),
    content: formHtml,
    buttons: {
      roll: {
        icon: '<i class="fas fa-check"></i>',
        callback: (html) => {
          const selectedDifficulty = html.find('[name="travelCheck"]:checked').val();
          const groupLevel = html.find("#groupLevel").val();
          const treasureHunterLevel = html.find("#treasureHunterLevelInput").val();
          const wellTraveled = html.find("#wellTraveled").is(":checked");

          // Store these values
          localStorage.setItem("lookfar-groupLevel", groupLevel);
          localStorage.setItem("lookfar-treasureHunterLevel", treasureHunterLevel);
          localStorage.setItem("lookfar-wellTraveled", wellTraveled);

          handleRoll(selectedDifficulty, html);
        },
      },
    },
    default: "roll",
    render: (html) => {
      // Restore previous values
      const savedGroupLevel = localStorage.getItem("lookfar-groupLevel") || "5+";
      const savedTreasureHunterLevel = parseInt(
        localStorage.getItem("lookfar-treasureHunterLevel") || "0"
      );
      const savedWellTraveled = localStorage.getItem("lookfar-wellTraveled") === "true";

      // Restore Group Level dropdown
      html.find("#groupLevel").val(savedGroupLevel);

      // Restore Treasure Hunter stars
      html.find("#treasureHunterLevelInput").val(savedTreasureHunterLevel);
      html.find("#treasureHunterLevel i").each(function () {
        const starVal = Number($(this).data("value"));
        $(this)
          .removeClass("fa-solid fa-regular")
          .addClass(starVal <= savedTreasureHunterLevel ? "fa-solid" : "fa-regular");
      });

      // Treasure Hunter logic
      const stars = html.find("#treasureHunterLevel i");
      stars.on("click", function () {
        const clickedValue = Number($(this).data("value"));
        const currentValue = Number(html.find("#treasureHunterLevelInput").val());
        const newValue = clickedValue === currentValue ? 0 : clickedValue;

        html.find("#treasureHunterLevelInput").val(newValue);

        stars.each(function () {
          const starVal = Number($(this).data("value"));
          $(this)
            .removeClass("fa-solid fa-regular")
            .addClass(starVal <= newValue ? "fa-solid" : "fa-regular");
        });
      });

      // Well-Traveled checkbox logic
      html.find("#wellTraveled").on("change", (e) => {
        const isChecked = e.target.checked;
        const diceMap = {
          d8: "d6",
          d10: "d8",
          d12: "d10",
          d20: "d12",
        };

        html.find(".dice-display").each(function () {
          const original = $(this).data("original");
          $(this).text(isChecked ? diceMap[original] || original : original);
        });
      });

      // Restore Well-Traveled checkbox and immediately trigger dice display update
      html.find("#wellTraveled").prop("checked", savedWellTraveled).trigger("change");
    },
    close: () => {
      _travelCheckDialog = null;
    },
  });

  _travelCheckDialog = dlg;
  dlg.render(true);
}

// Singleton per client: open/bring-to-front hook
Hooks.on("lookfarShowTravelCheckDialog", () => {
  if (_travelCheckDialog && _travelCheckDialog.rendered) {
    _travelCheckDialog.bringToTop();
    return;
  }
  showTravelCheckDialog();
});

// -----------------------------------------------------------------------------
// Roll handling
// -----------------------------------------------------------------------------

function shouldMakeDiscovery(rollResult, treasureHunterLevel) {
  return rollResult <= 1 + treasureHunterLevel;
}

// Reduces the dice size for well-traveled setting
function reduceDiceSize(diceSize) {
  const diceMap = { d8: "d6", d10: "d8", d12: "d10", d20: "d12" };
  return diceMap[diceSize] || diceSize; // Returns the reduced size, or the original if not found
}

async function handleRoll(selectedDifficulty, html) {
  const wellTraveled = html.find("#wellTraveled").is(":checked");

  // Reduce the dice size if Well-Traveled is checked
  let effectiveDifficulty = selectedDifficulty;
  if (wellTraveled) {
    effectiveDifficulty = reduceDiceSize(selectedDifficulty);
  }

  const roll = new Roll(effectiveDifficulty);
  await roll.evaluate({ async: true });

  // Post the roll to chat (v13 method)
  const speaker = ChatMessage.getSpeaker({
    alias: game.i18n.localize("LOOKFAR.TravelCheck.Chat.Alias.Roll"),
  });
  const chatMessage = await roll.toMessage(
    { speaker, user: game.user.id, flavor: null },
    { rollMode: game.settings.get("core", "rollMode") }
  );

  // Dice So Nice wait
  if (game.dice3d) {
    await new Promise((resolve) => {
      const hookId = Hooks.on("diceSoNiceRollComplete", (messageId) => {
        if (messageId === chatMessage.id) {
          Hooks.off("diceSoNiceRollComplete", hookId);
          resolve();
        }
      });
    });
  }

  // Determine the group level set by the GM
  const groupLevel = html.find("#groupLevel").val();

  let resultHtml = "";
  let keywords = null; // keyword data object or null
  const treasureHunterLevel = parseInt(html.find("#treasureHunterLevelInput").val());
  const isDiscovery = shouldMakeDiscovery(roll.total, treasureHunterLevel);
  let outcomeType = "none";

  if (roll.total >= 6) {
    outcomeType = "danger";

    // Single label (no severity)
    const resultType = game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.Result.Danger");

    const dangerResult = await generateDanger(groupLevel);
    keywords = dangerResult.keywords;

    resultHtml = `
      <div style="text-align: center; font-weight: bold; font-size: 1.2rem; margin-bottom: 10px;">
        ${resultType}
      </div>
      ${dangerResult.html}
    `;
  } else if (isDiscovery) {
    outcomeType = "discovery";
    const resultType = game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.Result.Discovery");
    const discoveryResult = await generateDiscovery();
    keywords = discoveryResult.keywords;

    resultHtml = `
      <div style="text-align: center; font-weight: bold; font-size: 1.2rem; margin-bottom: 10px;">
        ${resultType}
      </div>
      ${discoveryResult.html}
    `;
  } else {
    outcomeType = "none";
    resultHtml = `
      <div style="text-align: center; font-size: 1.2rem;">
        ${game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TravelResult.NoIncident")}
      </div>
    `;
  }

  // Emit the result to all clients
  game.socket.emit("module.lookfar", {
    type: "showResult",
    resultHtml,
    selectedDifficulty: effectiveDifficulty,
    groupLevel,
    keywords,
    outcomeType,
  });

  const visibility = game.settings.get("lookfar", "resultVisibility");
  const isGM = game.user.isGM;

  // Show dialog locally only if it's public, or this user is a GM
  if (visibility === "public" || isGM) {
    showRerollDialog(resultHtml, effectiveDifficulty, groupLevel, keywords, outcomeType);
  }
}

// -----------------------------------------------------------------------------
// Reroll / Result Dialog
// -----------------------------------------------------------------------------

async function showRerollDialog(
  resultHtml,
  selectedDifficulty,
  groupLevel,
  keywords,
  outcomeType
) {
  const isDanger = outcomeType === "danger";
  const isDiscovery = outcomeType === "discovery";

  // Close the existing dialog if it's open
  if (currentDialog) currentDialog.close();

  const isGM = game.user.isGM;

  const buttons = isGM
    ? {
        keep: {
          icon: '<i class="fas fa-check"></i>',
          callback: () => {
            // Post just the body of the result to chat (no prompt, no keywords table)
            ChatMessage.create({
              content: `<div style="text-align: center;">${resultHtml}</div>`,
              speaker: {
                alias: game.i18n.localize("LOOKFAR.TravelCheck.Chat.Alias.Result"),
              },
            });

            // Emit a message to close the dialog on all clients
            game.socket.emit("module.lookfar", { type: "closeDialog" });

            // Close the dialog locally
            if (currentDialog) currentDialog.close();
          },
        },
        reroll: {
          icon: '<i class="fas fa-redo"></i>',
          callback: async () => {
            if (outcomeType === "none") return;

            let newResultHtml;
            let newKeywords = null;

            if (isDanger) {
              const resultType = game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.Result.Danger");
              const dangerResult = await generateDanger(groupLevel);
              newKeywords = dangerResult.keywords;

              newResultHtml = `
                <div style="text-align: center; font-weight: bold; font-size: 1.2rem; margin-bottom: 10px;">
                  ${resultType}
                </div>
                ${dangerResult.html}
              `;
            } else if (isDiscovery) {
              const resultType = game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.Result.Discovery");
              const discoveryResult = await generateDiscovery();
              newKeywords = discoveryResult.keywords;

              newResultHtml = `
                <div style="text-align: center; font-weight: bold; font-size: 1.2rem; margin-bottom: 10px;">
                  ${resultType}
                </div>
                ${discoveryResult.html}
              `;
            } else {
              return;
            }

            // Emit the new result to all clients
            game.socket.emit("module.lookfar", {
              type: "showResult",
              resultHtml: newResultHtml,
              selectedDifficulty,
              groupLevel,
              keywords: newKeywords,
              outcomeType,
            });

            await showRerollDialog(
              newResultHtml,
              selectedDifficulty,
              groupLevel,
              newKeywords,
              outcomeType
            );
          },
        },
      }
    : {}; // Non-GM users don't get any buttons

  const promptKey = isGM
    ? "LOOKFAR.TravelCheck.Dialogs.TravelResult.Prompt"
    : "LOOKFAR.TravelCheck.Dialogs.TravelResult.Waiting";

  const content = await renderTemplate(TRAVEL_RESULT_TEMPLATE, {
    resultHtml,
    promptText: game.i18n.localize(promptKey),
    keywords, // may be null or { traitKeywords, terrainKeywords }
  });

  currentDialog = new Dialog({
    title: game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TravelResult.Title"),
    render: (html) => {
      html.addClass("ff6-dialog");
    },
    content,
    buttons,
    default: "keep",
    close: () => {
      currentDialog = null;
    },
  });

  currentDialog.render(true);
}

// -----------------------------------------------------------------------------
// Keyword helper
// -----------------------------------------------------------------------------

/**
 * Build the keyword data object used by the travel-result.hbs template.
 * Returns either:
 *   null
 * or:
 *   {
 *     traitKeywords: "Abandoned, Ancient, ...",
 *     terrainKeywords: "Forest, Swamp, ..."
 *   }
 */
function generateKeywordsData() {
  if (!game.settings.get("lookfar", "enableKeywords")) return null;

  const kw = dataLoader?.i18nData?.keywords || {};
  const traitWords = Array.isArray(kw?.traits) ? kw.traits : [];
  const terrainWords = Array.isArray(kw?.terrain) ? kw.terrain : [];

  // Copy before shuffle because generateUniqueList uses sort() which mutates arrays
  const selectedTraits = generateUniqueList([...traitWords], 3, 4);
  const selectedTerrain = generateUniqueList([...terrainWords], 3, 4);

  return {
    traitKeywords: selectedTraits.join(", "),
    terrainKeywords: selectedTerrain.join(", "),
  };
}

// -----------------------------------------------------------------------------
// Danger Generation (mirrors Discovery Generation)
// -----------------------------------------------------------------------------

async function generateDanger(groupLevel) {
  console.log("Generating Danger...");

  // Roll table overrides
  const effectTableId = game.settings.get("lookfar", "dangerThreatRollTable");   // "Threat" rolltable -> effect
  const sourceTableId = game.settings.get("lookfar", "dangerSourceRollTable");  // "Source" rolltable -> source

  let effectText = game.i18n.localize("LOOKFAR.TravelCheck.Errors.DataUnavailable");
  let sourceText = game.i18n.localize("LOOKFAR.TravelCheck.Errors.NoDangerSource");

  // -----------------------------
  // Danger Effect
  // -----------------------------
  if (effectTableId && effectTableId !== "default") {
    const rollTable = game.tables.get(effectTableId);
    if (rollTable) {
      console.log(`Rolling on the Danger Effect Roll Table: ${rollTable.name}`);
      const rollResult = await rollTable.draw();
      if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
        effectText = rollResult.results[0].text;
      }
    } else {
      console.error("Selected Danger Effect Roll Table not found. Falling back to defaults.");
    }
  }

  // If we didn't get a rolltable result (or we're using defaults), pull from localized pool
  if (
    effectText === game.i18n.localize("LOOKFAR.TravelCheck.Errors.DataUnavailable") ||
    !effectText
  ) {
    const pool = dataLoader?.dangersData?.effects;
    if (Array.isArray(pool) && pool.length) {
      effectText = pool[Math.floor(Math.random() * pool.length)];
    } else {
      console.error("No danger effects available in dataLoader.dangersData.effects.");
      effectText = game.i18n.localize("LOOKFAR.TravelCheck.Errors.DataUnavailable");
    }
  }

  // -----------------------------
  // Danger Source
  // -----------------------------
  if (sourceTableId && sourceTableId !== "default") {
    const rollTable = game.tables.get(sourceTableId);
    if (rollTable) {
      console.log(`Rolling on the Danger Source Roll Table: ${rollTable.name}`);
      const rollResult = await rollTable.draw();
      if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
        sourceText = rollResult.results[0].text;
      }
    } else {
      console.error("Selected Danger Source Roll Table not found. Falling back to defaults.");
    }
  }

  // If we didn't get a rolltable result (or we're using defaults), pull from localized pool
  if (sourceText === game.i18n.localize("LOOKFAR.TravelCheck.Errors.NoDangerSource")) {
    const pool = dataLoader?.dangersData?.sources;
    if (Array.isArray(pool) && pool.length) {
      sourceText = pool[Math.floor(Math.random() * pool.length)];
    } else {
      console.error("No danger sources available in dataLoader.dangersData.sources.");
    }
  }

  const keywords = generateKeywordsData();

  return {
    html: `
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <th style="padding: 5px; border: 1px solid; white-space: nowrap;">
            ${game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TableHeaders.Effect")}
          </th>
          <td style="padding: 5px; border: 1px solid; text-align: left;">${effectText}</td>
        </tr>
        <tr>
          <th style="padding: 5px; border: 1px solid; white-space: nowrap;">
            ${game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TableHeaders.Source")}
          </th>
          <td style="padding: 5px; border: 1px solid; text-align: left;">${sourceText}</td>
        </tr>
      </table>
    `,
    keywords,
  };
}

// -----------------------------------------------------------------------------
// Discovery Generation
// -----------------------------------------------------------------------------

async function generateDiscovery() {
  console.log("Generating Discovery...");

  // Get the selected roll table IDs for effects and sources
  const effectTableId = game.settings.get("lookfar", "discoveryEffectRollTable");
  const sourceTableId = game.settings.get("lookfar", "discoverySourceRollTable");

  let effectText = game.i18n.localize("LOOKFAR.TravelCheck.Errors.NoDiscoveryEffect");
  let sourceText = game.i18n.localize("LOOKFAR.TravelCheck.Errors.NoDiscoverySource");

  // -----------------------------
  // Discovery Effect
  // -----------------------------
  if (effectTableId && effectTableId !== "default") {
    const rollTable = game.tables.get(effectTableId);
    if (rollTable) {
      console.log(`Rolling on the Discovery Effect Roll Table: ${rollTable.name}`);
      const rollResult = await rollTable.draw();
      if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
        effectText = rollResult.results[0].text;
      }
    } else {
      console.error("Selected Discovery Effect Roll Table not found. Falling back to defaults.");
    }
  }

  // If we didn't get a rolltable result (or we're using defaults), pull from localized pool
  if (effectText === game.i18n.localize("LOOKFAR.TravelCheck.Errors.NoDiscoveryEffect")) {
    const pool = dataLoader?.discoveryData?.effects;
    if (Array.isArray(pool) && pool.length) {
      effectText = pool[Math.floor(Math.random() * pool.length)];
    } else {
      console.error("No discovery effects available in dataLoader.discoveryData.effects.");
    }
  }

  // -----------------------------
  // Discovery Source
  // -----------------------------
  if (sourceTableId && sourceTableId !== "default") {
    const rollTable = game.tables.get(sourceTableId);
    if (rollTable) {
      console.log(`Rolling on the Discovery Source Roll Table: ${rollTable.name}`);
      const rollResult = await rollTable.draw();
      if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
        sourceText = rollResult.results[0].text;
      }
    } else {
      console.error("Selected Discovery Source Roll Table not found. Falling back to defaults.");
    }
  }

  // If we didn't get a rolltable result (or we're using defaults), pull from localized pool
  if (sourceText === game.i18n.localize("LOOKFAR.TravelCheck.Errors.NoDiscoverySource")) {
    const pool = dataLoader?.discoveryData?.sources;
    if (Array.isArray(pool) && pool.length) {
      sourceText = pool[Math.floor(Math.random() * pool.length)];
    } else {
      console.error("No discovery sources available in dataLoader.discoveryData.sources.");
    }
  }

  const keywords = generateKeywordsData();

  // Return HTML + keyword data (keyword table is rendered in HBS)
  return {
    html: `
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <th style="padding: 5px; border: 1px solid; white-space: nowrap;">
            ${game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TableHeaders.Effect")}
          </th>
          <td style="padding: 5px; border: 1px solid; text-align: left;">${effectText}</td>
        </tr>
        <tr>
          <th style="padding: 5px; border: 1px solid; white-space: nowrap;">
            ${game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TableHeaders.Source")}
          </th>
          <td style="padding: 5px; border: 1px solid; text-align: left;">${sourceText}</td>
        </tr>
      </table>
    `,
    keywords,
  };
}

