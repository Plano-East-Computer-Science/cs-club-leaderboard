import json
import random
import string

rng = random.Random(402)


def word(w):
    assert 1 <= len(w) <= 100 and all(c in string.ascii_lowercase for c in w)
    return w + "\n"


half = "".join(rng.choice(string.ascii_lowercase) for _ in range(50))
long_yes = half + half[::-1]
near = list(long_yes)
near[37] = "z" if near[37] != "z" else "y"  # one letter off, far from both ends
long_no = "".join(near)

cases = [
    word("racecar"),  # sample 1
    word("panther"),  # sample 2
    word("a"),
    word("ab"),
    word("aa"),
    word("abca"),  # matches at the ends, not inside
    word("abcba"),
    word("noon"),
    word(long_yes),
    word(long_no),
    word(half[:49] + "q" + half[:49][::-1]),  # odd length, 99 letters
]
fuzz = []
for _ in range(40):
    w = "".join(rng.choice("ab") for _ in range(rng.randint(1, 7)))
    fuzz.append(word(w))
print(json.dumps({"cases": cases, "fuzz": fuzz}))
