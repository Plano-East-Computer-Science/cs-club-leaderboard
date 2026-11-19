import json
import random

rng = random.Random(203)
M = 1000000


def case(k, cards):
    assert 2 <= len(cards) <= 2000 and all(-M <= c <= M for c in cards) and -2 * M <= k <= 2 * M
    return f"{len(cards)} {k}\n{' '.join(map(str, cards))}\n"


wide = [rng.randint(-M, M) for _ in range(2000)]
mixed = [3] * 1000 + [7] * 1000
rng.shuffle(mixed)
cases = [
    case(4, [2, 2, 2, 1, 3, 0]),  # sample: three pairs of 2s and 1 + 3
    case(5, [2, 3]),
    case(5, [2, 2]),
    case(0, [-3, 3, 0, 0, -3]),
    case(-2 * M, [-M, -M, 5]),
    case(2 * M, [M, 17, M, -M]),
    case(14, [7] * 2000),  # every pair: 1,999,000
    case(10, mixed),  # 1,000,000
    case(rng.randint(-20, 20), [rng.randint(-50, 50) for _ in range(2000)]),
    case(wide[10] + wide[1500], wide),
]
fuzz = []
for _ in range(60):
    n = rng.randint(2, 12)
    fuzz.append(case(rng.randint(-6, 6), [rng.randint(-4, 4) for _ in range(n)]))
print(json.dumps({"cases": cases, "fuzz": fuzz}))
