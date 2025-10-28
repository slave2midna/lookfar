import { dataLoader } from "./dataLoader.js";

(function registerItemForge() {

  // ----------------------------
  // Safe accessors to module data
  // ----------------------------
  const getEquipmentRoot = () =>
      dataLoader?.equipmentData || dataLoader || {};

  const getQualitiesRoot = () =>
      dataLoader?.qualitiesData || dataLoader?.qualities || null;

  // Tolerant getters
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

  // Shows the most specific per-type name first, with fallbacks.
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

  // ----------------------------
  // Category filter options (label -> key in qualities.json)
  // ----------------------------
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

  // ----------------------------
  // Dialog builder
  // ----------------------------
  const ATTR_ROW_FIXED_HEIGHT = "30px";

  const content = `
<div id="if-body">
  <form>
    <div style="display:flex; gap:4px; align-items:flex-start; min-width:0; margin-bottom:0;">
      <!-- COLUMN 1 (60%) -->
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
            <div id="attrInner" style="display:flex; gap:4px; align-items:center; flex-wrap:wrap; height:${ATTR_ROW_FIXED_HEIGHT}; box-sizing:border-box;">
              <!-- Filled when weapon; otherwise left empty -->
            </div>
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

      <!-- COLUMN 2 (40%) -->
      <div style="flex:0 0 40%; min-width:0; display:flex; flex-direction:column;">
        <fieldset>
          <legend>Customize</legend>
          <div id="customizeArea" style="width:100%; height:100px;"></div>
        </fieldset>

        <fieldset>
          <legend>Qualities</legend>
          <!-- Category filter sits above the scroll box -->
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

    <!-- MATERIALS -->
    <fieldset style="margin:0 0 6px 0;">
      <legend>Materials</legend>
      <div id="materialsDrop"
           aria-label="Materials drop zone"
           style="
             min-height:72px;
             border:1px dashed #999;
             display:flex;
             align-items:center;
             justify-content:center;
             gap:8px;
             padding:6px;
             box-sizing:border-box;
             user-select:none;
           ">
        <div id="materialsHint" style="opacity:0.6; font-size:12px;">
          Drag & drop Item documents here (max 5)
        </div>
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
            const chosenT = $selT.data('name');
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

        const materials = [];

        const getNameSafe = (r) => esc(getName(r));
        const findWeaponByTemplateName = (name) => {
          if (!name) return null;
          const lower = String(name).toLowerCase();
          return getWeaponList(equipmentRoot).find(w => String(getName(w)).toLowerCase() === lower) ?? null;
        };
        const getItemImage = (item) =>
          item?.img || item?.texture?.src || item?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";

        // ---------- Shared selectable list behavior ----------
        const wireSelectableList = ($container, itemSel, { onSelect } = {}) => {
          const $items = $container.find(itemSel);
          // hover
          $items.on("mouseenter", function() {
            if (this.dataset.selected === "1") return;
            $(this).css({ backgroundColor: "rgba(0,0,0,0.08)" });
          }).on("mouseleave", function() {
            if (this.dataset.selected === "1") return;
            $(this).css({ backgroundColor: "", color: "" });
          });

          // click select
          $items.on("click", function() {
            $container.find(itemSel).each(function() {
              this.dataset.selected = "";
              $(this).css({ backgroundColor: "", color: "" });
            });
            this.dataset.selected = "1";
            $(this).css({ backgroundColor: "rgba(65,105,225,1)", color: "white" });
            onSelect?.(this);
          });

          // auto-select first item if any
          const $first = $items.first();
          if ($first.length) $first.trigger("click");
        };

        // ---------- Materials ----------
        const renderMaterials = () => {
          $materialsDrop.children('img[data-mat="1"]').remove();
          if (materials.length === 0) {
            $materialsHint.show();
          } else {
            $materialsHint.hide();
            materials.forEach((m, i) => {
              const $img = $(`
                <img data-mat="1" data-index="${i}" src="${esc(m.img)}" title="Click to remove: ${esc(m.name || "")}"
                     style="width:48px; height:48px; object-fit:contain; image-rendering:auto; cursor:pointer;">
              `);
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
          .on("dragover", (ev) => {
            ev.preventDefault();
            $materialsDrop.css("background", "rgba(65,105,225,0.08)");
          })
          .on("dragleave", () => {
            $materialsDrop.css("background", "");
          })
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

        // ---------- Templates ----------
        const renderTemplates = (rows) => {
          if (!Array.isArray(rows) || !rows.length) {
            $templateList.html(`<div style="text-align:center; opacity:0.75;">No templates found.</div>`);
            return;
          }
          const items = rows.map((r, i) =>
            `<div class="if-template" data-index="${i}" data-name="${getNameSafe(r)}" style="padding:4px; cursor:pointer;">${getNameSafe(r)}</div>`
          ).join("");
          $templateList.html(items);

          wireSelectableList($templateList, ".if-template", {
            onSelect: () => updateHandToggle()
          });
        };

        // ---------- Qualities (category + appliesTo + selectable) ----------
        const renderQualities = (type) => {
          if (!qualitiesRoot || typeof qualitiesRoot !== "object") {
            $qualitiesList.html(`<div style="text-align:center;">No qualities data.</div>`);
            return;
          }
          const catKey = String($qualitiesSelect.val() || "basic").toLowerCase();
          const catList = Array.isArray(qualitiesRoot[catKey]) ? qualitiesRoot[catKey] : [];
          const filtered = catList.filter(q => matchesAppliesTo(q, type));

          if (!filtered.length) {
            $qualitiesList.html(`<div style="text-align:center; opacity:0.75;">No ${catKey} ${type} qualities.</div>`);
            return;
          }
          const items = filtered.map((q, i) =>
            `<div class="if-quality" data-qindex="${i}" style="padding:4px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(qualityDisplayName(q, type))}</div>`
          ).join("");
          $qualitiesList.html(items);

          // make the qualities list selectable with hover + default selection
          wireSelectableList($qualitiesList, ".if-quality", {
            onSelect: () => {/* wiring later */}
          });
        };

        // ---------- Attrs ----------
        const renderAttrs = (type) => {
          if (type !== "weapon") {
            $attrInner.html("");
            return;
          }
          $attrInner.html(`
            <label>Attr A:
              <select id="optAttrA" style="max-width:160px;">
                <option value="MIG">MIG</option>
                <option value="DEX">DEX</option>
                <option value="INS">INS</option>
                <option value="WLP">WLP</option>
              </select>
            </label>
            <label>Attr B:
              <select id="optAttrB" style="max-width:160px;">
                <option value="MIG">MIG</option>
                <option value="DEX">DEX</option>
                <option value="INS">INS</option>
                <option value="WLP">WLP</option>
              </select>
            </label>
          `);
        };

        // ---------- Customize ----------
        const renderCustomize = (type) => {
          if (type !== "weapon") {
            $customize.html(`<div style="opacity:0.8;">No Options</div>`);
            return;
          }
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
                <input type="checkbox" id="optToggleHand">
                <span id="handToggleLabel"></span>
              </label>
              <label>Type:
                <select id="optElement" style="max-width:160px;">
                  <option value="physical" selected>Physical</option>
                  <option value="fire">Fire</option>
                  <option value="ice">Ice</option>
                  <option value="earth">Earth</option>
                  <option value="air">Air</option>
                  <option value="bolt">Bolt</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="poison">Poison</option>
                </select>
              </label>
            </div>
          `);
        };

        // ---------- Populate ----------
        const populateTemplates = (kind) => {
          const data = kind === "armor" ? getArmorList(equipmentRoot)
                     : kind === "shield" ? getShieldList(equipmentRoot)
                     : kind === "accessory" ? getAccessoryList(equipmentRoot)
                     : getWeaponList(equipmentRoot);
          renderTemplates(data);
        };

        const updateHandToggle = () => {
          const kind = html.find('input[name="itemType"]:checked').val();
          const $wrap = html.find("#handToggleWrap");
          const $labelSpan = html.find("#handToggleLabel");
          const $checkbox = html.find("#optToggleHand");
          if (kind !== "weapon") return $wrap.hide();

          const $sel = html.find('#templateList [data-selected="1"]');
          const name = $sel.data("name");
          if (!name) return $wrap.hide();

          const base = findWeaponByTemplateName(name);
          const h = normHand(base?.hand);
          if (h === "2") { $labelSpan.text("Make 1-handed"); $wrap.show(); $checkbox.prop("checked", false); }
          else if (h === "1") { $labelSpan.text("Make 2-handed"); $wrap.show(); $checkbox.prop("checked", false); }
          else $wrap.hide();
        };

        const updateForKind = (kind) => {
          populateTemplates(kind);
          renderCustomize(kind);
          renderAttrs(kind);
          renderQualities(kind); // respects current category
          if (kind !== "weapon") updateHandToggle();
          relayout();
        };

        // Category change re-filters without altering other state
        $qualitiesSelect.on("change", () => {
          const kind = html.find('input[name="itemType"]:checked').val();
          renderQualities(kind);
        });

        updateForKind("weapon");
        renderMaterials();
        html.on("change", 'input[name="itemType"]', (ev) => updateForKind(ev.currentTarget.value));
      }
    }, { resizable: false });

    dlg.render(true);
  }

  Hooks.on("lookfarShowItemForgeDialog", () => {
    try {
      openItemForgeDialog();
    } catch (err) {
      console.error("[Item Forger] failed to open:", err);
      ui.notifications?.error("Item Forger: failed to open (see console).");
    }
  });

})();
