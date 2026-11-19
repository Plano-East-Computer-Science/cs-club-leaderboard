# Cross-check by actually handing out rooms: take meetings by start time and put
# each in any room that is already free, opening a new room only when none is.
n = int(input())
meetings = sorted(tuple(map(int, input().split())) for _ in range(n))
room_free_at = []
for s, e in meetings:
    for i, free in enumerate(room_free_at):
        if free <= s:
            room_free_at[i] = e
            break
    else:
        room_free_at.append(e)
print(len(room_free_at))
