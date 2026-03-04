import { dataLoader } from "./dataLoader.js";
import { cacheManager } from "./cacheManager.js";

let _treasureGenDialog = null;

// Template paths
const TREASURE_ROLL_TEMPLATE = "modules/lookfar/templates/treasure-roll.hbs";
const TREASURE_RESULT_TEMPLATE = "modules/lookfar/templates/treasure-result.hbs";

// ------------------------------
// i18n dataset helpers
// ------------------------------
function lfBundle() {
  return dataLoader?.i18nData || {};
}

function lfEquipName(kind, id) {
  // kind: weapon|armor|shield|accessory
  return lfBundle()?.equipment?.[kind]?.[id] ?? id;
}

function lfQualityEntry(group, id) {
  // First try the provided group
  const direct = lfBundle()?.qualities?.[group]?.[id];
  if (direct) return { group, entry: direct };

  // Fallback: search every group for this id
  const all = lfBundle()?.qualities || {};
  for (const [g, entries] of Object.entries(all)) {
    if (entries?.[id]) return { group: g, entry: entries[id] };
  }

  return null;
}

function lfQualityNameFor(kind, group, id) {
  const hit = lfQualityEntry(group, id);
  if (!hit?.entry) return id;

  const key =
    kind === "weapon" ? "Weapon" :
    kind === "armor" ? "Armor" :
    kind === "shield" ? "Shield" :
    kind === "accessory" ? "Accessory" :
    null;

  const name = key ? hit.entry[key] : null;
  return (typeof name === "string" && name.trim()) ? name.trim() : id;
}

function lfQualityDesc(group, id) {
  const hit = lfQualityEntry(group, id);
  const desc = hit?.entry?.Description;
  return (typeof desc === "string" && desc.trim()) ? desc.trim() : "";
}

