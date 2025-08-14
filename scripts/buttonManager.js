function getLookfarTools() {
  return [
    {
      // Travel Check
      name: 'LOOKFAR.Button.TravelCheck.Name',
      icon: 'fa-solid fa-person-hiking',
      onClick: () => Hooks.call('lookfarShowTravelCheckDialog'),
    },

    // {
    //   // Example placeholder for a future feature
    //   name: 'LOOKFAR.Button.AnotherFeature.Name',
    //   icon: 'fa-solid fa-compass',
    //   onClick: () => Hooks.call('lookfarShowAnotherFeature'),
    // },
  ];
}

// Hook into the same FU toolbar hook and push all our tools.
Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
  for (const tool of getLookfarTools()) tools.push(tool);
  return tools;
});
