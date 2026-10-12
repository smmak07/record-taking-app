/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#17241d',
    tint: '#14784f',
    background: '#f3f7f4',
    foreground: '#17241d',
    card: '#ffffff',
    cardForeground: '#17241d',
    primary: '#14784f',
    primaryForeground: '#ffffff',
    secondary: '#e8f1eb',
    secondaryForeground: '#234b37',
    muted: '#edf2ee',
    mutedForeground: '#718078',
    accent: '#e0efe5',
    accentForeground: '#234b37',
    destructive: '#c8443d',
    destructiveForeground: '#ffffff',
    border: '#dfe8e2',
    input: '#e1e9e3',
    success: '#14784f',
    darkGreen: '#0d5e3d',
  },
  dark: {
    text: '#edf5ef',
    tint: '#53c98d',
    background: '#111a15',
    foreground: '#edf5ef',
    card: '#1a261f',
    cardForeground: '#edf5ef',
    primary: '#53c98d',
    primaryForeground: '#0b2116',
    secondary: '#26382d',
    secondaryForeground: '#d9eee0',
    muted: '#243229',
    mutedForeground: '#9aaca0',
    accent: '#294535',
    accentForeground: '#d9eee0',
    destructive: '#f2756d',
    destructiveForeground: '#24100e',
    border: '#304238',
    input: '#304238',
    success: '#53c98d',
    darkGreen: '#174e35',
  },
  radius: 16,
};

export default colors;
