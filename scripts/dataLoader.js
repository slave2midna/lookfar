export const dataLoader = {
  threatsData: {},
  fluffData: {},
  discoveryData: {},

  async loadData() {
    try {
      // Fetch and load data for threats and fluff from dangers.json
      const threatsResponse = await fetch(
        "/modules/lookfar/data/dangers.json"
      );
	  const dangersData = await threatsResponse.json();
	  this.threatsData = dangersData.threats || {};  // Safely assign threats data
	  this.fluffData = dangersData.fluff || {};      // Safely assign fluff data

      console.log("Threats Data:", this.threatsData);
      console.log("Fluff Data:", this.fluffData);

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
