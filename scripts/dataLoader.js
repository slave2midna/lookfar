export const dataLoader = {
  threatsData: {},
  dangerSources: [],
  rewardsData: {},
  discoverySources: [],
  keywordsData: {},

  async loadData() {
    try {
      // Fetch and load data for threats and sources from dangers.json
      const threatsResponse = await fetch(
        "/modules/lookfar/data/dangers.json"
      );
      const dangersData = await threatsResponse.json();
      
      // Assign danger threats and sources safely
      this.threatsData = dangersData.threats || {};  
      this.dangerSources = dangersData.sources || [];  // Store danger sources

      console.log("Threats Data:", this.threatsData);
      console.log("Danger Sources:", this.dangerSources);

      // Fetch and load data for rewards and discovery sources from discoveries.json
      const discoveryResponse = await fetch(
        "/modules/lookfar/data/discoveries.json"
      );
      const discoveryData = await discoveryResponse.json();

      // Store rewards data and discovery sources safely
      this.rewardsData = discoveryData.rewards || {};  // Renamed to rewardsData
      this.discoverySources = discoveryData.sources || [];  // Store discovery sources

      console.log("Rewards Data:", this.rewardsData);
      console.log("Discovery Sources:", this.discoverySources);

      // Fetch and load data for keywords
      const keywordsResponse = await fetch(
        "/modules/lookfar/data/keywords.json"
      );
      this.keywordsData = await keywordsResponse.json();
      
      console.log("Keywords Data:", this.keywordsData);

      console.log("Data loaded successfully.");
    } catch (error) {
      console.error("Error loading data:", error);
    }
  },
};
