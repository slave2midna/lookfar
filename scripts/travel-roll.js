import { dataLoader } from "./dataLoader.js";

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
    default: "5",
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
  // Adjusts the discovery condition
  return rollResult <= 1 + treasureHunterLevel;
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
roll.render().then((rollHTML) => {
  let chatData = {
    user: game.userId,
    speaker: { alias: "System" },
    content: rollHTML,
    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
    roll: roll,
  };

  // Only include whisper key if it's meant to be whispered to GMs
  if (isWhisper) {
    chatData.whisper = gmUserIds;
  }

  ChatMessage.create(chatData);
});

  // Determine the group level set by the GM
  const groupLevel = game.settings.get(
    "lookfar",
    "groupLevel"
  );

  let resultMessage = "";

  if (roll.total >= 6) {
    resultMessage = "Danger! " + generateDanger(groupLevel);
  } else if (shouldMakeDiscovery(roll.total)) {
    resultMessage = "Discovery! " + generateDiscovery();
  } else {
    resultMessage = "The travel day passed without incident.";
  }

  showRerollDialog(resultMessage, selectedDifficulty, groupLevel);
}

function showRerollDialog(initialResult, selectedDifficulty, groupLevel) {
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
            speaker: { alias: "System" },
          });
        },
      },
      reroll: {
        icon: '<i class="fas fa-redo" style="color: white;"></i>',
        callback: () => {
          let newResultMessage;
          if (isDanger) {
            const newDangerResult = generateDanger(groupLevel);
            newResultMessage = "Danger! " + newDangerResult;
          } else {
            const newDiscoveryResult = generateDiscovery();
            newResultMessage = "Discovery! " + newDiscoveryResult;
          }
          showRerollDialog(newResultMessage, selectedDifficulty, groupLevel);
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

function generateDanger(groupLevel) {
  if (!dataLoader.threatsData || !dataLoader.threatsData.statusEffects) {
    console.error("Threats data is not fully loaded.");
    return "Error: Data not available.";
  }

  const severity = randomSeverity();
  const threatType = randomThreatType();
  const readableThreatType = toReadableText(threatType);
  const fluffDescription = getRandomElement(dataLoader.fluffData);

  let result = `<strong>${severity} ${readableThreatType}:</strong> `;

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

  return `<table style="width:100%"><tr><td>${result}</td></tr><tr><td><strong>Source:</strong> ${fluffDescription}</td></tr></table>`;
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
  const statusEffectsList = threatsData.statusEffects[severity]; 

  // Check if statusEffectsList is available and has items
  if (!statusEffectsList || statusEffectsList.length === 0) {
    return "No status effects available";  // Handle the case when status effects for the severity are missing or empty
  }
  // For Heavy, combine Minor status effect with Minor damage
  if (severity === "Heavy") {
    const statusEffect = getRandomElement(threatsData.statusEffects["Minor"]);
    const minorDamage = threatsData.Damage[groupLevel]["Minor"];
    return `${statusEffect} and ${minorDamage} damage`;
  } else {
    return getRandomElement(statusEffectsList);  // Select random effect from available list
  }
}

function randomSeverity() {
  const roll = Math.random();
  return roll < 0.6 ? "Minor" : roll < 0.9 ? "Heavy" : "Massive";
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

function generateDiscovery() {
  console.log(
    "Discovery Data check: ",
    JSON.stringify(dataLoader.discoveryData)
  );
  if (!dataLoader.discoveryData) {
    console.error("Error: discoveryData is not loaded.");
    return "Error: discoveryData is not available.";
  }
  // Check if adjectives array is missing or empty
  if (
    !dataLoader.discoveryData.adjectives ||
    dataLoader.discoveryData.adjectives.length === 0
  ) {
    console.error("Error: Adjectives data is missing or empty.");
    return "Error: Adjectives data is not available.";
  }

  // Check if nouns array is missing or empty
  if (
    !dataLoader.discoveryData.nouns ||
    dataLoader.discoveryData.nouns.length === 0
  ) {
    console.error("Error: Nouns data is missing or empty.");
    return "Error: Nouns data is not available.";
  }

  // Check if effects object is missing or empty
  if (
    !dataLoader.discoveryData.effects ||
    Object.keys(dataLoader.discoveryData.effects).length === 0
  ) {
    console.error("Error: Effects data is missing or empty.");
    return "Error: Effects data is not available.";
  }

  // Generate keywords
  const keywords = [];
  const totalKeywords = Math.floor(Math.random() * 3) + 8; // Generates between 8 to 10
  for (let i = 0; i < totalKeywords; i++) {
    const wordList =
      i % 2 === 0
        ? dataLoader.discoveryData.adjectives
        : dataLoader.discoveryData.nouns;
    const word = wordList[Math.floor(Math.random() * wordList.length)];
    keywords.push(word);
  }

  // Select a random effect from the discoveries
  const effectsKeys = Object.keys(dataLoader.discoveryData.effects);
  const randomEffectKey =
    effectsKeys[Math.floor(Math.random() * effectsKeys.length)];
  const effectDescription = dataLoader.discoveryData.effects[randomEffectKey];

  // Combine the effect with the keywords
  return `
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 5px; border: 1px solid #ddd;"><strong>Effect:</strong></td>
        <td style="padding: 5px; border: 1px solid #ddd;">${randomEffectKey}: ${effectDescription}</td>
      </tr>
      <tr>
        <td style="padding: 5px; border: 1px solid #ddd;"><strong>Keywords:</strong></td>
        <td style="padding: 5px; border: 1px solid #ddd;">${keywords.join(
    ", "
  )}</td>
      </tr>
    </table>
  `;
}
