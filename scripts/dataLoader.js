export const dataLoader = {
  threatsData: {},
  sourceData: {},
  discoveryData: {},

  async loadData() {
    try {
      // Fetch and load data for threats and fluff from dangers.json
      const threatsResponse = await fetch(
        "/modules/lookfar/data/dangers.json"
      );
	  const dangersData = await threatsResponse.json();
	  this.threatsData = dangersData.threats || {};  // Safely assign danger threats
	  this.sourceData = dangersData.sources || {};      // Safely assign danger sources

      console.log("Threats Data:", this.threatsData);
      console.log("Source Data:", this.sourceData);

      // Fetch and load data for discoveries
      const discoveryResponse = await fetch(
        "/modules/lookfar/data/discoveries.json"
      );
      this.discoveryData = await discoveryResponse.json();
      console.log("Discovery Data:", this.discoveryData);

      console.log("Data loaded successfully.");
    } catch (error) {
      console.error("Error loading data:", error);
    }
  },
};
