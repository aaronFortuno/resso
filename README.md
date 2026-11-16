# Ressò

Prototip d’[ortogra.fi](https://ortogra.fi/) per practicar la lectura en català. [Obre Ressò](https://resso.ortogra.fi/).

1. Tria el text i el temps a la barra lateral. Prem **Prepara la lectura** per carregar el model de català.
2. El cronòmetre comença per defecte a la segona frase. A **Opcions del temporitzador**, pots triar una altra paraula del text o prémer **Torna a la primera**. Els números del marge indiquen les paraules acumulades fins al final de cada línia des del punt marcat.
3. Prem **Comença la lectura**, dona permís al micròfon i llegeix el text. Amb l’inici per defecte, la primera frase serveix per agafar ritme.
4. La transcripció del motor es mostra des del començament de la captura. Quan comença el recompte també pots seguir la posició al text. El fragment provisional i les seves marques poden canviar.
5. El web s’atura quan s’acaba el temps. També pots prémer **Acaba la lectura**. La transcripció final i el resum queden disponibles fins que tornis a començar o tanquis la pàgina.

**Opcions del temporitzador.** La captura i la transcripció comencen des que s’activa el micròfon. El cronòmetre espera fins a 45 segons que el motor situï la lectura a la paraula marcada o a una de les dues següents. Quan una coincidència posterior està precedida de paraules que el motor ha entès de manera diferent però ha situat dins del tram d’inici, els seus temps poden servir per estimar l’inici del cronòmetre. Les marques i el recompte comencen a la primera coincidència reconeguda. Si es permet acabar la frase, la transcripció pot continuar fins al punt següent, amb un marge màxim de 20 segons. El resum només compta paraules completades dins del temps triat. L’avís sonor és opcional.

## Com funciona

Web estàtic, sense compilació. Necessita HTTPS i un navegador amb Web Audio i WebAssembly. El micròfon alimenta un AudioWorklet que envia fragments de veu al reconeixedor Vosk. El model es carrega quan es prepara la lectura i pot quedar a la memòria cau del navegador. La veu, la transcripció i el resum es processen al dispositiu i no es desen. El web no té comptes ni analítica, i el reconeixedor funciona sense cap servei extern.

La transcripció mostra la sortida del motor, que pot ometre o interpretar paraules. `reading.js` alinea aquesta sortida amb el text i exclou el final que l’alumne encara no ha llegit. El cursor indica l’última coincidència. Les paraules que falten i les discrepàncies amb poc context es marquen com a dubtes del motor i s’agrupen en fragments per revisar. Amb una cobertura de l’alineació baixa, les discrepàncies també es tracten com a dubtes. Si es pot situar prou lectura, el resum mostra dos recomptes fins a l’última paraula situada, un comptant els dubtes com a errades i l’altre com a encerts. Cada escenari inclou el nombre de paraules correctes, les errades i les paraules correctes per minut. Una paraula inesperada seguida de la paraula esperada pot ser una autocorrecció o una addició.

Quan l’alineació troba tres paraules consecutives d’un fragment anterior, pot seguir la lectura enrere i marcar el tram rellegit que reconeix. Si hi havia una discrepància que ara coincideix, la indica com a possible rectificació. Cada paraula del text compta un sol cop per a l’estimació.

## Idiomes

`content.js` configura per separat la llengua de la interfície i la de la lectura. Per afegir una interfície, creeu un catàleg a partir de `locales/ca.js` i registreu-lo a `interfaces`. Per afegir una lectura, registreu l’idioma, el model local i un text a `readings`. El prototip carrega la configuració catalana.

## Prova al centre

Obriu [Compara els motors](https://resso.ortogra.fi/compare.html), trieu un text i enregistreu-lo des de la primera paraula o obriu un fitxer d’àudio de fins a dos minuts. Escolteu la gravació si cal, marqueu fins on s’ha llegit i quines paraules s’han omès o s’han llegit malament. Marqueu només les errades que han quedat sense corregir. Confirmeu la revisió i compareu els tres motors.

Els tres motors reben les mateixes mostres d’àudio de 16 kHz, amb un sol canal. S’executen per torns al dispositiu. Vosk amb context rep fragments del text i admet `[unk]` per indicar veu que no ha identificat. La transcripció i les marques són temporals. La primera comparació carrega els fitxers de Vosk i de Whisper des del mateix web. La lectura habitual només carrega Vosk.

La mateixa alineació compara omissions i substitucions per paraula amb les anotacions. Per a cada motor es mostren les falses alarmes, les errades detectades i les passades per alt. També es mostra quantes paraules queden sense evidència, incloses les que el motor només identifica com a desconegudes. Les paraules afegides es poden revisar a la transcripció. Compareu els resultats i el temps de transcripció amb diverses lectures, també amb soroll d’aula, en els Chromebooks del centre.

## Publicació i llicències

GitHub Pages publica l’arrel de la branca `main` sense compilació amb el domini `resso.ortogra.fi`, declarat a `CNAME`. Els fitxers del motor i del model es serveixen des del mateix web.

- Codi, text de prova i marca reutilitzada d’ortogra.fi sota [llicència MIT](LICENSE).
- Codi QR de Lightning reutilitzat del diàleg V4V de [Plec](https://plec.ortogra.fi/).
- [Vosk Browser 0.0.8](https://www.npmjs.com/package/vosk-browser/v/0.0.8) i [model català Vosk 0.4](https://alphacephei.com/vosk/models.html) sota llicència Apache 2.0. El model només s’ha reempaquetat de ZIP a TAR.GZ.
- [Whisper Tiny Catalan de HiTZ](https://huggingface.co/HiTZ/whisper-tiny-ca/tree/727c33aa46802db4df56142f4a8d19d77cd522c6) i [Transformers.js 3.8.1](https://github.com/huggingface/transformers.js/tree/3.8.1) sota llicència Apache 2.0. El model s’ha exportat a ONNX (opset 17, Optimum 1.24.0 i Transformers 4.42.4) per a reconeixement amb memòria cau al descodificador, i quantificat a 8 bits amb ONNX Runtime 1.21.1. [ONNX Runtime Web](https://github.com/microsoft/onnxruntime/tree/89f8206ba4) sota llicència MIT.
- Les llicències de tercers es troben a [vendor/](vendor/).

[Registre de canvis](CHANGELOG.md)
