export default {
  id: 'object-references',
  title: 'Passing and returning objects',
  minutes: 30,
  summary: 'What really happens when you pass a primitive or an object to a method, and how a method can create and return a new object.',
  topics: ['3.6'],
  steps: [
    {
      kind: 'explain',
      title: 'A photocopy and a house key',
      body: `When you call a method, Java **copies** each argument into its parameter. Always. What gets copied depends on the type:

- For a **primitive** (\`int\`, \`double\`, \`boolean\`), the value itself is copied. It is like handing someone a photocopy of your homework: they can scribble on the copy, and your original is untouched.
- For an **object**, the variable holds a reference, so the **reference** is copied. That is like handing someone a copy of your house key. It is a different key, but it opens the same house. If they rearrange the furniture, you will see it when you get home.

This one idea explains every "did the caller's variable change?" question on the exam.`,
    },
    {
      kind: 'example',
      title: 'Both cases side by side',
      body: 'Run it and match each line of output to the explanation above.',
      code: String.raw`public class Main {
    public static void bump(int n) {
        n = n + 10;
    }

    public static void bumpScore(Score s) {
        s.add(10);
    }

    public static void main(String[] args) {
        int points = 5;
        bump(points);
        System.out.println(points);

        Score mine = new Score(5);
        bumpScore(mine);
        System.out.println(mine.get());
    }
}

class Score {
    private int value;

    public Score(int v) {
        value = v;
    }

    public void add(int n) {
        value += n;
    }

    public int get() {
        return value;
    }
}
`,
      output: '5\n15\n',
    },
    {
      kind: 'explain',
      title: 'Why one changed and the other did not',
      body: `In \`bump\`, the parameter \`n\` is a separate box holding a copy of 5. Changing \`n\` to 15 changes only that box, which disappears when the method ends. \`points\` is still 5.

In \`bumpScore\`, the parameter \`s\` holds a copy of the arrow in \`mine\`, so both arrows point at the **same** Score object. Calling \`s.add(10)\` changes that object, and \`mine\` sees the change.

But there is a limit. If the method **reassigns** the parameter to a new object, \`s = new Score(99);\`, only the copy of the arrow moves. The caller's variable still points at the original. A method can change an object you hand it, but it can never make your variable point somewhere else.`,
      diagram: {
        type: 'refs',
        vars: [{ name: 'mine (in main)', type: 'Score', to: 1 }, { name: 's (in bumpScore)', type: 'Score', to: 1 }, { name: 'points (in main)', type: 'int', value: 5 }, { name: 'n (in bump)', type: 'int', value: 15 }],
        objects: [{ id: 1, type: 'Score', fields: [{ name: 'value', value: 15 }] }],
        caption: 'Two arrows to one object; two separate int boxes.',
      },
    },
    {
      kind: 'predict',
      body: 'This one mixes changing an object with reassigning a parameter. Type the output.',
      code: String.raw`public class Main {
    public static void change(Score s) {
        s.add(1);
        s = new Score(100);
        s.add(1);
    }

    public static void main(String[] args) {
        Score a = new Score(10);
        change(a);
        System.out.println(a.get());
    }
}

class Score {
    private int value;

    public Score(int v) {
        value = v;
    }

    public void add(int n) {
        value += n;
    }

    public int get() {
        return value;
    }
}
`,
      output: '11\n',
      explain: `\`s.add(1)\` changes the shared object from 10 to 11. Then \`s = new Score(100)\` moves only the parameter's arrow to a brand new object; \`a\` still points at the original. The last \`add\` changes the new object (to 101), which is thrown away when the method ends. So \`a.get()\` is 11.`,
    },
    {
      kind: 'explain',
      title: 'Returning a new object',
      body: `A method can build a new object and return a reference to it. This is often the cleanest design, because it leaves the inputs untouched:

\`\`\`java
public static Point midpoint(Point a, Point b) {
    return new Point((a.getX() + b.getX()) / 2, (a.getY() + b.getY()) / 2);
}
\`\`\`

The caller receives an arrow to the new Point and can store it: \`Point m = midpoint(p, q);\`.

A method can also take an object of its **own** class as a parameter. Inside the class, it may read the other object's private variables directly, because private means "private to the class", not "private to the object":

\`\`\`java
public boolean sameSpot(Point other) {
    return x == other.x && y == other.y;
}
\`\`\`

On the AP exam, a method should not change an object passed to it unless the task asks for that.`,
    },
    {
      kind: 'check',
      title: 'Did it change?',
      prompt: 'After this code runs, what are `n` and `w.getCash()`?\n\n```java\npublic static void spendAll(int n, Wallet w) {\n    n = 0;\n    w.setCash(0);\n}\n// in main:\nint n = 50;\nWallet w = new Wallet(50);\nspendAll(n, w);\n```',
      options: [
        { text: '`n` is 50 and `w.getCash()` is 0', correct: true, why: 'The int was copied, so changing the parameter does nothing to main\'s `n`. The Wallet reference was copied, so `setCash(0)` changes the shared wallet.' },
        { text: 'Both are 0', why: 'Assigning to an int parameter only changes the method\'s own copy.' },
        { text: 'Both are 50', why: 'The method called a mutator on the same Wallet object that main refers to, so that change sticks.' },
        { text: '`n` is 0 and `w.getCash()` is 50', why: 'It is the other way around: primitives are protected, objects can be changed through a copied reference.' },
      ],
    },
    {
      kind: 'check',
      title: 'Aliases in a list of steps',
      prompt: 'What is printed?\n\n```java\nScore x = new Score(3);\nScore y = x;\ny.add(4);\nx = new Score(1);\nSystem.out.println(x.get() + " " + y.get());\n```',
      options: [
        { text: '`1 7`', correct: true, why: '`y = x` makes an alias, so `y.add(4)` changes the shared object to 7. Then `x` moves to a new Score(1), while `y` still points at the 7.' },
        { text: '`7 7`', why: '`x = new Score(1)` moves x to a new object, so x no longer sees the 7.' },
        { text: '`1 4`', why: 'y did not start a new Score at 0. It points at the original, which went from 3 to 7.' },
        { text: '`3 7`', why: 'x was reassigned to a new Score with value 1 before printing.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Points on a map',
      body: `\`Point\` is written for you. Write two static methods in \`MapTools\`:

- \`midpoint(Point a, Point b)\` **returns a new Point** halfway between a and b (use int division). It must not change a or b.
- \`moveRight(Point p, int dx)\` changes \`p\` so it moves \`dx\` to the right, using \`p.setX\`.

The tester reads two points and a distance, prints the midpoint, moves the first point and prints both points.`,
      starter: String.raw`public class MapTools {
    public static Point midpoint(Point a, Point b) {
        return null;
    }

    public static void moveRight(Point p, int dx) {
    }
}

class Point {
    private int x;
    private int y;

    public Point(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public int getX() {
        return x;
    }

    public int getY() {
        return y;
    }

    public void setX(int newX) {
        x = newX;
    }

    public String toString() {
        return "(" + x + ", " + y + ")";
    }
}
`,
      solution: String.raw`public class MapTools {
    public static Point midpoint(Point a, Point b) {
        return new Point((a.getX() + b.getX()) / 2, (a.getY() + b.getY()) / 2);
    }

    public static void moveRight(Point p, int dx) {
        p.setX(p.getX() + dx);
    }
}

class Point {
    private int x;
    private int y;

    public Point(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public int getX() {
        return x;
    }

    public int getY() {
        return y;
    }

    public void setX(int newX) {
        x = newX;
    }

    public String toString() {
        return "(" + x + ", " + y + ")";
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        Point a = new Point(in.nextInt(), in.nextInt());
        Point b = new Point(in.nextInt(), in.nextInt());
        int dx = in.nextInt();
        Point m = MapTools.midpoint(a, b);
        System.out.println("mid " + m);
        MapTools.moveRight(a, dx);
        System.out.println("a " + a + " b " + b);
        System.out.println("mid still " + m);
    }
}
`,
      tests: [
        { name: 'Simple midpoint and move', stdin: '0 0 4 6 3\n', stdout: 'mid (2, 3)\na (3, 0) b (4, 6)\nmid still (2, 3)\n' },
        { name: 'Int division and negatives', stdin: '-2 5 3 0 -4\n', stdout: 'mid (0, 2)\na (-6, 5) b (3, 0)\nmid still (0, 2)\n' },
        { name: 'Same point', stdin: '7 7 7 7 0\n', stdout: 'mid (7, 7)\na (7, 7) b (7, 7)\nmid still (7, 7)\n' },
      ],
      hints: [
        '`midpoint` must build a new object: `return new Point(..., ...);` with the averaged coordinates.',
        'Read coordinates with the getters: `(a.getX() + b.getX()) / 2`.',
        '`moveRight` changes the object it was given: `p.setX(p.getX() + dx);`. Assigning `p = new Point(...)` would not affect the caller.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Java always copies arguments into parameters.',
        'A copied primitive is independent: the caller\'s variable cannot change.',
        'A copied reference points at the same object: mutator calls through it are visible to the caller.',
        'Reassigning a parameter to a new object never changes the caller\'s variable.',
        'Returning a new object leaves the inputs unchanged; inside a class you may read another object\'s private data of the same class.',
      ],
      mistakes: [
        'Expecting `n = 0;` inside a method to change the caller\'s int.',
        'Expecting `p = new Point(...)` inside a method to replace the caller\'s Point.',
        'Changing a parameter object when the task only asked for a returned value.',
        'Returning `null` or forgetting `new` when a new object is required.',
      ],
    },
  ],
};
