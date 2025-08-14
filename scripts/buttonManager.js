Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
  const lookfarTools = [
    {
      name: 'LOOKFAR.Button.TravelCheck.Name',
      icon: 'fa-solid fa-person-hiking',
      onClick: () => Hooks.call('lookfarShowTravelCheckDialog'),
      __lookfar: true,
      sort: Number.MAX_SAFE_INTEGER
    }
  ];

  for (const t of lookfarTools) tools.push(t);

  // Force Lookfar items to the end, keep relative order of others
  const others = tools.filter(t => !t.__lookfar);
  const ours   = tools.filter(t =>  t.__lookfar);
  tools.length = 0;              // mutate the same array object
  tools.push(...others, ...ours);
});
