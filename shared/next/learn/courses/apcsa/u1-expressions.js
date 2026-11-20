export default {
  id: 'expressions',
  title: 'Arithmetic expressions',
  minutes: 30,
  summary: 'Do math in Java with + - * / %, know when division drops the decimal, and update variables with shortcuts like += and ++.',
  topics: ['1.3', '1.6'],
  steps: [
    {
      kind: 'explain',
      title: 'Splitting a pizza',
      body: `Fourteen slices of pizza, four friends. How many slices does each person get?

You would not hand anyone three and a half slices of a pizza that is already cut. Each friend gets **3** whole slices, and **2** are left in the box. Java does exactly this when it divides two whole numbers:

- \`14 / 4\` is \`3\`. When both sides are \`int\`, \`/\` gives the whole number of times it goes in and **drops the rest**. This is **integer division**. It does not round: \`19 / 4\` is \`4\`, not 5.
- \`14 % 4\` is \`2\`. The \`%\` operator (say "mod") gives the **remainder**, the slices left in the box.

The other three operators do what you expect: \`+\` adds, \`-\` subtracts, \`*\` multiplies (there is no \`x\` for times).

A piece of code that works out to a value, like \`14 / 4\` or \`price * 2\`, is called an **expression**. Anywhere Java expects a value, you can put an expression instead.`,
    },
    {
      kind: 'example',
      title: 'Java as a calculator',
      body: 'Run it and compare each line with what you expected. Then change the numbers: try `19` slices, or `5` friends.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int slices = 14;
        int friends = 4;
        System.out.println("Each friend gets " + (slices / friends));
        System.out.println("Left in the box: " + (slices % friends));
        System.out.println("Exact share: " + (14.0 / 4));
        System.out.println("Total cost: " + (3 * 12 + 5));
    }
}
`,
      output: 'Each friend gets 3\nLeft in the box: 2\nExact share: 3.5\nTotal cost: 41\n',
    },
    {
      kind: 'predict',
      body: 'Two test scores, and we want the average. What prints?',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int test1 = 7;
        int test2 = 8;
        double average = (test1 + test2) / 2;
        System.out.println(average);
    }
}
`,
      output: '7.0\n',
      choices: ['7.5\n', '7.0\n', '7\n', '8.0\n'],
      explain: `Java works out the right side first and only then stores it.

1. \`test1 + test2\` is \`15\`, an \`int\`.
2. \`15 / 2\` has an \`int\` on both sides, so it is integer division: \`7\`. The \`.5\` is gone right here.
3. Now \`7\` is stored in a \`double\` box, which shows it as \`7.0\`.

The \`double\` on the left came too late to help. The decimal was lost in step 2. It prints \`7.0\` rather than \`7\` because the box is a \`double\`, and a double always prints with a decimal point.`,
    },
    {
      kind: 'explain',
      title: 'When division keeps the decimal',
      body: `The rule is about the two values right next to the \`/\`:

- **Both are \`int\`:** integer division, the result is an \`int\`. \`15 / 2\` is \`7\`.
- **At least one is \`double\`:** real division, the result is a \`double\`. \`15 / 2.0\`, \`15.0 / 2\` and \`15.0 / 2.0\` are all \`7.5\`.

The same goes for \`+\`, \`-\`, \`*\` and \`%\`: two ints give an int, and as soon as a double is involved the answer is a double. So \`3 * 2.0\` is \`6.0\`.

To fix the average from the last step, make one side a double: \`(test1 + test2) / 2.0\`.

One more trap. Dividing an \`int\` by zero, like \`10 / 0\`, crashes the program with an **ArithmeticException**, a run-time error. The compiler cannot catch it, because the zero might come from a variable or from input. (Dividing a \`double\` by zero does not crash; it gives the strange value \`Infinity\`.)`,
    },
    {
      kind: 'check',
      title: 'Which one is 2.5?',
      prompt: 'Which of the following expressions evaluates to `2.5`?',
      options: [
        { text: '`5 / 2.0`', correct: true, why: '`2.0` is a double, so this is real division and keeps the decimal: `2.5`.' },
        { text: '`5 / 2`', why: 'Both sides are `int`, so this is integer division. The result is `2`; the `.5` is dropped.' },
        { text: '`10 / 4`', why: 'The math answer is 2.5, but both sides are `int`, so Java gives `2`. The values do not matter, only the types.' },
        { text: '`5 % 2`', why: '`%` gives the remainder, not the quotient. 5 divided by 2 is 2 remainder 1, so this is `1`.' },
      ],
    },
    {
      kind: 'explain',
      title: 'Which operator goes first',
      body: `Java follows the same order you learned in math class, with \`%\` joining the multiply group:

1. Anything in **parentheses**.
2. \`*\`, \`/\` and \`%\`, from **left to right**.
3. \`+\` and \`-\`, from **left to right**.

"Left to right" matters more than people expect. Here are three worked out:

\`\`\`java
2 + 3 * 4        // 3 * 4 first: 2 + 12 is 14
20 / 4 * 2       // left to right: 20 / 4 is 5, then 5 * 2 is 10 (not 20 / 8)
10 - 4 - 3       // left to right: 6 - 3 is 3 (not 10 - 1)
\`\`\`

When an expression mixes ints and doubles, apply the type rule one operation at a time, in this order. In \`1 / 2 * 4.0\`, the \`1 / 2\` happens first and is integer division, so it is \`0\`, and \`0 * 4.0\` is \`0.0\`. If in doubt, add parentheses. They cost nothing and make your intent obvious.`,
    },
    {
      kind: 'check',
      title: 'Order of operations',
      prompt: 'What is the value of the expression `17 % 5 + 12 / 5 * 2`?',
      options: [
        { text: '`6`', correct: true, why: '`%`, `/` and `*` go first, left to right: `17 % 5` is 2, `12 / 5` is 2 (integer division), `2 * 2` is 4. Then `2 + 4` is 6.' },
        { text: '`6.8`', why: 'This treats `12 / 5` as 2.4. Both sides are `int`, so it is integer division and gives 2.' },
        { text: '`3`', why: 'This does `5 * 2` before `12 / 5`. Operators of the same level go left to right, so the division happens first.' },
        { text: '`7`', why: 'This treats `17 % 5` as 3, the quotient. `%` gives the remainder, which is 2.' },
      ],
    },
    {
      kind: 'explain',
      title: 'What % is good for',
      body: `The remainder sounds like a leftover from third grade, but programmers use it all the time:

- **Even or odd.** \`n % 2\` is \`0\` when \`n\` is even and \`1\` when it is odd. Same idea for any divisor: \`n % 3\` is \`0\` exactly when \`n\` is a multiple of 3.
- **The last digit.** \`n % 10\` is the ones digit: \`2763 % 10\` is \`3\`. And \`n / 10\` chops the last digit off: \`2763 / 10\` is \`276\`. Combine them to get any digit: \`2763 / 10 % 10\` is \`6\`.
- **Wrapping around.** Clocks and calendars go in circles. If it is 10 o'clock, 5 hours later is \`(10 + 5) % 12\`, which is \`3\`. Today is day 5 of the week (counting from 0); 10 days later is day \`(5 + 10) % 7\`, which is \`1\`.
- **Splitting units.** 135 minutes is \`135 / 60\` hours (\`2\`) and \`135 % 60\` minutes (\`15\`).

A detail for later: when the left side is negative, so is the remainder. \`-7 % 2\` is \`-1\`, not \`1\`.`,
    },
    {
      kind: 'predict',
      body: 'Type all four lines of output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int n = 2763;
        System.out.println(n % 10);
        System.out.println(n / 10 % 10);
        System.out.println(n / 100);
        System.out.println((10 + 5) % 12);
    }
}
`,
      output: '3\n6\n27\n3\n',
      explain: `Line by line:

