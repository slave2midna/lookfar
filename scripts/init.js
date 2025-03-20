import { LookfarSettings } from "./settings.js";
import { LookfarRolls } from "./travelRoll.js";
import { dataLoader } from "./dataLoader.js";

// Initialize the module
Hooks.once("init", async () => {
  console.log("Lookfar Travel Assistant: Initializing...");

  // Load Data first before proceeding
  await dataLoader.loadData();

  // Now initialize everything else
  LookfarSettings.registerSettings();
  LookfarUI.init();

  // Expose Travel Check Dialog globally
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

// Socket handling for multiplayer
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

console.log("Lookfar Travel Assistant Loaded.");
