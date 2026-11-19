import sys

data = sys.stdin.read().split()
r, c = int(data[0]), int(data[1])
grid = data[2:2 + r]  # grid[i][j] is row i, column j
# first work out the minute the fire reaches every square,
# then search from S, only stepping where you get there before the fire
