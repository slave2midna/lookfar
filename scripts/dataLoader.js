export const dataLoader = {
  threatsData: {},
  discoveryData: {},
  keywordData: {},
  treasureData: {},

  async loadData() {
    // Load dangers.json (threats & danger sources)
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

    // Load discoveries.json (effects & discovery sources)
    try {
      const discoveryResponse = await fetch("/modules/lookfar/data/discoveries.json");
      this.discoveryData = await discoveryResponse.json();
      console.log("Discovery Data:", this.discoveryData);
    } catch (error) {
      console.error("Failed to load discoveries.json:", error);
    }

    // Load keywords.json (traits & terrain keywords)
    try {
      const keywordsResponse = await fetch("/modules/lookfar/data/keywords.json");
      this.keywordData = await keywordsResponse.json();
      console.log("Keyword Data:", this.keywordData);
    } catch (error) {
      console.error("Failed to load keywords.json:", error);
    }

    // Load treasure.json (materials, weapons, armor, accessories, etc.)
    try {
      const treasureResponse = await fetch("/modules/lookfar/data/treasure.json");
      this.treasureData = await treasureResponse.json();
      console.log("Treasure Data:", this.treasureData);
    } catch (error) {
      console.error("Failed to load treasure.json:", error);
    }
  },

  // 🔁 Folder Caching Utility
  async getOrCreateCacheFolder() {
    const folderName = "Lookfar Loot Cache";
    let folder = game.folders.find(f =>
      f.name === folderName &&
      f.type === "Item" &&
      f.flags?.lookfar?.system === "loot-cache"
    );

    if (!folder) {
      folder = await Folder.create({
        name: folderName,
        type: "Item",
        sorting: "a",
        parent: null,
        color: "#999999",
        flags: {
          lookfar: {
            system: "loot-cache",
            hidden: true
          }
        }
      });
      console.log("[Lookfar] Created loot cache folder:", folder.name);
    }

    return folder;
  },

  // 🧹 Clear the Folder (Used on Startup or via Macro)
  async clearCacheFolder() {
    const folder = await this.getOrCreateCacheFolder();
    const items = game.items.filter(i => i.folder?.id === folder.id);
    for (let item of items) {
      await item.delete();
    }
    console.log(`[Lookfar] Cleared ${items.length} cached items from "${folder.name}".`);
  }
};

// 🧼 Auto-Clear Cache on World Load
Hooks.once("ready", async () => {
  await dataLoader.clearCacheFolder();
});
