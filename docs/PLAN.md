# Plan budowy gry „Żużel — kreski”

Dokument roboczy. Źródło prawdy dla dalszej pracy; aktualizujemy go w miarę postępów.

---

## 0. Kontekst i założenia

**Inspiracja:** gra żużlowa „w kreski” znana z papieru w kratkę oraz z programów typu
*Kreski / Żużel 2001* (społeczność m.in. wokół kreski.org, Toruńska Liga Kreskowa).

**Ważne zastrzeżenie:** strony `kreski.org` nie udało się otworzyć z tego środowiska
(blokada proxy sieciowego), więc mechanika poniżej jest odtworzona z klasycznych zasad
gry wektorowej na kratce. Wszystko oznaczone jako **[DO POTWIERDZENIA]** trzeba zweryfikować
z oryginałem, zanim zamrozimy zasady.

**Założenia projektowe:**

| Decyzja | Wybór (domyślny) | Dlaczego |
|---|---|---|
| Platforma | przeglądarka (desktop + mobile) | zero instalacji, łatwo się dzielić linkiem, GitHub Pages za darmo |
| Język | TypeScript | typy w silniku gry realnie ratują przed błędami geometrii |
| Rendering | Canvas 2D | tor to siatka i kreski — WebGL to przerost formy |
| Rozgrywka | turowa, deterministyczna | wierność oryginałowi + tanie testy, powtórki i sieć |
| Start | hot-seat (2–4 graczy na jednym ekranie) + AI | grywalne najszybciej, bez backendu |
| Online | dopiero po MVP | wymaga serwera; silnik projektujemy tak, by dało się dołożyć |

---

## 1. Czym ma być MVP

Jedna strona w przeglądarce, na której:

1. widzisz owalny tor żużlowy narysowany na siatce,
2. 4 zawodników (czerwony / niebieski / biały / żółty — jak kaski w żużlu) startuje z pól startowych,
3. każdy w swojej turze wybiera jeden z maksymalnie 9 dopuszczalnych ruchów,
4. wyjazd poza bandę = upadek i kara, kontakt z rywalem = kolizja,
5. po 4 okrążeniach jest meta, punktacja 3-2-1-0 i tabela biegu.

Wszystko inne (liga, edytor torów, sieć, statystyki) jest **poza MVP** i wchodzi etapami.

---

## 2. Model rozgrywki — rdzeń mechaniki

Klasyczne „wyścigi wektorowe” w żużlowej oprawie.

### 2.1 Ruch

Zawodnik ma pozycję `p = (x, y)` (węzeł siatki, liczby całkowite) i prędkość `v = (vx, vy)`.

W swojej turze wybiera przyspieszenie `a ∈ {-1, 0, 1} × {-1, 0, 1}` (9 opcji), po czym:

```
v' = v + a
p' = p + v'
```

Rysowany jest odcinek `p → p'` — to jest właśnie „kreska”. Długość kreski = prędkość,
więc na prostej kreski się wydłużają, a przed łukiem trzeba je skrócić, inaczej wypadasz na bandę.
Tu leży cała soczystość tej gry: hamowanie w odpowiednim momencie i szeroki/wąski łuk.

### 2.2 Ograniczenia

- **Limit prędkości** `|v| ≤ V_MAX` (domyślnie 6) — chroni przed „ucieczką” liczb. **[DO POTWIERDZENIA — w oryginale limitu może nie być]**
- **Zakaz jazdy pod prąd** — ruch musi mieć dodatni rzut na kierunek toru w danym sektorze, inaczej jest nielegalny.
- **Postój** (`v = 0`) dozwolony tylko po upadku / na starcie.

### 2.3 Banda i upadek

Odcinek `p → p'` nie może przeciąć bandy zewnętrznej ani wewnętrznej (krawężnika),
a `p'` musi leżeć na torze (między obiema bandami).

Naruszenie = **upadek**: zawodnik wraca do ostatniego legalnego punktu, `v := 0`
i traci `N` tur (domyślnie 2). Wariant „regulaminowy” (upadek = wykluczenie z biegu)
jako opcja w ustawieniach. **[DO POTWIERDZENIA]**

### 2.4 Kolizje między zawodnikami

Trzy warianty do wyboru w konfiguracji (implementujemy wszystkie, domyślny = B):

- **A. Duchy** — zawodnicy się nie widzą (najprostsze, dobre do testów).
- **B. Zajęty węzeł** — nie wolno skończyć ruchu na węźle zajętym przez rywala; przecięcie
  cudzej świeżej kreski (z tej samej tury) = kolizja i upadek obu. To daje blokowanie i walkę o linię.
- **C. Pełny kontakt** — każde przecięcie cudzego śladu = kolizja (najostrzejsze, najbliżej papieru).

### 2.5 Okrążenia i meta

