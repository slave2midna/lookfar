export const dataLoader = {
  threatsData: {},
  discoveryData: {},
  keywordData: {},
  treasureData: {},

  async loadData() {
    // dangers.json (threats & sources)
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

    // discoveries.json (effects & discovery sources)
    try {
      const r = await fetch("/modules/lookfar/data/discoveries.json");
      this.discoveryData = await r.json();
      console.log("Discovery Data:", this.discoveryData);
    } catch (err) {
      console.error("Failed to load discoveries.json:", err);
    }

    // keywords.json (traits & terrain keywords)
    try {
      const r = await fetch("/modules/lookfar/data/keywords.json");
      this.keywordData = await r.json();
      console.log("Keyword Data:", this.keywordData);
    } catch (err) {
      console.error("Failed to load keywords.json:", err);
    }

    // treasure.json (materials, weapons, armor, accessories, etc.)
    try {
      const r = await fetch("/modules/lookfar/data/treasure.json");
      this.treasureData = await r.json();
      console.log("Treasure Data:", this.treasureData);
    } catch (err) {
      console.error("Failed to load treasure.json:", err);
    }
  }
};
