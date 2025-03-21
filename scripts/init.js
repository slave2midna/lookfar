import { LookfarSettings } from "./settings.js";
import { dataLoader } from "./dataLoader.js";
import "./travelRoll.js";
import "./buttonManager.js";

Hooks.once("init", async () => {
  console.log("Lookfar Travel Assistant: Initializing...");
  await dataLoader.loadData();
  LookfarSettings.registerSettings();
});

Hooks.on("lookfarTravelRoll", async (selectedDifficulty) => {
  const result = await LookfarRolls.handleTravelRoll(selectedDifficulty);
  Hooks.call("lookfarShowRerollDialog", result);
});

console.log("Lookfar GM Assistant Loaded.");
