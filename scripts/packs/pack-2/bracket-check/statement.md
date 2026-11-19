Code review time. In a line of code, every `(`, `[` and `{` must be closed by its partner `)`, `]` or `}`, and the most recently opened bracket must be closed first. Every other character does not matter.

Check one line. If the brackets are fine, print `OK`. Otherwise print the position of the first problem, counting characters from 1:

- Reading left to right, the first closing bracket that does not match the most recent unclosed opening bracket, or that has nothing to close.
- If there is no such closing bracket, the first opening bracket that is never closed.

## Input

One line of code.

## Output

Print `OK` or the position of the first problem.

## Constraints

- The line has 1 to 10,000 characters: letters, digits, spaces and symbols.
- The line does not start or end with a space.
