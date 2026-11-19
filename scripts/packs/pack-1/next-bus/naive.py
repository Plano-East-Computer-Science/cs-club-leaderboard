# Cross-check: walk the clock forward one minute at a time until a bus leaves.
def minutes(text):
    h, m = text.strip().split(":")
    return int(h) * 60 + int(m)


now = minutes(input())
n = int(input())
buses = {minutes(input()) for _ in range(n)}
wait = 0
while (now + wait) % 1440 not in buses:
    wait += 1
print(wait)
