Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
  const lookfarTools = [
    {
      name: 'LOOKFAR.Button.TravelCheck.Name',
      icon: 'fa-solid fa-person-hiking',
      onClick: () => Hooks.call('lookfarShowTravelCheckDialog'),
      sort: Number.MAX_SAFE_INTEGER // if FU sorts, this is effectively "last"
    }
  ];

  // mutate in place (FU expects this)
  for (const t of lookfarTools) tools.push(t);

  // optional: if FU uses your current ordering and not its own sort, you're already last
  // Do NOT return a new array; FU ignores it.
});
