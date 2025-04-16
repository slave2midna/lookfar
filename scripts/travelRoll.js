import { dataLoader } from "./dataLoader.js";

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
  
Hooks.once("ready", () => {
  game.socket.on("module.lookfar", (data) => {
    if (data?.type === "showResult") {
      const visibility = game.settings.get("lookfar", "resultVisibility"); // still using old key internally
      const isGM = game.user.isGM;

      // Show only to GM if setting is "gmOnly"
      if (visibility === "gmOnly" && !isGM) return;

      showRerollDialog(
        data.resultMessage,
        data.selectedDifficulty,
        data.groupLevel,
        data.dangerSeverity
      );
    } else if (data?.type === "closeDialog") {
      if (currentDialog) {
        currentDialog.close();
      }
    }
  });
});

// Define TravelRolls
class TravelRolls {
  static travelChecks = {
    "Minimal": "d6",
    "Low": "d8",
    "Medium": "d10",
    "High": "d12",
    "Very High": "d20",
  };
}

let formHtml = `
  <form>
    <div style="display: flex; gap: 20px; align-items: flex-start;">
      <!-- Threat Level Column -->
      <div style="flex: 1;">
        <table class="travel-check-table">
          <caption style="font-weight: bold; font-size: 1.1em;">game.i18n.localize("LOOKFAR.Dialogs.TravelCheck.ThreatLevel")</caption>
          <tbody>
            ${Object.entries(TravelRolls.travelChecks)
              .map(
                ([key, value], index) => `
                <tr>
                  <td>
                    <label>
                      <input type="radio" name="travelCheck" value="${value}" ${index === 0 ? "checked" : ""}>
                      ${key} (<span class="dice-display" data-original="${value}">${value}</span>)
                    </label>
                  </td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <!-- Wayfaring Options Column -->
      <div style="flex: 1;">
        <table class="travel-check-table">
          <caption style="font-weight: bold; font-size: 1.1em;">game.i18n.localize("LOOKFAR.Dialogs.TravelCheck.Wayfaring")</caption>
          <tbody>
            <tr>
              <td>
                <label for="groupLevel">game.i18n.localize("LOOKFAR.Dialogs.TravelCheck.PartyLevel"):</label>
                <select id="groupLevel" name="groupLevel">
                  <option value="5+">5+</option>
                  <option value="20+">20+</option>
                  <option value="40+">40+</option>
                </select>
              </td>
            </tr>
            <tr>
  <td style="white-space: nowrap;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <label style="margin: 0;">game.i18n.localize("LOOKFAR.Dialogs.TravelCheck.TreasureHunting"):</label>
      <div id="treasureHunterLevel" style="display: flex; gap: 5px; font-size: 1.2em; white-space: nowrap;">
        <i class="fa-regular fa-star" data-value="1"></i>
        <i class="fa-regular fa-star" data-value="2"></i>
        <i class="fa-regular fa-star" data-value="3"></i>
      </div>
    </div>
    <input type="hidden" id="treasureHunterLevelInput" value="0">
  </td>
