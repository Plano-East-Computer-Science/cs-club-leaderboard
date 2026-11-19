import json
import random

rng = random.Random(403)


def case(scores):
    assert 1 <= len(scores) <= 1000 and all(0 <= s <= 100 for s in scores)
    return f"{len(scores)}\n{' '.join(map(str, scores))}\n"


cases = [
    case([95, 80, 79, 60, 59]),  # sample
    case([100]),
    case([0]),
    case([90, 89]),  # A/B edge
    case([80, 79, 70, 69, 60, 59]),  # every other edge
    case([59, 60, 61]),
    case(list(range(101))),  # every score once
    case([rng.randint(0, 100) for _ in range(1000)]),
    case([rng.randint(85, 95) for _ in range(30)]),
]
fuzz = [case([rng.randint(0, 100) for _ in range(rng.randint(1, 8))]) for _ in range(20)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
