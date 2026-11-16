const wordPattern = /[\p{L}\p{M}]+(?:['’·-][\p{L}\p{M}]+)*/gu;
const replayWords = 3;
const editCost = 10;
const replayCost = 19;
const diagonal = 1;
const omission = 2;
const addition = 3;
const replay = 4;

export function wordsIn(text, locale) {
  return Array.from(text.matchAll(wordPattern), match => ({
    text: match[0],
    index: match.index,
    key: match[0].normalize('NFC').toLocaleLowerCase(locale).replaceAll('’', "'"),
  }));
}

function align(reference, heard, initialSkip = 0) {
  const width = heard.length + 1;
  const cost = new Int32Array((reference.length + 1) * width);
  const direction = new Uint8Array(cost.length);
  const replayFrom = new Int32Array(cost.length);
  const bestBehind = new Int32Array(reference.length + 2);

  for (let i = 1; i <= reference.length; i++) {
    cost[i * width] = Math.max(0, i - initialSkip) * editCost;
    direction[i * width] = omission;
  }

  for (let j = 1; j < width; j++) {
    cost[j] = j * editCost;
    direction[j] = addition;

    // A reread can start after an actual match. Keep the cheapest later
    // position from the previous column so each backward transition is O(1).
    let best = -1;
    for (let i = reference.length; i >= 1; i--) {
      const cell = i * width + j - 1;
      const matched = j > 1 && reference[i - 1].key === heard[j - 2].key &&
        (direction[cell] === diagonal || direction[cell] === replay);
      if (matched && (best === -1 || cost[cell] <= cost[best * width + j - 1])) best = i;
      bestBehind[i] = best;
    }

    for (let i = 1; i <= reference.length; i++) {
      const cell = i * width + j;
      const same = reference[i - 1].key === heard[j - 1].key;
      cost[cell] = cost[cell - width - 1] + (same ? 0 : editCost);
      direction[cell] = diagonal;
      const skip = cost[cell - width] + editCost;
      const extra = cost[cell - 1] + editCost;
      if (skip < cost[cell]) {
        cost[cell] = skip;
        direction[cell] = omission;
      }
      if (extra < cost[cell]) {
        cost[cell] = extra;
        direction[cell] = addition;
      }

      const minimumFrom = i + replayWords - 1;
      const from = minimumFrom <= reference.length ? bestBehind[minimumFrom] : -1;
      if (same && from !== -1 && j + replayWords <= width) {
        const jump = cost[from * width + j - 1] + replayCost;
        if (jump < cost[cell] &&
            reference[i].key === heard[j].key &&
            reference[i + 1].key === heard[j + 1].key) {
          cost[cell] = jump;
          direction[cell] = replay;
          replayFrom[cell] = from;
        }
      }
    }
  }

  // Keep the cheapest prefix and leave the unread tail outside the alignment.
  let i = 0;
  let j = heard.length;
  for (let end = 1; end <= reference.length; end++) {
    if (cost[end * width + j] < cost[i * width + j]) i = end;
  }

  const steps = [];
  while (i || j) {
    const cell = i * width + j;
    const move = direction[cell];
    if (move === diagonal || move === replay) {
      i--;
      j--;
      const kind = reference[i].key === heard[j].key ? 'match' : 'substitution';
      steps.push({ kind, i, word: heard[j] });
      if (move === replay) {
        steps.push({ kind: 'reread', i, from: replayFrom[cell] });
        i = replayFrom[cell];
      }
    } else if (move === omission) {
      steps.push({ kind: 'omission', i: --i });
    } else {
      steps.push({ kind: 'addition', word: heard[--j] });
    }
  }
  return steps.reverse();
}

function reliable(word) {
  return !word.provisional && word.conf >= 0.9;
}

function isMatch(step) {
  return step?.kind === 'match';
}

function strongContext(steps, index) {
  return [-2, -1, 1, 2].every(offset => {
    const step = steps[index + offset];
    return isMatch(step) && reliable(step.word);
  });
}

function similarShortWords(expected, heard) {
  return expected.length <= 3 && expected.length === heard.length &&
    [...expected].filter((char, i) => char !== heard[i]).length === 1;
}

function discrepancy(mark) {
  return mark?.kind === 'substitution' || mark?.kind === 'uncertain';
}

function recognizedWords(recognized, locale) {
  return recognized.flatMap(word => wordsIn(word.word, locale).map(token => ({ ...word, ...token })));
}

function identifiesPosition(reference, steps, at) {
  const index = steps[at].i;
  let first = at;
  let last = at;
  // A repeated word needs nearby matches to locate it in the passage.
  while (at - first < 3 && isMatch(steps[first - 1]) && steps[first - 1].i === steps[first].i - 1) first--;
  while (last - at < 3 && isMatch(steps[last + 1]) && steps[last + 1].i === steps[last].i + 1) last++;
  const context = steps.slice(first, last + 1);
  return !reference.some((word, other) =>
    other !== index && word.key === reference[index].key &&
    context.every(step => reference[other + step.i - index]?.key === step.word.key));
}

export function findReadingStart(reference, index, recognized, locale) {
  // Locate the speech anywhere first, then accept only the three allowed
  // positions. A reading begun much later must be able to align there.
  const steps = align(reference, recognizedWords(recognized, locale), reference.length);
  const at = steps.findIndex((step, at) => isMatch(step) &&
    step.i >= index && step.i <= index + 2 && Number.isFinite(step.word.start) &&
    identifiesPosition(reference, steps, at));
  if (at === -1) return;

  const match = steps[at];
  const matchTime = match.word.start;
  let time = matchTime;
  // Look back only at timestamped speech aligned to a word inside the
  // starting window. A missing word or a pause gives no reliable onset.
  for (let n = at - 1, previousIndex = match.i - 1; previousIndex >= index; n--, previousIndex--) {
    const previous = steps[n];
    if (previous?.kind !== 'substitution' || previous.i !== previousIndex) break;
    const { start, end } = previous.word;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= time ||
        time - end > 0.5 || end - time > 0.1 || matchTime - start > 2) break;
    time = start;
  }
  return { index: match.i, time, matchTime };
}

export function trackReading(reference, recognized, { partial = '', locale } = {}) {
  const heard = recognizedWords(recognized, locale);
  heard.push(...wordsIn(partial, locale).map(word => ({ ...word, provisional: true })));
  const steps = align(reference, heard);
  const marks = Array(reference.length).fill(null);
  const rereads = [];
  const matches = [];
  let highWater = 0;
  let latest;
  let take;
  let matched = 0;
  const lastMatch = steps.findLastIndex(isMatch);

  // Do not assign errors to the unanchored end of the recording.
  for (let n = 0; n <= lastMatch; n++) {
    const step = steps[n];
    if (step.kind === 'reread') {
      take = { start: step.i, end: step.i, until: Math.max(highWater, step.from), corrected: false };
      rereads.push(take);
      continue;
    }

    const before = steps[n - 1];
    const after = steps[n + 1];
    if (step.kind === 'addition') {
      const anchored = strongContext(steps, n);
      const gap = anchored ? after.word.start - step.word.end : NaN;
      if (anchored && reliable(step.word) &&
          step.word.key !== before.word.key && step.word.key !== after.word.key &&
          gap >= 0 && gap <= 1) {
        marks[after.i] = { kind: 'repair', heard: step.word.text };
      }
      continue;
    }

    highWater = Math.max(highWater, step.i + 1);
    const prior = marks[step.i];
    if (step.kind === 'match') {
      latest = step.i;
      matched++;
      if (Number.isFinite(step.word.start) && Number.isFinite(step.word.end)) {
        matches.push({ i: step.i, start: step.word.start, end: step.word.end });
      }
      if (take && step.i < take.until) {
        take.end = Math.max(take.end, step.i);
        take.corrected ||= prior?.kind === 'substitution';
        marks[step.i] = { kind: prior?.kind === 'substitution' || prior?.kind === 'corrected' ? 'corrected' : 'reread' };
      } else if (prior?.kind !== 'repair') {
        marks[step.i] = { kind: 'match' };
      }
    } else if (prior === null || discrepancy(prior)) {
      // A gap can mean either a skipped word or a miss by the recognizer.
      const clear = step.kind === 'substitution' && reliable(step.word) && strongContext(steps, n) &&
        !similarShortWords(reference[step.i].key, step.word.key);
      marks[step.i] = { kind: clear ? 'substitution' : 'uncertain', heard: step.word?.text };
    }
  }

  const correct = marks.filter(mark => mark && !discrepancy(mark)).length;
  const coverage = Math.min(matched / heard.length || 0, correct / highWater || 0);
  const reliableAssessment = coverage >= 0.85;
  if (!reliableAssessment) {
    marks.forEach((mark, i) => {
      if (mark?.kind === 'substitution') marks[i] = { ...mark, kind: 'uncertain' };
      if (mark?.kind === 'repair') marks[i] = { kind: 'match' };
      if (mark?.kind === 'corrected') marks[i] = { kind: 'reread' };
    });
    for (const reread of rereads) reread.corrected = false;
  }
  return { marks, rereads, matches, cursor: latest, correct, coverage, reliableAssessment, unalignedTail: lastMatch < steps.length - 1 };
}

export function summarizeReading(track, seconds) {
  if (track.correct < 4 || seconds <= 0) return null;

  const errors = [];
  const repairs = [];
  let doubtful = 0;
  let review = 0;
  track.marks.forEach((mark, i) => {
    if (mark?.kind === 'substitution') errors.push({ ...mark, i });
    if (mark?.kind === 'repair') repairs.push({ ...mark, i });
    if (mark?.kind === 'uncertain') {
      doubtful++;
      if (track.marks[i - 1]?.kind !== 'uncertain') review++;
    }
  });
  const rate = correct => Math.round(60 * correct / seconds);
  return {
    correct: track.correct,
    rate: rate(track.correct),
    errors,
    repairs,
    rereads: track.rereads,
    review,
    doubtful,
    optimisticRate: rate(track.correct + doubtful),
    reliableAssessment: track.reliableAssessment,
    uncertain: track.unalignedTail || !track.reliableAssessment || doubtful > 0,
  };
}
