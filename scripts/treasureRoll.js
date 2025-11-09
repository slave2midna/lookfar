import { dataLoader } from "./dataLoader.js";
import { cacheManager } from "./cacheManager.js";

let _treasureGenDialog = null;

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
  const localNature = (nature === "Random" || !natureKeywordsMaterial[nature])
    ? getRandom(Object.keys(natureKeywordsMaterial))
    : nature;

  const localOrigin = (origin === "Random" || !originKeywordsMaterial[origin])
    ? getRandom(Object.keys(originKeywordsMaterial))
    : origin;

  if (!natureKeywordsMaterial[localNature] || budget < 50) return null;

  const detail = getRandom(Object.keys(detailKeywords));
  const detailWord = getRandom(detailKeywords[detail]);
  const originWord = getRandom(originKeywordsMaterial[localOrigin]);
  const natureWord = getRandom(natureKeywordsMaterial[localNature]);
  const name = `${detailWord} ${originWord} ${natureWord}`;

  let value = Math.floor(Math.random() * (maxVal / 50)) * 50;
  value = Math.max(50, Math.min(value, budget));
  if (value > budget) return null;

  return { 
	name, 
	value, 
	detail, 
	nature: localNature, 
	origin: localOrigin
  };
}

// Ingredient Generation
function rollIngredient(nature, origin, budget, tasteKeywords, natureKeywordsIngredient, originKeywordsIngredient) {
  const localNature = (nature === "Random" || !natureKeywordsIngredient[nature])
    ? getRandom(Object.keys(natureKeywordsIngredient))
    : nature;

  const localOrigin = (origin === "Random" || !originKeywordsIngredient[origin])
    ? getRandom(Object.keys(originKeywordsIngredient))
    : origin;

  if (!natureKeywordsIngredient[localNature] || budget < 10) return null;

  const taste = getRandom(Object.keys(tasteKeywords));
  const tasteWord = getRandom(tasteKeywords[taste]);
  const originWord = getRandom(originKeywordsIngredient[localOrigin]);
  const natureWord = getRandom(natureKeywordsIngredient[localNature]);
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
	nature: localNature, 
	origin: localOrigin
  };
}

// Weapon Generation
function rollWeapon(weapons, weaponQualities, elements, origin, useVariantDamageRules = false) {
  const originKeys = Object.keys(weaponQualities).filter(k => k !== "basic");
  const localOrigin = (origin === "Random" || !weaponQualities[origin])
    ? getRandom(originKeys)
    : origin;

  let base, quality = "None", hasPlusOne = false, appliedElement = null, isMaster = false;
  let nameParts = [];
  let value = 0;

  const baseQualities = weaponQualities.basic || [];
  const originQualities = weaponQualities[localOrigin] || [];
  const availableQualities = baseQualities.concat(originQualities);

  do {
    base = getRandom(weapons);
    nameParts = [];
    value = base.value;

    const baseAcc = Number(base?.accuracy ?? base?.acc ?? 0) || 0;
    const canPlusOne = baseAcc !== 1; // accuracy 1 weapons can’t be +1

    hasPlusOne = canPlusOne && (Math.random() < 0.5);
    appliedElement = Math.random() < 0.5 ? getRandom(elements) : null;
    isMaster = useVariantDamageRules ? false : (Math.random() < 0.5);
    const q = Math.random() < 0.5 ? getRandom(availableQualities) : null;
    quality = q?.name ?? "None";

    if (hasPlusOne) { nameParts.push("+1"); value += 100; }
    if (quality !== "None") { nameParts.push(quality); value += q.value; }
    if (appliedElement) { nameParts.push(appliedElement.name); value += 100; }
    if (isMaster && !useVariantDamageRules) { nameParts.push("Master"); value += 200; }

  } while (!hasPlusOne && quality === "None" && !appliedElement && !(isMaster && !useVariantDamageRules));
  nameParts.push(base.name);
  const name = nameParts.join(" ");

  return { 
	name, 
	value, 
	quality, 
	element: appliedElement, 
	hasPlusOne, 
	isMaster, 
	origin: localOrigin
  };
}