</tr>
            <tr>
              <td>
                <label>
                  <input type="checkbox" id="wellTraveled" name="wellTraveled">
                  game.i18n.localize("LOOKFAR.Dialogs.TravelCheck.WellTraveled")
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </form>
`;

// Defines the travel check dialog
function showTravelCheckDialog() {
  console.log("Opening Travel Check dialog...");
  new Dialog({
  title: game.i18n.localize("LOOKFAR.Dialogs.TravelCheck.Title"),
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
const savedTreasureHunterLevel = parseInt(localStorage.getItem("lookfar-treasureHunterLevel") || "0");
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
      const newValue = (clickedValue === currentValue) ? 0 : clickedValue;

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
    d20: "d12"
  };

  html.find(".dice-display").each(function () {
    const original = $(this).data("original");
    $(this).text(isChecked ? (diceMap[original] || original) : original);
  });
});

// Restore Well-Traveled checkbox and immediately trigger dice display update
html.find("#wellTraveled").prop("checked", savedWellTraveled).trigger("change");
  },
  close: () => {}
}).render(true);
}
// ⬇️ Move this outside the function definition
Hooks.on("lookfarShowTravelCheckDialog", () => {
  showTravelCheckDialog();
});

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
  if (wellTraveled) {
    selectedDifficulty = reduceDiceSize(selectedDifficulty);
  }

  let roll = new Roll(selectedDifficulty);
  await roll.evaluate({ async: true });

  // Render and create the roll chat message
  await roll.render().then((rollHTML) => {
    let chatData = {
      user: game.userId,
      speaker: { alias: game.i18n.localize("LOOKFAR.Chat.Alias.Roll") },
      content: rollHTML,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [roll],
    };
    return ChatMessage.create(chatData).then((chatMessage) => {
      if (game.dice3d) {
        return new Promise((resolve) => {
          let hookId = Hooks.on("diceSoNiceRollComplete", (messageId) => {
            if (messageId === chatMessage.id) {
              Hooks.off("diceSoNiceRollComplete", hookId);
              resolve(chatMessage);
            }
          });
        });
      }
      return chatMessage;
    });
  });

  // Determine the group level set by the GM
  const groupLevel = html.find("#groupLevel").val();

  let resultMessage = "";
  const treasureHunterLevel = parseInt(html.find("#treasureHunterLevelInput").val());
  const isDiscovery = shouldMakeDiscovery(roll.total, treasureHunterLevel);
  let dangerSeverity = "";

  if (roll.total >= 6) {
  dangerSeverity = await randomSeverity(selectedDifficulty);
  const resultType = `${game.i18n.localize("LOOKFAR.Severity." + dangerSeverity)} ${game.i18n.localize("LOOKFAR.Dialogs.Result.Danger")}`;
  const resultTable = await generateDanger(selectedDifficulty, groupLevel, dangerSeverity);
  resultMessage = `
    <div style="text-align: center; font-weight: bold; font-size: 1.2rem; margin-bottom: 10px;">
      ${resultType}
    </div>
    ${resultTable}
  `;
} else if (isDiscovery) {
  const resultType = "Discovery!";
  const resultTable = await generateDiscovery();
  resultMessage = `
    <div style="text-align: center; font-weight: bold; font-size: 1.2rem; margin-bottom: 10px;">
      ${resultType}
    </div>
    ${resultTable}
  `;
} else {
  resultMessage = `
    <div style="text-align: center; font-size: 1.2rem;">
      game.i18n.localize("LOOKFAR.Dialogs.TravelResult.NoIncident").
    </div>
  `;
}

  // Emit the result to all clients
  game.socket.emit("module.lookfar", {
    type: "showResult",
    resultMessage,
    selectedDifficulty,
    groupLevel,
    dangerSeverity,
  });

const visibility = game.settings.get("lookfar", "resultVisibility");
const isGM = game.user.isGM;

// Show dialog locally only if it's public, or this user is a GM
if (visibility === "public" || isGM) {
  showRerollDialog(resultMessage, selectedDifficulty, groupLevel, dangerSeverity);
}
}

// Keep a reference to the current dialog
let currentDialog = null;

function showRerollDialog(initialResult, selectedDifficulty, groupLevel, dangerSeverity) {
  let isDanger = initialResult.includes("Danger!");

  // Close the existing dialog if it's open
  if (currentDialog) {
    currentDialog.close();
  }

  // Check if the current user is a GM
  const isGM = game.user.isGM;

  const buttons = isGM ? {
    keep: {
    icon: '<i class="fas fa-check"></i>',
    callback: () => {
      ChatMessage.create({
        content: `<div style="text-align: center;">${initialResult}</div>`,
        speaker: { alias: "Travel Result" },
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
        let newResultMessage;
        if (isDanger) {
  const resultType = `${dangerSeverity} Danger!`;
  const resultTable = await generateDanger(selectedDifficulty, groupLevel, dangerSeverity);
  newResultMessage = `
    <div style="text-align: center; font-weight: bold; font-size: 1.2rem; margin-bottom: 10px;">
      ${resultType}
    </div>
    ${resultTable}
  `;
} else {
  const resultType = game.i18n.localize("LOOKFAR.Dialogs.Result.Discovery");
  const resultTable = await generateDiscovery();
  newResultMessage = `
    <div style="text-align: center; font-weight: bold; font-size: 1.2rem; margin-bottom: 10px;">
      ${resultType}
    </div>
    ${resultTable}
  `;
}

        // Emit the new result to all clients
        game.socket.emit("module.lookfar", {
          type: "showResult",
          resultMessage: newResultMessage,
          selectedDifficulty,
          groupLevel,
          dangerSeverity,
        });
        
        showRerollDialog(newResultMessage, selectedDifficulty, groupLevel, dangerSeverity);
    },
  },
} : {}; // Non-GM users don't get any buttons

  currentDialog = new Dialog({
    title: game.i18n.localize("LOOKFAR.Dialogs.TravelResult.Title"),
    render: (html) => {
      html.addClass("ff6-dialog");
    },
    content: `
  <div style="font-size: 1.1rem; margin-bottom: 10px;">
    ${initialResult}
  </div>
  <p style="margin-bottom: 1rem;">
    ${isGM ? game.i18n.localize("LOOKFAR.Dialogs.TravelResult.Prompt") : game.i18n.localize("LOOKFAR.Dialogs.TravelResult.Waiting")}
  </p>
