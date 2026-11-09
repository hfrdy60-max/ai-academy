import type { CapacitorConfig } from "@capacitor/cli";

// This first Android build is a lightweight native shell around the currently
// published web app. The app loads the same HTTPS origin as the browser version,
// so the existing API CORS allow-list and server-side secrets remain unchanged.
const config: CapacitorConfig = {
  appId: "com.hfrdy60.aiacademy",
  appName: "AI ACADEMY",
  webDir: "dist",
  server: {
    url: "https://hfrdy60-max.github.io/ai-academy/",
    cleartext: false,
    allowNavigation: ["hfrdy60-max.github.io"]
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
