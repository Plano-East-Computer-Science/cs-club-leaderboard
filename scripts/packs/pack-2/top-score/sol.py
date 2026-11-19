n = int(input())
scores = list(map(int, input().split()))
top = -1
count = 0
for s in scores:
    if s > top:
        top = s
        count = 1
    elif s == top:
        count += 1
print(top, count)
