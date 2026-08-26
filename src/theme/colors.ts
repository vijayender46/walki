export const colors = {
  /*
   * Existing/base colors
   * Keep these for backwards compatibility with current screens.
   */
  primary: "#2D6CDF",
  primaryPressed: "#2459B8",

  accent: "#FFB703",
  accentPressed: "#E5A500",

  success: "#16A34A",
  danger: "#DC2626",

  background: "#F7F8FC",
  surface: "#FFFFFF",

  textPrimary: "#111827",
  textSecondary: "#4B5563",
  textMuted: "#6B7280",

  border: "#E5E7EB",

  white: "#FFFFFF",
  black: "#000000",

  /*
   * Walki Parent Theme
   * Based on the orange/gold reference UI.
   */
  parent: {
    primary: "#FF8200",
    primaryPressed: "#EB7600",

    orange: "#FF8200",
    orangeLight: "#FFA52F",
    orangeSoft: "#FFF1E2",
    orangeFaint: "#FFF8F1",

    gold: "#FFB02E",
    goldSoft: "#FFE0A6",

    background: "#FFF9F3",
    backgroundTop: "#FFFCF9",

    surface: "#FFFFFF",
    surfaceWarm: "#FFFDFB",

    textPrimary: "#101114",
    textSecondary: "#707482",
    textMuted: "#9699A3",

    border: "#F4E8DC",

    online: "#0ACB58",
    notification: "#FF7200",
  },

  /*
   * Kid — Boy Theme
   */
  boy: {
    primary: "#2D6CDF",
    primaryPressed: "#2459B8",

    blue: "#2D6CDF",
    blueLight: "#58A5FF",
    blueSoft: "#E7F1FF",
    blueFaint: "#F6FAFF",

    background: "#F7FAFF",

    surface: "#FFFFFF",

    textPrimary: "#0F1B2E",
    textSecondary: "#667085",

    online: "#0ACB58",
  },

  /*
   * Kid — Girl Theme
   */
  girl: {
    primary: "#FF5CA8",
    primaryPressed: "#EB438F",

    pink: "#FF5CA8",
    pinkLight: "#FF8BC4",
    pinkSoft: "#FFE8F3",
    pinkFaint: "#FFF7FB",

    background: "#FFF8FC",

    surface: "#FFFFFF",

    textPrimary: "#21101A",
    textSecondary: "#766772",

    online: "#0ACB58",
  },

  /*
   * Shared neutrals for new UI.
   */
  neutral: {
    50: "#FAFAFA",
    100: "#F5F5F6",
    200: "#E8E9EC",
    300: "#D1D3D8",
    400: "#A6A9B1",
    500: "#777B87",
    600: "#5D616D",
    700: "#3E424C",
    800: "#252830",
    900: "#111318",
  },
} as const;
