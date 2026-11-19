The school map is a grid of R rows and C columns. An open hallway square is `.` and a blocked square is `#`.

You start on the top-left square and want to reach the bottom-right square. Each step moves one square right or one square down, and you can never step onto a `#`. How many different paths are there?

The number can be huge, so print it modulo 1,000,000,007 (the remainder after dividing by 1,000,000,007).

## Input

The first line has R and C. Each of the next R lines has C characters, each `.` or `#`.

## Output

Print the number of paths modulo 1,000,000,007. If the start or the end square is blocked, there are 0 paths.

## Constraints

- 1 ≤ R, C ≤ 500
