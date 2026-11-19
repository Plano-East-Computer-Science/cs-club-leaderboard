r, c = map(int, input().split())
pairs = 0
for _ in range(r):
    row = input().strip()
    for j in range(c - 1):
        if row[j] == "." and row[j + 1] == ".":
            pairs += 1
print(pairs)
