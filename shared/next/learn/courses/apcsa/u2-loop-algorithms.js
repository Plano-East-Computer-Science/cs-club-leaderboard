export default {
  id: 'loop-algorithms',
  title: 'Classic loop algorithms',
  minutes: 30,
  summary: 'The handful of loop patterns behind most programs: sum and average, minimum and maximum, counting, and checking every value.',
  topics: ['2.9'],
  steps: [
    {
      kind: 'explain',
      title: 'Patterns, not puzzles',
      body: `Most loop problems on the AP exam are one of a few standard patterns wearing a costume. Learn the patterns once and you will recognize them everywhere:

- **Sum or average**: add every value into an accumulator.
- **Count**: add 1 each time a value matches a condition.
- **Minimum or maximum**: keep the best value seen so far.
- **All or any**: decide if every value, or at least one value, passes a test.
- **Divisibility**: use \`%\` to find factors, multiples and digits.

In this lesson the values come from input one at a time. In Unit 4 the exact same patterns run over arrays and lists.`,
    },
    {
      kind: 'example',
      title: 'Sum, count and average in one pass',
      body: 'The input, shown under the code, is a count followed by that many scores. One loop computes two patterns at once. Run it, then check the average by hand.',
      stdin: '5\n88 92 75 100 61\n',
      code: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int sum = 0;
        int passing = 0;
        for (int i = 0; i < n; i++) {
            int score = in.nextInt();
            sum += score;
            if (score >= 70) {
                passing++;
            }
        }
        double avg = (double) sum / n;
        System.out.println("Average: " + avg);
        System.out.println("Passing: " + passing + " of " + n);
    }
}
`,
      output: 'Average: 83.2\nPassing: 4 of 5\n',
    },
    {
      kind: 'explain',
      title: 'Minimum and maximum: start with a real value',
      body: `To find the largest value, keep a variable \`max\` holding the biggest one seen so far, and replace it whenever you see something bigger.

The trap is the **starting value**. Starting \`max\` at \`0\` seems natural, but if every value is negative (temperatures in winter, say), nothing ever beats 0 and you report a maximum that was never in the data.

Two safe starts:

1. Start with the **first value** read, then loop over the rest.
2. Start with \`Integer.MIN_VALUE\` for a max (or \`Integer.MAX_VALUE\` for a min), so the first real value always wins.

\`\`\`java
int max = in.nextInt();          // the first value
for (int i = 1; i < n; i++) {    // the other n - 1 values
    int v = in.nextInt();
    if (v > max) {
        max = v;
    }
}
\`\`\``,
    },
    {
      kind: 'predict',
      body: 'This program has the starting-value bug. Type what it prints.',
      stdin: '4\n-8 -3 -12 -5\n',
      code: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int max = 0;
        int min = 0;
        for (int i = 0; i < n; i++) {
            int v = in.nextInt();
            if (v > max) {
                max = v;
            }
            if (v < min) {
                min = v;
            }
        }
        System.out.println(max + " " + min);
    }
}
`,
      output: '0 -12\n',
      choices: ['0 -12\n', '-3 -12\n', '-3 0\n', '0 0\n'],
      explain: `Every input is negative, so no value is greater than the starting 0 and \`max\` stays 0, a number that is not in the data at all. \`min\` happens to work here because the values are below 0, but it would fail the same way for all-positive data. Start from the first value or from \`Integer.MIN_VALUE\` / \`Integer.MAX_VALUE\`.`,
    },
    {
      kind: 'explain',
      title: 'All of them, or any of them',
      body: `"Are **all** the scores passing?" and "Is **any** score perfect?" are answered with a boolean that the loop can flip.

- **All**: start \`true\`, and set it \`false\` the moment one value fails. One failure is enough.
- **Any**: start \`false\`, and set it \`true\` the moment one value matches.

\`\`\`java
boolean allPassing = true;
for (int i = 0; i < n; i++) {
    if (in.nextInt() < 70) {
        allPassing = false;
    }
}
\`\`\`

A common bug is an \`else\` that sets it back: \`else { allPassing = true; }\` makes the answer depend only on the **last** value.

For divisibility, \`a % b == 0\` means b divides a evenly. Counting the factors of n is a loop from 1 to n with that test.`,
    },
    {
      kind: 'check',
      title: 'Spot the bug',
      prompt: 'This loop should set `found` to true if any of the n values is negative. For which input does it give the wrong answer?\n\n```java\nboolean found = false;\nfor (int i = 0; i < n; i++) {\n    int v = in.nextInt();\n    if (v < 0) {\n        found = true;\n    } else {\n        found = false;\n    }\n}\n```',
      options: [
        { text: '`-4 2 7`', correct: true, why: 'The -4 sets found to true, but 2 and 7 then set it back to false. The else makes the result depend only on the last value.' },
        { text: '`3 5 -1`', why: 'Here the negative value is last, so found ends true, which happens to be right.' },
        { text: '`1 2 3`', why: 'No value is negative and found ends false, which is right.' },
        { text: '`-1 -2 -3`', why: 'Every value is negative, so the last one leaves found true. Correct, by luck.' },
      ],
    },
    {
      kind: 'check',
      title: 'Counting factors',
      prompt: 'Which code segment sets `count` to the number of positive factors of `n` (for n = 12, that is 6: 1, 2, 3, 4, 6, 12)?',
      options: [
        { text: '```java\nint count = 0;\nfor (int d = 1; d <= n; d++) {\n    if (n % d == 0) {\n        count++;\n    }\n}\n```', correct: true, why: 'It tries every candidate from 1 to n, including n itself, and counts the ones that divide evenly.' },
        { text: '```java\nint count = 0;\nfor (int d = 1; d < n; d++) {\n    if (n % d == 0) {\n        count++;\n    }\n}\n```', why: 'With `<`, n itself is never tried, so it counts 5 for 12.' },
        { text: '```java\nint count = 0;\nfor (int d = 1; d <= n; d++) {\n    if (d % n == 0) {\n        count++;\n    }\n}\n```', why: 'The operands are backwards. `d % n == 0` only when d is n, so count ends at 1.' },
        { text: '```java\nint count = 0;\nfor (int d = 0; d <= n; d++) {\n    if (n % d == 0) {\n        count++;\n    }\n}\n```', why: 'Starting at 0 means the first test is `n % 0`, which crashes with an ArithmeticException.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Weekly temperatures',
      body: `The input is a count \`n\` (at least 1) followed by \`n\` daily high temperatures (ints, possibly negative). Print three lines in this format. For the input \`3\` then \`31 -4 50\`:

\`\`\`
High: 50
Low: -4
Freezing days: 2
\`\`\`

A freezing day has a temperature of 32 or below.`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int high = 0;
        int low = 0;
        int freezing = 0;
        for (int i = 0; i < n; i++) {
            int t = in.nextInt();
            // update high, low and freezing
        }
        System.out.println("High: " + high);
        System.out.println("Low: " + low);
        System.out.println("Freezing days: " + freezing);
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int high = Integer.MIN_VALUE;
        int low = Integer.MAX_VALUE;
        int freezing = 0;
        for (int i = 0; i < n; i++) {
            int t = in.nextInt();
            if (t > high) {
                high = t;
            }
            if (t < low) {
                low = t;
            }
            if (t <= 32) {
                freezing++;
            }
        }
        System.out.println("High: " + high);
        System.out.println("Low: " + low);
        System.out.println("Freezing days: " + freezing);
    }
}
`,
      tests: [
        { name: 'A mixed week', stdin: '7\n31 40 -4 55 33 20 47\n', stdout: 'High: 55\nLow: -4\nFreezing days: 3\n' },
        { name: 'All below zero', stdin: '3\n-10 -2 -7\n', stdout: 'High: -2\nLow: -10\nFreezing days: 3\n' },
        { name: 'All warm', stdin: '4\n70 81 77 90\n', stdout: 'High: 90\nLow: 70\nFreezing days: 0\n' },
        { name: 'Exactly 32 counts', stdin: '1\n32\n', stdout: 'High: 32\nLow: 32\nFreezing days: 1\n' },
      ],
      hints: [
        'Starting `high` and `low` at 0 fails for all-negative or all-warm weeks. Start them at `Integer.MIN_VALUE` and `Integer.MAX_VALUE`.',
        'Use three separate `if` statements in the loop, not if / else if: one temperature can update the high, the low and the freezing count.',
        '"32 or below" is `t <= 32`.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Sum: start at 0 and add each value. Average: cast before dividing by the count.',
        'Count: add 1 inside an if.',
        'Max and min: start from the first value or from `Integer.MIN_VALUE` / `Integer.MAX_VALUE`, never from 0.',
        'All: start true, flip to false on a failure. Any: start false, flip to true on a match. Never flip back.',
        '`a % b == 0` tests whether b divides a.',
      ],
      mistakes: [
        'Starting a maximum at 0 when values can be negative.',
        'An else that resets an all/any flag on every value.',
        'Integer division when averaging: `sum / n`.',
        'Using else-if for checks that are independent of each other.',
      ],
    },
  ],
};
