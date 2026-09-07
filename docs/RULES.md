# Zasady gry — specyfikacja robocza (v0.4 — fizyka bez hamulca)

Zmiana względem v0.1: mechanika **nie jest turowa**. Zawodnik jedzie sam do przodu,
gracz steruje wyłącznie kierunkiem (lewo/prawo), jak w klasycznym *Żużlu 2001*.
Prędkość jest pochodną fizyki — gaz jest automatyczny, karą za zbyt ostry skręt
przy dużej prędkości jest utrata przyczepności (wypadnięcie za bandę).

Zmiana względem v0.2: motocykl żużlowy jeździ **bez hamulców** i pokonuje łuki
**bokiem** (broadside/poślizg) — to osobno modelowane, nie tylko sugerowane
przez spowolnienie w zakręcie. Zawodnik ma kształt wydłużonej kapsuły (motocykl +
kierowca), nie kulki — kolizje i wygląd to odzwierciedlają.

Zmiana względem v0.3: usunięty sztuczny „cel prędkości” (`cornerSpeed`), do którego
zawodnik doskakiwał natychmiast po dotknięciu kierunku — motocykl żużlowy **fizycznie
nie ma hamulca**, więc nie powinien mieć też jego ukrytego odpowiednika w kodzie.
Spowolnienie w zakręcie to teraz **opór od poślizgu**: ciągły, proporcjonalny do
bieżącej prędkości i do tego, jak bardzo motocykl się aktualnie ślizga — patrz §4.

## 1. Tor

Na etapie M1–M2 tor jest **owalny, parametryczny** (dwie proste + dwa łuki, jak realny tor
żużlowy), zdefiniowany trzema liczbami: długość prostej, promień łuku, szerokość toru.
Dzięki temu pozycja zawodnika na torze (`s` — dystans wzdłuż osi, `offset` — odchylenie
w bok od osi) liczy się analitycznie, bez ciężkiej geometrii wielokątów. Dowolne tory
(niekoniecznie owalne) wracają w etapie M5 wraz z edytorem — wtedy przechodzimy na
reprezentację z siatką segmentów, opisaną w `TRACK_FORMAT.md`.

## 2. Zawodnik — stan

```
position:      Vec2    // pozycja w świecie (metry/jednostki)
heading:       number  // orientacja NADWOZIA motocykla (rysowanie, hitbox)
velocityAngle: number  // FAKTYCZNY kierunek jazdy (napędza position)
speed:         number  // prędkość skalarna, jednostki/s
```

`heading` i `velocityAngle` to dwa różne kąty — patrz §4. Gdy zawodnik jedzie prosto,
są sobie równe; w zakręcie przy prędkości rozjeżdżają się (poślizg).

## 3. Sterowanie

Jedyny input gracza w każdej klatce: `steer ∈ {-1, 0, 1}` (skręt w lewo / prosto / w prawo).
Gaz jest automatyczny i **nie ma hamulca** — nie ma żadnego inputu do zwalniania.
Jedyny sposób, żeby zwolnić przed łukiem, to zacząć skręcać wcześniej i dać poślizgowi
(§4) zrobić swoje, zanim dojedziesz do zakrętu.

## 4. Fizyka (krok o stałym `dt`)

```
grip            = gripAt(speed)                    // maleje z prędkością
angularVelocity = steer * TURN_RATE * grip
velocityAngle  += angularVelocity * dt              // to jest FIZYCZNY tor jazdy

slipAngle       = steer * MAX_SLIP_ANGLE * (1 - grip)
heading         = velocityAngle + slipAngle          // nadwozie, tylko do rysowania/hitboxa

accelerated     = min(MAX_SPEED, speed + ACCEL * dt) // silnik zawsze ciągnie w górę
dragRate        = CORNERING_DRAG * |slipAngle|        // 1/s, opór od poślizgu
speed           = max(0, accelerated * (1 - dragRate * dt))

position       += (cos(velocityAngle), sin(velocityAngle)) * speed * dt
```

- **`velocityAngle` jest jedynym kątem, który napędza pozycję.**
- **`heading` jest pochodną**, używaną tylko do rysowania motocykla i orientacji jego
  hitboxa (§6). Odchyla się od `velocityAngle` o `slipAngle`, który rośnie z prędkością
  (mniejszy `grip`) — to jest wizualny **broadside**: motocykl żużlowy jeździ bez hamulca,
  więc w szybkim zakręcie tylne koło się ślizga, a nadwozie jest odchylone od
  faktycznego toru jazdy. Przy `steer = 0` (jazda na wprost) `slipAngle = 0` — poślizg
  pojawia się tylko podczas aktywnego skręcania, nie w każdej chwili.
- `grip(speed)` maleje z prędkością — przy dużej prędkości skręt jest wolniejszy (opór
  przyczepności).
- **Nie ma osobnego „celu prędkości” w zakręcie.** Silnik zawsze ciągnie w stronę
  `MAX_SPEED` (`accelerated`); jedyne, co realnie zwalnia, to `dragRate` — tarcie zużyte
  na boczne przytrzymanie toru zamiast na napęd do przodu, proporcjonalne do tego, jak
  bardzo motocykl się aktualnie ślizga (`|slipAngle|`) **i** do bieżącej prędkości
  (`speed` we wzorze na nową `speed`). Konsekwencje:
  - spowolnienie jest **stopniowe**, nie skokiem do stałej wartości — bardzo rozpędzony
    motocykl ma więcej pędu do rozproszenia, więc zjeżdża z prędkości wolniej niż
    motocykl, który wjechał w zakręt już wolniej;
  - przy dostatecznie niskiej prędkości (mały `slipAngle`, bo duży `grip`) opór jest
    słabszy niż `ACCEL` — motocykl może więc **przyspieszać w trakcie skręcania**, jeśli
    jedzie dość wolno; nie ma sztywnej „prędkości zakrętowej”, tylko punkt równowagi
    między napędem a poślizgiem, zależny od `TURN_RATE`, `grip` i `CORNERING_DRAG`;
  - jazda na pełnym gazie w ostrym łuku wciąż jest niemożliwa do utrzymania w granicach
    toru — kto nie zacznie skręcać (a więc i zwalniać) dość wcześnie, wypada.
