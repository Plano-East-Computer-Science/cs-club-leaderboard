import json

ns = [15, 1, 2, 3, 5, 14, 30, 100, 1000]  # 15 is the sample
assert all(1 <= n <= 1000 for n in ns)
print(json.dumps({"cases": [f"{n}\n" for n in ns], "fuzz": [f"{n}\n" for n in range(4, 61)]}))
