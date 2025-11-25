import {dataLoader} from "./dataLoader.js";

// load equipment templates
const getEquipmentRoot = () => dataLoader?.equipmentData || dataLoader || {};

// load quality categories
const getQualitiesRoot = () => dataLoader?.qualitiesData || dataLoader?.qualities || null;

// equipment lists
const getWeaponList = d => d?.weapons?.weaponList ?? d?.weaponsData?.weaponList ?? d?.weaponList ?? [];
const getArmorList = d => d?.armor?.armorList ?? d?.armorData?.armorList ?? d?.armorList ?? [];
const getShieldList = d => d?.shields?.shieldList ?? d?.shieldsData?.shieldList ?? d?.shieldList ?? [];
const getAccessoryList = d => d?.accessories?.accessoryList ?? d?.accessoriesData?.accessoryList ?? d?.accessoryList ?? [];

const getName = r => r?.name ?? r?.weaponName ?? r?.armorName ?? r?.shieldName ?? r?.accessoryName ?? "(Unnamed)";
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
  if (type === "weapon") return q.weaponName ?? q.name ?? "(Unnamed)";
  if (type === "armor") return q.armorName ?? q.name ?? "(Unnamed)";
  if (type === "shield") return q.shieldName ?? q.name ?? "(Unnamed)";
  if (type === "accessory") return q.accessoryName ?? q.name ?? "(Unnamed)";
  return q.name ?? "(Unnamed)";
};

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

// --- Setting Helpers ----------------------------------------------

// Item Forge edit mode
const getItemForgeEditMode = () => {
  try {
    return game.settings.get("lookfar", "itemForgeEditMode") || "gmOnly";
  } catch {
    return "gmOnly";
  }
};

// Public mode: collabortive, allows players and GM to control dialog
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

// --- FU Socket Helpers ----------------------------------------------

// Message names (unique within FU socket handler)
const IF_MSG = {
  HostOpen:          "lookfar:itemforge:host-open",
  HostClose:         "lookfar:itemforge:host-close",
  MaterialsRequest:  "lookfar:itemforge:materials-request",
  MaterialsReplace:  "lookfar:itemforge:materials-replace",
  MaterialsAdd:      "lookfar:itemforge:materials-add",
  MaterialsRemove:   "lookfar:itemforge:materials-remove",
  MaterialsNotify:   "lookfar:itemforge:materials-notify",
  UIStateReplace:    "lookfar:itemforge:ui-state-replace",
};

let _forgeAppId = null;      // window id for GM full forge dialog (on this client)
let _miniAppId  = null;      // window id for player mini dialog (on this client)
let _hostId     = null;      // userId of the authoritative GM host
let _materials  = [];        // authoritative list (on host) OR mirrored list (on players)
let _socketInit = false;
let _requiredOriginKey = ""; // current origin requirement (from GM's quality selection)

function isForgeOpen() {
  return !!(_forgeAppId && ui.windows[_forgeAppId]);
}
function isMiniOpen() {
  return !!(_miniAppId && ui.windows[_miniAppId]);
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
      sock.executeForEveryone(IF_MSG.MaterialsReplace, { materials: _materials, originReq: _requiredOriginKey });
    }
  });

  // Host is closing
  sock.register(IF_MSG.HostClose, (payload) => {
    if (_hostId === (payload?.hostId ?? null)) _hostId = null;
  });

  // A client (mini or fresh joiner) asks the host for the latest materials
  sock.register(IF_MSG.MaterialsRequest, (_payload, msg) => {
    if (game.user.isGM && game.user.id === _hostId) {
      sock.executeForUsers(IF_MSG.MaterialsReplace, [msg.sender], { materials: _materials, originReq: _requiredOriginKey });
    }
  });

  // Everyone: receive authoritative materials
  sock.register(IF_MSG.MaterialsReplace, (payload) => {
    _materials = Array.isArray(payload?.materials) ? payload.materials.slice(0, 5) : [];
    _requiredOriginKey = String(payload?.originReq || "").toLowerCase();

    try {
      // Push into ANY open Item Forger window on this client
      for (const [id, app] of Object.entries(ui.windows)) {
        const html = app?.element;
        if (!html?.length) continue;

        // Only touch windows that have our materials drop zone
        const $drop = html.find('#materialsDrop');
        if (!$drop.length) continue;

        html.data('ifMaterials', _materials);
        html.data('ifRequiredOriginKey', _requiredOriginKey);
        $drop.trigger('repaint');
      }
    } catch (e) {
      console.warn("[Item Forger] MaterialsReplace repaint failed:", e);
    }
  });

  // Player proposes ADD (host validates → updates → broadcasts)
  sock.register(IF_MSG.MaterialsAdd, async (payload, msg) => {
    if (!(game.user.isGM && game.user.id === _hostId)) return; // only host mutates

    // Helper: warn the user who attempted the add (or fallback to host)
    const warnUser = (text) => {
      const targetId = msg?.sender;
      if (targetId && game.projectfu?.socket) {
        // Show the warning only on the client who initiated the drag
        game.projectfu.socket.executeForUsers(IF_MSG.MaterialsNotify, [targetId], { text });
      } else {
        // Fallback: host sees the warning (shouldn’t happen often)
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
        warnUser("You do not have any more of this item.");
        return;
      }

      // How many times this uuid is already in the materials list
      const alreadyUsed = _materials.filter(m => m.uuid === uuid).length;
      if (alreadyUsed >= qty) {
        warnUser("You do not have any more of this item.");
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
      sock.executeForEveryone(IF_MSG.MaterialsReplace, { materials: _materials, originReq: _requiredOriginKey });
    } catch (e) {
      console.error("[Item Forger] MaterialsAdd failed:", e);
    }
  });

  // Player proposes REMOVE by index or uuid (host validates → updates → broadcasts)
  sock.register(IF_MSG.MaterialsRemove, (payload) => {
    if (!(game.user.isGM && game.user.id === _hostId)) return; // only host mutates
    const { index, uuid } = payload ?? {};
    if (!Array.isArray(_materials) || !_materials.length) return;

    let newList = _materials;
    if (Number.isInteger(index)) {
      newList = _materials.filter((_m, i) => i !== index);
    } else if (uuid) {
      newList = _materials.filter(m => m.uuid !== uuid);
    }
    _materials = newList;
    sock.executeForEveryone(IF_MSG.MaterialsReplace, { materials: _materials, originReq: _requiredOriginKey });
  });

  // UI state replace (item type, template, qualities, toggles, etc.)
  sock.register(IF_MSG.UIStateReplace, (payload) => {
    if (!isItemForgeSharedMode()) return;
    const state = payload?.state;
    if (!state) return;

    try {
      // Call the handler attached by each full Item Forger dialog
      for (const app of Object.values(ui.windows)) {
        if (typeof app?._applyForgeStateFromSocket === "function") {
          app._applyForgeStateFromSocket(state);
        }
      }
    } catch (e) {
      console.warn("[Item Forger] UIStateReplace apply failed:", e);
    }
  });
}

// --- Cost Helpers ------------------------------------------------------------ //

