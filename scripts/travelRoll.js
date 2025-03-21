import { dataLoader } from "./dataLoader.js";

// Function to set default "Discovery" rolltable options. Will update for multiple table settings.
function getRollTableChoices() {
  const choices = { default: "Lookfar Defaults" }; // Add "Default" option
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
      showRerollDialog(
        data.resultMessage,
        data.selectedDifficulty,
        data.groupLevel,
        data.dangerSeverity,
        data.discoveryType
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
    <table class="travel-check-table">
      <caption style="font-weight: bold; font-size: 1.1em;">Threat Level</caption>
      <tbody>
        ${Object.entries(TravelRolls.travelChecks)
          .map(
            ([key, value], index) => `
          <tr>
            <td>
              <label>
                <input type="radio" name="travelCheck" value="${value}" ${index === 0 ? "checked" : ""}>
                ${key} (${value})
              </label>
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </form>
`;

// Defines the travel check dialog
function showTravelCheckDialog() {
  console.log("Opening Travel Check dialog...");
  new Dialog({
    title: "Travel Check",
    content: formHtml,
    buttons: {
      roll: {
        icon: '<i class="fas fa-check"></i>',
        callback: (html) => {
          const selectedDifficulty = html.find('[name="travelCheck"]:checked').val();
          handleRoll(selectedDifficulty);
        },
      },
    },
    default: "roll",
    close: () => {},
  }).render(true);
}

Hooks.on("lookfarShowTravelCheckDialog", () => {
  showTravelCheckDialog();
});

function shouldMakeDiscovery(rollResult) {
  const treasureHunterLevel = parseInt(game.settings.get("lookfar", "treasureHunterLevel"));
  const minorDiscoveriesEnabled = game.settings.get("lookfar", "minorDiscoveries");

  if (minorDiscoveriesEnabled) {
    if (rollResult === 1) {
      return "major";
    } else if (rollResult === 2 || rollResult === 3) {
      return "minor";
    }
  }
  // Original behavior: Major discovery on 1
  return rollResult <= 1 + treasureHunterLevel ? "major" : false;
}

// Reduces the dice size for well-traveled setting
function reduceDiceSize(diceSize) {
  const diceMap = { d8: "d6", d10: "d8", d12: "d10", d20: "d12" };
  return diceMap[diceSize] || diceSize; // Returns the reduced size, or the original if not found
}

async function handleRoll(selectedDifficulty) {
  const wellTraveled = game.settings.get("lookfar", "wellTraveled");
  const characterMessage = game.settings.get("lookfar", "characterMessage");

  // Reduce the dice size if Well-Traveled is checked
  if (wellTraveled) {
    selectedDifficulty = reduceDiceSize(selectedDifficulty);
    if (characterMessage) {
      ChatMessage.create({
        content: characterMessage,
      });
    }
  }

  let roll = new Roll(selectedDifficulty);
  await roll.evaluate({ async: true });

  // Render and create the roll chat message
  await roll.render().then((rollHTML) => {
    let chatData = {
      user: game.userId,
      speaker: { alias: "Travel Roll" },
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
  const groupLevel = game.settings.get("lookfar", "groupLevel");

  let resultMessage = "";
  let discoveryType = shouldMakeDiscovery(roll.total);
  let dangerSeverity = "";

  if (roll.total >= 6) {
    dangerSeverity = await randomSeverity(selectedDifficulty);
    resultMessage = `${dangerSeverity} Danger! ` + await generateDanger(selectedDifficulty, groupLevel, dangerSeverity);
  } else if (discoveryType) {
    resultMessage = discoveryType === "major"
      ? "Major Discovery! " + await generateDiscovery("major")
      : "Minor Discovery! " + await generateDiscovery("minor");
  } else {
    resultMessage = "The travel day passed without incident.";
  }

  // Emit the result to all clients
  game.socket.emit("module.lookfar", {
    type: "showResult",
    resultMessage,
    selectedDifficulty,
    groupLevel,
    dangerSeverity,
    discoveryType,
  });

  // Show the dialog on the initiating client (for local confirmation)
  showRerollDialog(resultMessage, selectedDifficulty, groupLevel, dangerSeverity, discoveryType);
}

// Keep a reference to the current dialog
let currentDialog = null;

function showRerollDialog(initialResult, selectedDifficulty, groupLevel, dangerSeverity, discoveryType) {
  let isDanger = initialResult.includes("Danger!");
  let title = isDanger ? "Confirm Danger Result" : "Confirm Discovery Result";

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
          const newDangerResult = await generateDanger(selectedDifficulty, groupLevel, dangerSeverity);
          newResultMessage = `${dangerSeverity} Danger! ` + newDangerResult;
        } else if (discoveryType) {
          const newDiscoveryResult = await generateDiscovery(discoveryType);
          newResultMessage = discoveryType === "major"
            ? "Major Discovery! " + newDiscoveryResult
            : "Minor Discovery! " + newDiscoveryResult;
        } else {
          const newDiscoveryResult = await generateDiscovery("major");
          newResultMessage = "Discovery! " + newDiscoveryResult;
        }

        // Emit the new result to all clients
        game.socket.emit("module.lookfar", {
          type: "showResult",
          resultMessage: newResultMessage,
          selectedDifficulty,
          groupLevel,
          dangerSeverity,
          discoveryType,
        });
        
        showRerollDialog(newResultMessage, selectedDifficulty, groupLevel, dangerSeverity, discoveryType);
    },
  },
} : {}; // Non-GM users don't get any buttons

  currentDialog = new Dialog({
    title: title,
    render: (html) => {
      html.addClass("ff6-dialog");
    },
    content: `
  <div style="font-size: 1.1rem; text-align: center; margin-bottom: 10px;">
    ${initialResult}
  </div>
  <p style="margin-bottom: 1rem;">
    ${isGM ? "Do you want to keep this result or reroll?" : "Waiting for GM decision..."}
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
    return "Error: Data not available.";
  }

  const threatType = randomThreatType();

  // Get the selected danger source roll table
  const dangerSourceTableId = game.settings.get("lookfar", "dangerSourceRollTable");
  
  // Variable to hold the source text
  let sourceText = "No danger source available.";

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
      return "Error: Unknown threat type.";
  }
}

  // Return formatted table for danger results and source.
  return `
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <th style="padding: 5px; border: 1px solid; white-space: nowrap;">Threat</th>
        <td style="padding: 5px; border: 1px solid; text-align: left;">${result}</td>
      </tr>
      <tr>
        <th style="padding: 5px; border: 1px solid; white-space: nowrap;">Source</th>
        <td style="padding: 5px; border: 1px solid; text-align: left;">${sourceText}</td>
      </tr>
    </table>
  `;
}

function handleDamage(threatsData, groupLevel, dangerSeverity) {
  const damageData = threatsData.Damage ? threatsData.Damage[groupLevel] : undefined;

  if (!damageData || !damageData[dangerSeverity]) {
    console.error(`Damage data not found for groupLevel: ${groupLevel}, severity: ${dangerSeverity}`);
    return "Error: Damage data not found.";
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

async function generateDiscovery(type = "major") {
  console.log("Generating Discovery... Type:", type);
  
  // Get the selected roll table IDs for effects and keywords
  const effectTableId = game.settings.get("lookfar", "discoveryEffectRollTable");

  // Variable to hold the effect text
  let effectText = "No discovery effect available.";

  // Only generate effects if it's a major discovery
  if (type === "major") {
    // Use the selected Discovery Effect Roll Table if it's not the default
    if (effectTableId && effectTableId !== "default") {
      const rollTable = game.tables.get(effectTableId);
      if (rollTable) {
        console.log(`Rolling on the Discovery Effect Roll Table: ${rollTable.name}`);
        const rollResult = await rollTable.roll();
        if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
          effectText = rollResult.results[0].text; // Use the roll result text as the effect
        }
      } else {
        console.error("Selected Discovery Effect Roll Table not found. Falling back to defaults.");
      }
    } else {
      // Use Lookfar Defaults: Pick a random effect from discovery.json
      if (dataLoader.discoveryData && Array.isArray(dataLoader.discoveryData.effects)) {
        const randomEffectIndex = Math.floor(Math.random() * dataLoader.discoveryData.effects.length);
        effectText = dataLoader.discoveryData.effects[randomEffectIndex]; // Randomly select from discovery.json effects
      } else {
        console.error("No effects data available in discovery.json.");
      }
    }
  }

const sourceTableId = game.settings.get("lookfar", "discoverySourceRollTable");
let sourceText = "No discovery source available.";

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
  }
}
    // Return formatted table with default traits/terrain, and hide effect row for minor
    return `
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <th style="padding: 5px; border: 1px solid; white-space: nowrap;">Effect</th>
      <td style="padding: 5px; border: 1px solid; text-align: left;">${effectText}</td>
    </tr>
    <tr>
      <th style="padding: 5px; border: 1px solid; white-space: nowrap">Source</th>
      <td style="padding: 5px; border: 1px solid; text-align: left;">${sourceText}</td>
    </tr>
  </table>
`;
}
