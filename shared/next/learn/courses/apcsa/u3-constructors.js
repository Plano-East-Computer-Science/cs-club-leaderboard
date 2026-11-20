export default {
  id: 'constructors',
  title: 'Constructors',
  minutes: 25,
  summary: 'Write constructors that put every new object in a valid starting state, including overloaded ones and the parameter-name trap.',
  topics: ['3.4'],
  steps: [
    {
      kind: 'explain',
      title: 'Move-in day',
      body: `When a new house is finished, someone has to turn on the water, set the thermostat and hand over keys before anyone moves in. A **constructor** is that setup for an object: it runs exactly once, when \`new\` creates the object, and its job is to give every instance variable a sensible starting value.

\`\`\`java
public Thermostat(int startTemp) {
    temp = startTemp;
    heating = false;
}
\`\`\`

Constructor rules:

- Its name is **exactly** the class name.
- It has **no return type**, not even \`void\`.
- It usually takes parameters with the starting values, and copies them into the instance variables.`,
    },
    {
      kind: 'explain',
      title: 'Default values and the default constructor',
      body: `If a constructor does not set an instance variable, Java fills in a **default value**: \`0\` for int, \`0.0\` for double, \`false\` for boolean and \`null\` for objects such as String.

If you write **no constructor at all**, Java gives your class an invisible one with no parameters that leaves every variable at its default. But as soon as you write any constructor, that free one disappears. So if \`Thermostat\` only has \`Thermostat(int startTemp)\`, then \`new Thermostat()\` no longer compiles.

Relying on defaults is legal, but setting every variable yourself makes the starting state obvious to anyone reading the code, and avoids a String that is unexpectedly \`null\`.`,
    },
    {
      kind: 'example',
      title: 'Overloaded constructors',
      body: 'A class can have several constructors with different parameter lists. Add a third one that takes only a title.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        Book a = new Book("Dune", 412);
        Book b = new Book();
        System.out.println(a.info());
        System.out.println(b.info());
    }
}

class Book {
    private String title;
    private int pages;
    private boolean checkedOut;

    public Book(String t, int p) {
        title = t;
        pages = p;
        checkedOut = false;
    }

    public Book() {
        title = "Untitled";
        pages = 0;
        checkedOut = false;
    }

    public String info() {
        return title + ", " + pages + " pages, out: " + checkedOut;
    }
}
`,
      output: 'Dune, 412 pages, out: false\nUntitled, 0 pages, out: false\n',
    },
    {
      kind: 'explain',
      title: 'The same name trap',
      body: `It is natural to give parameters the same names as the instance variables:

\`\`\`java
private String title;

public Book(String title, int pages) {
    title = title;     // bug
}
\`\`\`

Inside the constructor, \`title\` now means the **parameter**, because the closest declaration wins. This is called **shadowing**. So \`title = title\` copies the parameter onto itself, and the instance variable stays \`null\`. It compiles, and it is a silent logic error.

Two fixes:

1. Use different parameter names: \`Book(String t, int p)\`.
2. Use \`this\`, which always means "the object being built": \`this.title = title;\`. The left side is the instance variable, the right side is the parameter.`,
    },
    {
      kind: 'predict',
      body: 'One constructor has the shadowing bug. Type what prints.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        Player p = new Player("Zoe", 7);
        System.out.println(p.getName() + " " + p.getLevel());
    }
}

class Player {
    private String name;
    private int level;

    public Player(String name, int level) {
        name = name;
        this.level = level;
    }

    public String getName() {
        return name;
    }

