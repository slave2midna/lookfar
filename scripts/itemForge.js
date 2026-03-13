import { dataLoader } from "./dataLoader.js";

// ---- Data roots -------------------------------------------------------------
// NOTE: equipment.json and qualities.json are mechanics-only now.
// Names/descriptions are in i18n bundle; dataLoader exposes derived, localized views.

// Equipment templates (mechanics-only lists)
const getTemplatesForKind = (kind) => {
    if (kind === "weapon") return dataLoader?.weaponsData?.weaponList ?? [];
    if (kind === "armor") return dataLoader?.armorData?.armorList ?? [];
    if (kind === "shield") return dataLoader?.shieldsData?.shieldList ?? [];
    if (kind === "accessory") return dataLoader?.accessoriesData?.accessoryList ?? [];
    return [];
};

// Qualities (derived localized per-type groups)
const getQualitiesForKind = (kind) => {
    if (kind === "weapon") return dataLoader?.weaponsData?.weaponQualities ?? null;
    if (kind === "armor") return dataLoader?.armorData?.armorQualities ?? null;
    if (kind === "shield") return dataLoader?.shieldsData?.shieldQualities ?? null;
    if (kind === "accessory") return dataLoader?.accessoriesData?.accessoryQualities ?? null;
    return null;
};

// Back-compat roots (older versions may still rely on raw shapes)
const getEquipmentRoot = () => dataLoader?.equipmentData || dataLoader || {};
const getQualitiesRootFallback = () => dataLoader?.qualitiesData || dataLoader?.qualities || null;

// equipment lists (back-compat; not used in the new primary path, but kept safe)
const getWeaponList = d => d?.weapons?.weaponList ?? d?.weaponsData?.weaponList ?? d?.weaponList ?? [];
const getArmorList = d => d?.armor?.armorList ?? d?.armorData?.armorList ?? d?.armorList ?? [];
const getShieldList = d => d?.shields?.shieldList ?? d?.shieldsData?.shieldList ?? d?.shieldList ?? [];
const getAccessoryList = d => d?.accessories?.accessoryList ?? d?.accessoriesData?.accessoryList ?? d?.accessoryList ?? [];

// ---- Localization helpers ---------------------------------------------------

const statLabel = (code) => {
    const normalized = String(code ?? "").toUpperCase();

    const keyMap = {
        MIG: "LOOKFAR.Terms.Attributes.MIG",
        DEX: "LOOKFAR.Terms.Attributes.DEX",
        WLP: "LOOKFAR.Terms.Attributes.WLP",
        INS: "LOOKFAR.Terms.Attributes.INS",
        INIT: "LOOKFAR.Terms.Attributes.INIT",
        MDEF: "LOOKFAR.Terms.Attributes.MDEF",
        DEF: "LOOKFAR.Terms.Attributes.DEF",
        HR: "LOOKFAR.Terms.Attributes.HR"
    };

    return game.i18n.localize(keyMap[normalized]);
};

const martialLabel = (isMartial) =>
    game.i18n.localize(
        isMartial ?
        "LOOKFAR.Terms.Common.Martial" :
        "LOOKFAR.Terms.Common.Non-Martial"
    );

const elementLabel = (val) => {
    const v = String(val ?? "").toLowerCase();
    if (!v) return "";
    const key = `LOOKFAR.Terms.Element.${v.charAt(0).toUpperCase()}${v.slice(1)}`;
    const out = game.i18n.localize(key);
    return out === key ? v : out;
};

const weaponTypeLabel = (val) => {
    const normalized = String(val ?? "").trim().toLowerCase();

    const keyMap = {
        melee: "LOOKFAR.Terms.Common.Melee",
        ranged: "LOOKFAR.Terms.Common.Ranged"
    };

    return game.i18n.localize(keyMap[normalized]);
};

const weaponCategoryLabel = (val) => {
    const normalized = String(val ?? "").trim().toLowerCase();

    const keyMap = {
        arcane: "LOOKFAR.Terms.Category.Arcane",
        bow: "LOOKFAR.Terms.Category.Bow",
        brawling: "LOOKFAR.Terms.Category.Brawling",
        dagger: "LOOKFAR.Terms.Category.Dagger",
        firearm: "LOOKFAR.Terms.Category.Firearm",
        flail: "LOOKFAR.Terms.Category.Flail",
        heavy: "LOOKFAR.Terms.Category.Heavy",
        spear: "LOOKFAR.Terms.Category.Spear",
        sword: "LOOKFAR.Terms.Category.Sword",
        thrown: "LOOKFAR.Terms.Category.Thrown"
    };

    return game.i18n.localize(keyMap[normalized]);
};

const normText = (v) => String(v ?? "").trim().toLowerCase();

const originI18nValueForKey = (originKey) => {
    const k = normText(originKey);
    if (!k) return "";
    const title = k.charAt(0).toUpperCase() + k.slice(1);
    const i18nKey = `LOOKFAR.Terms.Origin.${title}`;
    const out = game.i18n.localize(i18nKey);
    return normText(out === i18nKey ? title : out);
};

const originMatchesRequired = (rawOrigin, requiredKey) => {
    const got = normText(rawOrigin);
    const want = originI18nValueForKey(requiredKey);
    return !!want && got === want;
};

const requireString = (label, v) => {
    const s = (typeof v === "string") ? v.trim() : "";
    if (!s) throw new Error(`Missing required ${label}.`);
    return s;
};

const getLocalizedEquipNameStrict = (kind, id) => {
    const name = dataLoader.getEquipmentName?.(kind, id, null);
    return requireString(`localized equipment name for ${kind}:${id}`, name);
};

const getName = r =>
    r?.name ??
    r?.weaponName ??
    r?.armorName ??
    r?.shieldName ??
    r?.accessoryName ??
    "";

// Resolve template display name from i18n bundle by id (primary).
const getTemplateDisplayName = (kind, r) => {
    const id = r?.id ?? r?._id ?? null;
    if (!id) return "";
    try {
        const name = dataLoader.getEquipmentName?.(kind, id, null);
        if (typeof name === "string" && name.trim().length) return name.trim();

        console.error(`[Item Forger] Missing localized equipment name for ${kind}:${id}`);
        return String(id);
    } catch (e) {
        console.error(`[Item Forger] Equipment name lookup failed for ${kind}:${id}`, e);
        return String(id);
    }
};

const esc = s => {
    try {
        return foundry.utils.escapeHTML(String(s));
    } catch {
        return String(s);
    }
};

const matchesAppliesTo = (q, type) => {
    const at = Array.isArray(q?.appliesTo) ? q.appliesTo : [];
    return at.some(x => String(x).toLowerCase() === String(type).toLowerCase());
};

const qualityDisplayName = (q, type) => {
    if (q?.name) return q.name;

    // Back-compat per-slot shapes
    if (type === "weapon") return q.weaponName ?? q.name ?? "";
    if (type === "armor") return q.armorName ?? q.name ?? "";
    if (type === "shield") return q.shieldName ?? q.name ?? "";
    if (type === "accessory") return q.accessoryName ?? q.name ?? "";
    return q.name ?? "";
};

const qualityDescription = (q) =>
    q?.description ??
    q?.desc ??
    q?.Description ??
    "";

const normHand = (h) => {
    const v = String(h ?? "").trim().toLowerCase();
    if (!v) return null;
    if (v.includes("2") || v.includes("two") || /(^|[^a-z])2h([^a-z]|$)/.test(v)) return "2";
    if (v.includes("1") || v.includes("one") || /(^|[^a-z])1h([^a-z]|$)/.test(v)) return "1";
    if (["twohanded", "two-handed"].some(k => v.includes(k))) return "2";
    if (["onehanded", "one-handed"].some(k => v.includes(k))) return "1";
    return null;
};

// Path to the extracted preview template
const PREVIEW_TEMPLATE_PATH = "modules/lookfar/templates/item-forge-preview.hbs";

// --- Setting Helpers ---------------------------------------------------------

// Item Forge edit mode
const getItemForgeEditMode = () => {
    try {
        return game.settings.get("lookfar", "itemForgeEditMode") || "gmOnly";
    } catch {
        return "gmOnly";
    }
};

// Public mode: collaborative, allows players and GM to control dialog
const isItemForgeSharedMode = () => {
    const mode = getItemForgeEditMode();
    return mode === "public" || mode === "locked";
};

// Locked mode: full dialog for players, but controls are read-only
const isItemForgeLockedMode = () => getItemForgeEditMode() === "locked";

// Hidden mode: players should see no button and no dialogs at all
const isItemForgeHiddenMode = () => getItemForgeEditMode() === "hidden";

// Playtest damage rules
const useVariantDamageRules = () => {
    try {
        return !!game.settings.get("lookfar", "useVariantDamageRules");
    } catch {
        return false;
    }
};

// --- FU Socket Helpers -------------------------------------------------------

// Message names (unique within FU socket handler)
const IF_MSG = {
    HostOpen: "lookfar:itemforge:host-open",
    HostClose: "lookfar:itemforge:host-close",
    MaterialsRequest: "lookfar:itemforge:materials-request",
    MaterialsReplace: "lookfar:itemforge:materials-replace",
    MaterialsAdd: "lookfar:itemforge:materials-add",
    MaterialsRemove: "lookfar:itemforge:materials-remove",
    MaterialsNotify: "lookfar:itemforge:materials-notify",
    UIStateReplace: "lookfar:itemforge:ui-state-replace"
};

