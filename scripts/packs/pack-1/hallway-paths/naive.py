# The slow way: try every path. Fine on a tiny map, hopeless on a big one.
import sys

sys.setrecursionlimit(10000)
r, c = map(int, input().split())
grid = [input().strip() for _ in range(r)]


def paths(i, j):
    if i >= r or j >= c or grid[i][j] == "#":
        return 0
    if i == r - 1 and j == c - 1:
        return 1
    return paths(i + 1, j) + paths(i, j + 1)


print(paths(0, 0) % 1000000007)
