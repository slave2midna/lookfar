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

    game.settings.register("lookfar", "itemForgeEditMode", {
      name: game.i18n.localize("LOOKFAR.Settings.ItemForgeEditMode.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.ItemForgeEditMode.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: {
        public: game.i18n.localize("LOOKFAR.Settings.ItemForgeEditMode.Choices.Public"),
        gmOnly: game.i18n.localize("LOOKFAR.Settings.ItemForgeEditMode.Choices.GMOnly"),
        locked: game.i18n.localize("LOOKFAR.Settings.ItemForgeEditMode.Choices.Locked"),
        hidden: game.i18n.localize("LOOKFAR.Settings.ItemForgeEditMode.Choices.Hidden")
      },
      default: "gmOnly",
      requiresReload: true
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
      name: game.i18n.localize("LOOKFAR.Settings.UseVariantTravelRules.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.UseVariantTravelRules.Hint"),
      scope: "world",
      config: true,
      default: false,
      type: Boolean
    });

    game.settings.register("lookfar", "useVariantDamageRules", {
      name: game.i18n.localize("LOOKFAR.Settings.UseVariantDamageRules.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.UseVariantDamageRules.Hint"),
      scope: "world",
      config: true,
      default: false,
      type: Boolean
    });

    // -----------------------------------------------------------------------
    // Conflict Builder: Monster Compendium (Actor packs only)
    // -----------------------------------------------------------------------
    game.settings.register("lookfar", "monsterCompendium", {
      name: game.i18n.localize("LOOKFAR.Settings.MonsterCompendium.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.MonsterCompendium.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: LookfarSettings.getActorCompendiumChoices(),
      default: "default"
    });

    // -----------------------------------------------------------------------
    // Conflict Builder: Battle Scene Name (Scene selector)
    // -----------------------------------------------------------------------
    game.settings.register("lookfar", "battleSceneName", {
      name: game.i18n.localize("LOOKFAR.Settings.BattleSceneName.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.BattleSceneName.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: LookfarSettings.getSceneChoices(),
      default: "default"
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
      name: game.i18n.localize("LOOKFAR.Settings.CustomTreasureRollTable.Name"),
      hint: game.i18n.localize("LOOKFAR.Settings.CustomTreasureRollTable.Hint"),
      scope: "world",
      config: true,
      type: String,
      choices: rollTableChoices,
      default: "default"
    });
  },

  // RollTable choices (existing)
  getRollTableChoices() {
    const choices = { default: game.i18n.localize("LOOKFAR.Settings.DefaultRollTable") };
    if (game.tables) {
      game.tables.contents.forEach((table) => {
        choices[table.id] = table.name;
      });
    }
    return choices;
  },

  // NEW: Actor Compendium choices for Conflict Builder
  getActorCompendiumChoices() {
    const choices = {
      default: game.i18n.localize("LOOKFAR.Settings.DefaultCompendium")
    };

    if (game.packs) {
      for (const pack of game.packs) {
        // Only include Actor packs
        if (pack.documentName === "Actor") {
          choices[pack.collection] = pack.title || pack.collection;
        }
      }
    }

    return choices;
  },

  // NEW: Scene choices for Conflict Builder
  getSceneChoices() {
    const choices = {
      default: game.i18n.localize("LOOKFAR.Settings.DefaultScene")
    };

    if (game.scenes) {
      game.scenes.forEach(scene => {
        choices[scene.id] = scene.name;
      });
    }

    return choices;
  },

  // Update the registry (game.settings.settings) so future renders pick up new tables
  updateRollTableChoices() {
    const rollTableChoices = LookfarSettings.getRollTableChoices();
    const reg = game.settings.settings;
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
      const cfg = setting;
      if (cfg) cfg.choices = rollTableChoices;
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
