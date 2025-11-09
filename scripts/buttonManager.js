function getLookfarTools() {
  const tools = [
    {
      // Travel Check Button
      name: 'LOOKFAR.Button.TravelCheck.Name',
      icon: 'fa-solid fa-person-hiking',
      onClick: () => Hooks.call('lookfarShowTravelCheckDialog'),
    }
  ];

  // Treasure Roll Button (GM-only)
  if (game.user.isGM) {
    tools.push({
      name: "Treasure Roll",
      icon: 'fa-solid fa-gem',
      onClick: () => Hooks.call('lookfarShowTreasureRollDialog'),
    });
  }

  // Item Forger Button
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
