import sys

data = sys.stdin.read().split()
n, m = int(data[0]), int(data[1])
rules = [(int(data[2 + 2 * i]), int(data[3 + 2 * i])) for i in range(m)]
# keep track of which courses can be taken now, and always take the lowest one