// ------------------------------
// Utility
// ------------------------------
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cleanName(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

// Normalize cost across different schemas
function getItemCost(sys) {
  return sys?.cost?.value ??
    sys?.data?.cost ??
    sys?.data?.cost?.value ??
    sys?.data?.value ??
    0;
}

// ------------------------------
// Generation
// ------------------------------

// Material Generation
function rollMaterial(nature, origin, maxVal, budget, detailKeywords, originKeywordsMaterial, natureKeywordsMaterial) {
  const localNature = (nature === "Random" || !natureKeywordsMaterial[nature]) ?
    getRandom(Object.keys(natureKeywordsMaterial)) :
    nature;

  const localOrigin = (origin === "Random" || !originKeywordsMaterial[origin]) ?
    getRandom(Object.keys(originKeywordsMaterial)) :
    origin;

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
  const localNature = (nature === "Random" || !natureKeywordsIngredient[nature]) ?
    getRandom(Object.keys(natureKeywordsIngredient)) :
    nature;

  const localOrigin = (origin === "Random" || !originKeywordsIngredient[origin]) ?
    getRandom(Object.keys(originKeywordsIngredient)) :
    origin;

  if (!natureKeywordsIngredient[localNature] || budget < 10) return null;

  const taste = getRandom(Object.keys(tasteKeywords));
  const tasteWord = getRandom(tasteKeywords[taste]);
  const originWord = getRandom(originKeywordsIngredient[localOrigin]);
  const natureWord = getRandom(natureKeywordsIngredient[localNature]);
  const name = `${tasteWord} ${originWord} ${natureWord}`;

  const quantity = Math.floor(Math.random() * 3) + 1;
  const unitValue = 10;
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
  const localOrigin = (origin === "Random" || !weaponQualities[origin]) ?
    getRandom(originKeys) :
    origin;

  let base, qualityId = null,
    hasPlusOne = false,
    appliedElement = null,
    isMaster = false;
  let value = 0;

  const baseQualities = weaponQualities.basic || [];
  const originQualities = weaponQualities[localOrigin] || [];
  const availableQualities = baseQualities.concat(originQualities);

  do {
    base = getRandom(weapons);
    value = base.value;

    const baseAcc = Number(base?.accuracy ?? base?.acc ?? 0) || 0;
    const canPlusOne = baseAcc !== 1;

    hasPlusOne = canPlusOne && (Math.random() < 0.5);
    appliedElement = Math.random() < 0.5 ? getRandom(elements) : null;
    isMaster = useVariantDamageRules ? false : (Math.random() < 0.5);

    const q = Math.random() < 0.5 ? getRandom(availableQualities) : null;
    qualityId = q?.id ?? null;

    if (hasPlusOne) value += 100;
    if (qualityId) value += (q.value ?? q.cost ?? 0);
    if (appliedElement) value += 100;
    if (isMaster && !useVariantDamageRules) value += 200;

  } while (!hasPlusOne && !qualityId && !appliedElement && !(isMaster && !useVariantDamageRules));

  return {
    kind: "weapon",
    baseId: base.id,
    value,
    qualityId,
    qualityGroup: localOrigin,
    element: appliedElement,
    hasPlusOne,
    isMaster,
    origin: localOrigin
  };
}

// Armor Generation
function rollArmor(armorList, armorQualities, origin, cap) {
  const originKeys = Object.keys(armorQualities).filter(k => k !== "basic");
  const localOrigin = (origin === "Random" || !armorQualities[origin]) ?
    getRandom(originKeys) :
    origin;

  const base = getRandom(armorList);
  let value = base.value ?? 0;

  const pool = [
    ...(armorQualities.basic || []),
    ...(armorQualities[localOrigin] || [])
  ];

  const affordable = pool.filter(q => (value + (q.value ?? q.cost ?? 0)) <= cap);
  if (!affordable.length) return null;

  const q = getRandom(affordable);
  const qualityId = q.id;

  value += (q.value ?? q.cost ?? 0);

  return {
    kind: "armor",
    baseId: base.id,
    value,
    qualityId,
    qualityGroup: localOrigin,
    origin: localOrigin
  };
}

// Shield Generation
function rollShield(shieldList, shieldQualities, origin, cap) {
  const originKeys = Object.keys(shieldQualities).filter(k => k !== "basic");
  const localOrigin = (origin === "Random" || !shieldQualities[origin]) ?
    getRandom(originKeys) :
    origin;

  const base = getRandom(shieldList);
  let value = base.value ?? 0;

  const pool = [
    ...(shieldQualities.basic || []),
    ...(shieldQualities[localOrigin] || [])
  ];

  const affordable = pool.filter(q => (value + (q.value ?? q.cost ?? 0)) <= cap);
  if (!affordable.length) return null;

  const q = getRandom(affordable);
  const qualityId = q.id;

  value += (q.value ?? q.cost ?? 0);

  return {
    kind: "shield",
    baseId: base.id,
    value,
    qualityId,
    qualityGroup: localOrigin,
    origin: localOrigin
  };
}

// Accessory Generation
function rollAccessory(accessories, accessoryQualities, origin, cap) {
  const originKeys = Object.keys(accessoryQualities).filter(k => k !== "basic");
  const localOrigin = (origin === "Random" || !accessoryQualities[origin]) ?
    getRandom(originKeys) :
    origin;

  const base = getRandom(accessories);
  let value = base.value ?? 0;

  const pool = [
    ...(accessoryQualities.basic || []),
    ...(accessoryQualities[localOrigin] || [])
  ];

  const affordable = pool.filter(q => (value + (q.value ?? q.cost ?? 0)) <= cap);
  if (!affordable.length) return null;

  const q = getRandom(affordable);
  const qualityId = q.id;

  value += (q.value ?? q.cost ?? 0);

  return {
    kind: "accessory",
    baseId: base.id,
    value,
    qualityId,
    qualityGroup: localOrigin,
    origin: localOrigin
  };
}

// Currency Generation
function rollCurrency(remainingBudget, maxVal, { minAmount = 1, roundTo = 1 } = {}) {
  const safeBudget = Number.isFinite(remainingBudget) ? Math.max(0, Math.floor(remainingBudget)) : 0;
  const safeMaxVal = Number.isFinite(maxVal) ? Math.max(0, Math.floor(maxVal)) : 0;
  const cap = Math.min(safeBudget, safeMaxVal || safeBudget);

  if (cap < Math.max(1, minAmount)) return null;

  // Grab the display name the system uses for money (or default to Zenit)
  const currencyName =
    game.settings.get("projectfu", "optionRenameCurrency") ||
    game.i18n.localize("LOOKFAR.Vocabulary.Common.Zenit");

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
    value: amount,
    img,
    currencyName
  };
}

