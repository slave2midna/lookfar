import { dataLoader } from "./dataLoader.js";
import { cacheManager } from "./cacheManager.js";

// Random Generation Utility
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Normalize cost across different schemas
function getItemCost(sys) {
  return sys?.cost?.value ??
         sys?.data?.cost ??
         sys?.data?.cost?.value ??
         sys?.data?.value ??
         0;
}

// Material Generation
function rollMaterial(nature, origin, maxVal, budget, detailKeywords, originKeywordsMaterial, natureKeywordsMaterial) {
  // Resolve Random here, against the material subsets you already pass in
  const effNature = (nature === "Random")
    ? getRandom(Object.keys(natureKeywordsMaterial || {}))
    : nature;

  const effOrigin = (origin === "Random")
    ? getRandom(Object.keys(originKeywordsMaterial || {}))
    : origin;

  if (!natureKeywordsMaterial[effNature] || budget < 50) return null;

  const detail = getRandom(Object.keys(detailKeywords));           // e.g. "Power"
  const detailWord = getRandom(detailKeywords[detail]);            // e.g. "Serrated"
  const originWord = getRandom(originKeywordsMaterial[effOrigin]); // e.g. "Molten"
  const natureWord = getRandom(natureKeywordsMaterial[effNature]); // e.g. "Shell"
  const name = `${detailWord} ${originWord} ${natureWord}`;

  let value = Math.floor(Math.random() * (maxVal / 50)) * 50;
  value = Math.max(50, Math.min(value, budget));
  if (value > budget) return null;

  return {
    name,
    value,
    detail,
    nature: effNature,
    origin: effOrigin
  };
}

// Ingredient Generation
function rollIngredient(nature, origin, budget, tasteKeywords, natureKeywordsIngredient, originKeywordsIngredient) {
  // Resolve Random here, against the ingredient subsets you already pass in
  const effNature = (nature === "Random")
    ? getRandom(Object.keys(natureKeywordsIngredient || {}))
    : nature;

  const effOrigin = (origin === "Random")
    ? getRandom(Object.keys(originKeywordsIngredient || {}))
    : origin;

  if (!natureKeywordsIngredient[effNature] || budget < 10) return null;

  const taste = getRandom(Object.keys(tasteKeywords));                 // e.g. "Sour"
  const tasteWord = getRandom(tasteKeywords[taste]);                   // e.g. "Tart"
  const originWord = getRandom(originKeywordsIngredient[effOrigin]);   // e.g. "Watery"
  const natureWord = getRandom(natureKeywordsIngredient[effNature]);   // e.g. "Petal"
  const name = `${tasteWord} ${originWord} ${natureWord}`;

  const quantity = Math.floor(Math.random() * 3) + 1;
  const unitValue = (taste === "Distinct") ? 20 : 10;
  const total = unitValue * quantity;
  if (total > budget) return null;

  return {
    name,
    value: total,
    taste,
    quantity,
    nature: effNature,
    origin: effOrigin
  };
}

// Weapon Generation
function rollWeapon(weapons, weaponQualities, elements, origin, useVariantDamageRules = false) {
  let base, quality = "None", hasPlusOne = false, appliedElement = null, isMaster = false;
  let nameParts = [];
  let value = 0;

  // Build the combined list of qualities
  const baseQualities = weaponQualities.basic || [];
  const originQualities = weaponQualities[origin] || [];
  const availableQualities = baseQualities.concat(originQualities);

  do {
    base = getRandom(weapons);
    nameParts = [];
    value = base.value;

    hasPlusOne = Math.random() < 0.5;
    appliedElement = Math.random() < 0.5 ? getRandom(elements) : null;
    isMaster = useVariantDamageRules ? false : (Math.random() < 0.5); // When variant damage is enabled, Master is disabled entirely
    const q = Math.random() < 0.5 ? getRandom(availableQualities) : null;
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

	if (isMaster && !useVariantDamageRules) {
      nameParts.push("Master");
      value += 200;
    }  

  } while (!hasPlusOne && quality === "None" && !appliedElement && !(isMaster && !useVariantDamageRules));  // ensure at least one feature

  nameParts.push(base.name);
  const name = nameParts.join(" ");

  return { 
	name, 
	value, 
	quality, 
	element: appliedElement, 
	hasPlusOne,
	isMaster,  
    origin
  };
}

