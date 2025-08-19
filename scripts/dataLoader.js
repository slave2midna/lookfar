export const dataLoader = {
  // Core datasets
  threatsData: {},
  discoveryData: {},
  keywordData: {},
  treasureData: {},          // old. Will be removed later.
  weaponsData:    {},
  armorData:      {},
  shieldsData:    {},
  accessoriesData:{},

  async loadData() {
    // dangers (threats & sources)
    try {
      const r = await fetch("/modules/lookfar/data/dangers.json");
      const dangers = await r.json();
      this.threatsData = dangers.threats || {};
      this.sourceData  = dangers.sources || [];
      console.log("Threats Data:", this.threatsData);
      console.log("Danger Sources:", this.sourceData);
    } catch (err) {
      console.error("Failed to load dangers.json:", err);
    }

    // discoveries (effects & discovery sources)
    try {
      const r = await fetch("/modules/lookfar/data/discoveries.json");
      this.discoveryData = await r.json();
      console.log("Discovery Data:", this.discoveryData);
    } catch (err) {
      console.error("Failed to load discoveries.json:", err);
    }

    // keywords (traits, terrain, origin, nature, taste & element keywords)
    try {
      const r = await fetch("/modules/lookfar/data/keywords.json");
      this.keywordData = await r.json();
      console.log("Keyword Data:", this.keywordData);
    } catch (err) {
      console.error("Failed to load keywords.json:", err);
    }

    // weapons ( basic weapons & qualities )
    try {
      const r = await fetch("/modules/lookfar/data/weapons.json");
      this.weaponsData = await r.json();
      console.log("Weapons Data:", this.weaponsData);
    } catch (err) {
      console.error("Failed to load weapons.json:", err);
    }

    // armor ( basic armor & qualities )
    try {
      const r = await fetch("/modules/lookfar/data/armor.json");
      this.armorData = await r.json();
      console.log("Armor Data:", this.armorData);
    } catch (err) {
      console.error("Failed to load armor.json:", err);
    }

    // shields ( basic shields & qualities )
    try {
      const r = await fetch("/modules/lookfar/data/shields.json");
      this.shieldsData = await r.json();
      console.log("Shields Data:", this.shieldsData);
    } catch (err) {
      console.error("Failed to load shields.json:", err);
    }

    // accessories ( basic accessories & qualities )
    try {
      const r = await fetch("/modules/lookfar/data/accessories.json");
      this.accessoriesData = await r.json();
      console.log("Accessories Data:", this.accessoriesData);
    } catch (err) {
      console.error("Failed to load accessories.json:", err);
    }

    // original treasure data. To be removed.
    try {
      const r = await fetch("/modules/lookfar/data/treasure.json");
      this.treasureData = await r.json();
      console.log("Treasure Data (non-equipment still used):", this.treasureData);
    } catch (err) {
      console.error("Failed to load treasure.json:", err);
    }
  }
};
