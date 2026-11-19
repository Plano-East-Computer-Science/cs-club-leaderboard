import json
import random

rng = random.Random(302)
BIG = 10**9


def case(meetings):
    assert 1 <= len(meetings) <= 100000 and all(0 <= s < e <= BIG for s, e in meetings)
    return f"{len(meetings)}\n" + "".join(f"{s} {e}\n" for s, e in meetings)


def rand(n, top, longest):
    out = []
    for _ in range(n):
        s = rng.randint(0, top - 1)
        out.append((s, min(top, s + rng.randint(1, longest))))
    return out


chain = [(10 * i, 10 * i + 10) for i in range(500)]  # back to back: one room
rng.shuffle(chain)
handoff = [(t, t + 5) for t in range(0, 1000, 5)] + [(t, t + 5) for t in range(0, 1000, 5)]  # two rooms
rng.shuffle(handoff)
cases = [
    case([(0, 30), (5, 10), (15, 20)]),  # sample 1: 2
    case([(10, 20), (20, 30)]),  # sample 2: ends at 20, starts at 20, so 1
    case([(0, 1)]),
    case([(5, 10)] * 1000),  # all at once: 1000
    case([(0, 100), (10, 90), (20, 80), (30, 70), (40, 60)]),  # nested: 5
    case(chain),
    case(handoff),
    case([(0, BIG), (BIG - 1, BIG), (0, 1), (1, BIG - 1)]),  # far apart times
    case(rand(2000, BIG, BIG // 50)),
    case(rand(9000, 1000000, 2000)),  # biggest that fits the storage budget
]
fuzz = [case(rand(rng.randint(1, 10), 30, 12)) for _ in range(80)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
