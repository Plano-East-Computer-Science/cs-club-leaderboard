import json
import random

rng = random.Random(101)


def case(scores):
    assert 1 <= len(scores) <= 1000 and all(0 <= s <= 1000 for s in scores)
    return f"{len(scores)}\n{' '.join(map(str, scores))}\n"


cases = [
    case([12, 0, 7, 21, 3]),  # sample
    case([0]),
    case([1000]),
    case([0, 0, 0]),
    case([4, 9]),
    case([rng.randint(0, 30) for _ in range(10)]),
    case([0, 15, 0, 0, 8, 0, 22]),
    case([rng.randint(0, 1000) for _ in range(1000)]),
    case([1000] * 1000),  # the biggest possible total
]
fuzz = [case([rng.randint(0, 1000) for _ in range(rng.randint(1, 50))]) for _ in range(20)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
