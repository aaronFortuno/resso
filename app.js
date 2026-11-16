import { reading, ui } from './content.js';
import { engines, passageGrammar } from './engines.js';
import { findReadingStart, summarizeReading, trackReading, wordsIn } from './reading.js';
import { prepareModel, startCapture, startWhisperCapture } from './speech.js';
import { readingClock } from './timing.js';
import { prepareWhisper } from './whisper.js';

const byId = id => document.getElementById(id);
const action = byId('action');
const status = byId('status');
const clock = byId('clock');
const progress = byId('progress');
const report = byId('report');
const metrics = byId('metrics');
const scenarios = byId('scenarios');
const details = byId('details');
const transcript = byId('transcript-content');
const transcriptEmpty = byId('transcript-empty');
const transcriptHelp = byId('transcript-help');
const transcriptScroll = byId('transcript-scroll');
const passageScroll = byId('passage-scroll');
const follow = byId('follow');
const duration = byId('duration');
const chooseStart = byId('choose-start');
const resetStart = byId('reset-start');
const pickStartHelp = byId('pick-start-help');
const passageChoice = byId('passage-choice');
const engineChoice = byId('speech-engine');
const settings = byId('settings');
const { locale, passages } = reading;

document.documentElement.lang = ui.locale;
document.title = ui.title;
for (const element of document.querySelectorAll('[data-copy]')) {
  element.textContent = ui[element.dataset.copy];
}
for (const element of document.querySelectorAll('[data-label]')) {
  element.setAttribute('aria-label', ui[element.dataset.label]);
}
const textPanel = byId('passage');
const passageText = byId('passage-text');
const lineCounts = byId('line-counts');
textPanel.lang = locale;
transcript.lang = locale;

const reference = [];
const spans = [];
const sentenceEnds = new Set();
const limit = () => Number(duration.value);
const selectedEngine = () => engines.find(engine => engine.id === engineChoice.value);

let model;
let modelFamily;
let lifetime = new AbortController();
let stopReading;
let mode = 'initial';
let committedTrack;
let displayedMarks = [];
let cursor;
let startIndex = 0;
let defaultStartIndex = 0;

function showPassage() {
  const passage = passages[Number(passageChoice.value)];
  byId('passage-title').textContent = passage.title;
  setPicking(false);
  passageText.replaceChildren();
  reference.length = 0;
  spans.length = 0;
  sentenceEnds.clear();
  let firstSentenceEnd;

  for (const text of passage.paragraphs) {
    const paragraph = document.createElement('p');
    const words = wordsIn(text, locale);
    let offset = 0;
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.textContent = word.text;
      paragraph.append(text.slice(offset, word.index), span);
      offset = word.index + word.text.length;
      const next = words[i + 1]?.index ?? text.length;
      const index = reference.length;
      span.dataset.word = index;
      if (/[.!?…]/.test(text.slice(offset, next))) {
        sentenceEnds.add(index);
        firstSentenceEnd ??= index;
      } else if (i === words.length - 1) {
        sentenceEnds.add(index);
      }
      reference.push(word);
      spans.push(span);
    });
    paragraph.append(text.slice(offset));
    passageText.append(paragraph);
  }
  const nextSentence = (firstSentenceEnd ?? -1) + 1;
  defaultStartIndex = spans[nextSentence] ? nextSentence : 0;
  setStartWord(defaultStartIndex);
}

function updateLineCounts() {
  const top = textPanel.getBoundingClientRect().top;
  const lines = [];
  let line;
  let lastWord = -1;
  spans.forEach((word, index) => {
    const rects = [...word.getClientRects()];
    rects.forEach((rect, part) => {
      if (!line || Math.abs(rect.top - line.top) > 1) {
        line = { top: rect.top, middle: rect.top + rect.height / 2 - top, lastWord };
        lines.push(line);
      }
      if (part === rects.length - 1) {
        lastWord = index;
        line.lastWord = index;
      }
    });
  });
  const labels = lines.map(({ middle, lastWord }) => {
    const label = document.createElement('span');
    label.style.top = `${middle}px`;
    label.textContent = Math.max(0, lastWord - startIndex + 1);
    return label;
  });
  lineCounts.replaceChildren(...labels);
}

