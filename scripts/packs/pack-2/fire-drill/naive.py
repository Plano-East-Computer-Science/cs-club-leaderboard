# The slow way: act out the drill minute by minute. Each minute spread the fire over
# the whole map, then move every place you could be. Minutes * squares of work.
r, c = map(int, input().split())
grid = [input().strip() for _ in range(r)]
burning = {(i, j) for i in range(r) for j in range(c) if grid[i][j] == "F"}
places = {(i, j) for i in range(r) for j in range(c) if grid[i][j] == "S"}


def around(i, j):
    for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
        if 0 <= a < r and 0 <= b < c and grid[a][b] != "#":
            yield a, b


answer = -1
for minute in range(1, r * c + 2):
    burning = burning | {n for sq in burning for n in around(*sq)}
    places = {n for sq in places for n in around(*sq)} - burning
    if any(grid[i][j] == "E" for i, j in places):
        answer = minute
        break
    if not places:
        break
print(answer)
