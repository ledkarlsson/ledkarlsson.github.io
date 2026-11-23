# BAS-verktyg

Öppna `chrome://extensions`, aktivera **Utvecklarläge** och välj **Läs in okomprimerat**. Välj mappen `projects/kartgenerator/extension`. Använd den publicerade kartgeneratorn för överföring.

## BAS till kartgeneratorn

1. Öppna **Platshantering → Platser** i BAS och välj klubb och sökfilter. Låt hela resultatet ladda. Ha bara en BAS-platslista öppen.
2. Öppna en flik med [kartgeneratorn](https://ledkarlsson.github.io/projects/kartgenerator/).
3. Välj **Läs platslistan från BAS** i tillägget. Första gången frågar Chrome om åtkomst till BAS och kartgeneratorns värd.
4. Kontrollera klubbnamnet, välj ett eller flera områden och tryck **Ladda valda platser i kartgeneratorn**. Snabbknapparna väljer alla bryggor, varvsplatser eller områden. Egna mönster som `Brygga*, Varvsplats*, Varvsområde*` matchar områdesnamn utan hänsyn till stora/små bokstäver; `*` står för valfri text. Kryssrutorna kan finjusteras.
5. Kartgeneratorn läser in de skickade platserna direkt och ersätter tidigare inlästa Excel-/BAS-rader. Ladda en karta för valda områden och välj **Visa BAS-info**. Spara kartan via **Ladda ner**.

### Omfattning och begränsningar

- BAS läses från den renderade platslistan; inga BAS-cookies läses eller exporteras och inga BAS-anrop eller ändringar görs av läsmodulen.
- Bara område, hela platsnamnet, områdeskategori, för-/efternamn, båtmodell och plats-/båtmått läses. Medlemsnummer som BAS visar efter efternamnet tas bort. Avgifter, e-post och telefonnummer överförs inte.
- Flera områden överförs tillsammans. Tabellens platsnyckel blir då `Område / Plats`. Kartans rena platsnummer fungerar om det är entydigt; vid lika nummer i flera områden visas rutan i rött och kartgeneratorn listar de matchande BAS-raderna för rättning i originaldatan. En avsiktlig områdeskoppling kan anges som `Brygga A / 12`. Alla rader för duplicerade platser inom ett område hoppas över och listas i tillägget. Övriga platser skickas vidare. Om hela urvalet består av dubbletter skickas inget och kartgeneratorns data behålls. Sparade kopplingar behåller sitt område även om urvalet ändras. Om flera flikar matchar krävs att de andra stängs.
- Hela **sökresultatet**, inte nödvändigtvis hela klubbens bestånd, måste vara laddat. Paginering, gruppering, redigeringsläge och oväntad tabellstruktur stoppas. Begränsa sökningen om listan är för stor (högst 5 000 rader).
- Ögonblicksbilden finns bara i tilläggets service workers minne, i högst fem minuter. Chrome kan avsluta den tidigare; läs listan igen om förhandsgranskningen försvunnit. Inga BAS-uppgifter sparas i tilläggets beständiga lagring.
- Kartgeneratorn tar emot data i minnet och kräver ett separat klick innan tidigare data ersätts. Den befintliga diagrams.net-editorn får de uppgifter som läggs på kartan när den visas. Sparade kartfiler kan innehålla dessa uppgifter.
- Kartan binds till klubb och områdesnamn i XML. Urval kan ändras när minst ett område överlappar; byte till en annan klubb eller helt andra områden kräver rätt karta. Matchningen använder platsnamnet före första `/` eller `(` (skiftläge och omgivande blanksteg normaliseras): `112/SSR` och `112 (SSR)` matchar `112`, och `71-73/1` matchar `71-73`. Originalnamnet behålls i underlaget. Rader med samma namn före `/` eller `(` inom ett område listas och utesluts samtliga från importen. Områdesdelen i `Brygga A / 112` behålls. Detaljlänkarnas ogenomskinliga identifierare används inte som beständiga ID:n. Verifierade BAS-ID:n och flytt/namnbyte är framtida arbete.
- En plats som inte finns i aktuellt BAS-underlag visas som **Saknas i BAS-urvalet**, inte ledig. En matchad plats med tomma båt-/namnfält visas som **Ledig** i en blå ruta när BAS-info visas.
- Mottagaren är låst till kartgeneratorns HTTPS-adress. Läsningen körs isolerat i BAS; leveransen använder ett fast DOM-händelseprotokoll i kartgeneratorns huvudmiljö. Inga godtyckliga adresser eller nätverksanrop erbjuds till webbsidor.
- Behörigheterna till de två nya värdarna är valfria och begärs först när BAS aktiveras. Chromes behörigheter gäller värden, medan koden begränsar användningen till de två specifika sidorna.

Implementationen är kontrollerad mot BAS-listans DOM den 1 november 2026. Automatiska tester och den lokala kartdemon använder syntetiska data. Installerat tillägg och publicerad mottagare behöver därefter provas ihop; testningen ändrar inga BAS-poster.
