import { dataLoader } from "./dataLoader.js";

let _travelCheckDialog = null;
let currentDialog = null;

// Template paths (must match your module folder structure)
const TRAVEL_CHECK_TEMPLATE = "modules/lookfar/templates/travel-check.hbs";
const TRAVEL_RESULT_TEMPLATE = "modules/lookfar/templates/travel-result.hbs";

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
      const visibility = game.settings.get("lookfar", "resultVisibility");
      const isGM = game.user.isGM;

      // Show only to GM if setting is "gmOnly"
      if (visibility === "gmOnly" && !isGM) return;

      showRerollDialog(
        data.resultData,
        data.selectedDifficulty,
        data.groupLevel,
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
    "LOOKFAR.TravelCheck.Dialogs.TravelCheck.Difficulty.Minimal": "d6",
    "LOOKFAR.TravelCheck.Dialogs.TravelCheck.Difficulty.Low": "d8",
    "LOOKFAR.TravelCheck.Dialogs.TravelCheck.Difficulty.Medium": "d10",
    "LOOKFAR.TravelCheck.Dialogs.TravelCheck.Difficulty.High": "d12",
    "LOOKFAR.TravelCheck.Dialogs.TravelCheck.Difficulty.VeryHigh": "d20",
  };
}

// -----------------------------------------------------------------------------
// Travel Check Dialog
// -----------------------------------------------------------------------------

async function showTravelCheckDialog() {
  console.log("Opening Travel Check dialog...");

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
  return diceMap[diceSize] || diceSize;
}

function getTravelDamageBySeverity(groupLevel, severity) {
  const damageTable = {
    "5+": { minor: 10, heavy: 30, massive: 40 },
    "20+": { minor: 20, heavy: 40, massive: 60 },
    "40+": { minor: 30, heavy: 50, massive: 80 },
  };

  const levelValues = damageTable[String(groupLevel).trim()] ?? damageTable["5+"];
  return levelValues[severity] ?? levelValues.minor;
}

function rollDangerDamage(groupLevel) {
  const severities = ["minor", "heavy", "massive"];
  const severity = severities[Math.floor(Math.random() * severities.length)];
  return getTravelDamageBySeverity(groupLevel, severity);
}

function applyDangerPlaceholders(text, groupLevel) {
  if (!text) return text;

  const dmg = rollDangerDamage(groupLevel);
  return String(text).replaceAll("{dmg}", String(dmg));
}

function buildResultData({ titleText = "", noIncident = "", effectText = "", sourceText = "", keywords = null }) {
  return {
    titleText,
    noIncident,
    showEffect: Boolean(effectText),
    effectText,
    sourceText,
    keywords,
  };
}

async function handleRoll(selectedDifficulty, html) {
  const wellTraveled = html.find("#wellTraveled").is(":checked");

  // Reduce the dice size if Well-Traveled is checked
  let effectiveDifficulty = selectedDifficulty;
  if (wellTraveled) {
    effectiveDifficulty = reduceDiceSize(selectedDifficulty);
  }

  const roll = new Roll(effectiveDifficulty);
  await roll.evaluate();

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

  const groupLevel = html.find("#groupLevel").val();

  let resultData = null;
  const treasureHunterLevel = parseInt(html.find("#treasureHunterLevelInput").val());
  const isDiscovery = shouldMakeDiscovery(roll.total, treasureHunterLevel);
  let outcomeType = "none";

  if (roll.total >= 6) {
    outcomeType = "danger";

    const titleText = game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TravelResult.Result.Danger");
    const dangerResult = await generateDanger(groupLevel);

    resultData = buildResultData({
      titleText,
      effectText: dangerResult.effectText,
      sourceText: dangerResult.sourceText,
      keywords: dangerResult.keywords,
    });
  } else if (isDiscovery) {
    outcomeType = "discovery";

    const titleText = game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TravelResult.Result.Discovery");
    const discoveryResult = await generateDiscovery(groupLevel);

    resultData = buildResultData({
      titleText,
      effectText: discoveryResult.effectText,
      sourceText: discoveryResult.sourceText,
      keywords: discoveryResult.keywords,
    });
  } else {
    outcomeType = "none";

    resultData = buildResultData({
      noIncident: game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TravelResult.NoIncident"),
    });
  }

  // Emit the result to all clients
  game.socket.emit("module.lookfar", {
    type: "showResult",
    resultData,
    selectedDifficulty: effectiveDifficulty,
    groupLevel,
    outcomeType,
  });

  const visibility = game.settings.get("lookfar", "resultVisibility");
  const isGM = game.user.isGM;

  // Show dialog locally only if it's public, or this user is a GM
  if (visibility === "public" || isGM) {
    showRerollDialog(resultData, effectiveDifficulty, groupLevel, outcomeType);
  }
}

// -----------------------------------------------------------------------------
// Reroll / Result Dialog
// -----------------------------------------------------------------------------

async function showRerollDialog(resultData, selectedDifficulty, groupLevel, outcomeType) {
  const isDanger = outcomeType === "danger";
  const isDiscovery = outcomeType === "discovery";

  // Close the existing dialog if it's open
  if (currentDialog) currentDialog.close();

  const isGM = game.user.isGM;

  const buttons = isGM
    ? {
        keep: {
          icon: '<i class="fas fa-check"></i>',
          callback: async () => {
            const chatContent = await renderTemplate(TRAVEL_RESULT_TEMPLATE, {
              ...resultData,
              promptText: "",
            });

            ChatMessage.create({
              content: chatContent,
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

            let newResultData = null;

            if (isDanger) {
              const titleText = game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TravelResult.Result.Danger");
              const dangerResult = await generateDanger(groupLevel);

              newResultData = buildResultData({
                titleText,
                effectText: dangerResult.effectText,
                sourceText: dangerResult.sourceText,
                keywords: dangerResult.keywords,
              });
            } else if (isDiscovery) {
              const titleText = game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TravelResult.Result.Discovery");
              const discoveryResult = await generateDiscovery(groupLevel);

              newResultData = buildResultData({
                titleText,
                effectText: discoveryResult.effectText,
                sourceText: discoveryResult.sourceText,
                keywords: discoveryResult.keywords,
              });
            } else {
              return;
            }

            // Emit the new result to all clients
            game.socket.emit("module.lookfar", {
              type: "showResult",
              resultData: newResultData,
              selectedDifficulty,
              groupLevel,
              outcomeType,
            });

            await showRerollDialog(newResultData, selectedDifficulty, groupLevel, outcomeType);
          },
        },
      }
    : {};

  const promptKey = isGM
    ? "LOOKFAR.TravelCheck.Dialogs.TravelResult.Prompt"
    : "LOOKFAR.TravelCheck.Dialogs.TravelResult.Waiting";

  const content = await renderTemplate(TRAVEL_RESULT_TEMPLATE, {
    ...resultData,
    promptText: game.i18n.localize(promptKey),
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

  const effectTableId = game.settings.get("lookfar", "dangerEffectRollTable");
  const sourceTableId = game.settings.get("lookfar", "dangerSourceRollTable");

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

  // Resolve any dynamic damage placeholder using a hidden severity roll
  effectText = applyDangerPlaceholders(effectText, groupLevel);

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
    effectText,
    sourceText,
    keywords,
  };
}

// -----------------------------------------------------------------------------
// Discovery Generation
// -----------------------------------------------------------------------------

async function generateDiscovery(groupLevel) {
  console.log("Generating Discovery...");

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

  effectText = applyDangerPlaceholders(effectText, groupLevel);

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

  return {
    effectText,
    sourceText,
    keywords,
  };
}
