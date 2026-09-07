# Plan budowy gry „Żużel — kreski”

Dokument roboczy. Źródło prawdy dla dalszej pracy; aktualizujemy go w miarę postępów.

---

## 0. Kontekst i założenia

**Inspiracja:** gra żużlowa „w kreski” znana z programów typu *Kreski / Żużel 2001*
(społeczność m.in. wokół kreski.org, Toruńska Liga Kreskowa) oraz z papierowej gry
na kratce o tej samej nazwie.

**Ważne zastrzeżenie:** strony `kreski.org` nie udało się otworzyć z tego środowiska
(blokada proxy sieciowego) — mechanika poniżej jest odtworzona z opisów i pamięci,
nie z oryginalnego kodu. Miejsca oznaczone **[do wyważenia]** to stałe fizyki,
które trzeba będzie dostroić po pierwszych testach, a nie fundamentalne zasady.

**Model rozgrywki — ustalony:** real-time, sterowanie dwoma klawiszami (lewo/prawo),
jak w *Żużlu 2001* — **nie** turowa gra wektorowa na kratce (to była pierwsza,
błędna hipoteza; skorygowana po rozmowie). Zawodnik jedzie sam do przodu, gaz jest
automatyczny, jedyną decyzją gracza jest kierunek. Szczegóły fizyki: `docs/RULES.md`.

**Założenia projektowe:**

| Decyzja | Wybór (domyślny) | Dlaczego |
|---|---|---|
| Platforma | przeglądarka (desktop + mobile) | zero instalacji, łatwo się dzielić linkiem, GitHub Pages za darmo |
| Język | TypeScript | typy w silniku gry realnie ratują przed błędami geometrii i fizyki |
| Rendering | Canvas 2D | prosty tor i sylwetki motocykli — WebGL to przerost formy |
| Rozgrywka | real-time, stały krok fizyki (`dt`), deterministyczna | wierność oryginałowi (lewo/prawo) + testowalna symulacja, powtórki, sieć |
| Sterowanie | lewo/prawo per zawodnik, hot-seat = różne klawisze na jednej klawiaturze | naturalne dla gry real-time; do 2 graczy jednocześnie na jednym urządzeniu |
| Start | hot-seat (1–2 graczy) + AI dopełniające skład do 4 | grywalne najszybciej, bez backendu |
| Online | dopiero po MVP | wymaga serwera; silnik projektujemy tak, by dało się dołożyć |

---

## 1. Czym ma być MVP

Jedna strona w przeglądarce, na której:

1. widzisz owalny tor żużlowy (dwie proste + dwa łuki) z lotu ptaka,
2. 4 zawodników (czerwony / niebieski / biały / żółty — jak kaski w żużlu) startuje
   z pól startowych na prostej,
3. każdy zawodnik jedzie sam, gracz(e) sterują wyłącznie kierunkiem (lewo/prawo),
   pozostałych prowadzi AI,
4. zbyt szybki wjazd w łuk = utrata przyczepności, wypadnięcie za bandę i upadek,
   kontakt z rywalem = kolizja,
5. po 4 okrążeniach jest meta, punktacja 3-2-1-0 i tabela biegu.

Wszystko inne (liga, edytor torów, sieć, statystyki) jest **poza MVP** i wchodzi etapami.

---

## 2. Model rozgrywki — rdzeń mechaniki

Symulacja real-time o stałym kroku `dt` (fizyka niezależna od FPS renderingu).
Pełna specyfikacja fizyki, band, kolizji i okrążeń: **`docs/RULES.md`** — tu tylko skrót.

### 2.1 Sterowanie i fizyka

Jedyny input gracza: `steer ∈ {-1, 0, 1}`. Gaz automatyczny. Co klatkę fizyki:

```
angularVelocity = steer * TURN_RATE * grip(speed)
heading        += angularVelocity * dt

targetSpeed     = steer != 0 ? CORNER_SPEED : MAX_SPEED
speed           = approach(speed, targetSpeed, ACCEL, BRAKE, dt)

position       += (cos(heading), sin(heading)) * speed * dt
```

`grip(speed)` maleje z prędkością — im szybciej jedziesz, tym wolniej skręcasz.
`CORNER_SPEED < MAX_SPEED`, więc pełny gaz w łuku jest fizycznie niemożliwy do
utrzymania na torze — trzeba wcześniej „ściągnąć”, dokładnie ten moment decyzji
jest sercem gry. Stałe fizyki w jednym miejscu (`engine/config.ts`), do wyważenia.

