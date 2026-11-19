import json
import random
import string

rng = random.Random(102)
CHARS = string.ascii_letters + string.digits + " .,;:?'-()"


def line(s):
    assert 1 <= len(s) <= 1000 and "\n" not in s
    s = s.rstrip() or "x"  # input lines carry no trailing spaces
    return s + "\n"


def rand(n):
    s = "".join(rng.choice(CHARS) for _ in range(n))
    return s.strip() or "x"


cases = [
    line("Go Panthers, beat the Wildcats"),  # sample 1
    line("rhythm"),  # sample 2
    line("AEIOUaeiou"),
    line("y Y yy"),
    line("12345 ?."),
    line("a"),
    line("B"),
    line("Plano East Senior High School Computer Science Club"),
    line("U" * 1000),
    line(rand(1000)),
    line("Queueing, I owe you an OUTRAGEOUS idea"),
]
fuzz = [line(rand(rng.randint(1, 80))) for _ in range(30)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
