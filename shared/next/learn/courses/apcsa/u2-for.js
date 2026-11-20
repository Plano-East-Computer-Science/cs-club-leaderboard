export default {
  id: 'for-loops',
  title: 'Counting with for',
  minutes: 25,
  summary: 'Write counting loops in one line with for, convert them to and from while, and work out exactly how many times a loop runs.',
  topics: ['2.8'],
  steps: [
    {
      kind: 'explain',
      title: 'Laps around a track',
      body: `When the coach says "run 8 laps", you know the count before you start. Loops that count are so common that Java has a compact form for them, the **for loop**, which puts all three loop parts on one line:

\`\`\`java
for (int lap = 1; lap <= 8; lap++) {
    System.out.println("Lap " + lap);
}
\`\`\`

Inside the parentheses, separated by semicolons:

1. **Initialize**: \`int lap = 1\` runs once, before anything else.
2. **Test**: \`lap <= 8\` is checked before every pass, exactly like a while loop.
3. **Update**: \`lap++\` runs at the end of every pass, after the body.

It does the same thing as the while loop version; it just keeps the counting parts together where you can see them.`,
    },
    {
      kind: 'example',
      title: 'Count up, down, and by steps',
      body: 'Change the numbers in the headers. Can you make the middle loop print 20, 15, 10, 5, 0?',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        for (int i = 0; i < 5; i++) {
            System.out.print(i + " ");
        }
        System.out.println();

        for (int i = 10; i >= 0; i -= 2) {
            System.out.print(i + " ");
        }
        System.out.println();

        for (int i = 1; i <= 100; i *= 3) {
            System.out.print(i + " ");
        }
        System.out.println();
    }
}
`,
      output: '0 1 2 3 4 \n10 8 6 4 2 0 \n1 3 9 27 81 \n',
    },
    {
      kind: 'explain',
      title: 'for and while are interchangeable',
      body: `Any for loop can be rewritten as a while loop by moving the three parts:

\`\`\`java
for (int i = 0; i < n; i++) {        int i = 0;
    body;                            while (i < n) {
}                                        body;
                                         i++;
                                     }
\`\`\`

One real difference: a variable declared in the for header, like \`i\`, only exists **inside** the loop. After the closing brace it is gone, and using it is a "cannot find symbol" error. If you need the final value afterwards, declare the variable before the loop.

Pick \`for\` when you are counting a known number of passes, and \`while\` when you are waiting for something to happen.`,
    },
    {
      kind: 'explain',
      title: 'How many times does it run?',
      body: `AP questions love "how many times is this executed". For a loop that counts by 1:

- \`for (int i = a; i < b; i++)\` runs **b - a** times.
- \`for (int i = a; i <= b; i++)\` runs **b - a + 1** times.

So \`for (int i = 0; i < 10; i++)\` runs 10 times, and \`for (int i = 3; i <= 7; i++)\` runs 5 times (3, 4, 5, 6, 7).

For anything trickier, such as stepping by 3 or multiplying, list the values the variable takes and count them. That never fails.`,
    },
    {
      kind: 'check',
      title: 'Count the passes',
      prompt: 'How many times does the body of this loop run?\n\n```java\nfor (int k = 5; k <= 20; k += 5) {\n    total += k;\n}\n```',
      options: [
        { text: '4', correct: true, why: 'k takes the values 5, 10, 15 and 20. After that k is 25 and the test fails.' },
        { text: '3', why: 'The test is `<=`, so the pass with k equal to 20 still runs.' },
        { text: '15', why: 'That is 20 - 5, which would be right only if k went up by 1 each time with `<`.' },
        { text: '5', why: 'List the values: 5, 10, 15, 20. There are four of them.' },
      ],
    },
    {
      kind: 'predict',
      body: 'This is an accumulator: a variable that collects a result across passes. Type the output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int product = 1;
        String evens = "";
        for (int i = 1; i <= 6; i++) {
            if (i % 2 == 0) {
                evens += i;
            } else {
                product *= i;
            }
        }
        System.out.println(product);
        System.out.println(evens);
    }
}
`,
      output: '15\n246\n',
      explain: `Odd values 1, 3 and 5 are multiplied into \`product\`: 1 * 1 * 3 * 5 = 15. Even values 2, 4 and 6 are joined onto the string \`evens\`, which starts empty, giving "246" (string joining, not adding). An accumulator for a product must start at 1; starting at 0 would make every product 0.`,
    },
    {
      kind: 'check',
      title: 'Same loop, different form',
      prompt: 'Which while loop prints exactly the same thing as this for loop?\n\n```java\nfor (int i = 2; i < 8; i += 2) {\n    System.out.print(i);\n}\n```',
      options: [
        { text: '```java\nint i = 2;\nwhile (i < 8) {\n    System.out.print(i);\n    i += 2;\n}\n```', correct: true, why: 'Initialize before, test in the condition, update at the end of the body. Both print 246.' },
        { text: '```java\nint i = 2;\nwhile (i < 8) {\n    i += 2;\n    System.out.print(i);\n}\n```', why: 'The update happens before the print, so this prints 468. The update belongs at the end of the body.' },
        { text: '```java\nint i = 2;\nwhile (i <= 8) {\n    System.out.print(i);\n    i += 2;\n}\n```', why: '`<=` lets the pass with i equal to 8 run, so this prints 2468.' },
        { text: '```java\nwhile (int i = 2; i < 8) {\n    System.out.print(i);\n    i += 2;\n}\n```', why: 'A while loop has only a condition in its parentheses. This does not compile.' },
      ],
    },
    {
      kind: 'predict',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int count = 0;
        for (int i = 10; i > 0; i /= 2) {
            count++;
        }
        System.out.println(count);
    }
}
`,
      output: '4\n',
      choices: ['4\n', '5\n', '3\n', '10\n'],
      explain: `List the values of i at each test: 10, 5, 2, 1 all pass, then \`1 / 2\` is 0 (integer division), and \`0 > 0\` is false. Four passes. This "halve until done" loop shows up in binary search later in the course.`,
    },
    {
      kind: 'exercise',
      title: 'Times table row',
      body: `Read two ints, \`n\` and \`count\`. Print the first \`count\` multiples of \`n\` on one line, separated by single spaces, then on the next line print their sum.

For \`7 4\`:

\`\`\`
7 14 21 28
Sum: 70
\`\`\`

Be careful: there must be no space after the last number. (If \`count\` is 0, the first line is empty and the sum is 0.)`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int count = in.nextInt();
        // print the multiples, then the sum
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int count = in.nextInt();
        String line = "";
        int sum = 0;
        for (int i = 1; i <= count; i++) {
            if (i > 1) {
                line += " ";
            }
            line += n * i;
            sum += n * i;
        }
        System.out.println(line);
        System.out.println("Sum: " + sum);
    }
}
`,
      tests: [
        { name: 'Four sevens', stdin: '7 4\n', stdout: '7 14 21 28\nSum: 70\n' },
        { name: 'Just one', stdin: '5 1\n', stdout: '5\nSum: 5\n' },
        { name: 'Zero multiples', stdin: '9 0\n', stdout: '\nSum: 0\n' },
        { name: 'Negative n', stdin: '-3 3\n', stdout: '-3 -6 -9\nSum: -18\n' },
      ],
      hints: [
        'Loop `i` from 1 to `count` with `<=`; the multiple on each pass is `n * i`.',
        'Keep two accumulators: a String for the line (start at `""`) and an int for the sum (start at 0).',
        'Only add a space before a number when it is not the first one: `if (i > 1) line += " ";`.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A for loop puts initialize, test and update in one header; the update runs after each pass.',
        'Every for loop can be written as a while loop, and the reverse.',
        '`i < b` starting at a runs b - a times; `i <= b` runs b - a + 1 times.',
        'Accumulators start at 0 for sums, 1 for products and "" for strings.',
      ],
      mistakes: [
        'Using the loop variable after the loop when it was declared in the header.',
        'A semicolon right after the header: `for (...);` runs an empty body.',
        'Starting a product accumulator at 0.',
        'Changing the loop variable inside the body as well as in the header.',
      ],
    },
  ],
};