const asAttrKey = (s) => {
  const v = String(s ?? "").toLowerCase();
  return (v === "mig" || v === "dex" || v === "ins" || v === "wlp") ? v : "";
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

// resolve equipment.json cost value
const getEquipCost = (r) => toInt(r?.cost ?? r?.value ?? r?.data?.cost ?? r?.data?.cost?.value ?? 0);

// resolve qualities.json cost value
const getQualityCost = (q) => toInt(q?.cost ?? 0);

// resolve material item cost value
const getTreasureCost = (doc) => toInt(doc?.system?.cost?.value ?? doc?.system?.value ?? doc?.system?.cost ?? doc?.cost ?? 0);

// resolve material origin value
const getTreasureOrigin = (doc) => String(doc?.system?.origin?.value ?? "").trim().toLowerCase();

// resolve origin requirement for specific quality
const getRequiredOriginKey = (html) => {
  const key = String(html.find('#qualitiesCategory').val() || "none").toLowerCase();
  // No origin requirement for "none", "basic", or "custom"
  return (key === "none" || key === "basic" || key === "custom") ? "" : key;
};

// --- Item Helpers ------------------------------------------------------------ //

// Read custom-quality value
const readCustomQuality = (html) => {
  const eff = String(html.find('#customEffect').val() ?? html.data('customEffect') ?? '').trim();
  const raw = String(html.find('#customCost').val() ?? html.data('customCost') ?? '');
  const cost = Math.max(0, parseInt(raw.replace(/\D+/g, ''), 10) || 0);
  return { eff, cost };
};

const getSelectedBase = (html, currentTemplates) => {
  const $sel = html.find('#templateList [data-selected="1"]').first();
  const idx = Number($sel.data("idx"));
  return Number.isFinite(idx) ? currentTemplates[idx] : null;
};

const getSelectedQualityInfo = (html, currentQualities) => {
  const catKey = String(html.find('#qualitiesCategory').val() || "none").toLowerCase();
  if (catKey === "custom") {
    const { eff, cost } = readCustomQuality(html);
    return {
      desc: eff || "No quality",
      cost
    };
  }
  if (catKey === "none" || !currentQualities?.length) {
    return {
      desc: "No quality",
      cost: 0
    };
  }
  const $q = html.find('#qualitiesList [data-selected="1"]').first();
  const qi = Number($q.data("idx"));
  const q = Number.isFinite(qi) ? currentQualities[qi] : null;
  return {
    desc: q?.description ?? q?.desc ?? "No quality",
    cost: Number(q?.cost ?? 0) || 0
  };
};

const getPreviewIcon = (html, fallback) => {
  const override = html.data('iconOverride');
  if (override) return override;
  const src = html.find('#if-preview-icon').attr('src');
  return src || fallback || "icons/svg/mystery-man.svg";
};

const validateMaterialsOrigin = (html, materials) => {
  const needKey = getRequiredOriginKey(html);
  if (!needKey) return true;
  const ok = materials.some(m => String(m.origin) === needKey);
  if (!ok) ui.notifications?.warn(`This quality requires at least one ${needKey} material.`);
  return ok;
};

// Compute both "worth" (item value) and "craft" (cost to forge now).
const getCurrentCosts = (html, tmpl, currentQualities) => {
  const base = getEquipCost(tmpl);

  // Handles quality cost
  const catKey = String(html.find('#qualitiesCategory').val() || 'none').toLowerCase();
  let qcost = 0;
  if (catKey === 'custom') {
    const { cost } = readCustomQuality(html);
    qcost = toInt(cost);
  } else if (catKey !== 'none') {
    const $q = html.find('#qualitiesList [data-selected="1"]').first();
    const qi = Number($q.data('idx'));
    const qual = Number.isFinite(qi) ? currentQualities[qi] : null;
    qcost = getQualityCost(qual);
  }

  // Handles weapon surcharges
  const kind = html.find('input[name="itemType"]:checked').val();
  let custom = 0;
  if (kind === 'weapon') {
    const plus1 = html.find('#optPlusOne').is(':checked');
    const plus4 = html.find('#optPlusDamage').is(':checked');
    const eleSel = (html.find('#optElement').val() || 'physical').toString();
    if (plus1) custom += 100;
    if (plus4) custom += 200;
    if (eleSel !== 'physical') custom += 100;

    const baseA = String(tmpl?.attrA ?? '').toUpperCase();
    const baseB = String(tmpl?.attrB ?? '').toUpperCase();
    const selA = String(html.find('#optAttrA').val() || baseA).toUpperCase();
    const selB = String(html.find('#optAttrB').val() || baseB).toUpperCase();
    const isMatchingNow = selA && selB && (selA === selB);
    const sameAsOriginalPair = (selA === baseA) && (selB === baseB);
    if (isMatchingNow && !sameAsOriginalPair) custom += 50;
  }

  // Handles materials subtotal
  const materials = html.data('ifMaterials') || [];
  const matTotal = materials.reduce((s, m) => s + toInt(m.cost), 0);

  // Output seperate cost values
  const worth = Math.max(0, base + qcost + custom); // saves to crafted item
  let craft = Math.max(0, worth - matTotal);        // shows in dialog

  // Apply a 10% fee by default, unless "No Fee" is checked.
  // Fee is applied after all surcharges and materials, rounded down.
  const noFee = html.find('#optFee').is(':checked');
  if (!noFee) {
    craft = Math.floor(craft * 1.10);
  }

  return {
    worth,
    craft
  };
};

// Playtest damage: +2 damage per full 1000 worth (no fee)
const getVariantDamageBonus = (worth) => {
  if (!useVariantDamageRules()) return 0;
  const tier = Math.floor(toInt(worth) / 1000); // 0–999 → 0, 1000–1999 → 1, etc.
  return tier > 0 ? tier * 2 : 0;               // each tier is +2 damage
};

// Recalculate weapon stats based on UI toggles
const computeWeaponStats = (base, html, worthOverride) => {

  const variant = useVariantDamageRules();

  const baseHand = normHand(base?.hand) || null; // "1" | "2" | null
  const plus1 = html.find('#optPlusOne').is(':checked');
  const plus4 = html.find('#optPlusDamage').is(':checked');
  const flip  = html.find('#optToggleHand').is(':checked');
  const selA  = String(html.find('#optAttrA').val() || base?.attrA || "").toUpperCase();
  const selB  = String(html.find('#optAttrB').val() || base?.attrB || "").toUpperCase();
  const elementVal = (html.find('#optElement').val() || base?.element || "physical").toString();

  // hands
  let handsOut = base?.hand || "";
  if (flip && (baseHand === "1" || baseHand === "2")) {
    handsOut = (baseHand === "1") ? "two-handed" : "one-handed";
  }

  // damage & accuracy
  const handMod = (flip && baseHand === "2") ? -4 :
                  (flip && baseHand === "1") ? +4 :
                  0;

  const accOut = (Number(base?.accuracy ?? base?.acc ?? 0) || 0) + (plus1 ? 1 : 0);

  let dmgOut = (Number(base?.damage ?? base?.dmg ?? 0) || 0)
             + (plus4 ? 4 : 0)        // this will effectively never apply when variant rules are on, because the checkbox is disabled
             + handMod;

  // Variant rules: add scaling bonus based on worth (no fee)
  if (variant) {
    const worthVal = toInt(worthOverride);
    dmgOut += getVariantDamageBonus(worthVal);
  }

  // isMartial:
  // - NORMAL: true if dmg >= 10 OR base is already martial.
  // - VARIANT: do NOT auto-upgrade based on damage; just respect base.isMartial.
  const isMartialEffective = variant
    ? !!base?.isMartial
    : ((Number.isFinite(dmgOut) && dmgOut >= 10) || !!base?.isMartial);

  return {
    hands: handsOut,
    attrs: {
      A: selA,
      B: selB
    },
    acc: accOut,
    dmg: dmgOut,
    dmgType: elementVal,
    isMartial: isMartialEffective
  };
};

// Build itemData for the selected item.
const buildItemData = (kind, html, {
  currentTemplates,
  currentQualities
}) => {
  const base = getSelectedBase(html, currentTemplates);
  if (!base) throw new Error("No template selected.");

  const {
    desc: qualDesc
  } = getSelectedQualityInfo(html, currentQualities);
  const img = getPreviewIcon(html, dataLoader.getRandomIconFor(kind, base));
  const $t = html.find('#templateList [data-selected="1"]').first();
  const ti = Number($t.data("idx"));
  const tmpl = Number.isFinite(ti) ? currentTemplates[ti] : null;
  const { worth } = getCurrentCosts(html, tmpl, currentQualities);
  const costField = worth;

  // handle weapon item data.
  if (kind === "weapon") {
    const w = computeWeaponStats(base, html, worth);
    return {
      name: `Crafted ${base?.name ?? "Weapon"}`,
      type: "weapon",
      img,
      system: {
        category: {
          value: base?.category ?? ""
        },
        hands: {
          value: w.hands || ""
        },
        type: {
          value: base?.type ?? ""
        },
        attributes: {
          primary: {
            value: asAttrKey(w.attrs.A)
          },
          secondary: {
            value: asAttrKey(w.attrs.B)
          }
        },
        accuracy: {
          value: w.acc
        },
        defense: "def", // per spec: DEF for now
        damageType: {
          value: w.dmgType || (base?.element ?? "physical")
        },
        damage: {
          value: w.dmg
        },
        isMartial: {
          value: !!w.isMartial
        },
        quality: {
          value: qualDesc || "No quality"
        },
        cost: {
          value: costField
        },
        source: {
          value: "LOOKFAR"
        },
        summary: {
          value: `A finely crafted ${base?.category ?? "weapon"} weapon.`
        }
      }
    };
  }

  // handle armor item data.
  if (kind === "armor") {
    return {
      name: `Crafted ${base?.name ?? "Armor"}`,
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
        init: {
          value: Number(base?.init ?? 0) || 0
        },
        isMartial: {
          value: !!base?.isMartial
        },
        quality: {
          value: qualDesc || "No quality"
        },
        cost: {
          value: costField
        },
        // NOTE: Armor must use scalar source here (system quirk).
        source: "LOOKFAR",
        summary: {
          value: `A set of finely crafted ${base?.isMartial ? "martial" : "non-martial"} armor.`
        }
      }
    };
  }

  // handle shield item data.
  if (kind === "shield") {
    return {
      name: `Crafted ${base?.name ?? "Shield"}`,
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
        init: {
          value: Number(base?.init ?? 0) || 0
        },
        isMartial: {
          value: !!base?.isMartial
        },
        quality: {
          value: qualDesc || "No quality"
        },
        cost: {
          value: costField
        },
        source: {
          value: "LOOKFAR"
        },
        summary: {
          value: `A well crafted ${base?.isMartial ? "martial" : "non-martial"} shield.`
        }
      }
    };
  }

  // handle accessory item data.
  return {
    name: `Crafted ${base?.name ?? "Accessory"}`,
    type: "accessory",
    img,
    system: {
      def: {
        value: Number(base?.def ?? 0) || 0
      },
      mdef: {
        value: Number(base?.mdef ?? 0) || 0
      },
      init: {
        value: Number(base?.init ?? 0) || 0
      },
      quality: {
        value: qualDesc || "No quality"
      },
      cost: {
        value: costField
      },
      source: {
        value: "LOOKFAR"
      },
      summary: {
        value: `A well crafted ${base?.name ?? "Accessory"}.`
      }
    }
  };
};

