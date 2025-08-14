Hooks.once("ready", () => {
  console.log("Button Manager: Ready Hook Fired");

  // Adds floating button for Travel Check into Project FU's toolbar
  Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
    console.log("Adding Travel Check button to toolbar...");

    const travelCheckButton = {
      name: game.i18n.localize("LOOKFAR.Button.TravelCheck.Name"),
      title: game.i18n.localize("LOOKFAR.Button.TravelCheck.Title"),
      icon: "fa-solid fa-person-hiking",
      button: true,
      onClick: () => {
        console.log("Travel Check button clicked!");
        Hooks.call("lookfarShowTravelCheckDialog");
      },
      visible: true,
      sort: 9999
    };

    tools.push(travelCheckButton);
    tools.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    console.log("Travel Check button added to the toolbar:", tools);
  });
});
