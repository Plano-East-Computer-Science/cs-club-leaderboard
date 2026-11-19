import json
import random

rng = random.Random(502)


def case(n, rules):
    assert 1 <= n <= 8000 and 0 <= len(rules) <= 8000
    assert all(1 <= a <= n and 1 <= b <= n and a != b for a, b in rules)
    assert len(set(rules)) == len(rules)
    return f"{n} {len(rules)}\n" + "".join(f"{a} {b}\n" for a, b in rules)


def dag(n, m):
    """Random rules that can all be met: a hidden ranking, rules only point down it."""
    rank = list(range(1, n + 1))
    rng.shuffle(rank)
    rules = set()
    while len(rules) < m:
        i, j = rng.sample(range(n), 2)
        if i > j:
            i, j = j, i
        rules.add((rank[i], rank[j]))
    rules = list(rules)
    rng.shuffle(rules)
    return rules


chain = [(i + 1, i) for i in range(1, 2000)]  # 2000 before 1999 before ... before 1
rng.shuffle(chain)
looped = dag(2000, 2500)
looped.append((looped[0][1], looped[0][0]))  # one rule backwards makes a loop
cases = [
    case(4, [(2, 1), (3, 1), (2, 4)]),  # sample 1: 2 3 1 4
    case(3, [(1, 2), (2, 3), (3, 1)]),  # sample 2: IMPOSSIBLE
    case(1, []),
    case(5, []),  # no rules: 1 2 3 4 5
    case(2, [(1, 2), (2, 1)]),
    case(6, [(1, 2), (2, 3), (3, 2), (4, 5)]),  # some courses can be taken, then stuck
    case(5, [(5, 4), (5, 3), (4, 1), (3, 1), (2, 1)]),  # lowest-numbered first, not first found
    case(2000, chain),  # 2000 1999 ... 1
    case(2000, looped),
    case(8000, dag(8000, 8000)),
]
fuzz = []
for _ in range(80):
    n = rng.randint(1, 7)
    m = rng.randint(0, min(10, n * (n - 1)))
    pairs = [(a, b) for a in range(1, n + 1) for b in range(1, n + 1) if a != b]
    fuzz.append(case(n, rng.sample(pairs, m)))
print(json.dumps({"cases": cases, "fuzz": fuzz}))
