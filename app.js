import { reading, ui } from './content.js';
import { summarizeReading, trackReading, wordsIn } from './reading.js';
import { prepareModel, startCapture } from './speech.js';
import { readingClock } from './timing.js';

const byId = id => document.getElementById(id);
const action = byId('action');
const status = byId('status');
const clock = byId('clock');
const progress = byId('progress');
const report = byId('report');
const metrics = byId('metrics');
const details = byId('details');
const transcript = byId('transcript-content');
const transcriptEmpty = byId('transcript-empty');
const transcriptHelp = byId('transcript-help');
const transcriptScroll = byId('transcript-scroll');
const passageScroll = byId('passage-scroll');
const follow = byId('follow');
const duration = byId('duration');
const startWord = byId('start-word');
const passageChoice = byId('passage-choice');
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
textPanel.lang = locale;
transcript.lang = locale;

const reference = [];
const spans = [];
const sentenceEnds = new Set();
const limit = () => Number(duration.value);
const readingOffset = () => Number(startWord.value);

let model;
let stopReading;
let cancelReading;
let mode = 'initial';
let committedTrack;
let displayedMarks = [];
let cursor;
let configuredStart;

function showPassage() {
  const passage = passages[Number(passageChoice.value)];
  byId('passage-title').textContent = passage.title;
  textPanel.replaceChildren();
  startWord.replaceChildren(new Option(ui.startImmediately, ''));
  reference.length = 0;
  spans.length = 0;
  sentenceEnds.clear();

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
      if (/[.!?…]/.test(text.slice(offset, next)) || i === words.length - 1) sentenceEnds.add(index);
      const snippet = words.slice(i, i + 4).map(item => item.text).join(' ');
      startWord.add(new Option(`${index + 1}. ${snippet}`, String(index)));
      reference.push(word);
      spans.push(span);
    });
    paragraph.append(text.slice(offset));
    textPanel.append(paragraph);
  }
}

function showStartWord() {
  configuredStart?.removeAttribute('data-start');
  configuredStart = startWord.value === '' ? undefined : spans[readingOffset()];
  if (configuredStart) {
    configuredStart.setAttribute('data-start', '');
    reveal(passageScroll, configuredStart);
  }
}

