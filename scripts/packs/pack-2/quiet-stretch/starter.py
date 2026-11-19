import sys

data = sys.stdin.read().split()
n, s = int(data[0]), int(data[1])
a = [int(x) for x in data[2:2 + n]]
# find the longest run of consecutive readings with a total of at most s
# (n can be 50,000: trying every start and end is too slow)
