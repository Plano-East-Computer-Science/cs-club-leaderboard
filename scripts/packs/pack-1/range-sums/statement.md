The robotics team's sensor logged one reading per second for N seconds. The team has Q questions, each of the form: what is the total of the readings from second l to second r, counting both ends?

## Input

The first line has N and Q. The second line has the N readings a1 to aN. Each of the next Q lines has two integers l and r.

## Output

Print Q lines. Line i is the answer to question i: the sum al + ... + ar.

## Constraints

- 1 ≤ N, Q ≤ 100,000
- 0 ≤ each reading ≤ 1,000,000,000
- 1 ≤ l ≤ r ≤ N (seconds are numbered from 1)
- An answer can be larger than 2,147,483,647.