1. \`2763 % 10\`: 2763 divided by 10 is 276 remainder **3**.
2. \`2763 / 10 % 10\`: left to right. \`2763 / 10\` is 276, then \`276 % 10\` is **6**, the tens digit.
3. \`2763 / 100\`: integer division drops the last two digits: **27**.
4. \`(10 + 5) % 12\`: parentheses first gives 15, and 15 divided by 12 is 1 remainder **3**. Five hours after 10 o'clock is 3 o'clock.`,
    },
    {
      kind: 'explain',
      title: 'Shortcuts for updating a variable',
      body: `Changing a variable based on its own value is so common that Java has shortcuts. Each pair below does exactly the same thing:

\`\`\`java
score = score + 10;     score += 10;
lives = lives - 1;      lives -= 1;
price = price * 2;      price *= 2;
total = total / 4;      total /= 4;
hour = hour % 12;       hour %= 12;
\`\`\`

These are **compound assignment operators**. Read \`score += 10\` as "add 10 to score."

Adding or subtracting exactly 1 has an even shorter form:

\`\`\`java
count++;    // same as count = count + 1;
count--;    // same as count = count - 1;
\`\`\`

\`++\` is the **increment** operator and \`--\` the **decrement** operator. On the AP exam they appear as statements on their own line, like above. Do not bury them inside a bigger expression.

The type rules still apply. If \`total\` is an \`int\` holding 7, \`total /= 2;\` leaves it at \`3\`.`,
    },
    {
      kind: 'explain',
      title: 'Tracing on paper',
      body: `When a code segment changes the same variables many times, do not try to hold it in your head. Make a table with one column per variable and one row per line, and fill it in as you go. This is called **tracing**, and it is the single most useful skill for the multiple-choice section.

\`\`\`java
int x = 4;
int y = 3;
x += y;
y = x % y;
x *= 2;
y--;
x /= 4;
\`\`\`

Each row shows the boxes **after** that line runs. Only the variable on the left of \`=\` changes; everything else is copied down from the row above. Look at the last row: \`14 / 4\` is integer division, so \`x\` ends at \`3\`.`,
      diagram: {
        type: 'trace',
        columns: ['statement', 'x', 'y'],
        rows: [
          ['int x = 4;', '4', ''],
          ['int y = 3;', '4', '3'],
          ['x += y;', '7', '3'],
          ['y = x % y;', '7', '1'],
          ['x *= 2;', '14', '1'],
          ['y--;', '14', '0'],
          ['x /= 4;', '3', '0'],
        ],
        caption: 'One row per statement. After the last line, x is 3 and y is 0.',
      },
    },
    {
      kind: 'check',
      title: 'Trace it',
      prompt: 'What is printed as a result of executing the following code segment?',
      code: String.raw`int a = 10;
a -= 3;
a *= 2;
a %= 5;
a++;
System.out.println(a);`,
      options: [
        { text: '`5`', correct: true, why: 'Trace it: 10, then 7, then 14, then `14 % 5` is 4, then `a++` makes it 5.' },
        { text: '`4`', why: 'This stops before the last line. `a++` adds 1 to `a`, so the 4 becomes 5 before it prints.' },
        { text: '`3`', why: 'This treats `a %= 5` like `a /= 5`, getting 2. `%=` stores the remainder, and 14 divided by 5 leaves 4.' },
        { text: '`0`', why: 'This reads `a -= 3` as `a = -3`. `-=` subtracts from the current value: 10 minus 3 is 7.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Screen time',
      body: `Your phone reports screen time in minutes, which is hard to read when the number is big. Write a program that reads one whole number, the total minutes, and prints it as hours and minutes.

For the input \`135\`, print exactly:

\`\`\`
2 h 15 min
\`\`\`

For \`59\` print \`0 h 59 min\`, and for \`0\` print \`0 h 0 min\`. The starter reads the number for you.`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int total = in.nextInt();
        int hours = 0;
        int minutes = total;
        System.out.println(hours + " h " + minutes + " min");
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int total = in.nextInt();
        int hours = total / 60;
        int minutes = total % 60;
        System.out.println(hours + " h " + minutes + " min");
    }
}
`,
      tests: [
        { name: '135 minutes', stdin: '135\n', stdout: '2 h 15 min\n' },
        { name: 'Exactly one hour', stdin: '60\n', stdout: '1 h 0 min\n' },
        { name: 'Less than an hour', stdin: '59\n', stdout: '0 h 59 min\n' },
        { name: 'No screen time at all', stdin: '0\n', stdout: '0 h 0 min\n' },
        { name: 'A whole day and then some', stdin: '1445\n', stdout: '24 h 5 min\n' },
      ],
      hints: [
        'Think of the pizza: the hours are how many whole groups of 60 fit in the total, and the minutes are what is left over.',
        'Integer division gives the whole groups, and `%` gives the leftover.',
        '`int hours = total / 60;` and `int minutes = total % 60;`',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'When both sides are `int`, `/` drops the decimal part (it does not round) and `%` gives the remainder.',
        'If either side is a `double`, the result is a `double`: `7 / 2` is 3 but `7 / 2.0` is 3.5.',
        'Order: parentheses, then `*` `/` `%` left to right, then `+` `-` left to right.',
        '`% 2` tests even or odd, `% 10` gets the last digit, `/ 10` drops it, and `%` wraps values around like a clock.',
        '`x += 5` means `x = x + 5`, and `x++` adds 1. Trace changing variables in a table, one row per line.',
      ],
      mistakes: [
        'Writing `double avg = (a + b) / 2;` with int `a` and `b`, and expecting the decimal to survive.',
        'Thinking integer division rounds: `19 / 4` is 4, not 5.',
        'Evaluating `20 / 4 * 2` as `20 / 8` instead of left to right.',
        'Typing `x =- 3` (which stores -3) when you meant `x -= 3`.',
        'Dividing an `int` by a variable that can be zero, which crashes with an ArithmeticException.',
      ],
    },
  ],
};