### 2.2 Tor jako krzywa parametryczna

Na M1–M2 tor to **owal analityczny**: dwie proste + dwa półokręgi, opisany trzema
liczbami (długość prostej, promień łuku, szerokość toru). Dzięki temu pozycja
zawodnika względem osi toru (`s` — dystans wzdłuż osi, `offset` — odchylenie w bok)
liczy się wprost, bez przecięć wielokątów. Dowolne tory (nieowalne) i edytor
wracają w M5 z inną reprezentacją geometrii — patrz sekcja 6.

### 2.3 Banda i upadek

Jeśli `|offset| > szerokość_toru / 2` → zawodnik jest za bandą → upadek: prędkość
spada do zera, kara czasowa (`CRASH_PENALTY`, domyślnie 1,5 s), powrót na ostatnią
pozycję na torze.

### 2.4 Kolizje między zawodnikami

Domyślnie: dwóch zawodników bliżej siebie niż `2 × promień_zawodnika` → kolizja,
obaj tracą prędkość jak przy upadku. Tryb „duchy” (bez kolizji) jako opcja do testów.

### 2.5 Okrążenia i meta

Tor podzielony na 4 sektory wg `s`. Okrążenie liczy się po przejściu sektorów
w kolejności `0→1→2→3→0`. Bieg = 4 okrążenia. Kolejność w wyścigu wg
`lap * długość_toru + s`, malejąco — liczone co klatkę, bez udziału gracza.

### 2.6 Punktacja żużlowa

- Bieg (4 zawodników): **3 / 2 / 1 / 0** punkty.
- Mecz: 15 biegów, dwie drużyny po 4+ zawodników, klasyczny program par startowych.
- Liga/turniej: tabela, bilans, punkty meczowe.

---

## 3. Stos technologiczny

```
TypeScript 5 + Vite            — build i dev server
Canvas 2D                      — rendering
Vitest                         — testy jednostkowe silnika
ESLint + Prettier              — jakość
GitHub Actions                 — CI (typecheck + testy + build)
GitHub Pages                   — deployment demo
```

Zero zależności runtime w silniku — `src/engine` to czysty TypeScript bez importów z UI.
To warunek, żeby dało się później uruchomić ten sam kod na serwerze (multiplayer) i w testach.

**Świadomie odrzucone:** Unity/Godot (przerost, gorsze udostępnianie), React (UI jest prosty,
canvas i tak rysujemy ręcznie — dołożymy, jeśli menu urośnie), fizyka 2D (mechanika jest dyskretna).

---

## 4. Architektura

```
src/
  engine/            # czysta logika, bez DOM
    types.ts         # Vec2, RiderInput, RiderState, RaceState, RaceConfig
    geometry.ts      # wektory, kąty, rzutowanie punktu na odcinek/łuk
    track.ts         # owal analityczny: pointAt(s), nearestOnTrack(p) -> {s, offset}
    physics.ts        # stepRider(rider, input, track, dt) -> nowy RiderState
    rules.ts          # kolizje, upadki, kary
    race.ts           # maszyna stanów biegu: START → RUNNING → FINISHED, tick(state, inputs, dt)
    scoring.ts        # punktacja biegu / meczu / ligi
    config.ts         # domyślny RaceConfig (stałe fizyki)
  ai/
    bot.ts            # sterowanie proporcjonalne: cel na osi toru → steer
  render/
    canvas.ts         # rysowanie toru (owal), zawodników, HUD-owych znaczników
    camera.ts         # skala, przesunięcie, dopasowanie do ekranu
  ui/
    input.ts          # klawiatura → steer per zawodnik (hot-seat)
    hud.ts             # okrążenia, pozycje, wyniki
    screens.ts         # menu, wybór graczy/AI, wyniki
  tracks/              # definicje torów (na razie owale parametryczne)
  main.ts              # pętla gry: requestAnimationFrame + stały krok fizyki (accumulator)
docs/                  # ten plan, zasady, format toru
tests/                 # testy silnika
```

**Zasada przewodnia:** `tick(state, inputs, dt) → newState` jest czystą funkcją operującą
na niemutowalnym `RaceState`. Dzięki temu za darmo dostajemy: deterministyczne testy fizyki,
powtórki (zapisany ciąg inputów), oraz AI, które może symulować przyszłość silnikiem produkcyjnym
zamiast osobnym modelem.

---

