export default {
  id: 'casting',
  title: 'Casting and the range of numbers',
  minutes: 25,
  summary: 'Convert between int and double on purpose, round correctly, and know what happens when a number gets too big for its box.',
  topics: ['1.5'],
  steps: [
    {
      kind: 'explain',
      title: 'A big box and a small box',
      body: `Think of an \`int\` as a box that only holds whole numbers and a \`double\` as a bigger box that also holds decimals.

Pouring an \`int\` into a \`double\` box always fits, so Java does it for you without asking. This is called **widening**:

\`\`\`java
int slices = 7;
double d = slices;   // d is 7.0
\`\`\`

Going the other way would spill the decimal part, so Java refuses unless you say you mean it. Saying "I mean it" is called a **cast**: you write the type you want in parentheses in front of the value.

\`\`\`java
double price = 4.99;
int dollars = (int) price;   // 4
\`\`\``,
      diagram: { type: 'vars', vars: [{ name: 'price', type: 'double', value: '4.99' }, { name: 'dollars', type: 'int', value: '4' }], caption: 'The cast keeps the whole part and drops everything after the decimal point.' },
    },
    {
      kind: 'explain',
      title: 'A cast truncates, it does not round',
      body: `\`(int)\` simply chops off the decimal part. It never rounds up. That is called **truncating toward zero**:

- \`(int) 4.99\` is \`4\`
- \`(int) 0.7\` is \`0\`
- \`(int) -2.8\` is \`-2\` (toward zero, not down to \`-3\`)

Casting the other way fixes integer division. \`7 / 2\` is \`3\` because both sides are ints. Cast one side to \`double\` **before** dividing and you get the real answer:

\`\`\`java
int total = 7, people = 2;
double share = (double) total / people;   // 3.5
double wrong = (double) (total / people); // 3.0, the division already happened
\`\`\`

A cast applies to the value right after it, so \`(double) total / people\` casts \`total\` first, then divides.`,
    },
    {
      kind: 'example',
      title: 'Try some casts',
      body: 'Run it, then change the numbers. Try a negative price.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        double price = 4.99;
        System.out.println((int) price);
        System.out.println((int) -2.8);

        int total = 7;
        int people = 2;
        System.out.println(total / people);
        System.out.println((double) total / people);
        System.out.println((double) (total / people));
    }
}
`,
      output: '4\n-2\n3\n3.5\n3.0\n',
    },
    {
      kind: 'predict',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int a = 9;
        int b = 4;
        double x = a / b;
        double y = (double) a / b;
        int z = (int) (y * 10);
        System.out.println(x);
        System.out.println(y);
        System.out.println(z);
    }
}
`,
      output: '2.0\n2.25\n22\n',
      choices: ['2.0\n2.25\n22\n', '2.25\n2.25\n22\n', '2.0\n2.25\n23\n', '2\n2.25\n22\n'],
      explain: `\`a / b\` is int division, so it is \`2\`. Storing \`2\` in a \`double\` widens it to \`2.0\`, but the decimal was already lost. \`(double) a / b\` casts \`9\` to \`9.0\` first, so the division gives \`2.25\`. Then \`y * 10\` is \`22.5\`, and \`(int)\` chops it to \`22\`, not \`23\`.`,
    },
    {
      kind: 'explain',
      title: 'Rounding on purpose',
      body: `Since \`(int)\` chops, the standard trick to round to the nearest whole number is to add one half first:

- For **positive** numbers: \`(int) (x + 0.5)\`. So \`2.6 + 0.5 = 3.1\`, which chops to \`3\`. And \`2.4 + 0.5 = 2.9\` chops to \`2\`.
- For **negative** numbers: \`(int) (x - 0.5)\`. So \`-2.6 - 0.5 = -3.1\` chops to \`-3\`.

The parentheses matter. \`(int) x + 0.5\` casts first and then adds \`0.5\`, giving a \`double\` like \`2.5\`, which is not what you wanted.

To round to two decimal places, scale up, round, and scale back: \`(int) (x * 100 + 0.5) / 100.0\`. Dividing by \`100.0\` (not \`100\`) keeps the decimals.`,
    },
    {
      kind: 'check',
      title: 'Rounding a grade',
      prompt: '`double avg` holds a positive average such as `89.5`. Which expression gives `avg` rounded to the nearest whole number as an `int`?',
      options: [
        { text: '`(int) (avg + 0.5)`', correct: true, why: 'Adding 0.5 first means anything at .5 or above crosses the next whole number before the cast chops the decimal. 89.5 becomes 90.0, then 90.' },
        { text: '`(int) avg + 0.5`', why: 'The cast happens first, giving 89, then 0.5 is added, giving the double 89.5. That is not an int and not rounded.' },
        { text: '`(int) avg`', why: 'A cast truncates. 89.9 would become 89, not 90.' },
        { text: '`(double) (int) avg`', why: 'This truncates to 89 and then turns it back into 89.0. Nothing rounds.' },
      ],
    },
    {
      kind: 'explain',
      title: 'Every box has a size limit',
      body: `An \`int\` is stored in 32 bits, so it can only hold numbers from \`Integer.MIN_VALUE\` (\`-2147483648\`) to \`Integer.MAX_VALUE\` (\`2147483647\`), about plus or minus 2.1 billion.

Go past the top and Java does not stop you or crash. The value **wraps around** to the most negative int, like a car odometer rolling over. This is called **integer overflow**, and it is a classic logic error: the program runs and quietly prints garbage.

\`double\` has a different weakness. It stores numbers in binary, and many decimals (like \`0.1\`) cannot be written exactly in binary, just as 1/3 cannot be written exactly in decimal. So \`0.1 + 0.2\` prints \`0.30000000000000004\`. This is **round-off error**. It is why you should not compare doubles with \`==\`.`,
    },
    {
      kind: 'predict',
      body: 'Type the output. The first line is the trap.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int big = Integer.MAX_VALUE;
        big = big + 1;
        System.out.println(big == Integer.MIN_VALUE);
        System.out.println(0.1 + 0.2);
    }
}
`,
      output: 'true\n0.30000000000000004\n',
      explain: `Adding 1 to the largest int overflows and wraps to the smallest int, \`-2147483648\`, which is exactly \`Integer.MIN_VALUE\`, so the comparison is \`true\`. The second line shows round-off: \`0.1\` and \`0.2\` are both stored as tiny approximations, and their sum is not exactly \`0.3\`.`,
    },
    {
      kind: 'check',
      title: 'Which expression is 2.5?',
      prompt: 'Assume `int m = 5;` and `int n = 2;`. Which expression evaluates to `2.5`?',
      options: [
        { text: '`(double) m / n`', correct: true, why: 'The cast turns `m` into `5.0` before dividing, so the division is done with doubles: `5.0 / 2` is `2.5`.' },
        { text: '`(double) (m / n)`', why: 'The parentheses make `m / n` happen first as int division, giving `2`. Casting afterwards gives `2.0`.' },
        { text: '`m / n * 1.0`', why: 'Left to right: `m / n` is int division, `2`, and only then multiplied by `1.0`, giving `2.0`.' },
        { text: '`(int) (m / 2.0)`', why: '`m / 2.0` is `2.5`, but the cast to int truncates it to `2`.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Split the bill',
      body: `A group splits a restaurant bill. The input is the bill in dollars (a \`double\`), the tip percent (an \`int\`) and the number of people (an \`int\`), each on its own line.

Print two lines:
1. the total with tip, rounded to the nearest cent, like \`Total: 57.5\`
2. each person's share rounded **down** to whole dollars, like \`Each: 19\`

For a bill of \`50.0\`, a tip of \`15\` and \`3\` people, the total is \`57.5\` and each share is \`19.166...\`, so print \`Total: 57.5\` and \`Each: 19\`.

Use \`total = bill + bill * tip / 100.0\`. To round to the cent, use the scale-round-unscale trick from this lesson.`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        double bill = in.nextDouble();
        int tip = in.nextInt();
        int people = in.nextInt();

        double total = bill + bill * tip / 100.0;
        // round total to the nearest cent, then print both lines
        System.out.println("Total: " + total);
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        double bill = in.nextDouble();
        int tip = in.nextInt();
        int people = in.nextInt();

        double total = bill + bill * tip / 100.0;
        double rounded = (int) (total * 100 + 0.5) / 100.0;
        System.out.println("Total: " + rounded);
        System.out.println("Each: " + (int) (rounded / people));
    }
}
`,
      tests: [
        { name: 'The example from the task', stdin: '50.0\n15\n3\n', stdout: 'Total: 57.5\nEach: 19\n' },
        { name: 'Rounds to the cent', stdin: '19.99\n18\n2\n', stdout: 'Total: 23.59\nEach: 11\n' },
        { name: 'No tip, one person', stdin: '12.0\n0\n1\n', stdout: 'Total: 12.0\nEach: 12\n' },
      ],
      hints: [
        'Rounding to cents means: multiply by 100, round to a whole number, divide by 100.0.',
        'Round a positive number with `(int) (x + 0.5)`. So the cents version is `(int) (total * 100 + 0.5) / 100.0`.',
        'For the share, divide the rounded total by `people` and cast the result: `(int) (rounded / people)` chops the decimals, which is rounding down for positive numbers.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'int to double widens automatically. double to int needs a cast, `(int) x`, which truncates toward zero.',
        'Cast before dividing: `(double) a / b` gives the real quotient, `(double) (a / b)` does not.',
        'Round positive numbers with `(int) (x + 0.5)` and negative ones with `(int) (x - 0.5)`.',
        'ints range from `Integer.MIN_VALUE` to `Integer.MAX_VALUE`; going past either end wraps around (overflow).',
        'doubles carry small round-off errors, so `0.1 + 0.2` is not exactly `0.3`.',
      ],
      mistakes: [
        'Expecting `(int) 2.9` to be `3`.',
        'Casting after the division already happened: `(double) (7 / 2)` is `3.0`.',
        'Writing `(int) x + 0.5` and getting a double back.',
        'Assuming a sum that overflows will crash. It silently wraps to a negative number.',
      ],
    },
  ],
};
