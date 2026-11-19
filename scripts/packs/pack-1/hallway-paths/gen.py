import json
import random

rng = random.Random(303)


def case(rows):
    r, c = len(rows), len(rows[0])
    assert 1 <= r <= 500 and 1 <= c <= 500 and all(len(x) == c and set(x) <= {".", "#"} for x in rows)
    return f"{r} {c}\n" + "".join(x + "\n" for x in rows)


def rand(r, c, p, open_ends=True):
    g = [["#" if rng.random() < p else "." for _ in range(c)] for _ in range(r)]
    if open_ends:
        g[0][0] = g[-1][-1] = "."
    return ["".join(x) for x in g]


tall = ["."] * 500
tall[321] = "#"
cases = [
    case(["...", "...", "..."]),  # sample 1: 6
    case(["....", ".#..", "...."]),  # sample 2
    case(["."]),
    case(["#"]),
    case(["#.", ".."]),  # start blocked
    case(["..", ".#"]),  # end blocked
    case(["...", "###", "..."]),  # a wall all the way across
    case(["." * 500]),  # one row: 1
    case(tall),  # one column with a block: 0
    case(["." * 20] * 20),  # 35,345,263,800 before the modulo
    case(rand(60, 60, 0.2)),
    case(rand(500, 360, 0.08)),  # biggest that fits the storage budget: 500 rows
]
fuzz = [case(rand(rng.randint(1, 9), rng.randint(1, 9), rng.random() * 0.4, rng.random() < 0.8)) for _ in range(80)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
