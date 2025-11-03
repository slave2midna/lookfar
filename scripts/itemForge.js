import { dataLoader } from "./dataLoader.js";

(function registerItemForge() {

  const getEquipmentRoot = () =>
      dataLoader?.equipmentData || dataLoader || {};

  const getQualitiesRoot = () =>
      dataLoader?.qualitiesData || dataLoader?.qualities || null;

  const getWeaponList    = d => d?.weapons?.weaponList        ?? d?.weaponsData?.weaponList        ?? d?.weaponList        ?? [];
  const getArmorList     = d => d?.armor?.armorList           ?? d?.armorData?.armorList           ?? d?.armorList         ?? [];
  const getShieldList    = d => d?.shields?.shieldList        ?? d?.shieldsData?.shieldList        ?? d?.shieldList        ?? [];
  const getAccessoryList = d => d?.accessories?.accessoryList ?? d?.accessoriesData?.accessoryList ?? d?.accessoryList     ?? [];

  const getName = r => r?.name ?? r?.weaponName ?? r?.armorName ?? r?.shieldName ?? r?.accessoryName ?? "(Unnamed)";
  const esc = s => { try { return foundry.utils.escapeHTML(String(s)); } catch { return String(s); } };

  const matchesAppliesTo = (q, type) => {
    const at = Array.isArray(q?.appliesTo) ? q.appliesTo : [];
    return at.some(x => String(x).toLowerCase() === String(type).toLowerCase());
  };

  const qualityDisplayName = (q, type) => {
    if (type === "weapon")    return q.weaponName    ?? q.name ?? "(Unnamed)";
    if (type === "armor")     return q.armorName     ?? q.name ?? "(Unnamed)";
    if (type === "shield")    return q.shieldName    ?? q.name ?? "(Unnamed)";
    if (type === "accessory") return q.accessoryName ?? q.name ?? "(Unnamed)";
    return q.name ?? "(Unnamed)";
  };

  const normHand = (h) => {
    const v = String(h ?? "").trim().toLowerCase();
    if (!v) return null;
    if (v.includes("2") || v.includes("two") || /(^|[^a-z])2h([^a-z]|$)/.test(v)) return "2";
    if (v.includes("1") || v.includes("one") || /(^|[^a-z])1h([^a-z]|$)/.test(v)) return "1";
    if (["twohanded","two-handed"].some(k=>v.includes(k))) return "2";
    if (["onehanded","one-handed"].some(k=>v.includes(k))) return "1";
    return null;
  };

    // --- Cost helpers ---
  // Map UI/"template" attr tokens to valid schema keys
const asAttrKey = (s) => {
  const v = String(s ?? "").toLowerCase();
  return (v === "mig" || v === "dex" || v === "ins" || v === "wlp") ? v : "";
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

// equipment.json can use cost or value (some schemas embed under data)
const getEquipCost = (r) =>
  toInt(r?.cost ?? r?.value ?? r?.data?.cost ?? r?.data?.cost?.value ?? 0);

// qualities.json uses "cost"
const getQualityCost = (q) => toInt(q?.cost ?? 0);

// ----- Treasure helpers (NEW) -----
const getTreasureCost = (doc) =>
  toInt(doc?.system?.cost?.value ?? doc?.system?.value ?? doc?.system?.cost ?? doc?.cost ?? 0);

const getTreasureOrigin = (doc) => {
  // 1) your canonical field
  let v = doc?.system?.origin?.value;

  // 2) fallbacks (kept just in case some items are older/differently shaped)
  if (v == null || v === "") {
    v = doc?.system?.origin
      ?? doc?.system?.keywords?.origin
      ?? doc?.system?.material?.origin
      ?? doc?.origin
      ?? "";
  }

  // unwrap common shapes (arrays/objects)
  if (Array.isArray(v)) v = v.find(e => e != null) ?? "";
  if (v && typeof v === "object") v = v.key ?? v.id ?? v.type ?? v.name ?? v.value ?? "";

  return String(v).trim().toLowerCase();
};

// Which origin is required by the selected quality category?
const getRequiredOriginKey = (html) => {
  const key = String(html.find('#qualitiesCategory').val() || "none").toLowerCase();
  // No origin requirement for "none", "basic", or "custom"
  return (key === "none" || key === "basic" || key === "custom") ? "" : key;
};

// --- begin forge item helpers ------------------------------------------------------------
  
/** Return the currently selected base template row. */
const getSelectedBase = (html, currentTemplates) => {
  const $sel = html.find('#templateList [data-selected="1"]').first();
  const idx  = Number($sel.data("idx"));
  return Number.isFinite(idx) ? currentTemplates[idx] : null;
};

/** Return { desc, cost } for the currently selected (or custom) quality. */
const getSelectedQualityInfo = (html, currentQualities) => {
  const catKey = String(html.find('#qualitiesCategory').val() || "none").toLowerCase();
  if (catKey === "custom") {
    return {
      desc: String(html.data('customEffect') ?? "").trim() || "No quality",
      cost: Math.max(0, Number(html.data('customCost') ?? 0) || 0)
    };
  }
  if (catKey === "none" || !currentQualities?.length) {
    return { desc: "No quality", cost: 0 };
  }
  const $q = html.find('#qualitiesList [data-selected="1"]').first();
  const qi  = Number($q.data("idx"));
  const q   = Number.isFinite(qi) ? currentQualities[qi] : null;
  return { desc: q?.description ?? q?.desc ?? "No quality", cost: Number(q?.cost ?? 0) || 0 };
};

/** Pull the preview icon currently shown (honors manual override). */
const getPreviewIcon = (html, fallback) => {
  const override = html.data('iconOverride');
  if (override) return override;
  const src = html.find('#if-preview-icon').attr('src');
  return src || fallback || "icons/svg/mystery-man.svg";
};

/** Materials requirement enforcement (category gated). */
const validateMaterialsOrigin = (html, materials) => {
  const needKey = getRequiredOriginKey(html); // "" means none/basic/custom
  if (!needKey) return true;
  const ok = materials.some(m => String(m.origin) === needKey);
  if (!ok) ui.notifications?.warn(`This quality requires at least one ${needKey} material.`);
  return ok;
};

// Cost field asked for "before surcharges": base + quality (no +1/+4/element, no fee, no material)
const getPreSurchargeCost = (baseCost, qualityCost) =>
  Math.max(0, (Number(baseCost) || 0) + (Number(qualityCost) || 0));

/**
 * Compute both "worth" (what the item is valued at) and "craft" (what the crafter pays now).
 * worth = base + quality + weapon surcharges (no materials, no fee)
 * craft = worth - materials (and +10% if Fee? is checked)
 */
const getCurrentCosts = (html, tmpl, currentQualities) => {
  const base = getEquipCost(tmpl);

  // quality cost (handles Custom and None)
  const catKey = String(html.find('#qualitiesCategory').val() || 'none').toLowerCase();
  let qcost = 0;
  if (catKey === 'custom') {
    qcost = toInt(html.data('customCost') ?? 0);
  } else if (catKey !== 'none') {
    const $q = html.find('#qualitiesList [data-selected="1"]').first();
    const qi = Number($q.data('idx'));
    const qual = Number.isFinite(qi) ? currentQualities[qi] : null;
    qcost = getQualityCost(qual);
  }

  // weapon surcharges (mirror the preview/updateCost logic)
  const kind = html.find('input[name="itemType"]:checked').val();
  let custom = 0;
  if (kind === 'weapon') {
    const plus1  = html.find('#optPlusOne').is(':checked');
    const plus4  = html.find('#optPlusDamage').is(':checked');
    const eleSel = (html.find('#optElement').val() || 'physical').toString();
    if (plus1) custom += 100;
    if (plus4) custom += 200;
    if (eleSel !== 'physical') custom += 100;

    const baseA = String(tmpl?.attrA ?? '').toUpperCase();
    const baseB = String(tmpl?.attrB ?? '').toUpperCase();
    const selA  = String(html.find('#optAttrA').val() || baseA).toUpperCase();
    const selB  = String(html.find('#optAttrB').val() || baseB).toUpperCase();
    const isMatchingNow = selA && selB && (selA === selB);
    const sameAsOriginalPair = (selA === baseA) && (selB === baseB);
    if (isMatchingNow && !sameAsOriginalPair) custom += 50;
  }

  // materials subtotal (already normalized on add)
  const materials = html.data('ifMaterials') || [];
  const matTotal = materials.reduce((s, m) => s + toInt(m.cost), 0);

  // two outputs
  const worth = Math.max(0, base + qcost + custom);            // save on item
  let craft   = Math.max(0, worth - matTotal);                 // show in dialog
  if (html.find('#optFee').is(':checked')) craft = Math.ceil(craft * 1.10);

  return { worth, craft };
};

/** Mirror preview math to compute weapon outputs from UI. */
const computeWeaponStats = (base, html) => {
  const norm = (h) => {
    const v = String(h ?? "").trim().toLowerCase();
    if (!v) return null;
    if (v.includes("2") || v.includes("two") || /(^|[^a-z])2h([^a-z]|$)/.test(v)) return "2";
    if (v.includes("1") || v.includes("one") || /(^|[^a-z])1h([^a-z]|$)/.test(v)) return "1";
    if (["twohanded","two-handed"].some(k=>v.includes(k))) return "2";
    if (["onehanded","one-handed"].some(k=>v.includes(k))) return "1";
    return null;
  };

  const baseHand   = norm(base?.hand) || null; // "1" | "2" | null
  const plus1      = html.find('#optPlusOne').is(':checked');
  const plus4      = html.find('#optPlusDamage').is(':checked');
  const flip       = html.find('#optToggleHand').is(':checked');
  const selA       = String(html.find('#optAttrA').val() || base?.attrA || "").toUpperCase();
  const selB       = String(html.find('#optAttrB').val() || base?.attrB || "").toUpperCase();
  const elementVal = (html.find('#optElement').val() || base?.element || "physical").toString();

  // hands label
  let handsOut = base?.hand || ""; // keep textual form for system field
  if (flip && (baseHand === "1" || baseHand === "2")) {
    handsOut = (baseHand === "1") ? "two-handed" : "one-handed";
  }

  // damage & accuracy
  const handMod = (flip && baseHand === "2") ? -4
               : (flip && baseHand === "1") ? +4
               : 0;
  const accOut  = (Number(base?.accuracy ?? base?.acc ?? 0) || 0) + (plus1 ? 1 : 0);
  let dmgOut    = (Number(base?.damage   ?? base?.dmg ?? 0) || 0) + (plus4 ? 4 : 0) + handMod;

  // "isMartial" escalates if effective damage >= 10 (preview logic)
  const isMartialEffective = (Number.isFinite(dmgOut) && dmgOut >= 10) || !!base?.isMartial;

  return {
    hands: handsOut,
    attrs: { A: selA, B: selB },
    acc: accOut,
    dmg: dmgOut,
    dmgType: elementVal,
    isMartial: isMartialEffective
  };
};

/** Build final itemData payload for the selected kind using dialog state. */
const buildItemData = (kind, html, {
  currentTemplates,
  currentQualities
}) => {
  const base = getSelectedBase(html, currentTemplates);
  if (!base) throw new Error("No template selected.");

  const { desc: qualDesc, cost: qualCost } = getSelectedQualityInfo(html, currentQualities);
  const img = getPreviewIcon(html, dataLoader.getRandomIconFor(kind, base));

  // compute dialog-consistent costs
  const $sel = ui.windows[Number(html.closest(".window-app").attr("data-appid"))]
    ? html
    : html; // html is already the jQuery of the dialog
  const $t  = html.find('#templateList [data-selected="1"]').first();
  const ti  = Number($t.data("idx"));
  const tmpl = Number.isFinite(ti) ? currentTemplates[ti] : null;
  const { worth } = getCurrentCosts(html, tmpl, currentQualities);
  const costField = worth; // save worth to the item

  if (kind === "weapon") {
    const w = computeWeaponStats(base, html);
    return {
      name: `Crafted ${base?.name ?? "Weapon"}`,
      type: "weapon",
      img,
      system: {
        category:   { value: base?.category ?? "" },
        hands:      { value: w.hands || "" },
        type:       { value: base?.type ?? "" },
        attributes: {
          primary:   { value: asAttrKey(w.attrs.A) },
          secondary: { value: asAttrKey(w.attrs.B) }
        },
        accuracy:   { value: w.acc },
        defense:    "def", // per spec: DEF for now
        damageType: { value: w.dmgType || (base?.element ?? "physical") },
        damage:     { value: w.dmg },
        isMartial:  { value: !!w.isMartial },
        quality:    { value: qualDesc || "No quality" },
        cost:       { value: costField },
        source:     { value: "LOOKFAR" },
        summary:    { value: `a finely crafted ${base?.category ?? "weapon"}.` }
      }
    };
  }

  if (kind === "armor") {
    return {
      name: `Crafted ${base?.name ?? "Armor"}`,
      type: "armor",
      img,
      system: {
        def:      { attribute: asAttrKey(base?.defAttr  || "dex"), value: Number(base?.def  ?? 0) || 0 },
        mdef:     { attribute: asAttrKey(base?.mdefAttr || "ins"), value: Number(base?.mdef ?? 0) || 0 },
        init:     { value: Number(base?.init ?? 0) || 0 },
        isMartial:{ value: !!base?.isMartial },
        quality:  { value: qualDesc || "No quality" },
        cost:     { value: costField },
        source:   { value: "LOOKFAR" },
        summary:  { value: `A set of ${base?.isMartial ? "martial" : "non-martial"} armor that ${qualDesc || "has no special properties."}` }
      }
    };
  }

  if (kind === "shield") {
    return {
      name: `Crafted ${base?.name ?? "Shield"}`,
      type: "shield",
      img,
      system: {
        def:      { attribute: asAttrKey(base?.defAttr  || "dex"), value: Number(base?.def  ?? 0) || 0 },
        mdef:     { attribute: asAttrKey(base?.mdefAttr || "ins"), value: Number(base?.mdef ?? 0) || 0 },
        init:     { value: Number(base?.init ?? 0) || 0 },
        isMartial:{ value: !!base?.isMartial },
        quality:  { value: qualDesc || "No quality" },
        cost:     { value: costField },
        source:   { value: "LOOKFAR" },
        summary:  { value: `A ${base?.isMartial ? "martial" : "non-martial"} shield that ${qualDesc || "has no special properties."}` }
      }
    };
  }

  // accessory
  return {
    name: `Crafted ${base?.name ?? "Accessory"}`,
    type: "accessory",
    img,
    system: {
      def:     { value: Number(base?.def  ?? 0) || 0 },
      mdef:    { value: Number(base?.mdef ?? 0) || 0 },
      init:    { value: Number(base?.init ?? 0) || 0 },
      quality: { value: qualDesc || "No quality" },
      cost:    { value: costField },
      source:  { value: "LOOKFAR" },
      summary: { value: `An accessory that ${qualDesc || "has no special properties."}` }
    }
  };
};

// --- end item forge helpers ------------------------------------------------------------

  const CATEGORY_OPTIONS = [
  ["Basic",       "basic"],
  ["Custom",      "custom"],
  ["Ardent",      "ardent"],
  ["Aerial",      "aerial"],
  ["Thunderous",  "thunderous"],
  ["Paradox",     "paradox"],
  ["Terrestrial", "terrestrial"],
  ["Glacial",     "glacial"],
  ["Spiritual",   "spiritual"],
  ["Corrupted",   "corrupted"],
  ["Aquatic",     "aquatic"],
  ["Mechanical",  "mechanical"],
];

  const ATTR_ROW_FIXED_HEIGHT = "30px";

  const content = `
<div id="if-body">
  <form>
    <div style="display:flex; gap:4px; align-items:flex-start; min-width:0; margin-bottom:0;">
      <div style="flex:0 0 60%; min-width:0; display:flex; flex-direction:column;">
        <fieldset style="margin:0;">
          <legend>Choose Item</legend>
          <div style="display:flex; align-items:flex-start; min-width:0;">
            <div style="flex:0 0 100px;">
              <label><input type="radio" name="itemType" value="weapon" checked> Weapon</label><br>
              <label><input type="radio" name="itemType" value="armor"> Armor</label><br>
              <label><input type="radio" name="itemType" value="shield"> Shield</label><br>
              <label><input type="radio" name="itemType" value="accessory"> Accessory</label>
            </div>
            <div style="flex:1 1 auto; min-width:0;">
              <div id="templateList" aria-label="Template list"
                   style="height:100px; overflow-y:auto; border:1px solid #999; padding:4px; box-sizing:border-box;">
                <div>Loading…</div>
              </div>
            </div>
          </div>
        </fieldset>

        <div id="attrRow">
          <fieldset style="margin:0;">
            <legend>Attributes</legend>
            <div id="attrInner" style="display:flex; gap:4px; align-items:center; flex-wrap:wrap; height:${ATTR_ROW_FIXED_HEIGHT}; box-sizing:border-box;"></div>
          </fieldset>
        </div>

        <fieldset style="margin:0;">
          <legend>Preview</legend>
          <div id="itemPreviewLarge" title="Crafted item preview"
               style="width:100%; height:165px; border:1px solid #999; display:flex; align-items:center; justify-content:center;">
            CONTENT
          </div>
        </fieldset>
      </div>

      <div style="flex:0 0 40%; min-width:0; display:flex; flex-direction:column;">
        <fieldset>
          <legend>Customize</legend>
          <div id="customizeArea" style="width:100%; height:100px;"></div>
        </fieldset>

        <!-- Qualities -->
        <fieldset>
          <legend>Qualities</legend>
          <div style="margin-bottom:4px;">
            <select id="qualitiesCategory" style="width:100%;">
              <option value="none" selected>None</option>
              ${CATEGORY_OPTIONS.map(([label, key]) => `<option value="${key}">${label}</option>`).join("")}
            </select>
          </div>
          <div id="qualitiesList" aria-label="Qualities list"
               style="width:100%; height:138px; overflow-y:auto; border:1px solid #999; box-sizing:border-box;">
            <div>Loading…</div>
          </div>
        </fieldset>

        <!-- Cost -->
<fieldset>
  <legend>Cost</legend>
  <div id="costRow" style="font-size:14px; line-height:1; display:inline-flex; align-items:center;">
    <i class="fuk fu-zenit" aria-hidden="true" style="margin-right:4px;"></i>
    <span id="costValue"
      style="display:inline-block; width:6ch; text-align:left; font-variant-numeric: tabular-nums; font-feature-settings:'tnum';">0</span>
    <label style="display:inline-flex; align-items:center; font-size:14px; white-space:nowrap;">
      <input type="checkbox" id="optFee" style="margin-right:4px;">
      <span>Fee?</span>
    </label>
  </div>
</fieldset>
      </div>
    </div>
  </div>

    <fieldset style="margin:0 0 6px 0;">
      <legend>Materials</legend>
      <div id="materialsDrop" aria-label="Materials drop zone"
           style="min-height:72px; border:1px dashed #999; display:flex; align-items:center; justify-content:center; gap:8px; padding:6px; box-sizing:border-box; user-select:none;">
        <div id="materialsHint" style="opacity:0.6; font-size:12px;">Drag & drop Item documents here (max 5)</div>
      </div>
    </fieldset>
  </form>
</div>`;

  function openItemForgeDialog() {
  const equipmentRoot  = getEquipmentRoot();
  const qualitiesRoot  = getQualitiesRoot();

  // HOISTED (shared by render + forge button)
  let currentTemplates = [];
  let currentQualities = [];
  const materials = [];

  const dlg = new Dialog({
    title: "Item Forger",
    content,
    buttons: {
      forge: {
        label: "Forge",
        icon: '<i class="fas fa-hammer"></i>',
        callback: async (html) => {
          try {
            const kind = html.find('input[name="itemType"]:checked').val();
            if (!kind) return ui.notifications.warn("Choose an item type first.");

            const base = getSelectedBase(html, currentTemplates);
            if (!base) return ui.notifications.warn("Select a template first.");

            if (!validateMaterialsOrigin(html, materials)) return;

            const itemData = buildItemData(kind, html, { currentTemplates, currentQualities });
            const created  = await Item.create(itemData, { renderSheet: true });
            if (!created) throw new Error("Item creation failed.");
            ui.notifications.info(`${created.name} forged.`);
          } catch (err) {
            console.error("[Item Forger] Forge failed:", err);
            ui.notifications?.error(`Item Forger: ${err.message || "Failed to forge item."}`);
          }
        }
      }
    },
    default: "forge",
      render: async (html) => {
        const $dlg = html.closest(".window-app");
        const $wc  = $dlg.find(".window-content");
        $wc.css({ display: "block", overflow: "visible" });
        $dlg.css({ width: "700px" });

        const relayout = () => {
          const app2 = ui.windows[Number($dlg.attr("data-appid"))];
          if (app2?.setPosition) {
            app2.setPosition({ height: "auto" });
            setTimeout(() => app2.setPosition({ height: "auto" }), 0);
          }
        };
        relayout();

        const $templateList     = html.find("#templateList");
        const $qualitiesList    = html.find("#qualitiesList");
        const $qualitiesSelect  = html.find("#qualitiesCategory");
        const $customize        = html.find("#customizeArea");
        const $attrInner        = html.find("#attrInner");
        const $materialsDrop    = html.find("#materialsDrop");
        const $materialsHint    = html.find("#materialsHint");
        const $preview          = html.find("#itemPreviewLarge");

        html.data('ifMaterials', materials);

  // ---- COST: recompute whenever template or quality selection changes ----
  const updateCost = () => {
  const $val = html.find('#costValue');
  const $t   = html.find('#templateList [data-selected="1"]').first();
  const ti   = Number($t.data("idx"));
  const tmpl = Number.isFinite(ti) ? currentTemplates[ti] : null;

  const { craft } = getCurrentCosts(html, tmpl, currentQualities);
  $val.text(craft);
};
        
       const getNameSafe = (r) => esc(getName(r));
  const getItemImage = (item) => {
  // 1) Respect an explicitly chosen image (or existing texture)
  if (item?.img) return item.img;

  // 2) Determine current kind from the dial in this dialog
  const kind = html.find('input[name="itemType"]:checked').val(); // "weapon" | "armor" | "shield" | "accessory"
  if (!kind) return item?.texture?.src || item?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";

  // 3) Find the selected template id on the item (how this script tracks the chosen base)
  const templateId = item?.system?.templateId;
  if (!templateId) return item?.texture?.src || item?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";

  // 4) Resolve the base template from dataLoader lists and pick a random icon from the manifest
  const byKindList = {
    weapon:    dataLoader.weaponsData?.weaponList,
    armor:     dataLoader.armorData?.armorList,
    shield:    dataLoader.shieldsData?.shieldList,
    accessory: dataLoader.accessoriesData?.accessoryList
  }[kind] || [];

  const base = byKindList.find(e => e?.id === templateId);
  const img  = base ? dataLoader.getRandomIconFor(kind, base) : null;
  if (img) return img;

  // 5) Final fallback
  return item?.texture?.src || item?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";
};

        // ---------- icons (top-of-preview) ----------
        const getKindIcon = (kind) => ({
          weapon:    "icons/svg/sword.svg",
          shield:    "icons/svg/shield.svg",
          armor:     "icons/svg/statue.svg",
          accessory: "icons/svg/stoned.svg"
        }[kind] || "icons/svg/mystery-man.svg");

        // --- NEW: apply Attr A/B defaults from selected weapon template ---
        const applyAttrDefaultsFromTemplate = (selectedEl) => {
          const kind = html.find('input[name="itemType"]:checked').val();
          if (kind !== "weapon") return;

          const $sel = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
          const idx = Number($sel.data("idx"));
          const base = Number.isFinite(idx) ? currentTemplates[idx] : null;

          const $a = html.find('#optAttrA');
          const $b = html.find('#optAttrB');
          if (!$a.length || !$b.length) return;

          const allowed = new Set(["MIG","DEX","INS","WLP"]);
          const a = String(base?.attrA ?? "").toUpperCase();
          const b = String(base?.attrB ?? "").toUpperCase();

          if (allowed.has(a)) $a.val(a);
          if (allowed.has(b)) $b.val(b);
        };

// ---------- PREVIEW: render compact item card ----------
const clip = (v, n=14) => {
  const s = String(v ?? "");
  return s.length > n ? s.slice(0, n-1) + "…" : s;
};

const addModIfNumber = (val, mod) => {
  const num = Number(val);
  return Number.isFinite(num) ? (num + mod) : val;
};
const handLabel = (h) => (h === "1" ? "1-handed" : h === "2" ? "2-handed" : h || "—");

/**
 * Render the preview.
 * @param {string} kind - "weapon" | "armor" | "shield" | "accessory"
 * @param {HTMLElement|null} selectedEl - the selected template element
 * @param {{ rerollIcon?: boolean }} opts - set rerollIcon=true ONLY when user clicks template/quality
 */
const renderPreview = (kind, selectedEl, opts = {}) => {
  const rerollIcon = !!opts.rerollIcon;

  // simple per-dialog cache for auto-picked icons
  let iconMap = html.data('autoIconMap');
  if (!iconMap) { iconMap = {}; html.data('autoIconMap', iconMap); }

  // user-picked override always wins
  const override = html.data('iconOverride');
  const getKindIcon = (k) => ({
    weapon:    "icons/svg/sword.svg",
    shield:    "icons/svg/shield.svg",
    armor:     "icons/svg/statue.svg",
    accessory: "icons/svg/stoned.svg"
  }[k] || "icons/svg/mystery-man.svg");

  // identify current base template to key the cache
  const $sel  = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
  const idx   = Number($sel.data("idx"));
  const base  = Number.isFinite(idx) ? currentTemplates[idx] : null;
  const baseId = base?.id ?? base?._id ?? getName(base); // reasonable key even if id missing
  const cacheKey = `${kind}:${String(baseId)}`;

  let icon = getKindIcon(kind);

  if (override) {
    icon = override; // manual override
  } else {
    // use cached icon if available, unless we are explicitly re-rolling
    if (!rerollIcon && iconMap[cacheKey]) {
      icon = iconMap[cacheKey];
    } else {
      // pick a fresh random icon from manifest (if base exists), then cache it
      try {
        const pick = base ? dataLoader.getRandomIconFor(kind, base) : null;
        icon = pick || icon;
      } catch (e) {
        console.warn("[Item Forger] preview icon pick failed:", e);
      }
      iconMap[cacheKey] = icon;
    }
  }

  // remember the folder we’re currently showing for the FilePicker
  try {
    const dir = String(icon || "").includes("/") ? String(icon).replace(/\/[^/]*$/, "/") : "/";
    html.data('lastIconDir', dir);
  } catch { /* noop */ }

  const style = `
  <style>
    #if-preview-card{
      width:100%; height:100%;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      gap:8px; padding:6px; box-sizing:border-box;
    }
    /* head row to hold the icon */
    #if-preview-head{
      display:flex; align-items:center; justify-content:center;
      gap:6px;
    }
    /* icon wrapper to allow absolute-positioned badge */
    .if-icon-wrap{
      position:relative;
      width:32px; height:32px;
      display:inline-block;
    }
    #if-preview-icon{
  width:32px; height:32px;
  object-fit:contain; image-rendering:auto; display:block;
  cursor:pointer; pointer-events:auto;
}
    /* the badge that overlaps the icon (uses your system class + positioning) */
    .if-badge{
      position:absolute;
      right:-2px;
      bottom:-2px;
      z-index:2;              /* ensure on top of the image */
      transform:scale(0.9);   /* small shrink so it fits neatly */
      pointer-events:none;    /* avoid accidental clicks */
    }

    #if-preview-rows{ width:100%; display:flex; flex-direction:column; gap:4px; }
    .if-row{ width:100%; text-align:center; font-size:11px; line-height:1.15;
             white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .if-muted{ opacity:0.7; }
    .if-tight{ letter-spacing:0.2px; }
    .if-row-desc{
      width:100%;
      text-align:center;
      font-size:11px;
      line-height:1.2;
      white-space:normal;
      overflow:hidden;
      padding:4px 8px;
      box-sizing:border-box;
    }
  </style>
`;

  // --- helper: get quality description including Custom ---
const qdesc = () => {
  const catKeyNow = String($qualitiesSelect.val() || "none").toLowerCase();
  if (catKeyNow === "custom") {
    return String(html.data('customEffect') ?? "").trim(); // committed only
  }
  const $qsel = html.find('#qualitiesList [data-selected="1"]').first();
  const qIdx  = Number($qsel.data("idx"));
  const q     = Number.isFinite(qIdx) ? currentQualities[qIdx] : null;
  return q?.description ?? q?.desc ?? "";
};

  // dial sanity check
const kindNow = html.find('input[name="itemType"]:checked').val();
if (kindNow !== kind) {
  $preview.html(`${style}
    <div id="if-preview-card">
      <img id="if-preview-icon" src="${icon}">
      <div id="if-preview-rows" class="if-muted"><div class="if-row">Preview coming soon…</div></div>
    </div>
  `);
  return;
}

// ---------- ARMOR PREVIEW ----------
if (kind === "armor") {
  // current template selection
  const $sel = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
  const idx  = Number($sel.data("idx"));
  const a    = Number.isFinite(idx) ? currentTemplates[idx] : null;

  // pull fields from equipment.json (with gentle fallbacks)
  const isMartial = !!a?.isMartial;
  const defAttr   = (a?.defAttr   ?? "").toString().toUpperCase();
  const def       = (a?.def       ?? "—");
  const mdefAttr  = (a?.mdefAttr  ?? "").toString().toUpperCase();
  const mdef      = (a?.mdef      ?? "—");
  const init      = (a?.init      ?? "—");

  // Row with bold labels; defAttr suppressed when isMartial=true
  const rowArmor = !isMartial
    ? `<strong>DEF:</strong> ${esc(defAttr)}+${esc(def)} | <strong>M.DEF:</strong> ${esc(mdefAttr)}+${esc(mdef)} | <strong>INIT:</strong> ${esc(init)}`
    : `<strong>DEF:</strong> ${esc(def)} | <strong>M.DEF:</strong> ${esc(mdefAttr)}+${esc(mdef)} | <strong>INIT:</strong> ${esc(init)}`;

  // Quality description (centered, wrapped)
  // const $qsel = html.find('#qualitiesList [data-selected="1"]').first();
  // const qIdx  = Number($qsel.data("idx"));
  // const q     = Number.isFinite(qIdx) ? currentQualities[qIdx] : null;
  // const qdesc = q?.description ?? q?.desc ?? "";

  // HEAD: icon + optional martial badge to the right of the icon
  $preview.html(`${style}
  <div id="if-preview-card">
    <div id="if-preview-head">
      <div class="if-icon-wrap">
        <img id="if-preview-icon" src="${icon}">
        ${isMartial ? `<span class="is-martial if-badge"></span>` : ``}
      </div>
    </div>
    <div id="if-preview-rows">
      <div class="if-row if-tight">${rowArmor}</div>
      <div class="if-row-desc">${esc(qdesc())}</div>
    </div>
  </div>
`);
  return;
}

// ---------- SHIELD PREVIEW ----------
if (kind === "shield") {
  // current template selection
  const $sel = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
  const idx  = Number($sel.data("idx"));
  const s    = Number.isFinite(idx) ? currentTemplates[idx] : null;

  // pull fields from equipment.json (with gentle fallbacks)
  const isMartial = !!s?.isMartial;
  const def       = (s?.def  ?? "—");
  const mdef      = (s?.mdef ?? "—");

  // second row: DEF: +def | M.DEF: +mdef (bold labels)
  const rowShield = `<strong>DEF:</strong> +${esc(def)} | <strong>M.DEF:</strong> +${esc(mdef)}`;

  // Quality description (same behavior as other kinds)
  //const $qsel = html.find('#qualitiesList [data-selected="1"]').first();
  //const qIdx  = Number($qsel.data("idx"));
  //const q     = Number.isFinite(qIdx) ? currentQualities[qIdx] : null;
  //const qdesc = q?.description ?? q?.desc ?? "";

  // HEAD: icon + optional martial badge (presence only difference)
  $preview.html(`${style}
    <div id="if-preview-card">
      <div id="if-preview-head">
        <div class="if-icon-wrap">
          <img id="if-preview-icon" src="${icon}">
          ${isMartial ? `<span class="is-martial if-badge"></span>` : ``}
        </div>
      </div>
      <div id="if-preview-rows">
        <div class="if-row if-tight">${rowShield}</div>
        <div class="if-row-desc">${esc(qdesc())}</div>
      </div>
    </div>
  `);
  return;
}

// ---------- ACCESSORY PREVIEW ----------
if (kind === "accessory") {
  // Selected quality (description-only row)
  // const $qsel = html.find('#qualitiesList [data-selected="1"]').first();
  // const qIdx  = Number($qsel.data("idx"));
  // const q     = Number.isFinite(qIdx) ? currentQualities[qIdx] : null;
  // Use the quality description; fallback to empty if none
  // const qdesc = q?.description ?? q?.desc ?? "";

  $preview.html(`${style}
    <div id="if-preview-card">
      <div id="if-preview-head">
        <div class="if-icon-wrap">
          <img id="if-preview-icon" src="${icon}">
        </div>
      </div>
      <div id="if-preview-rows">
        <div class="if-row-desc">${esc(qdesc())}</div>
      </div>
    </div>
  `);
  return;
} 

// ---------- WEAPON PREVIEW (unchanged below this line) ----------
if (kind === "weapon") {
  // TEMPLATE selection
  const $sel = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
  const idx = Number($sel.data("idx"));
  const w   = Number.isFinite(idx) ? currentTemplates[idx] : null;

  // BASE values from template
  const baseHand     = normHand(w?.hand) || null; // "1" | "2" | null
  const baseHandText = handLabel(baseHand ?? (w?.hand ?? "—"));
  const baseType     = w?.type ?? "—";
  const baseCat      = w?.category ?? w?.cat ?? "—";
  const baseA        = (w?.attrA ?? "—").toString().toUpperCase();
  const baseB        = (w?.attrB ?? "—").toString().toUpperCase();
  const baseAcc      = w?.accuracy ?? w?.acc ?? "—";
  const baseDmg      = w?.damage   ?? w?.dmg ?? "—";
  const baseEle      = (w?.element ?? "physical").toString();

  // UI OVERRIDES
  const selA   = (html.find('#optAttrA').val() || baseA).toString().toUpperCase();
  const selB   = (html.find('#optAttrB').val() || baseB).toString().toUpperCase();
  const plus1  = html.find('#optPlusOne').is(':checked');
  const plus4  = html.find('#optPlusDamage').is(':checked');
  const flip   = html.find('#optToggleHand').is(':checked');
  const eleSel = (html.find('#optElement').val() || baseEle).toString();

  // Apply hand flip to hand label and compute damage modifier:
  let dispHand = baseHand;
  if (flip && (baseHand === "1" || baseHand === "2")) dispHand = baseHand === "1" ? "2" : "1";

  const handMod = (flip && baseHand === "2") ? -4  // "Make 1-handed" → -4 dmg
                 : (flip && baseHand === "1") ? +4 // "Make 2-handed" → +4 dmg
                 : 0;

  const dispAcc = plus1 ? addModIfNumber(baseAcc, 1) : baseAcc;
  const dispDmg = addModIfNumber(plus4 ? addModIfNumber(baseDmg, 4) : baseDmg, handMod);
  const dispDmgNum = Number(dispDmg);
  const isMartialEffective = (Number.isFinite(dispDmgNum) && dispDmgNum >= 10) || !!w?.isMartial;

  const dispHandText = handLabel(dispHand ?? baseHandText);

  const row1 = `${dispHandText} • ${baseType} • ${baseCat}`;
  const row2 = `【${selA} + ${selB}】+ ${dispAcc} | HR+${dispDmg} ${eleSel}`;

  // const $qsel = html.find('#qualitiesList [data-selected="1"]').first();
  // const qIdx  = Number($qsel.data("idx"));
  // const q     = Number.isFinite(qIdx) ? currentQualities[qIdx] : null;
  // const qdesc = q?.description ?? q?.desc ?? "";

  $preview.html(`${style}
  <div id="if-preview-card">
    <div id="if-preview-head">
      <div class="if-icon-wrap">
        <img id="if-preview-icon" src="${icon}">
        ${isMartialEffective ? `<span class="is-martial if-badge"></span>` : ``}
      </div>
    </div>
    <div id="if-preview-rows">
      <div class="if-row if-tight">${esc(clip(row1, 64))}</div>
      <div class="if-row if-tight">${esc(clip(row2, 64))}</div>
      <div class="if-row-desc">${esc(qdesc())}</div>
    </div>
  </div>
`);
  return;
}

// ---------- other kinds (shield/accessory) → placeholder for now ----------
$preview.html(`${style}
  <div id="if-preview-card">
    <img id="if-preview-icon" src="${icon}">
    <div id="if-preview-rows" class="if-muted"><div class="if-row">Preview coming soon…</div></div>
  </div>
`);
return;
}

        // ---------- shared selectable list ----------
        const wireSelectableList = ($container, itemSel, { onSelect } = {}) => {
          const $items = $container.find(itemSel);
          $items.on("mouseenter", function() {
            if (this.dataset.selected === "1") return;
            $(this).css({ backgroundColor: "rgba(0,0,0,0.08)" });
          }).on("mouseleave", function() {
            if (this.dataset.selected === "1") return;
            $(this).css({ backgroundColor: "", color: "" });
          });
          $items.on("click", function() {
            $container.find(itemSel).each(function() {
              this.dataset.selected = "";
              $(this).css({ backgroundColor: "", color: "" });
            });
            this.dataset.selected = "1";
            $(this).css({ backgroundColor: "rgba(65,105,225,1)", color: "white" });
            onSelect?.(this);
          });
          const $first = $items.first();
          if ($first.length) $first.trigger("click"); // ensures real selection + onSelect
        };

        const renderMaterials = () => {
  // Which origin is required by the selected quality category? ("" if none/basic)
  const needKey = getRequiredOriginKey(html); // e.g., "ardent" | "" (no req)
  const hasReq = !needKey || materials.some(m => String(m.origin) === needKey);

  // Reset hint to default text up front
  $materialsHint.text("Drag & drop Item documents here (max 5)");

  // Rebuild thumbnails
  $materialsDrop.children('img[data-mat="1"]').remove();

  if (materials.length === 0) {
    // Show a message ONLY before any materials are added
    if (needKey) $materialsHint.text(`Needs 1 ${needKey} material to craft.`);
    $materialsHint.show();
  } else {
    $materialsHint.hide();

    materials.forEach((m, i) => {
      const tip = [
        m.name ? m.name : "",
        m.origin ? `Origin: ${m.origin}` : "",
        Number.isFinite(m.cost) ? `Cost: ${m.cost}` : ""
      ].filter(Boolean).join(" • ");

      const $img = $(
        `<img data-mat="1" data-index="${i}" src="${esc(m.img)}"
              title="Click to remove\n${esc(tip)}"
              style="width:48px; height:48px; object-fit:contain; image-rendering:auto; cursor:pointer;">`
      );

      $img.on("click", () => {
        materials.splice(i, 1);
        html.data('ifMaterials', materials);  // ← keep helper in sync
        renderMaterials();
        updateCost(); // keep total in sync after removing a material
      });

      $materialsDrop.append($img);
    });
  }

  // Border communicates requirement status at all times
  $materialsDrop.css({
    borderColor: (!hasReq && needKey) ? "red" : "#999"
  });

  relayout();
};

        $materialsDrop
  .on("dragover", (ev) => { ev.preventDefault(); $materialsDrop.css("background", "rgba(65,105,225,0.08)"); })
  .on("dragleave", () => { $materialsDrop.css("background", ""); })
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

      const doc = await fromUuid(data.uuid);
      if (!doc || doc.documentName !== "Item") {
        ui.notifications?.warn("Only Item documents can be dropped here.");
        return;
      }

      // RESTRICT: treasure only
      if (String(doc.type) !== "treasure") {
        ui.notifications?.warn("Only Treasure items can be used as materials.");
        return;
      }

      if (materials.length >= 5) {
        ui.notifications?.warn("You can only add up to 5 materials.");
        return;
      }

      // Extract origin + cost
      const matCost   = getTreasureCost(doc);
      const matOrigin = getTreasureOrigin(doc); // lowercased

      materials.push({
        uuid: data.uuid,
        img:  getItemImage(doc),
        name: doc.name,
        cost: matCost,
        origin: matOrigin
      });
      html.data('ifMaterials', materials);  // ← keep helper in sync
      renderMaterials();
      updateCost();
    } catch (e) {
      console.error("[Item Forger] Drop parse failed:", e);
      ui.notifications?.error("Could not read dropped data.");
    }
  });

        const renderTemplates = (rows) => {
          currentTemplates = Array.isArray(rows) ? rows : [];
          if (!currentTemplates.length) {
            $templateList.html(`<div style="text-align:center; opacity:0.75;">No templates found.</div>`);
            // even with no templates, keep preview icon in sync with dial
            const kind = html.find('input[name="itemType"]:checked').val();
            renderPreview(kind, null);
            return;
          }
          const items = currentTemplates.map((r, i) =>
            `<div class="if-template" data-idx="${i}" data-name="${getNameSafe(r)}" style="padding:4px; cursor:pointer;">${getNameSafe(r)}</div>`
          ).join("");
          $templateList.html(items);
          wireSelectableList($templateList, ".if-template", {
  onSelect: (el) => {
    updateHandToggle(el);
    applyAttrDefaultsFromTemplate(el);
    // Clear any manual icon override when changing base template
    html.removeData('iconOverride');

    const kind = html.find('input[name="itemType"]:checked').val();
    renderPreview(kind, el, { rerollIcon: true });   // ← ONLY here we re-roll
    updateCost();
  }
});
        };

        const renderQualities = (type) => {
  if (!qualitiesRoot || typeof qualitiesRoot !== "object") {
    $qualitiesList.html(`<div style="text-align:center;">No qualities data.</div>`);
    currentQualities = [];
    const kind = html.find('input[name="itemType"]:checked').val();
    renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
    updateCost();
    return;
  }

  const catKey = String($qualitiesSelect.val() || "none").toLowerCase();

  // --- NEW: "custom" branch ---
if (catKey === "custom") {
  currentQualities = [];

  // Prefill with last committed values
  const effCommitted = String(html.data('customEffect') ?? "Custom effect text");
  const cstCommitted = toInt(html.data('customCost') ?? 0);

  $qualitiesList.html(`
    <div id="customQualityWrap"
         style="display:flex; flex-direction:column; gap:6px; padding:6px; height:100%; box-sizing:border-box;">

      <textarea id="customEffect"
          rows="2" wrap="soft"
          style="
            width:100%;
            height:44px;
            box-sizing:border-box;
            overflow-y:auto;
            resize:none;
          "
          title="Type your custom effect text">${esc(effCommitted)}</textarea>

      <div style="display:flex; align-items:center; gap:8px;">
        <label for="customCost" style="font-size:12px; opacity:0.8; line-height:1; white-space:nowrap;">Cost:</label>
        <input id="customCost" type="number" min="0" step="1" inputmode="numeric" pattern="\\d*"
               value="${cstCommitted}"
               style="width:100%; height:25px; box-sizing:border-box;"
               title="Enter a non-negative integer">
      </div>

      <button type="button" id="customApply"
  style="
    width:auto;
    height:28px;
    margin:2px auto 0;
    display:block;
    padding:0 10px;
    line-height:1;
    box-sizing:border-box;
  ">
  Apply
</button>
    </div>
  `);

  // UX wiring:
  // - Keep Enter/newlines allowed in Effect (textarea)
  // - Block Enter only in Cost (prevents dialog submit)
  $qualitiesList
    .off('.customUX')
    .on('keydown.customUX', '#customCost', (ev) => {
      if (ev.key === 'Enter') ev.preventDefault();
    })
    // Filter non-digits for safety on keypress in Cost
    .on('keypress.customUX', '#customCost', (ev) => {
      if (ev.key.length === 1 && !/[0-9]/.test(ev.key)) ev.preventDefault();
    })
    // Sanitize on paste into Cost
    .on('paste.customUX', '#customCost', (ev) => {
      ev.preventDefault();
      const txt = (ev.originalEvent || ev).clipboardData.getData('text') ?? '';
      const digits = txt.replace(/\D+/g, '');
      const el = ev.currentTarget;
      const start = el.selectionStart ?? el.value.length;
      const end   = el.selectionEnd   ?? el.value.length;
      el.value = el.value.slice(0, start) + digits + el.value.slice(end);
    })
    // Apply button: commit values, then refresh preview + totals
    .on('click.customUX', '#customApply', () => {
      const eff = String(html.find('#customEffect').val() ?? '').trim();

      // Strong sanitize + clamp for cost
      const raw = String(html.find('#customCost').val() ?? '');
      const cst = Math.max(0, parseInt(raw.replace(/\D+/g, ''), 10) || 0);
      html.find('#customCost').val(cst); // reflect sanitized value

      // Commit (these are the only values used by preview & cost)
      html.data('customEffect', eff);
      html.data('customCost', cst);

      const kind = html.find('input[name="itemType"]:checked').val();
      renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
      updateCost();
    });

  // Initial render (uses committed values if any)
  const kind = html.find('input[name="itemType"]:checked').val();
  renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
  updateCost();
  return;
}

  // NEW: when "none" is chosen, show an empty list and no qualities
  if (catKey === "none") {
    currentQualities = [];
    $qualitiesList.html("");
    const kind = html.find('input[name="itemType"]:checked').val();
    renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
    updateCost();
    return;
  }

  const catList = Array.isArray(qualitiesRoot[catKey]) ? qualitiesRoot[catKey] : [];
  currentQualities = catList.filter(q => matchesAppliesTo(q, type));

  if (!currentQualities.length) {
    $qualitiesList.html("");
    const kind = html.find('input[name="itemType"]:checked').val();
    renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
    updateCost();
    return;
  }

  const items = currentQualities.map((q, i) =>
    `<div class="if-quality" data-idx="${i}" style="padding:4px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(qualityDisplayName(q, type))}</div>`
  ).join("");
  $qualitiesList.html(items);

  wireSelectableList($qualitiesList, ".if-quality", {
  onSelect: () => {
    const kind = html.find('input[name="itemType"]:checked').val();
    renderPreview(
      kind,
      html.find('#templateList [data-selected="1"]').first(),
      { rerollIcon: true }                           // ← ONLY here we re-roll
    );
    updateCost();
  }
});
};

        const renderAttrs = (type) => {
          if (type !== "weapon") return $attrInner.html("");
          $attrInner.html(`
            <label>Attr A:
              <select id="optAttrA" style="max-width:160px;">
                <option value="MIG">MIG</option><option value="DEX">DEX</option>
                <option value="INS">INS</option><option value="WLP">WLP</option>
              </select>
            </label>
            <label>Attr B:
              <select id="optAttrB" style="max-width:160px;">
                <option value="MIG">MIG</option><option value="DEX">DEX</option>
                <option value="INS">INS</option><option value="WLP">WLP</option>
              </select>
            </label>
          `);
        };

        const renderCustomize = (type) => {
          if (type !== "weapon") return $customize.html(`<div style="opacity:0.8;">No Options</div>`);
          $customize.html(`
            <style>
              #customizeArea label { display:flex; align-items:center; gap:4px; line-height:1; }
              #customizeArea input[type="checkbox"] { transform: scale(0.9); transform-origin: left center; margin:0 4px 0 0; }
              #customizeArea select { height: 22px; }
            </style>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label><input type="checkbox" id="optPlusOne"><span>+1 Accuracy</span></label>
              <label><input type="checkbox" id="optPlusDamage"><span>+4 Damage</span></label>
              <label id="handToggleWrap" style="display:none;">
                <input type="checkbox" id="optToggleHand"><span id="handToggleLabel"></span>
              </label>
              <label>Type:
                <select id="optElement" style="max-width:160px;">
                  <option value="physical" selected>Physical</option>
                  <option value="fire">Fire</option><option value="ice">Ice</option>
                  <option value="earth">Earth</option><option value="air">Air</option>
                  <option value="bolt">Bolt</option><option value="dark">Dark</option>
                  <option value="light">Light</option><option value="poison">Poison</option>
                </select>
              </label>
            </div>
          `);
        };

        const populateTemplates = (kind) => {
          const data = kind === "armor" ? getArmorList(equipmentRoot)
                     : kind === "shield" ? getShieldList(equipmentRoot)
                     : kind === "accessory" ? getAccessoryList(equipmentRoot)
                     : getWeaponList(equipmentRoot);
          renderTemplates(data);
        };

        const updateHandToggle = (selectedEl) => {
  const kind = html.find('input[name="itemType"]:checked').val();
  const $wrap = html.find("#handToggleWrap");      // <label id="handToggleWrap">
  const $labelSpan = html.find("#handToggleLabel");
  const $checkbox = html.find("#optToggleHand");
  if (kind !== "weapon") return $wrap.hide();

  const $sel = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
  const idx = Number($sel.data("idx"));
  const base = Number.isFinite(idx) ? currentTemplates[idx] : null;

  const h = normHand(base?.hand); // "1" | "2" | null
  const cat = String(base?.category ?? base?.cat ?? "").toLowerCase();
  const restricted = new Set(["brawling","dagger","thrown"]);

  // helper to style-disable the whole control
  const setDisabled = (disabled, title="") => {
    $checkbox.prop("disabled", disabled);
    if (disabled) $checkbox.prop("checked", false);  // ensure off when disabled
    $wrap.css({ opacity: disabled ? 0.5 : 1, filter: disabled ? "grayscale(1)" : "" });
    if (title) $wrap.attr("title", title); else $wrap.removeAttr("title");
  };

  if (h === "2") {
    // Base is 2H → show "Make 1-handed" and allow it (no restriction)
    $labelSpan.text("Make 1-handed");
    $wrap.show();
    setDisabled(false);
  } else if (h === "1") {
    // Base is 1H → show "Make 2-handed"; for certain categories this is not allowed
    $labelSpan.text("Make 2-handed");
    $wrap.show();
    if (restricted.has(cat)) {
      setDisabled(true, "This category cannot be made 2-handed");
    } else {
      setDisabled(false);
    }
  } else {
    $wrap.hide();
  }
};

        // Ensure Attr selects exist before template auto-select, and keep preview in sync
        const updateForKind = (kind) => {
          renderCustomize(kind);
          renderAttrs(kind);
          populateTemplates(kind);
          renderQualities(kind);
          renderPreview(kind, null);      // ← set icon/placeholder immediately for this dial
          if (kind === "weapon") updateHandToggle();
          relayout();
          updateCost();                   // ← NEW
        };

const refreshPreviewFromUI = () => {
  const kind = html.find('input[name="itemType"]:checked').val();
  renderPreview(
    kind,
    html.find('#templateList [data-selected="1"]').first(),
    { rerollIcon: false }                                  // ← keep current icon
  );
  updateCost();
};

$dlg.off('.ifPrev');
$dlg.on('change.ifPrev',
  '#optAttrA, #optAttrB, #optPlusOne, #optPlusDamage, #optToggleHand, #optElement, #optFee',
  refreshPreviewFromUI
);
        
        $qualitiesSelect.on("change", () => {
  const kind = html.find('input[name="itemType"]:checked').val();
  renderQualities(kind);
  renderPreview(
    kind,
    html.find('#templateList [data-selected="1"]').first(),
    { rerollIcon: false }                                  // ← do NOT re-roll yet
  );
  renderMaterials();
  updateCost();
});

// --- Clickable preview image ---
// Single-click: open FilePicker to choose an image manually
html.off('click.ifIconPick'); // delegate from the dialog's root, resilient to re-renders
html.on('click.ifIconPick', '#if-preview-icon', async (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  console.debug('[Item Forger] preview icon clicked');

  const kind = html.find('input[name="itemType"]:checked').val();

  // Prefer the last folder we showed; otherwise derive from whatever is displayed now; fallback to "/"
  const fromOverride = html.data('iconOverride');
  const fromPreview  = $('#if-preview-icon').attr('src');
  const derivedDir   = (fromOverride || fromPreview || "").includes("/")
    ? String(fromOverride || fromPreview).replace(/\/[^/]*$/, "/")
    : "/";
  const startDir = html.data('lastIconDir') || derivedDir || "/";

  try {
    const fp = new FilePicker({
      type: "image",
      current: startDir,
      callback: (path) => {
        console.debug('[Item Forger] FilePicker selected:', path);
        html.data('iconOverride', path);
        // remember the folder we picked from for the next click
        try { html.data('lastIconDir', String(path).replace(/\/[^/]*$/, "/")); } catch {}
        renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
      }
    });
    fp.render(true);
  } catch (err) {
    console.error('[Item Forger] FilePicker error:', err);
    ui.notifications?.error('Could not open FilePicker (see console).');
  }
});

// Re-render preview icon when the dial changes (even before templates arrive)
html.on("change", 'input[name="itemType"]', (ev) => {
  const kind = ev.currentTarget.value;
  // Clear any manual icon override when switching kind
  html.removeData('iconOverride');
  updateForKind(kind);
});

        updateForKind("weapon");
        renderMaterials();
      }
    }, { resizable: false });

    dlg.render(true);
  }

  Hooks.on("lookfarShowItemForgeDialog", () => {
    try { openItemForgeDialog(); }
    catch (err) {
      console.error("[Item Forger] failed to open:", err);
      ui.notifications?.error("Item Forger: failed to open (see console).");
    }
  });

})();