Tor ma zdefiniowaną **linię startu/mety** oraz 3–4 **sektory kontrolne**. Okrążenie liczy się
tylko wtedy, gdy zawodnik przekroczył kolejno wszystkie sektory (to blokuje oszustwo polegające
na kręceniu się przy linii mety). Bieg = 4 okrążenia.

### 2.6 Kolejność tur

Domyślnie: **sekwencyjnie**, kolejność wg aktualnej pozycji w wyścigu (prowadzący pierwszy).
Wariant „jednoczesny” (wszyscy deklarują ruch, potem rozstrzygnięcie) trzymamy jako opcję —
jest uczciwszy przy kolizjach, ale wymaga zasad rozstrzygania remisów. **[DO POTWIERDZENIA]**

### 2.7 Punktacja żużlowa

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
    types.ts         # Vec2, RiderState, RaceState, TrackData, Move
    geometry.ts      # przecięcia odcinków, punkt-w-wielokącie, odległości
    track.ts         # ładowanie toru, sektory, oś toru (centerline), progress()
    rules.ts         # legalMoves(), applyMove(), kolizje, upadki
    race.ts          # maszyna stanów biegu: START → RUNNING → FINISHED
    scoring.ts       # punktacja biegu / meczu / ligi
    replay.ts        # zapis i odtwarzanie listy ruchów
  ai/
    evaluate.ts      # funkcja oceny pozycji
    bot.ts           # greedy + przeszukiwanie w głąb
  render/
    canvas.ts        # rysowanie toru, siatki, kresek, zawodników
    camera.ts        # skala, przesunięcie, dopasowanie do ekranu
    animate.ts       # animacja przejazdu kreski
  ui/
    controls.ts      # klawiatura (numpad/strzałki), myszka, dotyk
    hud.ts           # okrążenia, prędkość, kolejność, punkty
    screens.ts       # menu, wybór toru, wyniki
  tracks/            # tory w JSON
  main.ts
docs/                # ten plan, zasady, format toru
tests/               # testy silnika + „złote” powtórki
```

**Zasada przewodnia:** `RaceState` jest niemutowalny, `applyMove(state, move) → newState` jest
czystą funkcją. Dzięki temu za darmo dostajemy: cofanie ruchu, powtórki, testy migawkowe,
podgląd „co się stanie, jak tu pojadę”, oraz AI, które może symulować przyszłość.

---

## 5. Kluczowe algorytmy

### 5.1 Legalne ruchy

```ts
function legalMoves(state: RaceState, riderId: number): Move[] {
  // 9 kandydatów a ∈ {-1,0,1}²
  // odfiltruj: przekroczenie V_MAX, jazda pod prąd, kolizja z rywalem
  // NIE filtruj wyjazdu poza bandę — to legalny (głupi) ruch kończący się upadkiem,
  // ale oznacz go flagą `crash: true`, żeby UI mógł go pokazać na czerwono
}
```

### 5.2 Wykrywanie bandy

Banda = polilinia (zamknięty wielokąt) zewnętrzna + wewnętrzna. Dla ruchu `p → p'`:

1. test przecięcia odcinka z każdym segmentem obu polilinii (klasyczny test orientacji CCW),
2. przyspieszenie przez **grid bucketing** — segmenty band w kubełkach siatki, sprawdzamy tylko
   kubełki na trasie odcinka (Bresenham). Przy torze rzędu 200 segmentów i tak byłoby szybko,
   ale przy 4 zawodnikach × 9 podglądów × animacja warto to mieć od razu.

### 5.3 Postęp na torze (`progress`)

Tor ma wyliczoną **oś** (centerline) jako listę punktów z narastającą długością łuku.
`progress(p)` = najbliższy punkt osi → dystans wzdłuż toru. Używane przez:
sortowanie kolejności, licznik okrążeń (razem z sektorami) i funkcję oceny AI.

### 5.4 Meta

Przecięcie odcinka ruchu z segmentem linii mety, we właściwym kierunku (znak iloczynu
wektorowego), przy komplecie zaliczonych sektorów. Zapisujemy ułamkową pozycję przecięcia,
żeby rozstrzygać, kto był pierwszy w tej samej turze.

---

## 6. Format toru i edytor

Tor jako JSON (szczegóły: `docs/TRACK_FORMAT.md`):

```json
{
  "name": "Motoarena",
  "grid": { "width": 80, "height": 50 },
  "outer": [[4,4],[76,4],[76,46],[4,46]],
  "inner": [[20,14],[60,14],[60,36],[20,36]],
  "direction": "ccw",
  "startLine": [[40,4],[40,14]],
  "startPositions": [[38,6],[38,8],[38,10],[38,12]],
  "sectors": [ [[76,25],[60,25]], [[40,46],[40,36]], [[4,25],[20,25]] ],
  "laps": 4
}
```

