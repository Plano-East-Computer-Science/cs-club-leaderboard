const HEAD = String.raw`public class Theater {
    /** seats[r][c] is 1 if the seat is taken and 0 if it is empty. */
    private int[][] seats;

    public Theater(int[][] seats) {
        this.seats = seats;
    }
`;

const PART_A = String.raw`
    /** Returns the number of empty seats in the given row. */
    public int emptyInRow(int row) {
        int count = 0;
        for (int c = 0; c < seats[row].length; c++) {
            if (seats[row][c] == 0) {
                count++;
            }
        }
        return count;
    }
`;

const HARNESS = String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        int rows = in.nextInt();
        int cols = in.nextInt();
        int[][] g = new int[rows][cols];
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                g[r][c] = in.nextInt();
            }
        }
        Theater t = new Theater(g);
        PART
    }
}
`;

export default {
  id: 'frq-2d-array',
  kind: 'frq',
  title: 'FRQ 4: 2D array',
  minutes: 25,
  summary: 'Practice the fourth free-response question: traverse a 2D array inside a class to count and search by row and column.',
  steps: [
    {
      kind: 'explain',
      title: 'How question 4 works',
      body: `Question 4, **2D Array**, gives you a class with a 2D array instance variable and asks for methods that traverse it: count or total by row or column, find a position, or check neighbors.

The rubric usually checks:

