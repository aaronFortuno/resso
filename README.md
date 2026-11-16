# Lectura en veu alta

Prototip d’[ortogra.fi](https://ortogra.fi/) per practicar la lectura en català. [Obre el web a GitHub Pages](https://aaronfortuno.github.io/lectura-en-veu-alta/).

1. Prem **Prepara la lectura** per carregar el model de català.
2. Prem **Comença la lectura**, dona permís al micròfon i llegeix des del primer paràgraf d’*El pont de les granotes*.
3. El web s’atura al cap de 60 segons. També pots prémer **Acaba la lectura**. En acabar, veuràs una estimació de les paraules correctes per minut i les possibles incidències sobre el text.

## Com funciona

Web estàtic, sense compilació. Necessita HTTPS i un navegador amb Web Audio i WebAssembly. El micròfon alimenta un AudioWorklet que envia fragments de veu al reconeixedor Vosk. El model es carrega quan es prepara la lectura i pot quedar a la memòria cau del navegador. La veu, la transcripció i el resum es processen al dispositiu i no es desen. El web no té comptes ni analítica, i el reconeixedor funciona sense cap servei extern.

El text de prova és original i viu a `index.html`. `reading.js` alinea la transcripció amb les paraules del text i exclou el final que l’alumne encara no ha llegit. La xifra és una estimació basada en les coincidències. Les omissions i substitucions només es compten com a possibles errades quan queden aïllades entre coincidències amb confiança alta del model. Una paraula inesperada seguida de la paraula esperada pot ser una autocorrecció o una addició. La dicció i la qualitat de les pauses queden pendents de validació.

## Prova al centre

Compareu la lectura automàtica amb un recompte en directe en un Chromebook del centre. Anoteu la diferència en paraules correctes per minut, les errades marcades en paraules ben llegides i el temps d’espera del resum. Proveu també una lectura amb una omissió i una autocorrecció per veure quines incidències conserva el model.

## Publicació i llicències

GitHub Pages publica l’arrel de la branca `main` sense compilació. Els fitxers del motor i del model es serveixen des del mateix web.

- Codi, text de prova i marca reutilitzada d’ortogra.fi sota [llicència MIT](LICENSE).
- [Vosk Browser 0.0.8](https://www.npmjs.com/package/vosk-browser/v/0.0.8) i [model català Vosk 0.4](https://alphacephei.com/vosk/models.html) sota llicència Apache 2.0. El model només s’ha reempaquetat de ZIP a TAR.GZ.
- Les llicències de tercers es troben a [vendor/](vendor/).