function setStartWord(index) {
  spans[startIndex]?.removeAttribute('data-start');
  startIndex = index;
  spans[index].setAttribute('data-start', '');
  const word = reference[index].text;
  byId('start-word-label').textContent = index > 0 && index === defaultStartIndex
    ? ui.secondSentence(word)
    : ui.startChoice(word, index + 1);
  resetStart.disabled = index === 0;
  updateLineCounts();
}

function focusWord(index) {
  const word = spans[index];
  reveal(passageScroll, word);
  word.focus({ preventScroll: true });
}

function setPicking(active) {
  if (active === textPanel.hasAttribute('data-picking-start')) return;
  textPanel.toggleAttribute('data-picking-start', active);
  chooseStart.setAttribute('aria-pressed', String(active));
  pickStartHelp.hidden = !active;
  for (const word of spans) {
    if (active) {
      word.setAttribute('role', 'button');
      word.tabIndex = -1;
    } else {
      word.removeAttribute('role');
      word.removeAttribute('tabindex');
    }
  }
  if (active) focusWord(startIndex);
}

function finishPicking(index) {
  if (index !== undefined) setStartWord(index);
  setPicking(false);
  chooseStart.focus({ preventScroll: true });
}

function state(next, label, message, busy = false) {
  mode = next;
  action.textContent = label;
  action.disabled = busy;
  status.textContent = message;
  settings.disabled = busy || next === 'reading';
}

function setTime(seconds) {
  clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  progress.value = seconds;
}

function reveal(container, element) {
  const viewport = container.getBoundingClientRect();
  const target = element.getBoundingClientRect();
  if (target.top < viewport.top + 10) container.scrollTop += target.top - viewport.top - 10;
  if (target.bottom > viewport.bottom - 10) container.scrollTop += target.bottom - viewport.bottom + 10;
}

function setCursor(index) {
  const next = spans[index];
  if (next === cursor) return;
  cursor?.removeAttribute('aria-current');
  cursor = next;
  if (cursor) {
    cursor.setAttribute('aria-current', 'true');
    if (follow.checked) reveal(passageScroll, cursor);
  }
}

function markText(index, mark) {
  const target = reference[index].text;
  if (mark.kind === 'substitution') return ui.heardInstead(target, mark.heard);
  if (mark.kind === 'uncertain') return mark.heard ? ui.reviewDifference(target, mark.heard) : ui.reviewGap(target);
  if (mark.kind === 'repair') return ui.wordRepair(target, mark.heard);
  return ui[mark.kind];
}

function sameMark(left, right) {
  return left?.kind === right?.kind && left?.heard === right?.heard;
}

function paintMarks(marks, stable = marks) {
  spans.forEach((span, i) => {
    const mark = marks[i];
    const provisional = !sameMark(mark, stable[i]);
    if (sameMark(mark, displayedMarks[i]) && provisional === span.hasAttribute('data-provisional')) return;
    if (mark) {
      span.dataset.reading = mark.kind;
      span.toggleAttribute('data-provisional', provisional);
      span.title = provisional ? `${ui.provisional} · ${markText(i, mark)}` : markText(i, mark);
    } else {
      delete span.dataset.reading;
      delete span.dataset.provisional;
      span.removeAttribute('title');
    }
  });
  displayedMarks = marks;
}

function showTranscript(confirmed, partial) {
  const atBottom = transcriptScroll.scrollHeight - transcriptScroll.clientHeight - transcriptScroll.scrollTop < 28;
  byId('committed').textContent = confirmed;
  byId('partial').textContent = confirmed && partial ? ' ' + partial : partial;
  transcript.hidden = !confirmed && !partial;
  transcriptEmpty.hidden = !transcript.hidden;
  if (atBottom) transcriptScroll.scrollTop = transcriptScroll.scrollHeight;
}

