import { LookfarSettings } from "./settings.js";
import { LookfarUI } from "./uiManager.js";
import { LookfarRolls } from "./rollManager.js";
import { dataLoader } from "./dataLoader.js";

Hooks.once("init", async () => {
  // Load necessary data and initialize settings/UI
  await dataLoader.loadData();
  LookfarSettings.registerSettings();
  LookfarUI.init();

  // Expose global function for external use
  game.lookfar = game.lookfar || {};
  game.lookfar.showTravelCheckDialog = LookfarUI.showTravelCheckDialog;
});

// Handle travel rolls via the UI
Hooks.on("lookfarTravelRoll", async (selectedDifficulty) => {
  const result = await LookfarRolls.handleTravelRoll(selectedDifficulty);
  Hooks.call("lookfarShowRerollDialog", result);
});

// Handle reroll UI calls
Hooks.on("lookfarShowRerollDialog", (result) => {
  LookfarUI.showRerollDialog(
    result.resultMessage,
    result.selectedDifficulty,
    result.groupLevel,
    result.dangerSeverity,
    result.discoveryType
  );
});

// Listen for socket messages (shared between clients)
Hooks.on("ready", async () => {
  game.socket.on("module.lookfar", (data) => {
    if (data?.type === "showResult") {
      LookfarUI.showRerollDialog(
        data.resultMessage,
        data.selectedDifficulty,
        data.groupLevel,
        data.dangerSeverity,
        data.discoveryType
      );
    } else if (data?.type === "closeDialog") {
      if (LookfarUI.currentDialog) {
        LookfarUI.currentDialog.close();
      }
    }
  });
});
