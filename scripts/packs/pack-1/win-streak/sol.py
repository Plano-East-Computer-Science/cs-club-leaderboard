record = input().strip()
best = 0
run = 0
for game in record:
    if game == "W":
        run += 1
        best = max(best, run)
    else:
        run = 0
print(best)
