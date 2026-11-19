# Cross-check with two plain lists and a search for each name.
n = int(input())
names = []
counts = []
for _ in range(n):
    name = input().strip()
    found = False
    for i in range(len(names)):
        if names[i] == name:
            counts[i] += 1
            found = True
            break
    if not found:
        names.append(name)
        counts.append(1)
for i in range(len(names)):
    print(names[i], counts[i])
