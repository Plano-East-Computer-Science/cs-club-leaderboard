export default {
  id: 'calling-methods',
  title: 'Calling methods and reading signatures',
  minutes: 25,
  summary: 'Use code someone else wrote: read a method signature, pass the right arguments, and use what comes back.',
  topics: ['1.7', '1.8', '1.9', '1.10'],
  steps: [
    {
      kind: 'explain',
      title: 'A vending machine',
      body: `A **method** is a named block of code that does one job. You have already used one: \`System.out.println\`.

Think of a method as a vending machine. You do not need to know how it works inside. You need to know three things printed on the front: its **name**, what you must **put in**, and what **comes out**.

Programmers rarely write everything from scratch. Java ships with thousands of ready-made classes and methods, grouped into **libraries**. The written description of how to use them (names, inputs, outputs) is an **API**, an Application Programming Interface. Reading an API well is one of the most useful skills in this course.`,
    },
    {
      kind: 'explain',
      title: 'Reading a signature',
      body: `Here is the header of a method someone wrote for you:

\`\`\`java
public static double average(int a, int b)
\`\`\`

- \`average\` is the **name**.
- \`(int a, int b)\` is the **parameter list**: it needs two ints, in that order. The name plus the parameter list is the method's **signature**.
- \`double\` is the **return type**: calling it gives you back a double.
- \`static\` means you call it on the class, not on an object. Inside the same class you can just write \`average(3, 4)\`; from another class you write \`ClassName.average(3, 4)\`, like \`Math.sqrt(9)\`.

The values you pass in a call, like \`3\` and \`4\`, are **arguments**. They are copied into the **parameters** \`a\` and \`b\` in order. A method whose return type is \`void\` gives nothing back; it just does something, like printing.`,
    },
    {
      kind: 'example',
      title: 'Calling methods that already exist',
      body: 'The three methods at the top are written for you. `main` only calls them. Run it, then add your own call to `average`.',
      editable: true,
      code: String.raw`public class Main {
    /** Returns the average of a and b. */
    public static double average(int a, int b) {
        return (a + b) / 2.0;
    }

    /** Prints a banner around the message. Returns nothing. */
    public static void banner(String message) {
        System.out.println("== " + message + " ==");
    }

    /** Returns the larger of a and b. */
    public static int bigger(int a, int b) {
        if (a > b) {
            return a;
        }
        return b;
    }

    public static void main(String[] args) {
        banner("Results");
        double avg = average(90, 85);
        System.out.println(avg);
        System.out.println(bigger(3, 11) * 2);
    }
}
`,
      output: '== Results ==\n87.5\n22\n',
    },
    {
      kind: 'explain',
      title: 'Using what comes back',
      body: `A call to a method that returns a value **is** that value, so you can store it, print it, or use it in a bigger expression: \`bigger(3, 11) * 2\` is \`11 * 2\`.

If you call a non-void method and do nothing with the result, Java allows it, but the answer is thrown away:

\`\`\`java
average(90, 85);   // computes 87.5, then forgets it
\`\`\`

A \`void\` method has no value, so you **cannot** store or print its result. \`String s = banner("Hi");\` will not compile.

The arguments must match the parameters in **number, type and order**. \`average(90)\` and \`average("90", "85")\` do not compile.`,
    },
    {
      kind: 'predict',
      code: String.raw`public class Main {
    public static int twice(int n) {
        return n * 2;
    }

    public static void show(int n) {
        System.out.println("n is " + n);
    }

    public static void main(String[] args) {
        int x = 3;
        twice(x);
        show(x);
        x = twice(x);
        show(twice(x) + 1);
    }
}
`,
      output: 'n is 3\nn is 13\n',
      choices: ['n is 3\nn is 13\n', 'n is 6\nn is 13\n', 'n is 3\nn is 7\n', 'n is 6\nn is 25\n'],
      explain: `The first \`twice(x)\` computes 6 and throws it away, so \`x\` is still 3 and \`show(x)\` prints \`n is 3\`. Then \`x = twice(x)\` stores 6 in \`x\`. Finally \`twice(x) + 1\` is \`12 + 1\`, which is 13. A method cannot change \`x\` just by being handed it; only the assignment does that.`,
    },
    {
      kind: 'explain',
      title: 'Same name, different signatures',
      body: `Two methods can share a name as long as their parameter lists differ. This is **overloading**. Java picks the one whose parameters match the arguments:

\`\`\`java
public static int area(int side)               // a square
public static int area(int width, int height)  // a rectangle
\`\`\`

\`area(5)\` calls the first, \`area(5, 3)\` calls the second. \`System.out.println\` is overloaded too: there is a version for \`int\`, one for \`double\`, one for \`String\`, and so on.

Good methods come with a **documentation comment** (\`/** ... */\`) that says what they do. It often states a **precondition**, what must be true before you call it ("n is not negative"), and a **postcondition**, what will be true afterwards ("returns the number of digits in n"). If you break the precondition, the method does not promise anything.`,
    },
    {
      kind: 'check',
      title: 'Which call compiles?',
      prompt: 'A class has this method:\n\n```java\n/** Precondition: count > 0 */\npublic static double perItem(double total, int count)\n```\n\nWhich of these statements, written in the same class, compiles and follows the precondition?',
      options: [
        { text: '`double p = perItem(12.5, 4);`', correct: true, why: 'Two arguments, a double then an int, in the right order, and 4 is greater than 0. It returns a double, which is stored in a double.' },
        { text: '`double p = perItem(4, 12.5);`', why: 'The order matters. `12.5` cannot go into the `int count` parameter, so this does not compile.' },
        { text: '`int p = perItem(12.5, 4);`', why: 'The method returns a double. Storing a double in an int needs a cast, so this does not compile.' },
        { text: '`double p = perItem(12.5, 0);`', why: 'It compiles, but 0 breaks the precondition `count > 0`, so the method makes no promise about the result.' },
      ],
    },
    {
      kind: 'check',
      title: 'void or not',
      prompt: 'Which statement about a method declared `public static void greet(String name)` is true?',
      options: [
        { text: 'A call such as `greet("Ana");` can stand on its own, but `String s = greet("Ana");` does not compile.', correct: true, why: '`void` means no value comes back, so there is nothing to store. Calling it as a statement is how you use it.' },
        { text: 'It returns the string it was given.', why: 'The return type is `void`, so it returns nothing at all.' },
        { text: 'It must be called as `greet()` with no arguments.', why: 'Its parameter list has one String, so every call needs exactly one String argument.' },
        { text: 'It can only be called from another class.', why: 'Inside the same class you call a static method by its name alone.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Use the helpers',
      body: `The methods \`perimeter\`, \`area\` and \`label\` are already written. **Do not change them.** Finish \`main\` so it reads a rectangle's width and height (two ints) and prints exactly three lines, using a call to each method:

\`\`\`
Rectangle 4 by 3
Perimeter: 14
Area: 12
\`\`\``,
      starter: String.raw`import java.util.Scanner;

public class Main {
    /** Returns the perimeter of a w by h rectangle. */
    public static int perimeter(int w, int h) {
        return 2 * (w + h);
    }

    /** Returns the area of a w by h rectangle. */
    public static int area(int w, int h) {
        return w * h;
    }

    /** Returns a label like "Rectangle 4 by 3". */
    public static String label(int w, int h) {
        return "Rectangle " + w + " by " + h;
    }

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int w = in.nextInt();
        int h = in.nextInt();
        // print the label, then the perimeter, then the area
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    /** Returns the perimeter of a w by h rectangle. */
    public static int perimeter(int w, int h) {
        return 2 * (w + h);
    }

    /** Returns the area of a w by h rectangle. */
    public static int area(int w, int h) {
        return w * h;
    }

    /** Returns a label like "Rectangle 4 by 3". */
    public static String label(int w, int h) {
        return "Rectangle " + w + " by " + h;
    }

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int w = in.nextInt();
        int h = in.nextInt();
        System.out.println(label(w, h));
        System.out.println("Perimeter: " + perimeter(w, h));
        System.out.println("Area: " + area(w, h));
    }
}
`,
      tests: [
        { name: 'A 4 by 3 rectangle', stdin: '4 3\n', stdout: 'Rectangle 4 by 3\nPerimeter: 14\nArea: 12\n' },
        { name: 'A square', stdin: '5 5\n', stdout: 'Rectangle 5 by 5\nPerimeter: 20\nArea: 25\n' },
        { name: 'Zero height', stdin: '7 0\n', stdout: 'Rectangle 7 by 0\nPerimeter: 14\nArea: 0\n' },
      ],
      hints: [
        '`label` returns a String, so print what it returns: `System.out.println(label(w, h));`.',
        'A call can be part of a bigger expression: `"Perimeter: " + perimeter(w, h)`.',
        'Pass the arguments in the same order as the parameters: width first, then height.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A signature is the method name plus its parameter list. The return type says what comes back; `void` means nothing.',
        'Arguments are copied into parameters in order, and must match in number and type.',
        'A call to a non-void method is a value you can store, print or use in an expression.',
        'Static methods are called on the class (`Math.sqrt(2)`), or by name alone inside the same class.',
        'Overloaded methods share a name but have different parameter lists.',
      ],
      mistakes: [
        'Calling a method that returns a value and ignoring the result, then wondering why nothing changed.',
        'Trying to store the result of a `void` method.',
        'Passing arguments in the wrong order, such as `perItem(4, 12.5)`.',
        'Ignoring a precondition in the documentation comment.',
      ],
    },
  ],
};
