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

        <fieldset>
          <legend>Qualities</legend>
          <div style="margin-bottom:4px;">
            <select id="qualitiesCategory" style="width:100%;">
              ${CATEGORY_OPTIONS.map(([label, key]) => `<option value="${key}" ${key==='basic'?'selected':''}>${label}</option>`).join("")}
            </select>
          </div>
          <div id="qualitiesList" aria-label="Qualities list"
               style="width:100%; height:182px; overflow-y:auto; border:1px solid #999; box-sizing:border-box;">
            <div>Loading…</div>
          </div>
        </fieldset>
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

        const getNameSafe = (r) => esc(getName(r));
        const getItemImage = (item) =>
          item?.img || item?.texture?.src || item?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";

        // ---------- icons (top-of-preview) ----------
        const getKindIcon = (kind) => ({
          weapon:    "icons/svg/sword.svg",
          shield:    "icons/svg/shield.svg",
          armor:     "icons/svg/armor.svg",
          accessory: "icons/svg/bag.svg"
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
      #if-preview-icon{ width:32px; height:32px; object-fit:contain; image-rendering:auto; }
      #if-preview-rows{ width:100%; display:flex; flex-direction:column; gap:4px; }
      .if-row{ width:100%; text-align:center; font-size:11px; line-height:1.15;
               white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .if-muted{ opacity:0.7; }
      .if-tight{ letter-spacing:0.2px; }
      /* NEW: wrapped quality description row with padding so it doesn't touch border */
      .if-row-desc {
  width: 100%;
  text-align: center;         /* ← centered text */
  font-size: 11px;
  line-height: 1.2;
  white-space: normal;        /* allow wrapping */
  overflow: hidden;
  padding: 4px 8px;           /* breathing room */
  box-sizing: border-box;
}
    </style>
  `;

  const kindNow = html.find('input[name="itemType"]:checked').val();
  if (kind !== "weapon" || kindNow !== "weapon") {
    $preview.html(`${style}
      <div id="if-preview-card">
        <img id="if-preview-icon" src="${icon}">
        <div id="if-preview-rows" class="if-muted">
          <div class="if-row">Preview coming soon…</div>
        </div>
      </div>
    `);
    return;
  }

  // weapon selection
  const $sel = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
  const idx = Number($sel.data("idx"));
  const w   = Number.isFinite(idx) ? currentTemplates[idx] : null;

  // row 1
  const row1_hand     = w?.hand ?? "—";
  const row1_type     = w?.type ?? "—";
  const row1_category = w?.category ?? w?.cat ?? "—";

  // row 2 (requested format)
  const a   = (w?.attrA ?? "—").toString().toUpperCase();
  const b   = (w?.attrB ?? "—").toString().toUpperCase();
  const acc = (w?.accuracy ?? w?.acc ?? "—");
  const dmg = (w?.damage   ?? w?.dmg ?? "—");
  const ele = (w?.element  ?? "physical");
  const row2 = `【${a} + ${b}】+ ${acc} | HR+${dmg} | ${ele}`;

  // NEW: Quality description (from selected quality in the right scroll box)
  const $qsel = html.find('#qualitiesList [data-selected="1"]').first();
  const qIdx  = Number($qsel.data("idx"));
  const q     = Number.isFinite(qIdx) ? currentQualities[qIdx] : null;
  const qdesc = q?.description ?? q?.desc ?? "";  // tolerate "desc" fallback

  $preview.html(`${style}
    <div id="if-preview-card">
      <img id="if-preview-icon" src="${icon}">
      <div id="if-preview-rows">
        <div class="if-row if-tight">
          ${esc(clip(row1_hand,12))} • ${esc(clip(row1_type,12))} • ${esc(clip(row1_category,14))}
        </div>
        <div class="if-row if-tight">
          ${esc(clip(row2, 64))}
        </div>
        <div class="if-row-desc">${esc(qdesc)}</div>
      </div>
    </div>
  `);
};

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
            }
          });
        };

        const renderQualities = (type) => {
  if (!qualitiesRoot || typeof qualitiesRoot !== "object") {
    $qualitiesList.html(`<div style="text-align:center;">No qualities data.</div>`);
    currentQualities = [];
    // also reflect that there is no quality description
    const kind = html.find('input[name="itemType"]:checked').val();
    renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
    return;
  }
  const catKey  = String($qualitiesSelect.val() || "basic").toLowerCase();
  const catList = Array.isArray(qualitiesRoot[catKey]) ? qualitiesRoot[catKey] : [];
  currentQualities = catList.filter(q => matchesAppliesTo(q, type));

  if (!currentQualities.length) {
    $qualitiesList.html(`<div style="text-align:center; opacity:0.75;">No ${catKey} ${type} qualities.</div>`);
    const kind = html.find('input[name="itemType"]:checked').val();
    renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
    return;
  }

  const items = currentQualities.map((q, i) =>
    `<div class="if-quality" data-idx="${i}" style="padding:4px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(qualityDisplayName(q, type))}</div>`
  ).join("");
  $qualitiesList.html(items);

  // when a quality is selected, update preview to show its description
  wireSelectableList($qualitiesList, ".if-quality", {
    onSelect: () => {
      const kind = html.find('input[name="itemType"]:checked').val();
      renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
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
          const $wrap = html.find("#handToggleWrap");
          const $labelSpan = html.find("#handToggleLabel");
          const $checkbox = html.find("#optToggleHand");
          if (kind !== "weapon") return $wrap.hide();

          const $sel = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
          const idx = Number($sel.data("idx"));
          const base = Number.isFinite(idx) ? currentTemplates[idx] : null;
          const h = normHand(base?.hand);

          if (h === "2") { $labelSpan.text("Make 1-handed"); $wrap.show(); $checkbox.prop("checked", false); }
          else if (h === "1") { $labelSpan.text("Make 2-handed"); $wrap.show(); $checkbox.prop("checked", false); }
          else $wrap.hide();
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
        };

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