## 5. Kluczowe algorytmy

### 5.1 Krok fizyki

```ts
function stepRider(rider: RiderState, input: Steer, track: OvalTrack, cfg: RaceConfig, dt: number): RiderState {
  const grip = gripAt(rider.speed, cfg);
  const angularVelocity = input * cfg.turnRate * grip;
  const heading = rider.heading + angularVelocity * dt;

  const targetSpeed = input !== 0 ? cfg.cornerSpeed : cfg.maxSpeed;
  const speed = approach(rider.speed, targetSpeed, cfg.accel, cfg.brake, dt);

  const position = add(rider.position, scale(fromAngle(heading), speed * dt));
  return { ...rider, heading, speed, position };
}
```

`approach(current, target, accel, brake, dt)` przesuwa `current` w stronę `target`
z osobnym tempem dla przyspieszania i hamowania — asymetria jest ważna: hamowanie
przed łukiem musi być szybsze niż rozpędzanie, inaczej sterowanie jest bez sensu.

### 5.2 Pozycja względem osi toru

Owal to funkcja `pointAt(s): {point, heading}` (patrz `docs/RULES.md` §1) złożona
z 4 odcinków parametru (prosta, łuk, prosta, łuk). `nearestOnTrack(p)` szuka najbliższego
`s` metodą rzutowania na każdy z 4 odcinków osobno (prosta → rzut ortogonalny,
łuk → kąt względem środka okręgu) i bierze najlepszy wynik — 4 tanie obliczenia,
żadnego przeszukiwania. Zwraca `{s, offset}`, gdzie `offset` to odległość boczna
(dodatnia/ujemna) od osi — to jest jednocześnie test bandy (§2.3) i input dla AI.

### 5.3 Kolizje

Test odległości euklidesowej między każdą parą zawodników co klatkę — przy 4
zawodnikach to 6 porównań, nie potrzeba przestrzennego indeksu.

### 5.4 Okrążenia

`s` z §5.2 dla całego toru jest ciągłe w `[0, długość)`. Utrzymujemy dla każdego
zawodnika ostatni osiągnięty indeks sektora (0–3); przejście z sektora 3 do 0
(czyli przekroczenie linii mety) nalicza okrążenie, o ile sektory 0→1→2→3 zostały
zaliczone po kolei — to blokuje „cofanie się” przez metę jako oszustwo.

---

## 6. Format toru i edytor

Na M1–M2 tor to trzy liczby (`straightLength`, `turnRadius`, `width`) plus liczba
okrążeń — definicja w `src/tracks/*.ts`, patrz `docs/RULES.md` §1.

Format z dowolnymi wielokątami band (`docs/TRACK_FORMAT.md`) zostaje udokumentowany
jako cel na **M5** (edytor torów) — wtedy `nearestOnTrack` przechodzi z formuł
analitycznych na próbkowaną oś (centerline) liczoną z geometrii wielokątów.
Do tego czasu `TRACK_FORMAT.md` opisuje docelowy, a nie aktualnie używany format.

---

## 7. AI przeciwnika

Wspólny interfejs `chooseSteer(rider, allRiders, track, level): -1 | 0 | 1` — pure pursuit:
celuje w punkt na torze odległy o `lookahead(speed)` przed sobą i skręca w jego stronę,
więc hamowanie przed łukiem wychodzi samo z ograniczonego przyczepnością skrętu (`grip`),
bez osobnej logiki. Trzy poziomy różnią się trzema parametrami tej samej funkcji:

1. **Nowicjusz** — ten sam bazowy `lookahead` co zawodowiec przy niskiej prędkości (żeby
   kilku nowicjuszy obok siebie na starcie nie zjeżdżało się w jeden punkt — to się realnie
   zdarzało i blokowało bieg na zawsze, patrz `ai-race.test.ts`), ale rośnie ze wzrostem
   prędkości dużo wolniej niż u pozostałych — na torze "widzi" mniej naprzód, więc hamuje
   przed łukiem później i częściej wypada. Ma najsłabsze (ale nie zerowe) unikanie kolizji.
2. **Zawodowiec** — `lookahead` rosnący z prędkością, pełne unikanie kolizji lokalnym
   odpychaniem od zawodników w promieniu kolizji, jedzie osią toru.
