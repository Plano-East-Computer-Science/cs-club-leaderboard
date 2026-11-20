export default {
  id: '2d-array-algorithms',
  title: '2D array algorithms',
  minutes: 30,
  summary: 'Apply the standard algorithms to grids: row sums, searching for a value, checking neighbors and counting patterns.',
  topics: ['4.13'],
  steps: [
    {
      kind: 'explain',
      title: 'Grid problems are row problems',
      body: `Most 2D array questions are an array algorithm you already know, applied to each row, each column or the whole grid:

- **Whole grid**: sum, max, count. One nested traversal with one accumulator.
- **Per row**: an accumulator that **resets** at the start of each row, inside the outer loop.
- **Per column**: the same, with column-major loops.
- **Search**: find where a value is, and stop or record its row and column.

The single most important habit: decide **where each accumulator is declared**. Declared before both loops, it covers the whole grid. Declared inside the outer loop, it starts fresh for every row.`,
    },
    {
      kind: 'example',
      title: 'Per-row and whole-grid in one pass',
      body: 'Look at where `rowSum` and `total` are declared. Move `int rowSum = 0;` above the outer loop and run it to see what breaks.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int[][] sales = { {3, 5, 2}, {7, 0, 4}, {1, 1, 9} };
        int total = 0;
        for (int r = 0; r < sales.length; r++) {
            int rowSum = 0;
            for (int c = 0; c < sales[r].length; c++) {
                rowSum += sales[r][c];
            }
            System.out.println("Day " + r + ": " + rowSum);
            total += rowSum;
        }
        System.out.println("Total: " + total);
    }
}
`,
      output: 'Day 0: 10\nDay 1: 11\nDay 2: 11\nTotal: 32\n',
    },
    {
      kind: 'explain',
      title: 'Neighbors and the edges',
      body: `Games and image filters look at a cell's **neighbors**: the cells above, below, left and right of \`[r][c]\` are \`[r - 1][c]\`, \`[r + 1][c]\`, \`[r][c - 1]\` and \`[r][c + 1]\`.

On the edges some neighbors do not exist. Check before you look:

\`\`\`java
if (r > 0 && grid[r - 1][c] == target)            // above
if (r < grid.length - 1 && grid[r + 1][c] == target)   // below
if (c > 0 && grid[r][c - 1] == target)            // left
if (c < grid[0].length - 1 && grid[r][c + 1] == target) // right
\`\`\`

The bounds check goes **first**: thanks to short-circuit evaluation, when \`r > 0\` is false Java never evaluates \`grid[r - 1][c]\`, so nothing crashes.

For a search that should stop at the first match, \`return\` from inside the loops in a method. To report a position, return or print both \`r\` and \`c\`.`,
      diagram: { type: 'grid', name: 'neighbors of [1][1]', rows: [['.', 'X', '.'], ['X', 'O', 'X'], ['.', 'X', '.']], highlight: [[0, 1], [1, 0], [1, 2], [2, 1]] },
    },
    {
      kind: 'predict',
      body: 'Where is the accumulator? Type the output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int[][] g = { {2, 9}, {6, 1}, {4, 4} };
        int big = 0;
        for (int[] row : g) {
            int best = row[0];
            for (int v : row) {
                if (v > best) {
                    best = v;
                }
            }
            big += best;
        }
        System.out.println(big);
    }
}
`,
      output: '19\n',
      explain: `\`best\` restarts at each row's first value, so it finds each row's maximum: 9, 6 and 4. Those are added into \`big\`, which lives outside both loops: 9 + 6 + 4 = 19.`,
    },
    {
      kind: 'check',
      title: 'Counting matches in a grid',
      prompt: 'Which code segment sets `count` to the number of cells in `String[][] map` that equal `"tree"`?',
      options: [
        { text: '```java\nint count = 0;\nfor (String[] row : map)\n    for (String s : row)\n        if (s.equals("tree"))\n            count++;\n```', correct: true, why: 'One counter outside both loops, every cell visited, Strings compared with equals.' },
        { text: '```java\nfor (String[] row : map) {\n    int count = 0;\n    for (String s : row)\n        if (s.equals("tree"))\n            count++;\n}\n```', why: 'The counter is declared inside the outer loop, so it resets for every row and does not exist after the loops.' },
        { text: '```java\nint count = 0;\nfor (String[] row : map)\n    for (String s : row)\n        if (s == "tree")\n            count++;\n```', why: '`==` compares references, not text. Use `equals`.' },
        { text: '```java\nint count = 0;\nfor (int r = 0; r < map.length; r++)\n    if (map[r].equals("tree"))\n        count++;\n```', why: '`map[r]` is a whole row (an array), not one cell. A single loop never looks inside the rows.' },
      ],
    },
    {
      kind: 'check',
      title: 'Safe neighbor check',
      prompt: 'Which condition safely tests whether the cell to the **right** of `grid[r][c]` is 0, for any valid r and c?',
      options: [
        { text: '`c + 1 < grid[r].length && grid[r][c + 1] == 0`', correct: true, why: 'The bounds check comes first, so when c is the last column the second part is never evaluated.' },
        { text: '`grid[r][c + 1] == 0 && c + 1 < grid[r].length`', why: 'The cell is read before the bounds check, so the last column crashes.' },
        { text: '`c + 1 < grid.length && grid[r][c + 1] == 0`', why: '`grid.length` is the number of rows. On a wide grid this would skip valid columns or crash on a tall one.' },
        { text: '`c < grid[r].length && grid[r][c + 1] == 0`', why: 'c is always less than the row length, so this guard never stops the out-of-bounds read at the last column.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Find the best day',
      body: `A store records sales in a 2D array: each **row** is a day and each column is an hour. Write \`bestDay(int[][] sales)\`, which returns the **index of the row** with the largest total. If two days tie, return the earlier one. The grid has at least one row.

For

\`\`\`
3 5 2
7 0 4
1 1 9
\`\`\`

the totals are 10, 11 and 11, so return \`1\`.`,
      starter: String.raw`public class Main {
    public static int bestDay(int[][] sales) {
        return 0;
    }
}
`,
      solution: String.raw`public class Main {
    public static int bestDay(int[][] sales) {
        int best = 0;
        int bestTotal = Integer.MIN_VALUE;
        for (int r = 0; r < sales.length; r++) {
            int total = 0;
            for (int c = 0; c < sales[r].length; c++) {
                total += sales[r][c];
            }
            if (total > bestTotal) {
                bestTotal = total;
                best = r;
            }
        }
        return best;
    }
}
`,
      harness: String.raw`class Grader {
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
        System.out.println(Main.bestDay(g));
    }
}
`,
      tests: [
        { name: 'A tie keeps the earlier day', stdin: '3 3\n3 5 2\n7 0 4\n1 1 9\n', stdout: '1\n' },
        { name: 'Best day is last', stdin: '2 2\n1 1\n5 5\n', stdout: '1\n' },
        { name: 'Best day is first', stdin: '3 1\n9\n2\n3\n', stdout: '0\n' },
        { name: 'Refunds make totals negative', stdin: '2 2\n-5 -5\n-1 -2\n', stdout: '1\n' },
      ],
      hints: [
        'For each row, compute its total in a variable declared inside the outer loop, so it restarts at 0.',
        'Keep two variables outside the loops: the best total so far and its row index.',
        'Start the best total at `Integer.MIN_VALUE` so negative totals still work, and use `>` so a tie keeps the earlier day.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A grid algorithm is usually an array algorithm run on every row or column.',
        'Declare per-row accumulators inside the outer loop; whole-grid accumulators before both loops.',
        'Neighbors are `[r ± 1][c]` and `[r][c ± 1]`; check bounds first, then read.',
        'Track the row (and column) index when the answer is a position.',
      ],
      mistakes: [
        'Declaring a per-row total outside the loops, so it never resets.',
        'Reading a neighbor before checking it exists.',
        'Returning the best total when the question asks for its index.',
        'Starting a maximum at 0 when values can be negative.',
      ],
    },
  ],
};
