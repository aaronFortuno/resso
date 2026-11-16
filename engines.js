export const engines = [
  { id: 'vosk', name: 'Vosk actual', model: 'vosk' },
  { id: 'context', name: 'Vosk amb context', model: 'vosk' },
  { id: 'whisper', name: 'Whisper Tiny Catalan', model: 'whisper', sizeMb: 86 },
];

// The contextual graph admits unknown speech as well as passage phrases.
export function passageGrammar(reference) {
  const phrases = reference.map((_, index) =>
    reference.slice(index, index + 5).map(word => word.key).join(' '));
  return JSON.stringify([...new Set(phrases), '[unk]']);
}
