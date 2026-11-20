export default {
  id: 'math-class',
  title: 'The Math class',
  minutes: 20,
  summary: 'Use Java\'s built-in math toolbox for powers, roots, absolute values and random numbers in a range.',
  topics: ['1.11'],
  steps: [
    {
      kind: 'explain',
      title: 'A calculator that is always there',
      body: `Java comes with a class called \`Math\` full of static methods, so you call them on the class name: \`Math.sqrt(25)\`. You never create a \`Math\` object, and you do not need an import.

These are the ones on the AP exam:

| method | returns | example |
| --- | --- | --- |
| \`Math.abs(x)\` | the distance from zero, same type as \`x\` | \`Math.abs(-7)\` is \`7\` |
| \`Math.pow(base, exp)\` | \`base\` to the power \`exp\`, always a double | \`Math.pow(2, 10)\` is \`1024.0\` |
| \`Math.sqrt(x)\` | the square root, a double | \`Math.sqrt(49)\` is \`7.0\` |
| \`Math.random()\` | a random double, at least 0.0 and less than 1.0 | maybe \`0.7203...\` |

Notice that \`pow\` and \`sqrt\` return a \`double\` even when the answer is a whole number.`,
    },
    {
      kind: 'example',
      title: 'Try them',
      body: 'Change the numbers and run it again. What does `Math.sqrt(2)` give?',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        System.out.println(Math.abs(-7));
        System.out.println(Math.abs(-2.5));
        System.out.println(Math.pow(2, 10));
        System.out.println(Math.sqrt(49));

        int side1 = 6;
        int side2 = 8;
        double hyp = Math.sqrt(Math.pow(side1, 2) + Math.pow(side2, 2));
        System.out.println("Hypotenuse: " + hyp);
    }
}
`,
      output: '7\n2.5\n1024.0\n7.0\nHypotenuse: 10.0\n',
    },
    {
      kind: 'predict',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int a = 3;
        int b = 5;
        int p = (int) Math.pow(a, 2);
        System.out.println(p + Math.abs(a - b));
        System.out.println(Math.sqrt(p) + b);
    }
}
`,
      output: '11\n8.0\n',
      choices: ['11\n8.0\n', '11.0\n8.0\n', '7\n8.0\n', '11\n8\n'],
      explain: `\`Math.pow(3, 2)\` is \`9.0\`, and the cast makes \`p\` the int \`9\`. \`Math.abs(3 - 5)\` is \`Math.abs(-2)\`, the int \`2\`, so the first line is \`9 + 2 = 11\`, an int. On the second line \`Math.sqrt(9)\` is \`3.0\`, a double, and \`3.0 + 5\` is \`8.0\`. Once a double joins the expression, the result is a double.`,
    },
    {
      kind: 'explain',
      title: 'Random numbers in a range',
      body: `\`Math.random()\` gives a double in the range \`0.0\` up to but **not including** \`1.0\`. Games need whole numbers in a range, like a die from 1 to 6. You get there in three moves:

1. **Stretch**: \`Math.random() * 6\` is somewhere from \`0.0\` up to (not including) \`6.0\`.
2. **Chop**: \`(int) (Math.random() * 6)\` is one of \`0, 1, 2, 3, 4, 5\`.
3. **Shift**: add 1, and you get \`1\` to \`6\`.

The general recipe for a random int from \`min\` to \`max\`, both included:

\`\`\`java
int r = (int) (Math.random() * (max - min + 1)) + min;
\`\`\`

The \`+ 1\` is the part students forget: from 1 to 6 there are **six** possible values, not five.`,
      diagram: { type: 'trace', columns: ['expression', 'smallest', 'largest'], rows: [['Math.random()', '0.0', '0.999...'], ['Math.random() * 6', '0.0', '5.999...'], ['(int) (Math.random() * 6)', '0', '5'], ['(int) (Math.random() * 6) + 1', '1', '6']] },
    },
    {
      kind: 'check',
      title: 'A random test score',
      prompt: 'Which expression produces a random integer from 50 to 100, inclusive, with every value possible?',
      options: [
        { text: '`(int) (Math.random() * 51) + 50`', correct: true, why: 'There are 100 - 50 + 1 = 51 possible values. Stretching to 0 to 50.999, chopping to 0 to 50, and shifting by 50 gives 50 to 100.' },
        { text: '`(int) (Math.random() * 50) + 50`', why: 'This gives 50 to 99. The count of values is max - min + 1, so 100 is never produced.' },
        { text: '`(int) Math.random() * 51 + 50`', why: 'The cast applies to `Math.random()` alone, which always chops to 0. The result is always 50.' },
        { text: '`(int) (Math.random() * 100) + 50`', why: 'This gives 50 to 149. The multiplier should be the number of possible values, not the maximum.' },
      ],
    },
    {
      kind: 'predict',
      body: 'This program uses random numbers, yet its output is always the same. Type what it prints.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int roll = (int) (Math.random() * 6) + 1;
        int smallest = (int) (0.0 * 6) + 1;
        int largest = (int) (0.9999 * 6) + 1;
        System.out.println(smallest + " to " + largest);
        System.out.println(roll >= 1 && roll <= 6);
    }
}
`,
      output: '1 to 6\ntrue\n',
      explain: `The middle lines plug in the smallest and largest values \`Math.random()\` can be close to. \`0.0 * 6\` chops to 0, plus 1 is 1. \`0.9999 * 6\` is \`5.9994\`, which chops to 5, plus 1 is 6. Whatever \`roll\` turned out to be, it is between 1 and 6, so the last line is \`true\`. (\`&&\` means "and"; you will meet it properly in Unit 2.)`,
    },
    {
      kind: 'check',
      title: 'What type comes back?',
      prompt: 'Assume `int n = 16;`. Which statement does **not** compile?',
      options: [
        { text: '`int root = Math.sqrt(n);`', correct: true, why: '`Math.sqrt` returns a double, and a double cannot be stored in an int without a cast: `(int) Math.sqrt(n)`.' },
        { text: '`double root = Math.sqrt(n);`', why: 'This compiles: the int argument widens to a double, and the double result goes into a double.' },
        { text: '`int d = Math.abs(n - 20);`', why: 'This compiles: `Math.abs` of an int returns an int.' },
        { text: '`double sq = Math.pow(n, 0.5);`', why: 'This compiles and also gives 4.0. Any power returns a double.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'How far apart?',
      body: `Two friends stand on a grid. Read four ints, \`x1 y1 x2 y2\`, and print:

1. the straight-line distance between them, rounded to two decimal places, like \`Distance: 5.0\`
2. the "walking" distance along the grid lines, \`|x2 - x1| + |y2 - y1|\`, like \`Blocks: 7\`

The straight-line distance is \`sqrt((x2 - x1)^2 + (y2 - y1)^2)\`. Remember that Java has no \`^\` power operator; use \`Math.pow\`.`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int x1 = in.nextInt();
        int y1 = in.nextInt();
        int x2 = in.nextInt();
        int y2 = in.nextInt();
        // compute and print both distances
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int x1 = in.nextInt();
        int y1 = in.nextInt();
        int x2 = in.nextInt();
        int y2 = in.nextInt();
        double d = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        double rounded = (int) (d * 100 + 0.5) / 100.0;
        System.out.println("Distance: " + rounded);
        System.out.println("Blocks: " + (Math.abs(x2 - x1) + Math.abs(y2 - y1)));
    }
}
`,
      tests: [
        { name: 'A 3-4-5 triangle', stdin: '0 0 3 4\n', stdout: 'Distance: 5.0\nBlocks: 7\n' },
        { name: 'Needs rounding', stdin: '1 1 2 2\n', stdout: 'Distance: 1.41\nBlocks: 2\n' },
        { name: 'Negative coordinates', stdin: '-2 5 4 -3\n', stdout: 'Distance: 10.0\nBlocks: 14\n' },
        { name: 'Same spot', stdin: '7 7 7 7\n', stdout: 'Distance: 0.0\nBlocks: 0\n' },
      ],
      hints: [
        'Build the distance from the inside out: the two differences, then their squares with `Math.pow`, then their sum, then `Math.sqrt`.',
        'Round to two places with `(int) (d * 100 + 0.5) / 100.0`, as in the casting lesson.',
        'Blocks need `Math.abs` on each difference, so a walk to the left still counts as a positive number of blocks. Put the sum in parentheses inside the print.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Math methods are static: call them as `Math.name(...)`.',
        '`Math.pow` and `Math.sqrt` always return a double; `Math.abs` returns the same type it was given.',
        'A random int from min to max inclusive is `(int) (Math.random() * (max - min + 1)) + min`.',
      ],
      mistakes: [
        'Writing `x ^ 2` for a square. In Java `^` is not a power; use `Math.pow(x, 2)` or `x * x`.',
        'Forgetting the `+ 1` in the count of random values.',
        'Casting only `Math.random()`, as in `(int) Math.random() * 6`, which is always 0.',
        'Storing `Math.sqrt(...)` in an int without a cast.',
      ],
    },
  ],
};
