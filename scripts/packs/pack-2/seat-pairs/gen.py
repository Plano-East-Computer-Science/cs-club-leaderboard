import json
import random

rng = random.Random(405)


def case(rows):
    r, c = len(rows), len(rows[0])
    assert 1 <= r <= 100 and 1 <= c <= 100 and all(len(x) == c and set(x) <= {".", "X"} for x in rows)
    return f"{r} {c}\n" + "".join(x + "\n" for x in rows)


def rand(r, c, p):
    return ["".join("X" if rng.random() < p else "." for _ in range(c)) for _ in range(r)]


cases = [
    case(["..X.", "...."]),  # sample: 1 + 3
    case(["."]),
    case([".."]),
    case(["X" * 10] * 10),
    case([".X" * 50] * 100),  # never two in a row: 0
    case(["."] * 100),  # one seat per row: 0
    case(["." * 100] * 100),  # 9,900
    case(["X.." * 33 + "X"] * 5),  # 33 per row
    case(rand(100, 100, 0.3)),
    case(rand(37, 81, 0.5)),
]
fuzz = [case(rand(rng.randint(1, 5), rng.randint(1, 8), rng.random())) for _ in range(40)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
