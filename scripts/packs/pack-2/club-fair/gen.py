import json
import random
import string

rng = random.Random(404)


def rand_name():
    return "".join(rng.choice(string.ascii_lowercase) for _ in range(rng.randint(1, 10)))


def pool(k):
    names = set()
    while len(names) < k:
        names.add(rand_name())
    return sorted(names)


def case(names):
    assert 1 <= len(names) <= 2000 and all(1 <= len(x) <= 10 and x.isalpha() and x.islower() for x in names)
    return f"{len(names)}\n" + "".join(x + "\n" for x in names)


p300 = pool(300)
distinct = pool(2000)
rng.shuffle(distinct)
cases = [
    case(["maya", "leo", "maya", "ana", "leo", "maya"]),  # sample
    case(["sam"]),
    case(["jo"] * 7),
    case(["a", "b", "c", "d"]),
    case(["ana", "anna", "ana", "an", "anna"]),  # similar names stay apart
    case(["zed", "amy", "zed", "bob", "amy", "amy"]),  # first-seen order, not sorted
    case([rng.choice(p300) for _ in range(2000)]),
    case(distinct),  # every name different: 2,000 lines out
    case([rng.choice(p300[:3]) for _ in range(1500)]),
]
fuzz = [case([rng.choice("abcd") for _ in range(rng.randint(1, 10))]) for _ in range(30)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