function clearReading() {
  report.hidden = true;
  metrics.hidden = true;
  scenarios.hidden = true;
  details.hidden = true;
  details.replaceChildren();
  byId('report-note').textContent = '';
  byId('rate').textContent = '';
  byId('errors').textContent = '';
  byId('review-count').textContent = '';
  byId('repairs').textContent = '';
  byId('reread-count').textContent = '';
  byId('scenario-wrong').textContent = '';
  byId('scenario-correct').textContent = '';
  committedTrack = undefined;
  paintMarks([]);
  setCursor(undefined);
  showTranscript('', '');
  transcriptHelp.textContent = selectedEngine().model === 'whisper' ? ui.whisperTranscript : ui.transcriptHelp;
  transcriptEmpty.textContent = ui.transcriptEmpty;
  passageScroll.scrollTop = 0;
  progress.max = limit();
  setTime(limit());
}

function showReport(measurement, { passage, offset, prefix, estimatedStart } = {}) {
  const track = measurement && trackReading(passage, measurement.words, { locale });
  const summary = track && summarizeReading(track, measurement.seconds);
  const note = byId('report-note');
  if (track) paintMarks(prefix.concat(track.marks));
  if (summary) {
    const showScenarios = summary.doubtful > 0;
    const seconds = Math.max(1, Math.round(measurement.seconds));
    scenarios.hidden = !showScenarios;
    byId('rate-metric').hidden = showScenarios;
    byId('errors-metric').hidden = showScenarios;
    byId('rate').textContent = summary.rate;
    byId('errors').textContent = summary.errors.length;
    if (showScenarios) {
      byId('scenario-wrong').textContent =
        ui.scenario(summary.correct, summary.errors.length + summary.doubtful, summary.rate);
      byId('scenario-correct').textContent =
        ui.scenario(summary.correct + summary.doubtful, summary.errors.length, summary.optimisticRate);
    }
    byId('repairs').textContent = summary.reliableAssessment ? summary.repairs.length : '—';
    byId('review-count').textContent = summary.review;
    byId('review-metric').hidden = !summary.review;
    byId('reread-count').textContent = summary.rereads.length;
    byId('reread-metric').hidden = !summary.rereads.length;
    note.textContent = showScenarios
      ? ui.scenarioNote(seconds, summary.doubtful)
      : ui.estimated(summary.correct, seconds);
    if (summary.uncertain) note.textContent += ui.alignmentNote;
    if (estimatedStart) note.textContent += ui.estimatedStartNote;
    const observations = [...summary.errors, ...summary.repairs].map(mark => markText(mark.i + offset, mark));
    for (const { start, end, corrected } of summary.rereads) {
      const fragment = passage.slice(start, end + 1).map(word => word.text).join(' ');
      observations.push(corrected ? ui.phraseCorrected(fragment) : ui.phraseReread(fragment));
    }
    for (const text of observations) {
      const item = document.createElement('li');
      item.textContent = text;
      details.append(item);
    }
    metrics.hidden = false;
    details.hidden = !observations.length;
  } else {
    note.textContent = measurement ? ui.noResult : ui.noStart;
  }
  report.hidden = false;
  const heading = byId('report-title');
  heading.focus({ preventScroll: true });
  reveal(report.parentElement, heading);
}

async function prepare() {
  const engine = selectedEngine();
  const signal = lifetime.signal;
  state('loading', ui.loadingButton, ui.loading(engine.sizeMb ?? reading.modelSizeMb), true);
  try {
    const prepared = engine.model === 'whisper'
      ? await prepareWhisper(signal)
      : await prepareModel(reading.modelUrl, signal);
    if (signal.aborted) {
      prepared.terminate();
      return;
    }
    model = prepared;
    modelFamily = engine.model;
    state('ready', ui.startButton, ui.start);
    action.focus({ preventScroll: true });
  } catch {
    if (!signal.aborted) state('initial', ui.reloadButton, ui.loadFailed);
  }
}

