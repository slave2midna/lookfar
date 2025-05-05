import { dataLoader } from "./dataLoader.js";
const getOrCreateCacheFolder = dataLoader.getOrCreateCacheFolder;

// Loot Generation Utility
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Material Generation
function rollMaterial(nature, origin, maxVal, budget, detailKeywords, originKeywords, natureKeywords) {
  if (!natureKeywords[nature] || budget < 50) return null;

  const detail = getRandom(Object.keys(detailKeywords));         // e.g. "Power"
  const detailWord = getRandom(detailKeywords[detail]);          // e.g. "Serrated"
  const originWord = getRandom(originKeywords[origin]);          // e.g. "Wind"
  const natureWord = getRandom(natureKeywords[nature]);          // e.g. "Plate"
  const name = `${detailWord} ${originWord} ${natureWord}`;      // → "Serrated Wind Plate"

  let value = Math.floor(Math.random() * (maxVal / 50)) * 50;
  value = Math.max(50, Math.min(value, budget));

  if (value > budget) return null;

  return {
    name,
    value,
    detail,
    nature,
    origin
  };
}

// Ingredient Generation
function rollIngredient(nature, origin, budget, tasteKeywords, natureKeywords, originKeywords) {
  if (!natureKeywords[nature] || budget < 10) return null;

  const taste = getRandom(Object.keys(tasteKeywords));              // e.g. "Sour"
  const tasteWord = getRandom(tasteKeywords[taste]);                // e.g. "Tart"
  const originWord = getRandom(originKeywords[origin]);             // e.g. "Wind"
  const natureWord = getRandom(natureKeywords[nature]);             // e.g. "Petal"
  const name = `${tasteWord} ${originWord} ${natureWord}`;          // → "Tart Wind Petal"

  const quantity = Math.floor(Math.random() * 3) + 1;
  const unitValue = (taste === "Distinct") ? 20 : 10;
  const total = unitValue * quantity;

  if (total > budget) return null;

  return {
    name,
    value: total,
    taste,
    quantity,
    origin,
    nature
  };
}

// Weapon Generation
function rollWeapon(weapons, weaponQualities, elements) {
  let base, quality = "None", hasPlusOne = false, appliedElement = null;
  let nameParts = [];
  let value = 0;

  do {
    base = getRandom(weapons);
    nameParts = [];
    value = base.value;

    hasPlusOne = Math.random() < 0.5;
    appliedElement = Math.random() < 0.5 ? getRandom(elements) : null;
    const q = Math.random() < 0.5 ? getRandom(weaponQualities) : null;
    quality = q?.name ?? "None";

    if (hasPlusOne) {
      nameParts.push("+1");
      value += 100;
    }

    if (quality !== "None") {
      nameParts.push(quality);
      value += q.value;
    }

    if (appliedElement) {
      nameParts.push(appliedElement.name);
      value += 100;
    }

  } while (!hasPlusOne && quality === "None" && !appliedElement);  // reroll if no upgrades

  // Add base name last
  nameParts.push(base.name);
  const name = nameParts.join(" ");

  return { name, value, quality, element: appliedElement, hasPlusOne };
}

// Armor Generation
function rollArmor(armor, armorQualities) {
  const base = getRandom(armor);
  let nameParts = [];
  let value = base.value;
  let quality = "None";

  const q = getRandom(armorQualities);
  quality = q.name;
  nameParts.push(quality);
  value += q.value;

  nameParts.push(base.name);
  const name = nameParts.join(" ");

  return {
    name,
    value,
    quality
  };
}

// Accessory Generation
function rollAccessory(accessories, accessoryQualities) {
  const base = getRandom(accessories);
  let nameParts = [];
  let value = base.value ?? 0;
  let quality = "None";

  
  const q = getRandom(accessoryQualities);
  quality = q.name;
  nameParts.push(quality);
  value += q.value;

  nameParts.push(base.name);
  const name = nameParts.join(" ");

  return {
    name,
    value,
    quality
  };
}

