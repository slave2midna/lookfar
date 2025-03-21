Hooks.once("ready", () => {
  console.log("Button Manager: Ready Hook Fired");

  // Adds floating button for Travel Check into Project FU's toolbar
  Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
    console.log("Adding Travel Check button to toolbar...");
    
    let travelCheckButton = {
      name: "Travel Check",
      title: "Make a Travel Check",
      icon: "fa-solid fa-person-hiking",
      button: true,
      onClick: () => {
        console.log("Travel Check button clicked!");
        Hooks.call("lookfarShowTravelCheckDialog");
      },
      visible: true
    };
    tools.push(travelCheckButton);
    console.log("Travel Check button added to the toolbar:", tools);
  });

// // Adds floating button for Treasure Roll into Project FU's toolbar
// Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
//   console.log("Adding Treasure Roll button to toolbar...");
  
//   let treasureRollButton = {
//     name: "Treasure Roll",
//     title: "Generate Some Treasure",
//     icon: "fa-solid fa-gem",
//     button: true,
//     onClick: () => {
//       console.log("Treasure Roll button clicked!");
//       Hooks.call("lookfarShowTravelCheckDialog"); // Placeholder function
//     },
//     visible: true
//   };
//   tools.push(treasureRollButton);
//   console.log("Treasure Roll button added to the toolbar:", tools);
// });
});