    public int getLevel() {
        return level;
    }
}
`,
      output: 'null 7\n',
      choices: ['null 7\n', 'Zoe 7\n', 'Zoe 0\n', 'null 0\n'],
      explain: `\`name = name;\` assigns the parameter to itself, so the instance variable \`name\` keeps its default, \`null\`. \`this.level = level;\` correctly copies the parameter into the instance variable, so the level is 7. Printing a null String in a concatenation prints the word null.`,
    },
    {
      kind: 'check',
      title: 'Spot the constructor',
      prompt: 'Which is a valid constructor for a class named `Robot`?',
      options: [
        { text: '`public Robot(String model) { this.model = model; }`', correct: true, why: 'Same name as the class, no return type, and it sets the instance variable from the parameter.' },
        { text: '`public void Robot(String model) { this.model = model; }`', why: 'With `void` this is an ordinary method that happens to be named Robot. `new Robot("X1")` would not call it.' },
        { text: '`public robot(String model) { this.model = model; }`', why: 'Java is case sensitive. `robot` is not `Robot`, so this does not compile as a constructor.' },
        { text: '`public Robot(String model) { return new Robot(model); }`', why: 'A constructor sets up the object being created. It cannot return a value, and calling itself forever would never finish.' },
      ],
    },
    {
      kind: 'check',
      title: 'Which call compiles?',
      prompt: 'A class has only this constructor:\n\n```java\npublic Timer(int minutes, boolean loud)\n```\n\nWhich statement compiles?',
      options: [
        { text: '`Timer t = new Timer(5, true);`', correct: true, why: 'An int then a boolean, matching the only constructor.' },
        { text: '`Timer t = new Timer();`', why: 'Once a class declares any constructor, Java no longer supplies the empty one.' },
        { text: '`Timer t = new Timer(true, 5);`', why: 'Arguments must match the parameter order: int first, then boolean.' },
        { text: '`Timer t = Timer(5, true);`', why: 'Creating an object needs `new`.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Two ways to make a rectangle',
      body: `Write the two constructors for \`Rectangle\`:

- \`Rectangle(int width, int height)\` stores both sizes.
- \`Rectangle(int side)\` makes a square.

Use the parameter names shown (the same as the instance variables), so you will need \`this\`. The methods \`area\` and \`toString\` are written for you. The tester builds rectangles from the input: two numbers make a rectangle, one number makes a square.`,
      starter: String.raw`public class Rectangle {
    private int width;
    private int height;

    public Rectangle(int width, int height) {
        // store both sizes
    }

    public Rectangle(int side) {
        // a square
    }

    public int area() {
        return width * height;
    }

    public String toString() {
        return width + "x" + height + " area " + area();
    }
}
`,
      solution: String.raw`public class Rectangle {
    private int width;
    private int height;

    public Rectangle(int width, int height) {
        this.width = width;
        this.height = height;
    }

    public Rectangle(int side) {
        width = side;
        height = side;
    }

    public int area() {
        return width * height;
    }

    public String toString() {
        return width + "x" + height + " area " + area();
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        while (in.hasNextLine()) {
            String line = in.nextLine().trim();
            if (line.length() == 0) {
                continue;
            }
            String[] p = line.split(" ");
            Rectangle r;
            if (p.length == 2) {
                r = new Rectangle(Integer.parseInt(p[0]), Integer.parseInt(p[1]));
            } else {
                r = new Rectangle(Integer.parseInt(p[0]));
            }
            System.out.println(r);
        }
    }
}
`,
      tests: [
        { name: 'A rectangle', stdin: '4 3\n', stdout: '4x3 area 12\n' },
        { name: 'A square', stdin: '5\n', stdout: '5x5 area 25\n' },
        { name: 'Both kinds, separate objects', stdin: '2 9\n1\n', stdout: '2x9 area 18\n1x1 area 1\n' },
      ],
      hints: [
        'Inside the first constructor, `width` means the parameter. To reach the instance variable write `this.width`.',
        '`this.width = width;` and `this.height = height;` are the whole first constructor.',
        'For the square, set both instance variables to `side`.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A constructor has the class name, no return type, and runs once per `new`.',
        'Its job is to give every instance variable a valid starting value.',
        'Unset instance variables get defaults: 0, 0.0, false or null.',
        'Writing any constructor removes Java\'s free no-argument one.',
        'When a parameter shadows an instance variable, use `this.name = name;`.',
      ],
      mistakes: [
        'Writing `void` in front of a constructor.',
        '`name = name;` instead of `this.name = name;`.',
        'Declaring a new local variable in the constructor, like `String title = t;`, which hides the instance variable.',
        'Calling `new ClassName()` when no constructor takes zero arguments.',
      ],
    },
  ],
};
