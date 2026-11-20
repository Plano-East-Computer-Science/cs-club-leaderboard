export default {
  id: 'else-if',
  title: 'Else-if chains and compound conditions',
  minutes: 30,
  summary: 'Choosing between many paths with nested ifs and else-if chains, and combining conditions with and, or and not.',
  topics: ['2.4', '2.5'],
  steps: [
    {
      kind: 'explain',
      title: 'Decisions inside decisions',
      body: `You walk past a food truck. *If* you are hungry, you check your wallet: *if* you have 10 dollars, you get a burrito, otherwise you get chips. If you are not hungry, you never even look at your wallet.

That second question only gets asked when the first answer is yes. In Java, that is an if statement inside another one, called a **nested if**:

\`\`\`java
if (hungry) {
    if (money >= 10) {
        System.out.println("Burrito");
    } else {
        System.out.println("Chips");
    }
} else {
    System.out.println("Keep walking");
}
\`\`\`

Here \`hungry\` is a \`boolean\` variable. \`if (hungry)\` means the same as \`if (hungry == true)\`, just shorter.

Trace it with \`hungry\` true and \`money\` 6: the outer condition is true, so Java goes inside and asks the inner question. \`6 >= 10\` is false, so it prints \`Chips\`. With \`hungry\` false, Java skips the whole outer block, inner if and all, and prints \`Keep walking\`.`,
    },
    {
      kind: 'explain',
      title: 'Else-if chains: the first true answer wins',
      body: `Sometimes there are more than two paths. A letter grade has five. You could nest ifs five deep, but Java lets you line them up as an **else-if chain**:

\`\`\`java
if (score >= 90) {
    grade = "A";
} else if (score >= 80) {
    grade = "B";
} else if (score >= 70) {
    grade = "C";
} else if (score >= 60) {
    grade = "D";
} else {
    grade = "F";
}
\`\`\`

Picture walking down a ladder, testing each rung. Java checks the conditions **top to bottom**, runs the block of the **first** one that is true, and skips everything else in the chain. The final \`else\` catches whatever made it all the way down.

That is why the \`B\` line does not need to say \`score < 90\`. The only way to reach it is if \`score >= 90\` was already false. Each rung can rely on every rung above it having failed.

Because only one branch ever runs, the **order** of the conditions matters a lot. You will see why in a moment.`,
    },
    {
      kind: 'example',
      title: 'Run it',
      body: 'Run it, then try the scores that sit right on a boundary: `90`, `89`, `60` and `59`. Predict the letter before each run.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int score = 84;
        String grade;
        if (score >= 90) {
            grade = "A";
        } else if (score >= 80) {
            grade = "B";
        } else if (score >= 70) {
            grade = "C";
        } else if (score >= 60) {
            grade = "D";
        } else {
            grade = "F";
        }
        System.out.println(score + " is a " + grade);
    }
}
`,
      output: '84 is a B\n',
    },
    {
      kind: 'predict',
      body: 'A student forgot the word `else` on two of the lines. What prints now?',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int score = 93;
        if (score >= 90) {
            System.out.println("A");
        }
        if (score >= 80) {
            System.out.println("B");
        }
        if (score >= 70) {
            System.out.println("C");
        } else {
            System.out.println("F");
        }
    }
}
`,
      output: 'A\nB\nC\n',
      choices: ['A\n', 'A\nB\nC\n', 'A\nB\nC\nF\n', 'C\n'],
      explain: `Without \`else\`, these are three **separate** if statements, and Java checks every one of them.

1. \`93 >= 90\` is true, so \`A\` prints.
2. \`93 >= 80\` is also true, so \`B\` prints too.
3. \`93 >= 70\` is true, so \`C\` prints, and its own \`else\` is skipped.

The \`else\` at the bottom belongs only to the last if, so \`F\` would print only when the score is below 70. In a chain, the word \`else\` is what makes the branches exclude each other.`,
    },
    {
      kind: 'check',
      title: 'Order matters',
      prompt: 'Consider the following code segment, where `score` is an int from 0 to 100. For which values of `score` is the correct letter assigned?',
      code: String.raw`String grade;
if (score >= 60) {
    grade = "D";
} else if (score >= 70) {
    grade = "C";
} else if (score >= 80) {
    grade = "B";
} else if (score >= 90) {
    grade = "A";
} else {
    grade = "F";
}`,
      options: [
        { text: 'Only scores less than 70', correct: true, why: 'Every score of 60 or more stops at the first rung and gets a D. That is right for 60 to 69. Scores below 60 fail every test and correctly get F. Everything from 70 up is wrong.' },
        { text: 'All scores from 0 to 100', why: 'The chain stops at the first true condition. A 95 makes `score >= 60` true and gets D, and the A rung is never reached. With `>=` tests, put the highest cutoff first.' },
        { text: 'Only scores of 90 or more', why: 'A 95 does pass `score >= 90`, but Java never gets that far: `score >= 60` is checked first and is already true.' },
        { text: 'No scores', why: 'A score of 65 gets D and a score of 40 gets F, which are both correct. The bug only hurts scores of 70 and up.' },
      ],
    },
    {
      kind: 'explain',
      title: 'And, or, not',
      body: `Real rules often have more than one condition. Java joins boolean expressions with **logical operators**:

- \`a && b\` (**and**) is true only when **both** sides are true.
- \`a || b\` (**or**) is true when **at least one** side is true.
- \`!a\` (**not**) flips true to false and false to true.

A teenager is someone 13 to 19, which is two conditions at once:

\`\`\`java
if (age >= 13 && age <= 19) {
    System.out.println("Teen");
}
\`\`\`

You cannot write \`13 <= age <= 19\` like in math class. Java works out \`13 <= age\` first, gets a boolean, and then cannot compare a boolean to 19, so it does not compile.

Free admission for kids under 5 *or* adults over 65 is an or: \`age < 5 || age > 65\`.

When you mix operators, Java does \`!\` first, then \`&&\`, then \`||\`, the way multiplication comes before addition. Add parentheses whenever a mix could confuse a reader, including you.`,
    },
    {
      kind: 'predict',
      body: 'Type the four lines this prints.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int age = 16;
        boolean hasPermit = false;
        System.out.println(age >= 13 && age <= 19);
        System.out.println(age >= 16 && hasPermit);
        System.out.println(age < 13 || age > 65);
        System.out.println(!hasPermit || age > 18);
    }
}
`,
      output: 'true\nfalse\nfalse\ntrue\n',
      explain: `Work out each side first, then combine.

