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

  const flattenQualities = (qRoot) => {
    if (!qRoot || typeof qRoot !== "object") return [];
    return Object.values(qRoot).filter(Array.isArray).flat().filter(Boolean);
  };

  const matchesAppliesTo = (q, type) => {
    const at = Array.isArray(q?.appliesTo) ? q.appliesTo : [];
    return at.some(x => String(x).toLowerCase() === String(type).toLowerCase());
  };

  const qualityDisplayName = (q, type) => {
    if (type === "weapon") return q.weaponName ?? q.name ?? "(Unnamed)";
    if (type === "armor")  return q.armorName  ?? q.name ?? "(Unnamed)";
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
          <div id="qualitiesList" aria-label="Qualities list"
               style="width:100%; height:212px; overflow-y:auto; border:1px solid #999; box-sizing:border-box;">
            <div>Loading…</div>
          </div>
        </fieldset>
      </div>
    </div>

    <!-- MATERIALS (no top margin now) -->
    <fieldset style="margin:0;">
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
    const qualitiesCache = flattenQualities(qualitiesRoot);

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

        const $templateList   = html.find("#templateList");
        const $qualitiesList  = html.find("#qualitiesList");
        const $customize      = html.find("#customizeArea");
        const $attrInner      = html.find("#attrInner");
        const $materialsDrop  = html.find("#materialsDrop");
        const $materialsHint  = html.find("#materialsHint");

        const materials = [];

        const getNameSafe = (r) => esc(getName(r));
        const findWeaponByTemplateName = (name) => {
          if (!name) return null;
          const lower = String(name).toLowerCase();
          return getWeaponList(equipmentRoot).find(w => String(getName(w)).toLowerCase() === lower) ?? null;
        };
        const getItemImage = (item) =>
          item?.img || item?.texture?.src || item?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";

        const renderMaterials = () => {
          $materialsDrop.children('img[data-mat="1"]').remove();
          if (materials.length === 0) {
            $materialsHint.show();
          } else {
            $materialsHint.hide();
            materials.forEach((m, i) => {
              const $img = $(
                `<img data-mat="1" data-index="${i}" src="${esc(m.img)}" title="Click to remove: ${esc(m.name || "")}"
                      style="width:48px; height:48px; object-fit:contain; image-rendering:auto; cursor:pointer;">`
              );
              // click to remove that material
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
            let raw = dt.getData("text/plain");
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
          if (!Array.isArray(rows) || !rows.length) {
            $templateList.html(`<div style="text-align:center; opacity:0.75;">No templates found.</div>`);
            return;
          }
          const items = rows.map((r, i) =>
            `<div data-index="${i}" data-name="${getNameSafe(r)}" style="padding:4px; cursor:pointer;">${getNameSafe(r)}</div>`
          ).join("");
          $templateList.html(items);
          $templateList.find("div[data-index]").on("click", function() {
            $templateList.find("div[data-index]").css({ backgroundColor: "", color: "" }).attr("data-selected", "");
            $(this).css({ backgroundColor: "rgba(65,105,225,1)", color: "white" }).attr("data-selected", "1");
            updateHandToggle();
          });
          const first = $templateList.find("div[data-index]").first();
          if (first.length) first.trigger("click");
        };

        const renderQualities = (type) => {
          if (!Array.isArray(qualitiesCache) || !qualitiesCache.length) {
            $qualitiesList.html(`<div style="text-align:center;">No qualities data.</div>`);
            return;
          }
          const filtered = qualitiesCache.filter(q => matchesAppliesTo(q, type));
          if (!filtered.length) {
            $qualitiesList.html(`<div style="text-align:center; opacity:0.75;">No ${type} qualities.</div>`);
            return;
          }
          const items = filtered.map((q, i) =>
            `<div data-qindex="${i}" style="padding:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(qualityDisplayName(q, type))}</div>`
          ).join("");
          $qualitiesList.html(items);
        };

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
          renderQualities(kind);
          renderCustomize(kind);
          renderAttrs(kind);
          if (kind !== "weapon") updateHandToggle();
          relayout();
        };

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
