export const LookfarUI = {
  init() {
    // Add CSS styles dynamically
    $(`<link rel="stylesheet" type="text/css" href="/modules/lookfar/styles/style.css">`).appendTo("head");

    // Add travel check button to Project FU's toolbar
    Hooks.on(projectfu.SystemControls.HOOK_GET_SYSTEM_TOOLS, (tools) => {
      console.log("Adding Travel Check button to toolbar...");
      let travelCheckButton = {
        name: "Travel Check",
        title: "Make a Travel Check",
        icon: "fa-solid fa-person-hiking",
        button: true,
        onClick: () => {
          console.log("Travel Check button clicked!");
          LookfarUI.showTravelCheckDialog();
        },
        visible: true
      };
      tools.push(travelCheckButton);
      console.log("Button added to the toolbar:", tools);
    });
  },

  // Travel check dialog UI
  showTravelCheckDialog() {
    console.log("Opening Travel Check dialog...");
    new Dialog({
      title: "Travel Check",
      content: LookfarUI.getTravelCheckForm(),
      render: (html) => {
        html.addClass("ff6-dialog");
      },
      buttons: {
        roll: {
          icon: '<i class="fas fa-check" style="color: white"></i>',
          callback: (html) => {
            const selectedDifficulty = html.find('[name="travelCheck"]:checked').val();
            Hooks.call("lookfarTravelRoll", selectedDifficulty);
          },
        },
      },
      default: "roll",
      close: () => {},
    }).render(true);
  },

  // Generates travel check form
  getTravelCheckForm() {
    return `
      <style>
        .travel-check-table {
          width: 100%;
          border-collapse: collapse;
        }
        .travel-check-table td, .travel-check-table th {
          padding: 5px;
          text-align: left;
          vertical-align: top;
        }
        .travel-check-table td:first-child {
          width: 1%;
          white-space: nowrap;
        }
      </style>
      <form>
        <table class="travel-check-table">
          <caption style="font-weight: bold; margin-bottom: 10px;">Threat Level</caption>
          <tbody>
            ${LookfarUI.getTravelCheckOptions()}
          </tbody>
        </table>
      </form>
    `;
  },

  // Generates travel check options dynamically
  getTravelCheckOptions() {
    const travelChecks = {
      "Minimal": "d6",
      "Low": "d8",
      "Medium": "d10",
      "High": "d12",
      "Very High": "d20",
    };

    return Object.entries(travelChecks)
      .map(
        ([key, value], index) => `
        <tr>
          <td>
            <label>
              <input type="radio" name="travelCheck" value="${value}" ${index === 0 ? "checked" : ""}>
              ${key} (${value})
            </label>
          </td>
        </tr>
      `
      )
      .join("");
  },

  // Show a result confirmation dialog (Reroll UI)
  showRerollDialog(initialResult, selectedDifficulty, groupLevel, dangerSeverity, discoveryType) {
    let isDanger = initialResult.includes("Danger!");
    let title = isDanger ? "Confirm Danger Result" : "Confirm Discovery Result";

    // Close existing dialog if open
    if (LookfarUI.currentDialog) {
      LookfarUI.currentDialog.close();
    }

    const isGM = game.user.isGM;
    const buttons = isGM ? {
      keep: {
        icon: '<i class="fas fa-check" style="color: white;"></i>',
        callback: () => {
          LookfarUI.sendResultToChat(initialResult);
          game.socket.emit("module.lookfar", { type: "closeDialog" });

          if (LookfarUI.currentDialog) {
            LookfarUI.currentDialog.close();
          }
        },
      },
      reroll: {
        icon: '<i class="fas fa-redo" style="color: white;"></i>',
        callback: async () => {
          let newResultMessage;
          if (isDanger) {
            const newDangerResult = await Hooks.call("lookfarGenerateDanger", selectedDifficulty, groupLevel, dangerSeverity);
            newResultMessage = `${dangerSeverity} Danger! ` + newDangerResult;
          } else if (discoveryType) {
            const newDiscoveryResult = await Hooks.call("lookfarGenerateDiscovery", discoveryType);
            newResultMessage = discoveryType === "major"
              ? "Major Discovery! " + newDiscoveryResult
              : "Minor Discovery! " + newDiscoveryResult;
          } else {
            const newDiscoveryResult = await Hooks.call("lookfarGenerateDiscovery", "major");
            newResultMessage = "Discovery! " + newDiscoveryResult;
          }

          game.socket.emit("module.lookfar", {
            type: "showResult",
            resultMessage: newResultMessage,
            selectedDifficulty,
            groupLevel,
            dangerSeverity,
            discoveryType,
          });

          setTimeout(() => {
            LookfarUI.showRerollDialog(newResultMessage, selectedDifficulty, groupLevel, dangerSeverity, discoveryType);
          }, 100);
        },
      },
    } : {}; // Non-GM users get no buttons

    LookfarUI.currentDialog = new Dialog({
      title: title,
      render: (html) => {
        html.addClass("ff6-dialog");
      },
      content: `<p><strong>Current Result:</strong></p>
                ${initialResult}
                <p>${isGM ? "Do you want to keep this result or reroll?" : "Waiting for GM decision..."}</p>`,
      buttons: buttons,
      default: "keep",
      close: () => {
        LookfarUI.currentDialog = null;
      },
    });

    LookfarUI.currentDialog.render(true);
  },

  sendResultToChat(resultMessage) {
    const rollVisibility = game.settings.get("lookfar", "rollVisibility");
    const isWhisper = rollVisibility === "gmOnly";
    const gmUserIds = isWhisper ? game.users.filter((user) => user.isGM).map((gm) => gm.id) : [];

    ChatMessage.create({
      content: resultMessage,
      whisper: isWhisper ? gmUserIds : [],
      speaker: { alias: "System" },
    });
  }
};