function state(next, label, message, busy = false) {
  mode = next;
  action.textContent = label;
  action.disabled = busy;
  status.textContent = message;
  settings.disabled = next === 'starting' || next === 'reading' || next === 'working';
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
  if (mark.kind === 'omission') return ui.skipped(target);
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

function showTranscript(segments, partial) {
  const atBottom = transcriptScroll.scrollHeight - transcriptScroll.clientHeight - transcriptScroll.scrollTop < 28;
  byId('committed').textContent = segments.join(' ');
  byId('partial').textContent = segments.length && partial ? ' ' + partial : partial;
  transcript.hidden = !segments.length && !partial;
  transcriptEmpty.hidden = !transcript.hidden;
  if (atBottom) transcriptScroll.scrollTop = transcriptScroll.scrollHeight;
}

function clearReading() {
  report.hidden = true;
  metrics.hidden = true;
  details.hidden = true;
  details.replaceChildren();
  byId('report-note').textContent = '';
  byId('rate').textContent = '';
  byId('errors').textContent = '';
  byId('repairs').textContent = '';
  byId('reread-count').textContent = '';
  committedTrack = undefined;
  paintMarks([]);
  setCursor(undefined);
  showTranscript([], '');
  transcriptHelp.textContent = ui.transcriptHelp;
  transcriptEmpty.textContent = ui.transcriptEmpty;
  passageScroll.scrollTop = 0;
  progress.max = limit();
  setTime(limit());
}

function showReport(measurement, passage, offset) {
  const summary = measurement && summarizeReading(trackReading(passage, measurement.words, { locale }), measurement.seconds);
  const note = byId('report-note');
  if (summary) {
    byId('rate').textContent = summary.rate;
    byId('errors').textContent = summary.errors.length;
    byId('repairs').textContent = summary.repairs.length;
    byId('reread-count').textContent = summary.rereads.length;
    byId('reread-metric').hidden = !summary.rereads.length;
    note.textContent = ui.estimated(summary.correct, Math.max(1, Math.round(measurement.seconds)));
    if (summary.uncertain) note.textContent += ui.uncertainResult;
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
  state('loading', ui.loadingButton, ui.loading(reading.modelSizeMb), true);
  try {
    model = await prepareModel(reading.modelUrl);
    state('ready', ui.startButton, ui.start);
    action.focus({ preventScroll: true });
  } catch {
    state('initial', ui.reloadButton, ui.loadFailed);
  }
}

async function read() {
  clearReading();
  const offset = readingOffset();
  const passage = reference.slice(offset);
  const startOnWord = startWord.value !== '';
  const sound = byId('end-sound').checked;
  const finishSentence = byId('finish-sentence').checked;
  const relativeEnds = new Set([...sentenceEnds].filter(end => end >= offset).map(end => end - offset));
  const timing = readingClock({ duration: limit(), startOnWord, finishSentence, sentenceEnds: relativeEnds });
  const readingMessage = startOnWord ? ui.readFrom(passage[0].text) : ui.reading;
  const prefix = Array(offset).fill(null);
  let session;
  let ended = false;
  let manuallyStopped = false;
  let elapsed = 0;

  function advance() {
    if (!session || ended || action.disabled) return;
    const time = timing.observe(elapsed, committedTrack?.matches ?? []);
    setTime(time.remaining);
    const message = time.waiting ? ui.waiting(passage[0].text) : readingMessage;
    if (status.textContent !== message) status.textContent = message;
    if (time.stop) {
      action.disabled = true;
      session.finish();
    }
  }

  state('starting', ui.startingButton, ui.starting, true);
  try {
    session = await startCapture(model, timing.captureLimit, {
      onAudio(seconds) {
        elapsed = seconds;
        advance();
      },
      onRecognition({ words, segments, partial, committed }) {
        if (committed || !committedTrack) committedTrack = trackReading(passage, words, { locale });
        const current = partial ? trackReading(passage, words, { partial, locale }) : committedTrack;
        paintMarks(prefix.concat(current.marks), prefix.concat(committedTrack.marks));
        setCursor(current.cursor === undefined ? undefined : current.cursor + offset);
        showTranscript(segments, partial);
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
    });
    stopReading = () => {
      manuallyStopped = true;
      action.disabled = true;
      session.finish();
    };
    cancelReading = session.cancel;
    state('reading', ui.finishButton, startOnWord ? ui.waiting(passage[0].text) : readingMessage);
    action.focus({ preventScroll: true });
    const { seconds, words } = await session.result;
    const measurement = timing.measure(seconds, words, committedTrack.matches);
    setTime(timing.observe(seconds, committedTrack.matches).remaining);
    setCursor(undefined);
    transcriptHelp.textContent = ui.transcriptFinal;
    transcriptEmpty.textContent = ui.transcriptNoWords;
    state('ready', ui.retryButton, ui.done);
    showReport(measurement, passage, offset);
  } catch (error) {
    setCursor(undefined);
    state('ready', ui.retryButton, error.name === 'NotAllowedError' ? ui.denied : ui.captureFailed);
    setTime(limit());
  } finally {
    stopReading = undefined;
    cancelReading = undefined;
  }
}

action.addEventListener('click', () => {
  if (mode === 'initial') void prepare();
  else if (mode === 'ready') void read();
  else if (mode === 'reading') stopReading?.();
});

follow.addEventListener('change', () => {
  if (follow.checked && cursor) reveal(passageScroll, cursor);
});
window.addEventListener('pagehide', () => cancelReading?.());

passages.forEach(({ title }, index) => passageChoice.add(new Option(title, String(index))));
showPassage();
passageChoice.addEventListener('change', () => {
  clearReading();
  showPassage();
  showStartWord();
});
startWord.addEventListener('change', showStartWord);
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
