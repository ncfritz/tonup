#!/usr/bin/env node
// Contrast checks for every theme and mode (docs/design/themes.md → Rules).
import { readFileSync } from 'node:fs';

const palettes = JSON.parse(readFileSync(new URL('../src/theme/palettes.json', import.meta.url)));

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground, background, minimum ratio]
const pairs = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surface2', 4.5],
  ['muted', 'bg', 4.5],
  ['muted', 'surface', 4.5],
  ['onAccent', 'accent', 4.5],
  ['onDanger', 'danger', 4.5],
  ['playLabel', 'playLabelBg', 4.5],
  // Large text and icons: the selected tab and accent headings.
  ['accent', 'surface', 3],
  ['accent', 'bg', 3],
  // Board numbers around the board.
  ['boardNumber', 'bg', 4.5],
];

let failures = 0;
for (const [theme, modes] of Object.entries(palettes)) {
  for (const [mode, c] of Object.entries(modes)) {
    for (const [fg, bg, min] of pairs) {
      const r = ratio(c[fg], c[bg]);
      if (r < min) {
        failures++;
        console.error(`✗ ${theme}-${mode}: ${fg} on ${bg} = ${r.toFixed(2)} (needs ${min})`);
      }
    }
  }
}

// The theme picker's previews of the Pro themes (src/theme/previews.json), until their full
// palettes arrive in M14.
const previews = JSON.parse(readFileSync(new URL('../src/theme/previews.json', import.meta.url)));
for (const [theme, modes] of Object.entries(previews)) {
  for (const [mode, c] of Object.entries(modes)) {
    for (const [fg, bg] of [['text', 'bg'], ['text', 'surface']]) {
      const r = ratio(c[fg], c[bg]);
      if (r < 4.5) {
        failures++;
        console.error(`✗ preview ${theme}-${mode}: ${fg} on ${bg} = ${r.toFixed(2)} (needs 4.5)`);
      }
    }
  }
}

if (failures) process.exit(1);
console.log(
  `Contrast OK for ${Object.keys(palettes).length} theme(s) and ${Object.keys(previews).length} previews`,
);
