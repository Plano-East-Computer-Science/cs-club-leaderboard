# The slow way: add up every range reading by reading.
n, q = map(int, input().split())
a = list(map(int, input().split()))
for _ in range(q):
    l, r = map(int, input().split())
    total = 0
    for i in range(l - 1, r):
        total += a[i]
    print(total)
