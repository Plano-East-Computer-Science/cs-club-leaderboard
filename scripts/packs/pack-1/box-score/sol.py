n = int(input())
scores = list(map(int, input().split()))
total = 0
for s in scores:
    total += s
print(total)
