export const dataLoader = {
  // Core datasets
  threatsData: {},
  discoveryData: {},
  keywordData: {},
  iconManifest: [],

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
        // Fancy flexible converter, from a generic structure to legacy per-type groups
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
      this.iconManifest = Array.isArray(r) ? r : await r.json();
      if (!Array.isArray(this.iconManifest)) this.iconManifest = [];
      console.log("[Lookfar] Icon Manifest:", this.iconManifest.length, "icons");
    } catch (err) {
      console.warn("[Lookfar] No iconManifest.json found or failed to load:", err);
      this.iconManifest = [];
    }
  },

  _convertGenericQualitiesToPerType(qualitiesObj) {
    const OUT = { weapon: {}, armor: {}, shield: {}, accessory: {} };
    const TYPE_KEYS = ["weapon", "armor", "shield", "accessory"];

    // Name resolver
    const resolveNameForType = (entry, type) => {
    const keyMap = {
      weapon: "weaponName",
      armor: "armorName",
      shield: "armorName",
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
