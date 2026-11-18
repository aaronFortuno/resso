# Pràctica oral i reptes de Ressò

Pla acordat el 18 de novembre de 2026 per ampliar Ressò amb escolta, repetició i reptes breus. L’objectiu és que l’alumne pugui practicar allò que li ha costat durant una lectura i comprovar com evoluciona en els intents següents.

El desenvolupament i la validació comencen amb les tres lectures de 3r de primària. Quan les funcionalitats estiguin validades, ampliarem els exercicis amb variants i més lectures.

## Catàleg de validació

La lectura habitual i el comparador comparteixen el [catàleg en català](../texts/ca.js). Les ampliacions d’aquest pla treballaran sobre aquestes entrades.

| Lectura | Identificador | Paraules |
| --- | --- | --- |
| La capsa dels sons | `capsa-sons` | 163 |
| El paraigua blau | `paraigua-blau` | 174 |
| D’on surten les gotes del got? | `got-gotes` | 169 |

Els totals segueixen el recompte actual de Ressò. Els reptes curts utilitzaran una o dues frases d’aquestes lectures. Les famílies de sons podran incorporar paraules de suport, com en l’exemple de *vaig*, *raig* i *estoig*.

## Condicions compartides

El processament de la veu de l’alumnat es farà al navegador i s’haurà de provar als Chromebooks del centre. Les locucions de mostra es prepararan abans de publicar els continguts i es descarregaran com a fitxers del mateix web. El català serà la primera llengua de treball.

La gravació i els intents s’utilitzaran temporalment al dispositiu durant l’activitat. Els modes individuals i per parelles podran comparar intents dins de la mateixa sessió amb identificadors com «Intent 1», «A» i «B». El seguiment entre sessions queda com una decisió de producte pendent.

Les comprovacions d’estadístiques han d’incloure que la veu, les transcripcions, els resultats individuals i les anotacions continuïn fora de les peticions d’Umami.

Els missatges han de distingir una paraula reconeguda, una discrepància amb el text i un resultat dubtós. L’avaluació dels sons tindrà una validació pròpia abans de donar correccions fonètiques automàtiques. Les variants dialectals vàlides s’han de contemplar tant als exemples com als criteris d’avaluació.

## Funcionalitats

Totes les ampliacions següents estan pendents d’implementació. La base actual ofereix lectura cronometrada, transcripció, marques sobre el text, resum i comparació dels tres motors amb anotacions manuals.

### Escoltar el model de lectura

En acabar una lectura, l’alumne podrà clicar una paraula marcada i escoltar-ne una locució de mostra. També podrà escoltar la frase sencera per sentir l’accent, el ritme i les pauses en context. L’accés servirà igualment per practicar voluntàriament una paraula que hagi estat reconeguda.

