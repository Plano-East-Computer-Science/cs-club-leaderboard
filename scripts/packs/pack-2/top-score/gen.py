import json
import random

rng = random.Random(401)


def case(scores):
    assert 1 <= len(scores) <= 1000 and all(0 <= s <= 100 for s in scores)
    return f"{len(scores)}\n{' '.join(map(str, scores))}\n"


cases = [
    case([88, 92, 75, 92, 60, 81]),  # sample: 92 2
    case([70]),
    case([0, 0, 0, 0]),  # the top score is 0
    case([100, 99, 98]),  # top score first
    case([50, 60, 70, 80]),  # top score last
    case([65] * 12),
    case([rng.randint(0, 100) for _ in range(1000)]),
    case([100] * 1000),
    case([rng.randint(0, 89) for _ in range(999)] + [90]),
]
fuzz = [case([rng.randint(0, 10) for _ in range(rng.randint(1, 10))]) for _ in range(30)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
