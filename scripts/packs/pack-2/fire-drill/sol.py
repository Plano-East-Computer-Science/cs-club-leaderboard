import sys
from collections import deque

data = sys.stdin.read().split()
r, c = int(data[0]), int(data[1])
grid = "".join(data[2:2 + r])  # square (i, j) is grid[i * c + j]
INF = r * c + 5


def neighbours(k):
    i, j = divmod(k, c)
    if i > 0:
        yield k - c
    if i < r - 1:
        yield k + c
    if j > 0:
        yield k - 1
    if j < c - 1:
        yield k + 1


# 1. The minute the fire reaches each square: one search from every F at once.
fire = [INF] * (r * c)
q = deque()
for k in range(r * c):
    if grid[k] == "F":
        fire[k] = 0
        q.append(k)
while q:
    k = q.popleft()
    for n in neighbours(k):
        if grid[n] != "#" and fire[n] == INF:
            fire[n] = fire[k] + 1
            q.append(n)

# 2. Search from S. Arriving earlier is never worse (the fire only grows), so the
# first time a square is reached is the only one that matters.
start = grid.index("S")
seen = [-1] * (r * c)
seen[start] = 0
q = deque([start])
answer = -1
while q and answer < 0:
    k = q.popleft()
    t = seen[k] + 1
    for n in neighbours(k):
        if grid[n] != "#" and seen[n] < 0 and t < fire[n]:
            if grid[n] == "E":
                answer = t
                break
            seen[n] = t
            q.append(n)
print(answer)
