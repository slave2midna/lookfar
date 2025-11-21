// Read Item Forge edit mode setting
function getItemForgeEditMode() {
  try {
    return game.settings.get("lookfar", "itemForgeEditMode") || "gmOnly";
  } catch {
    return "gmOnly";
  }
}

function getLookfarTools() {
  const tools = [];

  // ---------------------------------------------------------------------------
  // Global Tools
  // ---------------------------------------------------------------------------

  // Travel Check Button
  tools.push({
    name: "LOOKFAR.Button.TravelCheck.Name",
    icon: "fa-solid fa-person-hiking",
    onClick: () => Hooks.call("lookfarShowTravelCheckDialog")
  });

  // ---------------------------------------------------------------------------
  // GM-only tools
  // ---------------------------------------------------------------------------
  if (game.user.isGM) {

    // Treasure Roll Button
    tools.push({
      name: "Treasure Roll",
      icon: "fa-solid fa-gem",
      onClick: () => Hooks.call("lookfarShowTreasureRollDialog")
    });

    // Dungeon Builder Button
    tools.push({
      name: "Dungeon Builder",
      icon: "fa-solid fa-dungeon",
      onClick: () => Hooks.call("lookfarShowDungeonMapperDialog")
    });

    // Quick Encounter Button
    tools.push({
      name: "Quick Encounter",
      icon: "fa-solid fa-dragon",   // You can swap the icon if preferred
      onClick: () => Hooks.call("lookfarShowQuickEncounterDialog")
    });
  }

  // ---------------------------------------------------------------------------
  // Item Forger Button
  // ---------------------------------------------------------------------------
  const mode = getItemForgeEditMode(); // "public" | "gmOnly" | "locked" | "hidden"

  // Non-GM users: hide the button entirely when mode is "hidden"
  const hideForPlayer = (!game.user.isGM && mode === "hidden");

  if (!hideForPlayer) {
    tools.push({
      name: "Item Forger",
      icon: "fa-solid fa-hammer",
      onClick: () => Hooks.call("lookfarShowItemForgeDialog")
    });
  }

  return tools;
}

// Hook into the FU toolbar hook and push our tools
Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
  for (const tool of getLookfarTools()) tools.push(tool);
  return tools;
});
