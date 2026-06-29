// Fifty22 brand colours
export const BRAND_GREEN = '#1a472a';
export const BRAND_CREAM = '#f5f0e8';
export const DARK_BG = '#0d1f13';
export const CARD_BG = '#1a2e1f';
export const BORDER_COLOR = '#2d4a33';
export const TEXT_PRIMARY = '#f5f0e8';
export const TEXT_SECONDARY = '#9aab9e';
export const LIVE_RED = '#ef4444';
export const LIVE_GREEN = '#22c55e';
export const YELLOW_CARD = '#f59e0b';
export const RED_CARD = '#ef4444';

const tintColorLight = BRAND_GREEN;
const tintColorDark = BRAND_CREAM;

export const Colors = {
  light: {
    text: TEXT_PRIMARY,
    background: DARK_BG,
    tint: tintColorLight,
    icon: TEXT_SECONDARY,
    tabIconDefault: TEXT_SECONDARY,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: TEXT_PRIMARY,
    background: DARK_BG,
    tint: tintColorDark,
    icon: TEXT_SECONDARY,
    tabIconDefault: TEXT_SECONDARY,
    tabIconSelected: tintColorDark,
  },
};

// Legacy exports kept for compatibility
export const zincColors = {
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
  950: '#09090b',
};

export const appleBlue = '#007AFF';
export const appleRed = '#FF3B30';
export const borderColor = BORDER_COLOR;
export const appleGreen = LIVE_GREEN;
