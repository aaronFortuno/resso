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
  return word.provisional || word.conf >= 0.75;
}

function isMatch(step) {
  return step?.kind === 'match';
}

function boundedByMatches(before, after) {
  return isMatch(before) && isMatch(after) && reliable(before.word) && reliable(after.word);
}

function shortOmission(steps, index) {
  let first = index;
  let last = index;
  while (steps[first - 1]?.kind === 'omission') first--;
  while (steps[last + 1]?.kind === 'omission') last++;
  return last - first < 3 && boundedByMatches(steps[first - 1], steps[last + 1]);
}

function discrepancy(mark) {
  return mark && ['substitution', 'omission', 'uncertain'].includes(mark.kind);
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
  const match = steps.find((step, at) => isMatch(step) &&
    step.i >= index && step.i <= index + 2 && Number.isFinite(step.word.start) &&
    identifiesPosition(reference, steps, at));
  return match && { index: match.i, time: match.word.start };
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
    const anchored = boundedByMatches(before, after);
    if (step.kind === 'addition') {
      const gap = anchored ? after.word.start - step.word.end : NaN;
      if (anchored && reliable(step.word) &&
          step.word.key !== before.word.key && step.word.key !== after.word.key &&
          (step.word.provisional || (gap >= 0 && gap <= 1))) {
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
        take.corrected ||= Boolean(discrepancy(prior));
        marks[step.i] = { kind: discrepancy(prior) || prior?.kind === 'corrected' ? 'corrected' : 'reread' };
      } else if (prior?.kind !== 'repair') {
        marks[step.i] = { kind: 'match' };
      }
    } else if (prior === null || discrepancy(prior)) {
      const clear = step.kind === 'omission' ? shortOmission(steps, n) : anchored && reliable(step.word);
      marks[step.i] = { kind: clear ? step.kind : 'uncertain', heard: step.word?.text };
    }
  }

  return { marks, rereads, matches, cursor: latest, matched, heard: heard.length, highWater, unalignedTail: lastMatch < steps.length - 1 };
}

export function summarizeReading(track, seconds) {
  const correct = track.marks.filter(mark =>
    mark && ['match', 'repair', 'reread', 'corrected'].includes(mark.kind)).length;
  if (correct < 4 || seconds <= 0 ||
      track.matched / track.heard < 0.55 || correct / track.highWater < 0.55) return null;

  const errors = [];
  const repairs = [];
  track.marks.forEach((mark, i) => {
    if (mark?.kind === 'substitution' || mark?.kind === 'omission') errors.push({ ...mark, i });
    if (mark?.kind === 'repair') repairs.push({ ...mark, i });
  });
  return {
    correct,
    rate: Math.round(60 * correct / seconds),
    errors,
    repairs,
    rereads: track.rereads,
    uncertain: track.unalignedTail || track.marks.some(mark => mark?.kind === 'uncertain'),
  };
}
