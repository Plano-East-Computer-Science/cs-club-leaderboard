import sys

data = sys.stdin.read().split()
n = int(data[0])
meetings = [(int(data[1 + 2 * i]), int(data[2 + 2 * i])) for i in range(n)]
# how many meetings are running at the busiest moment?
