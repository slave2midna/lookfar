Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
  const lookfarTools = [
    {
      name: 'LOOKFAR.Button.TravelCheck.Name',   // i18n key (FU will localize)
      icon: 'fa-solid fa-person-hiking',
      onClick: () => Hooks.call('lookfarShowTravelCheckDialog'),
      sort: Number.MAX_SAFE_INTEGER,            // if FU sorts numerically, this puts us last
      __lookfar: true                           // tag so we can force order even if FU ignores sort
    }
    // Add more Lookfar buttons here; keep the __lookfar tag
  ];

  // Combine tools and return with Lookfar items forced to the end
  const out = [...tools, ...lookfarTools].sort((a, b) => {
    const aL = !!a.__lookfar, bL = !!b.__lookfar;
    if (aL !== bL) return aL ? 1 : -1;         // non-Lookfar first, Lookfar last
    // Within each group, honor sort if present
    return (a.sort ?? 0) - (b.sort ?? 0);
  });

  return out;
});