// Custom Treasure Generation
async function rollCustom() {
  const tableId = game.settings.get("lookfar", "customTreasureRollTable");
  if (!tableId || tableId === "default") {
    ui.notifications?.warn(
      game.i18n.localize("LOOKFAR.TreasureRoll.Errors.CustomTreasureTableMissing")
    );
    return null;
  }

  const table = game.tables?.get(tableId);
  if (!table) {
    ui.notifications?.warn(
      game.i18n.localize("LOOKFAR.TreasureRoll.Errors.CustomTreasureTableNotFound")
    );
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

// ------------------------------
// Stash Creation
// ------------------------------
async function createStash(items, cacheFolder, currencyTotal = 0) {
  // Identify ingredient items
  const isIngredientItem = (it) => {
    const ft = foundry.utils.getProperty(it, "system.featureType") ??
      foundry.utils.getProperty(it, "system.data.featureType");
    return it?.type === "classFeature" && ft === "projectfu.ingredient";
  };

  const stashableItems = items.filter(i => !isIngredientItem(i));
  const skippedIngredients = items.filter(isIngredientItem);

  const allStashes = game.actors.filter(a => a.type === "stash");
  const prefix = game.i18n.localize("LOOKFAR.TreasureRoll.Stash.NamePrefix");
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape for regex
  const re = new RegExp(`^${esc}(\\d+)$`, "i");
  let nextNum = 1;
  for (const a of allStashes) {
    const m = re.exec(a.name);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n >= nextNum) nextNum = n + 1;
    }
  }
  const stashName = game.i18n.format("LOOKFAR.TreasureRoll.Stash.DefaultName", { num: nextNum });

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
    const currencyName =
      game.settings.get("projectfu", "optionRenameCurrency") ||
      game.i18n.localize("LOOKFAR.Vocabulary.Common.Zenit");

    const current = foundry.utils.getProperty(stash, "system.resources.zenit.value") ?? 0;
    await stash.update({
      "system.resources.zenit.value": current + currencyTotal
    });
  }

  // Only delete from cache the items we actually stashed
  const deletions = stashableItems
    .filter(i => i?.folder?.id === cacheFolder.id)
    .map(i => i.delete());
  if (deletions.length) await Promise.allSettled(deletions);

  // Friendly warning when ingredients are skipped
  if (skippedIngredients.length > 0) {
    const skippedMsg = game.i18n.format(
      "LOOKFAR.TreasureRoll.Errors.SkippedIngredientsWarning",
      { count: skippedIngredients.length }
    );
    ui.notifications?.warn(skippedMsg);
  }

  // Build chat message
  const currencyName =
    game.settings.get("projectfu", "optionRenameCurrency") ||
    game.i18n.localize("LOOKFAR.Vocabulary.Common.Zenit");

  const stashLink = `<a class="content-link" data-uuid="${stash.uuid}"><i class="fas fa-box-archive"></i> <strong>${stash.name}</strong></a>`;

  let content = game.i18n.format("LOOKFAR.TreasureRoll.Chat.CreatedStash", {
    count: embedded.length,
    stashLink
  });

  if (currencyTotal > 0) {
    content += "<br>" + game.i18n.format("LOOKFAR.TreasureRoll.Chat.Deposited", {
      amount: currencyTotal,
      currency: currencyName
    });
  }

  if (skippedIngredients.length > 0) {
    content += "<br><em>" + game.i18n.format("LOOKFAR.TreasureRoll.Chat.SkippedIngredients", {
      count: skippedIngredients.length
    }) + "</em>";
  }

  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({
      alias: game.i18n.localize("LOOKFAR.TreasureRoll.Chat.Alias")
    })
  });

  // Open the stash
  stash.sheet?.render(true);

  return stash;
}

