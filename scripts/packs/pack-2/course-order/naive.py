# The slow way, straight from the statement: at every step scan the courses from 1
# up and take the first one whose required courses are all taken.
n, m = map(int, input().split())
required = [[] for _ in range(n + 1)]
for _ in range(m):
    a, b = map(int, input().split())
    required[b].append(a)
taken = [False] * (n + 1)
order = []
for _ in range(n):
    pick = 0
    for c in range(1, n + 1):
        if not taken[c] and all(taken[a] for a in required[c]):
            pick = c
            break
    if not pick:
        break
    taken[pick] = True
    order.append(pick)
print(" ".join(map(str, order)) if len(order) == n else "IMPOSSIBLE")
