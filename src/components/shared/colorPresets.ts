export const DEFAULT_COLOR_PRESETS = [
  '#FFFFFF', // White
  '#000000', // Black
  '#808080', // Gray
  '#C0C0C0', // Light Gray
  '#404040', // Dark Gray
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FF8000', // Orange
  '#8000FF', // Purple
  '#0080FF', // Sky Blue
  '#FF0080', // Hot Pink
];

/** Returns the checkmark color that stays visible on top of `bgColor`. */
export const checkmarkColorFor = (bgColor: string): string => {
  const hex = bgColor.replace('#', '').toUpperCase();
  if (hex.length !== 6) return '#FFF';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Perceived luminance (ITU-R BT.709)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 160 ? '#000' : '#FFF';
};
