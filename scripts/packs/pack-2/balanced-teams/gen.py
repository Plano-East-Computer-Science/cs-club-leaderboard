import json
import random

rng = random.Random(406)
M = 1000000


def case(r):
    assert 2 <= len(r) <= 1000 and len(r) % 2 == 0 and all(1 <= x <= M for x in r)
    return f"{len(r)}\n{' '.join(map(str, r))}\n"


cases = [
    case([1, 9, 3, 7]),  # sample 1: 10
    case([5, 1, 2, 8, 4, 6]),  # sample 2: 9
    case([4, 4]),
    case([1, 2, 3, 4, 5, 6, 7, 8]),  # already sorted
    case([8, 7, 6, 5, 4, 3, 2, 1, 100, 1]),
    case([10] * 50),
    case([1, 1, 1, 1, 1, 1000, 1000, 1000]),  # two heavy runners must share a pair: 2000
    case([M] * 1000),  # 2,000,000
    case([rng.randint(1, M) for _ in range(1000)]),
    case([rng.randint(1, 100) for _ in range(998)]),
]
fuzz = []
for _ in range(60):
    n = rng.choice([2, 4, 6, 8, 10])
    fuzz.append(case([rng.randint(1, 20) for _ in range(n)]))
print(json.dumps({"cases": cases, "fuzz": fuzz}))
