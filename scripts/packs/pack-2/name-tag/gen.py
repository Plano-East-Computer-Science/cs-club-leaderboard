import json

tags = [
    ("Maya", 10),  # sample
    ("Leo", 9),
    ("Ana", 12),
    ("X", 11),
    ("Bartholomewsonnworth", 9),  # 20 letters
    ("Priya", 11),
    ("JOSE", 10),
    ("Kwame", 12),
    ("Mei", 9),
]
assert all(1 <= len(n) <= 20 and n.isalpha() and 9 <= g <= 12 for n, g in tags)
print(json.dumps({"cases": [f"{n}\n{g}\n" for n, g in tags]}))
