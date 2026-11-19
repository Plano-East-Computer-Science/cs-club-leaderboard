n = int(input())
counts = {}  # a dict keeps names in the order they were first added
for _ in range(n):
    name = input().strip()
    counts[name] = counts.get(name, 0) + 1
for name, c in counts.items():
    print(name, c)