`,
    buttons: buttons,
    default: "keep",
    close: () => {
      currentDialog = null;
    },
  });
  currentDialog.render(true);
}

function toReadableText(str) {
  let words = str.split(/(?=[A-Z])/);
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

async function generateDanger(selectedDifficulty, groupLevel, dangerSeverity) {
  if (!dataLoader.threatsData || !dataLoader.threatsData.statusEffects) {
    console.error("Threats data is not fully loaded.");
    return game.i18n.localize("LOOKFAR.Errors.DataUnavailable");
  }

  const threatType = randomThreatType();

  // Get the selected danger source roll table
  const dangerSourceTableId = game.settings.get("lookfar", "dangerSourceRollTable");
  
  // Variable to hold the source text
  let sourceText = game.i18n.localize("LOOKFAR.Errors.NoDangerSource");

  // Use the selected Danger Source Roll Table if it's not the default
  if (dangerSourceTableId && dangerSourceTableId !== "default") {
    const rollTable = game.tables.get(dangerSourceTableId);
    if (rollTable) {
      console.log(`Rolling on the Danger Source Roll Table: ${rollTable.name}`);
      const rollResult = await rollTable.roll();  // Add await here
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
      sourceText = dataLoader.sourceData[randomSourceIndex]; // Randomly select from dangers.json sources
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
    const rollResult = await rollTable.roll();
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
    case "Combat":
      result += dataLoader.threatsData.Combat[dangerSeverity];
      break;
    case "dangerClock":
      result += dataLoader.threatsData.dangerClock[dangerSeverity];
      break;
    case "villainPlanAdvance":
      result += dataLoader.threatsData.villainPlanAdvance[dangerSeverity];
      break;
    default:
      console.error("Unknown threat type:", threatType);
      return game.i18n.localize("LOOKFAR.Errors.ThreatUnknown");
  }
}

  // Return formatted table for danger results and source.
  return `
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <th style="padding: 5px; border: 1px solid; white-space: nowrap;">game.i18n.localize("LOOKFAR.Dialogs.TableHeaders.Threat")</th>
      <td style="padding: 5px; border: 1px solid; text-align: left;">${result}</td>
    </tr>
    <tr>
      <th style="padding: 5px; border: 1px solid; white-space: nowrap;">game.i18n.localize("LOOKFAR.Dialogs.TableHeaders.Source")</th>
      <td style="padding: 5px; border: 1px solid; text-align: left;">${sourceText}</td>
    </tr>
  </table>
  ${generateKeywords()}
