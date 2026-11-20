export default {
  id: 'if-statements',
  title: 'Decisions with if',
  minutes: 25,
  summary: 'How a program asks a true-or-false question and runs different code depending on the answer.',
  topics: ['2.1', '2.2', '2.3'],
  steps: [
    {
      kind: 'explain',
      title: 'Three moves every algorithm is made of',
      body: `Think about your morning. You wake up, brush your teeth, get dressed: one step after another. That is **sequencing**.

Then you look outside. *If* it is raining, you grab an umbrella; otherwise you do not. That is **selection**: a question with a yes or no answer decides what happens next.

Then you hit snooze, and hit it again, and again, *until* it is actually time to get up. That is **repetition**: doing the same thing over while some condition holds.

Every algorithm, from a calculator to a video game, is built from just these three moves. People often sketch them as a **flowchart**:

- a rectangle is an action ("grab umbrella"),
- a diamond is a yes or no question ("raining?"), with one arrow leaving for *yes* and one for *no*,
- arrows show which box comes next. An arrow that loops back up to an earlier diamond is repetition.

Unit 1 was all sequencing. This lesson is the diamond: how Java asks a question and picks a path.`,
    },
    {
      kind: 'explain',
      title: 'Questions with true or false answers',
      body: `A question in Java is a **boolean expression**: code that works out to either \`true\` or \`false\`. The most common ones compare two values with a **relational operator**:

- \`<\` less than, \`>\` greater than
- \`<=\` less than or equal, \`>=\` greater than or equal
- \`==\` equal to (two equals signs)
- \`!=\` not equal to

With the variables in the diagram, \`age >= 16\` is \`true\`, \`age == 15\` is \`false\`, and \`gpa < 3.5\` is \`false\`.

A boolean expression is a value like any other, so you can store it and print it:

\`\`\`java
boolean canDrive = age >= 16;
System.out.println(canDrive);   // true
\`\`\`

One warning to carry through the whole unit: a single \`=\` **stores** a value, and a double \`==\` **asks** whether two values are equal. They look alike and do completely different jobs.`,
      diagram: {
        type: 'vars',
        vars: [
          { name: 'age', type: 'int', value: '16' },
          { name: 'gpa', type: 'double', value: '3.8' },
        ],
      },
    },
    {
      kind: 'predict',
      body: 'Type exactly what this prints, one line per line of output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int score = 85;
        System.out.println(score > 90);
        System.out.println(score >= 85);
        System.out.println(score != 85);
        boolean passed = score >= 70;
        System.out.println("Passed: " + passed);
    }
}
`,
      output: 'false\ntrue\nfalse\nPassed: true\n',
      explain: `Each comparison is worked out to a boolean, and \`println\` prints that boolean as the word \`true\` or \`false\`.

1. \`85 > 90\` is \`false\`.
2. \`85 >= 85\` is \`true\`, because \`>=\` includes the equal case.
3. \`85 != 85\` asks "are they different?" They are not, so it is \`false\`.
4. \`passed\` stores the result of \`85 >= 70\`, which is \`true\`, and \`+\` joins it onto the string like any other value.`,
    },
    {
      kind: 'explain',
      title: 'The if statement',
      body: `An **if statement** runs a block of code only when a condition is true. Think of a door with a bouncer: if you are on the list, you go through the door and do what is inside; if not, you skip it and carry on down the hall.

\`\`\`java
if (battery < 20) {
    System.out.println("Low battery");
}
System.out.println("Done");
\`\`\`

Read it as: *if battery is less than 20, then do everything between the braces.*

- The condition goes in **parentheses** and must be a boolean expression.
- The statements between \`{\` and \`}\` are the **body**, also called a **block**.
- When the condition is \`false\`, Java jumps straight past the closing brace.
- Either way, the program continues with the next statement after the block. \`Done\` prints every time.

Notice there is no semicolon after \`if (battery < 20)\`. The if is not finished until its body is.`,
    },
    {
      kind: 'example',
      title: 'Run it',
      body: 'Run it once. Then change `battery` to `50` and run it again: both lines inside the braces disappear, but the last line still prints. Try `20` too, and decide before you run whether `20 < 20` is true.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int battery = 14;
        System.out.println("Battery at " + battery + "%");
        if (battery < 20) {
            System.out.println("Low battery. Plug in soon.");
            System.out.println("Low power mode is on.");
        }
        System.out.println("Done checking.");
    }
}
`,
      output: 'Battery at 14%\nLow battery. Plug in soon.\nLow power mode is on.\nDone checking.\n',
    },
    {
      kind: 'explain',
      title: 'Two roads: if and else',
      body: `Often you want one thing when the answer is yes and a different thing when it is no. Add an **else** block:

