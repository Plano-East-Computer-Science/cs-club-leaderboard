import json
import random

rng = random.Random(201)


def rec(s):
    assert 1 <= len(s) <= 100000 and set(s) <= {"W", "L"}
    return s + "\n"


def rand(n, p=0.5):
    return "".join("W" if rng.random() < p else "L" for _ in range(n))


# Max size: random games, then the longest streak right at the end, so a loop
# that only records a streak when it sees an L gets it wrong.
big = rand(100000 - 41) + "L" + "W" * 40
assert max(map(len, big[:-41].split("L"))) < 40

cases = [
    rec("WWLWWWLW"),  # sample 1
    rec("LLL"),  # sample 2
    rec("W"),
    rec("L"),
    rec("WLWLWL"),
    rec("LLLWWWW"),
    rec("WWWWLLL"),
    rec(rand(1000, 0.7)),
    rec("W" * 2000),
    rec(big),
]
fuzz = [rec(rand(rng.randint(1, 40), rng.random())) for _ in range(40)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
