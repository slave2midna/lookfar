export const LookfarSettings = {
  registerSettings() {
    game.settings.register("lookfar", "resultVisibility", {
      name: game.i18n.localize("LOOKFAR.Settings.ResultVisibility.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.ResultVisibility.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: {
        public: game.i18n.localize("LOOKFAR.Settings.ResultVisibility.Choices.Public"),
        gmOnly: game.i18n.localize("LOOKFAR.Settings.ResultVisibility.Choices.GMOnly"),
      },
      default: "public",
    });

    game.settings.register("lookfar", "enableKeywords", {
      name: game.i18n.localize("LOOKFAR.Settings.EnableKeywords.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.EnableKeywords.Hint"),
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    });
  },

  registerDynamicRollTableSettings() {
    const rollTableChoices = LookfarSettings.getRollTableChoices();

    game.settings.register("lookfar", "discoveryEffectRollTable", {
      name: game.i18n.localize("LOOKFAR.Settings.DiscoveryEffectTable.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.DiscoveryEffectTable.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default",
      requiresReload: true
    });

    game.settings.register("lookfar", "discoverySourceRollTable", {
      name: game.i18n.localize("LOOKFAR.Settings.DiscoverySourceTable.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.DiscoverySourceTable.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default",
      requiresReload: true
    });

    game.settings.register("lookfar", "dangerThreatRollTable", {
      name: game.i18n.localize("LOOKFAR.Settings.DangerThreatTable.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.DangerThreatTable.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default",
      requiresReload: true
    });

    game.settings.register("lookfar", "dangerSourceRollTable", {
      name: game.i18n.localize("LOOKFAR.Settings.DangerSourceTable.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.DangerSourceTable.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default",
      requiresReload: true
    });
  },

  getRollTableChoices() {
    const choices = { default: game.i18n.localize("LOOKFAR.Settings.DefaultRollTable") };
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
