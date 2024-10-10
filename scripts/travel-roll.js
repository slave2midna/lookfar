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

Hooks.once("init", async () => {
  // Load data
  await dataLoader.loadData();
  
  // Add CSS styles
  $( `<link rel="stylesheet" type="text/css" href="/modules/lookfar/styles/style.css">`).appendTo("head");

  // Register game setting for group level
  game.settings.register("lookfar", "groupLevel", {
    name: "Group Level",
    hint: "Set the group level for generating dangers.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "5+": "5+",
      "20+": "20+",
      "40+": "40+",
    },
    default: "5+",
  });

  // Register roll visibility setting
  game.settings.register("lookfar", "rollVisibility", {
    name: "Roll Visibility",
    hint: "Choose whether rolls and chat outputs are public or GM only.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      public: "Public",
      gmOnly: "GM Only",
    },
    default: "public",
  });

  // Register Treasure Hunter Level setting
  game.settings.register("lookfar", "treasureHunterLevel", {
    name: "Treasure Hunter: Level",
    hint: "Modify the chance of discovery based on the level of Treasure Hunter skill.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "0": "Level 0",
      "1": "Level 1",
      "2": "Level 2",
    },
    default: "0",
  });

  // Register Well-Traveled setting
  game.settings.register("lookfar", "wellTraveled", {
    name: "Well-Traveled",
    hint: "Check this if the party has the Well-Traveled trait, reducing travel roll difficulty.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  // Register text field for character name or message
  game.settings.register("lookfar", "characterMessage", {
    name: "Character/Skill Message",
    hint: "Enter text that will display whenever the Travel Roll is affected by your group's Wayfarer.",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

    // Register Minor Discoveries setting
  game.settings.register("lookfar", "minorDiscoveries", {
    name: "Enable Minor Discoveries",
    hint: "When enabled, travel rolls may result in minor discoveries (finds without effects).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  // Expose the travel check dialog function globally
  game.lookfar = game.lookfar || {};
  game.lookfar.showTravelCheckDialog = showTravelCheckDialog;
});

// Updates the rollTable setting dynamically without needing a VTT refresh
Hooks.on("ready", async () => {
  const rollTableChoices = getRollTableChoices();
  game.settings.register("lookfar", "rollTable", {
    name: "Discovery Effect Roll Table",
    hint: "Select the Roll Table to use for generating discovery effects.",
    scope: "world",
    config: true,
    type: String,
    choices: rollTableChoices,
    default: "default", // Defaults to discovery.json
    onChange: (value) => {
      console.log(`Selected Discovery Effect Roll Table: ${value}`);
    },
  });

    // Register the "Discovery Keywords Roll Table" setting
  game.settings.register("lookfar", "keywordRollTable", {
    name: "Discovery Keywords Roll Table",
    hint: "Select the Roll Table to use for generating discovery keywords.",
    scope: "world",
    config: true,
    type: String,
    choices: rollTableChoices,
    default: "default", 
    onChange: (value) => {
      console.log(`Selected Discovery Keywords Roll Table: ${value}`);
    },
  });
  
  // Register the Danger Source Roll Table setting
  game.settings.register("lookfar", "dangerSourceRollTable", {
    name: "Danger Source Roll Table",
    hint: "Select the Roll Table to use for generating danger sources.",
    scope: "world",
    config: true,
    type: String,
    choices: rollTableChoices,
    default: "default", // Defaults to dangers.json
    onChange: (value) => {
      console.log(`Selected Danger Source Roll Table: ${value}`);
    },
  });
});

// Dynamically update roll table choices when new tables are added
Hooks.on("createRollTable", () => {
  const rollTableChoices = getRollTableChoices();
  game.settings.settings.get("lookfar.rollTable").choices = rollTableChoices;
  game.settings.settings.get("lookfar.rollTable").default = "default";
});

// or deleted
Hooks.on("deleteRollTable", () => {
  const rollTableChoices = getRollTableChoices();
  game.settings.settings.get("lookfar.rollTable").choices = rollTableChoices;
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
  <style>
    .travel-check-table {
      width: 100%;
      border-collapse: collapse;
    }
    .travel-check-table td, .travel-check-table th {
      padding: 5px;
      text-align: left;
      vertical-align: top;
    }
    .travel-check-table td:first-child {
      width: 1%;
      white-space: nowrap;
    }
  </style>
  <form>
    <table class="travel-check-table">
      <caption style="font-weight: bold; margin-bottom: 10px;">Threat Level</caption>
      <tbody>
        ${Object.entries(TravelRolls.travelChecks)
          .map(
            ([key, value], index) => `
          <tr>
            <td>
              <label>
                <input type="radio" name="travelCheck" value="${value}" ${
                  index === 0 ? "checked" : ""
                }>
                ${key} (${value})
              </label>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  </form>
`;

// Adds floating button for travel check into Project FU's toolbar
Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
  console.log("Adding Travel Check button to toolbar...");
  
  let travelCheckButton = {
    name: "Travel Check",
    title: "Make a Travel Check",
    icon: "fa-solid fa-person-hiking",
    button: true,
    onClick: () => {
      console.log("Travel Check button clicked!");
      showTravelCheckDialog();
    },
    visible: true
  };
  tools.push(travelCheckButton);
  console.log("Button added to the toolbar:", tools);
});

// Defines the travel check dialog
function showTravelCheckDialog() {
  console.log("Opening Travel Check dialog...");
  new Dialog({
    title: "Travel Check",
    content: formHtml,
    render: (html) => {
      html.addClass("ff6-dialog");
    },
    buttons: {
      roll: {
        icon: '<i class="fas fa-check" style="color: white"></i>',
        callback: (html) => {
          const selectedDifficulty = html
            .find('[name="travelCheck"]:checked')
            .val();
          handleRoll(selectedDifficulty);
        },
      },
    },
    default: "roll",
    close: () => {},
  }).render(true);
}

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
  const wellTraveled = game.settings.get(
    "lookfar",
    "wellTraveled"
  );
  const characterMessage = game.settings.get(
    "lookfar",
    "characterMessage"
  );

  // Reduce the dice size if Well-Traveled is checked
  if (wellTraveled) {
    selectedDifficulty = reduceDiceSize(selectedDifficulty);
    if (characterMessage) {
      ChatMessage.create({
        content: characterMessage, //change this to whatever you want to use to acknowledge your friendly neighborhood Wayfarer
      });
    }
  }
  let roll = new Roll(selectedDifficulty);
  await roll.evaluate({async: true});

  // Determine visibility
  const rollVisibility = game.settings.get(
    "lookfar",
    "rollVisibility"
  );
  const isWhisper = rollVisibility === "gmOnly";

 // Get the IDs of all GM users if visibility is set to "gmOnly"
let gmUserIds = isWhisper
  ? game.users.filter((user) => user.isGM).map((gm) => gm.id)
  : [];

// Render and create the roll chat message
await roll.render().then((rollHTML) => {
  let chatData = {
    user: game.userId,
    speaker: { alias: "Travel Roll" },
    content: rollHTML,
    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
    rolls: [roll],
  };

  // Only include whisper key if it's meant to be whispered to GMs
  if (isWhisper) {
    chatData.whisper = gmUserIds;
  }

  return ChatMessage.create(chatData).then(chatMessage => {
      if (game.dice3d) {
        return new Promise((resolve) => {
          let hookId = Hooks.on("diceSoNiceRollComplete", (messageId) => {
            if (messageId === chatMessage.id) {
              Hooks.off("diceSoNiceRollComplete", hookId);
              resolve(chatMessage)
            }
          })
        })
      }
    return chatMessage;
  });
});

  // Determine the group level set by the GM
  const groupLevel = game.settings.get(
    "lookfar",
    "groupLevel"
  );

let resultMessage = "";
let discoveryType = shouldMakeDiscovery(roll.total);  
let dangerSeverity = ""; // Variable to store severity

if (roll.total >= 6) {
  dangerSeverity = await randomSeverity(selectedDifficulty);
  resultMessage = `${dangerSeverity} Danger! ` + await generateDanger(selectedDifficulty, groupLevel);
} else if (discoveryType) {
  resultMessage = discoveryType === "major"
    ? "Major Discovery! " + await generateDiscovery("major")
    : "Minor Discovery! " + await generateDiscovery("minor");
} else {
  resultMessage = "The travel day passed without incident.";
}
  showRerollDialog(resultMessage, selectedDifficulty, groupLevel, discoveryType);
}

function showRerollDialog(initialResult, selectedDifficulty, groupLevel, discoveryType) {
  let isDanger = initialResult.includes("Danger!");
  let title = isDanger ? "Confirm Danger Result" : "Confirm Discovery Result";

  let d = new Dialog({
    title: title,
    render: (html) => {
      html.addClass("ff6-dialog");
    },
    content: `<p>Current Result: ${initialResult}</p><p>Do you want to keep this result or reroll?</p>`,
    buttons: {
      keep: {
        icon: '<i class="fas fa-check" style="color: white;"></i>',
        callback: () => {
          // Determine visibility
          const rollVisibility = game.settings.get(
            "lookfar",
            "rollVisibility"
          );
          const isWhisper = rollVisibility === "gmOnly";
          // Get the IDs of all GM users if visibility is set to "gmOnly"
          let gmUserIds = isWhisper
            ? game.users.filter((user) => user.isGM).map((gm) => gm.id)
            : [];

          ChatMessage.create({
            content: initialResult,
            whisper: gmUserIds,
            speaker: { alias: "Travel Roll" },
          });
        },
      },
      reroll: {
  icon: '<i class="fas fa-redo" style="color: white;"></i>',
  callback: async () => {
    let newResultMessage;
    if (isDanger) {
      const dangerSeverity = await randomSeverity(selectedDifficulty);
      const newDangerResult = await generateDanger(selectedDifficulty, groupLevel);
      newResultMessage = `${dangerSeverity} Danger! ` + newDangerResult;
    } else if (discoveryType) {
      // Pass the discoveryType when generating the new discovery
      const newDiscoveryResult = await generateDiscovery(discoveryType);
      newResultMessage = discoveryType === "major"
        ? "Major Discovery! " + newDiscoveryResult
        : "Minor Discovery! " + newDiscoveryResult;
    } else {
      const newDiscoveryResult = await generateDiscovery("major");
      newResultMessage = "Discovery! " + newDiscoveryResult;
    }
    showRerollDialog(newResultMessage, selectedDifficulty, groupLevel, discoveryType);
  },
},
    },
    default: "keep",
    close: () => {},
  });
  d.render(true);
}

function toReadableText(str) {
  let words = str.split(/(?=[A-Z])/);
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

async function generateDanger(selectedDifficulty, groupLevel) {
  if (!dataLoader.threatsData || !dataLoader.threatsData.statusEffects) {
    console.error("Threats data is not fully loaded.");
    return "Error: Data not available.";
  }

  const severity = randomSeverity(selectedDifficulty);
  const threatType = randomThreatType();
  const readableThreatType = toReadableText(threatType);

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

  let result = ""; // Changed to directly append the danger result

  switch (threatType) {
    case "Damage":
      result += handleDamage(dataLoader.threatsData, groupLevel, severity);
      break;
    case "statusEffect":
      result += handleStatusEffect(dataLoader.threatsData, severity, groupLevel);
      break;
    case "Combat":
      result += dataLoader.threatsData.Combat[severity];
      break;
    case "dangerClock":
      result += dataLoader.threatsData.dangerClock[severity];
      break;
    case "villainPlanAdvance":
      result += dataLoader.threatsData.villainPlanAdvance[severity];
      break;
    default:
      console.error("Unknown threat type:", threatType);
      return "Error: Unknown threat type.";
  }

  // Return formatted table for danger results and source.
  return `
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
      <tr>
        <th style="padding: 5px; border: 1px solid #ddd; white-space: nowrap">Threat</th>
        <td style="padding: 5px; border: 1px solid #ddd;">${result}</td>
      </tr>
      <tr>
        <th style="padding: 5px; border: 1px solid #ddd; white-space: nowrap">Source</th>
        <td style="padding: 5px; border: 1px solid #ddd;">${sourceText}</td>
      </tr>
    </table>
  `;
}

function handleDamage(threatsData, groupLevel, severity) {
  const damageData = threatsData.Damage ? threatsData.Damage[groupLevel] : undefined;

  if (!damageData || !damageData[severity]) {
    console.error(`Damage data not found for groupLevel: ${groupLevel}, severity: ${severity}`);
    return "Error: Damage data not found.";
  }
  return `${damageData[severity]} damage`;
}

function handleStatusEffect(threatsData, severity, groupLevel) {
  const statusEffectsListMinor = threatsData.statusEffects["Minor"];
  const statusEffectsListHeavy = threatsData.statusEffects["Heavy"];

  if (severity === "Massive") {
    // 50% chance to pull either a Minor status effect with Heavy damage or a Heavy status effect with Minor damage
    const useMinorEffect = Math.random() < 0.5;

    if (useMinorEffect) {
      // Pick a Minor status effect with Heavy damage
      const statusEffect = getRandomElement(statusEffectsListMinor);
      const heavyDamage = threatsData.Damage[groupLevel]["Heavy"];
      return `${statusEffect} and ${heavyDamage} damage`;
    } else {
      // Pick a Heavy status effect with Minor damage
      const statusEffect = getRandomElement(statusEffectsListHeavy);
      const minorDamage = threatsData.Damage[groupLevel]["Minor"];
      return `${statusEffect} and ${minorDamage} damage`;
    }
  } else {
    // Regular logic for Minor and Heavy severities
    const statusEffectsList = threatsData.statusEffects[severity];
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
  const effectTableId = game.settings.get("lookfar", "rollTable");
  const keywordTableId = game.settings.get("lookfar", "keywordRollTable");

  // Variable to hold the effect text
  let effectText = "No discovery effect available.";
  let keywords = [];

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

  // Check if the Discovery Keywords Roll Table is selected
  if (keywordTableId && keywordTableId !== "default") {
    const rollTable = game.tables.get(keywordTableId);
    if (rollTable) {
      console.log(`Rolling on the Discovery Keywords Roll Table: ${rollTable.name}`);
      for (let i = 0; i < (type === "major" ? 4 : 2) + Math.floor(Math.random() * (type === "major" ? 3 : 2)); i++) { // Get 4-6 for major, 2-3 for minor
        const rollResult = await rollTable.roll();
        if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
          keywords.push(rollResult.results[0].text); // Add the result to the keywords list
        }
      }
    } else {
      console.error("Selected Discovery Keywords Roll Table not found. Falling back to defaults.");
    }
  }

  // If no keywords table is selected or it's set to default, use the default traits/terrain
  if (keywordTableId === "default" || keywords.length === 0) {
    const terrain = Array.isArray(dataLoader.discoveryData.terrain)
      ? generateUniqueList(dataLoader.discoveryData.terrain, 4, 6)
      : [];

    const traits = Array.isArray(dataLoader.discoveryData.traits)
      ? generateUniqueList(dataLoader.discoveryData.traits, 4, 6)
      : [];

    // Return formatted table with default traits/terrain, and hide effect row for minor
    return `
      <table style="width: 100%; border-collapse: collapse;">
        ${type === "major" && effectText ? `
        <tr>
          <th style="padding: 5px; border: 1px solid #ddd; white-space: nowrap">Effect</th>
          <td style="padding: 5px; border: 1px solid #ddd;">${effectText}</td>
        </tr>
        ` : ""}
        <tr>
          <th style="padding: 5px; border: 1px solid #ddd; white-space: nowrap">Traits</th>
          <td style="padding: 5px; border: 1px solid #ddd;">${traits.join(", ")}</td>
        </tr>
        <tr>
          <th style="padding: 5px; border: 1px solid #ddd; white-space: nowrap">Terrain</th>
          <td style="padding: 5px; border: 1px solid #ddd;">${terrain.join(", ")}</td>
        </tr>
      </table>
    `;
  }

  // If the Discovery Keywords Roll Table is selected, return formatted table with keywords, and hide effect row for minor
  return `
    <table style="width: 100%; border-collapse: collapse;">
      ${type === "major" && effectText ? `
      <tr>
        <th style="padding: 5px; border: 1px solid #ddd; white-space: nowrap">Effect</th>
        <td style="padding: 5px; border: 1px solid #ddd;">${effectText}</td>
      </tr>
      ` : ""}
      <tr>
        <th style="padding: 5px; border: 1px solid #ddd; white-space: nowrap">Keywords</th>
        <td style="padding: 5px; border: 1px solid #ddd;">${keywords.join(", ")}</td>
      </tr>
    </table>
  `;
}
