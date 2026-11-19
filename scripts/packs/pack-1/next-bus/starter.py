def minutes(text):
    # "07:15" -> 435 minutes after midnight
    h, m = text.strip().split(":")
    return int(h) * 60 + int(m)


now = minutes(input())
n = int(input())
for _ in range(n):
    bus = minutes(input())
    # how long until this bus? remember it may be tomorrow
# print the shortest wait