// --- Dialog Behavior ------------------------------------------------------------//

// Mini Materials Dialog (players & observers) uses item-forge-mini.hbs
async function openMaterialsMiniDialog() {
  ensureIFSocket();

  // singleton mini on this client
  if (isMiniOpen()) {
    ui.windows[_miniAppId]?.bringToTop?.();
    return;
  }

  const content = await renderTemplate("modules/lookfar/templates/item-forge-mini.hbs", {});

  const dlg = new Dialog({
    title: "Item Forger — Materials",
    content,
    buttons: {},
    render: async (html) => {
      const appId = Number(html.closest(".window-app").attr("data-appid"));
      _miniAppId = appId;

      const sock = game.projectfu?.socket;
      html.data('ifMaterials', _materials || []);
      html.data('ifRequiredOriginKey', _requiredOriginKey || "");

      const $dlg = html.closest(".window-app");
      $dlg.css({ width: "420px" });
      const $materialsDrop = html.find("#materialsDrop");
      const $materialsHint = html.find("#materialsHint");

      const relayout = () => {
        const app2 = ui.windows[Number($dlg.attr("data-appid"))];
        if (app2?.setPosition) {
          app2.setPosition({ height: "auto" });
          setTimeout(() => app2.setPosition({ height: "auto" }), 0);
        }
      };

      const renderMaterialsMini = () => {
        const list    = html.data('ifMaterials') || [];
        const needKey = String(html.data('ifRequiredOriginKey') || "").toLowerCase();
        const hasReq  = !needKey || list.some(m => String(m.origin) === needKey);

        $materialsDrop.children('img[data-mat="1"]').remove();

        if (!list.length) {
          if (needKey) {
            $materialsHint.text(`Needs 1 ${needKey} material to craft.`);
          } else {
            $materialsHint.text("Drag & drop Treasure Items here (max 5)");
          }
          $materialsHint.show();
        } else {
          $materialsHint.hide();
          list.forEach((m, i) => {
            const tip = [
              m.name || "",
              m.origin ? `Origin: ${m.origin}` : "",
              Number.isFinite(m.cost) ? `Cost: ${m.cost}` : ""
            ].filter(Boolean).join(" • ");

            const $img = $(`
        <img data-mat="1" data-index="${i}" src="${esc(m.img)}"
             title="Click to request removal\n${esc(tip)}">
      `);

            $img.addClass("lf-if-material-icon");

            // Players click to REQUEST removal (host decides)
            $img.on("click", () => {
              sock?.executeAsGM?.(IF_MSG.MaterialsRemove, { index: i });
            });

            $materialsDrop.append($img);
          });
        }

        // Match main dialog: red border when requirement not satisfied
        $materialsDrop.css({ borderColor: (!hasReq && needKey) ? "red" : "#999" });

        // repaint hook for socket pushes
        html.find('#materialsDrop').off('repaint').on('repaint', () => {
          html.data('ifMaterials', _materials);
          html.data('ifRequiredOriginKey', _requiredOriginKey);
          renderMaterialsMini();
        });

        relayout();
      };

      // Drag & drop to request ADD (host validates)
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

      // Ask the host for the authoritative list immediately
      if (_hostId)  sock?.executeAsUser?.(IF_MSG.MaterialsRequest, _hostId, {});
      else if (game.users.activeGM?.id) sock?.executeAsUser?.(IF_MSG.MaterialsRequest, game.users.activeGM.id, {});

      renderMaterialsMini();
    },
    close: () => { _miniAppId = null; }
  }, { resizable: false });

  dlg.render(true);
}


