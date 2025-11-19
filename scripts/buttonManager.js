function getLookfarTools() {
  const tools = [
    {
      // Travel Check Button
      name: "LOOKFAR.Button.TravelCheck.Name",
      icon: "fa-solid fa-person-hiking",
      onClick: () => Hooks.call("lookfarShowTravelCheckDialog"),
    },
  ];

  // GM-only tools
  if (game.user.isGM) {
    // Treasure Roll Button
    tools.push({
      name: "Treasure Roll",
      icon: "fa-solid fa-gem",
      onClick: () => Hooks.call("lookfarShowTreasureRollDialog"),
    });

    // Dungeon Builder Button
    tools.push({
      name: "Dungeon Builder",
      icon: "fa-solid fa-dungeon",
      onClick: () => Hooks.call("lookfarShowDungeonBuilderDialog"),
    });
  }

  // Item Forger Button (available to all users)
  tools.push({
    name: "Item Forger",
    icon: "fa-solid fa-hammer",
    onClick: () => Hooks.call("lookfarShowItemForgeDialog"),
  });

  // Placeholder for future buttons
  // tools.push({
  //   name: 'LOOKFAR.Button.AnotherFeature.Name',
  //   icon: 'fa-solid fa-compass',
  //   onClick: () => Hooks.call('lookfarShowAnotherFeature'),
  // });

  return tools;
}

// Hook into the FU toolbar hook and push our tools
Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
  for (const tool of getLookfarTools()) tools.push(tool);
  return tools;
});
