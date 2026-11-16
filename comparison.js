import { reading } from './content.js';
import { compareReading, wordsIn } from './reading.js';
import { prepareModel } from './speech.js';
import { playAudio, readAudio, recordAudio, sampleRate } from './comparison-audio.js';
import { engines, passageGrammar, transcribeVosk, transcribeWhisper } from './comparison-engines.js';

const get = id => document.getElementById(id);
const passageChoice = get('comparison-text');
const passageTitle = get('comparison-title');
const passageView = get('comparison-passage');
const fileInput = get('audio-file');
const recordButton = get('record');
const stopButton = get('stop-recording');
const playButton = get('play');
const discardButton = get('discard');
const audioActions = get('audio-actions');
const clock = get('recording-time');
const takeStatus = get('take-status');
const runStatus = get('run-status');
const chooseEnd = get('choose-end');
const wholePassage = get('whole-passage');
const annotationStatus = get('annotation-status');
const confirmation = get('confirm-annotations');
const action = get('action');
const overlay = get('overlay-model');
const session = new AbortController();
const truth = new Set();
const timeFormat = new Intl.NumberFormat('ca', { maximumFractionDigits: 1 });
const labels = {
  found: 'Errades detectades',
  falseAlarm: 'Falses alarmes',
  missed: 'Errades passades per alt',
  uncertain: 'Paraules sense evidència',
};

let reference;
let wordButtons;
let focusIndex = 0;
let end = -1;
let choosingEnd = false;
let samples;
let recording;
let stopPlayback;
let pending;

const cards = engines.map(engine => {
  const article = document.createElement('article');
  article.className = 'engine-result';
  article.innerHTML = `
    <h3></h3>
    <p class="status"></p>
    <dl class="engine-scores" hidden>
      ${Object.values(labels).map(label => `<div><dt>${label}</dt><dd></dd></div>`).join('')}
    </dl>
    <p class="field-note" hidden></p>
    <details hidden><summary>Transcripció literal</summary><p></p></details>
  `;
  article.querySelector('h3').textContent = engine.name;
  get('engine-results').append(article);
  const option = new Option(engine.name, engine.id);
  option.disabled = true;
  overlay.append(option);
  return {
    ...engine,
    option,
    status: article.querySelector('.status'),
    scores: article.querySelector('dl'),
    numbers: article.querySelectorAll('dd'),
    timing: article.querySelector('.field-note'),
    details: article.querySelector('details'),
    transcript: article.querySelector('details p'),
  };
});

reading.passages.forEach((passage, index) => passageChoice.add(new Option(passage.title, index)));

function showPassage() {
  const passage = reading.passages[passageChoice.value];
  passageTitle.textContent = passage.title;
  reference = [];
  wordButtons = [];
  focusIndex = 0;
  passageView.replaceChildren();
  for (const paragraph of passage.paragraphs) {
    const row = document.createElement('p');
    let offset = 0;
    for (const word of wordsIn(paragraph, reading.locale)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = word.text;
      button.dataset.word = reference.length;
      button.setAttribute('aria-describedby', 'key-help');
      row.append(paragraph.slice(offset, word.index), button);
      offset = word.index + word.text.length;
      reference.push(word);
      wordButtons.push(button);
    }
    row.append(paragraph.slice(offset));
    passageView.append(row);
  }
  passageView.scrollTop = 0;
  update();
}

function calibrate(card) {
  if (!card.result || end < 0) return;
  card.marks = compareReading(reference.slice(0, end + 1), card.result.transcript, reading.locale);
}

function wordResult(mark, actual) {
  if (mark.kind === 'difference') return actual ? 'found' : 'falseAlarm';
  if (actual) return 'missed';
  if (mark.kind === 'uncertain') return 'uncertain';
}

function updateCard(card) {
  const result = card.result;
  card.status.textContent = card.message ?? 'Pendent';
  card.timing.hidden = !result;
  card.details.hidden = !result;
  card.option.disabled = !result;
  card.scores.hidden = !result || !confirmation.checked;
  if (!result) {
    card.details.open = false;
    card.transcript.textContent = '';
    card.timing.textContent = '';
    return;
  }
  card.transcript.textContent = result.transcript || 'El motor no ha retornat cap paraula.';
  const loadLabel = card.id === 'whisper' ? 'Càrrega' : 'Càrrega compartida';
  card.timing.textContent = `${loadLabel} ${seconds(result.load / 1000)} · Transcripció ${seconds(result.elapsed / 1000)}`;
  if (card.scores.hidden) return;

  const counts = { found: 0, falseAlarm: 0, missed: 0, uncertain: 0 };
  card.marks.forEach((mark, index) => {
    const kind = wordResult(mark, truth.has(index));
    if (kind && kind !== 'uncertain') counts[kind]++;
    if (mark.kind === 'uncertain') counts.uncertain++;
  });
  Object.values(counts).forEach((count, n) => { card.numbers[n].textContent = count; });
}

