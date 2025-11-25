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
        data.dangerSeverity,
        data.keywords
      );
    } else if (data?.type === "closeDialog") {
      if (currentDialog) {
        currentDialog.close();
      }
    }
  });
});

// -----------------------------------------------------------------------------
// Travel Rolls definition
// -----------------------------------------------------------------------------

class TravelRolls {
  static travelChecks = {
    Minimal: "d6",
    Low: "d8",
    Medium: "d10",
    High: "d12",
    "Very High": "d20",
  };
}

// -----------------------------------------------------------------------------
// Travel Check Dialog
// -----------------------------------------------------------------------------

async function showTravelCheckDialog() {
  console.log("Opening Travel Check dialog...");

  // Build context for Handlebars template from existing TravelRolls map
  const travelChecks = Object.entries(TravelRolls.travelChecks).map(([label, die]) => ({
    label,
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
  let dangerSeverity = "";

  if (roll.total >= 6) {
    dangerSeverity = await randomSeverity(effectiveDifficulty);

    // Build a single localized key: LOOKFAR.TravelCheck.Dialogs.Result.DangerMinor / Heavy / Massive
    const resultTypeKey = `LOOKFAR.TravelCheck.Dialogs.Result.Danger${dangerSeverity}`;
    const resultType = game.i18n.localize(resultTypeKey);

    const dangerResult = await generateDanger(effectiveDifficulty, groupLevel, dangerSeverity);
    keywords = dangerResult.keywords;

    resultHtml = `
      <div style="text-align: center; font-weight: bold; font-size: 1.2rem; margin-bottom: 10px;">
        ${resultType}
      </div>
      ${dangerResult.html}
    `;
  } else if (isDiscovery) {
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
    dangerSeverity,
    keywords,
  });

  const visibility = game.settings.get("lookfar", "resultVisibility");
  const isGM = game.user.isGM;

  // Show dialog locally only if it's public, or this user is a GM
  if (visibility === "public" || isGM) {
    showRerollDialog(resultHtml, effectiveDifficulty, groupLevel, dangerSeverity, keywords);
  }
}

// -----------------------------------------------------------------------------
// Reroll / Result Dialog
// -----------------------------------------------------------------------------

async function showRerollDialog(
  resultHtml,
  selectedDifficulty,
  groupLevel,
  dangerSeverity,
  keywords
) {
  // Danger vs discovery/no-incident is determined by whether we have a severity
  const isDanger = !!dangerSeverity;

  // Close the existing dialog if it's open
  if (currentDialog) {
    currentDialog.close();
  }

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
            game.socket.emit("module.lookfar", {
              type: "closeDialog",
            });

            // Close the dialog locally
            if (currentDialog) {
              currentDialog.close();
            }
          },
        },
        reroll: {
          icon: '<i class="fas fa-redo"></i>',
          callback: async () => {
            let newResultHtml;
            let newKeywords = null;

            if (isDanger) {
              const severityKey = `LOOKFAR.TravelCheck.Dialogs.Result.Danger${dangerSeverity}`;
              const resultType = game.i18n.localize(severityKey);
              const dangerResult = await generateDanger(
                selectedDifficulty,
                groupLevel,
                dangerSeverity
              );

              newKeywords = dangerResult.keywords;

              newResultHtml = `
                <div style="text-align: center; font-weight: bold; font-size: 1.2rem; margin-bottom: 10px;">
                  ${resultType}
                </div>
                ${dangerResult.html}
              `;
            } else {
              const resultType = game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.Result.Discovery");
              const discoveryResult = await generateDiscovery();
              newKeywords = discoveryResult.keywords;

              newResultHtml = `
                <div style="text-align: center; font-weight: bold; font-size: 1.2rem; margin-bottom: 10px;">
                  ${resultType}
                </div>
                ${discoveryResult.html}
              `;
            }

            // Emit the new result to all clients
            game.socket.emit("module.lookfar", {
              type: "showResult",
              resultHtml: newResultHtml,
              selectedDifficulty,
              groupLevel,
              dangerSeverity,
              keywords: newKeywords,
            });

            await showRerollDialog(
              newResultHtml,
              selectedDifficulty,
              groupLevel,
              dangerSeverity,
              newKeywords
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
// Threat / Discovery Generation
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

  // These are arrays of leaf words now, e.g. ["Abandoned", "Ancient", ...]
  const traitKeys = dataLoader.keywordData?.traits || [];
  const terrainKeys = dataLoader.keywordData?.terrain || [];

  // Pick 3–4 unique leaf words from each list
  const selectedTraits = generateUniqueList(traitKeys, 3, 4);
  const selectedTerrain = generateUniqueList(terrainKeys, 3, 4);

  // Localize using our leaf-word i18n scheme
  const localizedTraits = selectedTraits.map((key) =>
    game.i18n.localize(`LOOKFAR.Keywords.Traits.${key}`)
  );
  const localizedTerrain = selectedTerrain.map((key) =>
    game.i18n.localize(`LOOKFAR.Keywords.Terrain.${key}`)
  );

  return {
    traitKeywords: localizedTraits.join(", "),
    terrainKeywords: localizedTerrain.join(", "),
  };
}

async function generateDanger(selectedDifficulty, groupLevel, dangerSeverity) {
  if (!dataLoader.threatsData || !dataLoader.threatsData.statusEffects) {
    console.error("Threats data is not fully loaded.");
    return {
      html: game.i18n.localize("LOOKFAR.TravelCheck.Errors.DataUnavailable"),
      keywords: null,
    };
  }

  const threatType = randomThreatType();

  // Get the selected danger source roll table
  const dangerSourceTableId = game.settings.get("lookfar", "dangerSourceRollTable");

  // Variable to hold the source text
  let sourceText = game.i18n.localize("LOOKFAR.TravelCheck.Errors.NoDangerSource");

  // Use the selected Danger Source Roll Table if it's not the default
  if (dangerSourceTableId && dangerSourceTableId !== "default") {
    const rollTable = game.tables.get(dangerSourceTableId);
    if (rollTable) {
      console.log(`Rolling on the Danger Source Roll Table: ${rollTable.name}`);
      const rollResult = await rollTable.draw();
      if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
        sourceText = rollResult.results[0].text; // Use the roll result text as the source
      }
    } else {
      console.error("Selected Danger Source Roll Table not found. Falling back to defaults.");
    }
  } else {
    // Use Lookfar Defaults: Pick a random source from dangers.json
    if (dataLoader.sourceData && Array.isArray(dataLoader.sourceData)) {
      const randomSourceIndex = Math.floor(Math.random() * dataLoader.sourceData.length);
      const sourceId = dataLoader.sourceData[randomSourceIndex]; // e.g. "Source3"
      const i18nKey = `LOOKFAR.Dangers.Sources.${sourceId}`;
      sourceText = game.i18n.localize(i18nKey);
    } else {
      console.error("No source data available in dangers.json.");
    }
  }

  const threatTableId = game.settings.get("lookfar", "dangerThreatRollTable");
  let result = "";

  if (threatTableId && threatTableId !== "default") {
    const rollTable = game.tables.get(threatTableId);
    if (rollTable) {
      console.log(`Rolling on the Danger Threat Roll Table: ${rollTable.name}`);
      const rollResult = await rollTable.draw();
      if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
        result = rollResult.results[0].text;
      }
    } else {
      console.error("Selected Danger Threat Roll Table not found. Falling back to defaults.");
    }
  }

  if (!result) {
    switch (threatType) {
      case "Damage":
        result += handleDamage(dataLoader.threatsData, groupLevel, dangerSeverity);
        break;
      case "statusEffect":
        result += handleStatusEffect(dataLoader.threatsData, dangerSeverity, groupLevel);
        break;
      case "Combat": {
        // LOOKFAR.Dangers.Combat.Minor/Heavy/Massive
        const key = `LOOKFAR.Dangers.Combat.${dangerSeverity}`;
        result += game.i18n.localize(key);
        break;
      }
      case "dangerClock": {
        // LOOKFAR.Dangers.DangerClock.Minor/Heavy/Massive
        const key = `LOOKFAR.Dangers.DangerClock.${dangerSeverity}`;
        result += game.i18n.localize(key);
        break;
      }
      case "villainPlanAdvance": {
        // LOOKFAR.Dangers.VillainPlanAdvance.Minor/Heavy/Massive
        const key = `LOOKFAR.Dangers.VillainPlanAdvance.${dangerSeverity}`;
        result += game.i18n.localize(key);
        break;
      }
      default:
        console.error("Unknown threat type:", threatType);
        return {
          html: game.i18n.localize("LOOKFAR.TravelCheck.Errors.ThreatUnknown"),
          keywords: null,
        };
    }
  }

  const keywords = generateKeywordsData();

  // Return HTML + keyword data (keyword table is rendered in HBS)
  return {
    html: `
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <th style="padding: 5px; border: 1px solid; white-space: nowrap;">
            ${game.i18n.localize("LOOKFAR.TravelCheck.Dialogs.TableHeaders.Threat")}
          </th>
          <td style="padding: 5px; border: 1px solid; text-align: left;">${result}</td>
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

function handleDamage(threatsData, groupLevel, dangerSeverity) {
  const damageData = threatsData.Damage ? threatsData.Damage[groupLevel] : undefined;

  if (!damageData || !damageData[dangerSeverity]) {
    console.error(
      `Damage data not found for groupLevel: ${groupLevel}, severity: ${dangerSeverity}`
    );
    return game.i18n.localize("LOOKFAR.TravelCheck.Errors.DamageMissing");
  }

  const amount = damageData[dangerSeverity];

  return game.i18n.format("LOOKFAR.Dangers.Phrases.DamageOnly", { amount });
}

function handleStatusEffect(threatsData, dangerSeverity, groupLevel) {
  const minorKeys = threatsData.statusEffects["Minor"] || [];
  const heavyKeys = threatsData.statusEffects["Heavy"] || [];

  if (dangerSeverity === "Massive") {
    // 50% chance: Minor effect + Heavy damage OR Heavy effect + Minor damage
    const useMinorEffect = Math.random() < 0.5;

    if (useMinorEffect) {
      const key = getRandomElement(minorKeys);
      const status = game.i18n.localize(`LOOKFAR.Dangers.StatusEffects.Minor.${key}`);
      const amount = threatsData.Damage[groupLevel]["Heavy"];

      return game.i18n.format("LOOKFAR.Dangers.Phrases.StatusAndDamage", {
        status,
        amount
      });
    } else {
      const key = getRandomElement(heavyKeys);
      const status = game.i18n.localize(`LOOKFAR.Dangers.StatusEffects.Heavy.${key}`);
      const amount = threatsData.Damage[groupLevel]["Minor"];

      return game.i18n.format("LOOKFAR.Dangers.Phrases.StatusAndDamage", {
        status,
        amount
      });
    }
  }

  // Non-massive cases return ONLY the localized status
  const list = threatsData.statusEffects[dangerSeverity] || [];
  if (!list.length) {
    console.error(`No status effects for dangerSeverity: ${dangerSeverity}`);
    return game.i18n.localize("LOOKFAR.TravelCheck.Errors.ThreatUnknown");
  }

  const key = getRandomElement(list);
  return game.i18n.localize(`LOOKFAR.Dangers.StatusEffects.${dangerSeverity}.${key}`);
}

// -----------------------------------------------------------------------------
// Random helpers
// -----------------------------------------------------------------------------

function randomSeverity(difficulty) {
  // Use regex to extract the number from the die string (e.g., 'd6' -> 6)
  const difficultyMatch = /^d(\d+)$/.exec(difficulty);

  // Parse the extracted number
  const difficultyNumber = difficultyMatch ? parseInt(difficultyMatch[1]) : NaN;

  // Error out if we can't parse the difficulty number or if it's not a valid positive number
  if (isNaN(difficultyNumber) || difficultyNumber <= 0) {
    throw new Error(`Invalid difficulty number: ${difficulty}`);
  }

  // Roll a random number from 1 to difficultyNumber
  const severityRoll = Math.floor(Math.random() * difficultyNumber) + 1;

  // Adjust severity based on the new ranges
  if (severityRoll <= 5) {
    return "Minor";
  } else if (severityRoll <= 9) {
    return "Heavy";
  } else {
    return "Massive";
  }
}

function randomThreatType() {
  const types = ["Damage", "statusEffect", "Combat", "dangerClock", "villainPlanAdvance"];
  return getRandomElement(types);
}

function getRandomElement(arrayOrObject) {
  const isObject = typeof arrayOrObject === "object" && !Array.isArray(arrayOrObject);
  const keys = isObject ? Object.keys(arrayOrObject) : arrayOrObject;
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return isObject ? arrayOrObject[randomKey] : randomKey;
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

  // Handle Discovery Effect
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
  } else {
    // Use Lookfar defaults via i18n
    if (dataLoader.discoveryData?.effects && Array.isArray(dataLoader.discoveryData.effects)) {
      const randomIndex = Math.floor(Math.random() * dataLoader.discoveryData.effects.length);
      const effectId = dataLoader.discoveryData.effects[randomIndex]; // e.g. "Effect3"
      effectText = game.i18n.localize(`LOOKFAR.Discoveries.Effects.${effectId}`);
    } else {
      console.error("No effects data available in discovery.json.");
    }
  }

  // Handle Discovery Source
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
  } else {
    // Use Lookfar defaults via i18n
    if (dataLoader.discoveryData?.sources && Array.isArray(dataLoader.discoveryData.sources)) {
      const randomIndex = Math.floor(Math.random() * dataLoader.discoveryData.sources.length);
      const sourceId = dataLoader.discoveryData.sources[randomIndex]; // e.g. "Source5"
      sourceText = game.i18n.localize(`LOOKFAR.Discoveries.Sources.${sourceId}`);
    } else {
      console.error("No source data available in discovery.json.");
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
