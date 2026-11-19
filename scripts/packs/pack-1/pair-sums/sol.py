n, k = map(int, input().split())
cards = list(map(int, input().split()))
# For each card, every earlier card equal to k - card makes a pair with it.
seen = {}
pairs = 0
for c in cards:
    pairs += seen.get(k - c, 0)
    seen[c] = seen.get(c, 0) + 1
print(pairs)