- Wszystkie stałe (`TURN_RATE`, `MAX_SPEED`, `ACCEL`, `MAX_SLIP_ANGLE`,
  `CORNERING_DRAG`, szerokość toru) w jednym miejscu (`engine/config.ts`) — do strojenia.
  **[do wyważenia po pierwszych testach z Tobą]**

## 5. Banda i upadek

Po każdym kroku liczymy `(s, offset)` = pozycja zawodnika (środek kapsuły) względem osi
toru. Jeśli `|offset| > szerokość/2` → zawodnik jest za bandą → **upadek**.

Każdy upadek (za bandę **lub** przez kolizję, §6) robi to samo:
1. prędkość spada do 0 na `CRASH_PENALTY` sekund (domyślnie 1,5 s),
2. **`heading` i `velocityAngle` są ustawiane z powrotem na styczną toru** w bieżącym `s` —
   zawodnik wstaje zwrócony wzdłuż toru, nie pod przypadkowym kątem sprzed upadku.
   Bez tego (2) zawodnik wybudzony z kary jechałby dalej pod tym samym złym kątem, aż
   prędzej czy później znów by wypadł, w kółko — z zewnątrz wyglądałoby to jak
   utknięcie w miejscu na resztę biegu, mimo że technicznie to ciąg osobnych upadków,
3. przy upadku za bandę dodatkowo: boczne odchylenie jest przycinane z powrotem do
   legalnego zakresu (zawodnik wraca na powierzchnię toru).

## 6. Kolizje

Zawodnik to nie kulka, tylko **kapsuła**: odcinek nos–ogon o długości `riderLength`
wzdłuż `heading`, otoczony promieniem `riderWidth / 2`. Dwaj zawodnicy zderzają się,
gdy najkrótsza odległość między ich odcinkami spadnie poniżej sumy promieni (czyli
`riderWidth`, gdy oba mają tę samą szerokość) — **nie** gdy środki są blisko. Konsekwencja:
jadąc równolegle blisko obok siebie można się bezpiecznie minąć (wąska kapsuła), ale
najechanie na tył kogoś wymaga więcej zapasu wzdłuż toru (długa kapsuła) — inaczej niż
przy okrągłym hitboksie, gdzie kierunek zbliżenia nie miał znaczenia.

Przy kolizji: obaj tracą prędkość jak przy upadku (§5, punkty 1–2), a ich pozycje są
natychmiast rozsuwane na dokładnie minimalną odległość wzdłuż linii łączącej najbliższe
punkty kapsuł (żeby dwaj zawodnicy stojący w miejscu nie zostali nakładający się na
zawsze). Dodatkowo każdy upadek daje krótkie okno **nietykalności na nową kolizję**
(`COLLISION_IMMUNITY` sekund, domyślnie 0,5 s, licząc od końca kary ruchowej) — zawodnik,
który właśnie wstał tuż obok kogoś, ma realny czas żeby odjechać, zanim znowu może dostać
karę za kolizję. Bez tego dwaj zawodnicy potrafili wymieniać się karami do końca biegu.

Wariant „duchy” (bez kolizji) dostępny jako opcja konfiguracji do testów.

## 7. Okrążenia i meta

Tor podzielony na 4 ćwiartki (sektory) wg `s`. Okrążenie liczy się, gdy zawodnik
przejdzie sektory w kolejności `0 → 1 → 2 → 3 → 0`. Bieg trwa `LAPS` okrążeń (domyślnie 4).
Kolejność zawodników w wyścigu = `lap * totalLength + s`, malejąco.

## 8. Sterowanie w hot-seat

| Zawodnik | Lewo | Prawo |
|---|---|---|
| Gracz 1 | Strzałka w lewo | Strzałka w prawo |
| Gracz 2 | A | D |

Pozostałe miejsca w biegu wypełnia AI (patrz `ai/bot.ts`).

## 9. Punktacja

Bez zmian względem v0.1: bieg 3/2/1/0, mecz 15 biegów, liga 2/1/0 pkt za mecz.

## 10. Parametry konfiguracyjne (`RaceConfig`)

```ts
interface RaceConfig {
  laps: number;             // 4
  maxSpeed: number;         // jednostki/s — jedyny "cel" prędkości, bez hamulca
  accel: number;
  turnRate: number;         // rad/s przy steer=1, grip=1
  minGrip: number;
  gripSpeedFalloff: number;
  maxSlipAngle: number;     // rad, kąt poślizgu (heading vs velocityAngle) przy grip=0
  corneringDrag: number;    // 1/(s·rad), opór od poślizgu — jedyne źródło zwolnienia
  crashPenaltySeconds: number;    // 1.5
  collisionImmunitySeconds: number; // 0.5, ponad crashPenaltySeconds
  collisionMode: 'ghost' | 'solid';
  riderLength: number;      // pełna długość kapsuły (nos–ogon)
  riderWidth: number;       // pełna szerokość kapsuły
}
```
