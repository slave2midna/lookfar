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
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

// equipment.json can use cost or value (some schemas embed under data)
const getEquipCost = (r) =>
  toInt(r?.cost ?? r?.value ?? r?.data?.cost ?? r?.data?.cost?.value ?? 0);

// qualities.json uses "cost"
const getQualityCost = (q) => toInt(q?.cost ?? 0);

  const CATEGORY_OPTIONS = [
    ["Basic",       "basic"],
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
               style="width:100%; height:150px; border:1px solid #999; display:flex; align-items:center; justify-content:center;">
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
  <div id="costWrap"
       style="width:100%; display:flex; align-items:center; justify-content:space-between; padding:0 16px; box-sizing:border-box;">
    <div id="costArea"
         style="display:flex; align-items:center; font-size:14px; justify-content:flex-start;">
      <i class="fuk fu-zenit" aria-hidden="true" style="margin-right:4px;"></i>
      <span id="costValue">0</span>
    </div>
    <label style="display:flex; align-items:center; font-size:14px; white-space:nowrap;">
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

    const dlg = new Dialog({
      title: "Item Forger",
      content,
      buttons: {
        forge: {
          label: "Forge",
          icon: '<i class="fas fa-hammer"></i>',
          callback: (html) => {
            const kind = html.find('input[name="itemType"]:checked').val();
            const $selT = html.find('#templateList [data-selected="1"]');
            const chosenT = $selT.data('name'); // fine for now; index-driven UI still sets this
            if (!chosenT) return ui.notifications.warn("Select a template first.");
            ui.notifications.info(`Forging ${kind}: ${chosenT}`);
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

        let currentTemplates = [];
        let currentQualities = [];
        const materials = [];

  // ---- COST: recompute whenever template or quality selection changes ----
const updateCost = () => {
  const $cost = html.find('#costArea');

  // selected template
  const $t = html.find('#templateList [data-selected="1"]').first();
  const ti = Number($t.data("idx"));
  const tmpl = Number.isFinite(ti) ? currentTemplates[ti] : null;

  // selected quality (may be none)
  const $q = html.find('#qualitiesList [data-selected="1"]').first();
  const qi = Number($q.data("idx"));
  const qual = Number.isFinite(qi) ? currentQualities[qi] : null;

  const base  = getEquipCost(tmpl);
  const qcost = getQualityCost(qual);

  // weapon-only customize surcharges
  const kind  = html.find('input[name="itemType"]:checked').val();
  let custom  = 0;

  if (kind === "weapon") {
    // --- customize fields ---
    const plus1  = html.find('#optPlusOne').is(':checked');     // +1 Accuracy
    const plus4  = html.find('#optPlusDamage').is(':checked');  // +4 Damage
    const eleSel = (html.find('#optElement').val() || 'physical').toString();

    if (plus1) custom += 100;
    if (plus4) custom += 200;
    if (eleSel !== 'physical') custom += 100;

    // --- Attr A/B surcharge logic (+50) ---
    // Get the weapon's original attrs from template (uppercase)
    const baseA = String(tmpl?.attrA ?? "").toUpperCase();
    const baseB = String(tmpl?.attrB ?? "").toUpperCase();

    // Current selections (default to base if empty)
    const selA = String(html.find('#optAttrA').val() || baseA).toUpperCase();
    const selB = String(html.find('#optAttrB').val() || baseB).toUpperCase();

    // If user sets A==B AND it's not exactly the original pair, add +50
    const isMatchingNow = selA && selB && (selA === selB);
    const wasMatchingBase = baseA && baseB && (baseA === baseB);
    const sameAsOriginalPair = (selA === baseA) && (selB === baseB);

    if (isMatchingNow && !sameAsOriginalPair) {
      // Example A: Staff WLP/WLP → set to INS/INS => +50
      // Example B: Bow DEX/INS → set to DEX/DEX => +50
      // If base was MIG/MIG and user sets back to MIG/MIG, sameAsOriginalPair=true => no +50
      custom += 50;
    }
  }

  // base total before fee
  let total = base + qcost + custom;

  // 10% fee (after all surcharges). Round **up** to whole z.
  const feeOn = html.find('#optFee').is(':checked');
  if (feeOn) total = Math.ceil(total * 1.10);

  $cost.html(
  `<i class="fuk fu-zenit" aria-hidden="true" style="margin-right:4px;"></i><span>${total}</span>`
  );
};

        const getNameSafe = (r) => esc(getName(r));
        const getItemImage = (item) =>
          item?.img || item?.texture?.src || item?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";

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
  return Number.isFinite(num) ? (num + mod) : val; // keep original if not numeric
};
const handLabel = (h) => (h === "1" ? "1-handed" : h === "2" ? "2-handed" : h || "—");

const renderPreview = (kind, selectedEl) => {
  const icon = getKindIcon(kind);
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
    #if-preview-icon{ width:32px; height:32px; object-fit:contain; image-rendering:auto; display:block; }
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
  const $qsel = html.find('#qualitiesList [data-selected="1"]').first();
  const qIdx  = Number($qsel.data("idx"));
  const q     = Number.isFinite(qIdx) ? currentQualities[qIdx] : null;
  const qdesc = q?.description ?? q?.desc ?? "";

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
      <div class="if-row-desc">${esc(qdesc)}</div>
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
  const $qsel = html.find('#qualitiesList [data-selected="1"]').first();
  const qIdx  = Number($qsel.data("idx"));
  const q     = Number.isFinite(qIdx) ? currentQualities[qIdx] : null;
  const qdesc = q?.description ?? q?.desc ?? "";

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
        <div class="if-row-desc">${esc(qdesc)}</div>
      </div>
    </div>
  `);
  return;
}

// ---------- ACCESSORY PREVIEW ----------
if (kind === "accessory") {
  // Selected quality (description-only row)
  const $qsel = html.find('#qualitiesList [data-selected="1"]').first();
  const qIdx  = Number($qsel.data("idx"));
  const q     = Number.isFinite(qIdx) ? currentQualities[qIdx] : null;

  // Use the quality description; fallback to empty if none
  const qdesc = q?.description ?? q?.desc ?? "";

  $preview.html(`${style}
    <div id="if-preview-card">
      <div id="if-preview-head">
        <div class="if-icon-wrap">
          <img id="if-preview-icon" src="${icon}">
        </div>
      </div>
      <div id="if-preview-rows">
        <div class="if-row-desc">${esc(qdesc)}</div>
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
  const row2 = `【${selA} + ${selB}】+ ${dispAcc} | HR+${dispDmg} | ${eleSel}`;

  const $qsel = html.find('#qualitiesList [data-selected="1"]').first();
  const qIdx  = Number($qsel.data("idx"));
  const q     = Number.isFinite(qIdx) ? currentQualities[qIdx] : null;
  const qdesc = q?.description ?? q?.desc ?? "";

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
      <div class="if-row-desc">${esc(qdesc)}</div>
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
          $materialsDrop.children('img[data-mat="1"]').remove();
          if (materials.length === 0) {
            $materialsHint.show();
          } else {
            $materialsHint.hide();
            materials.forEach((m, i) => {
              const $img = $(`<img data-mat="1" data-index="${i}" src="${esc(m.img)}" title="Click to remove: ${esc(m.name || "")}"
                               style="width:48px; height:48px; object-fit:contain; image-rendering:auto; cursor:pointer;">`);
              $img.on("click", () => {
                materials.splice(i, 1);
                renderMaterials();
              });
              $materialsDrop.append($img);
            });
          }
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
              if (materials.length >= 5) {
                ui.notifications?.warn("You can only add up to 5 materials.");
                return;
              }
              materials.push({ uuid: data.uuid, img: getItemImage(doc), name: doc.name });
              renderMaterials();
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
              const kind = html.find('input[name="itemType"]:checked').val();
              renderPreview(kind, el);                 // ← update preview on selection
              updateCost();                            // ← NEW
            }
          });
        };

        const renderQualities = (type) => {
  if (!qualitiesRoot || typeof qualitiesRoot !== "object") {
    $qualitiesList.html(`<div style="text-align:center;">No qualities data.</div>`);
    currentQualities = [];
    const kind = html.find('input[name="itemType"]:checked').val();
    renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
    updateCost();                            // ← NEW
    return;
  }

  const catKey = String($qualitiesSelect.val() || "none").toLowerCase();

  // NEW: when "none" is chosen, show an empty list and no qualities
  if (catKey === "none") {
    currentQualities = [];
    $qualitiesList.html("");  // empty scrollbox (by request)
    const kind = html.find('input[name="itemType"]:checked').val();
    renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
    updateCost();                            // ← NEW
    return;
  }

  const catList = Array.isArray(qualitiesRoot[catKey]) ? qualitiesRoot[catKey] : [];
  currentQualities = catList.filter(q => matchesAppliesTo(q, type));

  if (!currentQualities.length) {
    $qualitiesList.html("");
    const kind = html.find('input[name="itemType"]:checked').val();
    renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
    updateCost();                            // ← NEW
    return;
  }

  const items = currentQualities.map((q, i) =>
    `<div class="if-quality" data-idx="${i}" style="padding:4px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(qualityDisplayName(q, type))}</div>`
  ).join("");
  $qualitiesList.html(items);

  wireSelectableList($qualitiesList, ".if-quality", {
    onSelect: () => {
      const kind = html.find('input[name="itemType"]:checked').val();
      renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
      updateCost();                          // ← NEW
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
  renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
  updateCost(); // ensure cost updates with +1, +4, or element
};

$dlg.off('.ifPrev');
$dlg.on('change.ifPrev',
  '#optAttrA, #optAttrB, #optPlusOne, #optPlusDamage, #optToggleHand, #optElement, #optFee',
  refreshPreviewFromUI
);
        
        $qualitiesSelect.on("change", () => {
  const kind = html.find('input[name="itemType"]:checked').val();
  renderQualities(kind);
  renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
});

        // Re-render preview icon when the dial changes (even before templates arrive)
        html.on("change", 'input[name="itemType"]', (ev) => {
          const kind = ev.currentTarget.value;
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
