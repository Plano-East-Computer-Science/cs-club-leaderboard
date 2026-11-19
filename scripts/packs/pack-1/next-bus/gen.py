import json
import random

rng = random.Random(202)


def hm(m):
    return f"{m // 60:02d}:{m % 60:02d}"


def case(now, buses):
    assert 1 <= len(buses) <= 1000 and all(0 <= b < 1440 for b in buses) and 0 <= now < 1440
    return f"{hm(now)}\n{len(buses)}\n" + "".join(hm(b) + "\n" for b in buses)


def t(s):
    h, m = s.split(":")
    return int(h) * 60 + int(m)


cases = [
    case(t("23:50"), [t("07:15"), t("12:00"), t("23:40")]),  # sample 1: 445, wraps to tomorrow
    case(t("08:05"), [t("15:30"), t("08:20"), t("07:45"), t("12:00")]),  # sample 2: 15
    case(t("12:00"), [t("13:00"), t("12:00")]),  # a bus right now: 0
    case(t("10:00"), [t("09:59")]),  # just missed it: 1439
    case(t("00:00"), [t("00:00")]),
    case(t("23:59"), [t("00:00")]),  # across midnight: 1
    case(t("00:00"), [t("23:59")]),
    case(t("06:30"), [t("06:45"), t("06:45"), t("06:31"), t("06:31")]),  # repeats
    case(t("00:07"), [t("00:09"), t("00:08"), t("10:00")]),
    case(rng.randrange(1440), [rng.randrange(1440) for _ in range(1000)]),
    case(t("18:30"), [rng.randint(t("05:00"), t("11:59")) for _ in range(1000)]),  # all gone today
    case(t("05:00"), [rng.randint(t("05:01"), t("23:59")) for _ in range(1000)]),
]
fuzz = [case(rng.randrange(1440), [rng.randrange(1440) for _ in range(rng.randint(1, 6))]) for _ in range(60)]
print(json.dumps({"cases": cases, "fuzz": fuzz}))
