import json
import random

rng = random.Random(301)
BIG = 10**9


def case(a, qs):
    n = len(a)
    assert 1 <= n <= 100000 and 1 <= len(qs) <= 100000
    assert all(0 <= x <= BIG for x in a) and all(1 <= l <= r <= n for l, r in qs)
    return f"{n} {len(qs)}\n{' '.join(map(str, a))}\n" + "".join(f"{l} {r}\n" for l, r in qs)


def rand_q(n, q):
    out = []
    for _ in range(q):
        l = rng.randint(1, n)
        out.append((l, rng.randint(l, n)))
    return out


# The biggest case that fits the storage budget. Questions span almost the whole
# log, so adding up each range one reading at a time does about 140 million additions.
n, q = 26000, 5500
big_a = [rng.randint(0, 99) for _ in range(n)]
big_q = [(rng.randint(1, 100), rng.randint(n - 100, n)) for _ in range(q)]

mid_a = [rng.randint(0, BIG) for _ in range(500)]
cases = [
    case([3, 1, 4, 1, 5], [(1, 3), (2, 5), (4, 4)]),  # sample
    case([7], [(1, 1)]),
    case([0, 0, 0], [(1, 3), (2, 2)]),
    case([BIG] * 5, [(1, 5), (2, 4), (5, 5)]),  # 5,000,000,000 overflows a 32-bit int
    case([rng.randint(0, 100) for _ in range(100)], [(i, i) for i in range(1, 101)]),
    case([rng.randint(0, 100) for _ in range(100)], [(1, 100)] * 20 + rand_q(100, 80)),
    case(mid_a, rand_q(500, 500)),
    case([BIG] * 300, [(1, 300), (1, 1), (100, 300)]),  # 300,000,000,000
    case(big_a, big_q),
]
fuzz = []
for _ in range(40):
    m = rng.randint(1, 12)
    fuzz.append(case([rng.randint(0, 20) for _ in range(m)], rand_q(m, rng.randint(1, 8))))
print(json.dumps({"cases": cases, "fuzz": fuzz}))
