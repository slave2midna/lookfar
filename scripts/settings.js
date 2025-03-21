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
  },

  registerDynamicRollTableSettings() {
    const rollTableChoices = LookfarSettings.getRollTableChoices();
    
    // Discovery Effect Roll Table
game.settings.register("lookfar", "discoveryEffectRollTable", {
  name: "Discovery Effect Roll Table",
  hint: "Select the Roll Table to use for generating discovery effects.",
  scope: "world",
  config: true,
  type: String,
  choices: rollTableChoices,
  default: "default",
  requiresReload: true
});

// Discovery Source Roll Table
game.settings.register("lookfar", "discoverySourceRollTable", {
  name: "Discovery Source Roll Table",
  hint: "Select the Roll Table to use for generating discovery sources.",
  scope: "world",
  config: true,
  type: String,
  choices: rollTableChoices,
  default: "default",
  requiresReload: true
});

// Danger Threat Roll Table
game.settings.register("lookfar", "dangerThreatRollTable", {
  name: "Danger Threat Roll Table",
  hint: "Select the Roll Table to use for generating danger threats.",
  scope: "world",
  config: true,
  type: String,
  choices: rollTableChoices,
  default: "default",
  requiresReload: true
});

// Danger Source Roll Table
game.settings.register("lookfar", "dangerSourceRollTable", {
  name: "Danger Source Roll Table",
  hint: "Select the Roll Table to use for generating danger sources.",
  scope: "world",
  config: true,
  type: String,
  choices: rollTableChoices,
  default: "default",
  requiresReload: true
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
    game.settings.settings.get("lookfar.discoveryEffectRollTable").choices = rollTableChoices;
    game.settings.settings.get("lookfar.discoverySourceRollTable").choices = rollTableChoices;
    game.settings.settings.get("lookfar.dangerThreatRollTable").choices = rollTableChoices;
    game.settings.settings.get("lookfar.dangerSourceRollTable").choices = rollTableChoices;
  }
};