async function read() {
  setPicking(false);
  clearReading();
  const selectedIndex = startIndex;
  const engine = selectedEngine();
  const usingWhisper = engine.model === 'whisper';
  const signal = lifetime.signal;
  if (selectedIndex !== defaultStartIndex) reveal(passageScroll, spans[selectedIndex]);
  const sound = byId('end-sound').checked;
  const finishSentence = byId('finish-sentence').checked;
  const relativeEnds = new Set();
  const timing = readingClock({ duration: limit(), finishSentence, sentenceEnds: relativeEnds });
  const waitingMessage = selectedIndex > 0 && selectedIndex === defaultStartIndex
    ? ui.warmup
    : ui.waiting(reference[selectedIndex].text);
  let scoring;
  let confirmedTranscript = '';
  let session;
  let ended = false;
  let manuallyStopped = false;
  let elapsed = 0;
  let transcribedThrough = usingWhisper ? 0 : Infinity;

  function advance() {
    if (!session || ended || action.disabled) return;
    const clockTime = timing.start === undefined ? Math.min(elapsed, transcribedThrough) : elapsed;
    const time = timing.observe(clockTime, committedTrack?.matches ?? []);
    setTime(time.remaining);
    const message = time.waiting ? waitingMessage : scoring.message;
    if (status.textContent !== message) status.textContent = message;
    if (time.stop) {
      action.disabled = true;
      session.finish();
    }
  }

  state('starting', ui.startingButton, ui.starting, true);
  try {
    const callbacks = {
      onAudio(seconds) {
        elapsed = seconds;
        advance();
      },
      onRecognition({ words, transcript, partial, committed, through }) {
        if (through !== undefined) transcribedThrough = through;
        if (committed) {
          confirmedTranscript = transcript ?? words.map(word => word.word).join(' ');
          if (!scoring) {
            const start = findReadingStart(reference, selectedIndex, words, locale);
            timing.confirmStart(start?.time, start?.matchTime);
            if (timing.start !== undefined) {
              const offset = start.index;
              const estimatedStart = start.time < start.matchTime;
              scoring = {
                offset,
                passage: reference.slice(offset),
                prefix: Array(offset).fill(null),
                matchTime: start.matchTime,
                estimatedStart,
                message: estimatedStart ? ui.countingEstimated(reference[offset].text) : ui.counting(reference[offset].text),
              };
              for (const end of sentenceEnds) {
                if (end >= offset) relativeEnds.add(end - offset);
              }
            }
          }
        }
        showTranscript(confirmedTranscript, partial);
        if (scoring) {
          const { passage, prefix, offset } = scoring;
          const readingWords = words.filter(word => word.start >= scoring.matchTime);
          if (committed) committedTrack = trackReading(passage, readingWords, { locale });
          const current = partial ? trackReading(passage, readingWords, { partial, locale }) : committedTrack;
          paintMarks(prefix.concat(current.marks), prefix.concat(committedTrack.marks));
          setCursor(current.cursor === undefined ? undefined : current.cursor + offset);
        }
        advance();
      },
      onStopped(seconds) {
        ended = true;
        const time = timing.observe(seconds, committedTrack?.matches ?? []);
        setTime(time.remaining);
        const timedOut = !manuallyStopped && time.expired;
        state('working', ui.workingButton, timedOut ? ui.timeUp : ui.working, true);
        return sound && timedOut;
      },
    };
    session = usingWhisper
      ? await startWhisperCapture(model, timing.captureLimit, callbacks, { locale, signal })
      : await startCapture(model, timing.captureLimit, callbacks, {
        grammar: engine.id === 'context' ? passageGrammar(reference) : undefined,
        signal,
      });
    stopReading = () => {
      manuallyStopped = true;
      action.disabled = true;
      session.finish();
    };
    state('reading', ui.finishButton, waitingMessage);
    action.focus({ preventScroll: true });
    const { seconds, words } = await session.result;
    const measurement = timing.measure(seconds, words);
    setTime(timing.observe(seconds, committedTrack?.matches ?? []).remaining);
    setCursor(undefined);
    transcriptHelp.textContent = ui.transcriptFinal;
    transcriptEmpty.textContent = ui.transcriptNoWords;
    state('ready', ui.retryButton, ui.done);
    showReport(measurement, scoring);
  } catch (error) {
    if (signal.aborted) return;
    setCursor(undefined);
    const message = error.name === 'NotAllowedError' ? ui.denied : ui.captureFailed;
    if (usingWhisper && error.name !== 'NotAllowedError') {
      releaseModel();
      state('initial', ui.initialButton, message);
    } else {
      state('ready', ui.retryButton, message);
    }
    setTime(limit());
  } finally {
    stopReading = undefined;
  }
}

