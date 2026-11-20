export default {
  id: 'first-program',
  title: 'Your first Java program',
  minutes: 20,
  summary: 'What a program is, how Java turns your text into something a computer runs, and how to print exactly what you mean.',
  topics: ['1.1', '1.3', '1.8'],
  steps: [
    {
      kind: 'explain',
      title: 'A recipe for a very literal cook',
      body: `An **algorithm** is a step-by-step process for getting something done. A recipe is an algorithm. So are the directions you give a friend to get to your house.

A **program** is an algorithm written so precisely that a computer can follow it. That precision is the whole game. Imagine a cook who does *exactly* what the recipe says and nothing else: if the recipe says "add salt" without saying how much, they freeze. Computers are that cook.

Java is the language we will write our recipes in. It is the language of the AP Computer Science A exam, and it runs on billions of devices, from Android phones to the servers behind Minecraft.`,
    },
    {
      kind: 'explain',
      title: 'From your text to a running program',
      body: `What you type is called **source code**. A computer cannot run it directly. Two things happen first:

1. The **compiler** (\`javac\`) reads your whole file and checks that it follows Java's grammar. If it does, the compiler translates it into **bytecode**, a compact set of instructions.
2. The **Java Virtual Machine** (the JVM) runs that bytecode, one instruction at a time.

So there are three kinds of mistakes, and they show up at different moments:

- A **syntax error** (also called a compile-time error) breaks Java's grammar, like a missing semicolon. The compiler refuses and nothing runs.
- A **run-time error** happens while the program runs, like dividing by zero. The program crashes partway through with an *exception*.
- A **logic error** is the sneakiest: the program runs fine but does the wrong thing, like printing a total that is off by one. Only testing catches these.`,
    },
    {
      kind: 'explain',
      title: 'Reading your first program',
      body: `Here is the smallest useful Java program. Read it top to bottom before you look at the notes.

\`\`\`java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
\`\`\`

- \`public class Main\` names the program. In Java every line of code lives inside a **class**. The file must be called \`Main.java\` to match.
- \`public static void main(String[] args)\` is the **main method**: the place Java starts running. You will type this line many times; for now treat it as the front door.
- \`System.out.println(...)\` prints whatever is in the parentheses, then moves to a new line.
- \`"Hello, World!"\` is a **string literal**: text in double quotes, printed exactly as written.
- Every statement ends with a **semicolon** \`;\`, and every \`{\` has a matching \`}\`. The indentation is for humans; the braces are what Java reads.`,
    },
    {
      kind: 'example',
      title: 'Run it',
      body: 'Press Run. Then change the message, keep the quotes, and run it again.',
      editable: true,
      code: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        System.out.println("I wrote this.");
    }
}
`,
      output: 'Hello, World!\nI wrote this.\n',
    },
    {
      kind: 'explain',
      title: 'print and println',
      body: `There are two ways to print, and the difference is only about the *end* of the line.

- \`System.out.println(x)\` prints \`x\`, **then** moves to the next line.
- \`System.out.print(x)\` prints \`x\` and stays on the same line, so whatever prints next lands right after it.

Some characters cannot be typed straight into a string, so Java uses **escape sequences**, a backslash followed by a letter:

- \`\\n\` starts a new line
- \`\\"\` prints a double quote (a plain \`"\` would end the string)
- \`\\\\\` prints one backslash

Comments are notes for people, and Java ignores them. \`//\` comments out the rest of a line, \`/* ... */\` can span lines, and \`/** ... */\` is a documentation comment that describes a class or method.`,
    },
    {
      kind: 'predict',
      body: 'Commit to a guess before you run it. Watch where each line ends.',
      code: `public class Main {
    public static void main(String[] args) {
        System.out.print("Go ");
        System.out.println("Panthers");
        System.out.print("CS");
        System.out.println(" Club");
    }
}
`,
      output: 'Go Panthers\nCS Club\n',
      choices: ['Go Panthers\nCS Club\n', 'Go \nPanthers\nCS\n Club\n', 'Go PanthersCS Club\n', 'Go\nPanthers\nCS\nClub\n'],
      explain: `\`print("Go ")\` leaves the cursor on the same line, so \`Panthers\` lands right after it, and then \`println\` ends the line. The second pair works the same way. The space inside \`"Go "\` and \`" Club"\` is part of the string, which is why the words do not run together.`,
    },
    {
      kind: 'check',
      title: 'Which line will not compile?',
      prompt: 'Each choice is a single statement inside `main`. Which one causes a compile-time error?',
      options: [
        { text: '`System.out.println("Hi")`', correct: true, why: 'There is no semicolon at the end. The compiler stops with "\';\' expected" and the program never runs.' },
        { text: '`System.out.println("Hi");   // greeting`', why: 'This compiles. Everything after `//` is a comment, which Java ignores.' },
        { text: '`System.out.print("");`', why: 'This compiles. An empty string is allowed; it just prints nothing.' },
        { text: '`System.out.println("She said \\"hi\\"");`', why: 'This compiles. `\\"` is an escape sequence, so the inner quotes are printed instead of ending the string.' },
      ],
    },
    {
      kind: 'explain',
      title: 'Printing numbers and text together',
      body: `\`+\` does two different jobs in Java, and the AP exam loves this.

- Between two **numbers**, \`+\` adds: \`3 + 4\` is \`7\`.
- If **either side is a string**, \`+\` **joins** (concatenates): \`"Score: " + 7\` is \`"Score: 7"\`.

Java works left to right. So \`"Sum: " + 3 + 4\` first makes \`"Sum: 3"\`, then joins \`4\` to get \`"Sum: 34"\`. If you want the math done first, use parentheses: \`"Sum: " + (3 + 4)\` gives \`"Sum: 7"\`.`,
    },
    {
      kind: 'predict',
      body: 'Type exactly what you think this prints, one line per line of output.',
      code: `public class Main {
    public static void main(String[] args) {
        System.out.println(1 + 2 + "3" + 4 + 5);
        System.out.println("Total: " + (10 + 5));
    }
}
`,
      output: '3345\nTotal: 15\n',
      explain: `Left to right: \`1 + 2\` are both numbers, so that is \`3\`. Then \`3 + "3"\` involves a string, so it joins to \`"33"\`. From there everything is a string, so \`4\` and \`5\` are joined on: \`"3345"\`. On the second line the parentheses force \`10 + 5\` to be added first.`,
    },
    {
      kind: 'check',
      title: 'Name the error',
      prompt: 'A student\'s program compiles and runs without crashing, but it prints `Total: 9` when the correct answer is `Total: 10`. What kind of error is this?',
      options: [
        { text: 'A logic error', correct: true, why: 'The program does exactly what it was told; it was told the wrong thing. Only testing with known answers catches this.' },
        { text: 'A syntax error', why: 'A syntax error stops the compiler, so the program would never run and print anything.' },
        { text: 'A run-time error', why: 'A run-time error crashes the program with an exception. This one finished normally.' },
        { text: 'A compiler bug', why: 'Compilers are extremely well tested. When output is wrong, the bug is almost always in our code.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Print a club sign',
      body: `Write a program that prints these three lines **exactly**, including the quotes and the backslashes:

\`\`\`
Plano East CS Club
"Hello, World!" is a tradition.
Save it in C:\\club\\java
\`\`\`

The starter prints the first line for you.`,
      starter: `public class Main {
    public static void main(String[] args) {
        System.out.println("Plano East CS Club");
        // print the other two lines here
    }
}
`,
      solution: `public class Main {
    public static void main(String[] args) {
        System.out.println("Plano East CS Club");
        System.out.println("\\"Hello, World!\\" is a tradition.");
        System.out.println("Save it in C:\\\\club\\\\java");
    }
}
`,
      tests: [{ name: 'Prints all three lines exactly', stdout: 'Plano East CS Club\n"Hello, World!" is a tradition.\nSave it in C:\\club\\java\n' }],
      hints: [
        'Use one `System.out.println(...)` per line of output.',
        'A double quote inside a string must be written `\\"`, or Java thinks the string ended.',
        'One backslash in the output is written `\\\\` in the code. So `C:\\club` is typed `"C:\\\\club"`.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A program is an algorithm written precisely enough for a computer. The compiler checks and translates it; the JVM runs it.',
        'Syntax errors stop compiling, run-time errors crash a running program, logic errors give wrong answers quietly.',
        '`println` ends the line after printing; `print` does not.',
        '`+` adds numbers but joins as soon as a string is involved, working left to right. Parentheses change the order.',
      ],
      mistakes: [
        'Forgetting the semicolon at the end of a statement.',
        'Writing `"Sum: " + 3 + 4` and expecting `Sum: 7`.',
        'Using a bare `"` or `\\` inside a string instead of `\\"` and `\\\\`.',
        'Adding extra text like `Enter a number:` to output that is checked exactly.',
      ],
    },
  ],
};