// Armor Generation
function rollArmor(armorList, armorQualities, origin, cap) {
  const originKeys = Object.keys(armorQualities).filter(k => k !== "basic");
  const localOrigin = (origin === "Random" || !armorQualities[origin])
    ? getRandom(originKeys)
    : origin;

  const base = getRandom(armorList);
  let nameParts = [];
  let value = base.value ?? 0;
  let quality = "None";

  const qualityPool = [
    ...(armorQualities.basic || []),
    ...(armorQualities[localOrigin] || [])
  ];

  const affordable = qualityPool.filter(q => (value + (q.value ?? 0)) <= cap);
  if (!affordable.length) return null;
  const q = getRandom(affordable);
  quality = q.name;
  nameParts.push(quality);
  value += q.value ?? 0;

  nameParts.push(base.name);
  const name = nameParts.join(" ");

  return { 
	name, 
	value, 
	quality, 
	origin: localOrigin
  };
}

// Shield Generation
function rollShield(shieldList, shieldQualities, origin, cap) {
  const originKeys = Object.keys(shieldQualities).filter(k => k !== "basic");
  const localOrigin = (origin === "Random" || !shieldQualities[origin])
    ? getRandom(originKeys)
    : origin;

  const base = getRandom(shieldList);
  let nameParts = [];
  let value = base.value ?? 0;
  let quality = "None";

  const qualityPool = [
    ...(shieldQualities.basic || []),
    ...(shieldQualities[localOrigin] || [])
  ];

  const affordable = qualityPool.filter(q => (value + (q.value ?? 0)) <= cap);
  if (!affordable.length) return null;
  const q = getRandom(affordable);
  quality = q.name;
  nameParts.push(quality);
  value += q.value ?? 0;

  nameParts.push(base.name);
  const name = nameParts.join(" ");

  return { 
	name, 
	value, 
	quality, 
	origin: localOrigin
  };
}

// Accessory Generation
function rollAccessory(accessories, accessoryQualities, origin, cap) {
  const originKeys = Object.keys(accessoryQualities).filter(k => k !== "basic");
  const localOrigin = (origin === "Random" || !accessoryQualities[origin])
    ? getRandom(originKeys)
    : origin;

  const base = getRandom(accessories);
  let nameParts = [];
  let value = base.value ?? 0;
  let quality = "None";

  const qualityPool = [
    ...(accessoryQualities.basic || []),
    ...(accessoryQualities[localOrigin] || [])
  ];

  const affordable = qualityPool.filter(q => (value + (q.value ?? 0)) <= cap);
  if (!affordable.length) return null;
  const q = getRandom(affordable);
  quality = q.name;
  nameParts.push(quality);
  value += q.value ?? 0;

  nameParts.push(base.name);
  const name = nameParts.join(" ");

  return { 
	name, 
	value, 
	quality, 
	origin: localOrigin
  };
}

