const startWait = 45;
const sentenceGrace = 20;

export function readingClock({ duration, startOnWord, finishSentence, sentenceEnds }) {
  let start = startOnWord ? null : 0;

  function confirmStart(matches) {
    if (start !== null) return;
    const first = matches.find(match => match.i === 0 && match.start < startWait);
    if (first) start = first.start;
  }

  return {
    captureLimit: duration + (startOnWord ? startWait : 0) + (finishSentence ? sentenceGrace : 0),

    observe(elapsed, matches) {
      confirmStart(matches);
      if (start === null) return { waiting: true, remaining: duration, stop: elapsed >= startWait, expired: false };

      const cutoff = start + duration;
      const expired = elapsed >= cutoff;
      const atSentenceEnd = finishSentence && matches.some(match =>
        sentenceEnds.has(match.i) && match.end >= cutoff);
      return {
        waiting: false,
        remaining: Math.max(0, Math.ceil(cutoff - elapsed)),
        expired,
        stop: expired && (!finishSentence || atSentenceEnd || elapsed >= cutoff + sentenceGrace),
      };
    },

    measure(elapsed, words, matches) {
      confirmStart(matches);
      if (start === null) return null;
      const end = Math.min(start + duration, elapsed);
      return {
        seconds: Math.max(0, end - start),
        words: words.filter(word => word.start >= start && word.end <= end),
      };
    },
  };
}
