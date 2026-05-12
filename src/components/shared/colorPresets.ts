export const DEFAULT_COLOR_PRESETS = [
  '#FFFFFF', '#000000', '#2C2C2E', '#48484A', '#FF0055',
  '#00FF9F', '#00B8FF', '#BD00FF', '#FFEE00', '#FF8800',
  '#FF0000', '#39FF14', '#7B61FF', '#FF1493', '#00D1FF',
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
