n = int(input())
r = sorted(map(int, input().split()))
# Pair the slowest with the fastest, the second slowest with the second fastest, ...
# Any other pairing puts some pair at or above this one's worst total.
print(max(r[i] + r[n - 1 - i] for i in range(n // 2)))
