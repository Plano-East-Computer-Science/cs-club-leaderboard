import heapq
import sys

data = sys.stdin.read().split()
n, m = int(data[0]), int(data[1])
unlocks = [[] for _ in range(n + 1)]  # unlocks[a] = courses that need a
needs = [0] * (n + 1)  # how many required courses are still not taken
for i in range(m):
    a, b = int(data[2 + 2 * i]), int(data[3 + 2 * i])
    unlocks[a].append(b)
    needs[b] += 1

# A min-heap of the courses that can be taken right now gives the lowest one fast.
ready = [c for c in range(1, n + 1) if needs[c] == 0]
heapq.heapify(ready)
order = []
while ready:
    c = heapq.heappop(ready)
    order.append(c)
    for b in unlocks[c]:
        needs[b] -= 1
        if needs[b] == 0:
            heapq.heappush(ready, b)

print(" ".join(map(str, order)) if len(order) == n else "IMPOSSIBLE")