// Armor Generation
function rollArmor(armorList, armorQualities, origin, cap) {
  const base = getRandom(armorList);
  let nameParts = [];
  let value = base.value ?? 0;
  let quality = "None";

  // Combine basic qualities with origin-specific qualities
  const qualityPool = [
    ...(armorQualities.basic || []),
    ...(armorQualities[origin] || [])
  ];

  // Pick an affordable quality from the combined pool
  const affordable = qualityPool.filter(q => (value + (q.value ?? 0)) <= cap);
	if (!affordable.length) return null;
	const q = getRandom(affordable);
	quality = q.name;
	nameParts.push(quality);
	value += q.value ?? 0;

  // Name armor
  nameParts.push(base.name);
  const name = nameParts.join(" ");

  return {
    name,
    value,
    quality,
	origin
  };
}

// Shield Generation
function rollShield(shieldList, shieldQualities, origin, cap) {
  const base = getRandom(shieldList);
  let nameParts = [];
  let value = base.value ?? 0;
  let quality = "None";

  // Combine basic qualities with origin-specific qualities
  const qualityPool = [
    ...(shieldQualities.basic || []),
    ...(shieldQualities[origin] || [])
  ];

  // Pick an affordable quality from the combined pool
  const affordable = qualityPool.filter(q => (value + (q.value ?? 0)) <= cap);
	if (!affordable.length) return null;
	const q = getRandom(affordable);
	quality = q.name;
	nameParts.push(quality);
	value += q.value ?? 0;

  // Name shield
  nameParts.push(base.name);
  const name = nameParts.join(" ");

  return {
    name,
    value,
    quality,
    origin
  };
}

// Accessory Generation
function rollAccessory(accessories, accessoryQualities, origin, cap) {
  const base = getRandom(accessories);
  let nameParts = [];
  let value = base.value ?? 0;
  let quality = "None";

  // Combine basic qualities with origin-specific qualities
  const qualityPool = [
    ...(accessoryQualities.basic || []),
    ...(accessoryQualities[origin] || [])
  ];

  // Pick an affordable quality from the combined pool
  const affordable = qualityPool.filter(q => (value + (q.value ?? 0)) <= cap);
	if (!affordable.length) return null;
	const q = getRandom(affordable);
	quality = q.name;
	nameParts.push(quality);
	value += q.value ?? 0;

  // Name accessory
  nameParts.push(base.name);
  const name = nameParts.join(" ");

  return {
    name,
    value,
    quality,
	origin
  };
}

// Custom Treasure Generation
async function rollCustom() {
  const tableId = game.settings.get("lookfar", "customTreasureRollTable");
  if (!tableId || tableId === "default") {
    ui.notifications?.warn("No Custom Treasure Roll Table selected in settings.");
    return null;
  }

  const table = game.tables?.get(tableId);
  if (!table) {
    ui.notifications?.warn("Selected Custom Treasure Roll Table not found.");
    return null;
  }

  const draw = await table.draw({ displayChat: false });
  const result = draw?.results?.[0];
  if (!result) return null;

  let doc = null;

  // If the result exposes a UUID, resolve that first (covers compendium & world)
  const directUuid = result.documentUuid || result.uuid;
  if (!doc && directUuid) {
    try { doc = await fromUuid(directUuid); } catch {}
  }

  // Foundry’s helper (often resolves both world & compendium)
  if (!doc && typeof result.getDocument === "function") {
    try { doc = await result.getDocument(); } catch {}
  }

  // Explicit compendium fallback
  if (!doc && result.pack && result.documentId) {
    const pack = game.packs?.get(result.pack) || game.packs?.get(`world.${result.pack}`);
    if (pack) {
      try { doc = await pack.getDocument(result.documentId); } catch {}
    }
    if (!doc) {
      const compUuid = `Compendium.${result.pack}.${result.documentId}`;
      try { doc = await fromUuid(compUuid); } catch {}
    }
  }

  // World fallback (non-compendium)
  if (!doc && result.documentCollection && result.documentId) {
    try { doc = await fromUuid(`${result.documentCollection}.${result.documentId}`); } catch {}
  }

  if (!doc || doc.documentName !== "Item") return null;

  const cost = getItemCost(doc.system);
  return {
    fromTable: true,
    name: doc.name,
    value: cost,
    uuid: doc.uuid
  };
}

