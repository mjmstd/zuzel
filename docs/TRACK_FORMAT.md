# Format toru (JSON)

```jsonc
{
  "name": "Motoarena",
  "author": "mjmstd",
  "grid": { "width": 80, "height": 50 },   // rozmiar planszy w kratkach

  "outer": [[4,4], [76,4], [76,46], [4,46]],      // banda zewnętrzna (wielokąt zamknięty)
  "inner": [[20,14], [60,14], [60,36], [20,36]],  // krawężnik (wielokąt zamknięty)

  "direction": "ccw",                       // kierunek jazdy: ccw | cw
  "laps": 4,

  "startLine": [[40,4], [40,14]],           // odcinek linii startu/mety
  "startPositions": [                       // pola startowe (kolejność = numery startowe)
    [38,6], [38,8], [38,10], [38,12]
  ],

  "sectors": [                              // odcinki kontrolne, w kolejności przejazdu
    [[76,25], [60,25]],
    [[40,46], [40,36]],
    [[4,25],  [20,25]]
  ]
}
```

## Walidacja toru (`validateTrack`)

Tor jest poprawny, gdy:

1. `outer` i `inner` to wielokąty proste (bez samoprzecięć) o co najmniej 4 wierzchołkach,
2. `inner` leży w całości wewnątrz `outer`,
3. każde `startPositions[i]` leży na torze (między bandami),
4. `startLine` i każdy sektor łączą bandę zewnętrzną z wewnętrzną (przecinają cały tor),
5. sektory są podane w kolejności zgodnej z `direction`,
6. oś toru (centerline) da się wyliczyć i jest zamkniętą pętlą.

Walidator uruchamiamy w edytorze na żywo i w testach dla wszystkich torów w `src/tracks/`.

## Oś toru (centerline)

Liczona automatycznie przy ładowaniu: próbkujemy tor promieniami od środka geometrycznego,
bierzemy punkty w połowie odległości między bandami, wygładzamy, zapisujemy narastającą
długość łuku. Służy do: sortowania kolejności, liczenia postępu i oceny pozycji przez AI.
