import sys

data = sys.stdin.read().split()
n, s = int(data[0]), int(data[1])
a = [int(x) for x in data[2:2 + n]]
# Sliding window: grow on the right; while the total is too big, drop from the left.
# Readings are never negative, so dropping from the left only ever lowers the total.
best = 0
total = 0
left = 0
for right in range(n):
    total += a[right]
    while total > s:
        total -= a[left]
        left += 1
    best = max(best, right - left + 1)
print(best)
