# Zasady gry — specyfikacja robocza (v0.2 — model real-time)

Zmiana względem v0.1: mechanika **nie jest turowa**. Zawodnik jedzie sam do przodu,
gracz steruje wyłącznie kierunkiem (lewo/prawo), jak w klasycznym *Żużlu 2001*.
Prędkość jest pochodną fizyki — gaz jest automatyczny, karą za zbyt ostry skręt
przy dużej prędkości jest utrata przyczepności (wypadnięcie za bandę).

## 1. Tor

Na etapie M1–M2 tor jest **owalny, parametryczny** (dwie proste + dwa łuki, jak realny tor
żużlowy), zdefiniowany trzema liczbami: długość prostej, promień łuku, szerokość toru.
Dzięki temu pozycja zawodnika na torze (`s` — dystans wzdłuż osi, `offset` — odchylenie
w bok od osi) liczy się analitycznie, bez ciężkiej geometrii wielokątów. Dowolne tory
(niekoniecznie owalne) wracają w etapie M5 wraz z edytorem — wtedy przechodzimy na
reprezentację z siatką segmentów, opisaną w `TRACK_FORMAT.md`.

## 2. Zawodnik — stan

```
position: Vec2       // pozycja w świecie (metry/jednostki)
heading:  number      // kąt jazdy, radiany
speed:    number       // prędkość skalarna, jednostki/s
```

## 3. Sterowanie

Jedyny input gracza w każdej klatce: `steer ∈ {-1, 0, 1}` (skręt w lewo / prosto / w prawo).
Gaz jest automatyczny — silnik zawsze „ciągnie” w stronę prędkości maksymalnej.

## 4. Fizyka (krok o stałym `dt`)

```
angularVelocity = steer * TURN_RATE * grip(speed)
heading        += angularVelocity * dt

targetSpeed     = steer != 0 ? CORNER_SPEED : MAX_SPEED
speed           = approach(speed, targetSpeed, ACCEL, BRAKE, dt)

velocity        = (cos(heading), sin(heading)) * speed
position        += velocity * dt
```

- `grip(speed)` maleje z prędkością — przy dużej prędkości skręt jest wolniejszy (opór
  przyczepności), co wymusza wcześniejsze „ściąganie” przed łukiem, tak jak w oryginale.
- `CORNER_SPEED < MAX_SPEED` — jazda na pełnym gazie w skręcie jest niemożliwa do
  utrzymania w granicach toru; kto nie zwolni, wypada.
- Wszystkie stałe (`TURN_RATE`, `MAX_SPEED`, `CORNER_SPEED`, `ACCEL`, `BRAKE`,
  szerokość toru) w jednym miejscu (`engine/config.ts`) — do strojenia. **[do wyważenia
  po pierwszych testach z Tobą]**

## 5. Banda i upadek

Po każdym kroku liczymy `(s, offset)` = pozycja zawodnika względem osi toru.
Jeśli `|offset| > szerokość/2` → zawodnik jest za bandą → **upadek**:
prędkość spada do 0, zawodnik traci `CRASH_PENALTY` sekund (domyślnie 1,5 s) zanim
znów może przyspieszać, wraca na ostatnią pozycję na torze.

## 6. Kolizje

Jeśli odległość między dwoma zawodnikami spadnie poniżej `2 × promień_zawodnika`
→ kolizja: obaj tracą prędkość (jak przy upadku). Wariant „duchy” (bez kolizji)
dostępny jako opcja konfiguracji do testów.

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
  maxSpeed: number;         // jednostki/s
  cornerSpeed: number;      // < maxSpeed
  accel: number;
  brake: number;
  turnRate: number;         // rad/s przy steer=1, prędkość=0
  crashPenaltySeconds: number; // 1.5
  collisionMode: 'ghost' | 'solid';
  riderRadius: number;
}
```
