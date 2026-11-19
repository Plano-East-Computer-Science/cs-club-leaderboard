# Cross-check by acting it out: each arrival is inserted at the front.
n = int(input())
line = input().split()
m = int(input())
for name in input().split():
    line.insert(0, name)
print(" ".join(line))