1. \`16 >= 13\` is true and \`16 <= 19\` is true. Both true, so \`&&\` gives \`true\`.
2. \`16 >= 16\` is true, but \`hasPermit\` is false. \`&&\` needs both, so \`false\`.
3. \`16 < 13\` is false and \`16 > 65\` is false. \`||\` needs at least one, so \`false\`.
4. \`!hasPermit\` flips false to \`true\`. One true side is enough for \`||\`, so \`true\`.`,
    },
    {
      kind: 'explain',
      title: 'Short-circuit evaluation',
      body: `Java is lazy in a useful way. It evaluates \`&&\` and \`||\` from left to right and **stops as soon as the answer is known**:

- For \`a && b\`, if \`a\` is false, the whole thing must be false, so \`b\` is **never evaluated**.
- For \`a || b\`, if \`a\` is true, the whole thing must be true, so \`b\` is never evaluated.

This is called **short-circuit evaluation**, and it lets the left side act as a guard for the right side:

\`\`\`java
if (games != 0 && points / games > 20)
\`\`\`

When \`games\` is 0, the left side is false and Java never does the division, so there is no divide-by-zero crash.

The same trick protects against \`null\`. Calling a method on \`null\` crashes, so check first:

\`\`\`java
if (name != null && name.length() > 0)
\`\`\`

Order is everything. Put the guard **on the left**. Written the other way round, the risky part runs first and crashes before the guard is checked.`,
    },
    {
      kind: 'example',
      title: 'Guard on the left',
      body: 'This player has not played any games yet, and it runs fine. Now swap the two sides of the `&&` so the division comes first, and run it again. The program crashes with an `ArithmeticException`, because now the division by zero happens before the guard is checked.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int games = 0;
        int points = 0;
        if (games != 0 && points / games > 20) {
            System.out.println("Star player");
        } else {
            System.out.println("Not enough data yet");
        }
        System.out.println("No crash");
    }
}
`,
      output: 'Not enough data yet\nNo crash\n',
    },
    {
      kind: 'check',
      title: 'Which one is safe?',
      prompt: 'Assume `int x` has the value 0. Which of the following expressions can be evaluated without causing a run-time error?',
      options: [
        { text: '`(x != 0) && (10 / x > 1)`', correct: true, why: '`x != 0` is false, so `&&` short-circuits and `10 / x` is never evaluated. The result is simply false.' },
        { text: '`(10 / x > 1) && (x != 0)`', why: 'The division is on the left, so it runs first and throws an `ArithmeticException` before the guard gets a chance.' },
        { text: '`(x == 0) && (10 / x > 1)`', why: '`x == 0` is true, so `&&` still needs the right side to decide. Java evaluates `10 / x` and crashes.' },
        { text: '`(x != 0) || (10 / x > 1)`', why: 'With `||`, a false left side does not settle anything, so Java evaluates the right side and divides by zero. `||` only short-circuits when the left side is true.' },
      ],
    },
    {
      kind: 'explain',
      title: 'Which if does this else belong to?',
      body: `Here is the food truck again, written without braces:

