export default {
  id: 'while-loops',
  title: 'Repeating with while',
  minutes: 30,
  summary: 'Repeat code while a condition holds, trace a loop step by step, and spot off-by-one and infinite loops before they happen.',
  topics: ['2.7'],
  steps: [
    {
      kind: 'explain',
      title: 'Keep stirring until it thickens',
      body: `A recipe says "stir until the sauce thickens". You do not know in advance how many stirs that takes; you check, stir, check again. That is a **loop**: repeat something while a condition is true.

\`\`\`java
while (condition) {
    // body: runs again and again while condition is true
}
\`\`\`

Java checks the condition. If it is \`true\`, the body runs once, then Java goes back and checks again. The moment the condition is \`false\`, Java skips past the loop. If the condition is false the very first time, the body runs **zero** times.

Every working loop has three parts. Forget one and it breaks:

1. **Initialize** a variable before the loop.
2. **Test** it in the condition.
3. **Update** it in the body, so the loop moves toward stopping.`,
    },
    {
      kind: 'example',
      title: 'A countdown',
      body: 'Change the starting value of `n` to 0 and run it. How many times does the body run?',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int n = 3;              // initialize
        while (n > 0) {         // test
            System.out.println(n);
            n--;                // update
        }
        System.out.println("Liftoff");
    }
}
`,
      output: '3\n2\n1\nLiftoff\n',
    },
    {
      kind: 'explain',
      title: 'Tracing a loop on paper',
      body: `To know exactly what a loop does, **trace** it: make a table with a column per variable and a row per check of the condition. AP questions expect you to do this by hand.

\`\`\`java
int sum = 0;
int k = 1;
while (k <= 4) {
    sum += k;
    k++;
}
\`\`\`

Each row below is one pass through the body. After the fourth pass \`k\` is 5, the test \`5 <= 4\` is false, and the loop ends with \`sum\` equal to 10.`,
      diagram: { type: 'trace', columns: ['pass', 'k at the test', 'k <= 4', 'sum after the body'], rows: [[1, 1, 'true', 1], [2, 2, 'true', 3], [3, 3, 'true', 6], [4, 4, 'true', 10], ['-', 5, 'false', 'loop ends']] },
    },
    {
      kind: 'predict',
      body: 'Trace it. Type exactly what prints.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int x = 1;
        int count = 0;
        while (x < 20) {
            x = x * 3;
            count++;
        }
        System.out.println(x + " " + count);
    }
}
`,
      output: '27 3\n',
      explain: `x goes 1, 3, 9, 27. Each multiply happens inside the body, so the checks are: \`1 < 20\` true (x becomes 3), \`3 < 20\` true (x becomes 9), \`9 < 20\` true (x becomes 27), \`27 < 20\` false. The body ran 3 times and x ends past 20 because the check only happens at the top.`,
    },
    {
      kind: 'explain',
      title: 'The two classic loop bugs',
      body: `**Off by one.** The loop runs one time too many or too few, usually because of \`<\` vs \`<=\` or starting at 0 vs 1. To print 1 to 5 you need \`k <= 5\` starting at 1, or \`k < 6\`. Always check the first and the last pass.

**Infinite loop.** The condition never becomes false, so the program never ends. The usual causes:

- forgetting the update (\`n--\` is missing),
- updating in the wrong direction (\`n++\` when counting down),
- a stray semicolon: \`while (n > 0);\` makes an empty loop body that runs forever, and the block below it is not part of the loop.

The browser runner stops a program after a few seconds and tells you it probably looped forever.`,
    },
    {
      kind: 'check',
      title: 'How many times?',
      prompt: 'How many times is "hi" printed?\n\n```java\nint i = 10;\nwhile (i >= 0) {\n    System.out.println("hi");\n    i -= 3;\n}\n```',
      options: [
        { text: '4', correct: true, why: 'i takes the values 10, 7, 4, 1 at the tests that pass. After that i is -2 and `-2 >= 0` is false.' },
        { text: '3', why: 'Check the last pass: when i is 1, `1 >= 0` is still true, so it prints a fourth time.' },
        { text: '5', why: 'After 1, the next value is -2, which fails the test. Only 10, 7, 4 and 1 pass.' },
        { text: 'It never stops', why: 'i goes down by 3 each time, so it eventually drops below 0 and the loop ends.' },
      ],
    },
    {
      kind: 'explain',
      title: 'Peeling off digits',
      body: `A classic while loop takes a number apart one digit at a time using the two tools from the expressions lesson:

- \`n % 10\` is the **last digit** of n.
- \`n / 10\` **drops** the last digit (integer division).

\`\`\`java
int n = 4096;
int sum = 0;
while (n > 0) {
    sum += n % 10;   // add the last digit
    n /= 10;         // remove it
}
// sum is 4 + 0 + 9 + 6 = 19
\`\`\`

You do not know how many digits there are in advance, which is exactly when a while loop beats counting.

Another use: a **sentinel** loop that reads input until a special stop value, like reading scores until \`-1\`. With Scanner, \`while (in.hasNextInt())\` keeps reading as long as there are numbers left.`,
    },
    {
      kind: 'predict',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int n = 507;
        String backwards = "";
        while (n > 0) {
            backwards += n % 10;
            n = n / 10;
        }
        System.out.println(backwards);
        System.out.println(n);
    }
}
`,
      output: '705\n0\n',
      choices: ['705\n0\n', '75\n0\n', '705\n507\n', '507\n0\n'],
      explain: `The last digits come off in order: 7, then 0 (from 50), then 5. Each is joined onto the string, giving "705". The zero is kept because \`50 % 10\` is 0 and \`"7" + 0\` is "70". The loop stops when n reaches 0, and that 0 is what the last line prints: the loop used up the original value.`,
    },
    {
      kind: 'check',
      title: 'Find the infinite loop',
      prompt: 'Which loop never ends? Assume each starts with `int n = 5;`.',
      options: [
        { text: '```java\nwhile (n != 0) {\n    n -= 2;\n}\n```', correct: true, why: 'n goes 5, 3, 1, -1, -3... It skips right over 0, so `n != 0` is always true. Test with `>` or `<` when stepping by more than 1.' },
        { text: '```java\nwhile (n > 0) {\n    n -= 2;\n}\n```', why: 'n goes 5, 3, 1, -1. At -1 the test fails and the loop ends.' },
        { text: '```java\nwhile (n < 100) {\n    n *= 2;\n}\n```', why: 'n doubles 5, 10, 20, 40, 80, 160, and 160 fails the test.' },
        { text: '```java\nwhile (n > 10) {\n    n++;\n}\n```', why: 'This looks dangerous, but `5 > 10` is false at the start, so the body runs zero times.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Savings goal',
      body: `You put money into savings that grows by a fixed percent each year. Read three numbers: the starting amount (a \`double\`), the yearly interest percent (an \`int\`) and the goal (a \`double\`).

Using a while loop, find how many **whole years** it takes for the balance to reach **at least** the goal. Each year, \`balance = balance + balance * percent / 100.0\`. Print:

\`\`\`
Years: 8
\`\`\`

If the starting amount already meets the goal, the answer is \`Years: 0\`.`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        double balance = in.nextDouble();
        int percent = in.nextInt();
        double goal = in.nextDouble();
        int years = 0;
        // grow the balance one year at a time until it reaches the goal
        System.out.println("Years: " + years);
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        double balance = in.nextDouble();
        int percent = in.nextInt();
        double goal = in.nextDouble();
        int years = 0;
        while (balance < goal) {
            balance = balance + balance * percent / 100.0;
            years++;
        }
        System.out.println("Years: " + years);
    }
}
`,
      tests: [
        { name: 'Doubling at 10 percent', stdin: '1000 10 2000\n', stdout: 'Years: 8\n' },
        { name: 'One year is enough', stdin: '100 5 105\n', stdout: 'Years: 1\n' },
        { name: 'Already at the goal', stdin: '500 3 500\n', stdout: 'Years: 0\n' },
        { name: 'A slow climb', stdin: '50 2 60\n', stdout: 'Years: 10\n' },
      ],
      hints: [
        'Loop while you have not reached the goal yet: `while (balance < goal)`.',
        'Inside the body do two things: grow the balance by one year, and add 1 to `years`.',
        'Check the edge case: if `balance` starts equal to `goal`, the condition is false at once and `years` stays 0, which is right.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A while loop checks its condition before every pass and may run zero times.',
        'Every loop needs an initialize, a test and an update that moves toward the end.',
        'Trace loops with a table: one column per variable, one row per pass.',
        '`n % 10` is the last digit and `n / 10` removes it.',
        'Use a while loop when you do not know in advance how many passes you need.',
      ],
      mistakes: [
        'Forgetting the update, or updating in the wrong direction, causing an infinite loop.',
        'A semicolon after the condition: `while (n > 0);`.',
        'Testing `!=` when the variable can step past the stop value.',
        'Off by one: using `<` where `<=` was needed, or the reverse.',
      ],
    },
  ],
};
