const wordPattern = /[\p{L}\p{M}]+(?:['’·-][\p{L}\p{M}]+)*/gu;

export function wordsIn(text) {
  return Array.from(text.matchAll(wordPattern), match => ({
    text: match[0],
    index: match.index,
    key: match[0].normalize('NFC').toLocaleLowerCase('ca').replaceAll('’', "'"),
  }));
}

function align(reference, heard) {
  const width = heard.length + 1;
  const cost = new Uint16Array((reference.length + 1) * width);
  const direction = new Uint8Array(cost.length);

  for (let j = 1; j < width; j++) {
    cost[j] = j;
    direction[j] = 3;
  }

  for (let i = 1; i <= reference.length; i++) {
    cost[i * width] = i;
    direction[i * width] = 2;
    for (let j = 1; j < width; j++) {
      const cell = i * width + j;
      const same = reference[i - 1].key === heard[j - 1].key;
      const diagonal = cost[cell - width - 1] + (same ? 0 : 1);
      const omission = cost[cell - width] + 1;
      const addition = cost[cell - 1] + 1;
      if (diagonal <= omission && diagonal <= addition) {
        cost[cell] = diagonal;
        direction[cell] = 1;
      } else if (omission <= addition) {
        cost[cell] = omission;
        direction[cell] = 2;
      } else {
        cost[cell] = addition;
        direction[cell] = 3;
      }
    }
  }

  // The reader may stop anywhere. Unread words after the last match have no cost.
  let end = 0;
  for (let i = 1; i <= reference.length; i++) {
    if (cost[i * width + heard.length] < cost[end * width + heard.length]) end = i;
  }

  const steps = [];
  let i = end;
  let j = heard.length;
  while (i || j) {
    const move = direction[i * width + j];
    if (move === 1) {
      i--;
      j--;
      steps.push({ kind: reference[i].key === heard[j].key ? 'match' : 'substitution', i, word: heard[j] });
    } else if (move === 2) {
      steps.push({ kind: 'omission', i: --i });
    } else {
      steps.push({ kind: 'addition', word: heard[--j] });
    }
  }
  return steps.reverse();
}

function hasConfidence(word) {
  return word.conf >= 0.75;
}

export function analyzeReading(reference, recognized, seconds) {
  const heard = recognized.flatMap(word => wordsIn(word.word).map(token => ({ ...word, ...token })));
  const steps = align(reference, heard);
  const matches = steps.filter(step => step.kind === 'match');
  const lastMatch = steps.findLastIndex(step => step.kind === 'match');
  const firstMatch = steps.findIndex(step => step.kind === 'match');

  if (matches.length < 4 || seconds <= 0 ||
      matches.length / heard.length < 0.55 ||
      matches.length / (matches.at(-1).i + 1) < 0.55) return null;

  const marks = [];
  for (let n = 0; n < lastMatch; n++) {
    const step = steps[n];
    const before = steps[n - 1];
    const after = steps[n + 1];

    // Isolated discrepancies between reliable matches are more actionable.
    const anchored = before?.kind === 'match' && after.kind === 'match' &&
      hasConfidence(before.word) && hasConfidence(after.word);
    if (step.kind === 'addition') {
      const gap = anchored ? after.word.start - step.word.end : Infinity;
      if (anchored && hasConfidence(step.word) &&
          step.word.key !== before.word.key && step.word.key !== after.word.key &&
          gap >= 0 && gap <= 1) {
        marks.push({ kind: 'repair', i: after.i, heard: step.word.text });
      }
    } else if (step.kind !== 'match') {
      const reliable = step.kind === 'omission' || hasConfidence(step.word);
      marks.push({
        kind: anchored && reliable ? step.kind : 'uncertain',
        i: step.i,
        heard: step.word?.text,
      });
    }
  }

  const errorCount = marks.filter(mark => mark.kind === 'substitution' || mark.kind === 'omission').length;
  return {
    correct: matches.length,
    rate: Math.round(60 * matches.length / seconds),
    errorCount,
    repairCount: marks.filter(mark => mark.kind === 'repair').length,
    uncertain: marks.some(mark => mark.kind === 'uncertain') || firstMatch > 0 ||
      steps.slice(lastMatch + 1).some(step => step.kind === 'addition'),
    marks,
  };
}
