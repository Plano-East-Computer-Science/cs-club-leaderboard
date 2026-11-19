import json
import random

rng = random.Random(504)
OPEN, CLOSE = "([{", ")]}"


def line(s):
    assert 1 <= len(s) <= 10000 and "\n" not in s and s == s.strip()
    return s + "\n"


def balanced(depth_budget, length):
    """Random code-like text with matched brackets, about `length` characters."""
    out = []
    stack = []
    while len(out) < length:
        roll = rng.random()
        if roll < 0.2 and len(stack) < depth_budget:
            k = rng.randrange(3)
            stack.append(k)
            out.append(OPEN[k])
        elif roll < 0.4 and stack:
            out.append(CLOSE[stack.pop()])
        else:
            out.append(rng.choice("abcxyz019 =+-*/,.;<>"))
    while stack:
        out.append(CLOSE[stack.pop()])
    return "x" + "".join(out).strip() + "y"


good = balanced(40, 9800)
# Break it near the end: change the last closing bracket into a different one.
k = max(i for i, ch in enumerate(good) if ch in CLOSE)
bad = good[:k] + CLOSE[(CLOSE.index(good[k]) + 1) % 3] + good[k + 1:]

cases = [
    line("if (a[i] > 0) { b = (c + d); }"),  # sample 1: OK
    line("print(x[0)]"),  # sample 2: 10
    line("("),
    line(")"),
    line("()"),
    line("a"),
    line("([)]"),  # 3
    line("{[]"),  # 1
    line("((("),  # 1
    line("())"),  # 3
    line("x = {1, 2, [3, 4]}"),
    line("(" * 5000 + ")" * 4999),  # never closed: 1
    line("[" * 5000 + "]" * 5000),
    line(good),
    line(bad),
]
fuzz = [line("".join(rng.choice("()[]{}a") for _ in range(rng.randint(1, 10)))) for _ in range(150)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