async function createStash(items, cacheFolder) {

  const allStashes = game.actors.filter(a => a.type === "stash");
  const re = /^New Stash #(\d+)$/i;
  let nextNum = 1;
  for (const a of allStashes) {
    const m = re.exec(a.name);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n >= nextNum) nextNum = n + 1;
    }
  }
  const stashName = `New Stash #${nextNum}`;

  const stash = await CONFIG.Actor.documentClass.create({
    name: stashName,
    type: "stash",
    img: "icons/svg/item-bag.svg"
  });

  const embedded = items.map(i => {
    const data = i.toObject();
    delete data._id;
    delete data.folder;
    return data;
  });

  await stash.createEmbeddedDocuments("Item", embedded);

  const deletions = items
    .filter(i => i?.folder?.id === cacheFolder.id)
    .map(i => i.delete());
  if (deletions.length) await Promise.allSettled(deletions);

  stash.sheet?.render(true);
  await ChatMessage.create({
    content: `Created ${embedded.length} item(s) in <a class="content-link" data-uuid="${stash.uuid}"><i class="fas fa-box-archive"></i> <strong>${stash.name}</strong></a>.`,
    speaker: ChatMessage.getSpeaker({ alias: "Treasure Result" })
  });

  return stash;
}

// Results render function
async function renderTreasureResultDialog(items, budget, config) {
  const cacheFolder = await cacheManager.getOrCreateCacheFolder();

  const tempItems = await Promise.all(items.map(async (data) => {
    let type = null;
    let itemData;

 // Handle items drawn from a Roll Table (Custom)
  if (data.fromTable && data.uuid) {
    const src = await fromUuid(data.uuid);
    if (!src || src.documentName !== "Item") return null;

    // Deduplicate in cache by name + cost
    const existing = game.items.find(i =>
      i.folder?.id === cacheFolder.id &&
      i.name === src.name &&
      getItemCost(i.system) === getItemCost(src.system)
    );
    if (existing) return existing;

    const toCreate = foundry.utils.duplicate(src.toObject());
    delete toCreate._id;
    toCreate.folder = cacheFolder.id;
    return await Item.create(toCreate);
  }	  

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
            taste: data.taste || "",
            description: `An ingredient that tastes <b>${data.taste}</b>.`
          },
          featureType: "projectfu.ingredient",
          summary: { value: `An ingredient that tastes ${data.taste}.` },
          source: "LOOKFAR"
        }
      };
	} else if ("detail" in data) {
      type = "treasure";
      const img = "icons/svg/item-bag.svg";
      
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
          summary: { value: `${data.nature} material of ${data.origin.toLowerCase()} origin.` },
          description: `<b>${data.nature}</b> material of <b>${data.origin.toLowerCase()}</b> origin.<br>` + 
            `It can be used to craft <b>${data.detail}</b> items.`
        }
      };
    } else if (dataLoader.weaponsData.weaponList.some(w => data.name.endsWith(w.name))) {
  type = "weapon";
  const baseWeapon = dataLoader.weaponsData.weaponList.find(w => data.name.endsWith(w.name));
  const allQualities = [
    ...(dataLoader.weaponsData.weaponQualities.basic || []),
    ...(dataLoader.weaponsData.weaponQualities[data.origin] || [])
  ];
  const qualityObj = allQualities.find(q => q.name === data.quality);
  const img = "icons/svg/sword.svg";

  // Handle variant damage
  const variantEnabled = game.settings.get("lookfar", "useVariantDamageRules");
  const variantBonus   = variantEnabled ? (2 * Math.floor((data.value || 0) / 1000)) : 0;

  // Core description prefix — special if Master
  const prefix = (data.isMaster && !variantEnabled)
    ? `A masterwork ${baseWeapon?.hand || "unknown"} ${baseWeapon?.type || "unknown"} ${baseWeapon?.category || "unknown"} weapon`
    : `A ${baseWeapon?.hand || "unknown"} ${baseWeapon?.type || "unknown"} ${baseWeapon?.category || "unknown"} weapon`;

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
      damage: { value: (baseWeapon?.damage ?? 0) + (variantEnabled ? variantBonus : (data.isMaster ? 4 : 0)) },
      isMartial: { value: baseWeapon?.isMartial ?? false },
      quality: { value: qualityObj?.description || "No quality" },
      cost: { value: data.value },
      source: { value: "LOOKFAR" },
      summary: {
        value: `${prefix} that ${qualityObj?.description || "has no special properties."}`
      },
      description:
        `${prefix} that ${qualityObj?.description || "has no special properties."}<br>` +
        `<b>ACC:</b> +${(baseWeapon?.accuracy ?? 0) + (data.hasPlusOne ? 1 : 0)} <strong>|</strong> ` +
        `<b>DMG:</b> HR+${(baseWeapon?.damage ?? 0) + (variantEnabled ? variantBonus : (data.isMaster ? 4 : 0))} <strong>|</strong> ` +
        `<b>ELE:</b> ${(data.element?.damageType || baseWeapon?.element || "physical")
          .charAt(0)
          .toUpperCase()}${(data.element?.damageType || baseWeapon?.element || "physical").slice(1)}`
    }
  };
} else if (dataLoader.armorData.armorList.some(a => data.name.endsWith(a.name))) {
      type = "armor";
      const baseArmor = dataLoader.armorData.armorList.find(a => data.name.endsWith(a.name));
      const allQualities = [
  		...(dataLoader.armorData.armorQualities.basic || []),
  		...(dataLoader.armorData.armorQualities[data.origin] || [])
      ];
      const qualityObj = allQualities.find(q => q.name === data.quality);
      const img = "icons/svg/statue.svg";
      
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
          summary: { value: `A full set of armor that ${qualityObj?.description || "has no special properties."}` },
          description: `A full set of armor that ${qualityObj?.description || "has no special properties."}<br>` +
            `<b>DEF:</b> ${baseArmor?.def ?? 0} <strong>|</strong> <b>MDEF:</b> ${baseArmor?.mdef ?? 0} <strong>|</strong> <b>INIT:</b> ${baseArmor?.init ?? 0}`
        }
      };
	} else if (dataLoader.shieldsData.shieldList.some(s => data.name.endsWith(s.name))) {
	  type = "shield";
      const baseShield = dataLoader.shieldsData.shieldList.find(s => data.name.endsWith(s.name));
      const allQualities = [
    	...(dataLoader.shieldsData.shieldQualities.basic || []),
    	...(dataLoader.shieldsData.shieldQualities[data.origin] || [])
  	  ];
      const qualityObj = allQualities.find(q => q.name === data.quality);
      const img = "icons/svg/shield.svg";
 
      itemData = {
        name: data.name,
        type,
        img,
        folder: cacheFolder.id,
        system: {
          def:  { attribute: baseShield?.defAttr  || "dex", value: baseShield?.def  ?? 0 },
          mdef: { attribute: baseShield?.mdefAttr || "ins", value: baseShield?.mdef ?? 0 },
          init: { value: baseShield?.init ?? 0 },
          isMartial: { value: baseShield?.isMartial ?? false },
          quality: { value: qualityObj?.description || "No quality" },
          cost: { value: data.value },
          source: { value: "LOOKFAR" },
          summary: { value: `A shield that ${qualityObj?.description || "has no special properties."}` },
          description: `A shield that ${qualityObj?.description || "has no special properties."}<br>` +
        	`<b>DEF:</b> ${baseShield?.def ?? 0} <strong>|</strong> <b>MDEF:</b> ${baseShield?.mdef ?? 0} <strong>|</strong> <b>INIT:</b> ${baseShield?.init ?? 0}`
    	}
      };
    } else if (dataLoader.accessoriesData.accessoryList.some(acc => data.name.endsWith(acc.name))) {
      type = "accessory";
      const baseAccessory = dataLoader.accessoriesData.accessoryList.find(acc => data.name.endsWith(acc.name));
      const allQualities = [
  		...(dataLoader.accessoriesData.accessoryQualities.basic || []),
  		...(dataLoader.accessoriesData.accessoryQualities[data.origin] || [])
      ];
      const qualityObj = allQualities.find(q => q.name === data.quality);
      const img = "icons/svg/stoned.svg";

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
          summary: { value: `A ${baseAccessory.name.toLowerCase()} that ${qualityObj?.description || "has no special properties."}` },
          description: `A ${baseAccessory.name.toLowerCase()} that ${qualityObj?.description || "has no special properties."}`
        }
      };
    }

    if (!type || !itemData) return null;

    const cached = game.items.find(i =>
  	  i.name === itemData.name &&
  	  i.type === itemData.type &&
  	  i.folder?.id === cacheFolder.id &&
  	  getItemCost(i.system) === getItemCost(itemData.system)
	);

    if (cached) return cached;

    return await Item.create(itemData);
  }));

  const finalItems = tempItems.filter(Boolean);

  // Build compact, one-line cards (no leading/trailing whitespace)
  let htmlContent = finalItems.map(item => {
  const cost = getItemCost(item.system);

  // Detect ingredient (classFeature with projectfu.ingredient type)
  const isIngredient = item.type === "classFeature" && item.system.featureType === "projectfu.ingredient";

  // Correct quantity lookup:
  // - Ingredients store it at system.data.quantity (a number)
  // - Other items might store it at system.quantity.value
  const quantity = isIngredient
    ? (item.system?.data?.quantity ?? 1)
    : (item.system?.quantity?.value ?? 1);

  // Only show “x#” if ingredient and more than 1
  const quantitySuffix = isIngredient && quantity > 1 ? ` x ${quantity}` : "";

  const desc =
    item.system?.summary?.value ??
    item.system?.summary ??
    item.system?.data?.summary?.value ??
    item.system?.data?.summary ??
    "";

  // IMPORTANT: single-line string, no leading/trailing \n or spaces
  return `<div style="text-align:center;margin-bottom:0.75em"><img src="${item.img}" width="32" height="32" style="display:block;margin:0 auto 6px"><a class="content-link" data-uuid="${item.uuid}"><strong>${item.name}${quantitySuffix}</strong></a><br><small>${desc}</small><br><small>Value: ${cost} z</small></div>`;
  }).join("");  // join with empty string — no newlines between items

  // Also single-line for the footer
  htmlContent += `<div><strong>Remaining Budget:</strong> ${budget}</div>`;

  // Enrich for the dialog only (unchanged)
  const enrichedHtml = await TextEditor.enrichHTML(htmlContent, { async: true });

  const dialog = new Dialog({
    title: "Treasure Results",
    content: enrichedHtml,
    buttons: {
      keep: {
  		label: "Keep",
  		callback: async () => {
    	  // Move items out of cache so they are “final”
    	  for (const item of finalItems) {
      	  if (item?.folder?.id === cacheFolder.id) {
        	await item.update({ folder: null });
      	  }
    	}

    	// Post the dialog’s exact HTML to chat (no stripping, no markdown munging)
    	await ChatMessage.create({
      	  content: enrichedHtml,
      	  speaker: ChatMessage.getSpeaker({ alias: "Treasure Result" })
    	});
  	   }
	 },
    stash: {
      label: "Stash",
      callback: async () => {
        await createStash(finalItems, cacheFolder);
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
  (async () => {
    // keywords 
    const { origin: originKeywords, nature: natureKeywords, detail: detailKeywords, taste: tasteKeywords } = dataLoader.keywordData;

    // gear lists & qualities
    const { weaponList, weaponQualities } = dataLoader.weaponsData; 
    const { armorList, armorQualities } = dataLoader.armorData;
    const { shieldList, shieldQualities } = dataLoader.shieldsData;
    const { accessoryList, accessoryQualities } = dataLoader.accessoriesData;

    // builds weapon element using element keywords
    const elementKeywords = dataLoader.keywordData.element || {};
    const weaponElements = Object.entries(elementKeywords)
      .flatMap(([damageType, names]) => names.map(name => ({ name, damageType })));

    if (rerollConfig) {
      const {
        budget, 
		maxVal, 
		origin, 
		nature,
        includeWeapons, 
		includeArmor, 
		includeShields,
        includeAccessories, 
		includeIngredients, 
		includeMaterials, 
        includeCustom
      } = rerollConfig;

      let remainingBudget = budget;
      let items = [];
      let ingredientCount = 0;
      let failedAttempts = 0;
      const maxAttempts = 10; // const (tiny cleanup)

      while (remainingBudget > 0 && items.length < 4 && failedAttempts < maxAttempts) {
        let itemTypes = [];
        if (includeWeapons) itemTypes.push("Weapon");
        if (includeArmor) itemTypes.push("Armor");
        if (includeShields) itemTypes.push("Shield");
        if (includeAccessories) itemTypes.push("Accessory");
        if (includeIngredients && ingredientCount < 3) itemTypes.push("Ingredient");
        if (includeMaterials) itemTypes.push("Material"); 
        if (includeCustom) itemTypes.push("Custom");
		

        if (itemTypes.length === 0) break;

        const type = getRandom(itemTypes);
        let item = null;
        const cap = Math.min(remainingBudget, maxVal);

        switch (type) {
          case "Weapon":     item = rollWeapon(weaponList, weaponQualities, weaponElements, origin, game.settings.get("lookfar", "useVariantDamageRules")); break;
          case "Armor":      item = rollArmor(armorList, armorQualities, origin, cap); break;
          case "Shield":     item = rollShield(shieldList, shieldQualities, origin, cap); break;
          case "Accessory":  item = rollAccessory(accessoryList, accessoryQualities, origin, cap); break;	
          case "Material":   item = rollMaterial(nature, origin, maxVal, remainingBudget, detailKeywords, originKeywords.material, natureKeywords.material); break;
          case "Ingredient": item = rollIngredient(nature, origin, remainingBudget, tasteKeywords, natureKeywords.ingredient, originKeywords.ingredient); ingredientCount++; break;
          case "Custom":     item = await rollCustom(); break;
        }

        if (!item || item.value > remainingBudget || item.value > maxVal) {
          failedAttempts++;
          continue;
        }

        items.push(item);
        remainingBudget -= item.value;
      }

      if (items.length === 0) {
        ui.notifications.warn("No loot generated.");
        return;
      }

      renderTreasureResultDialog(items, remainingBudget, rerollConfig);
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
		                <input type="number" id="treasureBudget" value="1" min="1" style="width: 110px; box-sizing: border-box;" /> </div>
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
    					  <option value="Random" selected>Random</option>
    					  <option value="Aerial">Aerial</option>
    					  <option value="Thunderous">Thunderous</option>
    					  <option value="Paradox">Paradox</option>
    					  <option value="Terrestrial">Terrestrial</option>
    					  <option value="Ardent">Ardent</option>
    					  <option value="Glacial">Glacial</option>
    					  <option value="Spiritual">Spiritual</option>
    					  <option value="Corrupted">Corrupted</option>
    					  <option value="Aquatic">Aquatic</option>
    					  <option value="Mechanical">Mechanical</option>
  				</select>
			</div>
	              <div class="form-group" style="display: flex; align-items: center; margin-bottom: 0.5em;">
  				<label for="nature" style="width: 70px;">Nature:</label>
  				<select id="nature" style="width: 110px; box-sizing: border-box;">
    					  <option value="Random" selected>Random</option>
    					  <option value="Anthropod">Anthropod</option>
    					  <option value="Bird">Bird</option>
    					  <option value="Fish">Fish</option>
    					  <option value="Mammal">Mammal</option>
    					  <option value="Mollusk">Mollusk</option>
    					  <option value="Reptile">Reptile</option>
    					  <option value="Fungus">Fungus</option>
    					  <option value="Incorporeal">Incorporeal</option>
    					  <option value="Liquid">Liquid</option>
    					  <option value="Artificial">Artificial</option>
    					  <option value="Mineral">Mineral</option>
  				</select>
			</div>
            </div>
	
          	<!-- Column 2: Checkboxes A -->
          	<div style="width: 115px;" class="checkbox-group">
          		  <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;">
	          		    <input type="checkbox" id="includeWeapons"> Weapons </label>
	          	  <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;">
		          	    <input type="checkbox" id="includeArmor"> Armor </label>
		            <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;">
			              <input type="checkbox" id="includeAccessories"> Accessories </label>
		          <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;">
			            <input type="checkbox" id="includeShields"> Shields </label>
	          </div>
	
	          <!-- Column 3: Checkboxes B -->
          	<div style="width: 115px;" class="checkbox-group">
          		  <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;">
        		  	    <input type="checkbox" id="includeMaterials"> Materials </label>
          		  <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;">
          			    <input type="checkbox" id="includeIngredients"> Ingredients </label>
          		  <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;">
          			    <input type="checkbox" id="includeCurrency"> Currency </label>
	          	  <label style="display: block; margin-bottom: 0.5em; white-space: nowrap; vertical-align: middle;">
			              <input type="checkbox" id="includeCustom"> Custom </label>
	          </div>
        </form>
      `,
      buttons: {
  ok: {
    label: "Roll Loot",
    callback: (html) => {
      const budget = parseInt(html.find("#treasureBudget").val());
      const maxVal = parseInt(html.find("#highestPCLevel").val());
      const includeWeapons = html.find("#includeWeapons").is(":checked");
      const includeArmor = html.find("#includeArmor").is(":checked");
	  const includeShields = html.find("#includeShields").is(":checked");
      const includeAccessories = html.find("#includeAccessories").is(":checked");
      const includeIngredients = html.find("#includeIngredients").is(":checked");
      const includeMaterials = html.find("#includeMaterials").is(":checked");	
	  const includeCustom   = html.find("#includeCustom").is(":checked");	

      let selectedOrigin = html.find("#origin").val();
      let selectedNature = html.find("#nature").val();

      if (selectedOrigin === "Random") {
        selectedOrigin = getRandom(Object.keys(originKeywords.material));
      }

      if (selectedNature === "Random") {
        selectedNature = getRandom(Object.keys(natureKeywords.material));
      }

      Hooks.call("lookfarShowTreasureRollDialog", {
        budget,
        maxVal,
        origin: selectedOrigin,
        nature: selectedNature,
        includeWeapons,
        includeArmor,
		includeShields,
        includeAccessories,
        includeIngredients,
        includeMaterials,  
		includeCustom  
      });
    }
  }
}
    }).render(true);
  })();
 });
});