Les mostres es generaran amb Gemini TTS o Azure, o s’enregistraran amb una veu revisada. La tria del proveïdor es farà després de comparar mostres en català. La preparació dels fitxers inclourà una escolta de revisió de les paraules, les frases i la varietat lingüística representada. [Gemini TTS](https://ai.google.dev/gemini-api/docs/speech-generation), [veus d’Azure](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support).

L’opció «Més a poc a poc» haurà d’oferir una versió més lenta que conservi els sons i sigui clara. Es compararan una locució lenta preparada expressament i la reproducció alentida amb conservació del to. La tria dependrà del resultat auditiu.

Per validar aquesta funció, una paraula i la seva frase han de reproduir el fragment correcte, la versió lenta ha de ser intel·ligible i el canvi de fragment ha d’aturar la reproducció anterior. Cal provar també què veu l’alumne quan falta una mostra o falla la descàrrega.

### Escoltar la lectura pròpia

L’alumne podrà escoltar el seu intent i alternar-lo amb la locució de mostra. Caldrà conservar temporalment l’àudio de la lectura habitual, una capacitat que el comparador ja utilitza per reproduir la gravació completa.

La reproducció d’una paraula utilitzarà els temps estimats del motor amb un petit marge al voltant del fragment. Si una omissió o una alineació dubtosa impedeix situar-la, s’oferirà la frase o un tram més ampli. La interfície indicarà quin fragment s’està reproduint.

La validació comprovarà que el retall conserva l’inici i el final de la paraula, que el canvi de mostra atura l’àudio anterior i que la memòria de les gravacions s’allibera en descartar la pràctica o tancar la sessió.

### Repetir una paraula o una frase

Des del resum, l’alumne podrà escoltar un model, enregistrar un intent breu i veure el retorn del motor. Podrà practicar primer la paraula i després la frase on apareix.

El retorn inicial farà servir el reconeixement disponible a Ressò. Es mostraran missatges com «El motor ha reconegut la paraula», «Ha entès una altra paraula» o «Aquest intent ha quedat amb dubtes». La coincidència de la transcripció amb el text serà una mesura de reconeixement. La correcció d’un so concret dependrà de l’avaluació acústica descrita més avall.

Per a aquesta pràctica caldrà comparar el comportament dels tres motors amb paraules aïllades i amb frases. El context subministrat al motor pot afavorir la paraula esperada, de manera que aquesta configuració s’haurà de tenir en compte en interpretar un encert.

La validació inclourà intents correctes, substitucions, autocorreccions, silencis, soroll i veu d’un company de fons. L’alumne ha de poder repetir o escoltar de nou quan el resultat sigui dubtós.

### Practicar famílies de sons

Es prepararan petits grups de paraules que comparteixin un so, amb la part escrita destacada i exemples sonors. Cada grup inclourà una explicació breu adequada a l’edat i un fragment on tornar a practicar el so en context.

El punt d’entrada inicial serà una tria de l’alumne o del docent. Per exemple, després de practicar el final de *vaig*, es podran escoltar i repetir *raig* i *estoig*. La recomanació automàtica d’un grup s’incorporarà quan la detecció del so que costa estigui validada.

La revisió docent comprovarà que les paraules treballen realment el so proposat, que les locucions són adequades i que l’explicació ajuda a tornar-ho a intentar.

### Avaluar la pronunciació dels sons

Aquesta línia requereix una prova tècnica específica. Els motors actuals retornen paraules i indicis de confiança. Per identificar una dificultat fonètica, cal estudiar un model que pugui avaluar els sons de l’àudio i relacionar-los amb les pronunciacions esperades.

La prova haurà de comparar mètodes oberts d’avaluació acústica, com l’avaluació de la pronunciació per fonemes, i la seva execució local amb WebAssembly o ONNX. Caldrà mesurar la descàrrega, la memòria i el temps de resposta als Chromebooks. [Exemple d’avaluació per fonemes de Kaldi](https://github.com/kaldi-asr/kaldi/blob/master/egs/gop_speechocean762/README.md).

La validació partirà d’intents revisats pel docent, incloent-hi pronunciacions correctes, errors del so objectiu i variants dialectals acceptables. Per cada fenomen es registraran les deteccions encertades, les falses alarmes, les errades passades per alt i els intents que queden sense prou evidència.

Els resultats de la prova serviran per acordar quins sons poden rebre retorn automàtic. Si el sistema no obté prou evidència per a un intent, oferirà escolta i repetició. La sortida que volem arribar a validar és una indicació concreta del so que convé practicar i dos exemples relacionats.

### Repte individual de lectura

L’alumne llegirà una o dues frases del catàleg de validació. Després podrà revisar les marques, escoltar el model i el seu intent, practicar les paraules que li han costat i repetir el fragment.

La comparació amb l’intent anterior mostrarà primer el resultat de la lectura i després el temps. Mentre s’utilitzi el reconeixement actual, el retorn s’expressarà en paraules reconegudes, discrepàncies i dubtes.

Un millor temps s’haurà de comparar sobre el mateix fragment, amb la mateixa versió del contingut, el mateix motor i el mateix criteri. Els intents dubtosos quedaran pendents de revisió. El docent podrà confirmar les discrepàncies reals amb una interacció basada en les anotacions del comparador.

La validació comprovarà que cada intent conserva el seu resultat durant la sessió, que repetir el fragment reinicia correctament la captura i que es pot passar a una altra frase sense barrejar intents.

### Repte per parelles i repte compartit

Dos alumnes podran alternar torns al mateix dispositiu i llegir el mateix fragment. Cadascú podrà revisar i practicar el seu intent abans de repetir-lo. Es podran comparar les marques i el temps sota els mateixos criteris del repte individual.

La modalitat compartida proposarà que tots dos aconsegueixin una lectura satisfactòria del fragment. Això donarà al company un paper d’escolta i ajuda. Els parells de nivell semblant es podran organitzar a l’aula.

La validació comprovarà l’assignació correcta dels intents a «A» i «B», el canvi de torn, l’escolta de cada gravació i el tractament dels dubtes abans d’atribuir un resultat.

### Repte de temps

L’alumne intentarà llegir una frase amb precisió dins d’un temps objectiu o superar la seva marca anterior. El temps objectiu podrà ajustar-lo el docent.

La comparació donarà prioritat a la precisió. El primer prototip utilitzarà el resultat del reconeixement i la revisió docent quan hi hagi dubtes. La valoració automàtica de la dicció s’integrarà amb els sons que hagin superat la seva validació específica.

La durada de l’intent es calcularà amb els temps de l’àudio, des del començament de la parla fins al final del fragment llegit. La càrrega del model i l’espera del processament es mostraran separadament quan calgui. Caldrà comprovar que el silenci inicial, el silenci final i les repeticions es tracten de manera coherent.

## Proposta d’implementació

Les fases següents organitzen les dependències i permeten provar cada peça al web a mesura que estigui disponible.

| Fase | Resultat que es podrà provar | Estat |
| --- | --- | --- |
| Escolta de l’intent | Gravació temporal a la lectura habitual i reproducció del fragment seleccionat. | Pendent |
| Models de lectura | Mostres revisades de paraules i frases de les tres lectures, amb opció lenta. | Pendent |
| Repetició guiada | Escoltar, enregistrar un intent curt, veure què ha entès el motor i repetir. | Pendent |
| Famílies de sons | Grups curats amb exemples i exercicis breus. | Pendent |
| Reptes | Repetició individual, torns per parelles, objectiu compartit i temps objectiu. | Pendent |
| Avaluació acústica | Prova local per sons i integració dels resultats que siguin prou fiables. | Investigació pendent |
| Ampliació de continguts | Variants dels exercicis i més lectures després de la validació funcional. | Després de validar |

La preparació de les locucions i la investigació acústica poden avançar mentre s’implementa la reproducció de l’intent.

### Reutilització de la base actual

| Fitxer | Punt de partida per a les ampliacions |
| --- | --- |
| [speech.js](../speech.js) i [capture-worklet.js](../capture-worklet.js) | Captura de la lectura habitual i conservació temporal de les mostres d’àudio. |
| [comparison-audio.js](../comparison-audio.js) | Captura i reproducció locals que ja utilitza el comparador. |
| [reading.js](../reading.js) | Paraules del text, alineació, marques i resum de la lectura. |
| [timing.js](../timing.js) | Temps de l’àudio, límit de la prova i tractament del final de frase. |
| [engines.js](../engines.js) i [whisper.js](../whisper.js) | Selecció del motor i reconeixement local. |
| [comparison.js](../comparison.js) | Anotacions manuals i comparació entre resultats dels motors. |
| [texts/ca.js](../texts/ca.js) i [locales/ca.js](../locales/ca.js) | Identificadors de contingut i textos de la interfície. |

Els fragments de pràctica s’han de poder relacionar amb la lectura i les paraules originals mitjançant identificadors estables. Les mostres d’àudio han d’indicar la versió del text, la veu o varietat i la modalitat normal o lenta. Això permetrà detectar quan una correcció del text requereix regenerar les locucions.

La generació amb TTS es farà durant la preparació del catàleg, amb les credencials fora del web publicat. Caldrà revisar les condicions de distribució de la veu triada en preparar els fitxers.

## Validació abans d’ampliar el catàleg

Per cada funcionalitat s’anotaran la versió de Ressò, la lectura o fragment utilitzat, el motor, el dispositiu i navegador i les condicions de soroll. La revisió docent permetrà contrastar les marques automàtiques amb les discrepàncies reals.

La validació ha de cobrir les tres lectures i els recorreguts complets de pràctica individual i per parelles. Inclourà la reproducció de models, els retalls de l’intent propi, els reintents, els temps, la gestió dels dubtes i la recuperació després d’un problema de micròfon o descàrrega.

Les proves als Chromebooks del centre serviran per decidir els motors i les funcions adequats a aquests dispositius. La validació acústica especificarà quins sons s’han provat i amb quina fiabilitat. Els llindars per donar una correcció fonètica s’acordaran a partir d’aquests resultats.

Quan les funcionalitats hagin superat la revisió funcional i docent, començarem a preparar variants i noves lectures per comprovar la transferència a fragments que l’alumne encara no ha practicat.

## Decisions pendents de les primeres proves

- Veu de mostra i varietat lingüística per a les locucions en català.
- Qualitat de la versió lenta i elecció del mètode de reproducció.
- Motor i configuració per a paraules aïllades i frases curtes.
- Sons que podem avaluar localment i criteris per donar retorn automàtic.
- Criteri de precisió i temps objectiu dels reptes.
- Necessitat d’un seguiment entre sessions i forma de conservar-lo localment.
