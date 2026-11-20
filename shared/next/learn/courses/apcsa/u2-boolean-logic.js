export default {
  id: 'boolean-logic',
  title: 'Equivalent boolean expressions',
  minutes: 25,
  summary: 'Prove two conditions mean the same thing with truth tables and De Morgan\'s laws, and compare objects the right way.',
  topics: ['2.6'],
  steps: [
    {
      kind: 'explain',
      title: 'Two ways to say the same thing',
      body: `"You may not enter if you are under 13 or have no ticket" and "You may enter if you are at least 13 and have a ticket" describe the same rule. In code, the same is true of conditions: very different-looking boolean expressions can always give the same answer.

The AP exam asks this a lot: "Which expression is equivalent to...?" Two expressions are **equivalent** when they give the same result for **every** possible input. Not most inputs: every one.

There are two tools for deciding: a **truth table**, which checks every case by brute force, and **De Morgan's laws**, which rewrite an expression step by step.`,
    },
    {
      kind: 'explain',
      title: 'Truth tables',
      body: `With two boolean values \`a\` and \`b\` there are only four combinations, so you can just list them all. Here are \`&&\`, \`||\` and a third expression, \`!(a && b)\`:

The table lists every row. If two columns match on all four rows, the expressions are equivalent. Notice that \`!(a && b)\` is \`false\` only in the one row where both are true.`,
      diagram: {
        type: 'trace',
        columns: ['a', 'b', 'a && b', 'a || b', '!(a && b)', '!a || !b'],
        rows: [
          ['true', 'true', 'true', 'true', 'false', 'false'],
          ['true', 'false', 'false', 'true', 'true', 'true'],
          ['false', 'true', 'false', 'true', 'true', 'true'],
          ['false', 'false', 'false', 'false', 'true', 'true'],
        ],
        caption: 'The last two columns match on every row, so !(a && b) and !a || !b are equivalent.',
      },
    },
    {
      kind: 'explain',
      title: "De Morgan's laws",
      body: `The table just proved the first of two rules worth memorizing. To push a \`!\` inside parentheses, **flip each part and flip the operator**:

- \`!(a && b)\` is the same as \`!a || !b\`
- \`!(a || b)\` is the same as \`!a && !b\`

Flipping a comparison means using its opposite: the opposite of \`<\` is \`>=\`, and the opposite of \`==\` is \`!=\`.

\`\`\`java
!(age >= 13 && hasTicket)
// is the same as
age < 13 || !hasTicket
\`\`\`

The common mistake is to flip the parts but keep the operator: \`!(a && b)\` is **not** \`!a && !b\`.`,
    },
    {
      kind: 'example',
      title: 'Check it on every case',
      body: 'This program evaluates both sides of a De Morgan rewrite. Run it, then try x = 0, 5, 10 and -5: the two columns always agree. Then break it on purpose by changing `||` to `&&` in `right`.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int x = 15;
        boolean left = !(x > 0 && x <= 10);
        boolean right = x <= 0 || x > 10;
        System.out.println("left:  " + left);
        System.out.println("right: " + right);
        System.out.println("agree: " + (left == right));
    }
}
`,
      output: 'left:  true\nright: true\nagree: true\n',
    },
    {
      kind: 'check',
      title: 'Push the not inside',
      prompt: 'Which expression is equivalent to `!(score < 60 || late)`, where `score` is an int and `late` is a boolean?',
      options: [
        { text: '`score >= 60 && !late`', correct: true, why: 'De Morgan: flip each part (`<` becomes `>=`, `late` becomes `!late`) and flip `||` to `&&`.' },
        { text: '`score >= 60 || !late`', why: 'The parts were flipped but the operator was kept. With `||` inside the not, the result must use `&&`.' },
        { text: '`score > 60 && !late`', why: 'The opposite of `< 60` is `>= 60`, not `> 60`. A score of exactly 60 would be handled differently.' },
        { text: '`!score < 60 && !late`', why: '`!` cannot be applied to an int, so `!score` does not compile. Flip the comparison instead.' },
      ],
    },
    {
      kind: 'predict',
      body: 'Watch for short-circuiting as well as De Morgan.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int a = 4;
        int b = 0;
        boolean p = !(a > 3 && b > 3);
        boolean q = !(a > 3) && !(b > 3);
        boolean r = b != 0 && a / b > 1;
        System.out.println(p);
        System.out.println(q);
        System.out.println(r);
    }
}
`,
      output: 'true\nfalse\nfalse\n',
      choices: ['true\nfalse\nfalse\n', 'true\ntrue\nfalse\n', 'false\nfalse\nfalse\n', 'true\nfalse\ntrue\n'],
      explain: `\`a > 3\` is true and \`b > 3\` is false, so \`a > 3 && b > 3\` is false and \`p\` is \`true\`. For \`q\`, \`!(a > 3)\` is false, so the whole \`&&\` is false. That shows \`p\` and \`q\` are **not** equivalent: \`q\` kept the \`&&\` instead of switching to \`||\`. For \`r\`, \`b != 0\` is false, so \`&&\` stops right there and never divides by zero.`,
    },
    {
      kind: 'explain',
      title: '== on objects compares arrows',
      body: `For primitives like \`int\` and \`boolean\`, \`==\` compares values. For **objects**, \`==\` compares **references**: it is \`true\` only when both variables point at the very same object.

\`\`\`java
String a = new String("hi");
String b = new String("hi");
String c = a;
a == b        // false: two different objects
a.equals(b)   // true: same characters
a == c        // true: c is an alias of a
\`\`\`

So use \`equals\` to ask "same content?" and \`==\` only for "same object?" or for checking against \`null\`: \`if (name != null && name.equals("Ada"))\`. Writing the null check first protects the \`equals\` call, thanks to short-circuiting.`,
      diagram: {
        type: 'refs',
        vars: [{ name: 'a', type: 'String', to: 1 }, { name: 'b', type: 'String', to: 2 }, { name: 'c', type: 'String', to: 1 }],
        objects: [{ id: 1, type: 'String', fields: [{ name: 'text', value: '"hi"' }] }, { id: 2, type: 'String', fields: [{ name: 'text', value: '"hi"' }] }],
        caption: 'a and c point at the same object; b points at a different object with the same text.',
      },
    },
    {
      kind: 'check',
      title: 'Same object or same text?',
      prompt: 'After this code, which expression is `false`?\n\n```java\nString x = new String("cat");\nString y = new String("cat");\nString z = y;\n```',
      options: [
        { text: '`x == y`', correct: true, why: 'Each `new String` makes a separate object, so the references differ even though the text matches.' },
        { text: '`x.equals(y)`', why: 'Both hold "cat", and `equals` compares characters, so this is true.' },
        { text: '`y == z`', why: '`z = y` copied the reference, so both point at the same object. This is true.' },
        { text: '`z.equals(x)`', why: 'z refers to y\'s object, which holds "cat", the same text as x. This is true.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Ride check',
      body: `A roller coaster lets you **ride** when your height is at least 48 inches and you are not pregnant, **or** when you have a medical pass. Otherwise you may not ride.

The input is an int height and two words, each \`yes\` or \`no\`: pregnant, then has a medical pass. Print \`ride\` or \`no ride\`.

Then, on a second line, print the result of the **opposite** condition written without an outer \`!\`, using De Morgan's laws, as \`true\` or \`false\`. It should always be the opposite of the first line (true when you may not ride).`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int height = in.nextInt();
        boolean pregnant = in.next().equals("yes");
        boolean pass = in.next().equals("yes");

        boolean canRide = height >= 48;
        if (canRide) {
            System.out.println("ride");
        } else {
            System.out.println("no ride");
        }
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int height = in.nextInt();
        boolean pregnant = in.next().equals("yes");
        boolean pass = in.next().equals("yes");

        boolean canRide = (height >= 48 && !pregnant) || pass;
        if (canRide) {
            System.out.println("ride");
        } else {
            System.out.println("no ride");
        }
        boolean cannotRide = (height < 48 || pregnant) && !pass;
        System.out.println(cannotRide);
    }
}
`,
      tests: [
        { name: 'Tall enough', stdin: '50 no no\n', stdout: 'ride\nfalse\n' },
        { name: 'Too short', stdin: '40 no no\n', stdout: 'no ride\ntrue\n' },
        { name: 'Exactly 48', stdin: '48 no no\n', stdout: 'ride\nfalse\n' },
        { name: 'Pregnant', stdin: '60 yes no\n', stdout: 'no ride\ntrue\n' },
        { name: 'Medical pass wins', stdin: '40 yes yes\n', stdout: 'ride\nfalse\n' },
      ],
      hints: [
        'Write the ride rule with parentheses: `(height >= 48 && !pregnant) || pass`.',
        'The opposite is `!((height >= 48 && !pregnant) || pass)`. Push the `!` in: the `||` becomes `&&`, and `pass` becomes `!pass`.',
        'Then push the `!` into the inner part: `!(height >= 48 && !pregnant)` is `height < 48 || pregnant`. Keep it in parentheses.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Two boolean expressions are equivalent only if they agree on every input. A truth table checks every case.',
        "De Morgan: `!(a && b)` is `!a || !b`, and `!(a || b)` is `!a && !b`. Flip the parts and the operator.",
        'The opposite of `<` is `>=`, of `>` is `<=`, of `==` is `!=`.',
        'For objects, `==` compares references; `equals` compares content.',
      ],
      mistakes: [
        'Flipping the parts but not the operator: `!(a && b)` written as `!a && !b`.',
        'Using `>` as the opposite of `<`, which mishandles the boundary value.',
        'Comparing Strings with `==`.',
        'Calling `.equals` on a variable that might be null before checking it.',
      ],
    },
  ],
};