function updateWords() {
  if (!choosingEnd) focusIndex = Math.min(focusIndex, Math.max(0, end));
  const model = cards.find(card => card.id === overlay.value);
  get('comparison-legend').hidden = !model;
  wordButtons.forEach((button, index) => {
    const actual = truth.has(index);
    const unread = end >= 0 && index > end;
    const mark = model?.marks?.[index];
    const outcome = mark && wordResult(mark, actual);
    button.disabled = !samples || Boolean(pending) || (!choosingEnd && (end < 0 || unread));
    button.tabIndex = !button.disabled && index === focusIndex ? 0 : -1;
    button.setAttribute('aria-pressed', String(choosingEnd ? index === end : actual));
    button.toggleAttribute('data-unread', unread && !choosingEnd);
    button.toggleAttribute('data-last', index === end);
    if (outcome) button.dataset.result = outcome;
    else delete button.dataset.result;
    const notes = [];
    if (index === end) notes.push('última paraula');
    if (outcome) notes.push(labels[outcome]);
    if (mark?.heard) notes.push(`el motor ha entès «${mark.heard}»`);
    if (mark?.kind === 'difference' && !mark.heard) notes.push('possible omissió');
    button.title = notes.join(' · ');
    button.setAttribute('aria-label', [reference[index].text, ...notes].join(', '));
  });
}

function update() {
  const hasAudio = Boolean(samples);
  const busy = Boolean(pending);
  const complete = cards.every(card => card.result);
  const hasResults = cards.some(card => card.result);
  overlay.disabled = !confirmation.checked;
  get('overlay-field').hidden = !hasResults;
  if (overlay.disabled) overlay.value = '';
  passageChoice.disabled = busy || hasAudio;
  recordButton.disabled = busy || hasAudio;
  recordButton.hidden = pending === 'recording';
  stopButton.hidden = pending !== 'recording';
  stopButton.disabled = !recording;
  clock.hidden = pending !== 'recording';
  fileInput.disabled = busy || hasAudio;
  audioActions.hidden = !hasAudio;
  discardButton.disabled = busy;
  playButton.textContent = stopPlayback ? 'Atura l’àudio' : 'Escolta l’àudio';
  chooseEnd.disabled = !hasAudio || busy;
  chooseEnd.setAttribute('aria-pressed', String(choosingEnd));
  chooseEnd.textContent = choosingEnd ? 'Cancel·la la selecció' : 'Marca l’última paraula';
  wholePassage.disabled = !hasAudio || busy;
  confirmation.disabled = end < 0 || busy || choosingEnd;
  annotationStatus.textContent = choosingEnd
    ? 'Selecciona l’última paraula del tram llegit.'
    : end < 0 ? '' : `${end + 1} ${end === 0 ? 'paraula' : 'paraules'} al tram · ${truth.size} ${truth.size === 1 ? 'errada marcada' : 'errades marcades'}`;
  action.disabled = busy || !confirmation.checked || choosingEnd || complete;
  action.textContent = complete ? 'Comparació feta' : cards.some(card => card.failed) ? 'Torna a provar els motors pendents' : 'Compara els tres motors';
  updateWords();
  cards.forEach(updateCard);
}

function seconds(duration) {
  return `${timeFormat.format(duration)} s`;
}

function clearComparison() {
  samples = undefined;
  end = -1;
  focusIndex = 0;
  choosingEnd = false;
  truth.clear();
  confirmation.checked = false;
  overlay.value = '';
  for (const card of cards) {
    card.result = undefined;
    card.marks = undefined;
    card.message = undefined;
    card.failed = false;
  }
}

function acceptAudio(audio) {
  if (audio.length < sampleRate / 2) throw new Error('Cal almenys mig segon d’àudio.');
  clearComparison();
  samples = audio;
  takeStatus.textContent = `Àudio a punt · ${seconds(samples.length / sampleRate)}`;
  runStatus.textContent = 'Revisa el tram llegit i marca-hi les errades.';
}

passageChoice.addEventListener('change', showPassage);

recordButton.addEventListener('click', async () => {
  pending = 'recording';
  clock.textContent = '0 s';
  takeStatus.textContent = 'Dona permís al micròfon si el navegador t’ho demana.';
  update();
  try {
    recording = await recordAudio(duration => { clock.textContent = `${Math.floor(duration)} s`; }, session.signal);
    takeStatus.textContent = 'Enregistrant. Llegeix el text des del principi.';
    update();
    stopButton.focus();
    acceptAudio(await recording.result);
  } catch (error) {
    if (!session.signal.aborted) takeStatus.textContent = error.name === 'NotAllowedError'
      ? 'Dona permís al micròfon o tria un fitxer d’àudio.'
      : error.message || 'No s’ha pogut enregistrar la lectura.';
  } finally {
    recording = undefined;
    pending = undefined;
    update();
  }
});
stopButton.addEventListener('click', () => recording?.stop());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  pending = 'file';
  takeStatus.textContent = 'S’està obrint el fitxer al navegador…';
  update();
  try {
    const audio = await readAudio(file);
    session.signal.throwIfAborted();
    acceptAudio(audio);
  } catch (error) {
    if (!session.signal.aborted) takeStatus.textContent = error.name === 'EncodingError'
      ? 'No s’ha pogut obrir el fitxer. Prova un WAV, MP3 o M4A.'
      : error.message;
  } finally {
    fileInput.value = '';
    pending = undefined;
    update();
  }
});

