export default {
  id: 'nested-loops',
  title: 'Nested loops and how long code takes',
  minutes: 30,
  summary: 'Put a loop inside a loop to handle rows and columns or every pair, and count exactly how many times a statement runs.',
  topics: ['2.11', '2.12'],
  steps: [
    {
      kind: 'explain',
      title: 'A clock inside a clock',
      body: `Think of a clock. Every time the hour hand moves once, the minute hand goes all the way around, 60 steps. That is a **nested loop**: a loop inside the body of another loop.

\`\`\`java
for (int row = 1; row <= 3; row++) {        // outer: once per row
    for (int col = 1; col <= 4; col++) {    // inner: all the way around, every row
        System.out.print("*");
    }
    System.out.println();                   // end the row
}
\`\`\`

The rule to remember: **the inner loop runs completely, from start to finish, for every single pass of the outer loop**. Here the outer loop runs 3 times and the inner loop runs 4 times per outer pass, so 12 stars are printed in 3 rows of 4.`,
    },
    {
      kind: 'example',
      title: 'Rows and columns',
      body: 'Change 3 and 4 to other sizes. Then try printing `row * col` instead of a star to make a times table.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        for (int row = 1; row <= 3; row++) {
            for (int col = 1; col <= 4; col++) {
                System.out.print("*");
            }
            System.out.println();
        }
    }
}
`,
      output: '****\n****\n****\n',
    },
    {
      kind: 'explain',
      title: 'When the inner loop depends on the outer',
      body: `Often the inner loop's bound uses the outer variable. That makes shapes like triangles:

\`\`\`java
for (int row = 1; row <= 4; row++) {
    for (int col = 1; col <= row; col++) {
        System.out.print(col);
    }
    System.out.println();
}
\`\`\`

Row 1 prints one number, row 2 prints two, and so on. Trace it with a table: for each value of \`row\`, list the values \`col\` takes.

The same idea finds every **pair** of things without repeats: start the inner loop just after the outer one, \`for (int j = i + 1; ...)\`, so you get (1, 2) but never (2, 1) or (1, 1).`,
      diagram: { type: 'trace', columns: ['row', 'col takes', 'printed line'], rows: [[1, '1', '1'], [2, '1, 2', '12'], [3, '1, 2, 3', '123'], [4, '1, 2, 3, 4', '1234']] },
    },
    {
      kind: 'predict',
      body: 'Type the exact output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        for (int i = 3; i >= 1; i--) {
            for (int j = 0; j < i; j++) {
                System.out.print(i);
            }
            System.out.println();
        }
    }
}
`,
      output: '333\n22\n1\n',
      explain: `The outer loop counts i down 3, 2, 1. For each i the inner loop runs i times (j from 0 to i - 1) and prints i each time. So the first row is 333, then 22, then 1.`,
    },
    {
      kind: 'explain',
      title: 'Counting how much work code does',
      body: `How long a program takes depends on how many statements it executes. AP calls this **informal run-time analysis**, and the questions ask "how many times is this statement executed?".

