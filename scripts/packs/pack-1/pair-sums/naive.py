# Every pair, the way most students will write it. N is small enough for this.
n, k = map(int, input().split())
cards = list(map(int, input().split()))
pairs = 0
for i in range(n):
    for j in range(i + 1, n):
        if cards[i] + cards[j] == k:
            pairs += 1
print(pairs)
