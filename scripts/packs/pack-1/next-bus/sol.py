def minutes(text):
    h, m = text.strip().split(":")
    return int(h) * 60 + int(m)


now = minutes(input())
n = int(input())
best = 1440
for _ in range(n):
    bus = minutes(input())
    wait = (bus - now) % 1440  # a bus earlier today is that time tomorrow
    best = min(best, wait)
print(best)
