import { dataLoader } from "./dataLoader.js";

let natureTables, originTables, detailTables, detailDescriptions;
let weapons, weaponQualities, elements;
let armors, armorQualities;
let accessories, accessoryQualities, tasteWords;

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rollMaterial(nature, origin, maxVal, budget) {
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

function rollWeapon() {
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

function rollArmor() {
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

function rollAccessory() {
  const type = getRandom(accessories);
  const quality = getRandom(accessoryQualities);
  return {
    name: `${quality.name} ${type}`,
    value: quality.value,
    quality: quality.name
  };
}

function rollIngredient(nature, origin, budget) {
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

Hooks.on("lookfarShowTreasureRollDialog", () => {
  const {
    natureTables,
    originTables,
    detailTables,
    detailDescriptions,
    weapons,
    weaponQualities,
    elements,
    armors,
    armorQualities,
    accessories,
    accessoryQualities,
    tasteWords
  } = dataLoader.treasureData;

  new Dialog({
    render: (html) => {
    html.closest(".app").css({
      height: "auto",
      maxHeight: "600px",
      display: "flex",
      flexDirection: "column"
    });
  },
  title: "Treasure Generator",
  content: `
    <form style="display: flex; gap: 25px; height: 100%;">
      <div style="flex: 0.6;">
        <div class="form-group">
          <label for="treasureBudget">Budget:</label>
          <input type="number" id="treasureBudget" name="treasureBudget" min="1" value="1">
        </div>
        <div class="form-group">
          <label for="highestPCLevel">PC Level:</label>
          <select id="highestPCLevel" name="highestPCLevel">
            <option value="500">5+</option>
            <option value="1000">10+</option>
            <option value="1500">20+</option>
            <option value="2000">30+</option>
            <option value="999999">40+</option>
          </select>
        </div>
        <div class="form-group">
          <label for="origin">Origin:</label>
          <select id="origin" name="origin">
            ${Object.keys(originTables)
              .map((o) => `<option value="${o}">${o}</option>`)
              .join("")}
          </select>
        </div>
        <div class="form-group">
          <label for="nature">Nature:</label>
          <select id="nature" name="nature">
            ${Object.keys(natureTables)
              .map((n) => `<option value="${n}">${n}</option>`)
              .join("")}
          </select>
        </div>
      </div>
      <div style="flex: 1;">
        <div class="form-group" style="display: flex; flex-wrap: wrap; gap: 10px;">
          <div style="flex: 1; min-width: 100px;">
            <label><input type="checkbox" id="includeWeapons"> Weapons</label><br>
            <label><input type="checkbox" id="includeArmor"> Armor</label><br>
            <label><input type="checkbox" id="includeAccessories"> Accessories</label><br>
          </div>
          <div style="flex: 1; min-width: 100px;">
            <label><input type="checkbox" id="includeSupplies"> Supplies</label><br>
            <label><input type="checkbox" id="includeIngredients"> Ingredients</label><br>
            <label><input type="checkbox" id="includeMaterials"> Materials</label><br>
          </div>
        </div>
      </div>
    </form>
  `,
  buttons: {
    ok: {
      label: "OK",
      callback: (html) => {
        const budget = parseInt(html.find("#treasureBudget").val());
        const maxVal = parseInt(html.find("#highestPCLevel").val());
        const origin = html.find("#origin").val();
        const nature = html.find("#nature").val();

        const include = {
          weapon: html.find("#includeWeapons").is(":checked"),
          armor: html.find("#includeArmor").is(":checked"),
          accessory: html.find("#includeAccessories").is(":checked"),
          material: html.find("#includeMaterials").is(":checked"),
          ingredient: html.find("#includeIngredients").is(":checked"),
          supplies: html.find("#includeSupplies").is(":checked")
        };

        let remaining = budget;
        let items = [];
        let failed = 0;
        let ingredientsRolled = 0;
        let inventoryPoints = include.supplies ? Math.floor(Math.random() * 4) + 1 : 0;

        const maxTries = 10;

        while (remaining > 0 && items.length < 4 && failed < maxTries) {
          let possible = [];
          if (include.weapon) possible.push("Weapon");
          if (include.armor) possible.push("Armor");
          if (include.accessory) possible.push("Accessory");
          if (include.material) possible.push("Material");
          if (include.ingredient && ingredientsRolled < 3) possible.push("Ingredient");

          if (!possible.length) break;

          const type = getRandom(possible);
          let result = null;

          switch (type) {
            case "Weapon":
              for (let i = 0; i < 5; i++) {
                const weapon = rollWeapon();
                if (weapon && weapon.value <= remaining && weapon.value <= maxVal) {
                  result = weapon;
                  break;
                }
              }
              break;

            case "Armor":
              for (let i = 0; i < 5; i++) {
                const armor = rollArmor();
                if (armor && armor.value <= remaining && armor.value <= maxVal) {
                  result = armor;
                  break;
                }
              }
              break;

            case "Accessory":
              for (let i = 0; i < 5; i++) {
                const accessory = rollAccessory();
                if (accessory && accessory.value <= remaining && accessory.value <= maxVal) {
                  result = accessory;
                  break;
                }
              }
              break;

            case "Material":
              result = rollMaterial(nature, origin, maxVal, remaining);
              break;

            case "Ingredient":
              result = rollIngredient(nature, origin, remaining);
              if (result) ingredientsRolled++;
              break;
          }

          if (!result || result.value > remaining || result.value > maxVal) {
            failed++;
            continue;
          }

          items.push(result);
          remaining -= result.value;
        }

        // 🧾 Output
        let output = items.length === 0
          ? `<strong>No Loot Generated</strong><br>`
          : `<strong>Generated Items:</strong><br><br>`;

        for (const item of items) {
          output += `• <strong>${item.name}</strong> (Value: ${item.value})<br>`;
          if (item.detail) output += `<em>${item.detail}</em><br>`;
          else if (item.taste) output += `<em>${item.taste}</em><br>`;
          else if (item.quality !== "None") output += `<em>Quality: ${item.quality}</em><br>`;
          output += `<br>`;
        }

        if (inventoryPoints > 0) output += `<strong>Recovered Inventory Points:</strong> ${inventoryPoints}<br>`;
        output += `<strong>Remaining Budget:</strong> ${remaining}<br>`;

        ChatMessage.create({
          content: output,
          speaker: { alias: "Treasure Result" }
        });
      }
    }
  },
  default: "ok"
}).render(true);
});
