export const LookfarSettings = {
  registerSettings() {
    game.settings.register("lookfar", "groupLevel", {
      name: "Group Level",
      hint: "Set the group level for generating dangers.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        "5+": "5+",
        "20+": "20+",
        "40+": "40+"
      },
      default: "5+"
    });

    game.settings.register("lookfar", "treasureHunterLevel", {
      name: "Treasure Hunter: Level",
      hint: "Modify the chance of discovery based on the level of Treasure Hunter skill.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        "0": "Level 0",
        "1": "Level 1",
        "2": "Level 2"
      },
      default: "0"
    });

    game.settings.register("lookfar", "wellTraveled", {
      name: "Well-Traveled",
      hint: "Check this if the party has the Well-Traveled trait, reducing travel roll difficulty.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false
    });

    game.settings.register("lookfar", "characterMessage", {
      name: "Character/Skill Message",
      hint: "Enter text that will display whenever the Travel Roll is affected by your group's Wayfarer.",
      scope: "world",
      config: true,
      type: String,
      default: ""
    });

    game.settings.register("lookfar", "minorDiscoveries", {
      name: "Enable Minor Discoveries",
      hint: "When enabled, travel rolls may result in minor discoveries (finds without effects).",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    });

    LookfarSettings.registerDynamicRollTableSettings();
  },

  registerDynamicRollTableSettings() {
    const rollTableChoices = LookfarSettings.getRollTableChoices();

    game.settings.register("lookfar", "rollTable", {
      name: "Discovery Effect Roll Table",
      hint: "Select the Roll Table to use for generating discovery effects.",
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default",
      onChange: (value) => console.log(`Selected Discovery Effect Roll Table: ${value}`)
    });

    game.settings.register("lookfar", "keywordRollTable", {
      name: "Discovery Keywords Roll Table",
      hint: "Select the Roll Table to use for generating discovery keywords.",
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default",
      onChange: (value) => console.log(`Selected Discovery Keywords Roll Table: ${value}`)
    });

    game.settings.register("lookfar", "dangerSourceRollTable", {
      name: "Danger Source Roll Table",
      hint: "Select the Roll Table to use for generating danger sources.",
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default",
      onChange: (value) => console.log(`Selected Danger Source Roll Table: ${value}`)
    });
  },

  getRollTableChoices() {
    const choices = { default: "Lookfar Defaults" };
    if (game.tables) {
      game.tables.contents.forEach((table) => {
        choices[table.id] = table.name;
      });
    }
    return choices;
  },

  updateRollTableChoices() {
    const rollTableChoices = LookfarSettings.getRollTableChoices();
    game.settings.settings.get("lookfar.rollTable").choices = rollTableChoices;
    game.settings.settings.get("lookfar.keywordRollTable").choices = rollTableChoices;
    game.settings.settings.get("lookfar.dangerSourceRollTable").choices = rollTableChoices;
  }
};
