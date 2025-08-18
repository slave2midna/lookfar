import { LookfarSettings } from "./settings.js";
import { dataLoader } from "./dataLoader.js";
import "./cacheManager.js";
import "./travelRoll.js";
import "./treasureRoll.js";
import "./buttonManager.js";

Hooks.once("init", async () => {
  console.log("Lookfar GM Assistant: Initializing...");
  await dataLoader.loadData();
  LookfarSettings.registerSettings();
  console.log("Lookfar GM Assistant Loaded.");
});

Hooks.once("ready", () => {
  LookfarSettings.registerDynamicRollTableSettings();
});

