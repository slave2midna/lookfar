import { dataLoader } from "./dataLoader.js";

// Utility
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Loot Generation Functions
function rollMaterial(nature, origin, maxVal, budget, detailTables, originTables, natureTables, detailDescriptions) {
  if (!natureTables[nature] || budget < 50) return null;

  const detailKeys = Object.keys(detailTables);
  const detailType = getRandom(detailKeys);
  const name = `${getRandom(detailTables[detailType])} ${getRandom(originTables[origin])} ${getRandom(natureTables[nature])}`;
  const detail = detailDescriptions[detailType];
  let value = Math.floor(Math.random() * (maxVal / 50)) * 50;
  value = Math.max(50, Math.min(value, budget));

  if (value > budget) return null;
  return { name, value, detail };
}

function rollWeapon(weapons, weaponQualities, elements) {
  let base = getRandom(weapons);
  let name = base.name;
  let value = base.value;

  if (Math.random() < 0.5) {
    name = "+1 " + name;
    value += 100;
  }

  if (Math.random() < 0.5) {
    const element = getRandom(elements);
    name = name.includes("+1")
      ? `+1 ${element} ${name.split(" ")[1]}`
      : `${element} ${name}`;
    value += 100;
  }

  let quality = "None";
  if (Math.random() < 0.5) {
    const q = getRandom(weaponQualities);
    quality = q.name;
    value += q.value;
  }

  return { name, value, quality };
}

function rollArmor(armors, armorQualities) {
  const base = getRandom(armors);
  let name = base.name;
  let value = base.value;

  let quality = "None";
  if (Math.random() < 0.5) {
    const q = getRandom(armorQualities);
    quality = q.name;
    value += q.value;
  }

  return { name, value, quality };
}

function rollAccessory(accessories, accessoryQualities) {
  const type = getRandom(accessories);
  const quality = getRandom(accessoryQualities);
  return {
    name: `${quality.name} ${type}`,
    value: quality.value,
    quality: quality.name
  };
}

function rollIngredient(nature, origin, budget, tasteWords, natureTables, originTables) {
  if (!natureTables[nature] || budget < 10) return null;

  const taste = getRandom(tasteWords);
  const originWord = getRandom(originTables[origin]);
  const natureWord = getRandom(natureTables[nature]);

  const quantity = Math.floor(Math.random() * 3) + 1;
  const unitValue = taste === "Distinct" ? 20 : 10;
  const total = unitValue * quantity;

  if (total > budget) return null;

  return {
    name: `${taste} ${originWord} ${natureWord} x${quantity}`,
    value: total,
    taste: `Taste: ${taste}`
  };
}

// Helper to render results in a dialog with Keep/Reroll
function renderTreasureResultDialog(items, budget, inventoryPoints, config) {
  let html = ``;
  for (const item of items) {
    html += `<div style="text-align: center;"><strong>${item.name}</strong> (Value: ${item.value})<br>`;
    if (item.detail) html += `<em>${item.detail}</em><br>`;
    else if (item.taste) html += `<em>${item.taste}</em><br>`;
    else if (item.quality !== "None") html += `<em>Quality: ${item.quality}</em><br>`;
    html += `</div><br>`;
  }

  if (inventoryPoints > 0) {
    html += `<strong>Recovered Inventory Points:</strong> ${inventoryPoints}<br>`;
  }

  html += `<strong>Remaining Budget:</strong> ${budget}<br>`;

  new Dialog({
    title: "Treasure Results",
    content: html,
    buttons: {
      keep: {
        label: "Keep",
        callback: () => {
          ChatMessage.create({
            content: html,
            speaker: { alias: "Treasure Result" }
          });
        }
      },
      reroll: {
        label: "Reroll",
        callback: () => Hooks.call("lookfarShowTreasureRollDialog", config) // Pass stored config
      }
    }
  }).render(true);
}

