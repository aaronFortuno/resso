# Canvis de Ressò

## v0.4.2

- Dotze textos en català, tres per curs de 3r a 6è de primària, amb extensió i complexitat progressives.
- Filtre per curs i total de paraules del text tant a la lectura habitual com al comparador.

## v0.4.1

- Selector de motor a la lectura habitual. Vosk actual és el predeterminat. També es pot triar Vosk amb context o Whisper Tiny Catalan.
- Whisper actualitza la transcripció i el seguiment per fragments amb temps estimats per paraula. El resum aplica el límit del cronòmetre a aquests temps.

## v0.4

- Mode de comparació local amb Vosk actual, Vosk amb context i Whisper Tiny Catalan a partir d’una sola gravació o fitxer d’àudio.
- Anotació manual del tram i de les errades. Cada motor mostra la transcripció literal, el temps de processament, les errades detectades, les falses alarmes i les errades que passen per alt.

## v0.3.4

- El resum mostra dos recomptes quan hi ha paraules amb dubtes.
- Els números del marge acumulen les paraules fins al final de cada línia des del punt d’inici seleccionat.
- El cronòmetre comença per defecte a la segona frase.

## v0.3.3

- El cronòmetre pot recuperar l’inici estimat a partir dels temps de les paraules que el motor ha entès de manera diferent abans de confirmar el punt de lectura.
- Les omissions aparents i les discrepàncies amb poca evidència passen a fragments per revisar. Quan el reconeixement és irregular, s’amaguen les estimacions de velocitat i errades.

## v0.3.2

- La transcripció es mostra des que comença la captura, també mentre el cronòmetre està esperant.
- El cronòmetre i el recompte arrenquen a la paraula marcada o a una de les dues següents si el motor les situa en aquest punt del text.

## v0.3.1

- Tria de la paraula d’inici directament al text, amb un punter davant de la paraula i un botó per tornar a la primera.
- El cronòmetre, la transcripció i el recompte comencen a la paraula marcada.

## v0.3

- Icona pròpia de Ressò i capçalera amb canvi de tema i desplegable d’idioma.
- Peu amb la marca d’ortogra.fi, la llicència MIT, el resum de versions i el diàleg Value for Value.
- Barra lateral amb tres textos en català, temporitzador configurable i botó de lectura ancorat.
- Opcions per iniciar el recompte en una paraula del text, avisar amb un so i continuar fins al final d’una frase després del tall de puntuació.
- Repositori i web de GitHub Pages a `resso`.

## v0.2

- El projecte pren el nom de Ressò.
- Transcripció en directe i final amb el fragment provisional diferenciat.
- Cursor de lectura, possibles omissions i substitucions, relectures i rectificacions amb recompte de paraules úniques.
- Capçalera i peu fixos, panells amb desplaçament independent i configuració separada dels idiomes.

## v0.1

- Primer prototip a GitHub Pages, amb reconeixement de veu local en català amb Vosk.
- Lectura d’un minut d’*El pont de les granotes*, amb estimació de paraules correctes per minut i possibles incidències.
