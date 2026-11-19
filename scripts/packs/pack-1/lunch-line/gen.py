import json
import random
import string

rng = random.Random(304)
used = set()


def name():
    while True:
        n = rng.choice(string.ascii_uppercase) + "".join(rng.choice(string.ascii_lowercase) for _ in range(rng.randint(0, 11)))
        if n not in used:
            used.add(n)
            return n


def case(line, cut):
    assert 1 <= len(line) <= 1000 and 1 <= len(cut) <= 1000
    names = line + cut
    assert len(set(names)) == len(names) and all(1 <= len(x) <= 12 and x.isalpha() for x in names)
    return f"{len(line)}\n{' '.join(line)}\n{len(cut)}\n{' '.join(cut)}\n"


def batch(n, m):
    return case([name() for _ in range(n)], [name() for _ in range(m)])


cases = [
    case(["Ana", "Ben", "Cy"], ["Dee", "Eli"]),  # sample
    case(["Zoe"], ["Max"]),
    case(["Ana", "Ben", "Cy", "Dee", "Eli"], ["Fay"]),
    case(["Ana"], ["Ben", "Cy", "Dee", "Eli", "Fay"]),
    case(["Q", "R"], ["S", "T"]),
    batch(10, 10),
    batch(1000, 1),
    batch(1, 1000),
    batch(1000, 1000),
]
fuzz = [batch(rng.randint(1, 6), rng.randint(1, 6)) for _ in range(30)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
