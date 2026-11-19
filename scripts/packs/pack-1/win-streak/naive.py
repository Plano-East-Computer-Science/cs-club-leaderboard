# Cross-check by a different route: the runs of wins are what is left after splitting on L.
record = input().strip()
print(max(len(run) for run in record.split("L")))
