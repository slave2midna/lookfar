import "./cacheManager.js";
import { LookfarSettings } from "./settings.js";
import { dataLoader } from "./dataLoader.js";

import "./travelRoll.js";
import "./treasureRoll.js";
import "./itemForge.js";
import "./dungeonMapper.js";
import "./buttonManager.js";

// NEW: Load quick encounter / battle summoner dialog logic
import "./quickEncounter.js";

Hooks.once("init", async () => {
  console.log("Lookfar GM Assistant: Initializing...");

  // Load static data files (equipment, qualities, dangers, discoveries, etc.)
  await dataLoader.loadData();

  // Register Lookfar settings
  LookfarSettings.registerSettings();

  console.log("Lookfar GM Assistant Loaded.");
});

Hooks.once("ready", () => {
  // Register dynamic settings that require game ready
  LookfarSettings.registerDynamicRollTableSettings();
});
