import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/900.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import { continueRender, delayRender } from 'remotion';
import { FONTS } from './theme';

// Latin + Cyrillic + Kyrgyz-specific letters, so every subset file is fetched.
const SAMPLE = 'Aa Яя Ңң Өө Үү 0123';
const FACES: [string, number][] = [
  [FONTS.display, 900],
  [FONTS.display, 700],
  [FONTS.display, 600],
  [FONTS.text, 500],
  [FONTS.text, 400],
  [FONTS.mono, 400],
  [FONTS.mono, 700],
];

let started = false;

/** Loads the fonts (npm @fontsource, OFL) once; rendering waits until they are ready. */
export function ensureFonts() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('Loading fonts');
  Promise.all(FACES.map(([family, weight]) => document.fonts.load(`${weight} 40px "${family}"`, SAMPLE)))
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error('Font loading failed', err);
      continueRender(handle);
    });
}