`;
}

function handleDamage(threatsData, groupLevel, dangerSeverity) {
  const damageData = threatsData.Damage ? threatsData.Damage[groupLevel] : undefined;

  if (!damageData || !damageData[dangerSeverity]) {
    console.error(`Damage data not found for groupLevel: ${groupLevel}, severity: ${dangerSeverity}`);
    return game.i18n.localize("LOOKFAR.Errors.DamageMissing");
  }
  return `${damageData[dangerSeverity]} damage`;
}

function handleStatusEffect(threatsData, dangerSeverity, groupLevel) {
  const statusEffectsListMinor = threatsData.statusEffects["Minor"];
  const statusEffectsListHeavy = threatsData.statusEffects["Heavy"];

  if (dangerSeverity === "Massive") {
    // 50% chance to pull either a Minor status effect with Heavy damage or a Heavy status effect with Minor damage
    const useMinorEffect = Math.random() < 0.5;

    if (useMinorEffect) {
      const statusEffect = getRandomElement(statusEffectsListMinor);
      const heavyDamage = threatsData.Damage[groupLevel]["Heavy"];
      return `${statusEffect} and ${heavyDamage} damage`;
    } else {
      const statusEffect = getRandomElement(statusEffectsListHeavy);
      const minorDamage = threatsData.Damage[groupLevel]["Minor"];
      return `${statusEffect} and ${minorDamage} damage`;
    }
  } else {
    const statusEffectsList = threatsData.statusEffects[dangerSeverity];
    return getRandomElement(statusEffectsList);
  }
}

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
  const types = [
    "Damage",
    "statusEffect",
    "Combat",
    "dangerClock",
    "villainPlanAdvance",
  ];
  return getRandomElement(types);
}

function getRandomElement(arrayOrObject) {
  const isObject =
    typeof arrayOrObject === "object" && !Array.isArray(arrayOrObject);
  const keys = isObject ? Object.keys(arrayOrObject) : arrayOrObject;
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return isObject ? arrayOrObject[randomKey] : randomKey;
}

// If keywords are enabled, this function generates Keywords
function generateKeywords() {
  if (!game.settings.get("lookfar", "enableKeywords")) return "";

  const traits = dataLoader.keywordData?.traits || [];
  const terrain = dataLoader.keywordData?.terrain || [];

  const traitKeywords = generateUniqueList(traits, 3, 4).join(", ");
  const terrainKeywords = generateUniqueList(terrain, 3, 4).join(", ");

  return `
  <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
    <tr>
      <th style="width: 50px; padding: 5px; border: 1px solid; white-space: nowrap; text-align: left;">game.i18n.localize("LOOKFAR.Dialogs.TableHeaders.Traits")</th>
      <td style="padding: 5px; border: 1px solid; text-align: left;">${traitKeywords}</td>
    </tr>
    <tr>
      <th style="width: 50px; padding: 5px; border: 1px solid; white-space: nowrap; text-align: left;">game.i18n.localize("LOOKFAR.Dialogs.TableHeaders.Terrain"</th>
      <td style="padding: 5px; border: 1px solid; text-align: left;">${terrainKeywords}</td>
    </tr>
  </table>
`;
}

async function generateDiscovery() {
  console.log("Generating Discovery...");

  // Get the selected roll table IDs for effects and sources
  const effectTableId = game.settings.get("lookfar", "discoveryEffectRollTable");
  const sourceTableId = game.settings.get("lookfar", "discoverySourceRollTable");

  let effectText = game.i18n.localize("LOOKFAR.Errors.NoDiscoveryEffect");
  let sourceText = game.i18n.localize("LOOKFAR.Errors.NoDiscoverySource");

  // Handle Discovery Effect
  if (effectTableId && effectTableId !== "default") {
    const rollTable = game.tables.get(effectTableId);
    if (rollTable) {
      console.log(`Rolling on the Discovery Effect Roll Table: ${rollTable.name}`);
      const rollResult = await rollTable.roll();
      if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
        effectText = rollResult.results[0].text;
      }
    } else {
      console.error("Selected Discovery Effect Roll Table not found. Falling back to defaults.");
    }
  } else {
    if (dataLoader.discoveryData?.effects && Array.isArray(dataLoader.discoveryData.effects)) {
      const randomIndex = Math.floor(Math.random() * dataLoader.discoveryData.effects.length);
      effectText = dataLoader.discoveryData.effects[randomIndex];
    } else {
      console.error("No effects data available in discovery.json.");
    }
  }

  // Handle Discovery Source
  if (sourceTableId && sourceTableId !== "default") {
    const rollTable = game.tables.get(sourceTableId);
    if (rollTable) {
      console.log(`Rolling on the Discovery Source Roll Table: ${rollTable.name}`);
      const rollResult = await rollTable.roll();
      if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
        sourceText = rollResult.results[0].text;
      }
    } else {
      console.error("Selected Discovery Source Roll Table not found. Falling back to defaults.");
    }
  } else {
    if (dataLoader.discoveryData?.sources && Array.isArray(dataLoader.discoveryData.sources)) {
      const randomIndex = Math.floor(Math.random() * dataLoader.discoveryData.sources.length);
      sourceText = dataLoader.discoveryData.sources[randomIndex];
    } else {
      console.error("No source data available in discovery.json.");
    }
  }

  // Return final formatted result
  return `
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <th style="padding: 5px; border: 1px solid; white-space: nowrap;">game.i18n.localize("LOOKFAR.Dialogs.TableHeaders.Effect")</th>
      <td style="padding: 5px; border: 1px solid; text-align: left;">${effectText}</td>
    </tr>
    <tr>
      <th style="padding: 5px; border: 1px solid; white-space: nowrap;">game.i18n.localize("LOOKFAR.Dialogs.TableHeaders.Source")</th>
      <td style="padding: 5px; border: 1px solid; text-align: left;">${sourceText}</td>
    </tr>
  </table>
  ${generateKeywords()}
`;
}
