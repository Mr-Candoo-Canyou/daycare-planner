module.exports = {
  expo: {
    name: "Daycare Planner",
    slug: "daycare-planner",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#2563eb"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.daycareplanner.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#2563eb"
      },
      package: "com.daycareplanner.app"
    },
    web: {
      favicon: "./assets/favicon.png"
    }
  }
};
