import { reading, ui } from './content.js';
import { summarizeReading, trackReading, wordsIn } from './reading.js';
import { prepareModel, startCapture } from './speech.js';

const LIMIT = 60;
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
const { locale, passage } = reading;

document.documentElement.lang = ui.locale;
document.title = ui.title;
for (const element of document.querySelectorAll('[data-copy]')) {
  element.textContent = ui[element.dataset.copy];
}
for (const element of document.querySelectorAll('[data-label]')) {
  element.setAttribute('aria-label', ui[element.dataset.label]);
}
byId('passage-title').textContent = passage.title;
const textPanel = byId('passage');
textPanel.lang = locale;
transcript.lang = locale;

const reference = [];
const spans = [];
for (const text of passage.paragraphs) {
  const paragraph = document.createElement('p');
  let offset = 0;
  for (const word of wordsIn(text, locale)) {
    const span = document.createElement('span');
    span.textContent = word.text;
    paragraph.append(text.slice(offset, word.index), span);
    reference.push(word);
    spans.push(span);
    offset = word.index + word.text.length;
  }
  paragraph.append(text.slice(offset));
  textPanel.append(paragraph);
}

let model;
let session;
let timer;
let mode = 'initial';
let committedTrack;
let displayedMarks = [];
let cursor;

function state(next, label, message, busy = false) {
  mode = next;
  action.textContent = label;
  action.disabled = busy;
  status.textContent = message;
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

function onRecognition({ words, segments, partial, committed }) {
  if (committed || !committedTrack) committedTrack = trackReading(reference, words, { locale });
  const current = partial ? trackReading(reference, words, { partial, locale }) : committedTrack;
  paintMarks(current.marks, committedTrack.marks);
  setCursor(current.cursor);
  showTranscript(segments, partial);
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
  setTime(LIMIT);
}

function showReport(seconds) {
  const summary = summarizeReading(committedTrack, seconds);
  const note = byId('report-note');
  if (summary) {
    byId('rate').textContent = summary.rate;
    byId('errors').textContent = summary.errors.length;
    byId('repairs').textContent = summary.repairs.length;
    byId('reread-count').textContent = summary.rereads.length;
    byId('reread-metric').hidden = !summary.rereads.length;
    note.textContent = ui.estimated(summary.correct, Math.max(1, Math.round(seconds)));
    if (summary.uncertain) note.textContent += ui.uncertainResult;
    const observations = [...summary.errors, ...summary.repairs].map(mark => markText(mark.i, mark));
    for (const { start, end, corrected } of summary.rereads) {
      const fragment = reference.slice(start, end + 1).map(word => word.text).join(' ');
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
    note.textContent = ui.noResult;
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
  state('starting', ui.startingButton, ui.starting, true);
  try {
    session = await startCapture(model, LIMIT, {
      onRecognition,
      onStopped() {
        clearInterval(timer);
        state('working', ui.workingButton, ui.working, true);
      },
    });
    const started = performance.now();
    timer = setInterval(() => setTime(Math.max(0, LIMIT - Math.floor((performance.now() - started) / 1000))), 200);
    state('reading', ui.finishButton, ui.reading);
    action.focus({ preventScroll: true });
    const { seconds } = await session.result;
    setTime(Math.max(0, LIMIT - Math.floor(seconds)));
    setCursor(undefined);
    transcriptHelp.textContent = ui.transcriptFinal;
    transcriptEmpty.textContent = ui.transcriptNoWords;
    state('ready', ui.retryButton, ui.done);
    showReport(seconds);
  } catch (error) {
    setCursor(undefined);
    state('ready', ui.retryButton, error.name === 'NotAllowedError' ? ui.denied : ui.captureFailed);
    setTime(LIMIT);
  } finally {
    clearInterval(timer);
    session = undefined;
  }
}

action.addEventListener('click', () => {
  if (mode === 'initial') void prepare();
  else if (mode === 'ready') void read();
  else if (mode === 'reading') {
    action.disabled = true;
    session.finish();
  }
});

follow.addEventListener('change', () => {
  if (follow.checked && cursor) reveal(passageScroll, cursor);
});
window.addEventListener('pagehide', () => session?.cancel());

if (window.isSecureContext && navigator.mediaDevices?.getUserMedia &&
    window.AudioContext && window.AudioWorkletNode && window.WebAssembly) {
  action.disabled = false;
} else {
  status.textContent = ui.incompatible;
}
