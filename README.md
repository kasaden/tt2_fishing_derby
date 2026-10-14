# tt2_fishing_derby
opti fishing derby rewards

## Measurements

Measured on 2026-10-14 on the development PC (Node v22.20.0) with `node scripts/bench.js`. Lengths are the estimated final total length; times are wall-clock.

Test-only bases (not game values): daily limit base 100, Tacklebox base capacity 10.
Start: every upgrade at its minimum level, 0 coins, 20 lures, 0 length. Portfolio deadline: 2000 ms.

| Case | First plan (lookahead 1) | Lookahead 3 | Beam 30 | Improved lookahead 3 | Portfolio within deadline |
| --- | --- | --- | --- | --- | --- |
| 72 h, 10 prestiges and 6 visits a day | 8,426 in 36 ms | 8,873 in 756 ms | 13,310 in 577 ms | 9,105 in 807 ms | 13,554 in 2,005 ms |
| 168 h, 10 prestiges and 6 visits a day | 44,217 in 77 ms | 45,933 in 2,399 ms | 46,105 in 1,220 ms | 47,435 in 5,296 ms | 46,878 in 2,001 ms |
| 168 h, 20 prestiges and 12 visits a day | 58,890 in 62 ms | 61,189 in 4,310 ms | 60,567 in 2,169 ms | 62,324 in 3,736 ms | 60,640 in 2,002 ms |

The single-method columns run without a deadline. Within its 2-second deadline the portfolio beats every method that finishes in that time; methods given 3.7 to 5.3 seconds still find up to 2.7 % more on the 168-hour cases.
