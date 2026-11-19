n = int(input())
for i in range(1, n + 1):
    if i % 15 == 0:
        print("PantherEast")
    elif i % 3 == 0:
        print("Panther")
    elif i % 5 == 0:
        print("East")
    else:
        print(i)
