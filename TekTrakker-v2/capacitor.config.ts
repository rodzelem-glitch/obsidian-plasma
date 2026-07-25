import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tektrakker.tektrakker',
  appName: 'TekTrakker',
  webDir: 'dist',
  android: {
    adjustMarginsForEdgeToEdge: 'auto'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: "#ffffff",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#3B82F6",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#00000000"
    },
    NavigationBar: {
      style: "DARK",
      backgroundColor: "#00000000"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  },
};

export default config;
