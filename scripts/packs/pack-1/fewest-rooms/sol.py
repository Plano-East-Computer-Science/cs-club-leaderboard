import sys

data = sys.stdin.read().split()
n = int(data[0])
starts = sorted(int(data[1 + 2 * i]) for i in range(n))
ends = sorted(int(data[2 + 2 * i]) for i in range(n))
# Walk the starts in time order. Every meeting that has ended by now (end <= start)
# has given its room back. Rooms in use = started so far - ended so far.
best = 0
ended = 0
for i, s in enumerate(starts):
    while ended < n and ends[ended] <= s:
        ended += 1
    best = max(best, i + 1 - ended)
print(best)
