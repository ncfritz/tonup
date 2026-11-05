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
  // Status colours (labelled / values only / to label), as text and bars on the app's surfaces.
  ['pending', 'surface', 4.5],
  ['pending', 'bg', 4.5],
  ['info', 'surface', 4.5],
  ['info', 'bg', 4.5],
  // Filled highlights (the session being shot, a live run): text and their colour on them.
  ['text', 'accentSoft', 4.5],
  ['muted', 'accentSoft', 4.5],
  ['accent', 'accentSoft', 3],
  ['text', 'pendingSoft', 4.5],
  ['pending', 'pendingSoft', 3],
  // Board numbers on the ring around the board.
  ['boardNumber', 'boardSurround', 4.5],
  // A dart's outline, and the number on it, against its fill.
  ['dartStroke', 'dart', 4.5],
];

let failures = 0;
for (const [theme, modes] of Object.entries(palettes)) {
  for (const [mode, c] of Object.entries(modes)) {
    // Darts stand out on every segment (WCAG 1.4.11, 3:1 for graphics): the fill or the outline.
    for (const seg of ['boardDark', 'boardLight', 'boardRed', 'boardGreen']) {
      const r = Math.max(ratio(c.dart, c[seg]), ratio(c.dartStroke, c[seg]));
      if (r < 3) {
        failures++;
        console.error(`✗ ${theme}-${mode}: dart on ${seg} = ${r.toFixed(2)} (needs 3)`);
      }
    }
    for (const [fg, bg, min] of pairs) {
      const r = ratio(c[fg], c[bg]);
      if (r < min) {
        failures++;
        console.error(`✗ ${theme}-${mode}: ${fg} on ${bg} = ${r.toFixed(2)} (needs ${min})`);
      }
    }
  }
}

if (failures) process.exit(1);
const variants = Object.values(palettes).reduce((n, m) => n + Object.keys(m).length, 0);
console.log(`Contrast OK for ${variants} palettes`);
