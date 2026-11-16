const startWait = 45;
const sentenceGrace = 20;

export function readingClock({ duration, finishSentence, sentenceEnds }) {
  let start;
  let firstScoredWord;

  return {
    captureLimit: duration + startWait + (finishSentence ? sentenceGrace : 0),

    get start() { return start; },

    confirmStart(seconds, matchTime = seconds) {
      if (start === undefined && Number.isFinite(seconds) && Number.isFinite(matchTime) &&
          seconds >= 0 && seconds <= matchTime && matchTime < startWait) {
        start = seconds;
        firstScoredWord = matchTime;
      }
    },

    observe(elapsed, matches) {
      if (start === undefined) return { waiting: true, remaining: duration, stop: elapsed >= startWait, expired: false };

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

    measure(elapsed, words) {
      if (start === undefined) return null;
      const end = Math.min(start + duration, elapsed);
      return {
        seconds: Math.max(0, end - start),
        words: words.filter(word => word.start >= firstScoredWord && word.end <= end),
      };
    },
  };
}