function releaseModel() {
  model?.terminate();
  model = undefined;
  modelFamily = undefined;
}

action.addEventListener('click', () => {
  if (mode === 'initial') void prepare();
  else if (mode === 'ready') void read();
  else if (mode === 'reading') stopReading?.();
});

follow.addEventListener('change', () => {
  if (follow.checked && cursor) reveal(passageScroll, cursor);
});
window.addEventListener('pagehide', () => {
  lifetime.abort();
  releaseModel();
});
window.addEventListener('pageshow', event => {
  if (event.persisted && lifetime.signal.aborted) {
    lifetime = new AbortController();
    clearReading();
    state('initial', ui.initialButton, ui.initial);
  }
});

engines.forEach(engine => engineChoice.add(new Option(engine.name, engine.id)));
engineChoice.value = 'vosk';
engineChoice.addEventListener('change', () => {
  const engine = selectedEngine();
  byId('engine-note').textContent = ui.engineNotes[engine.id] ?? '';
  byId('engine-note').hidden = !ui.engineNotes[engine.id];
  clearReading();
  if (model && engine.model === modelFamily) {
    state('ready', ui.startButton, ui.start);
  } else {
    releaseModel();
    state('initial', ui.initialButton, ui.initial);
  }
});
passages.forEach(({ title }, index) => passageChoice.add(new Option(title, String(index))));
showPassage();
new ResizeObserver(updateLineCounts).observe(passageText);
passageChoice.addEventListener('change', () => {
  clearReading();
  showPassage();
});
chooseStart.addEventListener('click', () => setPicking(!textPanel.hasAttribute('data-picking-start')));
resetStart.addEventListener('click', () => {
  finishPicking(0);
  reveal(passageScroll, spans[0]);
});
textPanel.addEventListener('click', event => {
  if (textPanel.hasAttribute('data-picking-start') && event.target.hasAttribute('data-word')) {
    finishPicking(Number(event.target.dataset.word));
  }
});
textPanel.addEventListener('keydown', event => {
  if (!textPanel.hasAttribute('data-picking-start') || !event.target.hasAttribute('data-word')) return;
  const current = Number(event.target.dataset.word);
  const last = spans.length - 1;
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      focusWord(Math.max(0, current - 1));
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      focusWord(Math.min(last, current + 1));
      break;
    case 'Home':
      focusWord(0);
      break;
    case 'End':
      focusWord(last);
      break;
    case 'Enter':
    case ' ':
      finishPicking(current);
      break;
    case 'Escape':
      finishPicking();
      break;
    default:
      return;
  }
  event.preventDefault();
});
duration.addEventListener('change', () => {
  progress.max = limit();
  setTime(limit());
});

for (const button of document.querySelectorAll('[data-dialog]')) {
  const dialog = byId(button.dataset.dialog);
  button.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
}
byId('copy-lightning').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(byId('lightning-address').textContent);
    byId('copy-status').textContent = ui.copied;
  } catch {
    byId('copy-status').textContent = ui.copyFailed;
  }
});

if (window.isSecureContext && navigator.mediaDevices?.getUserMedia &&
    window.AudioContext && window.AudioWorkletNode && window.WebAssembly) {
  action.disabled = false;
} else {
  status.textContent = ui.incompatible;
}
