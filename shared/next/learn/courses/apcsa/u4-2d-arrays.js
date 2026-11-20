export default {
  id: '2d-arrays',
  title: '2D arrays: rows and columns',
  minutes: 30,
  summary: 'Store a grid in a 2D array, reach any cell by row and column, and traverse it row by row or column by column.',
  topics: ['4.11', '4.12'],
  steps: [
    {
      kind: 'explain',
      title: 'A grid of seats',
      body: `A theater's seats, a game board, a spreadsheet and the pixels of a photo are all **grids**: rows and columns. Java stores a grid as a **2D array**.

\`\`\`java
int[][] seats = new int[3][4];      // 3 rows, 4 columns, all 0
int[][] board = { {1, 2, 3},
                  {4, 5, 6} };      // 2 rows, 3 columns
\`\`\`

You reach a cell with **two** indexes, always **row first, then column**: \`board[1][2]\` is row 1, column 2, which is 6. Both start at 0.

Under the hood a 2D array is an **array of arrays**: \`board\` is an array of 2 rows, and each row is an ordinary \`int[]\`. That is why the sizes are:

- \`board.length\` is the number of **rows** (2)
- \`board[0].length\` is the number of **columns** (3), the length of one row`,
      diagram: { type: 'grid', name: 'int[][] board', rows: [[1, 2, 3], [4, 5, 6]], highlight: [[1, 2]], caption: 'board[1][2] is row 1, column 2: the value 6.' },
    },
    {
      kind: 'example',
      title: 'Read and change cells',
      body: 'Run it. Then change `board[0][1]` to 20 and print it.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int[][] board = { {1, 2, 3}, {4, 5, 6} };
        System.out.println(board[1][2]);
        System.out.println(board.length + " rows, " + board[0].length + " columns");

        board[0][0] = 9;
        int[] row = board[1];
        System.out.println(board[0][0] + " " + row[0]);

        String[][] names = new String[2][2];
        System.out.println(names[1][1]);
    }
}
`,
      output: '6\n2 rows, 3 columns\n9 4\nnull\n',
    },
    {
      kind: 'explain',
      title: 'Row-major traversal',
      body: `To visit every cell, use nested loops. The usual order is **row-major**: finish a whole row before moving to the next, the way you read a page.

\`\`\`java
for (int r = 0; r < grid.length; r++) {          // each row
    for (int c = 0; c < grid[0].length; c++) {   // each column in that row
        System.out.print(grid[r][c] + " ");
    }
    System.out.println();
}
\`\`\`

The outer loop runs over rows (\`grid.length\`), the inner over columns (\`grid[0].length\`, or \`grid[r].length\`).

Enhanced for works too, as long as you only read: each row is an \`int[]\`, so the outer loop variable is an array.

\`\`\`java
for (int[] row : grid) {
    for (int value : row) {
        sum += value;
    }
}
\`\`\``,
    },
    {
      kind: 'explain',
      title: 'Column-major traversal',
      body: `**Column-major** order goes down each column before moving right. Swap which loop is outside, but **keep the indexes in \`[row][col]\` order**:

\`\`\`java
for (int c = 0; c < grid[0].length; c++) {      // each column
    for (int r = 0; r < grid.length; r++) {     // each row in that column
        System.out.print(grid[r][c] + " ");
    }
}
\`\`\`

The bounds come with the loops: the column loop runs to \`grid[0].length\`, the row loop to \`grid.length\`. Mixing them up is invisible on a square grid and crashes on a rectangular one, which is why exam grids are rarely square.

Column-major is what you need for questions like "the total of each column" or "is any column all zeros?".`,
    },
    {
      kind: 'predict',
      body: 'Column-major order. Type the output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int[][] g = { {1, 2, 3}, {4, 5, 6} };
        String out = "";
        for (int c = 0; c < g[0].length; c++) {
            for (int r = 0; r < g.length; r++) {
                out += g[r][c];
            }
        }
        System.out.println(out);
    }
}
`,
      output: '142536\n',
      choices: ['142536\n', '123456\n', '654321\n', '415263\n'],
      explain: `The outer loop picks a column, the inner loop goes down it. Column 0 gives 1 then 4, column 1 gives 2 then 5, column 2 gives 3 then 6. Row-major order would have given 123456.`,
    },
    {
      kind: 'check',
      title: 'Rows or columns?',
      prompt: '`int[][] m = new int[4][7];`. Which statement is true?',
      options: [
        { text: '`m.length` is 4 and `m[0].length` is 7', correct: true, why: 'The first size is the number of rows, and each row has 7 columns.' },
        { text: '`m.length` is 7 and `m[0].length` is 4', why: 'Row first, column second, in both creation and access.' },
        { text: '`m.length` is 28', why: '`length` of a 2D array is the number of rows, not the number of cells.' },
        { text: '`m[4][7]` is the last cell', why: 'Indexes stop one short of the size. The last cell is `m[3][6]`.' },
      ],
    },
    {
      kind: 'check',
      title: 'Find the crash',
      prompt: '`int[][] g = new int[2][5];`. Which loop throws an ArrayIndexOutOfBoundsException?',
      options: [
        { text: '```java\nfor (int r = 0; r < g[0].length; r++)\n    for (int c = 0; c < g.length; c++)\n        g[r][c] = 1;\n```', correct: true, why: 'The bounds are swapped: r goes up to 4, but there are only 2 rows. `g[2][0]` does not exist.' },
        { text: '```java\nfor (int r = 0; r < g.length; r++)\n    for (int c = 0; c < g[0].length; c++)\n        g[r][c] = 1;\n```', why: 'Row-major with matching bounds: rows to 2, columns to 5.' },
        { text: '```java\nfor (int c = 0; c < g[0].length; c++)\n    for (int r = 0; r < g.length; r++)\n        g[r][c] = 1;\n```', why: 'Column-major with matching bounds, and indexes still in [row][col] order. Safe.' },
        { text: '```java\nfor (int[] row : g)\n    for (int v : row)\n        System.out.print(v);\n```', why: 'Enhanced for loops never go out of bounds.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Column totals',
      body: `A teacher stores quiz scores in a 2D array: each **row** is a student and each **column** is a quiz. Write \`columnTotals(int[][] scores)\`, which returns a new \`int[]\` with the total of each **column** (one total per quiz).

For

\`\`\`
8 9 7
6 10 5
\`\`\`

it returns \`{14, 19, 12}\`. The grid has at least one row.`,
      starter: String.raw`public class Main {
    public static int[] columnTotals(int[][] scores) {
        int[] totals = new int[scores[0].length];
        return totals;
    }
}
`,
      solution: String.raw`public class Main {
    public static int[] columnTotals(int[][] scores) {
        int[] totals = new int[scores[0].length];
        for (int c = 0; c < scores[0].length; c++) {
            for (int r = 0; r < scores.length; r++) {
                totals[c] += scores[r][c];
            }
        }
        return totals;
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
        System.out.println(java.util.Arrays.toString(Main.columnTotals(g)));
    }
}
`,
      tests: [
        { name: 'Two students, three quizzes', stdin: '2 3\n8 9 7\n6 10 5\n', stdout: '[14, 19, 12]\n' },
        { name: 'Not square: four students, two quizzes', stdin: '4 2\n1 2\n3 4\n5 6\n7 8\n', stdout: '[16, 20]\n' },
        { name: 'One student', stdin: '1 3\n4 0 9\n', stdout: '[4, 0, 9]\n' },
      ],
      hints: [
        'One total per column, so `totals` has `scores[0].length` slots, which the starter already makes.',
        'Use column-major order: the outer loop over columns `c`, the inner loop over rows `r`.',
        'Inside, add with the indexes in row-then-column order: `totals[c] += scores[r][c];`.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A 2D array is an array of rows: `grid[row][col]`, both from 0.',
        '`grid.length` is the number of rows; `grid[0].length` is the number of columns.',
        'Row-major: outer loop over rows. Column-major: outer loop over columns. Indexes stay `[r][c]` either way.',
        'Enhanced for over a 2D array gives each row as a 1D array.',
      ],
      mistakes: [
        'Writing `grid[c][r]` when the loops are column-major.',
        'Using `grid.length` as the column bound on a non-square grid.',
        'Thinking `grid.length` counts every cell.',
        'Assigning to an enhanced for variable and expecting the grid to change.',
      ],
    },
  ],
};