Bandy jako wielokąty (nie tylko owale) pozwalają robić dziwne tory — a to jest pół zabawy.

**Edytor torów** (etap M5): klikanie po siatce, rysowanie band, stawianie linii mety i sektorów,
walidacja (czy tor jest zamknięty, czy oś się liczy, czy da się przejechać), eksport/import JSON.
Bez edytora zostaniemy przy 2–3 torach i to zabije żywotność gry.

---

## 7. AI przeciwnika

Trzy poziomy, ten sam interfejs `chooseMove(state, riderId): Move`:

1. **Nowicjusz** — greedy: spośród legalnych ruchów bierz ten o największym `progress`,
   odrzucając te, po których nie istnieje żaden bezpieczny ruch w następnej turze
   (to jedno sprawdzenie w przód likwiduje 90% głupich upadków).
2. **Zawodowiec** — przeszukiwanie w głąb 3–5 tur (beam search, szerokość ~20),
   ocena = `progress − ryzyko − kara za bliskość bandy`.
3. **Mistrz** — jak wyżej + wcześniej policzona *linia idealna* (racing line) i zachowania
   taktyczne: krycie wewnętrznej, blokowanie na łuku, spóźnione hamowanie przy wyprzedzaniu.

Ponieważ silnik jest czystą funkcją, AI symuluje wprost na `RaceState` — nie ma potrzeby
pisania osobnego modelu świata.

---

## 8. UI/UX

- **Siatka + tor** rysowane jak na kartce: cienka kratka, grube bandy, kreski w kolorach kasków.
- **Podgląd ruchu:** 9 kandydatów jako kropki; zielone = bezpieczne, żółte = ryzykowne
  (brak bezpiecznej kontynuacji), czerwone = upadek. To najważniejszy element czytelności gry.
- **Sterowanie:** numpad 1–9 / strzałki + Enter, klik myszką w kropkę, tap na mobile.
- **HUD:** okrążenie, prędkość, kolejność, punkty, kto ma turę.
- **Animacja** przejazdu kreski (~200 ms) + ślad; wyłączalna dla szybkiej gry.
- **Powtórka** po biegu ze suwakiem.
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
| **M0** | Fundament | Vite + TS + Vitest + ESLint, CI, szkielet katalogów, deploy pustej strony | pipeline zielony, strona wstaje | 1 sesja |
| **M1** | Silnik ruchu | `types`, `geometry`, `track`, `rules.legalMoves/applyMove`, format toru, 1 tor testowy | testy jednostkowe ruchu, bandy i sektorów przechodzą (bez UI) | 1–2 sesje |
| **M2** | Grywalny hot-seat | render toru i kresek, podgląd 9 ruchów, sterowanie, licznik okrążeń, meta | da się przejechać 4 okrążenia w 2 osoby | 2 sesje |
| **M3** | Zasady żużlowe | upadki i kary, kolizje (warianty A/B/C), procedura startu, punktacja biegu | bieg kończy się tabelką 3-2-1-0 | 1–2 sesje |
| **M4** | AI | 3 poziomy botów, dobór składu biegu | bot na poziomie „zawodowiec” kończy bieg bez upadku | 2 sesje |
| **M5** | Edytor torów | rysowanie band, sektory, walidacja, import/eksport, 4–6 torów | tor narysowany w edytorze da się przejechać | 2 sesje |
| **M6** | Mecz i liga | program 15 biegów, protokół, tabela, zapis stanu | rozegrany pełny mecz z podsumowaniem | 2 sesje |
| **M7** | Szlify | animacje, dźwięki, mobile, powtórki, ustawienia, samouczek | gra jest przyjemna dla kogoś, kto widzi ją pierwszy raz | 1–2 sesje |
| **M8** | Online (opcja) | serwer WS lub gra korespondencyjna | dwie osoby grają z dwóch komputerów | 3+ sesje |

Ścieżka do „gra się fajnie”: **M0 → M1 → M2 → M3 → M4**. Reszta to rozbudowa.

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

## 13. Decyzje do potwierdzenia przed M1

1. **Model ruchu:** klasyczne wektory na kratce (jak wyżej) czy sterowanie w czasie rzeczywistym
   dwoma klawiszami (lewo/prawo), jak w niektórych wersjach *Żużla 2001*?
2. **Kolizje:** wariant A / B / C z punktu 2.4.
3. **Limit prędkości:** czy w oryginale, który pamiętasz, był jakiś sufit prędkości?
4. **Upadek:** kara w turach czy wykluczenie z biegu?
5. **Kolejność tur:** sekwencyjna czy jednoczesna deklaracja ruchów?

Jeśli masz zrzuty ekranu, pliki torów albo pamiętasz konkretne szczegóły z kreski.org —
to najszybszy sposób, żeby dopasować grę do wspomnienia zamiast do mojej rekonstrukcji.
