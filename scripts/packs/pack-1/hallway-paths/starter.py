MOD = 1000000007

r, c = map(int, input().split())
grid = [input().strip() for _ in range(r)]
# paths to a square = paths to the square above + paths to the square on its left
