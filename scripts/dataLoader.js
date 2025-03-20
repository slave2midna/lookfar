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
this.threatsData = dangersData?.threats ?? {};  
this.sourceData = dangersData?.sources ?? {};  

if (Object.keys(this.threatsData).length === 0) {
  console.warn("Warning: No threats data found in dangers.json.");
}
if (Object.keys(this.sourceData).length === 0) {
  console.warn("Warning: No sources data found in dangers.json.");
}

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
