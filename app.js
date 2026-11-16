import { analyzeReading, wordsIn } from './reading.js';
import { prepareModel, startCapture } from './speech.js';

const LIMIT = 60;
const action = document.querySelector('#action');
const status = document.querySelector('#status');
const clock = document.querySelector('#clock');
const progress = document.querySelector('#progress');
const report = document.querySelector('#report');
const metrics = document.querySelector('#metrics');
const details = document.querySelector('#details');
const reportNote = document.querySelector('#report-note');
const rate = document.querySelector('#rate');
const errors = document.querySelector('#errors');
const repairs = document.querySelector('#repairs');

const reference = [];
const spans = [];
for (const paragraph of document.querySelectorAll('#passage p')) {
  const text = paragraph.textContent;
  const fragment = document.createDocumentFragment();
  let offset = 0;
  for (const word of wordsIn(text)) {
    fragment.append(text.slice(offset, word.index));
    const span = document.createElement('span');
    span.textContent = word.text;
    fragment.append(span);
    reference.push(word);
    spans.push(span);
    offset = word.index + word.text.length;
  }
  fragment.append(text.slice(offset));
  paragraph.replaceChildren(fragment);
}

let model;
let session;
let timer;
let mode = 'initial';

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

function clearReport() {
  report.hidden = true;
  metrics.hidden = true;
  details.hidden = true;
  details.replaceChildren();
  reportNote.textContent = '';
  rate.textContent = errors.textContent = repairs.textContent = '—';
  for (const span of spans) delete span.dataset.reading;
  setTime(LIMIT);
}

function showReport(words, seconds) {
  const analysis = analyzeReading(reference, words, seconds);
  if (analysis) {
    rate.textContent = analysis.rate;
    errors.textContent = analysis.errorCount;
    repairs.textContent = analysis.repairCount;
    const duration = Math.max(1, Math.round(seconds));
    reportNote.textContent = `Hem reconegut ${analysis.correct} paraules del text en ${duration} s. El resultat és orientatiu.`;
    if (analysis.uncertain) reportNote.textContent += ' Alguns fragments s’han reconegut amb dubtes.';
    for (const mark of analysis.marks) {
      const target = reference[mark.i].text;
      const item = document.createElement('li');
      switch (mark.kind) {
        case 'repair':
          spans[mark.i].dataset.reading = 'repair';
          item.textContent = `Possible autocorrecció a «${target}». S’ha sentit «${mark.heard}» just abans.`;
          break;
        case 'substitution':
          spans[mark.i].dataset.reading = 'error';
          item.textContent = `A «${target}» potser has llegit «${mark.heard}».`;
          break;
        case 'omission':
          spans[mark.i].dataset.reading = 'error';
          item.textContent = `Potser t’has saltat «${target}».`;
          break;
        default:
          spans[mark.i].dataset.reading = 'uncertain';
          continue;
      }
      details.append(item);
    }
    metrics.hidden = false;
    details.hidden = details.children.length === 0;
  } else {
    reportNote.textContent = 'No hem pogut reconèixer prou paraules del text per donar-te un resultat. Torna-ho a provar parlant a prop del micròfon.';
  }
  report.hidden = false;
  document.querySelector('#report-title').focus();
}

async function prepare() {
  state('loading', 'S’està preparant…', 'S’està carregant el model de català. El primer cop es descarreguen uns 42 MB.', true);
  try {
    model = await prepareModel();
    state('ready', 'Comença la lectura', 'Quan premis el botó, et demanarem accés al micròfon si cal.');
    action.focus();
  } catch {
    state('initial', 'Torna a carregar', 'No s’ha pogut carregar el model de català. Comprova la connexió i torna-ho a provar.');
  }
}

async function read() {
  clearReport();
  state('starting', 'S’està obrint…', 'Dona accés al micròfon quan el navegador t’ho demani.', true);
  try {
    session = await startCapture(model, LIMIT, () => {
      clearInterval(timer);
      state('working', 'S’està analitzant…', 'Estem acabant de comparar la lectura amb el text.', true);
    });
    const started = performance.now();
    timer = setInterval(() => setTime(Math.max(0, LIMIT - Math.floor((performance.now() - started) / 1000))), 200);
    state('reading', 'Acaba la lectura', 'Comença pel primer paràgraf. Pots acabar abans del minut.');
    action.focus({ preventScroll: true });
    const capture = await session.result;
    setTime(Math.max(0, LIMIT - Math.floor(capture.seconds)));
    state('ready', 'Torna-ho a provar', 'La lectura ha acabat. Tens el resum sota el text.');
    showReport(capture.words, capture.seconds);
  } catch (error) {
    const message = error.name === 'NotAllowedError'
      ? 'Cal donar permís al micròfon des del navegador per començar.'
      : 'No s’ha pogut completar la lectura. Comprova el micròfon i torna-ho a provar.';
    state('ready', 'Torna-ho a provar', message);
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

window.addEventListener('pagehide', () => session?.cancel());

if (window.isSecureContext && navigator.mediaDevices?.getUserMedia &&
    window.AudioContext && window.AudioWorkletNode && window.WebAssembly) {
  action.disabled = false;
} else {
  status.textContent = 'El navegador no pot fer servir el micròfon en aquesta pàgina. Obre el web amb Chrome o un altre navegador compatible.';
}