\`\`\`java
if (number % 2 == 0) {
    System.out.println(number + " is even");
} else {
    System.out.println(number + " is odd");
}
\`\`\`

\`number % 2\` is the remainder after dividing by 2, which is \`0\` exactly when the number is even.

In flowchart terms this is a diamond with two arrows that meet again below. The rule to remember: **exactly one** of the two blocks runs, never both and never neither. If the condition is true, the if block runs and the else block is skipped. If it is false, the if block is skipped and the else block runs.

The \`else\` has no condition of its own. It means "in every other case", so it must come right after the closing brace of an if.`,
    },
    {
      kind: 'explain',
      title: 'What belongs to the if',
      body: `Java decides what is inside an if by looking at **braces**, never at indentation.

Without braces, only the **one** statement right after the condition belongs to the if:

\`\`\`java
if (temp > 80)
    System.out.println("Shorts weather");
    System.out.println("Bring water");   // NOT inside the if
\`\`\`

The second line is indented as if it were inside, but Java ignores spacing. \`Bring water\` prints every time.

A stray semicolon is even sneakier:

\`\`\`java
if (temp > 100);
{
    System.out.println("Stay inside");
}
\`\`\`

The semicolon is a complete, empty statement, and *that* is the whole body of the if. The block underneath is no longer attached to anything, so it always runs. The compiler accepts this without complaint.

The habit that prevents both bugs: **always use braces**, and never put a semicolon right after \`if (...)\`.`,
    },
    {
      kind: 'predict',
      body: 'The indentation is lying to you. Pick what really prints.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int temp = 75;
        if (temp > 80)
            System.out.println("Shorts weather");
            System.out.println("Bring water");
        if (temp > 100);
        {
            System.out.println("Stay inside");
        }
        System.out.println("Have a good day");
    }
}
`,
      output: 'Bring water\nStay inside\nHave a good day\n',
      choices: [
        'Have a good day\n',
        'Bring water\nStay inside\nHave a good day\n',
        'Bring water\nHave a good day\n',
        'Shorts weather\nBring water\nStay inside\nHave a good day\n',
      ],
      explain: `\`75 > 80\` is false, so the one statement that belongs to the first if, \`Shorts weather\`, is skipped. \`Bring water\` is not part of the if (no braces), so it runs.

\`75 > 100\` is also false, but the body of the second if is just the empty statement \`;\`. The block with \`Stay inside\` is a separate statement that always runs.

Then \`Have a good day\` prints as usual. Two lines printed that look like they should have been skipped.`,
    },
    {
      kind: 'check',
      title: 'One equals sign',
      prompt: 'Consider the following code segment. What happens when it is compiled and run?',
      code: String.raw`int lives = 3;
if (lives = 0) {
    System.out.println("Game over");
}
System.out.println("Lives: " + lives);`,
      options: [
        { text: 'The code does not compile.', correct: true, why: 'A single `=` is assignment, so `lives = 0` stores 0 and has the int value 0. An if condition must be a boolean, and Java will not treat an int as true or false. The compiler reports "incompatible types: int cannot be converted to boolean".' },
        { text: 'It prints `Lives: 3`', why: 'That would be the result of `lives == 0`, which is false. A single `=` does not compare; it assigns.' },
        { text: 'It prints `Game over` and then `Lives: 0`', why: 'This is what happens in some languages like C, which treat 0 and other numbers as true or false. Java does not, so it refuses to compile.' },
        { text: 'It compiles, then crashes with an exception when the if runs.', why: 'This mistake is caught by the compiler before anything runs, so there is nothing to crash.' },
      ],
    },
    {
      kind: 'example',
      title: 'Careful with doubles',
      body: `A \`double\` is stored in binary, and most decimals, like \`0.1\`, cannot be stored exactly, the same way 1/3 cannot be written exactly as a decimal. Tiny rounding errors creep in, so two doubles that *should* be equal often are not, and \`==\` says \`false\`.

The fix is to ask whether they are **close enough**: take the size of the difference with \`Math.abs\` and check that it is smaller than a tiny tolerance. Run it and see all three lines.`,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        double total = 0.1 + 0.2;
        System.out.println(total);
        System.out.println(total == 0.3);
        System.out.println(Math.abs(total - 0.3) < 0.000001);
    }
}
`,
      output: '0.30000000000000004\nfalse\ntrue\n',
    },
    {
      kind: 'check',
      title: 'Comparing doubles',
      prompt: 'A `double` named `cost` was computed by adding up several prices. Which condition is the most reliable way to test whether `cost` is 4.95?',
      options: [
        { text: '`Math.abs(cost - 4.95) < 0.0001`', correct: true, why: 'This asks whether the two values are within a tiny distance of each other, so small rounding errors from the additions do not matter.' },
        { text: '`cost == 4.95`', why: 'This compiles, but after several additions `cost` may be 4.950000000000001, and `==` would say false.' },
        { text: '`cost.equals(4.95)`', why: '`double` is a primitive type, not an object, so it has no methods. This does not compile.' },
        { text: '`(int) cost == 4`', why: 'Casting cuts off the decimal part, so this is true for any cost from 4.0 up to 4.99, not just 4.95.' },
      ],
    },
    {
      kind: 'check',
      title: 'Pass or fail',
      prompt: 'A program should print `Pass` when `score` is 60 or more and `Fail` otherwise, printing exactly one word. Which of the code segments below work correctly for every int `score`?',
      code: String.raw`// I