// Results render function
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
          data: {
            cost: data.value ?? null,
            quantity: data.quantity ?? 1,
            taste: data.taste,
            description: `An ingredient with a ${data.taste} taste.`
          },
          featureType: "projectfu.ingredient",
          summary: { value: "An ingredient with a ${data.taste} taste." },
          source: "LOOKFAR"
        }
      };
    } else if ("detail" in data) {
      type = "treasure";

      // Load material icon from icon manifest based on nature keyword
      const materialKey = data.nature?.toLowerCase();
      const materialIcons = dataLoader.iconManifest?.[materialKey];
      const filteredIcons = materialIcons?.filter(i => i.toLowerCase().includes(data.nature.toLowerCase()));
      const img = filteredIcons?.length ? getRandom(filteredIcons) : "icons/svg/gem.svg";
      
      itemData = {
        name: data.name,
        type: "treasure",
        img,
        folder: cacheFolder.id,
        system: {
          subtype: { value: "material" },
          cost: { value: data.value },
          quantity: { value: 1 },
          origin: { value: data.origin },
          source: { value: "LOOKFAR" },
          summary: { value: `${data.detail}` },
          description: `A(n) <b>${data.nature.toLowerCase()}</b> material of a(n) <b>${data.origin.toLowerCase()}</b> origin.<br>` + 
            `It can be used to craft <b>${data.detail.toLowerCase()}</b> items.`
        }
      };
    } else if (dataLoader.treasureData.weaponList.some(w => data.name.endsWith(w.name))) {
      type = "weapon";
      const baseWeapon = dataLoader.treasureData.weaponList.find(w => data.name.endsWith(w.name));
      const qualityObj = dataLoader.treasureData.weaponQualities.find(q => q.name === data.quality);
      const description = qualityObj ? qualityObj.description : `A weapon of ${data.quality || "unknown"} quality.`;

      // Normalizes base weapon name for icon manifest to pull icons
      const weaponKey = baseWeapon.name.toLowerCase().replace(/\s+/g, '');
      const iconList = dataLoader.iconManifest?.[weaponKey];
      const img = iconList ? iconList[Math.floor(Math.random() * iconList.length)] : "icons/svg/sword.svg";

      itemData = {
        name: data.name,
        type,
        img,
        folder: cacheFolder.id,
        system: {
          category: { value: baseWeapon?.category || "" },
          hands: { value: baseWeapon?.hand || "" },
          type: { value: baseWeapon?.type || "" },
          attributes: {
            primary: { value: baseWeapon?.attrA || "" },
            secondary: { value: baseWeapon?.attrB || "" }
          },
          accuracy: { value: (baseWeapon?.accuracy ?? 0) + (data.hasPlusOne ? 1 : 0) },
          defense: baseWeapon?.defense || "",
          damageType: { value: data.element?.damageType || baseWeapon?.element || "physical" },
          damage: { value: baseWeapon?.damage ?? 0 },
          isMartial: { value: baseWeapon?.isMartial ?? false },
          quality: { value: qualityObj?.description || "No quality" },
          cost: { value: data.value },
          source: { value: "LOOKFAR" },
          summary: `A ${baseWeapon?.hand || "unknown"} ${baseWeapon?.type || "unknown"} ${baseWeapon?.category || "unknown"} weapon that ${qualityObj?.description || "has no special properties."}`,
          description: `A ${baseWeapon?.hand || "unknown"} ${baseWeapon?.type || "unknown"} ${baseWeapon?.category || "unknown"} weapon that ${qualityObj?.description || "has no special properties."}<br>` + 
            `<b>ACC:</b> +${(baseWeapon?.accuracy ?? 0) + (data.hasPlusOne ? 1 : 0)} <strong>|</strong> <b>DMG:</b> HR+${baseWeapon?.damage ?? 0} <strong>|</strong> <b>Type:</b> ${(data.element?.damageType || baseWeapon?.element || "physical").charAt(0).toUpperCase()}${(data.element?.damageType || baseWeapon?.element || "physical").slice(1)}`
        }
      };
    } else if (dataLoader.treasureData.armorList.some(a => data.name.endsWith(a.name))) {
      type = "armor";
      const baseArmor = dataLoader.treasureData.armorList.find(a => data.name.endsWith(a.name));
      const qualityObj = dataLoader.treasureData.armorQualities.find(q => q.name === data.quality);
      const description = qualityObj ? qualityObj.description : `Armor of ${data.quality || "unknown"} quality.`;

      // Use "martial" or "nonmartial" icons based on isMartial string
      const armorKey = baseArmor?.isMartial === "true" ? "martial" : "nonmartial";
      const iconList = dataLoader.iconManifest?.[armorKey];
      const img = iconList ? iconList[Math.floor(Math.random() * iconList.length)] : "icons/svg/shield.svg";
      
      itemData = {
        name: data.name,
        type,
        img,
        folder: cacheFolder.id,
        system: {
          def: { attribute: baseArmor?.defAttr || "dex", value: baseArmor?.def ?? 0 },
          mdef: { attribute: baseArmor?.mdefAttr || "ins", value: baseArmor?.mdef ?? 0 },
          init: { value: baseArmor?.init ?? 0 },
          isMartial: { value: baseArmor?.isMartial ?? false },
          quality: { value: qualityObj?.description || "No quality" },
          cost: { value: data.value },
          source: { value: "LOOKFAR" },
          summary: { value: " a randomly generated armor." },
          description: `A full set of armor that ${qualityObj?.description || "has no special properties."}<br>` +
            `<b>DEF:</b> ${baseArmor?.def ?? 0} <strong>|</strong> <b>MDEF:</b> ${baseArmor?.mdef ?? 0} | <b>INIT:</b> ${baseArmor?.init ?? 0}`
        }
      };
    } else if (dataLoader.treasureData.accessoryList.some(acc => data.name.endsWith(acc.name))) {
      type = "accessory";
      const baseAccessory = dataLoader.treasureData.accessoryList.find(acc => data.name.endsWith(acc.name));
      const qualityObj = dataLoader.treasureData.accessoryQualities.find(q => q.name === data.quality);
      const description = qualityObj ? qualityObj.description : `Accessory of ${data.quality || "unknown"} quality.`;

      // Normalizes base accessory name for icon manifest to pull icons
      const baseNameKey = baseAccessory.name.toLowerCase().replace(/\s+/g, '');
      const iconList = dataLoader.iconManifest?.[baseNameKey];
      const img = iconList ? iconList[Math.floor(Math.random() * iconList.length)] : "icons/svg/item-bag.svg";

      itemData = {
        name: data.name,
        type,
        img,
        folder: cacheFolder.id,
        system: {
          def: { value: baseAccessory?.def ?? 0 },
          mdef: { value: baseAccessory?.mdef ?? 0 },
          init: { value: baseAccessory?.init ?? 0 },
          quality: { value: qualityObj?.description || "No quality" },
          cost: { value: data.value },
          source: { value: "LOOKFAR" },
          summary: `A ${baseAccessory.name.toLowerCase()} that ${qualityObj?.description || "has no special properties."}`,
          description: `A ${baseAccessory.name.toLowerCase()} that ${qualityObj?.description || "has no special properties."}`
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
        <small>${desc}</small><br>
        <small>Value: ${cost} z</small>
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
      natureKeywords,
      originKeywords,
      detailKeywords,
      tasteKeywords,
      weaponList,
      weaponQualities,
      weaponElements,
      armorList,
      armorQualities,
      accessoryList,
      accessoryQualities
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
            item = rollAccessory(accessoryList, accessoryQualities);
            break;
          case "Material":
            item = rollMaterial(nature, origin, maxVal, remainingBudget, detailKeywords, originKeywords, natureKeywords);
            break;
          case "Ingredient":
            item = rollIngredient(nature, origin, remainingBudget, tasteKeywords, natureKeywords, originKeywords);
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
        <form style="display: flex; width: 100%; flex-wrap: nowrap; gap: 5px;">
            <!-- Column 1: Form Inputs -->
          <div style="width: 180px;">
            <div class="form-group" style="display: flex; align-items: center; margin-bottom: 0.5em;">
              <label for="treasureBudget" style="width: 70px;">Budget:</label>
              <input type="number" id="treasureBudget" value="1" min="1" style="width: 110px; box-sizing: border-box;" />
            </div>

  <div class="form-group" style="display: flex; align-items: center; margin-bottom: 0.5em;">
    <label for="highestPCLevel" style="width: 70px;">Level:</label>
    <select id="highestPCLevel" style="width: 110px; box-sizing: border-box;">
      <option value="500">5+</option>
      <option value="1000">10+</option>
      <option value="1500">20+</option>
      <option value="2000">30+</option>
      <option value="999999">40+</option>
    </select>
  </div>

  <div class="form-group" style="display: flex; align-items: center; margin-bottom: 0.5em;">
    <label for="origin" style="width: 70px;">Origin:</label>
    <select id="origin" style="width: 110px; box-sizing: border-box;">
      ${Object.keys(originKeywords).map(o => `<option value="${o}">${o}</option>`).join("")}
    </select>
  </div>

  <div class="form-group" style="display: flex; align-items: center; margin-bottom: 0.5em;">
    <label for="nature" style="width: 70px;">Nature:</label>
    <select id="nature" style="width: 110px; box-sizing: border-box;">
      ${Object.keys(natureKeywords).map(n => `<option value="${n}">${n}</option>`).join("")}
    </select>
  </div>
</div>

            <!-- Column 2: Checkboxes A -->
            <div style="width: 115px;" class="checkbox-group">
              <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;"><input type="checkbox" id="includeWeapons"> Weapons</label>
              <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;"><input type="checkbox" id="includeArmor"> Armor</label>
              <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;"><input type="checkbox" id="includeAccessories"> Accessories</label>
              <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;"><input type="checkbox" id="includeModules"> Modules</label>
            </div>

            <!-- Column 3: Checkboxes B -->
            <div style="width: 115px;" class="checkbox-group">
              <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;"><input type="checkbox" id="includeIngredients"> Ingredients</label>
              <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;"><input type="checkbox" id="includeMaterials"> Materials</label>
              <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;"><input type="checkbox" id="includeSupplies"> Supplies</label>
              <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;"><input type="checkbox" id="includeTreasure"> Treasure</label>
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