playButton.addEventListener('click', () => {
  if (stopPlayback) {
    stopPlayback();
    return;
  }
  stopPlayback = playAudio(samples, () => {
    stopPlayback = undefined;
    update();
  });
  update();
});

discardButton.addEventListener('click', () => {
  stopPlayback?.();
  clearComparison();
  takeStatus.textContent = 'Prova esborrada.';
  runStatus.textContent = 'Afegeix un àudio i confirma les anotacions.';
  update();
  recordButton.focus();
});

function changeEnd(index) {
  end = index;
  choosingEnd = false;
  for (const error of truth) {
    if (error > end) truth.delete(error);
  }
  confirmation.checked = false;
  cards.forEach(calibrate);
  update();
}

chooseEnd.addEventListener('click', () => {
  choosingEnd = !choosingEnd;
  update();
  if (choosingEnd) wordButtons[focusIndex].focus();
});
wholePassage.addEventListener('click', () => changeEnd(reference.length - 1));
passageView.addEventListener('click', event => {
  const button = event.target.closest('button[data-word]');
  if (!button || button.disabled) return;
  const index = Number(button.dataset.word);
  focusIndex = index;
  if (choosingEnd) {
    changeEnd(index);
  } else {
    if (truth.has(index)) truth.delete(index);
    else truth.add(index);
    confirmation.checked = false;
    update();
  }
});
passageView.addEventListener('keydown', event => {
  if (event.key === 'Escape' && choosingEnd) {
    choosingEnd = false;
    update();
    chooseEnd.focus();
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey || !event.target.matches('button[data-word]')) return;
  const last = choosingEnd ? reference.length - 1 : end;
  const move = { ArrowLeft: focusIndex - 1, ArrowRight: focusIndex + 1, Home: 0, End: last };
  if (!Object.hasOwn(move, event.key)) return;
  event.preventDefault();
  focusIndex = Math.min(last, Math.max(0, move[event.key]));
  updateWords();
  wordButtons[focusIndex].focus();
});
confirmation.addEventListener('change', update);
overlay.addEventListener('change', updateWords);

async function runEngines() {
  const signal = session.signal;
  const [base, contextual, whisper] = cards;
  let model;
  let voskLoad;
  try {
    if (!base.result || !contextual.result) {
      runStatus.textContent = 'Carregant el model de Vosk…';
      const start = performance.now();
      model = await prepareModel(reading.modelUrl, signal);
      voskLoad = performance.now() - start;
    }
  } catch (error) {
    signal.throwIfAborted();
    for (const card of [base, contextual].filter(card => !card.result)) {
      card.failed = true;
      card.message = error.message;
      updateCard(card);
    }
  }

  async function run(card, transcribe) {
    if (card.result) return;
    signal.throwIfAborted();
    card.message = 'En curs…';
    runStatus.textContent = `Preparant ${card.name}…`;
    updateCard(card);
    try {
      card.result = await transcribe();
      calibrate(card);
      card.message = 'Completat';
      card.failed = false;
    } catch (error) {
      signal.throwIfAborted();
      card.message = error.message;
      card.failed = true;
    }
    update();
  }

  try {
    if (model) {
      for (const card of [base, contextual]) {
        await run(card, async () => {
          const start = performance.now();
          const grammar = card === contextual ? passageGrammar(reference) : undefined;
          const transcript = await transcribeVosk(model, samples, grammar, progress => {
            const percent = 5 * Math.floor(20 * progress);
            const status = `Transcrivint amb ${card.name} · ${percent}%`;
            if (runStatus.textContent !== status) runStatus.textContent = status;
          }, signal);
          return { transcript, load: voskLoad, elapsed: performance.now() - start };
        });
      }
    }
  } finally {
    model?.terminate();
  }
  await run(whisper, () => transcribeWhisper(samples, phase => {
    if (phase === 'recognizing') runStatus.textContent = 'Transcrivint amb Whisper Tiny Catalan…';
  }, signal));
}

action.addEventListener('click', async () => {
  pending = 'compare';
  update();
  try {
    await runEngines();
    runStatus.textContent = cards.every(card => card.result)
      ? 'Els tres motors han processat el mateix àudio.'
      : 'Hi ha hagut un problema amb algun motor. Pots reintentar-lo amb el mateix àudio.';
  } catch (error) {
    if (!session.signal.aborted) runStatus.textContent = error.message;
  } finally {
    pending = undefined;
    update();
  }
});

window.addEventListener('pagehide', () => {
  session.abort();
  stopPlayback?.();
  clearComparison();
  update();
});
window.addEventListener('pageshow', event => {
  if (event.persisted) location.reload();
});

showPassage();
