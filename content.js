import ca from './locales/ca.js';

const interfaces = { ca };
const readings = {
  ca: {
    locale: 'ca',
    modelUrl: new URL('./vendor/vosk-model-small-ca-0.4.tar.gz', import.meta.url),
    modelSizeMb: 42,
    passages: [{
      title: 'El pont de les granotes',
      paragraphs: [
        'Quan la Júlia va sortir de casa, el carrer encara feia olor de pluja. A la plaça, el seu avi l’esperava amb unes botes altes i una bossa de roba. Li havia promès que anirien a veure el rec abans que sortís el sol.',
        'Van seguir el camí que baixava entre els horts. A la vora del pont, un branquilló girava damunt de l’aigua i, de tant en tant, una granota treia el cap. La Júlia volia comptar quantes n’hi havia, però totes s’amagaven tan bon punt ella s’acostava.',
        'L’avi va estendre un mocador damunt d’una pedra i li va fer senyal perquè s’hi assegués. Durant una estona van escoltar com corria l’aigua. La Júlia va veure unes fulles que tremolaven i, just al darrere, uns ulls petits i daurats.',
        'Quan van reprendre el camí, la Júlia es va adonar que encara duia la bossa de roba tancada. A dins hi havia dues pomes i un tros de pa. Va triar la poma més grossa, la va partir i en va donar la meitat a l’avi.',
        'Més tard, en arribar a la plaça, ja hi havia gent que obria les botigues. Una veïna els va preguntar si havien vist cap granota. La Júlia va somriure. N’havia vist una de ben a prop, i amb aquella en tenia prou.',
      ],
    }, {
      title: 'La capsa dels sons',
      paragraphs: [
        'En Biel va trobar una capsa de sabates sota el banc de l’entrada. A la tapa, algú hi havia escrit el seu nom amb un retolador blau. Va pensar que era un regal, però quan la va obrir només hi va veure un paper amb tres dibuixos. El primer era una cullera. El segon, una fulla. El tercer semblava una porta.',
        'La seva germana li va explicar que havia preparat un joc. Havia de trobar un so per a cada dibuix. A la cuina, en Biel va fer picar la cullera contra un got. Després va sortir al jardí i va aixafar una fulla seca. Per fer el tercer so, va tancar la porta tan a poc a poc que va poder sentir com grinyolava.',
        'Quan va tornar a l’entrada, la capsa ja tenia una nota nova. Ara li tocava amagar-la a ell i deixar tres dibuixos diferents. Va buscar un llapis i es va asseure a pensar quins sons sentia cada matí.',
      ],
    }, {
      title: 'Una ombra a la plaça',
      paragraphs: [
        'Cada tarda, la Marina travessava la plaça quan sortia de l’escola. Aquell dimarts, al mig del terra hi havia unes ratlles de guix i una ampolla plena de sorra. Un veí havia posat l’ampolla dreta i havia marcat el lloc on acabava la seva ombra. Volia saber com es movia mentre passaven les hores.',
        'La Marina va buscar un altre tros de guix. Va fer una ratlla a la punta de l’ombra i hi va escriure l’hora. Després va anar a comprar pa. Quan va tornar, el veí li va demanar que es mirés bé la ratlla. L’ombra s’havia mogut una mica i ara era més llarga.',
        'L’endemà, la Marina hi va arribar abans. A la plaça encara es veien les ratlles, tot i que algunes s’havien esborrat sota les rodes de les bicicletes. Va deixar l’ampolla al mateix lloc i es va asseure al banc. Aquesta vegada volia marcar l’ombra abans que ningú més hi passés.',
      ],
    }],
  },
};

export const ui = interfaces.ca;
export const reading = readings.ca;
