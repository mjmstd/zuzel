# Zasady gry — specyfikacja robocza

Wersja 0.1 — projekt do zatwierdzenia. Wszystko, co oznaczone **[?]**, wymaga potwierdzenia
z oryginałem (kreski.org / Żużel 2001).

## 1. Plansza

Tor narysowany na siatce całkowitoliczbowej. Dwie bandy: zewnętrzna i wewnętrzna (krawężnik).
Jazda odbywa się między nimi, w kierunku przeciwnym do ruchu wskazówek zegara (jak w żużlu).

## 2. Zawodnik

Stan zawodnika: pozycja `p = (x, y)` w węźle siatki oraz prędkość `v = (vx, vy)`.
Na starcie `p` = pole startowe, `v = (0, 0)`.

## 3. Ruch

W swojej turze zawodnik wybiera przyspieszenie `a = (ax, ay)`, gdzie `ax, ay ∈ {-1, 0, 1}`.

```
v_nowe = v + a
p_nowe = p + v_nowe
```

Na planszy rysowany jest odcinek („kreska”) od `p` do `p_nowe`. Zawodnik ma więc do wyboru
maksymalnie 9 pól — pole „na wprost” (kontynuacja z tą samą prędkością) i 8 sąsiednich.

**Ograniczenia:**

- `|v| ≤ V_MAX`, domyślnie 6 **[?]**
- ruch musi mieć dodatni rzut na kierunek toru w bieżącym sektorze (zakaz jazdy pod prąd)
- `v = (0,0)` dopuszczalne wyłącznie na starcie i po upadku

## 4. Banda

Kreska nie może przeciąć żadnej z band, a jej koniec musi leżeć na torze.
Naruszenie = **upadek**.

**Upadek** (wariant domyślny): zawodnik wraca na ostatnią legalną pozycję, `v := 0`,
traci 2 tury. Wariant alternatywny: wykluczenie z biegu (0 punktów). **[?]**

## 5. Kolizje

Wariant domyślny (**B**):

- nie wolno zakończyć ruchu w węźle zajętym przez innego zawodnika,
- przecięcie kreski postawionej w tej samej turze przez innego zawodnika = kolizja,
  obaj upadają.

Warianty alternatywne: **A** (brak kolizji) i **C** (kolizja z każdym śladem, także starym). **[?]**

## 6. Okrążenia i meta

Tor ma linię startu/mety oraz 3 sektory kontrolne. Okrążenie zalicza się po przekroczeniu
linii mety we właściwym kierunku, pod warunkiem wcześniejszego zaliczenia wszystkich sektorów.
Bieg trwa 4 okrążenia.

Gdy dwóch zawodników przekroczy metę w tej samej turze, decyduje ułamkowa pozycja
przecięcia odcinka z linią mety (kto był „dalej”).

## 7. Kolejność

Sekwencyjna: w każdej turze ruszają się kolejno wszyscy zawodnicy, w kolejności aktualnej
pozycji w wyścigu (prowadzący pierwszy). **[?]**

## 8. Punktacja

- Bieg: **3 / 2 / 1 / 0** punktów za miejsca 1–4. Upadek lub niedojechanie = 0.
- Mecz: 15 biegów wg klasycznego programu par startowych, wygrywa drużyna z większą sumą punktów.
- Liga: 2 punkty za wygrany mecz, 1 za remis, 0 za porażkę; przy równości decyduje bilans małych punktów.

## 9. Parametry konfiguracyjne

Wszystkie liczby powyżej trzymamy w jednym obiekcie `RaceConfig`, żeby dało się je stroić
bez ruszania logiki:

```ts
interface RaceConfig {
  maxSpeed: number;          // 6
  laps: number;              // 4
  crashPenaltyTurns: number; // 2
  crashMode: 'penalty' | 'exclusion';
  collisionMode: 'ghost' | 'node' | 'full';
  turnOrder: 'sequential' | 'simultaneous';
  allowReverse: boolean;     // false
}
```