3. **Mistrz** — najdłuższy zasięg przewidywania przy dużej prędkości, najsilniejsze
   unikanie kolizji, oraz niewielkie odchylenie celu w stronę wewnętrznej krawędzi
   (krótsza droga na łuku). Świadomie **bez** agresywnego krycia linii — silniejsze
   odchylenie testowo powodowało powtarzalne obcieranie wewnętrznej bandy i wolniejsze
   czasy niż bez niego, więc zostało przycięte do wartości bezpiecznej.

Krycie/blokowanie pod presją z tyłu (jak przy prawdziwym wyprzedzaniu) **nie jest**
zaimplementowane — to kandydat na kolejną iterację AI, nie część obecnego M4.

AI odpytuje ten sam silnik fizyki co gracz — nie ma osobnego modelu ruchu do utrzymania.
Test `tests/ai-race.test.ts` przejeżdża pełny bieg dla każdej kombinacji poziomów (w tym
4× ten sam poziom) i pilnuje, żeby żadna kombinacja nie zawiesiła się na stałe.

---

## 8. UI/UX

- **Tor** rysowany jako owal z lotu ptaka: banda zewnętrzna i wewnętrzna, linia
  startu/mety, zawodnicy jako strzałki w kolorach kasków (kierunek = heading).
- **Sterowanie:** klawiatura, różne klawisze per gracz w hot-seat (§ w `RULES.md`),
  na mobile dwa duże przyciski lewo/prawo po bokach ekranu.
- **HUD:** okrążenie / limit, aktualna kolejność, kto jest kim (kolor + nazwa),
  wynik po biegu.
- **Kamera:** stały widok całego toru (na start) — śledzenie lidera jako opcja później.
- Interfejs po polsku, z możliwością dołożenia EN później (proste `i18n` na słowniku).

---

## 9. Tryby rozgrywki

| Tryb | Etap | Opis |
|---|---|---|
| Pojedynczy bieg (hot-seat) | M2 | 2–4 graczy na jednym urządzeniu |
| Bieg z AI | M4 | dowolna mieszanka ludzi i botów |
| Mecz ligowy | M6 | 15 biegów, dwie drużyny, program par, protokół meczu |
| Turniej / liga | M6+ | tabela, sezon, zapis w `localStorage` |
| Online | M8 | opcjonalnie — patrz niżej |

**Online (M8, poza MVP):** silnik jest deterministyczny, więc naturalnym rozwiązaniem jest
autorytatywny serwer na WebSocketach przesyłający tylko ruchy (`{riderId, ax, ay}`), a nie stan.
Tańszy wariant na start: **gra korespondencyjna** — stan biegu kodowany w URL/kodzie do wklejenia,
zero serwera.

---

## 10. Etapy realizacji

Każdy etap kończy się działającą, wypchniętą wersją. „Done” = testy zielone + widać efekt w przeglądarce.

| # | Etap | Zakres | Done, gdy… | Szac. |
|---|---|---|---|---|
| **M0** ✅ | Fundament | Vite + TS + Vitest, CI, szkielet katalogów | pipeline zielony, strona wstaje | 1 sesja |
| **M1** ✅ | Silnik fizyki | `types`, `geometry`, `track` (owal analityczny), `physics.stepRider`, `rules`, tor testowy | 37 testów jednostkowych fizyki, bandy i sektorów przechodzi | 1–2 sesje |
| **M2** ✅ | Grywalny hot-seat | render toru, sterowanie klawiaturą (do 2 graczy), licznik okrążeń, meta, ekran wyników | da się przejechać 4 okrążenia w 2 osoby — zweryfikowane w przeglądarce | 2 sesje |
| **M3** ✅ | Zasady żużlowe | upadki i kary (`recoverOntoTrack`), kolizje (`ghost`/`solid`), 3‑sekundowe odliczanie startu, punktacja biegu | bieg kończy się tabelką 3-2-1-0 | 1–2 sesje |
| **M4** ✅ | AI | 3 realnie różne poziomy botów (zasięg przewidywania, siła unikania kolizji, linia przejazdu), wybór poziomu w ekranie startu | każda kombinacja poziomów (w tym sam na sam z tej samej klasy) kończy bieg — pokryte testem regresyjnym `ai-race.test.ts` | 2 sesje |
| **M5** | Edytor torów | rysowanie band, sektory, walidacja, import/eksport, 4–6 torów | tor narysowany w edytorze da się przejechać | 2 sesje |
| **M6** | Mecz i liga | program 15 biegów, protokół, tabela, zapis stanu | rozegrany pełny mecz z podsumowaniem | 2 sesje |
| **M7** ✅ | Szlify | dźwięk (syntezowany Web Audio, bez plików), sterowanie dotykowe, ślad ruchu i pulsowanie przy upadku, powtórka biegu, wyciszenie, samouczek na starcie | gra jest przyjemna dla kogoś, kto widzi ją pierwszy raz | 1–2 sesje |
| **M8** | Online (opcja) | serwer WS lub gra korespondencyjna | dwie osoby grają z dwóch komputerów | 3+ sesje |

