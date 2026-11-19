MOD = 1000000007

r, c = map(int, input().split())
grid = [input().strip() for _ in range(r)]
# ways[j] = paths to square (row, j). A square is reached from above or from the left.
ways = [0] * c
for i in range(r):
    for j in range(c):
        if grid[i][j] == "#":
            ways[j] = 0
        elif i == 0 and j == 0:
            ways[j] = 1
        elif j > 0:
            ways[j] = (ways[j] + ways[j - 1]) % MOD
print(ways[c - 1])
