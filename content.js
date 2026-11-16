import ca from './locales/ca.js';
import catalanPassages from './texts/ca.js';

const interfaces = { ca };
const readings = {
  ca: {
    locale: 'ca',
    modelUrl: new URL('./vendor/vosk-model-small-ca-0.4.tar.gz', import.meta.url),
    modelSizeMb: 42,
    passages: catalanPassages,
  },
};

export const ui = interfaces.ca;
export const reading = readings.ca;