- A single loop of n passes runs its body **n** times.
- A loop inside a loop with independent bounds runs the inner body **outer × inner** times: 3 rows of 4 is 12.
- A triangle, where the inner bound is the outer variable, runs **1 + 2 + ... + n** times, which is \`n(n + 1) / 2\`. For n = 4 that is 10.

Doubling n doubles a single loop's work but roughly **quadruples** a nested loop's work. That is why a program that checks every pair gets slow fast. When in doubt, make the trace table and count.`,
    },
    {
      kind: 'check',
      title: 'How many stars?',
      prompt: 'How many times is `System.out.print("*")` executed?\n\n```java\nfor (int a = 0; a < 5; a++) {\n    for (int b = a; b < 5; b++) {\n        System.out.print("*");\n    }\n}\n```',
      options: [
        { text: '15', correct: true, why: 'When a is 0 the inner loop runs 5 times, then 4, 3, 2, 1 as a grows. 5 + 4 + 3 + 2 + 1 = 15.' },
        { text: '25', why: 'That would be right if b always started at 0. Here b starts at a, so later rows are shorter.' },
        { text: '10', why: 'That is 4 + 3 + 2 + 1. When a is 0, b runs from 0 to 4, five passes, not four.' },
        { text: '5', why: 'That counts only the outer loop. The print is inside the inner loop, which runs several times per outer pass.' },
      ],
    },
    {
      kind: 'predict',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int count = 0;
        for (int i = 1; i <= 4; i++) {
            for (int j = i + 1; j <= 4; j++) {
                count++;
            }
        }
        System.out.println(count);
    }
}
`,
      output: '6\n',
      choices: ['6\n', '16\n', '10\n', '12\n'],
      explain: `This counts pairs (i, j) with i < j from the numbers 1 to 4: (1,2) (1,3) (1,4) (2,3) (2,4) (3,4). When i is 1 the inner loop runs 3 times, then 2, 1, and 0 when i is 4. 3 + 2 + 1 + 0 = 6.`,
    },
    {
      kind: 'check',
      title: 'Bigger input',
      prompt: 'A method checks every pair of n students with two nested loops that each run n times. With 100 students it does 10,000 checks. About how many checks will it do with 200 students?',
      options: [
        { text: '40,000', correct: true, why: 'n × n with n = 200 is 40,000. Doubling n quadruples the work of a nested loop.' },
        { text: '20,000', why: 'That is how a single loop grows. Both loops get twice as long, so the work is 2 × 2 = 4 times bigger.' },
        { text: '10,200', why: 'The work grows with n × n, not by adding a little for each new student.' },
        { text: '200', why: 'That counts one loop once. The inner loop runs fully for every outer pass.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Number staircase',
      body: `Read an int \`n\`. Print a staircase of \`n\` rows where row \`r\` (starting at 1) has \`n - r\` dots followed by the numbers 1 to \`r\`. Then print how many digits were printed in total.

For \`n = 4\`:

\`\`\`
...1
..12
.123
1234
Digits: 10
\`\`\``,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int digits = 0;
        for (int r = 1; r <= n; r++) {
            // print the dots, then the numbers, then end the line
        }
        System.out.println("Digits: " + digits);
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int digits = 0;
        for (int r = 1; r <= n; r++) {
            for (int d = 0; d < n - r; d++) {
                System.out.print(".");
            }
            for (int k = 1; k <= r; k++) {
                System.out.print(k);
                digits++;
            }
            System.out.println();
        }
        System.out.println("Digits: " + digits);
    }
}
`,
      tests: [
        { name: 'Four rows', stdin: '4\n', stdout: '...1\n..12\n.123\n1234\nDigits: 10\n' },
        { name: 'One row', stdin: '1\n', stdout: '1\nDigits: 1\n' },
        { name: 'Six rows', stdin: '6\n', stdout: '.....1\n....12\n...123\n..1234\n.12345\n123456\nDigits: 21\n' },
      ],
      hints: [
        'Inside the outer loop you need two inner loops one after the other: one for the dots, one for the numbers. Then a `println()` to end the row.',
        'The dot loop runs `n - r` times: `for (int d = 0; d < n - r; d++)`.',
        'The number loop runs k from 1 to r and prints k with `print`, not `println`. Add 1 to `digits` inside it.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'The inner loop runs all the way through for every pass of the outer loop.',
        'Independent bounds: the inner body runs outer × inner times.',
        'An inner bound that depends on the outer variable makes triangles: 1 + 2 + ... + n.',
        'Starting the inner loop at `i + 1` visits each pair once.',
        'Count executions with a trace table when the pattern is not obvious.',
      ],
      mistakes: [
        'Using the same variable name for both loops.',
        'Putting `println()` inside the inner loop, which ends a line after every item.',
        'Assuming doubling the input doubles the work of a nested loop.',
        'Forgetting that a loop whose bound starts too high runs zero times.',
      ],
    },
  ],
};