Ścieżka do „gra się fajnie” (**M0 → M1 → M2 → M3 → M4**) jest zamknięta — gra jest grywalna
od początku do końca, z botami i wynikami. M7 (szlify) też zamknięte: dźwięk, dotyk, ślad
ruchu, powtórka, samouczek — działa i zweryfikowane w przeglądarce (desktop + telefon).

**Świadomie poza zakresem M7:** powtórka nie ma suwaka (tylko odtwórz/zamknij — przewijanie
to osobna, większa funkcja), brak regulacji głośności (tylko wł./wył.), dźwięk silnika gra
tylko dla graczy-ludzi (nie dla botów, żeby nie było kakofonii przy 4 silnikach). Jeden tor
wciąż jest jedyny — to M5.

Dalej: **M5 (edytor torów)** — jeden tor szybko się znudzi, to teraz najbardziej odczuwalny brak.

---

## 11. Testy i jakość

- **Jednostkowe (Vitest):** geometria (przecięcia, punkt w wielokącie), `legalMoves` w rogach
  i przy bandzie, naliczanie okrążeń, wykrywanie mety, punktacja.
- **„Złote” powtórki:** zapisana lista ruchów + oczekiwany stan końcowy. Chroni przed
  niezauważoną zmianą zasad przy refaktorze.
- **Property-based (opcjonalnie, `fast-check`):** dla losowych sekwencji legalnych ruchów
  zawodnik nigdy nie znajduje się poza torem bez flagi upadku; symulacja jest deterministyczna.
- **CI:** `typecheck` + `test` + `build` na każdy push.

---

## 12. Ryzyka i jak je zbijamy

| Ryzyko | Skutek | Reakcja |
|---|---|---|
| Zasady odbiegają od oryginału z kreski.org | „to nie ta gra” | zasady w jednym pliku konfiguracyjnym, wszystkie warianty przełączalne; weryfikacja z Tobą po M1 |
| Gra jest za trudna / za łatwa | nikt nie chce grać | strojenie `V_MAX`, kary za upadek i szerokości toru; podgląd ryzyka w UI |
| Wykrywanie mety i okrążeń „gubi się” | psuje wyniki | sektory kontrolne od początku, nie doklejane później |
| AI wjeżdża w bandę albo jeździ nudno | psuje tryb single | ocena z jednym ruchem w przód już na poziomie 1; testy „bot kończy bieg” w CI |
| Rozrost zakresu (liga, sieć, grafika) | MVP nigdy nie powstaje | M8 świadomie na końcu; nic z etapu N+1 przed zamknięciem N |

---

## 13. Decyzje — status

1. ~~Model ruchu: wektory na kratce czy real-time lewo/prawo?~~ **Rozstrzygnięte:
   real-time, lewo/prawo** (jak *Żużel 2001*). Plan i `RULES.md` zaktualizowane.
2. **Kolizje:** domyślnie „solid” (utrata prędkości przy kontakcie), z trybem „ghost”
   do testów — patrz `RULES.md` §6. Do ewentualnej korekty po pierwszej grze.
3. **Stałe fizyki** (`maxSpeed`, `cornerSpeed`, `turnRate`, kara za upadek) — wartości
   startowe w `engine/config.ts`, jawnie oznaczone jako **[do wyważenia]**; strojenie
   po pierwszym grywalnym buildzie (M2), nie na sucho.
4. **Upadek:** kara czasowa (1,5 s), nie wykluczenie z biegu — łagodniejsze, lepsze
   do testowania w pojedynkę. Wykluczenie jako opcja konfiguracji, jeśli okaże się
   bliższe oryginałowi.
5. **Kolejność akcji:** nieaktualne — w modelu real-time nie ma tur, wszyscy jadą
   symultanicznie co klatkę fizyki.

Jeśli w trakcie grania okaże się, że pamięć o kreski.org podpowiada inne detale
(np. inny kształt toru, inne zasady startu) — zgłoś, poprawiamy `RULES.md` i kod razem.
