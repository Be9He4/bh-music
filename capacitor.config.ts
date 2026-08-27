import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bh.music",
  appName: "BH Music",
  webDir: "dist",
  plugins: {
    SystemBars: {
      insetsHandling: "css",
    },
  },
};

export default config;
