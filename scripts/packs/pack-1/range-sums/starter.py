import sys

data = sys.stdin.read().split()
n, q = int(data[0]), int(data[1])
a = [int(x) for x in data[2:2 + n]]
pos = 2 + n
for _ in range(q):
    l, r = int(data[pos]), int(data[pos + 1])
    pos += 2
    # answer a[l-1] + ... + a[r-1] without adding the whole range every time