let _forgeAppId = null;
let _miniAppId = null;
let _forgeDialog = null;
let _miniDialog = null;
let _hostId = null;
let _materials = [];
let _socketInit = false;
let _requiredOriginKey = "";

function isForgeOpen() {
    return !!(_forgeDialog?.rendered);
}

function isMiniOpen() {
    return !!(_miniDialog?.rendered);
}

function ensureIFSocket() {
    if (_socketInit) return;
    _socketInit = true;

    const sock = game.projectfu?.socket;
    if (!sock) {
        console.warn("[Item Forger] FU socket helper not found; collaboration disabled.");
        return;
    }

    // warning notifier so the host can ping specific clients
    sock.register(IF_MSG.MaterialsNotify, (payload) => {
        const text = payload?.text;
        if (text) ui.notifications?.warn(text);
    });

    // A GM has opened the full forge dialog and is now the host
    sock.register(IF_MSG.HostOpen, (payload) => {
        _hostId = payload?.hostId ?? null;
        if (game.user.isGM && game.user.id === _hostId) {
            sock.executeForEveryone(
                IF_MSG.MaterialsReplace, {
                    materials: _materials,
                    originReq: _requiredOriginKey
                }
            );
        }
    });

    // Host is closing
    sock.register(IF_MSG.HostClose, (payload) => {
        if (_hostId === (payload?.hostId ?? null)) _hostId = null;
    });

    // A client (mini or fresh joiner) asks the host for the latest materials
    sock.register(IF_MSG.MaterialsRequest, (_payload, msg) => {
        if (game.user.isGM && game.user.id === _hostId) {
            sock.executeForUsers(
                IF_MSG.MaterialsReplace,
                [msg.sender], {
                    materials: _materials,
                    originReq: _requiredOriginKey
                }
            );
        }
    });

    // Everyone: receive authoritative materials
    sock.register(IF_MSG.MaterialsReplace, (payload) => {
        _materials = Array.isArray(payload?.materials) ? payload.materials.slice(0, 5) : [];
        _requiredOriginKey = String(payload?.originReq || "").trim().toLowerCase();

        try {
            for (const app of Object.values(ui.windows)) {
                const $root = $(app?.element);
                if (!$root?.length) continue;

                const $drop = $root.find("#materialsDrop");
                if (!$drop.length) continue;

                $root.data("ifMaterials", _materials);
                $root.data("ifRequiredOriginKey", _requiredOriginKey);
                $drop.trigger("repaint");
            }

            if (_forgeDialog?.element) {
                const $root = $(_forgeDialog.element);
                const $drop = $root.find("#materialsDrop");
                if ($drop.length) {
                    $root.data("ifMaterials", _materials);
                    $root.data("ifRequiredOriginKey", _requiredOriginKey);
                    $drop.trigger("repaint");
                }
            }

            if (_miniDialog?.element) {
                const $root = $(_miniDialog.element);
                const $drop = $root.find("#materialsDrop");
                if ($drop.length) {
                    $root.data("ifMaterials", _materials);
                    $root.data("ifRequiredOriginKey", _requiredOriginKey);
                    $drop.trigger("repaint");
                }
            }
        } catch (e) {
            console.warn("[Item Forger] MaterialsReplace repaint failed:", e);
        }
    });

    // Player proposes ADD (host validates → updates → broadcasts)
    sock.register(IF_MSG.MaterialsAdd, async (payload, msg) => {
        if (!(game.user.isGM && game.user.id === _hostId)) return;

        const warnUser = (textKey, data = {}) => {
            const text = Object.keys(data).length ?
                game.i18n.format(textKey, data) :
                game.i18n.localize(textKey);
            const targetId = msg?.sender;
            if (targetId && game.projectfu?.socket) {
                game.projectfu.socket.executeForUsers(IF_MSG.MaterialsNotify, [targetId], {
                    text
                });
            } else {
                ui.notifications?.warn(text);
            }
        };

        try {
            const { uuid } = payload ?? {};
            if (!uuid) return;
            if (_materials.length >= 5) return;

            const doc = await fromUuid(uuid);
            if (!doc || doc.documentName !== "Item") return;
            if (String(doc.type) !== "treasure") return;

            const qty = Number(doc.system?.quantity?.value ?? 0) || 0;
            if (qty <= 0) {
                warnUser("LOOKFAR.ItemForge.Errors.NoMoreItem");
                return;
            }

            const alreadyUsed = _materials.filter(m => m.uuid === uuid).length;
            if (alreadyUsed >= qty) {
                warnUser("LOOKFAR.ItemForge.Errors.NoMoreItem");
                return;
            }

            const entry = {
                uuid,
                img: (doc.img || doc?.texture?.src || doc?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg"),
                name: doc.name,
                cost: getTreasureCost(doc),
                origin: getTreasureOrigin(doc),
                quantity: qty
            };

            _materials = [..._materials, entry].slice(0, 5);
            sock.executeForEveryone(
                IF_MSG.MaterialsReplace, {
                    materials: _materials,
                    originReq: _requiredOriginKey
                }
            );
        } catch (e) {
            console.error("[Item Forger] MaterialsAdd failed:", e);
        }
    });

    // Player proposes REMOVE by index or uuid (host validates → updates → broadcasts)
    sock.register(IF_MSG.MaterialsRemove, (payload) => {
        if (!(game.user.isGM && game.user.id === _hostId)) return;
        const { index, uuid } = payload ?? {};
        if (!Array.isArray(_materials) || !_materials.length) return;

        let newList = _materials;
        if (Number.isInteger(index)) {
            newList = _materials.filter((_m, i) => i !== index);
        } else if (uuid) {
            newList = _materials.filter(m => m.uuid !== uuid);
        }
        _materials = newList;
        sock.executeForEveryone(
            IF_MSG.MaterialsReplace, {
                materials: _materials,
                originReq: _requiredOriginKey
            }
        );
    });

    // UI state replace (item type, template, qualities, toggles, etc.)
    sock.register(IF_MSG.UIStateReplace, (payload) => {
        if (!isItemForgeSharedMode()) return;
        const state = payload?.state;
        if (!state) return;

        try {
            for (const app of Object.values(ui.windows)) {
                if (typeof app?._applyForgeStateFromSocket === "function") {
                    app._applyForgeStateFromSocket(state);
                }
            }

            if (typeof _forgeDialog?._applyForgeStateFromSocket === "function") {
                _forgeDialog._applyForgeStateFromSocket(state);
            }
        } catch (e) {
            console.warn("[Item Forger] UIStateReplace apply failed:", e);
        }
    });
}

// --- Cost Helpers ------------------------------------------------------------

const asAttrKey = (s) => {
    const v = String(s ?? "").toLowerCase();
    return (v === "mig" || v === "dex" || v === "ins" || v === "wlp") ? v : "";
};

const toInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

// resolve equipment.json cost value
const getEquipCost = (r) =>
    toInt(r?.cost ?? r?.value ?? r?.data?.cost ?? r?.data?.cost?.value ?? 0);

// resolve qualities cost value
const getQualityCost = (q) => toInt(q?.cost ?? q?.value ?? 0);

// resolve material item cost value
const getTreasureCost = (doc) =>
    toInt(doc?.system?.cost?.value ?? doc?.system?.value ?? doc?.system?.cost ?? doc?.cost ?? 0);

// resolve material origin value
const getTreasureOrigin = (doc) =>
    String(doc?.system?.origin?.value ?? "").trim();

const getCurrencyName = () =>
    game.settings.get("projectfu", "optionRenameCurrency") ||
    game.i18n.localize("LOOKFAR.Terms.Common.Zenit");

// resolve origin requirement for specific quality
const getRequiredOriginKey = (html) => {
    const key = String(html.find("#qualitiesCategory").val() || "none").toLowerCase();
    return (key === "none" || key === "basic" || key === "custom") ? "" : key;
};

// --- Item Helpers ------------------------------------------------------------

const readCustomQuality = (html) => {
    const eff = String(html.find("#customEffect").val() ?? html.data("customEffect") ?? "").trim();
    const raw = String(html.find("#customCost").val() ?? html.data("customCost") ?? "");
    const cost = Math.max(0, parseInt(raw.replace(/\D+/g, ""), 10) || 0);
    return { eff, cost };
};

const getSelectedBase = (html, currentTemplates) => {
    const $sel = html.find("#templateList [data-selected='1']").first();
    const idx = Number($sel.data("idx"));
    return Number.isFinite(idx) ? currentTemplates[idx] : null;
};

const getSelectedQualityInfo = (html, currentQualities) => {
    const catKey = String(html.find("#qualitiesCategory").val() || "none").toLowerCase();
    if (catKey === "custom") {
        const { eff, cost } = readCustomQuality(html);
        return { desc: eff || "", cost };
    }
    if (catKey === "none" || !currentQualities?.length) {
        return { desc: "", cost: 0 };
    }
    const $q = html.find("#qualitiesStandardBlock [data-selected='1']").first();
    const qi = Number($q.data("idx"));
    const q = Number.isFinite(qi) ? currentQualities[qi] : null;
    return {
        desc: q?.description ?? q?.desc ?? "",
        cost: getQualityCost(q)
    };
};

const getPreviewIcon = (html, fallback) => {
    const override = html.data("iconOverride");
    if (override) return override;
    const src = html.find("#if-preview-icon").attr("src");
    return src || fallback || "icons/svg/mystery-man.svg";
};

const validateMaterialsOrigin = (html, materials) => {
    const needKey = getRequiredOriginKey(html);
    if (!needKey) return true;
    const ok = materials.some(m => originMatchesRequired(m?.origin, needKey));
    if (!ok) {
        ui.notifications?.warn(
            game.i18n.format("LOOKFAR.ItemForge.Dialogs.ItemForge.Materials.RequireOriginHint", {
                origin: originI18nValueForKey(needKey) || needKey
            })
        );
    }
    return ok;
};

const getCurrentCosts = (html, tmpl, currentQualities) => {
    const base = getEquipCost(tmpl);

    const catKey = String(html.find("#qualitiesCategory").val() || "none").toLowerCase();
    let qcost = 0;
    if (catKey === "custom") {
        const { cost } = readCustomQuality(html);
        qcost = toInt(cost);
    } else if (catKey !== "none") {
        const $q = html.find("#qualitiesStandardBlock [data-selected='1']").first();
        const qi = Number($q.data("idx"));
        const qual = Number.isFinite(qi) ? currentQualities[qi] : null;
        qcost = getQualityCost(qual);
    }

    const kind = html.find("input[name='itemType']:checked").val();
    let custom = 0;
    if (kind === "weapon") {
        const plus1 = html.find("#optPlusOne").is(":checked");
        const plus4 = html.find("#optPlusDamage").is(":checked");
        const eleSel = (html.find("#optElement").val() || "physical").toString();
        if (plus1) custom += 100;
        if (plus4) custom += 200;
        if (eleSel !== "physical") custom += 100;

        const baseA = String(tmpl?.attrA ?? "").toUpperCase();
        const baseB = String(tmpl?.attrB ?? "").toUpperCase();
        const selA = String(html.find("#optAttrA").val() || baseA).toUpperCase();
        const selB = String(html.find("#optAttrB").val() || baseB).toUpperCase();
        const isMatchingNow = selA && selB && (selA === selB);
        const sameAsOriginalPair = (selA === baseA) && (selB === baseB);
        if (isMatchingNow && !sameAsOriginalPair) custom += 50;
    }

    const materials = html.data("ifMaterials") || [];
    const matTotal = materials.reduce((s, m) => s + toInt(m.cost), 0);

    const worth = Math.max(0, base + qcost + custom);
    let craft = Math.max(0, worth - matTotal);

    const noFee = html.find("#optFee").is(":checked");
    if (!noFee) {
        craft = Math.floor(craft * 1.10);
    }

    return { worth, craft };
};

const getVariantDamageBonus = (worth) => {
    if (!useVariantDamageRules()) return 0;
    const tier = Math.floor(toInt(worth) / 1000);
    return tier > 0 ? tier * 2 : 0;
};

const computeWeaponStats = (base, html, worthOverride) => {
    const variant = useVariantDamageRules();

    const baseHand = normHand(base?.hand) || null;
    const plus1 = html.find("#optPlusOne").is(":checked");
    const plus4 = html.find("#optPlusDamage").is(":checked");
    const flip = html.find("#optToggleHand").is(":checked");
    const selA = String(html.find("#optAttrA").val() || base?.attrA || "").toUpperCase();
    const selB = String(html.find("#optAttrB").val() || base?.attrB || "").toUpperCase();
    const elementVal = (html.find("#optElement").val() || base?.element || "physical").toString();

    let handsOut = base?.hand || "";
    if (flip && (baseHand === "1" || baseHand === "2")) {
        handsOut = (baseHand === "1") ? "two-handed" : "one-handed";
    }

    const handMod = (flip && baseHand === "2") ? -4 :
        (flip && baseHand === "1") ? +4 :
        0;

    const accOut = (Number(base?.accuracy ?? base?.acc ?? 0) || 0) + (plus1 ? 1 : 0);

    let dmgOut = (Number(base?.damage ?? base?.dmg ?? 0) || 0) +
        (plus4 ? 4 : 0) +
        handMod;

    if (variant) {
        const worthVal = toInt(worthOverride);
        dmgOut += getVariantDamageBonus(worthVal);
    }

    const isMartialEffective = variant ?
        !!base?.isMartial :
        ((Number.isFinite(dmgOut) && dmgOut >= 10) || !!base?.isMartial);

    return {
        hands: handsOut,
        attrs: { A: selA, B: selB },
        acc: accOut,
        dmg: dmgOut,
        dmgType: elementVal,
        isMartial: isMartialEffective
    };
};

const buildItemData = (kind, html, {
    currentTemplates,
    currentQualities
}) => {
    const base = getSelectedBase(html, currentTemplates);
    if (!base) throw new Error(game.i18n.localize("LOOKFAR.ItemForge.Errors.NoTemplateSelected"));

    const { desc: qualDesc } = getSelectedQualityInfo(html, currentQualities);
    const img = getPreviewIcon(html, dataLoader.getRandomIconFor(kind, base));
    const $t = html.find("#templateList [data-selected='1']").first();
    const ti = Number($t.data("idx"));
    const tmpl = Number.isFinite(ti) ? currentTemplates[ti] : null;
    const { worth } = getCurrentCosts(html, tmpl, currentQualities);
    const costField = worth;

    if (kind === "weapon") {
        const baseId = requireString("weapon template id", base?.id);
        const typeName = getLocalizedEquipNameStrict("weapon", baseId);

        const w = computeWeaponStats(base, html, worth);
        return {
            name: game.i18n.format("LOOKFAR.ItemForge.Sheets.NamePattern.Weapon", { type: typeName }),
            type: "weapon",
            img,
            system: {
                category: { value: base?.category ?? "" },
                hands: { value: w.hands || "" },
                type: { value: base?.type ?? "" },
                attributes: {
                    primary: { value: asAttrKey(w.attrs.A) },
                    secondary: { value: asAttrKey(w.attrs.B) }
                },
                accuracy: { value: w.acc },
                defense: "def",
                damageType: { value: w.dmgType || (base?.element ?? "physical") },
                damage: { value: w.dmg },
                isMartial: { value: !!w.isMartial },
                quality: { value: qualDesc || "" },
                cost: { value: costField },
                source: { value: "LOOKFAR" },
                summary: {
                    value: game.i18n.format("LOOKFAR.ItemForge.Sheets.Summaries.Weapon", {
                        category: weaponCategoryLabel(base?.category ?? "")
                    })
                }
            }
        };
    }

    if (kind === "armor") {
        const baseId = requireString("armor template id", base?.id);
        const typeName = getLocalizedEquipNameStrict("armor", baseId);

        return {
            name: game.i18n.format("LOOKFAR.ItemForge.Sheets.NamePattern.Armor", { type: typeName }),
            type: "armor",
            img,
            system: {
                def: {
                    attribute: asAttrKey(base?.defAttr || "dex"),
                    value: Number(base?.def ?? 0) || 0
                },
                mdef: {
                    attribute: asAttrKey(base?.mdefAttr || "ins"),
                    value: Number(base?.mdef ?? 0) || 0
                },
                init: { value: Number(base?.init ?? 0) || 0 },
                isMartial: { value: !!base?.isMartial },
                quality: { value: qualDesc || "" },
                cost: { value: costField },
                source: "LOOKFAR",
                summary: {
                    value: game.i18n.format("LOOKFAR.ItemForge.Sheets.Summaries.Armor", {
                        martialType: martialLabel(!!base?.isMartial)
                    })
                }
            }
        };
    }

    if (kind === "shield") {
        const baseId = requireString("shield template id", base?.id);
        const typeName = getLocalizedEquipNameStrict("shield", baseId);

        return {
            name: game.i18n.format("LOOKFAR.ItemForge.Sheets.NamePattern.Shield", { type: typeName }),
            type: "shield",
            img,
            system: {
                def: {
                    attribute: asAttrKey(base?.defAttr || "dex"),
                    value: Number(base?.def ?? 0) || 0
                },
                mdef: {
                    attribute: asAttrKey(base?.mdefAttr || "ins"),
                    value: Number(base?.mdef ?? 0) || 0
                },
                init: { value: Number(base?.init ?? 0) || 0 },
                isMartial: { value: !!base?.isMartial },
                quality: { value: qualDesc || "" },
                cost: { value: costField },
                source: { value: "LOOKFAR" },
                summary: {
                    value: game.i18n.format("LOOKFAR.ItemForge.Sheets.Summaries.Shield", {
                        martialType: martialLabel(!!base?.isMartial)
                    })
                }
            }
        };
    }

    const baseId = requireString("accessory template id", base?.id);
    const typeName = getLocalizedEquipNameStrict("accessory", baseId);

    return {
        name: game.i18n.format("LOOKFAR.ItemForge.Sheets.NamePattern.Accessory", { type: typeName }),
        type: "accessory",
        img,
        system: {
            def: { value: Number(base?.def ?? 0) || 0 },
            mdef: { value: Number(base?.mdef ?? 0) || 0 },
            init: { value: Number(base?.init ?? 0) || 0 },
            quality: { value: qualDesc || "" },
            cost: { value: costField },
            source: { value: "LOOKFAR" },
            summary: {
                value: game.i18n.format("LOOKFAR.ItemForge.Sheets.Summaries.Accessory", {})
            }
        }
    };
};

// --- Dialog Behavior ---------------------------------------------------------

async function initializeMaterialsMiniDialog(dialog) {
    const html = $(dialog.element);
    if (!html.find("#materialsDrop").length) return;

    const appId = Number(html.closest(".application").attr("data-appid"));
    _miniAppId = Number.isFinite(appId) ? appId : null;
    _miniDialog = dialog;

    const sock = game.projectfu?.socket;
    html.data("ifMaterials", _materials || []);
    html.data("ifRequiredOriginKey", _requiredOriginKey || "");

    const $dlg = html.closest(".application");
    $dlg.css({ width: "420px" });

    const $materialsDrop = html.find("#materialsDrop");
    const $materialsHint = html.find("#materialsHint");

    const relayout = () => {
        if (typeof dialog.setPosition === "function") {
            dialog.setPosition({ height: "auto" });
            setTimeout(() => dialog.setPosition({ height: "auto" }), 0);
        }
    };

    const renderMaterialsMini = () => {
        const list = html.data("ifMaterials") || [];
        const needKey = String(html.data("ifRequiredOriginKey") || "").trim();
        const hasReq = !needKey || list.some(m => originMatchesRequired(m?.origin, needKey));

        $materialsDrop.children("img[data-mat='1']").remove();

        if (!list.length) {
            if (needKey) {
                $materialsHint.text(
                    game.i18n.format("LOOKFAR.ItemForge.Dialogs.ItemForge.Materials.RequireOriginHint", {
                        origin: originI18nValueForKey(needKey) || needKey
                    })
                );
            } else {
                $materialsHint.text(game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.Materials.Hint"));
            }
            $materialsHint.show();
        } else {
            $materialsHint.hide();
            list.forEach((m, i) => {
                const currencyName = getCurrencyName();

                const tip = [
                    m.name || "",
                    m.origin || "",
                    Number.isFinite(m.cost) ? `${m.cost} ${currencyName}` : ""
                ].filter(Boolean).join("\n");

                const tooltipRemove = game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.Materials.Tooltip.RequestRemove");

                const $img = $(`
                  <img data-mat="1" data-index="${i}" src="${esc(m.img)}"
                       title="${esc(tooltipRemove)}\n${esc(tip)}">
                `);

                $img.addClass("lf-if-material-icon");

                $img.on("click", () => {
                    sock?.executeAsGM?.(IF_MSG.MaterialsRemove, { index: i });
                });

                $materialsDrop.append($img);
            });
        }

        $materialsDrop.css({
            borderColor: (!hasReq && needKey) ? "red" : "#999"
        });

        html.find("#materialsDrop").off("repaint").on("repaint", () => {
            html.data("ifMaterials", _materials);
            html.data("ifRequiredOriginKey", _requiredOriginKey);
            renderMaterialsMini();
        });

        relayout();
    };

    $materialsDrop
        .on("dragover", (ev) => {
            ev.preventDefault();
            $materialsDrop.css("background", "rgba(65,105,225,0.08)");
        })
        .on("dragleave", () => $materialsDrop.css("background", ""))
        .on("drop", async (ev) => {
            ev.preventDefault();
            $materialsDrop.css("background", "");
            const dt = ev.originalEvent?.dataTransfer;
            if (!dt) return;
            const raw = dt.getData("text/plain");
            if (!raw) return;
            try {
                const data = JSON.parse(raw);
                if (!data?.uuid) return;
                sock?.executeAsGM?.(IF_MSG.MaterialsAdd, { uuid: data.uuid });
            } catch (e) {
                console.error("[Item Forger] Mini drop parse failed:", e);
            }
        });

    if (_hostId) {
        sock?.executeAsUser?.(IF_MSG.MaterialsRequest, _hostId, {});
    } else if (game.users.activeGM?.id) {
        sock?.executeAsUser?.(IF_MSG.MaterialsRequest, game.users.activeGM.id, {});
    }

    renderMaterialsMini();
    relayout();
}

// Mini Materials Dialog (players & observers) uses item-forge-mini.hbs
async function openMaterialsMiniDialog() {
    ensureIFSocket();

    if (isMiniOpen()) {
        _miniDialog?.bringToFront?.();
        return;
    }

    const content = await renderTemplate(
        "modules/lookfar/templates/item-forge-mini.hbs", {}
    );

    const dlg = new foundry.applications.api.DialogV2({
        window: {
            title: game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.MiniTitle"),
            resizable: false
        },
        content,
        buttons: []
    });

    dlg.addEventListener("close", () => {
        _miniAppId = null;
        if (_miniDialog === dlg) _miniDialog = null;
    });

    await dlg.render({ force: true });
    await initializeMaterialsMiniDialog(dlg);
}

async function initializeItemForgeDialog(dialog, {
    equipmentRoot,
    qualitiesRootFallback,
    state
}) {
    const html = $(dialog.element);
    if (!html.find("#if-body").length && !html.find("#templateList").length) return;

    const appId = Number(html.closest(".application").attr("data-appid"));
    _forgeAppId = Number.isFinite(appId) ? appId : null;
    _forgeDialog = dialog;

    const sock = game.projectfu?.socket;

    if (game.user.isGM) {
        _hostId = game.user.id;
        html.data("ifMaterials", _materials);
        sock?.executeForEveryone?.(IF_MSG.HostOpen, { hostId: game.user.id });
        sock?.executeForEveryone?.(IF_MSG.MaterialsReplace, {
            materials: _materials,
            originReq: _requiredOriginKey
        });
    } else {
        html.data("ifMaterials", _materials);
    }

    const $dlg = html.closest(".application");
    const $wc = $dlg.find(".window-content");
    $wc.css({
        display: "block",
        overflow: "visible"
    });
    $dlg.css({
        width: "700px"
    });

    const setForgeEnabled = (enabled) => {
        const $btn = $dlg.find('button[data-action="forge"]');
        if (!$btn.length) return;
        $btn.prop("disabled", !enabled);
        $btn.css({
            opacity: enabled ? 1 : 0.5,
            filter: enabled ? "" : "grayscale(1)"
        });
    };

    const relayout = () => {
        if (typeof dialog.setPosition === "function") {
            dialog.setPosition({ height: "auto" });
            setTimeout(() => dialog.setPosition({ height: "auto" }), 0);
        }
    };
    relayout();

    const $templateList = html.find("#templateList");
    const $qualitiesSelect = html.find("#qualitiesCategory");
    const $materialsDrop = html.find("#materialsDrop");
    const $materialsHint = html.find("#materialsHint");
    const $preview = html.find("#itemPreviewLarge");

    const $attrRow = html.find("#attrRow");
    const $weaponCustomize = html.find("#weaponCustomize");
    const $noCustomize = html.find("#noCustomize");

    if (!game.user.isGM) {
        html.find("#optFee").closest("label").hide();
    }

    const lockControlsForPlayer = !game.user.isGM && isItemForgeLockedMode();
    const restrictInputs = isItemForgeLockedMode();
    const isHostGM = game.user.isGM && game.user.id === _hostId;

    const applyLockState = () => {
        if (!lockControlsForPlayer) return;

        html.find("input[name='itemType']").prop("disabled", true);

        html
            .find("#optAttrA, #optAttrB, #optPlusOne, #optPlusDamage, #optToggleHand, #optElement, #optFee")
            .prop("disabled", true);

        html.find("#qualitiesCategory").prop("disabled", true);
        html.find("#customEffect, #customCost, #customApply").prop("disabled", true);
    };

    applyLockState();

    let suppressStateBroadcast = false;

    const collectForgeState = () => {
        const kind = html.find("input[name='itemType']:checked").val() || "weapon";

        const $t = html.find("#templateList [data-selected='1']").first();
        const tIdxRaw = Number($t.data("idx"));
        const templateIdx = Number.isFinite(tIdxRaw) ? tIdxRaw : null;

        const catKey = String($qualitiesSelect.val() || "none").toLowerCase();
        let qualityIdx = null;
        if (catKey !== "none" && catKey !== "custom") {
            const $q = html.find("#qualitiesStandardBlock [data-selected='1']").first();
            const qIdxRaw = Number($q.data("idx"));
            qualityIdx = Number.isFinite(qIdxRaw) ? qIdxRaw : null;
        }

        const plusOne = html.find("#optPlusOne").is(":checked");
        const plusDamage = html.find("#optPlusDamage").is(":checked");
        const toggleHand = html.find("#optToggleHand").is(":checked");
        const element = (html.find("#optElement").val() || "physical").toString();
        const attrA = (html.find("#optAttrA").val() || "").toString();
        const attrB = (html.find("#optAttrB").val() || "").toString();
        const fee = html.find("#optFee").is(":checked");

        const $customEffect = html.find("#customEffect");
        const $customCost = html.find("#customCost");
        const customEffect = $customEffect.length ?
            String($customEffect.val() ?? "").trim() :
            String(html.data("customEffect") ?? "").trim();
        const customCost = $customCost.length ?
            toInt($customCost.val()) :
            toInt(html.data("customCost") ?? 0);

        const previewSrc = html.find("#if-preview-icon").attr("src") || "";
        const iconPath = html.data("iconPath") || previewSrc || "";

        return {
            kind,
            templateIdx,
            qualitiesCategory: catKey,
            qualityIdx,
            plusOne,
            plusDamage,
            toggleHand,
            element,
            attrA,
            attrB,
            fee,
            customEffect,
            customCost,
            iconPath
        };
    };

    const broadcastForgeState = () => {
        if (!isItemForgeSharedMode()) return;
        if (suppressStateBroadcast) return;
        if (restrictInputs && !isHostGM) return;

        const sock = game.projectfu?.socket;
        if (!sock) return;

        const forgeState = collectForgeState();
        sock.executeForEveryone(IF_MSG.UIStateReplace, { state: forgeState });
    };

    function updateCost() {
        const $val = html.find("#costValue");
        const $t = html.find("#templateList [data-selected='1']").first();
        const ti = Number($t.data("idx"));
        const tmpl = Number.isFinite(ti) ? state.currentTemplates[ti] : null;
        const { craft } = getCurrentCosts(html, tmpl, state.currentQualities);
        $val.text(craft);
    }

    const getNameSafe = (kind, r) => esc(getTemplateDisplayName(kind, r));

    const applyAttrDefaultsFromTemplate = (selectedEl) => {
        const kind = html.find("input[name='itemType']:checked").val();
        if (kind !== "weapon") return;

        const $sel = selectedEl ?
            $(selectedEl) :
            html.find("#templateList [data-selected='1']").first();
        const idx = Number($sel.data("idx"));
        const base = Number.isFinite(idx) ? state.currentTemplates[idx] : null;

        const $a = html.find("#optAttrA");
        const $b = html.find("#optAttrB");
        if (!$a.length || !$b.length) return;

        const allowed = new Set(["MIG", "DEX", "INS", "WLP"]);
        const a = String(base?.attrA ?? "").toUpperCase();
        const b = String(base?.attrB ?? "").toUpperCase();

        if (allowed.has(a)) $a.val(a);
        if (allowed.has(b)) $b.val(b);
    };

    const clip = (v, n = 64) => {
        const s = String(v ?? "");
        return s.length > n ? s.slice(0, n - 1) + "…" : s;
    };

    const handLabel = (h) => {
        const one = game.i18n.localize("LOOKFAR.Terms.Common.One-Handed");
        const two = game.i18n.localize("LOOKFAR.Terms.Common.Two-Handed");
        return (h === "1") ? one :
            (h === "2") ? two :
            String(h || "");
    };

    function renderPreview(kind, selectedEl, opts = {}) {
        const rerollIcon = !!opts.rerollIcon;

        let iconMap = html.data("autoIconMap");
        if (!iconMap) {
            iconMap = {};
            html.data("autoIconMap", iconMap);
        }

        const override = html.data("iconOverride");
        const savedPath = html.data("iconPath");

        const getKindIcon = (k) => ({
            weapon: "icons/svg/sword.svg",
            shield: "icons/svg/shield.svg",
            armor: "icons/svg/statue.svg",
            accessory: "icons/svg/stoned.svg"
        } [k] || "icons/svg/mystery-man.svg");

        const $sel = selectedEl ?
            $(selectedEl) :
            html.find("#templateList [data-selected='1']").first();
        const idx = Number($sel.data("idx"));
        const base = Number.isFinite(idx) ? state.currentTemplates[idx] : null;
        const baseId = base?.id ?? base?._id ?? getName(base);
        const cacheKey = `${kind}:${String(baseId)}`;

        let icon = getKindIcon(kind);

        if (override) {
            icon = override;
            html.data("iconPath", icon);
        } else if (savedPath) {
            icon = savedPath;
        } else if (base && (!restrictInputs || isHostGM)) {
            if (!rerollIcon && iconMap[cacheKey]) {
                icon = iconMap[cacheKey];
            } else {
                try {
                    const pick = dataLoader.getRandomIconFor(kind, base);
                    icon = pick || icon;
                } catch (e) {
                    console.warn("[Item Forger] preview icon pick failed:", e);
                }
                iconMap[cacheKey] = icon;
            }
            html.data("iconPath", icon);
        }

        try {
            const dir = String(icon || "").includes("/") ?
                String(icon).replace(/\/[^/]*$/, "/") :
                "/";
            html.data("lastIconDir", dir);
        } catch {}

        const qdesc = () => {
            const catKeyNow = String($qualitiesSelect.val() || "none").toLowerCase();
            if (catKeyNow === "custom") {
                return readCustomQuality(html).eff;
            }
            const $qsel = html.find("#qualitiesStandardBlock [data-selected='1']").first();
            const qIdx = Number($qsel.data("idx"));
            const q = Number.isFinite(qIdx) ? state.currentQualities[qIdx] : null;
            return q?.description ?? q?.desc ?? "";
        };

        const kindNow = html.find("input[name='itemType']:checked").val();

        const ctx = {
            kind,
            icon,
            isMartial: false,
            rows: [],
            desc: ""
        };

        const renderCtx = (context) => {
            return renderTemplate(PREVIEW_TEMPLATE_PATH, context)
                .then(htmlStr => {
                    $preview.html(htmlStr);
                })
                .catch(e => {
                    console.error("[Item Forger] Failed to render preview template:", e);
                    $preview.empty();
                });
        };

        if (kindNow !== kind) return;

        if (kind === "armor") {
            const $sel2 = selectedEl ?
                $(selectedEl) :
                html.find("#templateList [data-selected='1']").first();
            const idx2 = Number($sel2.data("idx"));
            const a = Number.isFinite(idx2) ? state.currentTemplates[idx2] : null;

            const isMartial = !!a?.isMartial;
            const defAttr = statLabel((a?.defAttr ?? "").toString().toUpperCase());
            const def = (a?.def ?? "—");
            const mdefAttr = statLabel((a?.mdefAttr ?? "").toString().toUpperCase());
            const mdef = (a?.mdef ?? "—");
            const init = (a?.init ?? "—");

            const defLabel = statLabel("DEF");
            const mdefLabel = statLabel("MDEF");
            const initLabel = statLabel("INIT");

            const rowArmor = !isMartial ?
                `${defLabel}: ${defAttr}+${def} | ${mdefLabel}: ${mdefAttr}+${mdef} | ${initLabel}: ${init}` :
                `${defLabel}: ${def} | ${mdefLabel}: ${mdefAttr}+${mdef} | ${initLabel}: ${init}`;

            ctx.isMartial = isMartial;
            ctx.rows = [esc(clip(rowArmor))];
            ctx.desc = esc(qdesc());

            return renderCtx(ctx);
        }

        if (kind === "shield") {
            const $sel2 = selectedEl ?
                $(selectedEl) :
                html.find("#templateList [data-selected='1']").first();
            const idx2 = Number($sel2.data("idx"));
            const s = Number.isFinite(idx2) ? state.currentTemplates[idx2] : null;

            const isMartial = !!s?.isMartial;
            const def = (s?.def ?? "—");
            const mdef = (s?.mdef ?? "—");

            const defLabel = statLabel("DEF");
            const mdefLabel = statLabel("MDEF");

            const rowShield = `${defLabel}: +${def} | ${mdefLabel}: +${mdef}`;

            ctx.isMartial = isMartial;
            ctx.rows = [esc(clip(rowShield))];
            ctx.desc = esc(qdesc());

            return renderCtx(ctx);
        }

        if (kind === "accessory") {
            ctx.desc = esc(qdesc());
            return renderCtx(ctx);
        }

        if (kind === "weapon") {
            const $sel2 = selectedEl ?
                $(selectedEl) :
                html.find("#templateList [data-selected='1']").first();
            const idx2 = Number($sel2.data("idx"));
            const base2 = Number.isFinite(idx2) ? state.currentTemplates[idx2] : null;

            if (!base2) return;

            const baseHand = normHand(base2?.hand) || null;
            const baseHandText = handLabel(baseHand ?? (base2?.hand ?? "—"));
            const baseType = weaponTypeLabel(base2?.type ?? "");
            const baseCat = weaponCategoryLabel(base2?.category ?? base2?.cat ?? "");

            let worthForPreview = 0;
            try {
                const { worth } = getCurrentCosts(html, base2, state.currentQualities);
                worthForPreview = worth;
            } catch {
                worthForPreview = 0;
            }

            const stats = computeWeaponStats(base2, html, worthForPreview);
            const handNorm = normHand(stats.hands) || baseHand;
            const dispHandText = handLabel(handNorm ?? baseHandText);

            const hrLabel = statLabel("HR");
            const attrALabel = statLabel(stats.attrs.A);
            const attrBLabel = statLabel(stats.attrs.B);

            const row1 = `${dispHandText} • ${baseType} • ${baseCat}`;
            const row2 = `【${attrALabel} + ${attrBLabel}】+${stats.acc} | ${hrLabel}+${stats.dmg} ${elementLabel(stats.dmgType)}`;

            ctx.isMartial = !!stats.isMartial;
            ctx.rows = [esc(clip(row1)), esc(clip(row2))];
            ctx.desc = esc(qdesc());

            return renderCtx(ctx);
        }

        return renderCtx(ctx);
    }

    const wireSelectableList = ($container, itemSel, {
        onSelect,
        initialIndex,
        blockClicks = false
    } = {}) => {
        const $items = $container.find(itemSel);

        const applySelection = (el, triggerCallback = true) => {
            $container.find(itemSel).each(function() {
                this.dataset.selected = "";
                $(this).css({
                    backgroundColor: "",
                    color: ""
                });
            });
            if (!el) return;
            el.dataset.selected = "1";
            $(el).css({
                backgroundColor: "rgba(65,105,225,1)",
                color: "white"
            });
            if (triggerCallback) onSelect?.(el);
        };

        $items
            .on("mouseenter", function() {
                if (this.dataset.selected === "1") return;
                if (blockClicks) return;
                $(this).css({
                    backgroundColor: "rgba(0,0,0,0.08)"
                });
            })
            .on("mouseleave", function() {
                if (this.dataset.selected === "1") return;
                if (blockClicks) return;
                $(this).css({
                    backgroundColor: "",
                    color: ""
                });
            });

        $items.on("click", function(ev) {
            if (blockClicks) {
                ev.preventDefault();
                ev.stopImmediatePropagation?.();
                return;
            }
            applySelection(this, true);
        });

        const $initial = Number.isInteger(initialIndex) ?
            $items.eq(initialIndex) :
            $items.first();
        if ($initial.length) applySelection($initial[0], true);
    };

    const renderMaterials = () => {
        const mats = html.data("ifMaterials") || [];
        const needKey = getRequiredOriginKey(html);
        const hasReq = !needKey || mats.some(m => originMatchesRequired(m?.origin, needKey));

        _requiredOriginKey = needKey;
        html.data("ifRequiredOriginKey", _requiredOriginKey);

        $materialsHint.text(game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.Materials.Hint"));
        $materialsDrop.children("img[data-mat='1']").remove();

        if (!mats.length) {
            if (needKey) {
                $materialsHint.text(
                    game.i18n.format("LOOKFAR.ItemForge.Dialogs.ItemForge.Materials.RequireOriginHint", {
                        origin: originI18nValueForKey(needKey) || needKey
                    })
                );
            }
            $materialsHint.show();
        } else {
            $materialsHint.hide();
            mats.forEach((m, i) => {
                const currencyName = getCurrencyName();
                const removeLabel = game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.Materials.Tooltip.Remove");

                const tip = [
                    m.name || "",
                    m.origin || "",
                    Number.isFinite(m.cost) ? `${m.cost} ${currencyName}` : ""
                ].filter(Boolean).join("\n");

                const $img = $(`
                  <img data-mat="1" data-index="${i}" src="${esc(m.img)}"
                       title="${esc(removeLabel)}\n${esc(tip)}">
                `);
                $img.addClass("lf-if-material-icon");

                $img.on("click", () => {
                    if (!(game.user.isGM && game.user.id === _hostId)) {
                        game.projectfu?.socket?.executeAsGM?.(
                            IF_MSG.MaterialsRemove, { index: i }
                        );
                        return;
                    }

                    _materials = _materials.filter((_m, idx) => idx !== i);
                    html.data("ifMaterials", _materials);
                    game.projectfu?.socket?.executeForEveryone(IF_MSG.MaterialsReplace, {
                        materials: _materials,
                        originReq: _requiredOriginKey
                    });
                });

                $materialsDrop.append($img);
            });
        }

        $materialsDrop.css({
            borderColor: (!hasReq && needKey) ? "red" : "#999"
        });

        setForgeEnabled(hasReq);

        html.find("#materialsDrop").off("repaint").on("repaint", () => {
            html.data("ifMaterials", _materials);
            renderMaterials();
            updateCost();
        });

        relayout();
    };

    $materialsDrop.on("drop", async (ev) => {
        ev.preventDefault();
        $materialsDrop.css("background", "");
        const dt = ev.originalEvent?.dataTransfer;
        if (!dt) return;
        const raw = dt.getData("text/plain");
        if (!raw) return;

        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            console.error("[Item Forger] Drop parse failed (JSON):", e);
            ui.notifications?.error(game.i18n.localize("LOOKFAR.ItemForge.Errors.CouldNotReadDrop"));
            return;
        }
        if (!data?.uuid) return;

        if (!(game.user.isGM && game.user.id === _hostId)) {
            game.projectfu?.socket?.executeAsGM?.(IF_MSG.MaterialsAdd, {
                uuid: data.uuid
            });
            return;
        }

        try {
            const doc = await fromUuid(data.uuid);
            if (!doc || doc.documentName !== "Item") {
                return ui.notifications?.warn(
                    game.i18n.localize("LOOKFAR.ItemForge.Errors.OnlyItems")
                );
            }
            if (String(doc.type) !== "treasure") {
                return ui.notifications?.warn(
                    game.i18n.localize("LOOKFAR.ItemForge.Errors.OnlyTreasure")
                );
            }
            if (_materials.length >= 5) {
                return ui.notifications?.warn(
                    game.i18n.localize("LOOKFAR.ItemForge.Errors.MaxMaterials")
                );
            }

            const qty = Number(doc.system?.quantity?.value ?? 0) || 0;
            if (qty <= 0) {
                return ui.notifications?.warn(
                    game.i18n.localize("LOOKFAR.ItemForge.Errors.NoMoreItem")
                );
            }

            const alreadyUsed = _materials.filter(m => m.uuid === data.uuid).length;
            if (alreadyUsed >= qty) {
                return ui.notifications?.warn(
                    game.i18n.localize("LOOKFAR.ItemForge.Errors.NoMoreItem")
                );
            }

            const entry = {
                uuid: data.uuid,
                img: (doc.img || doc?.texture?.src || doc?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg"),
                name: doc.name,
                cost: getTreasureCost(doc),
                origin: getTreasureOrigin(doc),
                quantity: qty
            };

            _materials = [..._materials, entry].slice(0, 5);
            html.data("ifMaterials", _materials);
            renderMaterials();
            updateCost();

            game.projectfu?.socket?.executeForEveryone(IF_MSG.MaterialsReplace, {
                materials: _materials,
                originReq: _requiredOriginKey
            });
        } catch (e) {
            console.error("[Item Forger] Drop parse failed:", e);
            ui.notifications?.error(game.i18n.localize("LOOKFAR.ItemForge.Errors.CouldNotReadDrop"));
        }
    });

    function renderTemplates(rows, initialIndex = null) {
        state.currentTemplates = Array.isArray(rows) ? rows : [];
        if (!state.currentTemplates.length) {
            $templateList.empty();
            const kind = html.find("input[name='itemType']:checked").val();
            renderPreview(kind, null);
            return;
        }

        const kindNow = html.find("input[name='itemType']:checked").val() || "weapon";

        const items = state.currentTemplates.map((r, i) => `
      <div class="if-template" data-idx="${i}">
        <span class="if-template-label">
          ${getNameSafe(kindNow, r)}
        </span>
      </div>
    `).join("");
        $templateList.html(items);

        wireSelectableList($templateList, ".if-template", {
            initialIndex,
            onSelect: (el) => {
                updateHandToggle(el);
                updatePlusOneToggle(el);
                applyAttrDefaultsFromTemplate(el);
                html.removeData("iconOverride");

                if (!restrictInputs || (game.user.isGM && game.user.id === _hostId)) {
                    html.removeData("iconPath");
                }

                const kind = html.find("input[name='itemType']:checked").val();
                renderPreview(kind, el, { rerollIcon: true });
                updateCost();
                broadcastForgeState();
            },
            blockClicks: lockControlsForPlayer
        });
    }

    const renderQualities = (type, initialIndex = null, incomingState = null) => {
        const $standardBlock = html.find("#qualitiesStandardBlock");
        const $customBlock = html.find("#qualitiesCustomBlock");
        const $customEffect = html.find("#customEffect");
        const $customCost = html.find("#customCost");
        const $customApply = html.find("#customApply");

        const derivedRoot = getQualitiesForKind(type);
        const fallbackRoot = qualitiesRootFallback;

        const catKey = String($qualitiesSelect.val() || "none").toLowerCase();

        if (catKey === "custom") {
            state.currentQualities = [];
            $standardBlock.empty();
            $customBlock.show();

            const effCommitted = incomingState ?
                String(incomingState.customEffect ?? "").trim() :
                String(html.data("customEffect") ?? "").trim();
            const cstCommitted = incomingState ?
                toInt(incomingState.customCost ?? 0) :
                toInt(html.data("customCost") ?? 0);

            html.data("customEffect", effCommitted);
            html.data("customCost", cstCommitted);

            if ($customEffect.length) $customEffect.val(effCommitted);
            if ($customCost.length) $customCost.val(cstCommitted);

            if (lockControlsForPlayer) {
                $customEffect.prop("disabled", true);
                $customCost.prop("disabled", true);
                $customApply.prop("disabled", true);
            } else {
                $customCost
                    .off(".customUX")
                    .on("keydown.customUX", (ev) => {
                        if (ev.key === "Enter") ev.preventDefault();
                    })
                    .on("keypress.customUX", (ev) => {
                        if (ev.key.length === 1 && !/[0-9]/.test(ev.key)) ev.preventDefault();
                    })
                    .on("paste.customUX", (ev) => {
                        ev.preventDefault();
                        const txt = (ev.originalEvent || ev).clipboardData.getData("text") ?? "";
                        const digits = txt.replace(/\D+/g, "");
                        const el = ev.currentTarget;
                        const start = el.selectionStart ?? el.value.length;
                        const end = el.selectionEnd ?? el.value.length;
                        el.value = el.value.slice(0, start) + digits + el.value.slice(end);
                    });

                $customApply
                    .off(".customUX")
                    .on("click.customUX", () => {
                        if (lockControlsForPlayer) return;

                        const eff = String($customEffect.val() ?? "").trim();
                        const raw = String($customCost.val() ?? "");
                        const cst = Math.max(0, parseInt(raw.replace(/\D+/g, ""), 10) || 0);
                        $customCost.val(cst);

                        html.data("customEffect", eff);
                        html.data("customCost", cst);

                        const kindNow = html.find("input[name='itemType']:checked").val();
                        renderPreview(kindNow, html.find("#templateList [data-selected='1']").first());
                        updateCost();
                        broadcastForgeState();
                    });
            }

            const kindNow = html.find("input[name='itemType']:checked").val();
            renderPreview(kindNow, html.find("#templateList [data-selected='1']").first());
            updateCost();
            return;
        }

        $customBlock.hide();
        $standardBlock.show();

        if (catKey === "none") {
            state.currentQualities = [];
            $standardBlock.empty();
            const kindNow = html.find("input[name='itemType']:checked").val();
            renderPreview(kindNow, html.find("#templateList [data-selected='1']").first());
            updateCost();
            return;
        }

        if (derivedRoot && typeof derivedRoot === "object") {
            const catList = Array.isArray(derivedRoot?.[catKey]) ? derivedRoot[catKey] : [];
            state.currentQualities = catList;
        } else if (fallbackRoot && typeof fallbackRoot === "object") {
            const catList = Array.isArray(fallbackRoot?.[catKey]) ? fallbackRoot[catKey] : [];
            state.currentQualities = catList.filter(q => matchesAppliesTo(q, type));
        } else {
            state.currentQualities = [];
        }

        if (!state.currentQualities.length) {
            $standardBlock.empty();
            const kindNow = html.find("input[name='itemType']:checked").val();
            renderPreview(kindNow, html.find("#templateList [data-selected='1']").first());
            updateCost();
            return;
        }

        const items = state.currentQualities.map((q, i) => {
            const desc = esc(qualityDescription(q));

            return `
              <div class="if-quality" data-idx="${i}" title="${desc}">
                <span class="if-quality-label">
                  ${esc(qualityDisplayName(q, type))}
                </span>
              </div>
            `;
        }).join("");
        $standardBlock.html(items);

        wireSelectableList($standardBlock, ".if-quality", {
            initialIndex,
            onSelect: () => {
                const kindNow = html.find("input[name='itemType']:checked").val();
                renderPreview(
                    kindNow,
                    html.find("#templateList [data-selected='1']").first(), {
                        rerollIcon: true
                    }
                );
                updateCost();
                broadcastForgeState();
            },
            blockClicks: lockControlsForPlayer
        });
    };

    function populateTemplates(kind, incomingState = null) {
        let data = getTemplatesForKind(kind);

        if (!Array.isArray(data) || !data.length) {
            data = kind === "armor" ? getArmorList(equipmentRoot) :
                kind === "shield" ? getShieldList(equipmentRoot) :
                kind === "accessory" ? getAccessoryList(equipmentRoot) :
                getWeaponList(equipmentRoot);
        }

        const initialIndex = incomingState && Number.isFinite(incomingState.templateIdx) ?
            incomingState.templateIdx :
            null;

        renderTemplates(data, initialIndex);
    }

    function updateHandToggle(selectedEl) {
        const kind = html.find("input[name='itemType']:checked").val();
        const $wrap = html.find("#handToggleWrap");
        const $labelSpan = html.find("#handToggleLabel");
        const $checkbox = html.find("#optToggleHand");
        if (kind !== "weapon") return $wrap.hide();

        const $sel = selectedEl ?
            $(selectedEl) :
            html.find("#templateList [data-selected='1']").first();
        const idx = Number($sel.data("idx"));
        const base = Number.isFinite(idx) ? state.currentTemplates[idx] : null;

        const h = normHand(base?.hand);
        const cat = String(base?.category ?? base?.cat ?? "").toLowerCase();
        const restricted = new Set(["brawling", "dagger", "thrown"]);

        const setDisabled = (disabled, title = "") => {
            $checkbox.prop("disabled", disabled);
            if (disabled) $checkbox.prop("checked", false);
            $wrap.css({
                opacity: disabled ? 0.5 : 1,
                filter: disabled ? "grayscale(1)" : ""
            });
            if (title) $wrap.attr("title", title);
            else $wrap.removeAttr("title");
        };

        const makeOneHandLabel = game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.Customize.MakeOneHanded");
        const makeTwoHandLabel = game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.Customize.MakeTwoHanded");
        const restrictedLabel = game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.Customize.Tooltip.HandToggleRestricted");

        if (h === "2") {
            $labelSpan.text(makeOneHandLabel);
            $wrap.show();
            setDisabled(false);
        } else if (h === "1") {
            $labelSpan.text(makeTwoHandLabel);
            $wrap.show();
            if (restricted.has(cat)) {
                setDisabled(true, restrictedLabel);
            } else {
                setDisabled(false);
            }
        } else {
            $wrap.hide();
        }
    }

    function updatePlusOneToggle(selectedEl) {
        const kind = html.find("input[name='itemType']:checked").val();
        const $cb = html.find("#optPlusOne");
        const $label = $cb.closest("label");

        const gmOnlyLabel = game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.Customize.Tooltip.GMOnly");
        const alreadyPlusOne = game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.Customize.Tooltip.PlusOneAlready");

        if (!game.user.isGM && lockControlsForPlayer) {
            $cb.prop("disabled", true);
            $label
                .attr("title", gmOnlyLabel)
                .css({
                    opacity: 0.5,
                    filter: "grayscale(1)"
                });
            return;
        }

        if (kind !== "weapon") {
            $cb.prop("disabled", false);
            $label.css({
                opacity: 1,
                filter: ""
            }).attr("title", "");
            return;
        }

        const $sel = selectedEl ?
            $(selectedEl) :
            html.find("#templateList [data-selected='1']").first();
        const idx = Number($sel.data("idx"));
        const base = Number.isFinite(idx) ? state.currentTemplates[idx] : null;

        if (!base) {
            $cb.prop("disabled", false);
            $label.css({
                opacity: 1,
                filter: ""
            }).attr("title", "");
            return;
        }

        const baseAcc = Number(base?.accuracy ?? base?.acc ?? 0) || 0;
        const hasBasePlusOne = baseAcc >= 1;

        if (hasBasePlusOne) {
            $cb.prop("checked", false).prop("disabled", true);
            $label
                .attr("title", alreadyPlusOne)
                .css({
                    opacity: 0.5,
                    filter: "grayscale(1)"
                });
        } else {
            $cb.prop("disabled", false);
            $label
                .attr("title", "")
                .css({
                    opacity: 1,
                    filter: ""
                });
        }
    }

    const updateForKind = (kind, incomingState = null) => {
        const isWeapon = (kind === "weapon");

        $attrRow.toggle(isWeapon);
        $weaponCustomize.toggle(isWeapon);
        $noCustomize.toggle(!isWeapon);

        if (isWeapon) {
            const $pd = html.find("#optPlusDamage");
            const $pdLabel = $pd.closest("label");

            const variantTooltip = game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.Customize.Tooltip.VariantDamageInfo");

            if (useVariantDamageRules()) {
                $pd.prop("checked", false)
                    .prop("disabled", true);
                $pdLabel
                    .attr("title", variantTooltip)
                    .css({
                        opacity: 0.5,
                        filter: "grayscale(1)"
                    });
            } else {
                $pd.prop("disabled", false);
                $pdLabel
                    .attr("title", "")
                    .css({
                        opacity: 1,
                        filter: ""
                    });
            }
        }

        if (incomingState?.qualitiesCategory) {
            $qualitiesSelect.val(incomingState.qualitiesCategory);
        }

        populateTemplates(kind, incomingState);
        renderQualities(kind, incomingState?.qualityIdx ?? null, incomingState);
        renderPreview(kind, null);

        if (isWeapon) {
            updateHandToggle();
            updatePlusOneToggle();
        }

        relayout();
        updateCost();
        applyLockState();
    };

    const refreshPreviewFromUI = () => {
        const kind = html.find("input[name='itemType']:checked").val();
        renderPreview(
            kind,
            html.find("#templateList [data-selected='1']").first(), {
                rerollIcon: false
            }
        );
        updateCost();
        broadcastForgeState();
    };

    const applyForgeState = (incomingState) => {
        if (!incomingState) return;
        suppressStateBroadcast = true;
        try {
            const kind = incomingState.kind || "weapon";

            html.find("input[name='itemType']").prop("checked", false);
            html.find(`input[name='itemType'][value='${kind}']`).prop("checked", true);

            if (incomingState.qualitiesCategory) {
                $qualitiesSelect.val(incomingState.qualitiesCategory);
            }

            if (incomingState.iconPath) {
                html.data("iconPath", incomingState.iconPath);
                if (!game.user.isGM) {
                    html.removeData("iconOverride");
                }
            }

            updateForKind(kind, incomingState);

            html.find("#optPlusOne").prop("checked", !!incomingState.plusOne);

            if (!useVariantDamageRules()) {
                html.find("#optPlusDamage").prop("checked", !!incomingState.plusDamage);
            }

            html.find("#optToggleHand").prop("checked", !!incomingState.toggleHand);
            html.find("#optElement").val(incomingState.element || "physical");
            html.find("#optAttrA").val(incomingState.attrA || "MIG");
            html.find("#optAttrB").val(incomingState.attrB || "MIG");
            html.find("#optFee").prop("checked", !!incomingState.fee);

            if (kind === "weapon") {
                updatePlusOneToggle();
            }
            if (typeof incomingState.customEffect === "string") {
                html.data("customEffect", incomingState.customEffect);
                html.find("#customEffect").val(incomingState.customEffect);
            }
            if (typeof incomingState.customCost !== "undefined") {
                const cst = toInt(incomingState.customCost);
                html.data("customCost", cst);
                html.find("#customCost").val(cst);
            }

            refreshPreviewFromUI();

            if (incomingState.iconPath) {
                html.data("iconPath", incomingState.iconPath);
                try {
                    $preview.find("#if-preview-icon").attr("src", incomingState.iconPath);
                } catch (e) {
                    console.warn("[Item Forger] Failed to apply synced iconPath:", e);
                }
            }

            renderMaterials();

            if (game.user.isGM && game.user.id === _hostId) {
                game.projectfu?.socket?.executeForEveryone(IF_MSG.MaterialsReplace, {
                    materials: _materials,
                    originReq: _requiredOriginKey
                });
            }
        } finally {
            suppressStateBroadcast = false;
        }
    };

    dialog._applyForgeStateFromSocket = (incomingState) => {
        applyForgeState(incomingState);
    };

    html.off("change.ifPrev");
    html.on(
        "change.ifPrev",
        "#optAttrA, #optAttrB, #optPlusOne, #optPlusDamage, #optToggleHand, #optElement, #optFee",
        (ev) => {
            if (lockControlsForPlayer) {
                ev.preventDefault();
                ev.stopImmediatePropagation?.();
                return;
            }
            refreshPreviewFromUI();
        }
    );

    $qualitiesSelect.on("change", () => {
        if (lockControlsForPlayer) return;

        const kind = html.find("input[name='itemType']:checked").val();
        renderQualities(kind);
        renderPreview(
            kind,
            html.find("#templateList [data-selected='1']").first(), {
                rerollIcon: false
            }
        );
        renderMaterials();
        updateCost();

        if (game.user.isGM && game.user.id === _hostId) {
            game.projectfu?.socket?.executeForEveryone(IF_MSG.MaterialsReplace, {
                materials: _materials,
                originReq: _requiredOriginKey
            });
        }
        broadcastForgeState();
    });

    html.off("click.ifIconPick");
    html.on("click.ifIconPick", "#if-preview-icon", async (ev) => {
        if (!game.user.isGM) return;

        ev.preventDefault();
        ev.stopPropagation();
        console.debug("[Item Forger] preview icon clicked");

        const kind = html.find("input[name='itemType']:checked").val();
        const fromOverride = html.data("iconOverride");
        const fromPreview = html.find("#if-preview-icon").attr("src");
        const derivedDir = (fromOverride || fromPreview || "").includes("/") ?
            String(fromOverride || fromPreview).replace(/\/[^/]*$/, "/") :
            "/";
        const startDir = html.data("lastIconDir") || derivedDir || "/";

        try {
            const fp = new FilePicker({
                type: "image",
                current: startDir,
                callback: (path) => {
                    console.debug("[Item Forger] FilePicker selected:", path);
                    html.data("iconOverride", path);
                    try {
                        html.data("lastIconDir", String(path).replace(/\/[^/]*$/, "/"));
                    } catch {}
                    renderPreview(
                        kind,
                        html.find("#templateList [data-selected='1']").first()
                    );
                    broadcastForgeState();
                }
            });
            fp.render(true);
        } catch (err) {
            console.error("[Item Forger] FilePicker error:", err);
            ui.notifications?.error(
                game.i18n.localize("LOOKFAR.ItemForge.Errors.FilePickerOpen")
            );
        }
    });

    html.on("change", "input[name='itemType']", (ev) => {
        if (lockControlsForPlayer) {
            ev.preventDefault();
            return;
        }
        const kind = ev.currentTarget.value;
        html.removeData("iconOverride");
        updateForKind(kind);
        broadcastForgeState();
    });

    updateForKind("weapon");
    renderMaterials();

    if (!(game.user.isGM && game.user.id === _hostId)) {
        const targetHost = _hostId || game.users.activeGM?.id;
        if (targetHost) {
            game.projectfu?.socket?.executeAsUser(
                IF_MSG.MaterialsRequest,
                targetHost, {}
            );
        }
    }

    relayout();
}

// Item Forger Dialog (main) uses item-forge.hbs
async function openItemForgeDialog() {
    ensureIFSocket();

    if (isForgeOpen()) {
        _forgeDialog?.bringToFront?.();
        return;
    }

    const equipmentRoot = getEquipmentRoot();
    const qualitiesRootFallback = getQualitiesRootFallback();

    const state = {
        currentTemplates: [],
        currentQualities: []
    };

    const content = await renderTemplate(
        "modules/lookfar/templates/item-forge.hbs", {}
    );

    const buttons = game.user.isGM ? [{
        action: "forge",
        label: game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.Buttons.Forge"),
        icon: '<i class="fas fa-hammer"></i>',
        default: true,
        callback: async (_event, _button, dlg) => {
            const html = $(dlg.element);
            try {
                const kind = html.find("input[name='itemType']:checked").val();
                const base = getSelectedBase(html, state.currentTemplates);

                const mats = html.data("ifMaterials") || [];
                if (!validateMaterialsOrigin(html, mats)) return false;

                if (game.user.isGM && game.user.id === _hostId && Array.isArray(mats) && mats.length) {
                    const usageByUuid = {};
                    for (const m of mats) {
                        if (!m?.uuid) continue;
                        usageByUuid[m.uuid] = (usageByUuid[m.uuid] || 0) + 1;
                    }

                    for (const [uuid, used] of Object.entries(usageByUuid)) {
                        const doc = await fromUuid(uuid);
                        if (!doc || doc.documentName !== "Item") continue;
                        const currQty = Number(doc.system?.quantity?.value ?? 0) || 0;
                        if (currQty < used) {
                            ui.notifications?.error(
                                game.i18n.format("LOOKFAR.ItemForge.Errors.NotEnoughQuantity", {
                                    name: doc.name,
                                    need: used,
                                    have: currQty
                                })
                            );
                            return false;
                        }
                    }

                    for (const [uuid, used] of Object.entries(usageByUuid)) {
                        const doc = await fromUuid(uuid);
                        if (!doc || doc.documentName !== "Item") continue;
                        const currQty = Number(doc.system?.quantity?.value ?? 0) || 0;
                        const newQty = Math.max(0, currQty - used);
                        await doc.update({
                            "system.quantity.value": newQty
                        });
                    }
                }

                const itemData = buildItemData(kind, html, {
                    currentTemplates: state.currentTemplates,
                    currentQualities: state.currentQualities
                });
                const created = await Item.create(itemData, { renderSheet: true });
                if (!created) throw new Error("Item creation failed.");
                ui.notifications.info(
                    game.i18n.format("LOOKFAR.ItemForge.Chat.Forged", {
                        name: created.name
                    })
                );
            } catch (err) {
                console.error("[Item Forger] Forge failed:", err);
                ui.notifications?.error(
                    game.i18n.format("LOOKFAR.ItemForge.Errors.ForgeFailed", {
                        error: err.message || game.i18n.localize("LOOKFAR.ItemForge.Errors.GenericForgeFailed")
                    })
                );
                return false;
            }
        }
    }] : [];

    const dlg = new foundry.applications.api.DialogV2({
        window: {
            title: game.i18n.localize("LOOKFAR.ItemForge.Dialogs.ItemForge.Title"),
            resizable: false
        },
        content,
        buttons
    });

    dlg.addEventListener("close", async () => {
        try {
            if (game.user.isGM && game.user.id === _hostId) {
                game.projectfu?.socket?.executeForEveryone(
                    IF_MSG.HostClose, { hostId: game.user.id }
                );
            }
        } finally {
            _forgeAppId = null;
            if (_forgeDialog === dlg) _forgeDialog = null;
        }
    });

    await dlg.render({ force: true });
    await initializeItemForgeDialog(dlg, {
        equipmentRoot,
        qualitiesRootFallback,
        state
    });
}

Hooks.on("lookfarShowItemForgeDialog", () => {
    try {
        ensureIFSocket();

        const mode = getItemForgeEditMode();

        if (game.user.isGM) {
            openItemForgeDialog();
            return;
        }

        if (mode === "hidden") {
            return;
        }

        if (mode === "public" || mode === "locked") {
            openItemForgeDialog();
            return;
        }

        if (mode === "gmOnly") {
            openMaterialsMiniDialog();
            return;
        }

    } catch (err) {
        console.error("[Item Forger] failed to open:", err);
    }
});
