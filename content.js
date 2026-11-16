import ca from './locales/ca.js';

const interfaces = { ca };
const readings = {
  ca: {
    locale: 'ca',
    modelUrl: new URL('./vendor/vosk-model-small-ca-0.4.tar.gz', import.meta.url),
    modelSizeMb: 42,
    passage: {
      title: 'El pont de les granotes',
      paragraphs: [
        'Quan la Júlia va sortir de casa, el carrer encara feia olor de pluja. A la plaça, el seu avi l’esperava amb unes botes altes i una bossa de roba. Li havia promès que anirien a veure el rec abans que sortís el sol.',
        'Van seguir el camí que baixava entre els horts. A la vora del pont, un branquilló girava damunt de l’aigua i, de tant en tant, una granota treia el cap. La Júlia volia comptar quantes n’hi havia, però totes s’amagaven tan bon punt ella s’acostava.',
        'L’avi va estendre un mocador damunt d’una pedra i li va fer senyal perquè s’hi assegués. Durant una estona van escoltar com corria l’aigua. La Júlia va veure unes fulles que tremolaven i, just al darrere, uns ulls petits i daurats.',
        'Quan van reprendre el camí, la Júlia es va adonar que encara duia la bossa de roba tancada. A dins hi havia dues pomes i un tros de pa. Va triar la poma més grossa, la va partir i en va donar la meitat a l’avi.',
        'Més tard, en arribar a la plaça, ja hi havia gent que obria les botigues. Una veïna els va preguntar si havien vist cap granota. La Júlia va somriure. N’havia vist una de ben a prop, i amb aquella en tenia prou.',
      ],
    },
  },
};

export const ui = interfaces.ca;
export const reading = readings.ca;
