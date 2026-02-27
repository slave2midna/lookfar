export const dataLoader = {
  // ---------------------------------------------------------------------------
  // Core datasets
  // ---------------------------------------------------------------------------
  threatsData: {},
  sourceData: [],
  discoveryData: {},

  // Localized dataset bundle loaded from /data/i18n/<lang>.json
  // Contains: { version, keywords, equipment, qualities }
  i18nData: {},

  // Split-out localized helpers (optional convenience)
  localizedEquipment: {},
  localizedQualities: {},

  iconManifest: [],

  // Icon index: built after loading manifest
  // Shape: { weapon: { sword: [paths...], waraxe: [paths...], _all: [paths...] }, armor: { martial: [...], non_martial: [...], _all: [...] }, ... }
  iconIndex: null,

  // ---------------------------------------------------------------------------
  // Public shapes for equipment (legacy-compatible)
  // ---------------------------------------------------------------------------
  weaponsData:     { weaponList: [], weaponQualities: {} },
  armorData:       { armorList: [],  armorQualities:  {} },
  shieldsData:     { shieldList: [], shieldQualities: {} },
  accessoriesData: { accessoryList: [], accessoryQualities: {} },

  // Merged sources (for debugging)
  equipmentData: {},
  qualitiesData: {},

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  async loadData() {
    // --- dangers (threats & sources) ---
    try {
      const r = await fetch("/modules/lookfar/data/dangers.json", { cache: "no-store" });
      const dangers = await r.json();
      this.threatsData = dangers.threats || {};
      this.sourceData  = dangers.sources || [];
      console.log("[Lookfar] Threats Data:", this.threatsData);
      console.log("[Lookfar] Danger Sources:", this.sourceData);
    } catch (err) {
      console.error("[Lookfar] Failed to load dangers.json:", err);
      this.threatsData = {};
      this.sourceData = [];
    }

    // --- discoveries (effects & discovery sources) ---
    try {
      const r = await fetch("/modules/lookfar/data/discoveries.json", { cache: "no-store" });
      this.discoveryData = await r.json();
      console.log("[Lookfar] Discovery Data:", this.discoveryData);
    } catch (err) {
      console.error("[Lookfar] Failed to load discoveries.json:", err);
      this.discoveryData = {};
    }

    // --- i18n dataset bundle (keywords + equipment names + quality names/descriptions) ---
    // Expected paths:
    //   /modules/lookfar/data/i18n/<lang>.json       e.g. en.json, pt-BR.json
    // Fallback chain:
    //   <lang>.json -> <base>.json -> en.json
    try {
      const lang = game?.i18n?.lang || "en";
      const base = String(lang).split("-")[0];
      const candidates = [
        `/modules/lookfar/data/i18n/${lang}.json`,
        `/modules/lookfar/data/i18n/${base}.json`,
        `/modules/lookfar/data/i18n/en.json`
      ];

      let bundle = null;
      let loadedFrom = null;

      for (const url of candidates) {
        try {
          const r = await fetch(url, { cache: "no-store" });
          if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
          bundle = await r.json();
          loadedFrom = url;
          break;
        } catch (_) {
          // continue
        }
      }

      if (!bundle) throw new Error(`No i18n bundle files found for lang=${lang}`);

      this.i18nData = bundle || {};
      this.localizedEquipment = bundle?.equipment || {};
      this.localizedQualities = bundle?.qualities || {};

      console.log(`[Lookfar] i18n bundle (${lang}) loaded from:`, loadedFrom);
      console.log("[Lookfar] i18n keywords:", this.keywordData);
      console.log("[Lookfar] i18n equipment:", this.localizedEquipment);
      console.log("[Lookfar] i18n qualities:", this.localizedQualities);
    } catch (err) {
      console.error("[Lookfar] Failed to load i18n bundle:", err);
      this.i18nData = {};
      this.localizedEquipment = {};
      this.localizedQualities = {};
    }

    // --- equipment (weapon/armor/shield/accessory lists) ---
    try {
      const r = await fetch("/modules/lookfar/data/equipment.json", { cache: "no-store" });
      const eq = await r.json();
      this.equipmentData = eq || {};

      // Fan out equipment into lists to fit legacy shapes
      this.weaponsData.weaponList        = Array.isArray(eq?.weaponList)     ? eq.weaponList     : [];
      this.armorData.armorList           = Array.isArray(eq?.armorList)      ? eq.armorList      : [];
      this.shieldsData.shieldList        = Array.isArray(eq?.shieldList)     ? eq.shieldList     : [];
      this.accessoriesData.accessoryList = Array.isArray(eq?.accessoryList)  ? eq.accessoryList  : [];

      // Optional: strip any lingering "name" fields (you’re moving names to i18n)
      this.weaponsData.weaponList.forEach(w => { if (w && "name" in w) delete w.name; });
      this.armorData.armorList.forEach(a => { if (a && "name" in a) delete a.name; });
      this.shieldsData.shieldList.forEach(s => { if (s && "name" in s) delete s.name; });
      this.accessoriesData.accessoryList.forEach(a => { if (a && "name" in a) delete a.name; });

      console.log("[Lookfar] Equipment Lists:", {
        weapons: this.weaponsData.weaponList.length,
        armor: this.armorData.armorList.length,
        shields: this.shieldsData.shieldList.length,
        accessories: this.accessoriesData.accessoryList.length
      });
    } catch (err) {
      console.error("[Lookfar] Failed to load equipment.json:", err);
      this.equipmentData = {};
      this.weaponsData.weaponList = [];
      this.armorData.armorList = [];
      this.shieldsData.shieldList = [];
      this.accessoriesData.accessoryList = [];
    }

    // --- qualities (maps to legacy shapes) ---
    try {
      const r = await fetch("/modules/lookfar/data/qualities.json", { cache: "no-store" });
      const q = await r.json();
      this.qualitiesData = q || {};

      // Default fast-path case, if file already provides per-type blocks, use them directly.
      if (q.weaponQualities || q.armorQualities || q.shieldQualities || q.accessoryQualities) {
        this.weaponsData.weaponQualities        = q.weaponQualities     || {};
        this.armorData.armorQualities           = q.armorQualities      || {};
        this.shieldsData.shieldQualities        = q.shieldQualities     || {};
        this.accessoriesData.accessoryQualities = q.accessoryQualities  || {};
      } else {
        // Convert from generic (id/cost/appliesTo) + i18n names/desc -> per-type legacy structure
        const byType = this._convertGenericQualitiesToPerType(q);
        this.weaponsData.weaponQualities        = byType.weapon;
        this.armorData.armorQualities           = byType.armor;
        this.shieldsData.shieldQualities        = byType.shield;
        this.accessoriesData.accessoryQualities = byType.accessory;
      }

      console.log("[Lookfar] Weapon Qualities Groups:", Object.keys(this.weaponsData.weaponQualities));
      console.log("[Lookfar] Armor  Qualities Groups:", Object.keys(this.armorData.armorQualities));
      console.log("[Lookfar] Shield Qualities Groups:", Object.keys(this.shieldsData.shieldQualities));
      console.log("[Lookfar] Acc.   Qualities Groups:", Object.keys(this.accessoriesData.accessoryQualities));
    } catch (err) {
      console.error("[Lookfar] Failed to load qualities.json:", err);
      this.qualitiesData = {};
      this.weaponsData.weaponQualities = {};
      this.armorData.armorQualities = {};
      this.shieldsData.shieldQualities = {};
      this.accessoriesData.accessoryQualities = {};
    }

    // --- icon manifest (all PNG paths under /modules/lookfar/assets) ---
    try {
      const r = await fetch("/modules/lookfar/assets/iconManifest.json", { cache: "no-store" });
      const list = await r.json();
      this.iconManifest = Array.isArray(list) ? list : [];
      this._buildIconIndex();
      console.log("[Lookfar] Icon Manifest:", this.iconManifest.length, "icons");
    } catch (err) {
      console.warn("[Lookfar] No iconManifest.json found or failed to load:", err);
      this.iconManifest = [];
      this.iconIndex = Object.create(null);
    }
  },

  // ---------------------------------------------------------------------------
  // Icon helpers
  // ---------------------------------------------------------------------------
  /** Build a fast lookup index from iconManifest. */
  _buildIconIndex() {
    const idx = Object.create(null);
    for (const p of this.iconManifest) {
      // Expect paths like: /modules/lookfar/assets/<type>/<bucket>/.../file.png
      // We index by first two folders after /assets/: <type>/<bucket>
      const m = p.match(/\/assets\/([^/]+)\/([^/]+)\/[^/]+\.png$/i);
      if (!m) {
        // Also try to capture deeper paths by always taking the first 2 segments after /assets/
        const m2 = p.match(/\/assets\/([^/]+)\/([^/]+)\//i);
        if (!m2) continue;
        const [, type2, bucket2] = m2;
        const t2 = (idx[type2] ||= Object.create(null));
        (t2[bucket2] ||= []).push(p);
        (t2._all ||= []).push(p);
        continue;
      }
      const [, type, bucket] = m;
      const t = (idx[type] ||= Object.create(null));
      (t[bucket] ||= []).push(p);
      (t._all ||= []).push(p);
    }
    this.iconIndex = idx;
  },

  /** Pick a random icon from a specific bucket path like "weapon/sword" or "armor/martial". */
  getRandomFrom(bucketPath) {
    if (!bucketPath || !this.iconIndex) return null;
    const [type, bucket] = String(bucketPath).split("/");
    const arr = this.iconIndex?.[type]?.[bucket];
    if (Array.isArray(arr) && arr.length) {
      return arr[Math.floor(Math.random() * arr.length)];
    }
    return null;
  },

  /**
   * Get a random icon for an equipment piece.
   * kind: "weapon" | "armor" | "shield" | "accessory"
   * base: equipment entry from equipment.json (expects fields like id, category, isMartial)
   */
  getRandomIconFor(kind, base) {
    if (!base) return null;
    const tries = [];

    if (kind === "weapon") {
      if (base.id)       tries.push(`weapon/${String(base.id)}`);       // e.g., weapon/steel-dagger
      if (base.category) tries.push(`weapon/${String(base.category)}`); // e.g., weapon/sword
      tries.push("weapon/_all");
    } else if (kind === "armor") {
      const bucket = base.isMartial ? "martial" : "non_martial";
      tries.push(`armor/${bucket}`, "armor/_all");
    } else if (kind === "shield") {
      const bucket = base.isMartial ? "martial" : "non_martial";
      tries.push(`shield/${bucket}`, "shield/_all");
    } else if (kind === "accessory") {
      if (base.id) tries.push(`accessory/${String(base.id)}`);          // e.g., accessory/ring
      tries.push("accessory/_all");
    }

    for (const bp of tries) {
      const pick = this.getRandomFrom(bp);
      if (pick) return pick;
    }
    return "icons/svg/mystery-man.svg";
  },

  // ---------------------------------------------------------------------------
  // Localization helpers (equipment + qualities)
  // ---------------------------------------------------------------------------
  /**
   * Translate an equipment id into its localized display name.
   * kind: "weapon" | "armor" | "shield" | "accessory"
   */
  getEquipmentName(kind, id, fallback = null) {
    const v = this.localizedEquipment?.[kind]?.[id];
    if (typeof v === "string" && v.trim().length) return v.trim();
    return fallback ?? id;
  },

  /**
   * Convert generic qualities.json (id/cost/appliesTo) into legacy per-type groups,
   * pulling display names + descriptions from this.localizedQualities (i18n bundle).
   */
  _convertGenericQualitiesToPerType(qualitiesObj) {
    const OUT = { weapon: {}, armor: {}, shield: {}, accessory: {} };
    const TYPE_KEYS = ["weapon", "armor", "shield", "accessory"];

    const SLOT_MAP = {
      weapon: "Weapon",
      armor: "Armor",
      shield: "Shield",
      accessory: "Accessory"
    };

    const getName = (group, qid, type) => {
      const slot = SLOT_MAP[type];
      const v = this.localizedQualities?.[group]?.[qid]?.[slot];
      return (typeof v === "string" && v.trim().length) ? v.trim() : null;
    };

    const getDesc = (group, qid) => {
      const v = this.localizedQualities?.[group]?.[qid]?.Description;
      return (typeof v === "string" && v.trim().length) ? v.trim() : "";
    };

    for (const [group, list] of Object.entries(qualitiesObj || {})) {
      if (!Array.isArray(list)) continue;

      for (const type of TYPE_KEYS) {
        const groupArr = [];

        for (const entry of list) {
          const qid = entry?.id;
          if (!qid) continue;

          const appliesTo = Array.isArray(entry?.appliesTo) ? entry.appliesTo : [];
          const appliesSet = new Set(appliesTo);

          // Compatibility: if someone lists armor but forgets shield, treat shield as armor
          if (appliesSet.has("armor")) appliesSet.add("shield");

          if (!appliesSet.has(type)) continue;

          const name = getName(group, qid, type);
          if (!name) {
            // Debug aid: helps you find missing entries in data/i18n/<lang>.json
            // Comment out once stable.
            console.warn(`[Lookfar] Missing i18n quality name: group=${group} id=${qid} slot=${SLOT_MAP[type]}`);
            continue;
          }

          groupArr.push({
            id: qid,
            name,
            value: entry?.cost ?? 0,
            description: getDesc(group, qid)
          });
        }

        if (groupArr.length) OUT[type][group] = groupArr;
      }
    }

    // Ensure basic groups exist so logic that expects them won’t crash
    for (const type of TYPE_KEYS) OUT[type].basic ??= [];

    return OUT;
  }
};
