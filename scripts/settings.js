export const LookfarSettings = {
  registerSettings() {
    
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

game.settings.register("lookfar", "enableKeywords", {
  name: "Enable Keywords",
  hint: "Enable keywords when generating travel check results.",
  scope: "world",
  config: true,
  type: Boolean,
  default: false,
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