// ------------------------------
// Results render function
// ------------------------------
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
          summary: {
            value: game.i18n.format("LOOKFAR.TreasureRoll.Summaries.Ingredient", {
              taste: data.taste
            })
          },
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
          summary: {
            value: game.i18n.format("LOOKFAR.TreasureRoll.Summaries.Material", {
              nature: data.nature,
              originLower: String(data.origin || "").toLowerCase(),
              detail: data.detail
            })
          }
        }
      };
    } else if (data?.kind === "weapon") {
      type = "weapon";

      const baseWeapon = dataLoader.weaponsData.weaponList.find(w => w.id === data.baseId);
      if (!baseWeapon) return null;

      const group = data.qualityGroup || "basic";
      const qualityName = data.qualityId ? lfQualityNameFor("weapon", group, data.qualityId) : null;
      const qualityDesc = data.qualityId ? lfQualityDesc(group, data.qualityId) : "";

      const baseName = lfEquipName("weapon", baseWeapon.id);
      const img = dataLoader.getRandomIconFor("weapon", baseWeapon) || "icons/svg/sword.svg";

      // Handle variant damage
      const variantEnabled = game.settings.get("lookfar", "useVariantDamageRules");
      const variantBonus = variantEnabled ? (2 * Math.floor((data.value || 0) / 1000)) : 0;

      // Handle Masterwork prefix
      const unknown = game.i18n.localize("LOOKFAR.Vocabulary.Common.Unknown");
      const cat = baseWeapon?.category || unknown;

      const prefixKey =
        (data.isMaster && !variantEnabled)
          ? "LOOKFAR.TreasureRoll.WeaponPrefix.Masterwork"
          : "LOOKFAR.TreasureRoll.WeaponPrefix.Base";

      const prefix = game.i18n.format(prefixKey, { category: cat });

      // Handle +1 accuracy variants
      const baseAcc = Number(baseWeapon?.accuracy ?? baseWeapon?.acc ?? 0) || 0;

      const accuracyUp = (data.hasPlusOne && baseAcc !== 1)
        ? game.i18n.localize("LOOKFAR.TreasureRoll.Tokens.AccuracyUp")
        : "";

      const damageUp = (data.isMaster && !variantEnabled)
        ? game.i18n.localize("LOOKFAR.TreasureRoll.Tokens.DamageUp")
        : "";

      const weaponNameRaw = game.i18n.format("LOOKFAR.TreasureRoll.NamePatterns.Weapon", {
        accuracyUp,
        quality: qualityName || "",
        damageUp,
        element: data.element?.name || "",
        type: baseName
      });

      const displayName = cleanName(weaponNameRaw);

      const qualityText = qualityDesc || game.i18n.localize("LOOKFAR.TreasureRoll.Text.NoSpecialProperties");

      itemData = {
        name: displayName,
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
          accuracy: {
            value: (baseWeapon?.accuracy ?? 0) + ((data.hasPlusOne && baseAcc !== 1) ? 1 : 0)
          },
          defense: baseWeapon?.defense || "",
          damageType: {
            value: data.element?.damageType || baseWeapon?.element || "physical"
          },
          damage: {
            value: (baseWeapon?.damage ?? 0) + (variantEnabled ? variantBonus : (data.isMaster ? 4 : 0))
          },
          isMartial: { value: baseWeapon?.isMartial ?? false },
          quality: {
            value: qualityDesc || game.i18n.localize("LOOKFAR.TreasureRoll.Text.NoQuality")
          },
          cost: { value: data.value },
          source: { value: "LOOKFAR" },
          summary: {
            value: game.i18n.format("LOOKFAR.TreasureRoll.Summaries.Weapon", {
              prefix,
              qualityText
            })
          }
        }
      };
    } else if (data?.kind === "armor") {
      type = "armor";

      const baseArmor = dataLoader.armorData.armorList.find(a => a.id === data.baseId);
      if (!baseArmor) return null;

      const group = data.qualityGroup || "basic";
      const qualityName = data.qualityId ? lfQualityNameFor("armor", group, data.qualityId) : null;
      const qualityDesc = data.qualityId ? lfQualityDesc(group, data.qualityId) : "";

      const baseName = lfEquipName("armor", baseArmor.id);
      const img = dataLoader.getRandomIconFor("armor", baseArmor) || "icons/svg/statue.svg";

      const displayName = [qualityName, baseName].filter(Boolean).join(" ");
      const martialType = baseArmor?.isMartial
        ? game.i18n.localize("LOOKFAR.Vocabulary.Martial.Martial")
        : game.i18n.localize("LOOKFAR.Vocabulary.Martial.NonMartial");

      const qualityText = qualityDesc || game.i18n.localize("LOOKFAR.TreasureRoll.Text.NoSpecialProperties");

      itemData = {
        name: displayName,
        type,
        img,
        folder: cacheFolder.id,
        system: {
          def: {
            attribute: baseArmor?.defAttr || "dex",
            value: baseArmor?.def ?? 0
          },
          mdef: {
            attribute: baseArmor?.mdefAttr || "ins",
            value: baseArmor?.mdef ?? 0
          },
          init: { value: baseArmor?.init ?? 0 },
          isMartial: { value: baseArmor?.isMartial ?? false },
          quality: {
            value: qualityDesc || game.i18n.localize("LOOKFAR.TreasureRoll.Text.NoQuality")
          },
          cost: { value: data.value },
          source: { value: "LOOKFAR" },
          summary: {
            value: game.i18n.format("LOOKFAR.TreasureRoll.Summaries.Armor", {
              martialType,
              qualityText
            })
          }
        }
      };
    } else if (data?.kind === "shield") {
      type = "shield";

      const baseShield = dataLoader.shieldsData.shieldList.find(s => s.id === data.baseId);
      if (!baseShield) return null;

      const group = data.qualityGroup || "basic";
      const qualityName = data.qualityId ? lfQualityNameFor("shield", group, data.qualityId) : null;
      const qualityDesc = data.qualityId ? lfQualityDesc(group, data.qualityId) : "";

      const baseName = lfEquipName("shield", baseShield.id);
      const img = dataLoader.getRandomIconFor("shield", baseShield) || "icons/svg/shield.svg";

      const displayName = [qualityName, baseName].filter(Boolean).join(" ");
      const martialType = baseShield?.isMartial
        ? game.i18n.localize("LOOKFAR.Vocabulary.Martial.Martial")
        : game.i18n.localize("LOOKFAR.Vocabulary.Martial.NonMartial");

      const qualityText = qualityDesc || game.i18n.localize("LOOKFAR.TreasureRoll.Text.NoSpecialProperties");

      itemData = {
        name: displayName,
        type,
        img,
        folder: cacheFolder.id,
        system: {
          def: {
            attribute: baseShield?.defAttr || "dex",
            value: baseShield?.def ?? 0
          },
          mdef: {
            attribute: baseShield?.mdefAttr || "ins",
            value: baseShield?.mdef ?? 0
          },
          init: { value: baseShield?.init ?? 0 },
          isMartial: { value: baseShield?.isMartial ?? false },
          quality: {
            value: qualityDesc || game.i18n.localize("LOOKFAR.TreasureRoll.Text.NoQuality")
          },
          cost: { value: data.value },
          source: { value: "LOOKFAR" },
          summary: {
            value: game.i18n.format("LOOKFAR.TreasureRoll.Summaries.Shield", {
              martialType,
              qualityText
            })
          }
        }
      };
    } else if (data?.kind === "accessory") {
      type = "accessory";

      const baseAccessory = dataLoader.accessoriesData.accessoryList.find(a => a.id === data.baseId);
      if (!baseAccessory) return null;

      const group = data.qualityGroup || "basic";
      const qualityName = data.qualityId ? lfQualityNameFor("accessory", group, data.qualityId) : null;
      const qualityDesc = data.qualityId ? lfQualityDesc(group, data.qualityId) : "";

      const baseName = lfEquipName("accessory", baseAccessory.id);
      const img = dataLoader.getRandomIconFor("accessory", baseAccessory) || "icons/svg/stoned.svg";

      const displayName = [qualityName, baseName].filter(Boolean).join(" ");
      const qualityText = qualityDesc || game.i18n.localize("LOOKFAR.TreasureRoll.Text.NoSpecialProperties");

      itemData = {
        name: displayName,
        type,
        img,
        folder: cacheFolder.id,
        system: {
          def: { value: baseAccessory?.def ?? 0 },
          mdef: { value: baseAccessory?.mdef ?? 0 },
          init: { value: baseAccessory?.init ?? 0 },
          quality: {
            value: qualityDesc || game.i18n.localize("LOOKFAR.TreasureRoll.Text.NoQuality")
          },
          cost: { value: data.value },
          source: { value: "LOOKFAR" },
          summary: {
            value: game.i18n.format("LOOKFAR.TreasureRoll.Summaries.Accessory", {
              qualityText
            })
          }
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

    const isIngredient = item.type === "classFeature" && item.system.featureType === "projectfu.ingredient";

    const quantity = isIngredient ?
      (item.system?.data?.quantity ?? 1) :
      (item.system?.quantity?.value ?? 1);

    const quantitySuffix = isIngredient && quantity > 1 ? ` x ${quantity}` : "";

    const desc =
      item.system?.summary?.value ??
      item.system?.summary ??
      item.system?.data?.summary?.value ??
      item.system?.data?.summary ??
      "";

    const currencyName =
      game.settings.get("projectfu", "optionRenameCurrency") ||
      game.i18n.localize("LOOKFAR.Vocabulary.Common.Zenit");

    return `<div style="text-align:center;margin-bottom:0.75em">
              <img src="${item.img}" width="32" height="32" style="display:block;margin:0 auto 6px">
              <a class="content-link" data-uuid="${item.uuid}"><strong>${item.name}${quantitySuffix}</strong></a><br>
              <small>${desc}</small><br>
              <small>${game.i18n.localize("LOOKFAR.Vocabulary.Fields.Value")}: ${cost} ${currencyName}</small>
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

  let innerHtml;
  if (allCards.length > 5) {
    const left = allCards.slice(0, 5).join("");
    const right = allCards.slice(5).join("");
    innerHtml = `
      <div class="lf-results" style="display:flex; gap:1rem; align-items:flex-start; min-width:0; margin-bottom:0;">
        <div style="flex:1 1 0; min-width:0;">${left}</div>
        <div style="flex:1 1 0; min-width:0;">${right}</div>
      </div>
    `;
  } else {
    innerHtml = `<div class="lf-results" style="display:block; padding-bottom:6px;">${allCards.join("")}</div>`;
  }

  const needsWide = allCards.length > 5;
  const enrichedHtml = await TextEditor.enrichHTML(innerHtml, { async: true });

  const templateData = {
    resultsHtml: enrichedHtml,
    showBudget: !config?.ignoreValues,
    budgetDisplay: config?.ignoreValues
      ? game.i18n.localize("LOOKFAR.TreasureRoll.Result.Budget.Ignored")
      : budget
  };

  const content = await renderTemplate(TREASURE_RESULT_TEMPLATE, templateData);

  const dialog = new Dialog({
    title: game.i18n.localize("LOOKFAR.TreasureRoll.Dialogs.Result.Title"),
    content,
    buttons: {
      keep: {
        label: game.i18n.localize("LOOKFAR.TreasureRoll.Dialogs.Result.Buttons.Keep"),
        callback: async () => {
          // Move items out of cache
          for (const item of finalItems) {
            if (item?.folder?.id === cacheFolder.id) {
              await item.update({ folder: null });
            }
          }
          await ChatMessage.create({
            content: enrichedHtml,
            speaker: ChatMessage.getSpeaker({
              alias: game.i18n.localize("LOOKFAR.TreasureRoll.Chat.Alias")
            })
          });
        }
      },
      stash: {
        label: game.i18n.localize("LOOKFAR.TreasureRoll.Dialogs.Result.Buttons.Stash"),
        callback: async () => {
          const currencyTotal = (currencyLines || []).reduce((sum, c) => sum + (Number(c?.value) || 0), 0);
          await createStash(finalItems, cacheFolder, currencyTotal);
        }
      },
      reroll: {
        label: game.i18n.localize("LOOKFAR.TreasureRoll.Dialogs.Result.Buttons.Reroll"),
        callback: () => Hooks.call("lookfarShowTreasureRollDialog", config)
      }
    }
  });

  dialog.render(true);

  // Styling & link behavior for the *result* dialog
  Hooks.once("renderDialog", (app, html) => {
    if (!html.find || !html.find("#lookfar-treasure-result").length) return;

    const $dlg = html.closest(".dialog");
    if (needsWide) {
      $dlg.css({
        width: "500px",
        "max-width": "500px"
      });
    }

    const $wc = $dlg.find(".window-content");
    $wc.css({
      "max-height": "none",
      "overflow": "visible",
      "overflow-y": "visible"
    });

    if (typeof app?.setPosition === "function") {
      app.setPosition({ height: "auto" });
      setTimeout(() => app.setPosition({ height: "auto" }), 0);
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

// ------------------------------
// Hooks & Wiring
// ------------------------------
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

      const keywords = dataLoader?.i18nData?.keywords || {};
      const originKeywords = keywords.origin || { material: {}, ingredient: {} };
      const natureKeywords = keywords.nature || { material: {}, ingredient: {} };
      const detailKeywords = keywords.detail || {};
      const tasteKeywords = keywords.taste || {};

      // Equipment & Qualities
      const { weaponList, weaponQualities } = dataLoader.weaponsData;
      const { armorList, armorQualities } = dataLoader.armorData;
      const { shieldList, shieldQualities } = dataLoader.shieldsData;
      const { accessoryList, accessoryQualities } = dataLoader.accessoriesData;

      // Weapon Elements
      const elementKeywords = keywords.element || {};
      const weaponElements = Object.entries(elementKeywords)
        .flatMap(([damageType, names]) => names.map(name => ({
          name,
          damageType
        })));

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
        const maxAttempts = 50; // infinite loop protection

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
            case "Weapon":
              item = rollWeapon(weaponList, weaponQualities, weaponElements, origin, game.settings.get("lookfar", "useVariantDamageRules"));
              break;
            case "Armor":
              item = rollArmor(armorList, armorQualities, origin, cap);
              break;
            case "Shield":
              item = rollShield(shieldList, shieldQualities, origin, cap);
              break;
            case "Accessory":
              item = rollAccessory(accessoryList, accessoryQualities, origin, cap);
              break;
            case "Material":
              item = rollMaterial(nature, origin, maxVal, remainingBudget, detailKeywords, originKeywords.material, natureKeywords.material);
              break;
            case "Ingredient":
              item = rollIngredient(nature, origin, remainingBudget, tasteKeywords, natureKeywords.ingredient, originKeywords.ingredient);
              ingredientCount++;
              break;
            case "Currency":
              item = rollCurrency(remainingBudget, maxVal, { roundTo: 10 });
              break;
            case "Custom":
              item = await rollCustom();
              break;
          }

          if (!item || (!ignoreValues && (item.value > remainingBudget || item.value > effectiveMaxVal))) {
            failedAttempts++;
            continue;
          }

          items.push(item);
          if (!ignoreValues) {
            remainingBudget -= item.value;
          }
        }

        if (items.length === 0) {
          ui.notifications.warn(
            game.i18n.localize("LOOKFAR.TreasureRoll.Errors.NoLootGenerated")
          );
          return;
        }

        renderTreasureResultDialog(items, remainingBudget, rerollConfig);
        return;
      }

      // --- Main Dialog Form via template ---
      const content = await renderTemplate(TREASURE_ROLL_TEMPLATE, {});
      const genDialog = new Dialog({
        title: game.i18n.localize("LOOKFAR.TreasureRoll.Dialogs.Generator.Title"),
        content,
        buttons: {
          ok: {
            label: game.i18n.localize("LOOKFAR.TreasureRoll.Dialogs.Generator.Buttons.RollLoot"),
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

      _treasureGenDialog = genDialog;

      // Hook to wire up item count, select-all, and ignoreValues fields for the *generator* dialog
      Hooks.once("renderDialog", (app, html) => {
        if (!html.find || !html.find("#lookfar-treasure-gen").length) return;

        // Item count controls
        const $count = html.find("#itemCount");
        const min = Number($count.attr("min")) || 1;
        const max = Number($count.attr("max")) || 10;

        const clampSet = (val) => {
          const n = parseInt(val, 10);
          const safe = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
          $count.val(safe);
        };

        html.find("#addCount").on("click", (e) => {
          e.preventDefault();
          clampSet(Number($count.val()) + 1);
        });
        html.find("#subCount").on("click", (e) => {
          e.preventDefault();
          clampSet(Number($count.val()) - 1);
        });

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
        const $ignore = html.find("#ignoreValues");
        const $budgetLabel = html.find('label[for="treasureBudget"]');
        const $budgetField = html.find("#treasureBudget");
        const $levelLabel = html.find('label[for="highestPCLevel"]');
        const $levelField = html.find("#highestPCLevel");

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
          setFieldState($levelField, isDisabled);
        };

        toggleDisabled($ignore.is(":checked"));
        $ignore.on("change", (ev) => toggleDisabled(ev.currentTarget.checked));
      });

      genDialog.render(true);

    })();
  });
});
