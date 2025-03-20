import { dataLoader } from "./dataLoader.js";

export const LookfarRolls = {
  async handleTravelRoll(selectedDifficulty) {
    const wellTraveled = game.settings.get("lookfar", "wellTraveled");
    const characterMessage = game.settings.get("lookfar", "characterMessage");

    // Reduce dice size if Well-Traveled is checked
    if (wellTraveled) {
      selectedDifficulty = LookfarRolls.reduceDiceSize(selectedDifficulty);
      if (characterMessage) {
        ChatMessage.create({
          content: characterMessage,
        });
      }
    }

    let roll = new Roll(selectedDifficulty);
    await roll.evaluate({ async: true });

    await LookfarRolls.sendChatMessage(roll);

    const groupLevel = game.settings.get("lookfar", "groupLevel");
    let discoveryType = LookfarRolls.shouldMakeDiscovery(roll.total);
    let dangerSeverity = "";

    let resultMessage = "";
    if (roll.total >= 6) {
      dangerSeverity = await LookfarRolls.randomSeverity(selectedDifficulty);
      resultMessage = `${dangerSeverity} Danger! ` + await LookfarRolls.generateDanger(selectedDifficulty, groupLevel, dangerSeverity);
    } else if (discoveryType) {
      resultMessage = discoveryType === "major"
        ? "Major Discovery! " + await LookfarRolls.generateDiscovery("major")
        : "Minor Discovery! " + await LookfarRolls.generateDiscovery("minor");
    } else {
      resultMessage = "The travel day passed without incident.";
    }

    game.socket.emit("module.lookfar", {
      type: "showResult",
      resultMessage,
      selectedDifficulty,
      groupLevel,
      dangerSeverity,
      discoveryType,
    });

    return { resultMessage, selectedDifficulty, groupLevel, dangerSeverity, discoveryType };
  },

  async sendChatMessage(roll) {
    let rollHTML = await roll.render();
    let chatData = {
      user: game.userId,
      speaker: { alias: "Travel Roll" },
      content: rollHTML,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [roll],
    };

    let chatMessage = await ChatMessage.create(chatData);

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
  },

  shouldMakeDiscovery(rollResult) {
    const treasureHunterLevel = parseInt(game.settings.get("lookfar", "treasureHunterLevel"));
    const minorDiscoveriesEnabled = game.settings.get("lookfar", "minorDiscoveries");

    if (minorDiscoveriesEnabled) {
      if (rollResult === 1) {
        return "major";
      } else if (rollResult === 2 || rollResult === 3) {
        return "minor";
      }
    }

    return rollResult <= 1 + treasureHunterLevel ? "major" : false;
  },

  reduceDiceSize(diceSize) {
    const diceMap = { d8: "d6", d10: "d8", d12: "d10", d20: "d12" };
    return diceMap[diceSize] || diceSize;
  },

  async generateDanger(selectedDifficulty, groupLevel, dangerSeverity) {
    if (!dataLoader.threatsData || !dataLoader.threatsData.statusEffects) {
      console.error("Threats data is not fully loaded.");
      return "Error: Data not available.";
    }

    const threatType = LookfarRolls.randomThreatType();
    const readableThreatType = LookfarRolls.toReadableText(threatType);
    const dangerSourceTableId = game.settings.get("lookfar", "dangerSourceRollTable");

    let sourceText = "No danger source available.";
    if (dangerSourceTableId && dangerSourceTableId !== "default") {
      const rollTable = game.tables.get(dangerSourceTableId);
      if (rollTable) {
        const rollResult = await rollTable.roll();
        if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
          sourceText = rollResult.results[0].text;
        }
      }
    } else if (dataLoader.sourceData && Array.isArray(dataLoader.sourceData)) {
      const randomSourceIndex = Math.floor(Math.random() * dataLoader.sourceData.length);
      sourceText = dataLoader.sourceData[randomSourceIndex];
    }

    let result = "";
    switch (threatType) {
      case "Damage":
        result += LookfarRolls.handleDamage(dataLoader.threatsData, groupLevel, dangerSeverity);
        break;
      case "statusEffect":
        result += LookfarRolls.handleStatusEffect(dataLoader.threatsData, dangerSeverity, groupLevel);
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
        return "Error: Unknown threat type.";
    }

    return `
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <th>Threat</th>
          <td>${result}</td>
        </tr>
        <tr>
          <th>Source</th>
          <td>${sourceText}</td>
        </tr>
      </table>
    `;
  },

  async generateDiscovery(type = "major") {
    console.log("Generating Discovery... Type:", type);

    const effectTableId = game.settings.get("lookfar", "rollTable");
    const keywordTableId = game.settings.get("lookfar", "keywordRollTable");

    let effectText = "No discovery effect available.";
    let keywords = [];

    if (type === "major" && effectTableId !== "default") {
      const rollTable = game.tables.get(effectTableId);
      if (rollTable) {
        const rollResult = await rollTable.roll();
        if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
          effectText = rollResult.results[0].text;
        }
      }
    }

    if (keywordTableId !== "default") {
      const rollTable = game.tables.get(keywordTableId);
      if (rollTable) {
        for (let i = 0; i < (type === "major" ? 4 : 2) + Math.floor(Math.random() * 3); i++) {
          const rollResult = await rollTable.roll();
          if (rollResult?.results?.length > 0 && rollResult.results[0]?.text) {
            keywords.push(rollResult.results[0].text);
          }
        }
      }
    }

    return `
      <table style="width: 100%; border-collapse: collapse;">
        ${type === "major" ? `<tr><th>Effect</th><td>${effectText}</td></tr>` : ""}
        <tr>
          <th>Keywords</th>
          <td>${keywords.join(", ")}</td>
        </tr>
      </table>
    `;
  },

  randomSeverity(difficulty) {
    const difficultyMatch = /^d(\d+)$/.exec(difficulty);
    const difficultyNumber = difficultyMatch ? parseInt(difficultyMatch[1]) : NaN;
    if (isNaN(difficultyNumber) || difficultyNumber <= 0) {
      throw new Error(`Invalid difficulty number: ${difficulty}`);
    }

    const severityRoll = Math.floor(Math.random() * difficultyNumber) + 1;
    if (severityRoll <= 5) return "Minor";
    if (severityRoll <= 9) return "Heavy";
    return "Massive";
  },

  randomThreatType() {
    const types = ["Damage", "statusEffect", "Combat", "dangerClock", "villainPlanAdvance"];
    return types[Math.floor(Math.random() * types.length)];
  },

  toReadableText(str) {
    return str.replace(/([A-Z])/g, " $1").trim();
  }
};

// Register the handler
Hooks.on("lookfarTravelRoll", async (selectedDifficulty) => {
  const result = await LookfarRolls.handleTravelRoll(selectedDifficulty);
  Hooks.call("lookfarShowRerollDialog", result);
});