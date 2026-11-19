# The slow way: from every start minute, add readings until the total passes S.
n, s = map(int, input().split())
a = list(map(int, input().split()))
best = 0
for i in range(n):
    total = 0
    for j in range(i, n):
        total += a[j]
        if total > s:
            break
        best = max(best, j - i + 1)
print(best)
