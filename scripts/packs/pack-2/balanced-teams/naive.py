# The slow way, and a check of the greedy idea: try every way to pair everyone up.
n = int(input())
r = list(map(int, input().split()))


def best(left):
    if not left:
        return 0
    first, rest = left[0], left[1:]
    out = None
    for i in range(len(rest)):
        worst = max(first + rest[i], best(rest[:i] + rest[i + 1:]))
        out = worst if out is None else min(out, worst)
    return out


print(best(r))
