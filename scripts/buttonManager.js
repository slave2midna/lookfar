Hooks.once("ready", () => {
  console.log("Button Manager: Ready Hook Fired");

  // Adds floating button for Travel Check into Project FU's toolbar
  Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
    console.log("Adding Travel Check button to toolbar...");

    const travelCheckButton = {
      name: "Travel Check",
      title: "Make a Travel Check",
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

  // Uncomment this section when the Treasure Roll feature is ready
  /*
  Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
    console.log("Adding Treasure Roll button to toolbar...");

    const treasureRollButton = {
      name: "Treasure Roll",
      title: "Generate Some Treasure",
      icon: "fa-solid fa-gem",
      button: true,
      onClick: () => {
        console.log("Treasure Roll button clicked!");
        Hooks.call("lookfarShowTravelCheckDialog"); // Placeholder
      },
      visible: true,
      sort: 10000
    };

    tools.push(treasureRollButton);
    tools.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    console.log("Treasure Roll button added to the toolbar:", tools);
  });
  */
});