// Hook Setup
Hooks.once("ready", () => {
  Hooks.on("lookfarShowTreasureRollDialog", (rerollConfig = null) => {
    const {
      natureTables,
      originTables,
      detailTables,
      detailDescriptions,
      weaponList,
      weaponQualities,
      weaponElements,
      armorList,
      armorQualities,
      accessoryNames,
      accessoryQualities,
      tasteWords
    } = dataLoader.treasureData;

    if (rerollConfig) {
      const {
        budget,
        maxVal,
        origin,
        nature,
        includeWeapons,
        includeArmor,
        includeAccessories,
        includeSupplies,
        includeIngredients,
        includeMaterials
      } = rerollConfig;

      let remainingBudget = budget;
      let inventoryPoints = includeSupplies ? Math.floor(Math.random() * 4) + 1 : 0;
      let items = [];
      let ingredientCount = 0;
      let failedAttempts = 0;
      let maxAttempts = 10;

      while (remainingBudget > 0 && items.length < 4 && failedAttempts < maxAttempts) {
        let value = Math.round((Math.random() * maxVal) / 10) * 10;
        if (value > remainingBudget) value = remainingBudget;

        let itemTypes = [];
        if (includeWeapons) itemTypes.push("Weapon");
        if (includeArmor) itemTypes.push("Armor");
        if (includeAccessories) itemTypes.push("Accessory");
        if (includeIngredients && ingredientCount < 3) itemTypes.push("Ingredient");
        if (includeMaterials) itemTypes.push("Material");

        if (itemTypes.length === 0) break;

        const type = getRandom(itemTypes);
        let item = null;

        switch (type) {
          case "Weapon":
            item = rollWeapon(weaponList, weaponQualities, weaponElements);
            break;
          case "Armor":
            item = rollArmor(armorList, armorQualities);
            break;
          case "Accessory":
            item = rollAccessory(accessoryNames, accessoryQualities);
            break;
          case "Material":
            item = rollMaterial(nature, origin, maxVal, remainingBudget, detailTables, originTables, natureTables, detailDescriptions);
            break;
          case "Ingredient":
            item = rollIngredient(nature, origin, remainingBudget, tasteWords, natureTables, originTables);
            ingredientCount++;
            break;
        }

        if (!item || item.value > remainingBudget || item.value > maxVal) {
          failedAttempts++;
          continue;
        }

        items.push(item);
        remainingBudget -= item.value;
      }

      if (items.length === 0 && inventoryPoints === 0) {
        ui.notifications.warn("No loot generated.");
        return;
      }

      renderTreasureResultDialog(items, remainingBudget, inventoryPoints, rerollConfig);
      return;
    }

    // If not a reroll, render the main form
    new Dialog({
      title: "Treasure Generator",
      content: `
        <form style="display: flex; gap: 25px;">
          <div style="flex: 1;">
            <div class="form-group">
              <label>Budget:</label>
              <input type="number" id="treasureBudget" value="1" min="1"/>
            </div>
            <div class="form-group">
              <label>PC Level:</label>
              <select id="highestPCLevel">
                <option value="500">5+</option>
                <option value="1000">10+</option>
                <option value="1500">20+</option>
                <option value="2000">30+</option>
                <option value="999999">40+</option>
              </select>
            </div>
            <div class="form-group">
              <label>Origin:</label>
              <select id="origin">
                ${Object.keys(originTables).map(o => `<option value="${o}">${o}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Nature:</label>
              <select id="nature">
                ${Object.keys(natureTables).map(n => `<option value="${n}">${n}</option>`).join("")}
              </select>
            </div>
          </div>
          <div style="flex: 1;">
            <label><input type="checkbox" id="includeWeapons"> Weapons</label><br>
            <label><input type="checkbox" id="includeArmor"> Armor</label><br>
            <label><input type="checkbox" id="includeAccessories"> Accessories</label><br>
            <label><input type="checkbox" id="includeSupplies"> Supplies</label><br>
            <label><input type="checkbox" id="includeIngredients"> Ingredients</label><br>
            <label><input type="checkbox" id="includeMaterials"> Materials</label>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: "Roll Loot",
          callback: (html) => {
            const budget = parseInt(html.find("#treasureBudget").val());
            const maxVal = parseInt(html.find("#highestPCLevel").val());
            const origin = html.find("#origin").val();
            const nature = html.find("#nature").val();

            const includeWeapons = html.find("#includeWeapons").is(":checked");
            const includeArmor = html.find("#includeArmor").is(":checked");
            const includeAccessories = html.find("#includeAccessories").is(":checked");
            const includeSupplies = html.find("#includeSupplies").is(":checked");
            const includeIngredients = html.find("#includeIngredients").is(":checked");
            const includeMaterials = html.find("#includeMaterials").is(":checked");

            Hooks.call("lookfarShowTreasureRollDialog", {
              budget,
              maxVal,
              origin,
              nature,
              includeWeapons,
              includeArmor,
              includeAccessories,
              includeSupplies,
              includeIngredients,
              includeMaterials
            });
          }
        }
      }
    }).render(true);
  });
});