// Item Forger Dialog (main) uses item-forge.hbs
async function openItemForgeDialog() {
  ensureIFSocket();

  // GM full dialog should be singleton on this client
  if (isForgeOpen()) {
    ui.windows[_forgeAppId]?.bringToTop?.();
    return;
  }

  const equipmentRoot = getEquipmentRoot();
  const qualitiesRoot = getQualitiesRoot();

  let currentTemplates = [];
  let currentQualities = [];

  const content = await renderTemplate("modules/lookfar/templates/item-forge.hbs", {});

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

            const mats = html.data('ifMaterials') || [];
            if (!validateMaterialsOrigin(html, mats)) return false;

            // Only the host GM should ever actually consume items
            if (game.user.isGM && game.user.id === _hostId && Array.isArray(mats) && mats.length) {
              // Count usage per uuid
              const usageByUuid = {};
              for (const m of mats) {
                if (!m?.uuid) continue;
                usageByUuid[m.uuid] = (usageByUuid[m.uuid] || 0) + 1;
              }

              // First pass: verify all quantities are sufficient
              for (const [uuid, used] of Object.entries(usageByUuid)) {
                const doc = await fromUuid(uuid);
                if (!doc || doc.documentName !== "Item") continue;
                const currQty = Number(doc.system?.quantity?.value ?? 0) || 0;
                if (currQty < used) {
                  ui.notifications?.error(
                    `Not enough quantity of ${doc.name} to forge (need ${used}, have ${currQty}).`
                  );
                  return false;  // keep dialog open
                }
              }

              // Second pass: actually subtract
              for (const [uuid, used] of Object.entries(usageByUuid)) {
                const doc = await fromUuid(uuid);
                if (!doc || doc.documentName !== "Item") continue;
                const currQty = Number(doc.system?.quantity?.value ?? 0) || 0;
                const newQty = Math.max(0, currQty - used);
                await doc.update({ "system.quantity.value": newQty });
              }
            }

            const itemData = buildItemData(kind, html, { currentTemplates, currentQualities });
            const created = await Item.create(itemData, { renderSheet: true });
            if (!created) throw new Error("Item creation failed.");
            ui.notifications.info(`${created.name} forged.`);
          } catch (err) {
            console.error("[Item Forger] Forge failed:", err);
            ui.notifications?.error(`Item Forger: ${err.message || "Failed to forge item."}`);
            return false;
          }
        }
      }
    },
    default: "forge",
    render: async (html) => {
      const appId = Number(html.closest(".window-app").attr("data-appid"));
      _forgeAppId = appId;

      const sock = game.projectfu?.socket;

      // Become/announce the host if you're a GM (authoritative copy lives here)
      if (game.user.isGM) {
        _hostId = game.user.id;
        // Use our current in-memory list (might be empty on first open)
        html.data('ifMaterials', _materials);
        sock?.executeForEveryone?.(IF_MSG.HostOpen, { hostId: game.user.id });
        // Immediately share the state
        sock?.executeForEveryone?.(IF_MSG.MaterialsReplace, { materials: _materials, originReq: _requiredOriginKey });
      } else {
        // Non-GM shouldn't have the full dialog; (safety) mirror the list & bail
        html.data('ifMaterials', _materials);
      }

      const $dlg = html.closest(".window-app");
      const $wc  = $dlg.find(".window-content");
      $wc.css({ display: "block", overflow: "visible" });
      $dlg.css({ width: "700px" });

      // Button safety helper
      const setForgeEnabled = (enabled) => {
        const $btn = $dlg.find('button[data-button="forge"]');
        if (!$btn.length) return;
        $btn.prop('disabled', !enabled);
        $btn.css({
          opacity: enabled ? 1 : 0.5,
          filter: enabled ? "" : "grayscale(1)"
        });
      };

      const relayout = () => {
        const app2 = ui.windows[Number($dlg.attr("data-appid"))];
        if (app2?.setPosition) {
          app2.setPosition({ height: "auto" });
          setTimeout(() => app2.setPosition({ height: "auto" }), 0);
        }
      };
      relayout();

      const $templateList    = html.find("#templateList");
      const $qualitiesList   = html.find("#qualitiesList");
      const $qualitiesSelect = html.find("#qualitiesCategory");
      const $customize       = html.find("#customizeArea");
      const $attrInner       = html.find("#attrInner");
      const $materialsDrop   = html.find("#materialsDrop");
      const $materialsHint   = html.find("#materialsHint");
      const $preview         = html.find("#itemPreviewLarge");

      // Hide fee checkbox for non-GM users
      if (!game.user.isGM) {
        html.find('#optFee').closest('label').hide();
      }

      // Locked mode: non-GMs see full dialog but controls are read-only
      const lockControlsForPlayer = !game.user.isGM && isItemForgeLockedMode();
      const restrictInputs = isItemForgeLockedMode();
      const isHostGM = game.user.isGM && game.user.id === _hostId;

      // Apply "read-only" lock to all forge controls for watching players
      const applyLockState = () => {
        if (!lockControlsForPlayer) return;

        // Item type radios
        html.find('input[name="itemType"]').prop('disabled', true);

        // Weapon customize + attrs + fee
        html.find('#optAttrA, #optAttrB, #optPlusOne, #optPlusDamage, #optToggleHand, #optElement, #optFee')
            .prop('disabled', true);

        // Qualities category select
        html.find('#qualitiesCategory').prop('disabled', true);

        // Custom quality controls (if present)
        html.find('#customEffect, #customCost, #customApply').prop('disabled', true);
      };

      // Initial pass (in case some controls exist already)
      applyLockState();

      // --- Shared Forge UI state helpers (only used when visibility is "Public") ---
      let suppressStateBroadcast = false;

      const collectForgeState = () => {
        const kind = html.find('input[name="itemType"]:checked').val() || "weapon";

        const $t = html.find('#templateList [data-selected="1"]').first();
        const tIdxRaw = Number($t.data("idx"));
        const templateIdx = Number.isFinite(tIdxRaw) ? tIdxRaw : null;

        const catKey = String($qualitiesSelect.val() || "none").toLowerCase();
        let qualityIdx = null;
        if (catKey !== "none" && catKey !== "custom") {
          const $q = html.find('#qualitiesList [data-selected="1"]').first();
          const qIdxRaw = Number($q.data("idx"));
          qualityIdx = Number.isFinite(qIdxRaw) ? qIdxRaw : null;
        }

        const plusOne     = html.find('#optPlusOne').is(':checked');
        const plusDamage  = html.find('#optPlusDamage').is(':checked');
        const toggleHand  = html.find('#optToggleHand').is(':checked');
        const element     = (html.find('#optElement').val() || 'physical').toString();
        const attrA       = (html.find('#optAttrA').val() || '').toString();
        const attrB       = (html.find('#optAttrB').val() || '').toString();
        const fee         = html.find('#optFee').is(':checked');

        // Custom quality; if inputs not present, fall back to stored data
        const $customEffect = html.find('#customEffect');
        const $customCost   = html.find('#customCost');
        const customEffect  = $customEffect.length
          ? String($customEffect.val() ?? '').trim()
          : String(html.data('customEffect') ?? '').trim();
        const customCost    = $customCost.length
          ? toInt($customCost.val())
          : toInt(html.data('customCost') ?? 0);

        const previewSrc = html.find('#if-preview-icon').attr('src') || "";
        const iconPath = html.data('iconPath') || previewSrc || "";

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

        // Locked mode: only the host GM is allowed to broadcast.
        // Public mode: any user may broadcast (GM or player),
        if (restrictInputs && !isHostGM) return;

        const sock = game.projectfu?.socket;
        if (!sock) return;

        const state = collectForgeState();
        sock.executeForEveryone(IF_MSG.UIStateReplace, { state });
      };

      // COST updater
      function updateCost() {
        const $val = html.find('#costValue');
        const $t   = html.find('#templateList [data-selected="1"]').first();
        const ti   = Number($t.data("idx"));
        const tmpl = Number.isFinite(ti) ? currentTemplates[ti] : null;
        const { craft } = getCurrentCosts(html, tmpl, currentQualities);
        $val.text(craft);
      }

      const getNameSafe = (r) => esc(getName(r));

      const getItemImage = (item) => {
        if (item?.img) return item.img;

        const kind = html.find('input[name="itemType"]:checked').val(); // "weapon" | "armor" | "shield" | "accessory"
        if (!kind) return item?.texture?.src || item?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";

        const templateId = item?.system?.templateId;
        if (!templateId) return item?.texture?.src || item?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";

        // pick a random icon from the manifest
        const byKindList = {
          weapon: dataLoader.weaponsData?.weaponList,
          armor: dataLoader.armorData?.armorList,
          shield: dataLoader.shieldsData?.shieldList,
          accessory: dataLoader.accessoriesData?.accessoryList
        } [kind] || [];

        const base = byKindList.find(e => e?.id === templateId);
        const img = base ? dataLoader.getRandomIconFor(kind, base) : null;
        if (img) return img;

        return item?.texture?.src || item?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";
      };

      // handles attribute selection
      const applyAttrDefaultsFromTemplate = (selectedEl) => {
        const kind = html.find('input[name="itemType"]:checked').val();
        if (kind !== "weapon") return;

        const $sel = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
        const idx = Number($sel.data("idx"));
        const base = Number.isFinite(idx) ? currentTemplates[idx] : null;

        const $a = html.find('#optAttrA');
        const $b = html.find('#optAttrB');
        if (!$a.length || !$b.length) return;

        const allowed = new Set(["MIG", "DEX", "INS", "WLP"]);
        const a = String(base?.attrA ?? "").toUpperCase();
        const b = String(base?.attrB ?? "").toUpperCase();

        if (allowed.has(a)) $a.val(a);
        if (allowed.has(b)) $b.val(b);
      };

      // handles Preview item card
      const clip = (v, n = 64) => {
        const s = String(v ?? "");
        return s.length > n ? s.slice(0, n - 1) + "…" : s;
      };

      const handLabel = (h) => (h === "1" ? "1-handed" : h === "2" ? "2-handed" : h || "—");

      // NEW: renderPreview now delegates to item-forge-preview.hbs
      function renderPreview(kind, selectedEl, opts = {}) {
        const rerollIcon = !!opts.rerollIcon;

        // cache for auto-picked icons (GM only)
        let iconMap = html.data('autoIconMap');
        if (!iconMap) {
          iconMap = {};
          html.data('autoIconMap', iconMap);
        }

        const override   = html.data('iconOverride');
        const savedPath  = html.data('iconPath');

        const getKindIcon = (k) => ({
          weapon: "icons/svg/sword.svg",
          shield: "icons/svg/shield.svg",
          armor: "icons/svg/statue.svg",
          accessory: "icons/svg/stoned.svg"
        }[k] || "icons/svg/mystery-man.svg");

        const $sel = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
        const idx  = Number($sel.data("idx"));
        const base = Number.isFinite(idx) ? currentTemplates[idx] : null;
        const baseId   = base?.id ?? base?._id ?? getName(base);
        const cacheKey = `${kind}:${String(baseId)}`;

        let icon = getKindIcon(kind);

        if (override) {
          // GM-chosen custom icon (always authoritative)
          icon = override;
          html.data('iconPath', icon);

        } else if (savedPath) {
          // Path that came from ANY client via socket or previous roll
          // Always respected unless a GM override is present.
          icon = savedPath;

        } else if (base && (!restrictInputs || isHostGM)) {
          // In collaborative mode (restrictInputs === false), ANY user can roll
          // a random icon when interacting with the forge (last-touch wins).
          // In restricted mode, only the host GM may do this.
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
          html.data('iconPath', icon);
        }

        try {
          const dir = String(icon || "").includes("/") ? String(icon).replace(/\/[^/]*$/, "/") : "/";
          html.data('lastIconDir', dir);
        } catch {
          /* noop */
        }

        // quality description helper
        const qdesc = () => {
          const catKeyNow = String($qualitiesSelect.val() || "none").toLowerCase();
          if (catKeyNow === "custom") {
            return readCustomQuality(html).eff;
          }
          const $qsel = html.find('#qualitiesList [data-selected="1"]').first();
          const qIdx = Number($qsel.data("idx"));
          const q = Number.isFinite(qIdx) ? currentQualities[qIdx] : null;
          return q?.description ?? q?.desc ?? "";
        };

        const kindNow = html.find('input[name="itemType"]:checked').val();

        const ctx = {
          kind,
          icon,
          isMartial: false,
          muted: false,
          mutedText: "",
          line1: "",
          line2: "",
          desc: ""
        };

        const renderCtx = (context) => {
          return renderTemplate(PREVIEW_TEMPLATE_PATH, context)
            .then(htmlStr => {
              $preview.html(htmlStr);
            })
            .catch(e => {
              console.error("[Item Forger] Failed to render preview template:", e);
              $preview.html(`<div class="if-preview-error">Preview failed (see console).</div>`);
            });
        };

        // dial sanity check
        if (kindNow !== kind) {
          ctx.muted = true;
          ctx.mutedText = "Preview coming soon…";
          return renderCtx(ctx);
        }

        // ---------- ARMOR PREVIEW ----------
        if (kind === "armor") {
          const $sel2 = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
          const idx2 = Number($sel2.data("idx"));
          const a = Number.isFinite(idx2) ? currentTemplates[idx2] : null;

          const isMartial = !!a?.isMartial;
          const defAttr = (a?.defAttr ?? "").toString().toUpperCase();
          const def = (a?.def ?? "—");
          const mdefAttr = (a?.mdefAttr ?? "").toString().toUpperCase();
          const mdef = (a?.mdef ?? "—");
          const init = (a?.init ?? "—");

          const rowArmor = !isMartial ?
            `<strong>DEF:</strong> ${esc(defAttr)}+${esc(def)} | <strong>M.DEF:</strong> ${esc(mdefAttr)}+${esc(mdef)} | <strong>INIT:</strong> ${esc(init)}` :
            `<strong>DEF:</strong> ${esc(def)} | <strong>M.DEF:</strong> ${esc(mdefAttr)}+${esc(mdef)} | <strong>INIT:</strong> ${esc(init)}`;

          ctx.isMartial = isMartial;
          ctx.line1 = rowArmor;
          ctx.desc = esc(qdesc());

          return renderCtx(ctx);
        }

        // ---------- SHIELD PREVIEW ----------
        if (kind === "shield") {
          const $sel2 = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
          const idx2 = Number($sel2.data("idx"));
          const s = Number.isFinite(idx2) ? currentTemplates[idx2] : null;

          const isMartial = !!s?.isMartial;
          const def = (s?.def ?? "—");
          const mdef = (s?.mdef ?? "—");

          const rowShield = `<strong>DEF:</strong> +${esc(def)} | <strong>M.DEF:</strong> +${esc(mdef)}`;

          ctx.isMartial = isMartial;
          ctx.line1 = rowShield;
          ctx.desc = esc(qdesc());

          return renderCtx(ctx);
        }

        // ---------- ACCESSORY PREVIEW ----------
        if (kind === "accessory") {
          ctx.desc = esc(qdesc());
          return renderCtx(ctx);
        }

        // ---------- WEAPON PREVIEW ----------
        if (kind === "weapon") {
          const $sel2 = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
          const idx2  = Number($sel2.data("idx"));
          const base2 = Number.isFinite(idx2) ? currentTemplates[idx2] : null;

          if (!base2) {
            ctx.muted = true;
            ctx.mutedText = "Select a weapon template…";
            return renderCtx(ctx);
          }

          const baseHand     = normHand(base2?.hand) || null;
          const baseHandText = handLabel(baseHand ?? (base2?.hand ?? "—"));
          const baseType     = base2?.type ?? "—";
          const baseCat      = base2?.category ?? base2?.cat ?? "—";

          let worthForPreview = 0;
          try {
            const { worth } = getCurrentCosts(html, base2, currentQualities);
            worthForPreview = worth;
          } catch {
            worthForPreview = 0;
          }

          const stats   = computeWeaponStats(base2, html, worthForPreview);
          const handNorm = normHand(stats.hands) || baseHand;
          const dispHandText = handLabel(handNorm ?? baseHandText);

          const row1 = `${dispHandText} • ${baseType} • ${baseCat}`;
          const row2 = `【${stats.attrs.A} + ${stats.attrs.B}】+ ${stats.acc} | HR+${stats.dmg} ${stats.dmgType}`;

          ctx.isMartial = !!stats.isMartial;
          ctx.line1 = esc(clip(row1));
          ctx.line2 = esc(clip(row2));
          ctx.desc = esc(qdesc());

          return renderCtx(ctx);
        }

        // Fallback (shouldn’t normally hit)
        return renderCtx(ctx);
      }

      // --- Hooks & Wiring ------------------------------------------------------------//

      // handles scroll box selection list
      const wireSelectableList = ($container, itemSel, {
        onSelect,
        initialIndex,
        blockClicks = false
      } = {}) => {
        const $items = $container.find(itemSel);

        // helper: select an element programmatically
        const applySelection = (el, triggerCallback = true) => {
          $container.find(itemSel).each(function() {
            this.dataset.selected = "";
            $(this).css({ backgroundColor: "", color: "" });
          });
          if (!el) return;
          el.dataset.selected = "1";
          $(el).css({ backgroundColor: "rgba(65,105,225,1)", color: "white" });
          if (triggerCallback) onSelect?.(el);
        };

        $items.on("mouseenter", function() {
          if (this.dataset.selected === "1") return;
          if (blockClicks) return;
          $(this).css({ backgroundColor: "rgba(0,0,0,0.08)" });
        }).on("mouseleave", function() {
          if (this.dataset.selected === "1") return;
          if (blockClicks) return;
          $(this).css({ backgroundColor: "", color: "" });
        });

        $items.on("click", function(ev) {
          if (blockClicks) {
            ev.preventDefault();
            ev.stopImmediatePropagation?.();
            return;
          }
          applySelection(this, true);
        });

        const $initial = Number.isInteger(initialIndex)
          ? $items.eq(initialIndex)
          : $items.first();
        if ($initial.length) applySelection($initial[0], true);
      };

      // === Materials UI (GM authoritative editing) ===========================
      const renderMaterials = () => {
        const mats  = html.data('ifMaterials') || [];
        const needKey = getRequiredOriginKey(html);
        const hasReq  = !needKey || mats.some(m => String(m.origin) === needKey);

        _requiredOriginKey = needKey;
        html.data('ifRequiredOriginKey', _requiredOriginKey);

        $materialsHint.text("Drag & drop Item documents here (max 5)");
        $materialsDrop.children('img[data-mat="1"]').remove();

        if (!mats.length) {
          if (needKey) $materialsHint.text(`Needs 1 ${needKey} material to craft.`);
          $materialsHint.show();
        } else {
          $materialsHint.hide();
          mats.forEach((m, i) => {
            const tip = [ m.name || "", m.origin ? `Origin: ${m.origin}` : "", Number.isFinite(m.cost) ? `Cost: ${m.cost}` : "" ]
              .filter(Boolean).join(" • ");

            const $img = $(`
              <img data-mat="1" data-index="${i}" src="${esc(m.img)}"
                   title="Click to remove\n${esc(tip)}">
            `);
            $img.addClass("lf-if-material-icon");

            $img.on("click", () => {
              // If this client is NOT the host GM, send a remove request instead
              if (!(game.user.isGM && game.user.id === _hostId)) {
                game.projectfu?.socket?.executeAsGM?.(IF_MSG.MaterialsRemove, { index: i });
                return;
              }

              // Host GM mutates & broadcasts
              _materials = _materials.filter((_m, idx) => idx !== i);
              html.data('ifMaterials', _materials);
              game.projectfu?.socket?.executeForEveryone(IF_MSG.MaterialsReplace, {
                materials: _materials,
                originReq: _requiredOriginKey
              });
            });

            $materialsDrop.append($img);
          });
        }

        $materialsDrop.css({ borderColor: (!hasReq && needKey) ? "red" : "#999" });

        // Enable/disable Forge button based on whether requirement is satisfied
        setForgeEnabled(hasReq);

        // repaint hook (socket pushes call this)
        html.find('#materialsDrop').off('repaint').on('repaint', () => {
          html.data('ifMaterials', _materials);
          renderMaterials();
          updateCost();
        });

        relayout();
      };

      // GM drag & drop adds directly (then broadcasts)
      $materialsDrop
        .on("drop", async (ev) => {
          ev.preventDefault();
          $materialsDrop.css("background", "");
          const dt  = ev.originalEvent?.dataTransfer;
          if (!dt) return;
          const raw = dt.getData("text/plain");
          if (!raw) return;

          let data;
          try {
            data = JSON.parse(raw);
          } catch (e) {
            console.error("[Item Forger] Drop parse failed (JSON):", e);
            return;
          }
          if (!data?.uuid) return;

          // If this client is NOT the host GM, propose the add to the GM instead
          if (!(game.user.isGM && game.user.id === _hostId)) {
            game.projectfu?.socket?.executeAsGM?.(IF_MSG.MaterialsAdd, { uuid: data.uuid });
            return;
          }

          // Host GM branch: validate, mutate, broadcast
          try {
            const doc = await fromUuid(data.uuid);
            if (!doc || doc.documentName !== "Item")
              return ui.notifications?.warn("Only Item documents can be dropped here.");
            if (String(doc.type) !== "treasure")
              return ui.notifications?.warn("Only Treasure items can be used as materials.");
            if (_materials.length >= 5)
              return ui.notifications?.warn("You can only add up to 5 materials.");

            const qty = Number(doc.system?.quantity?.value ?? 0) || 0;
            if (qty <= 0) {
              return ui.notifications?.warn("You do not have any more of this item.");
            }

            const alreadyUsed = _materials.filter(m => m.uuid === data.uuid).length;
            if (alreadyUsed >= qty) {
              return ui.notifications?.warn("You do not have any more of this item.");
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
            html.data('ifMaterials', _materials);
            renderMaterials();
            updateCost();

            game.projectfu?.socket?.executeForEveryone(IF_MSG.MaterialsReplace, {
              materials: _materials,
              originReq: _requiredOriginKey
            });
          } catch (e) {
            console.error("[Item Forger] Drop parse failed:", e);
            ui.notifications?.error("Could not read dropped data.");
          }
        });

      function renderTemplates(rows, initialIndex = null) {
        currentTemplates = Array.isArray(rows) ? rows : [];
        if (!currentTemplates.length) {
          $templateList.html(`<div style="text-align:center; opacity:0.75;">No templates found.</div>`);
          const kind = html.find('input[name="itemType"]:checked').val();
          renderPreview(kind, null);
          return;
        }
        const items = currentTemplates.map((r, i) => `
  <div class="if-template" data-idx="${i}">
    <span class="if-template-label">
      ${getNameSafe(r)}
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
            html.removeData('iconOverride');

            // Clear any previous auto-picked icon so we can roll a new one:
            // - In collab mode (restrictInputs === false), ANY user can do this.
            // - In restricted mode, only the host GM may do it.
            if (!restrictInputs || (game.user.isGM && game.user.id === _hostId)) {
              html.removeData('iconPath');
            }

            const kind = html.find('input[name="itemType"]:checked').val();
            renderPreview(kind, el, { rerollIcon: true });
            updateCost();
            broadcastForgeState();
          },
          blockClicks: lockControlsForPlayer
        });
      }

      const renderQualities = (type, initialIndex = null, state = null) => {
        if (!qualitiesRoot || typeof qualitiesRoot !== "object") {
          $qualitiesList.html(`<div style="text-align:center;">No qualities data.</div>`);
          currentQualities = [];
          const kind = html.find('input[name="itemType"]:checked').val();
          renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
          updateCost();
          return;
        }

        const catKey = String($qualitiesSelect.val() || "none").toLowerCase();

        // handle custom qualities
        if (catKey === "custom") {
          currentQualities = [];

          const effCommitted = state
            ? String(state.customEffect ?? "").trim()
            : String(html.data('customEffect') ?? "Custom effect text");
          const cstCommitted = state
            ? toInt(state.customCost ?? 0)
            : toInt(html.data('customCost') ?? 0);

          html.data('customEffect', effCommitted);
          html.data('customCost', cstCommitted);

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

          // Immediately lock custom inputs when in restricted mode
          if (lockControlsForPlayer) {
            html.find('#customEffect, #customCost, #customApply').prop('disabled', true);
          }

          $qualitiesList
            .off('.customUX')
            .on('keydown.customUX', '#customCost', (ev) => {
              if (ev.key === 'Enter') ev.preventDefault();
            })
            .on('keypress.customUX', '#customCost', (ev) => {
              if (ev.key.length === 1 && !/[0-9]/.test(ev.key)) ev.preventDefault();
            })
            .on('paste.customUX', '#customCost', (ev) => {
              ev.preventDefault();
              const txt = (ev.originalEvent || ev).clipboardData.getData('text') ?? '';
              const digits = txt.replace(/\D+/g, '');
              const el = ev.currentTarget;
              const start = el.selectionStart ?? el.value.length;
              const end = el.selectionEnd ?? el.value.length;
              el.value = el.value.slice(0, start) + digits + el.value.slice(end);
            })
            .on('click.customUX', '#customApply', () => {
              if (lockControlsForPlayer) return;

              const eff = String(html.find('#customEffect').val() ?? '').trim();
              const raw = String(html.find('#customCost').val() ?? '');
              const cst = Math.max(0, parseInt(raw.replace(/\D+/g, ''), 10) || 0);
              html.find('#customCost').val(cst);

              html.data('customEffect', eff);
              html.data('customCost', cst);

              const kindNow = html.find('input[name="itemType"]:checked').val();
              renderPreview(kindNow, html.find('#templateList [data-selected="1"]').first());
              updateCost();
              broadcastForgeState();
            });

          const kindNow = html.find('input[name="itemType"]:checked').val();
          renderPreview(kindNow, html.find('#templateList [data-selected="1"]').first());
          updateCost();
          return;
        }

        if (catKey === "none") {
          currentQualities = [];
          $qualitiesList.html("");
          const kindNow = html.find('input[name="itemType"]:checked').val();
          renderPreview(kindNow, html.find('#templateList [data-selected="1"]').first());
          updateCost();
          return;
        }

        const catList = Array.isArray(qualitiesRoot[catKey]) ? qualitiesRoot[catKey] : [];
        currentQualities = catList.filter(q => matchesAppliesTo(q, type));

        if (!currentQualities.length) {
          $qualitiesList.html("");
          const kindNow = html.find('input[name="itemType"]:checked').val();
          renderPreview(kindNow, html.find('#templateList [data-selected="1"]').first());
          updateCost();
          return;
        }

        const items = currentQualities.map((q, i) => `
  <div class="if-quality" data-idx="${i}">
    <span class="if-quality-label">
      ${esc(qualityDisplayName(q, type))}
    </span>
  </div>
`).join("");
        $qualitiesList.html(items);

        wireSelectableList($qualitiesList, ".if-quality", {
          initialIndex,
          onSelect: () => {
            const kindNow = html.find('input[name="itemType"]:checked').val();
            renderPreview(
              kindNow,
              html.find('#templateList [data-selected="1"]').first(),
              { rerollIcon: true }
            );
            updateCost();
            broadcastForgeState();
          },
          blockClicks: lockControlsForPlayer
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
        if (type !== "weapon") {
          $customize.html(`<div style="opacity:0.8;">No Options</div>`);
          return;
        }
        $customize.html(`
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

      function populateTemplates(kind, state = null) {
        const data = kind === "armor" ? getArmorList(equipmentRoot) :
          kind === "shield" ? getShieldList(equipmentRoot) :
          kind === "accessory" ? getAccessoryList(equipmentRoot) :
          getWeaponList(equipmentRoot);

        const initialIndex = state && Number.isFinite(state.templateIdx)
          ? state.templateIdx
          : null;

        renderTemplates(data, initialIndex);
      }

      function updateHandToggle(selectedEl) {
        const kind = html.find('input[name="itemType"]:checked').val();
        const $wrap = html.find("#handToggleWrap");
        const $labelSpan = html.find("#handToggleLabel");
        const $checkbox = html.find("#optToggleHand");
        if (kind !== "weapon") return $wrap.hide();

        const $sel = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
        const idx = Number($sel.data("idx"));
        const base = Number.isFinite(idx) ? currentTemplates[idx] : null;

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

        if (h === "2") {
          $labelSpan.text("Make 1-handed");
          $wrap.show();
          setDisabled(false);
        } else if (h === "1") {
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
      }

      function updatePlusOneToggle(selectedEl) {
        const kind = html.find('input[name="itemType"]:checked').val();
        const $cb = html.find('#optPlusOne');
        const $label = $cb.closest('label');

        // If this client is a locked player, keep current checked state but disable & grey it out
        if (!game.user.isGM && lockControlsForPlayer) {
          $cb.prop('disabled', true);
          $label
            .attr('title', 'Only the GM can modify this option.')
            .css({ opacity: 0.5, filter: 'grayscale(1)' });
          return;
        }

        // Non-weapons: just reset to normal
        if (kind !== "weapon") {
          $cb.prop('disabled', false);
          $label.css({ opacity: 1, filter: "" }).attr('title', '');
          return;
        }

        const $sel = selectedEl ? $(selectedEl) : html.find('#templateList [data-selected="1"]').first();
        const idx = Number($sel.data("idx"));
        const base = Number.isFinite(idx) ? currentTemplates[idx] : null;

        if (!base) {
          $cb.prop('disabled', false);
          $label.css({ opacity: 1, filter: "" }).attr('title', '');
          return;
        }

        const baseAcc = Number(base?.accuracy ?? base?.acc ?? 0) || 0;
        const hasBasePlusOne = baseAcc >= 1;

        if (hasBasePlusOne) {
          $cb.prop('checked', false).prop('disabled', true);
          $label
            .attr('title', 'This weapon already has +1 Accuracy from its base profile.')
            .css({ opacity: 0.5, filter: 'grayscale(1)' });
        } else {
          $cb.prop('disabled', false);
          $label
            .attr('title', '')
            .css({ opacity: 1, filter: '' });
        }
      }

      const updateForKind = (kind, state = null) => {
        renderCustomize(kind);
        renderAttrs(kind);

        // When Playtest Damage Rules are enabled, completely disable the +4 Damage toggle
        if (kind === "weapon") {
          const $pd = html.find('#optPlusDamage');
          const $pdLabel = $pd.closest('label');

          if (useVariantDamageRules()) {
            $pd.prop('checked', false)
               .prop('disabled', true);
            $pdLabel
              .attr(
                'title',
                'Playtest Damage Rules: damage scales with item cost instead of using the +4 Damage toggle.'
              )
              .css({ opacity: 0.5, filter: 'grayscale(1)' });
          } else {
            $pd.prop('disabled', false);
            $pdLabel
              .attr('title', '')
              .css({ opacity: 1, filter: '' });
          }
        }

        if (state?.qualitiesCategory) {
          $qualitiesSelect.val(state.qualitiesCategory);
        }

        populateTemplates(kind, state);
        renderQualities(kind, state?.qualityIdx ?? null, state);
        renderPreview(kind, null);

        if (kind === "weapon") {
          updateHandToggle();
          updatePlusOneToggle();
        }

        relayout();
        updateCost();
        applyLockState();
      };

      const refreshPreviewFromUI = () => {
        const kind = html.find('input[name="itemType"]:checked').val();
        renderPreview(
          kind,
          html.find('#templateList [data-selected="1"]').first(),
          { rerollIcon: false }
        );
        updateCost();
        broadcastForgeState();
      };

      // ------------- SOCKET-DRIVEN UI STATE -------------------
      const applyForgeState = (state) => {
        if (!state) return;
        suppressStateBroadcast = true;
        try {
          const kind = state.kind || "weapon";

          // Set item type radio
          html.find('input[name="itemType"]').prop('checked', false);
          html.find(`input[name="itemType"][value="${kind}"]`).prop('checked', true);

          // Ensure the category select matches first, so renderQualities uses it
          if (state.qualitiesCategory) {
            $qualitiesSelect.val(state.qualitiesCategory);
          }

          if (state.iconPath) {
            html.data('iconPath', state.iconPath);
            if (!game.user.isGM) {
              html.removeData('iconOverride');
            }
          }

          updateForKind(kind, state);

          html.find('#optPlusOne').prop('checked', !!state.plusOne);

          if (!useVariantDamageRules()) {
            html.find('#optPlusDamage').prop('checked', !!state.plusDamage);
          }

          html.find('#optToggleHand').prop('checked', !!state.toggleHand);
          html.find('#optElement').val(state.element || 'physical');
          html.find('#optAttrA').val(state.attrA || 'MIG');
          html.find('#optAttrB').val(state.attrB || 'MIG');
          html.find('#optFee').prop('checked', !!state.fee);

          if (kind === "weapon") {
            updatePlusOneToggle();
          }
          if (typeof state.customEffect === "string") {
            html.data('customEffect', state.customEffect);
          }
          if (typeof state.customCost !== "undefined") {
            html.data('customCost', toInt(state.customCost));
          }

          refreshPreviewFromUI();

          if (state.iconPath) {
            html.data('iconPath', state.iconPath);
            try {
              $preview.find('#if-preview-icon').attr('src', state.iconPath);
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

      dlg._applyForgeStateFromSocket = (state) => {
        applyForgeState(state);
      };

      $dlg.off('.ifPrev');
      $dlg.on('change.ifPrev',
        '#optAttrA, #optAttrB, #optPlusOne, #optPlusDamage, #optToggleHand, #optElement, #optFee',
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

        const kind = html.find('input[name="itemType"]:checked').val();
        renderQualities(kind);
        renderPreview(
          kind,
          html.find('#templateList [data-selected="1"]').first(),
          { rerollIcon: false }
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

      // Clickable preview image (icon picker)
      html.off('click.ifIconPick');
      html.on('click.ifIconPick', '#if-preview-icon', async (ev) => {
        if (!game.user.isGM) return;

        ev.preventDefault();
        ev.stopPropagation();
        console.debug('[Item Forger] preview icon clicked');

        const kind = html.find('input[name="itemType"]:checked').val();
        const fromOverride = html.data('iconOverride');
        const fromPreview = $('#if-preview-icon').attr('src');
        const derivedDir = (fromOverride || fromPreview || "").includes("/") ?
          String(fromOverride || fromPreview).replace(/\/[^/]*$/, "/") :
          "/";
        const startDir = html.data('lastIconDir') || derivedDir || "/";

        try {
          const fp = new FilePicker({
            type: "image",
            current: startDir,
            callback: (path) => {
              console.debug('[Item Forger] FilePicker selected:', path);
              html.data('iconOverride', path);
              try {
                html.data('lastIconDir', String(path).replace(/\/[^/]*$/, "/"));
              } catch {}
              renderPreview(kind, html.find('#templateList [data-selected="1"]').first());
              broadcastForgeState();
            }
          });
          fp.render(true);
        } catch (err) {
          console.error('[Item Forger] FilePicker error:', err);
          ui.notifications?.error('Could not open FilePicker (see console).');
        }
      });

      html.on("change", 'input[name="itemType"]', (ev) => {
        if (lockControlsForPlayer) {
          ev.preventDefault();
          return;
        }
        const kind = ev.currentTarget.value;
        html.removeData('iconOverride');
        updateForKind(kind);
        broadcastForgeState();
      });

      updateForKind("weapon");
      renderMaterials();

      // Ask host for authoritative list if somehow we're not the host (safety)
      if (!(game.user.isGM && game.user.id === _hostId)) {
        const targetHost = _hostId || game.users.activeGM?.id;
        if (targetHost) game.projectfu?.socket?.executeAsUser(IF_MSG.MaterialsRequest, targetHost, {});
      }
    },
    close: async () => {
      try {
        if (game.user.isGM && game.user.id === _hostId) {
          game.projectfu?.socket?.executeForEveryone(IF_MSG.HostClose, { hostId: game.user.id });
        }
      } finally {
        _forgeAppId = null;
      }
    }
  }, { resizable: false });

  // Non-GM safety: strip Forge button if they somehow open it
  if (!game.user.isGM) {
    dlg.data.buttons = {};
    dlg.data.default = null;
  }

  dlg.render(true);
}

Hooks.on("lookfarShowItemForgeDialog", () => {
  try {
    ensureIFSocket();

    const mode = getItemForgeEditMode(); // "public" | "gmOnly" | "locked" | "hidden"

    // GM always gets the full Item Forge dialog, regardless of mode
    if (game.user.isGM) {
      openItemForgeDialog();
      return;
    }

    // Hidden: players should not see any Item Forge UI at all
    if (mode === "hidden") {
      return;
    }

    // Public & Locked: players get the full forge dialog
    if (mode === "public" || mode === "locked") {
      openItemForgeDialog();
      return;
    }

    // GM Only: players get only the mini materials dialog
    if (mode === "gmOnly") {
      openMaterialsMiniDialog();
      return;
    }

  } catch (err) {
    console.error("[Item Forger] failed to open:", err);
    ui.notifications?.error("Item Forger: failed to open (see console).");
  }
});
