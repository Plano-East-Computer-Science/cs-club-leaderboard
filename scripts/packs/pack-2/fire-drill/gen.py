import json
import random
from collections import deque

rng = random.Random(503)


def case(rows):
    r, c = len(rows), len(rows[0])
    assert 1 <= r <= 300 and 1 <= c <= 300 and all(len(x) == c and set(x) <= set(".#SEF") for x in rows)
    text = "".join(rows)
    assert text.count("S") == 1 and text.count("E") >= 1
    return f"{r} {c}\n" + "".join(x + "\n" for x in rows)


def escape(rows, with_fire=True):
    """Same rules as sol.py, used here only to pick interesting random maps."""
    r, c = len(rows), len(rows[0])
    inf = float("inf")
    fire = [[inf] * c for _ in range(r)]
    q = deque()
    for i in range(r):
        for j in range(c):
            if rows[i][j] == "F" and with_fire:
                fire[i][j] = 0
                q.append((i, j))
            if rows[i][j] == "S":
                s = (i, j)
    while q:
        i, j = q.popleft()
        for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
            if 0 <= a < r and 0 <= b < c and rows[a][b] != "#" and fire[a][b] == inf:
                fire[a][b] = fire[i][j] + 1
                q.append((a, b))
    seen = {s: 0}
    q = deque([s])
    while q:
        i, j = q.popleft()
        t = seen[(i, j)] + 1
        for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
            if 0 <= a < r and 0 <= b < c and rows[a][b] != "#" and (a, b) not in seen and t < fire[a][b]:
                if rows[a][b] == "E":
                    return t
                seen[(a, b)] = t
                q.append((a, b))
    return -1


def snake(n):
    """n by n: every other row is a corridor, joined at alternating ends. The fire
    starts 5 squares behind you and chases you the whole way, about n * n / 2 minutes."""
    g = [["#"] * n for _ in range(n)]
    for i in range(0, n, 2):
        g[i] = ["."] * n
        if i + 1 < n:
            g[i + 1][n - 1 if (i // 2) % 2 == 0 else 0] = "."
    g[0][0] = "F"
    g[0][5] = "S"
    last = n - 1 if n % 2 == 1 else n - 2
    g[last][n - 1 if (last // 2) % 2 == 0 else 0] = "E"
    return ["".join(x) for x in g]


def random_map(r, c, walls, fires, exits):
    while True:
        g = [["#" if rng.random() < walls else "." for _ in range(c)] for _ in range(r)]
        cells = rng.sample([(i, j) for i in range(r) for j in range(c)], 1 + fires + exits)
        si, sj = cells[0]
        g[si][sj] = "S"
        for i, j in cells[1:1 + fires]:
            g[i][j] = "F"
        for i, j in cells[1 + fires:]:
            g[i][j] = "E"
        rows = ["".join(x) for x in g]
        with_fire, without = escape(rows), escape(rows, False)
        # Keep maps where you can escape but the fire changes the answer.
        if with_fire != -1 and with_fire > without:
            return rows


open_map = [["."] * 300 for _ in range(100)]
open_map[0][0] = "S"
open_map[99][299] = "E"
open_map = ["".join(x) for x in open_map]

cases = [
    case(["E...S", ".....", "F....", ".....", "....E"]),  # sample 1: the near exit burns first, 4
    case(["S.....E", ".#####.", ".......", "...F...", "......."]),  # sample 2: the fire reaches E just as you would: -1
    case(["SE"]),
    case(["S#E", ".#.", ".#."]),  # walled off
    case(["S..E..F"]),  # fire reaches E at minute 3, you at 3: -1
    case(["S..E...F"]),  # fire at 4, you at 3: 3
    case(["FFF", "FSF", "FFE"]),  # boxed in by fire
    case(["S...E", "#####", "F...."]),  # the wall holds the fire back: 4
    case(random_map(12, 12, 0.2, 2, 2)),
    case(open_map),  # no fire: 398
    case(random_map(250, 250, 0.25, 6, 4)),
    case(snake(300)),  # max size, long answer
]
fuzz = []
while len(fuzz) < 80:
    r, c = rng.randint(1, 6), rng.randint(2, 6)
    g = [[rng.choice("..#") for _ in range(c)] for _ in range(r)]
    cells = rng.sample([(i, j) for i in range(r) for j in range(c)], min(r * c, rng.randint(2, 4)))
    g[cells[0][0]][cells[0][1]] = "S"
    g[cells[1][0]][cells[1][1]] = "E"
    for i, j in cells[2:]:
        g[i][j] = rng.choice("FE")
    fuzz.append(case(["".join(x) for x in g]))
print(json.dumps({"cases": cases, "fuzz": fuzz}))
