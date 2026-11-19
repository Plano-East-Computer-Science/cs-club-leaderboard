import sys

data = sys.stdin.read().split()
n, q = int(data[0]), int(data[1])
# prefix[i] = a1 + ... + ai, so a range sum is two lookups.
prefix = [0] * (n + 1)
for i in range(n):
    prefix[i + 1] = prefix[i] + int(data[2 + i])
out = []
pos = 2 + n
for _ in range(q):
    l, r = int(data[pos]), int(data[pos + 1])
    pos += 2
    out.append(prefix[r] - prefix[l - 1])
print("\n".join(map(str, out)))
