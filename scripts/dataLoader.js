export const dataLoader = {
  // Core datasets
  threatsData: {},
  discoveryData: {},
  keywordData: {},
  iconManifest: [],

  // Icon index: built after loading manifest
  // Shape: { weapon: { sword: [paths...], waraxe: [paths...], _all: [paths...] }, armor: { martial: [...], non_martial: [...], _all: [...] }, ... }
  iconIndex: null,

  // Public shapes for equipment
  weaponsData:     { weaponList: [], weaponQualities: {} },
  armorData:       { armorList: [],  armorQualities:  {} },
  shieldsData:     { shieldList: [], shieldQualities: {} },
  accessoriesData: { accessoryList: [], accessoryQualities: {} },

  // Merged sources (for debugging)
  equipmentData:   {},
  qualitiesData:   {},

  async loadData() {
    // --- dangers (threats & sources) ---
    try {
      const r = await fetch("/modules/lookfar/data/dangers.json");
      const dangers = await r.json();
      this.threatsData = dangers.threats || {};
      this.sourceData  = dangers.sources || [];
      console.log("[Lookfar] Threats Data:", this.threatsData);
      console.log("[Lookfar] Danger Sources:", this.sourceData);
    } catch (err) {
      console.error("[Lookfar] Failed to load dangers.json:", err);
    }

    // --- discoveries (effects & discovery sources) ---
    try {
      const r = await fetch("/modules/lookfar/data/discoveries.json");
      this.discoveryData = await r.json();
      console.log("[Lookfar] Discovery Data:", this.discoveryData);
    } catch (err) {
      console.error("[Lookfar] Failed to load discoveries.json:", err);
    }

    // --- keywords (traits, terrain, origin, nature, taste & element keywords) ---
    try {
      const r = await fetch("/modules/lookfar/data/keywords.json");
      this.keywordData = await r.json();
      console.log("[Lookfar] Keyword Data:", this.keywordData);
    } catch (err) {
      console.error("[Lookfar] Failed to load keywords.json:", err);
    }

    // --- equipment (weapon/armor/shield/accessory lists) ---
    try {
      const r = await fetch("/modules/lookfar/data/equipment.json");
      const eq = await r.json();
      this.equipmentData = eq || {};

      // Fan out equipment into lists to fit legacy shapes
      this.weaponsData.weaponList        = Array.isArray(eq?.weaponList)     ? eq.weaponList     : [];
      this.armorData.armorList           = Array.isArray(eq?.armorList)      ? eq.armorList      : [];
      this.shieldsData.shieldList        = Array.isArray(eq?.shieldList)     ? eq.shieldList     : [];
      this.accessoriesData.accessoryList = Array.isArray(eq?.accessoryList)  ? eq.accessoryList  : [];

      console.log("[Lookfar] Equipment Lists:", {
        weapons: this.weaponsData.weaponList.length,
        armor: this.armorData.armorList.length,
        shields: this.shieldsData.shieldList.length,
        accessories: this.accessoriesData.accessoryList.length
      });
    } catch (err) {
      console.error("[Lookfar] Failed to load equipment.json:", err);
    }

    // --- qualities (maps to legacy shapes) ---
    try {
      const r = await fetch("/modules/lookfar/data/qualities.json");
      const q = await r.json();
      this.qualitiesData = q || {};

      // Default fast-path case, if file already provides per-type blocks, this uses them directly.
      if (q.weaponQualities || q.armorQualities || q.shieldQualities || q.accessoryQualities) {
        this.weaponsData.weaponQualities        = q.weaponQualities     || {};
        this.armorData.armorQualities           = q.armorQualities      || {};
        this.shieldsData.shieldQualities        = q.shieldQualities     || {};
        this.accessoriesData.accessoryQualities = q.accessoryQualities  || {};
      } else {
        // Flexible converter, from a generic structure to legacy per-type groups
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
      if (base.id)       tries.push(`weapon/${String(base.id)}`);       // e.g., weapon/dagger
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

  _convertGenericQualitiesToPerType(qualitiesObj) {
    const OUT = { weapon: {}, armor: {}, shield: {}, accessory: {} };
    const TYPE_KEYS = ["weapon", "armor", "shield", "accessory"];

    // Name resolver
    const resolveNameForType = (entry, type) => {
      const keyMap = {
        weapon: "weaponName",
        armor: "armorName",
        shield: "shieldName",
        accessory: "accessoryName"
      };
      const name = entry?.[keyMap[type]];
      return (typeof name === "string" && name.trim().length) ? name.trim() : null;
    };

    for (const [group, list] of Object.entries(qualitiesObj || {})) {
      if (!Array.isArray(list)) continue;

      for (const type of TYPE_KEYS) {
        const groupArr = [];

        for (const entry of list) {
          const baseApplies = Array.isArray(entry?.appliesTo)
            ? entry.appliesTo
            : ["weapon", "armor", "accessory"];

          const appliesSet = new Set(baseApplies);
          if (appliesSet.has("armor")) appliesSet.add("shield");

          if (!appliesSet.has(type)) continue;

          const name = resolveNameForType(entry, type);
          if (!name) continue;

          groupArr.push({
            name,
            value: entry?.cost ?? 0,
            description: entry?.description ?? ""
          });
        }

        if (groupArr.length) OUT[type][group] = groupArr;
      }
    }

    // Ensure at least empty "basic" groups exist so logic that expects them won’t crash
    for (const type of TYPE_KEYS) OUT[type].basic ??= [];

    return OUT;
  }
};
