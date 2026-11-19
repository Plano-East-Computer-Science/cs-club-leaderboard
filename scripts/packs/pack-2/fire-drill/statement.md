This fire drill uses a pretend fire that spreads. The school map is a grid of R rows and C columns:

- `.` open floor
- `#` a wall
- `S` where you are when the alarm sounds (exactly one)
- `E` an exit (at least one)
- `F` a square that is on fire when the alarm sounds

The fire: at minute 0 the `F` squares are burning. At each new minute, every square that is not a wall and shares a side with a burning square starts burning too, and burning squares never stop. Open floor, `S` and `E` squares can all burn.

You: at minute 0 you stand on `S`. Each minute you move one square up, down, left or right, never into a wall. You may only be on a square at minute t if it is not burning at minute t.

You escape at the minute you step onto an exit. What is the fewest minutes you need to escape?

## Input

The first line has R and C. Each of the next R lines has C characters from `.#SEF`.

## Output

Print the fewest minutes to reach an exit, or -1 if you cannot escape.

## Constraints

- 1 ≤ R, C ≤ 300
- Exactly one `S` and at least one `E`. There may be no `F` at all.
