Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
  tools.push({
    // Use the i18n key, just like FU does with 'FU.AppMetaCurrencyTrackerTitle'
    name: 'LOOKFAR.Button.TravelCheck.Name',
    icon: 'fa-solid fa-person-hiking',
    onClick: () => Hooks.call('lookfarShowTravelCheckDialog'),
  });

  // If FU consumes the returned array (pure function style), this helps.
  // If it mutates in-place, returning is harmless.
  return tools;
});
