export const dataLoader = {
  threatsData: {},
  sourceData: [],
  discoveryData: {},
  keywordData: {},

  async loadData() {
    // Load dangers.json (threats)
    try {
      const response = await fetch("/modules/lookfar/data/dangers.json");
      const dangersData = await response.json();

      this.threatsData = dangersData.threats || {};
      this.sourceData = dangersData.sources || [];

      console.log("Threats Data:", this.threatsData);
      console.log("Danger Sources:", this.sourceData);
    } catch (error) {
      console.error("Failed to load dangers.json:", error);
    }

    // Load discoveries.json (effects only)
    try {
      const discoveryResponse = await fetch(
        "/modules/lookfar/data/discoveries.json"
      );
      this.discoveryData = await discoveryResponse.json();
      console.log("Discovery Data:", this.discoveryData);
    } catch (error) {
      console.error("Failed to load discoveries.json:", error);
    }

    // Load keywords.json (traits + terrain)
    try {
      const keywordsResponse = await fetch(
        "/modules/lookfar/data/keywords.json"
      );
      this.keywordData = await keywordsResponse.json();
      console.log("Keyword Data:", this.keywordData);
    } catch (error) {
      console.error("Failed to load keywords.json:", error);
    }
  },
};