// Currency Generation
function rollCurrency(remainingBudget, maxVal, { minAmount = 1, roundTo = 1 } = {}) {
  const safeBudget = Number.isFinite(remainingBudget) ? Math.max(0, Math.floor(remainingBudget)) : 0;
  const safeMaxVal = Number.isFinite(maxVal) ? Math.max(0, Math.floor(maxVal)) : 0;
  const cap = Math.min(safeBudget, safeMaxVal || safeBudget);

  if (cap < Math.max(1, minAmount)) return null;

  // Grab the display name the system uses for money
  const currencyName = game.settings.get("projectfu", "optionRenameCurrency") || "Zenit";

  // Math Magic!
  const raw = Math.floor(Math.random() * (cap - minAmount + 1)) + minAmount;
  const step = Math.max(1, Math.floor(roundTo));
  const amount = Math.max(minAmount, Math.floor(raw / step) * step);

  // Build a clean display name like "240 Credits" or "150 Zenit"
  const name = `${amount} ${currencyName}`;

  // Currency image settings (customizable later)
  const img = "modules/lookfar/assets/misc/coins.png";

  return {
    isCurrency: true,
    name,
    value: amount, // NOTE: this is what the loop subtracts from remainingBudget
    img,
    currencyName
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

  // If the result exposes a UUID, resolve that first
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

// Stash Creation
async function createStash(items, cacheFolder, currencyTotal = 0) {

  // Identify ingredient items
  const isIngredientItem = (it) => {
    const ft = foundry.utils.getProperty(it, "system.featureType")
            ?? foundry.utils.getProperty(it, "system.data.featureType");
    return it?.type === "classFeature" && ft === "projectfu.ingredient";
  };

  const stashableItems = items.filter(i => !isIngredientItem(i));
  const skippedIngredients = items.filter(isIngredientItem);

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

  // Only embed stashable items
  const embedded = stashableItems.map(i => {
    const data = i.toObject();
    delete data._id;
    delete data.folder;
    return data;
  });

  if (embedded.length) {
    await stash.createEmbeddedDocuments("Item", embedded);
  }

  // Deposit rolled currency into the stash's zenit resource
  if (currencyTotal > 0) {
    const currencyName = game.settings.get("projectfu", "optionRenameCurrency") || "Zenit";
    const current = foundry.utils.getProperty(stash, "system.resources.zenit.value") ?? 0;
    await stash.update({ "system.resources.zenit.value": current + currencyTotal });
  }

  // Only delete from cache the items we actually stashed
  const deletions = stashableItems
    .filter(i => i?.folder?.id === cacheFolder.id)
    .map(i => i.delete());
  if (deletions.length) await Promise.allSettled(deletions);

  // Friendly warning when ingredients are skipped
  if (skippedIngredients.length > 0) {
    ui.notifications?.warn(
      `Skipped ${skippedIngredients.length} ingredient${skippedIngredients.length > 1 ? "s" : ""}: ` +
      `ingredients can’t be added to a Stash in this system yet.`
    );
  }

  // Build chat message
  const depositNote = currencyTotal > 0
    ? `<br>Deposited <strong>${currencyTotal}</strong> ${(game.settings.get("projectfu","optionRenameCurrency") || "Zenit")} into the stash.`
    : "";

  const skippedNote = skippedIngredients.length > 0
    ? `<br><em>Skipped ${skippedIngredients.length} ingredient${skippedIngredients.length > 1 ? "s" : ""}; cannot be stashed.</em>`
    : "";

  await ChatMessage.create({
    content: `Created ${embedded.length} item(s) in <a class="content-link" data-uuid="${stash.uuid}"><i class="fas fa-box-archive"></i> <strong>${stash.name}</strong></a>.${depositNote}${skippedNote}`,
    speaker: ChatMessage.getSpeaker({ alias: "Treasure Result" })
  });

  // Open the stash
  stash.sheet?.render(true);

  return stash;
}

// Results render function
async function renderTreasureResultDialog(items, budget, config) {
  const cacheFolder = await cacheManager.getOrCreateCacheFolder();

  const currencyLines = items.filter(i => i && i.isCurrency);
  const docInputs = items.filter(i => i && !i.isCurrency);

  const tempItems = await Promise.all(docInputs.map(async (data) => {
    let type = null;
    let itemData;

  if (data.fromTable && data.uuid) {
    const src = await fromUuid(data.uuid);
    if (!src || src.documentName !== "Item") return null;

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
        img: "modules/lookfar/assets/misc/ingredient.png",
        folder: cacheFolder.id,
        system: {
          data: {
            cost: data.value ?? null,
            quantity: data.quantity ?? 1,
            taste: data.taste || ""
          },
          featureType: "projectfu.ingredient",
          summary: { value: `An ingredient that tastes ${data.taste}.` },
          source: "LOOKFAR"
        }
      };
	} else if ("detail" in data) {
      type = "treasure";
      const img = "modules/lookfar/assets/misc/material.png";
      
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
          summary: { value: `${data.nature} material of ${data.origin.toLowerCase()} origins. It can be used to craft ${data.detail} items.` }
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
  const img = dataLoader.getRandomIconFor("weapon", baseWeapon) || "icons/svg/sword.svg";

  // Handle variant damage
  const variantEnabled = game.settings.get("lookfar", "useVariantDamageRules");
  const variantBonus   = variantEnabled ? (2 * Math.floor((data.value || 0) / 1000)) : 0;

  // Handle Masterwork prefix
  const prefix = (data.isMaster && !variantEnabled)
    ? `A masterwork ${baseWeapon?.category || "unknown"} weapon`
    : `A ${baseWeapon?.category || "unknown"} weapon`

  // Handle +1 accuracy variants
  const baseAcc = Number(baseWeapon?.accuracy ?? baseWeapon?.acc ?? 0) || 0;
  const plusOneBonus = (data.hasPlusOne && baseAcc !== 1) ? 1 : 0;	

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
        value: `${prefix} that ${qualityObj?.description || "has no special properties."}` }
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
      const img = dataLoader.getRandomIconFor("armor", baseArmor) || "icons/svg/statue.svg";
      
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
          summary: { value: `A set of ${baseArmor?.isMartial ? "martial" : "non-martial"} armor that ${qualityObj?.description || "has no special properties."}` }
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
      const img = dataLoader.getRandomIconFor("shield", baseShield) || "icons/svg/shield.svg";
 
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
          summary: { value: `A ${baseShield?.isMartial ? "martial" : "non-martial"} shield that ${qualityObj?.description || "has no special properties."}` }
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
      const img = dataLoader.getRandomIconFor("accessory", baseAccessory) || "icons/svg/stoned.svg";

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
          summary: { value: `An accessory that ${qualityObj?.description || "has no special properties."}` }
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

 // Build compact, one-line item cards
const itemCards = finalItems.map(item => {
  const cost = getItemCost(item.system);

  // Detect ingredient...again? Will fix later
  const isIngredient = item.type === "classFeature" && item.system.featureType === "projectfu.ingredient";

  // Correct quantity lookup
  const quantity = isIngredient
    ? (item.system?.data?.quantity ?? 1)
    : (item.system?.quantity?.value ?? 1);

  const quantitySuffix = isIngredient && quantity > 1 ? ` x ${quantity}` : "";

  const desc =
    item.system?.summary?.value ??
    item.system?.summary ??
    item.system?.data?.summary?.value ??
    item.system?.data?.summary ??
    "";

  return `<div style="text-align:center;margin-bottom:0.75em">
            <img src="${item.img}" width="32" height="32" style="display:block;margin:0 auto 6px">
            <a class="content-link" data-uuid="${item.uuid}"><strong>${item.name}${quantitySuffix}</strong></a><br>
            <small>${desc}</small><br>
            <small>Value: ${cost} z</small>
          </div>`;
});

// Build & style currency tiles
const currencyCards = currencyLines.map(c =>
  `<div style="text-align:center;margin-bottom:0.75em">
     <img src="${c.img || 'icons/svg/coins.svg'}" width="32" height="32" style="display:block;margin:0 auto 6px">
     <strong>${c.name}</strong>
   </div>`
);

// Merge items & currency, then layout
const allCards = [...itemCards, ...currencyCards];

let htmlContent;
if (allCards.length > 5) {
  const left  = allCards.slice(0, 5).join("");
  const right = allCards.slice(5).join("");
  htmlContent = `
    <div class="lf-results" style="display:flex; gap:1rem; align-items:flex-start; min-width:0; margin-bottom:0;">
      <div style="flex:1 1 0; min-width:0;">${left}</div>
      <div style="flex:1 1 0; min-width:0;">${right}</div>
    </div>
  `;
} else {
  htmlContent = `<div class="lf-results" style="display:block; padding-bottom:6px;">${allCards.join("")}</div>`;
}

const needsWide = allCards.length > 5; // Set max item cards before column expand
const enrichedHtml = await TextEditor.enrichHTML(htmlContent, { async: true });

const dialog = new Dialog({
  title: "Treasure Results",
  content: enrichedHtml,
  buttons: {
    keep: {
      label: "Keep",
      callback: async () => {
        // Move items out of cache
        for (const item of finalItems) {
          if (item?.folder?.id === cacheFolder.id) {
            await item.update({ folder: null });
          }
        }
        await ChatMessage.create({
          content: enrichedHtml,
          speaker: ChatMessage.getSpeaker({ alias: "Treasure Result" })
        });
      }
    },
    stash: {
      label: "Stash",
      callback: async () => {
        const currencyTotal = (currencyLines || []).reduce((sum, c) => sum + (Number(c?.value) || 0), 0);
        await createStash(finalItems, cacheFolder, currencyTotal);
      }
    },
    reroll: {
      label: "Reroll",
      callback: () => Hooks.call("lookfarShowTreasureRollDialog", config)
    }
  }
});

dialog.render(true);

// Hooks & Wiring
Hooks.once("renderDialog", (_app, html) => {
  const $dlg = html.closest(".dialog");

  if (needsWide) {
    $dlg.css({ width: "500px", "max-width": "500px" });
  }

  const $wc   = $dlg.find(".window-content");
  const $btns = $wc.find(".dialog-buttons");

  if ($btns.length && !config?.ignoreValues) {
    const $bar = $(`
      <div class="lf-budget"
           style="margin:8px 0; border-top:1px solid var(--color-border-light, #8882); padding-top:6px;">
        <strong>Remaining Budget:</strong> ${budget}
      </div>
    `);
    $bar.insertBefore($btns);
  }
  $wc.css({
    "max-height": "none",
    "overflow": "visible",
    "overflow-y": "visible"
  });

  if (typeof _app?.setPosition === "function") {
    _app.setPosition({ height: "auto" });
    setTimeout(() => _app.setPosition({ height: "auto" }), 0);
  }

  const links = html.find("a.content-link");
  if (links.length) {
    links.on("click", async function (event) {
      event.preventDefault();
      const uuid = $(this).data("uuid");
      if (!uuid) return;
      const doc = await fromUuid(uuid);
      if (doc?.sheet) doc.sheet.render(true);
    });
  }
});
} 

Hooks.once("ready", () => {
  Hooks.on("lookfarShowTreasureRollDialog", (rerollConfig = null) => {
  (async () => {

	// --- Singleton guard for the Generator dialog
    if (!rerollConfig) {
        if (_treasureGenDialog && _treasureGenDialog.rendered) {
          _treasureGenDialog.bringToTop();
          return;
        }
      }
	  
    // Keywords 
    const { origin: originKeywords, nature: natureKeywords, detail: detailKeywords, taste: tasteKeywords } = dataLoader.keywordData;

    // Equipment & Qualities
    const { weaponList, weaponQualities } = dataLoader.weaponsData; 
    const { armorList, armorQualities } = dataLoader.armorData;
    const { shieldList, shieldQualities } = dataLoader.shieldsData;
    const { accessoryList, accessoryQualities } = dataLoader.accessoriesData;

    // Weapon Elements
    const elementKeywords = dataLoader.keywordData.element || {};
    const weaponElements = Object.entries(elementKeywords)
      .flatMap(([damageType, names]) => names.map(name => ({ name, damageType })));

    if (rerollConfig) {
      const {
        budget, 
		maxVal, 
		origin, 
		nature,
		itemCount = 1,  
        includeWeapons, 
		includeArmor, 
		includeShields,
        includeAccessories, 
		includeIngredients, 
		includeMaterials,
		includeCurrency,  
        includeCustom,
		ignoreValues = false  
      } = rerollConfig;

      let remainingBudget = ignoreValues ? Number.MAX_SAFE_INTEGER : budget;
      const effectiveMaxVal = ignoreValues ? Number.MAX_SAFE_INTEGER : maxVal;
      let items = [];
      let ingredientCount = 0;
      let failedAttempts = 0;
      const maxAttempts = 50; // infinite loop protection. Increase if needed.

      while ((ignoreValues || remainingBudget > 0) && items.length < itemCount && failedAttempts < maxAttempts) {
        let itemTypes = [];
        if (includeWeapons) itemTypes.push("Weapon");
        if (includeArmor) itemTypes.push("Armor");
        if (includeShields) itemTypes.push("Shield");
        if (includeAccessories) itemTypes.push("Accessory");
        if (includeIngredients && ingredientCount < 3) itemTypes.push("Ingredient");
        if (includeMaterials) itemTypes.push("Material");
		if (includeCurrency) itemTypes.push("Currency");
        if (includeCustom) itemTypes.push("Custom");
		

        if (itemTypes.length === 0) break;

        const type = getRandom(itemTypes);
        let item = null;
        const cap = Math.min(remainingBudget, effectiveMaxVal);

        switch (type) {
          case "Weapon":     item = rollWeapon(weaponList, weaponQualities, weaponElements, origin, game.settings.get("lookfar", "useVariantDamageRules")); break;
          case "Armor":      item = rollArmor(armorList, armorQualities, origin, cap); break;
          case "Shield":     item = rollShield(shieldList, shieldQualities, origin, cap); break;
          case "Accessory":  item = rollAccessory(accessoryList, accessoryQualities, origin, cap); break;	
          case "Material":   item = rollMaterial(nature, origin, maxVal, remainingBudget, detailKeywords, originKeywords.material, natureKeywords.material); break;
          case "Ingredient": item = rollIngredient(nature, origin, remainingBudget, tasteKeywords, natureKeywords.ingredient, originKeywords.ingredient); ingredientCount++; break;
		  case "Currency":   item = rollCurrency(remainingBudget, maxVal, { roundTo: 10 }); break; // tidy amounts
          case "Custom":     item = await rollCustom(); break;
        }

        if (!item || item.value > remainingBudget || item.value > effectiveMaxVal) {
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
		
      const displayBudget = ignoreValues ? "Ignored" : remainingBudget;
      renderTreasureResultDialog(items, remainingBudget, rerollConfig);
      return;
    }
	  
    // Main Dialog Form
    const genDialog = new Dialog({
      title: "Treasure Generator",
      content: `
<form style="display:flex; width:100%; flex-wrap:nowrap; gap:0.25rem; box-sizing:border-box;">

  <!-- Left Half of Dialog/Column 1 -->
  <div id="genOptions" style="flex:1 1 40%; min-width:0; box-sizing:border-box;">
    <div class="form-group" style="display:flex; align-items:center; margin-bottom:0.5em;">
      <label for="treasureBudget" style="flex:0 0 35%; max-width:35%; padding-right:0.5em; box-sizing:border-box;">Budget:</label>
      <input type="number" id="treasureBudget" value="1" min="1" style="flex:1 1 65%; min-width:0; max-width:65%; box-sizing:border-box;" />
    </div>
    <div class="form-group" style="display:flex; align-items:center; margin-bottom:0.5em;">
      <label for="highestPCLevel" style="flex:0 0 35%; padding-right:0.5em; box-sizing:border-box;">Level:</label>
      <select id="highestPCLevel" style="flex:1 1 65%; min-width:0; box-sizing:border-box;">
        <option value="500">5+</option>
        <option value="1000">10+</option>
        <option value="1500">20+</option>
        <option value="2000">30+</option>
        <option value="999999">40+</option>
      </select>
    </div>
    <div class="form-group" style="display:flex; align-items:center; margin-bottom:0.5em;">
      <label for="origin" style="flex:0 0 35%; padding-right:0.5em; box-sizing:border-box;">Origin:</label>
      <select id="origin" style="flex:1 1 65%; min-width:0; box-sizing:border-box;">
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
    <div class="form-group" style="display:flex; align-items:center; margin-bottom:0.5em;">
      <label for="nature" style="flex:0 0 35%; padding-right:0.5em; box-sizing:border-box;">Nature:</label>
      <select id="nature" style="flex:1 1 65%; min-width:0; box-sizing:border-box;">
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
    <div class="form-group" style="display:flex; align-items:center; margin-bottom:0.5em;">
      <label for="itemCount" style="flex:0 0 35%; padding-right:0.5em; box-sizing:border-box;">Items:</label>
      <div style="display:flex; align-items:center; gap:0.25rem; flex:1 1 65%; min-width:0;">
        <button type="button" id="subCount" style="height:2em; width:2em;">−</button>
        <input type="number" id="itemCount" value="1" min="1" max="10" readonly style="flex:1 1 auto; box-sizing:border-box; text-align:center; min-width:0;" />
        <button type="button" id="addCount" style="height:2em; width:2em;">+</button>
      </div>
    </div>
  </div>

  <!-- Right half of Dialog/Column 2 & 3 -->
  <div id="lootOptions" style="flex:1 1 60%; min-width:0; display:flex; flex-direction:column; box-sizing:border-box;">
    <!-- Merged header -->
    <div style="display:flex; align-items:center; justify-content:flex-end; gap:0.75em; margin-bottom:0.5em; border-bottom:1px solid var(--color-border-light, #8882); padding-bottom:0.25em;">
      <label style="white-space:nowrap; font-weight:normal; display:inline-flex; align-items:center; gap:0.25em;">
        <input type="checkbox" id="ignoreValues" />
        <small>Ignore budget/level</small>
      </label>
      <label style="white-space:nowrap; font-weight:normal; display:inline-flex; align-items:center; gap:0.25em;">
        <input type="checkbox" id="selectAllLoot" />
        <small>Select all</small>
      </label>
    </div>

    <!-- Two inner columns that share the right half equally -->
    <div style="display:flex; min-width:0;">
      <div class="checkbox-group" style="flex:1 1 0; min-width:0;">
        <label style="display:flex; align-items:center; gap:0.25em; margin-bottom:0.5em;">
          <input type="checkbox" id="includeWeapons" />
          <span>Weapons</span>
        </label>
        <label style="display:flex; align-items:center; gap:0.25em; margin-bottom:0.5em;">
          <input type="checkbox" id="includeArmor" />
          <span>Armor</span>
        </label>
        <label style="display:flex; align-items:center; gap:0.25em; margin-bottom:0.5em;">
          <input type="checkbox" id="includeAccessories" />
          <span>Accessories</span>
        </label>
        <label style="display:flex; align-items:center; gap:0.25em; margin-bottom:0.5em;">
          <input type="checkbox" id="includeShields" />
          <span>Shields</span>
        </label>
      </div>

      <div class="checkbox-group" style="flex:1 1 0; min-width:0;">
        <label style="display:flex; align-items:center; gap:0.25em; margin-bottom:0.5em;">
          <input type="checkbox" id="includeMaterials" />
          <span>Materials</span>
        </label>
        <label style="display:flex; align-items:center; gap:0.25em; margin-bottom:0.5em;">
          <input type="checkbox" id="includeIngredients" />
          <span>Ingredients</span>
        </label>
        <label style="display:flex; align-items:center; gap:0.25em; margin-bottom:0.5em;">
          <input type="checkbox" id="includeCurrency" />
          <span>Currency</span>
        </label>
        <label style="display:flex; align-items:center; gap:0.25em; margin-bottom:0.5em;">
          <input type="checkbox" id="includeCustom" />
          <span>Custom</span>
        </label>
      </div>
    </div>
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
		const includeCurrency = html.find("#includeCurrency").is(":checked");
        const includeCustom = html.find("#includeCustom").is(":checked");

		const ignoreValues = html.find("#ignoreValues").is(":checked");  

        const selectedOrigin = html.find("#origin").val();
        const selectedNature = html.find("#nature").val();

		const itemCount = parseInt(html.find("#itemCount").val(), 10) || 1;

        Hooks.call("lookfarShowTreasureRollDialog", {
          budget,
          maxVal,
          origin: selectedOrigin,
          nature: selectedNature,
		  itemCount,
          includeWeapons,
          includeArmor,
          includeShields,
          includeAccessories,
          includeIngredients,
          includeMaterials,
		  includeCurrency,	
          includeCustom,
		  ignoreValues	
        });
      }
    }
  },
  close: () => {
    _treasureGenDialog = null;
  }
});

Hooks.once("renderDialog", (app, html) => {
  if (!html.find || !html.find("#itemCount").length) return;

  // Item count controls
  const $count = html.find("#itemCount");
  const min = Number($count.attr("min")) || 1;
  const max = Number($count.attr("max")) || 10;

  const clampSet = (val) => {
    const n = parseInt(val, 10);
    const safe = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
    $count.val(safe);
  };

  html.find("#addCount").on("click", (e) => { e.preventDefault(); clampSet(Number($count.val()) + 1); });
  html.find("#subCount").on("click", (e) => { e.preventDefault(); clampSet(Number($count.val()) - 1); });

  $count.on("wheel", (e) => e.preventDefault());

  // Select All wiring
  const $selectAll = html.find("#selectAllLoot");
  if ($selectAll.length) {

    const $boxes = html.find('#lootOptions input[type="checkbox"]').not("#selectAllLoot, #ignoreValues");

    $selectAll.on("change", (ev) => {
      const checked = ev.currentTarget.checked;
      $boxes.prop("checked", checked);
      $selectAll.prop("indeterminate", false);
    });

    $boxes.on("change", () => {
      const arr = $boxes.toArray();
      const allChecked = arr.every(b => b.checked);
      const anyChecked = arr.some(b => b.checked);
      $selectAll
        .prop("checked", allChecked)
        .prop("indeterminate", anyChecked && !allChecked);
    });
  }

  // Grey-out logic for "Ignore budget/level"
  const $ignore      = html.find("#ignoreValues");
  const $budgetLabel = html.find('label[for="treasureBudget"]');
  const $budgetField = html.find("#treasureBudget");
  const $levelLabel  = html.find('label[for="highestPCLevel"]');
  const $levelField  = html.find("#highestPCLevel");

  const setFieldState = ($el, isDisabled) => {
  $el.prop("disabled", isDisabled);
  $el.css("opacity", isDisabled ? 0.5 : "");
  $el.css("border", isDisabled ? "1px solid var(--color-border, #777)" : "");
  $el.css("outline", isDisabled ? "none" : "");
  $el.css("box-shadow", "none");
};

  const toggleDisabled = (isDisabled) => {
  const labelOpacity = isDisabled ? 0.5 : 1.0;
  $budgetLabel.css("opacity", labelOpacity);
  $levelLabel.css("opacity", labelOpacity);

  setFieldState($budgetField, isDisabled);
  setFieldState($levelField,  isDisabled);
};

toggleDisabled($ignore.is(":checked"));
$ignore.on("change", (ev) => toggleDisabled(ev.currentTarget.checked));
});

genDialog.render(true);
  
  })();
 });
});
