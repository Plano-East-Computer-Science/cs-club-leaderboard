import json
import random

rng = random.Random(501)


def case(s, a):
    assert 1 <= len(a) <= 50000 and all(0 <= x <= 100 for x in a) and 0 <= s <= 10**9
    return f"{len(a)} {s}\n{' '.join(map(str, a))}\n"


# Max size. S is about 20,000 average readings, so the answer is around 20,000
# minutes and checking every start minute separately is about a billion additions.
big = [rng.randint(0, 99) for _ in range(50000)]
loud_then_quiet = [rng.randint(60, 100) for _ in range(1500)] + [rng.randint(0, 5) for _ in range(500)]
cases = [
    case(10, [4, 2, 9, 1, 3, 2, 6, 5]),  # sample: 1 3 2
    case(5, [5]),
    case(4, [5]),
    case(0, [0, 0, 3, 0, 0, 0, 1, 0, 0, 0]),  # S = 0: longest run of zeros
    case(3, [4, 5, 6, 7, 8]),  # every reading too loud
    case(10**9, [100] * 6),  # everything fits
    case(150, loud_then_quiet),  # the best stretch is at the very end
    case(5000, [rng.randint(0, 100) for _ in range(2000)]),
    case(990000, big),
]
fuzz = [case(rng.randint(0, 25), [rng.randint(0, 10) for _ in range(rng.randint(1, 12))]) for _ in range(60)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
