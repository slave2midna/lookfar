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
        gmOnly: game.i18n.localize("LOOKFAR.Settings.ResultVisibility.Choices.GMOnly")
      },
      default: "public",
      requiresReload: true
    });

    game.settings.register("lookfar", "itemForgeVisibility", {
      name: "Item Forger Visibility",
      hint: "Choose whether the item forge dialog options are public or GM only.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        public: "Public",
        gmOnly: "GM Only"
      },
      default: "gmOnly",
      requiresReload: true
    });

    game.settings.register("lookfar", "itemForgeRestrictInputs", {
      name: "Restrict Item Forge Inputs",
      hint: "When enabled, only GMs can change Item Forger options.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false
    });

    game.settings.register("lookfar", "enableKeywords", {
      name: game.i18n.localize("LOOKFAR.Settings.EnableKeywords.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.EnableKeywords.Hint"),
      scope: "world",
      config: true,
      type: Boolean,
      default: false
    });

    game.settings.register("lookfar", "useVariantTravelRules", {
      name: "Use Variant Travel Rules",
      hint: "Placeholder setting: Toggles alternative travel mechanics (currently unused).",
      scope: "world",
      config: true,
      default: false,
      type: Boolean
    });

    game.settings.register("lookfar", "useVariantDamageRules", {
      name: "Use Playtest Damage Rules",
      hint: "When generating new weapons, damage will be based on new playtest rules.",
      scope: "world",
      config: true,
      default: false,
      type: Boolean
    });
  },

  registerDynamicRollTableSettings() {
    // Initial choices at registration time (will be kept fresh by hooks below)
    const rollTableChoices = LookfarSettings.getRollTableChoices();

    game.settings.register("lookfar", "discoveryEffectRollTable", {
      name: game.i18n.localize("LOOKFAR.Settings.DiscoveryEffectTable.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.DiscoveryEffectTable.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default"
    });

    game.settings.register("lookfar", "discoverySourceRollTable", {
      name: game.i18n.localize("LOOKFAR.Settings.DiscoverySourceTable.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.DiscoverySourceTable.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default"
    });

    game.settings.register("lookfar", "dangerThreatRollTable", {
      name: game.i18n.localize("LOOKFAR.Settings.DangerThreatTable.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.DangerThreatTable.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default"
    });

    game.settings.register("lookfar", "dangerSourceRollTable", {
      name: game.i18n.localize("LOOKFAR.Settings.DangerSourceTable.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.DangerSourceTable.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default"
    });

    game.settings.register("lookfar", "customTreasureRollTable", {
      name: "Custom Treasure Roll Table",
      hint: "Select the Roll Table to use for generating custom treasure.",
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default"
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

  // Update the registry (game.settings.settings) so future renders pick up new tables
  updateRollTableChoices() {
    const rollTableChoices = LookfarSettings.getRollTableChoices();
    const reg = game.settings.settings;
    // Guard if registry not ready yet
    if (!reg) return;

    const keys = [
      "lookfar.discoveryEffectRollTable",
      "lookfar.discoverySourceRollTable",
      "lookfar.dangerThreatRollTable",
      "lookfar.dangerSourceRollTable",
      "lookfar.customTreasureRollTable"
    ];

    for (const fullKey of keys) {
      const setting = reg.get(fullKey);
      if (setting) setting.choices = rollTableChoices;
    }
  }
};

/* -------------------------------------------------------------------------- */
/*  Live-refresh the settings registry choices and re-render Settings UI.     */
/*  This avoids page reloads when RollTables are added/renamed/deleted.       */
/* -------------------------------------------------------------------------- */

if (!globalThis._lookfarSettingsLiveChoices) {
  globalThis._lookfarSettingsLiveChoices = true;

  // Ensure registry choices are fresh once the world is ready
  Hooks.once("ready", () => {
    LookfarSettings.updateRollTableChoices();
  });

  const onTablesChanged = () => {
    LookfarSettings.updateRollTableChoices();
    const win = Object.values(ui.windows).find(w => w instanceof SettingsConfig);
    if (win) win.render(false);
  };

  Hooks.on("createRollTable", onTablesChanged);
  Hooks.on("updateRollTable", onTablesChanged);
  Hooks.on("deleteRollTable", onTablesChanged);
}





