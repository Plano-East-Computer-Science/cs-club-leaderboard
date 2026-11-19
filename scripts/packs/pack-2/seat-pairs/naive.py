# Cross-check another way: a run of k free seats holds k - 1 pairs.
r, c = map(int, input().split())
pairs = 0
for _ in range(r):
    for run in input().strip().split("X"):
        if run:
            pairs += len(run) - 1
print(pairs)