if (score >= 60) {
    System.out.println("Pass");
} else {
    System.out.println("Fail");
}

// II
if (score > 60) {
    System.out.println("Pass");
} else {
    System.out.println("Fail");
}

// III
if (score >= 60) {
    System.out.println("Pass");
}
System.out.println("Fail");`,
      options: [
        { text: 'I only', correct: true, why: 'I is the only one that handles every score. Exactly one of its two blocks runs, and `>=` includes 60.' },
        { text: 'I and II', why: 'II gets the boundary wrong. When `score` is exactly 60, `60 > 60` is false, so it prints `Fail` for a passing score. Always test the exact cutoff value.' },
        { text: 'I and III', why: 'III has no `else`, so `Fail` is outside the if and prints every time. A score of 75 prints both `Pass` and `Fail`.' },
        { text: 'I, II, and III', why: 'II fails at exactly 60, and III prints `Fail` even after printing `Pass`.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Free shipping',
      body: `An online store gives free shipping on orders of **35 dollars or more**. Smaller orders pay a flat 6 dollar shipping fee.

Your program reads one int, the cart total in dollars. Then:

- If the total is 35 or more, print \`Shipping: free\`.
- Otherwise print \`Shipping: 6\` and then \`Add X more for free shipping\`, where X is how many dollars short of 35 the cart is.
- In both cases, finish with \`You pay: \` followed by the total including any shipping.

For a cart of 34, the output is:

\`\`\`
Shipping: 6
Add 1 more for free shipping
You pay: 40
\`\`\`

For a cart of 50, it is \`Shipping: free\` then \`You pay: 50\`. Print nothing else, not even a prompt.`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int total = in.nextInt();
        int pay = total;

        // decide on shipping here

        System.out.println("You pay: " + pay);
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int total = in.nextInt();
        int pay = total;

        if (total >= 35) {
            System.out.println("Shipping: free");
        } else {
            System.out.println("Shipping: 6");
            System.out.println("Add " + (35 - total) + " more for free shipping");
            pay = total + 6;
        }

        System.out.println("You pay: " + pay);
    }
}
`,
      tests: [
        { name: 'A big order ships free', stdin: '50\n', stdout: 'Shipping: free\nYou pay: 50\n' },
        { name: 'Exactly 35 ships free', stdin: '35\n', stdout: 'Shipping: free\nYou pay: 35\n' },
        { name: 'One dollar short', stdin: '34\n', stdout: 'Shipping: 6\nAdd 1 more for free shipping\nYou pay: 40\n' },
        { name: 'An empty cart', stdin: '0\n', stdout: 'Shipping: 6\nAdd 35 more for free shipping\nYou pay: 6\n' },
      ],
      hints: [
        'This is a yes or no question with something to do on each side, so you want an `if` with an `else`. What is the condition, and does it need `>` or `>=`?',
        'In the else block, print two lines and also change `pay` so the last line includes the fee. How many dollars short is the cart? `35 - total`.',
        'Inside the else: `System.out.println("Add " + (35 - total) + " more for free shipping");` and `pay = total + 6;`. The parentheses make Java subtract before joining strings.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Algorithms are built from sequencing, selection (if) and repetition (loops). A flowchart diamond is a yes or no question.',
        'A boolean expression is true or false. Relational operators are `<`, `>`, `<=`, `>=`, `==` and `!=`.',
        'An `if` runs its block only when the condition is true. With an `else`, exactly one of the two blocks runs.',
        'Braces decide what is inside an if, not indentation. Always use them.',
        'Compare doubles with a tolerance, like `Math.abs(a - b) < 0.000001`, not with `==`.',
      ],
      mistakes: [
        'Writing `=` (store) when you mean `==` (compare).',
        'Putting a semicolon right after the condition: `if (x > 3);` makes the if do nothing and the block always run.',
        'Leaving out braces and indenting a second line, expecting it to be inside the if.',
        'Using `>` when the rule says "or more", so the exact cutoff value takes the wrong path.',
        'Printing the result in both branches by forgetting the `else`.',
      ],
    },
  ],
};
