import { dataLoader } from "./dataLoader.js";
const getOrCreateCacheFolder = dataLoader.getOrCreateCacheFolder;

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
  const base = getRandom(weapons);
  let nameParts = [];
  let value = base.value;

  let quality = "None";
  let hasPlusOne = false;

  // Apply +1 bonus
  if (Math.random() < 0.5) {
    hasPlusOne = true;
    value += 100;
  }

  // Apply element
  if (Math.random() < 0.5) {
    const element = getRandom(elements);
    nameParts.push(element);
    value += 100;
  }

  // Apply quality
  if (Math.random() < 0.5) {
    const q = getRandom(weaponQualities);
    quality = q.name;
    nameParts.push(quality);
    value += q.value;
  }

  // Always add base name last
  nameParts.push(base.name);

  // If +1 was rolled, prefix it
  if (hasPlusOne) {
    nameParts.unshift("+1");
  }

  const name = nameParts.join(" ");

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
    name = `${quality} ${name}`;
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
    name: `${taste} ${originWord} ${natureWord}`,
    value: total,
    taste: `Taste: ${taste}`,
    quantity: quantity,
  };
}

// Helper to render results in a dialog with Keep/Reroll
async function renderTreasureResultDialog(items, budget, inventoryPoints, config) {
  const cacheFolder = await dataLoader.getOrCreateCacheFolder();

  const tempItems = await Promise.all(items.map(async (data) => {
    let type = null;
    let itemData;

    if ("taste" in data) {
      type = "classFeature";
      itemData = {
        name: data.name,
        type,
        img: "icons/svg/acid.svg",
        folder: cacheFolder.id,
        system: {
          subtype: { value: "Ingredient" },
          cost: { value: data.value },
          quantity: { value: data.quantity },
          taste: { value: data.taste },
          summary: { value: "" },
          description: data.taste
        }
      };
    } else if ("detail" in data) {
      type = "treasure";
      itemData = {
        name: data.name,
        type,
        img: "icons/svg/gem.svg",
        folder: cacheFolder.id,
        system: {
          subtype: { value: "Material" },
          cost: { value: data.value },
          quantity: { value: 1 },
          origin: { value: "" },
          summary: { value: "" },
          description: data.detail
        }
      };
    } else if (dataLoader.treasureData.weaponList.some(w => data.name.endsWith(w.name))) {
      type = "weapon";
      const baseWeapon = dataLoader.treasureData.weaponList.find(w => data.name.endsWith(w.name));
      const qualityObj = dataLoader.treasureData.weaponQualities.find(q => q.name === data.quality);
      const description = qualityObj ? qualityObj.description : `A weapon of ${data.quality || "unknown"} quality.`;

      itemData = {
        name: data.name,
        type,
        img: "icons/svg/sword.svg",
        folder: cacheFolder.id,
        system: {
          category: { value: baseWeapon?.category || "" },
          hands: { value: baseWeapon?.hand || "" },
          type: { value: baseWeapon?.type || "" },
          attributes: {
            primary: { value: baseWeapon?.attrA || "" },
            secondary: { value: baseWeapon?.attrB || "" }
          },
          accuracy: { value: baseWeapon?.accuracy ?? 0 },
          defense: { value: baseWeapon?.targets || "" },
          damageType: { value: baseWeapon?.element || "" },
          damage: { value: baseWeapon?.damage ?? 0 },
          isMartial: { value: baseWeapon?.isMartial ?? false },
          quality: { value: data.quality || "No quality" },
          cost: { value: data.value },
          source: { value: "HMBRW" },
          summary: { value: "a randomly generated weapon." },
          description: { value: "a randomly generated weapon." }
        }
      };
    } else if (dataLoader.treasureData.armorList.some(a => data.name.endsWith(a.name))) {
      type = "armor";
      const baseArmor = dataLoader.treasureData.armorList.find(a => data.name.endsWith(a.name));
      const qualityObj = dataLoader.treasureData.armorQualities.find(q => q.name === data.quality);
      const description = qualityObj ? qualityObj.description : `Armor of ${data.quality || "unknown"} quality.`;

      itemData = {
        name: data.name,
        type,
        img: "icons/svg/shield.svg",
        folder: cacheFolder.id,
        system: {
          def: { value: baseArmor?.def ?? 0 },
          mdef: { value: baseArmor?.mdef ?? 0 },
          init: { value: baseArmor?.init ?? 0 },
          defAttr: { value: baseArmor?.defAttr || "" },
          mdefAttr: { value: baseArmor?.mdefAttr || "" },
          isMartial: { value: baseArmor?.isMartial || "no" },
          quality: { value: data.quality || "No quality" },
          cost: { value: data.value },
          summary: { value: "" },
          description
        }
      };
    } else if (dataLoader.treasureData.accessoryNames.some(acc => data.name.includes(acc))) {
      type = "accessory";
      const qualityObj = dataLoader.treasureData.accessoryQualities.find(q => q.name === data.quality);
      const description = qualityObj ? qualityObj.description : `Accessory of ${data.quality || "unknown"} quality.`;

      itemData = {
        name: data.name,
        type,
        img: "icons/svg/mystery-man.svg",
        folder: cacheFolder.id,
        system: {
          quality: { value: data.quality || "No quality" },
          cost: { value: data.value },
          summary: { value: "" },
          description
        }
      };
    }

    if (!type || !itemData) return null;

    const cached = game.items.find(i =>
      i.name === itemData.name &&
      i.type === itemData.type &&
      i.folder?.id === cacheFolder.id &&
      i.system?.cost?.value === itemData.system.cost?.value
    );

    if (cached) return cached;

    return await Item.create(itemData);
  }));

  const finalItems = tempItems.filter(Boolean);

  let htmlContent = finalItems.map(item => {
    const cost = item.system.cost?.value ?? 0;
    const desc = item.system.description || "";
    return `
      <div style="text-align: center; margin-bottom: 0.75em;">
        <img src="${item.img}" width="32" height="32" style="vertical-align: middle; margin-right: 6px;">
        <a class="content-link" draggable="true" data-uuid="${item.uuid}">
          <strong>${item.name}</strong>
        </a><br>
        <small><em>${desc}</em></small><br>
        <small>Value: ${cost} G</small>
      </div>
    `;
  }).join("\n");

  if (inventoryPoints > 0) {
    htmlContent += `<strong>Recovered Inventory Points:</strong> ${inventoryPoints}<br>`;
  }

  htmlContent += `<strong>Remaining Budget:</strong> ${budget}<br>`;

  const enrichedHtml = await TextEditor.enrichHTML(htmlContent, { async: true });

  const dialog = new Dialog({
    title: "Treasure Results",
    content: enrichedHtml,
    buttons: {
      keep: {
        label: "Keep",
        callback: async () => {
          await ChatMessage.create({
            content: enrichedHtml,
            speaker: { alias: "Treasure Result" }
          });
        }
      },
      reroll: {
        label: "Reroll",
        callback: () => Hooks.call("lookfarShowTreasureRollDialog", config)
      }
    }
  });

  dialog.render(true);

  Hooks.once("renderDialog", (_app, html) => {
    html.find("a.content-link").on("click", async function (event) {
      event.preventDefault();
      const uuid = $(this).data("uuid");
      if (!uuid) return;
      const doc = await fromUuid(uuid);
      if (doc?.sheet) doc.sheet.render(true);
    });
  });
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