- **traversing** the right part of the grid (a whole row, a column, or everything) with correct bounds: \`grid.length\` for rows, \`grid[r].length\` for columns,
- indexes in **[row][col]** order,
- the **comparison** or computation on each cell,
- **neighbors** checked without going out of bounds,
- the **return** value, including the "not found" case.

Before writing, decide the traversal order. Row by row? Then the outer loop is rows. A search that should report the first match in reading order is row-major too.`,
    },
    {
      kind: 'explain',
      title: 'The question',
      body: `A theater stores its seats in \`int[][] seats\`, where \`seats[r][c]\` is \`1\` if taken and \`0\` if empty.

**(a)** Write \`emptyInRow(int row)\`, which returns the number of empty seats in the given row.

**(b)** Write \`firstPair()\`, which finds two **side-by-side** empty seats (same row, columns \`c\` and \`c + 1\`). Search rows from the front (row 0), and within a row from left to right, and return the first pair found as a String like \`"row 2 seats 3-4"\`. If there is no such pair, return \`"none"\`. You may call \`emptyInRow\` if it helps (for example, to skip rows with fewer than 2 empty seats).

\`\`\`
1 1 0 1
0 1 0 0
0 0 1 1
\`\`\`

For this grid, \`emptyInRow(1)\` is \`3\` and \`firstPair()\` returns \`"row 1 seats 2-3"\`.`,
      diagram: { type: 'grid', name: 'seats', rows: [[1, 1, 0, 1], [0, 1, 0, 0], [0, 0, 1, 1]], highlight: [[1, 2], [1, 3]] },
    },
    {
      kind: 'exercise',
      title: 'Part (a): emptyInRow',
      body: 'Write `emptyInRow`. The input is the grid size and then the seats; each following number is a row to ask about.',
      starter: `${HEAD}
    /** Returns the number of empty seats in the given row. */
    public int emptyInRow(int row) {
        return 0;
    }
}
`,
      solution: `${HEAD}${PART_A}}
`,
      harness: HARNESS.replace('PART', 'while (in.hasNextInt()) {\n            System.out.println(t.emptyInRow(in.nextInt()));\n        }'),
      tests: [
        { name: 'The example grid', rubric: 'Traverses every column of the given row', stdin: '3 4\n1 1 0 1\n0 1 0 0\n0 0 1 1\n0 1 2\n', stdout: '1\n3\n2\n' },
        { name: 'A full row and an empty row', rubric: 'Counts only cells equal to 0', stdin: '2 3\n1 1 1\n0 0 0\n0 1\n', stdout: '0\n3\n' },
        { name: 'A wide grid', rubric: 'Uses the row length for the column bound, not the number of rows', stdin: '1 6\n0 1 0 1 0 0\n0\n', stdout: '4\n' },
      ],
      hints: [
        'Only one row is involved, so you need a single loop over the columns: `for (int c = 0; c < seats[row].length; c++)`.',
        'Count cells where `seats[row][c] == 0`.',
        'Return the count after the loop.',
      ],
    },
    {
      kind: 'exercise',
      title: 'Part (b): firstPair',
      body: 'Write `firstPair`. Part (a) is written for you.',
      starter: `${HEAD}${PART_A}
    /** Returns the first pair of side-by-side empty seats, like "row 2 seats 3-4", or "none". */
    public String firstPair() {
        return "none";
    }
}
`,
      solution: `${HEAD}${PART_A}
    /** Returns the first pair of side-by-side empty seats, like "row 2 seats 3-4", or "none". */
    public String firstPair() {
        for (int r = 0; r < seats.length; r++) {
            if (emptyInRow(r) >= 2) {
                for (int c = 0; c < seats[r].length - 1; c++) {
                    if (seats[r][c] == 0 && seats[r][c + 1] == 0) {
                        return "row " + r + " seats " + c + "-" + (c + 1);
                    }
                }
            }
        }
        return "none";
    }
}
`,
      harness: HARNESS.replace('PART', 'System.out.println(t.firstPair());'),
      tests: [
        { name: 'The example grid', rubric: 'Searches rows in order and compares each seat with the one to its right', stdin: '3 4\n1 1 0 1\n0 1 0 0\n0 0 1 1\n', stdout: 'row 1 seats 2-3\n' },
        { name: 'Pair at the very end of a row', rubric: 'Checks the last pair in a row without going out of bounds', stdin: '2 3\n0 1 0\n1 0 0\n', stdout: 'row 1 seats 1-2\n' },
        { name: 'Two empty seats that are not side by side', rubric: 'Requires the two empty seats to be adjacent', stdin: '2 3\n0 1 0\n1 1 1\n', stdout: 'none\n' },
        { name: 'Earliest pair wins', rubric: 'Returns the first pair in row-major order', stdin: '2 4\n1 0 0 0\n0 0 1 1\n', stdout: 'row 0 seats 1-2\n' },
        { name: 'A full theater', rubric: 'Returns "none" when no pair exists', stdin: '2 2\n1 1\n1 1\n', stdout: 'none\n' },
      ],
      hints: [
        'Row-major search: outer loop over rows, inner loop over columns.',
        'The inner loop compares `seats[r][c]` and `seats[r][c + 1]`, so it must stop at `c < seats[r].length - 1`.',
        'Return the String as soon as you find a pair; return "none" only after both loops finish.',
      ],
    },
    {
      kind: 'check',
      title: 'The bound that crashes',
      prompt: 'A student writes the inner loop of part (b) as `for (int c = 0; c < seats[r].length; c++)` and compares `seats[r][c]` with `seats[r][c + 1]`. What happens?',
      options: [
        { text: 'It throws an ArrayIndexOutOfBoundsException when a row\'s last seat is empty', correct: true, why: 'On the last column, `c + 1` is past the end of the row. If `seats[r][c] == 0` is true, Java evaluates `seats[r][c + 1]` and crashes.' },
        { text: 'It works, because the last seat has no right neighbor', why: 'Java does not know that; it tries to read the missing neighbor.' },
        { text: 'It skips the first pair in every row', why: 'The start of the loop is fine. The problem is the end.' },
        { text: 'It never compiles', why: 'It compiles. The error happens only at run time.' },
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A single row needs one loop over `grid[row].length`.',
        'Row-major order (rows outside, columns inside) gives "first in reading order".',
        'When comparing with `c + 1`, stop the loop at `length - 1`.',
        'Return as soon as you find the answer; return the not-found value after the loops.',
      ],
      mistakes: [
        'Swapping the row and column bounds on a non-square grid.',
        'Reading a neighbor past the edge.',
        'Returning "none" inside the loop after the first non-match.',
        'Indexes in [col][row] order.',
      ],
    },
  ],
};
