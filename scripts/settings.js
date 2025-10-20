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
      default: "public"
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

  // Kept for compatibility; not required for dynamic dropdowns anymore.
  updateRollTableChoices() {
    const rollTableChoices = LookfarSettings.getRollTableChoices();
    game.settings.settings.get("lookfar.discoveryEffectRollTable").choices = rollTableChoices;
    game.settings.settings.get("lookfar.discoverySourceRollTable").choices = rollTableChoices;
    game.settings.settings.get("lookfar.dangerThreatRollTable").choices = rollTableChoices;
    game.settings.settings.get("lookfar.dangerSourceRollTable").choices = rollTableChoices;
    game.settings.settings.get("lookfar.customTreasureRollTable").choices = rollTableChoices;
  }
};

/* -------------------------------------------------------------------------- */
/*  Dynamic population of roll-table selects without needing a page reload.   */
/*  Guarded to avoid duplicate hook installs across soft module reloads.      */
/* -------------------------------------------------------------------------- */

if (!globalThis._lookfarSettingsHooksWired) {
  globalThis._lookfarSettingsHooksWired = true;

  // Rebuild our dropdown options whenever the Settings UI renders
  Hooks.on("renderSettingsConfig", (app, html) => {
    if (!html || !html.length) return;

    const keys = [
      "discoveryEffectRollTable",
      "discoverySourceRollTable",
      "dangerThreatRollTable",
      "dangerSourceRollTable",
      "customTreasureRollTable"
    ];

    const choices = LookfarSettings.getRollTableChoices();

    for (const key of keys) {
      const name = `lookfar.${key}`;
      const $select = html.find(`select[name="${name}"]`);
      if (!$select.length) continue;

      const current = game.settings.get("lookfar", key);

      // Rebuild options from live data
      $select.empty();
      for (const [value, label] of Object.entries(choices)) {
        $select.append(new Option(label, value));
      }

      // Preserve selection if still valid; otherwise default to "default"
      if (choices[current]) $select.val(current);
      else $select.val("default");
    }
  });

  // If roll tables change while Settings is open, re-render that window to refresh selects
  const refreshSettingsIfOpen = () => {
    const win = Object.values(ui.windows).find(w => w instanceof SettingsConfig);
    if (win) win.render(false); // soft re-render
  };

  Hooks.on("createRollTable", refreshSettingsIfOpen);
  Hooks.on("updateRollTable", refreshSettingsIfOpen);
  Hooks.on("deleteRollTable", refreshSettingsIfOpen);
}