\`\`\`java
if (hungry)
    if (money >= 10)
        System.out.println("Burrito");
else
    System.out.println("Keep walking");
\`\`\`

The indentation says the \`else\` goes with \`if (hungry)\`. Java does not read indentation. Its rule is: **an else belongs to the nearest if above it that does not already have an else**. That is \`if (money >= 10)\`.

So Java really runs this:

- hungry with 6 dollars: the inner test fails, and the else prints \`Keep walking\`, which is wrong.
- not hungry: the outer if is false, and its whole body, the inner if-else included, is skipped. Nothing prints at all.

This is called the **dangling else**. The cure is the same one as before: use braces, and the else goes exactly where the braces put it.

\`\`\`java
if (hungry) {
    if (money >= 10) {
        System.out.println("Burrito");
    }
} else {
    System.out.println("Keep walking");
}
\`\`\``,
    },
    {
      kind: 'check',
      title: 'Read it like Java does',
      prompt: 'What is printed as a result of executing the following code segment?',
      code: String.raw`int x = 5;
if (x > 10)
    if (x > 20)
        System.out.println("big");
else
    System.out.println("small");
System.out.println("done");`,
      options: [
        { text: '`done`', correct: true, why: 'The else pairs with the nearest if, `if (x > 20)`. That whole if-else is the body of `if (x > 10)`, which is false for 5, so all of it is skipped. Only `done` prints.' },
        { text: '`small` then `done`', why: 'That is what the indentation suggests, pairing the else with `if (x > 10)`. Java ignores indentation and pairs it with the nearest if instead.' },
        { text: '`big` then `done`', why: '`big` needs `x > 20`, and Java never even reaches that test because `x > 10` is false.' },
        { text: '`small`', why: 'Whatever happens above, the last line is not inside any if, so `done` always prints.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Movie ticket prices',
      body: `A movie theater prices tickets like this:

- under 3: free (price 0)
- 3 to 12: 8 dollars
- 65 and over: 9 dollars
- everyone else: 13 dollars, but only 7 dollars on Tuesday

The Tuesday deal is only for that last group. Kids and seniors pay their usual price on Tuesday.

Your program reads an age (an int) and a day (a word like \`Tue\` or \`Sat\`), then prints \`Price: \` followed by the price. Input \`13 Tue\` prints \`Price: 7\`, and \`12 Tue\` prints \`Price: 8\`.

Remember that strings are compared with \`.equals\`, not \`==\`.`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int age = in.nextInt();
        String day = in.next();
        int price = 13;

        // set price here using an else-if chain

        System.out.println("Price: " + price);
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int age = in.nextInt();
        String day = in.next();
        int price = 13;

        if (age < 3) {
            price = 0;
        } else if (age <= 12) {
            price = 8;
        } else if (age >= 65) {
            price = 9;
        } else if (day.equals("Tue")) {
            price = 7;
        } else {
            price = 13;
        }

        System.out.println("Price: " + price);
    }
}
`,
      tests: [
        { name: 'A toddler is free', stdin: '2 Mon\n', stdout: 'Price: 0\n' },
        { name: 'Age 3 is a child ticket', stdin: '3 Fri\n', stdout: 'Price: 8\n' },
        { name: 'Kids pay their usual price on Tuesday', stdin: '12 Tue\n', stdout: 'Price: 8\n' },
        { name: 'Age 13 on Tuesday gets the deal', stdin: '13 Tue\n', stdout: 'Price: 7\n' },
        { name: 'Age 64 on Tuesday gets the deal', stdin: '64 Tue\n', stdout: 'Price: 7\n' },
        { name: 'Seniors pay their usual price on Tuesday', stdin: '65 Tue\n', stdout: 'Price: 9\n' },
        { name: 'An adult on Saturday', stdin: '30 Sat\n', stdout: 'Price: 13\n' },
      ],
      hints: [
        'Use one else-if chain and start with the youngest group. Once `age < 3` has failed, the next rung only needs to ask `age <= 12`.',
        'Handle seniors before the Tuesday deal, so the deal can only be reached by ages 13 to 64. Then ask `day.equals("Tue")`.',
        'The order that works: `age < 3` gives 0, `age <= 12` gives 8, `age >= 65` gives 9, `day.equals("Tue")` gives 7, and the final else gives 13.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A nested if asks its question only when the outer condition is true.',
        'An else-if chain checks top to bottom and runs only the first true branch. Put the most specific or highest cutoff first.',
        '`&&` needs both sides true, `||` needs at least one, `!` flips. Write ranges as `x >= 1 && x <= 10`.',
        'Short-circuit evaluation skips the right side once the left side decides. Put guards like `count != 0` or `s != null` on the left.',
        'An else belongs to the nearest if that does not already have one. Braces make the pairing explicit.',
      ],
      mistakes: [
        'Writing separate ifs when you meant one else-if chain, so several branches run.',
        'Ordering a chain so a broad test like `score >= 60` comes before the narrower ones and catches everything.',
        'Writing `13 <= age <= 19`, which does not compile.',
        'Putting the risky part on the left: `total / count > 5 && count != 0` still divides by zero.',
        'Trusting indentation to pair an else with an outer if.',
      ],
    },
  ],
};
