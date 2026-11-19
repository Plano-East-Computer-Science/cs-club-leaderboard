import json

names = [
    "Panther",  # sample
    "Ana",
    "Mary Jane",
    "O'Neil",
    "Jean-Luc",
    "Q",
    "Maximiliana Dorothea Clementine",  # 31, trimmed below to the 30 limit
    "de la Cruz",
    "ALEXANDER",
    "Ngozi Adaeze-Okafor",
]
names[6] = names[6][:30].rstrip()
assert all(1 <= len(n) <= 30 and n == n.strip() for n in names)
print(json.dumps({"cases": [n + "\n" for n in names]}))
