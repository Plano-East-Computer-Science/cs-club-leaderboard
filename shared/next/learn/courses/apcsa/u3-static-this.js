export default {
  id: 'static-scope-this',
  title: 'Static members, scope and this',
  minutes: 30,
  summary: 'Share one value across every object with static, know where each variable can be used, and refer to the current object with this.',
  topics: ['3.7', '3.8', '3.9'],
  steps: [
    {
      kind: 'explain',
      title: 'One whiteboard for the whole class',
      body: `Every student in a classroom has their own notebook, but there is one whiteboard that everybody shares. Instance variables are the notebooks: each object has its own. A **static variable** is the whiteboard: one copy that belongs to the **class itself** and is shared by every object.

\`\`\`java
public class Ticket {
    private static int sold = 0;   // one copy, shared
    private int number;            // one per ticket

    public Ticket() {
        sold++;
        number = sold;
    }
}
\`\`\`

Each new Ticket bumps the shared counter and keeps its own number. After three tickets, \`sold\` is 3 everywhere, while the tickets hold 1, 2 and 3.

A **static method** belongs to the class too, so it is called on the class name (\`Ticket.getSold()\`, just like \`Math.sqrt\`). Because it is not called on any particular object, a static method **cannot** use instance variables or call instance methods directly.`,
    },
    {
      kind: 'example',
      title: 'Counting objects',
      body: 'Run it. Then make a fourth ticket and run it again.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        Ticket a = new Ticket("Ana");
        Ticket b = new Ticket("Bo");
        Ticket c = new Ticket("Cy");
        System.out.println(b);
        System.out.println("Sold: " + Ticket.getSold());
    }
}

class Ticket {
    private static int sold = 0;
    private int number;
    private String holder;

    public Ticket(String holder) {
        sold++;
        number = sold;
        this.holder = holder;
    }

    public static int getSold() {
        return sold;
    }

    public String toString() {
        return "Ticket " + number + " of " + sold + " for " + holder;
    }
}
`,
      output: 'Ticket 2 of 3 for Bo\nSold: 3\n',
    },
    {
      kind: 'explain',
      title: 'Scope: where a variable lives',
      body: `A variable's **scope** is the region of code where it can be used.

- **Instance and static variables**: the whole class. Every method can use them.
- **Parameters**: the method they belong to.
- **Local variables**: from their declaration to the end of the block \`{ }\` they were declared in. A variable declared inside a loop or an if is gone after its closing brace.

When a local variable or parameter has the same name as an instance variable, the **local one wins** inside that method. That is shadowing, the trap you met with constructors.

Access modifiers are about a different kind of reach: \`private\` members can be used only inside their class, \`public\` ones from anywhere.`,
    },
    {
      kind: 'predict',
      body: 'Shared and separate state. Type the output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        Club x = new Club();
        Club y = new Club();
        x.join();
        x.join();
        y.join();
        System.out.println(x.getMine() + " " + y.getMine());
        System.out.println(Club.getTotal());
    }
}

class Club {
    private static int total = 0;
    private int mine = 0;

    public void join() {
        mine++;
        total++;
    }

    public int getMine() {
        return mine;
    }

    public static int getTotal() {
        return total;
    }
}
`,
      output: '2 1\n3\n',
      choices: ['2 1\n3\n', '3 3\n3\n', '2 1\n1\n', '3 1\n3\n'],
      explain: `\`mine\` is an instance variable, so x and y each count their own joins: 2 and 1. \`total\` is static, one shared copy, so every join from either object adds to it: 3.`,
    },
    {
      kind: 'explain',
      title: 'this: the object running the code',
      body: `Inside an instance method or constructor, the keyword \`this\` is a reference to **the current object**, the one the method was called on. You have used it to get past shadowing:

\`\`\`java
public void setName(String name) {
    this.name = name;
}
\`\`\`

\`this\` can also be passed as an argument, to hand the current object to another method:

\`\`\`java
public boolean isTwinOf(Pet other) { ... }
public boolean hasTwin(Pet other) {
    return other.isTwinOf(this);
}
\`\`\`

There is no \`this\` in a static method, because a static method is not running on behalf of any object. That is the real reason static methods cannot use instance variables.`,
    },
    {
      kind: 'check',
      title: 'What a static method can do',
      prompt: 'In the `Club` class above, which line would **not** compile if placed inside `public static int getTotal()`?',
      options: [
        { text: '`mine++;`', correct: true, why: '`mine` is an instance variable. A static method has no current object, so there is no `mine` to change.' },
        { text: '`total++;`', why: '`total` is static, so a static method can use it.' },
        { text: '`int temp = total * 2;`', why: 'A local variable and a static variable are both fine in a static method.' },
        { text: '`return total;`', why: 'Returning a static variable from a static method is exactly what getTotal does.' },
      ],
    },
    {
      kind: 'check',
      title: 'Out of scope',
      prompt: 'Which line causes a compile error?\n\n```java\npublic int sumTo(int n) {      // line 1\n    int sum = 0;               // line 2\n    for (int i = 1; i <= n; i++) {\n        sum += i;              // line 4\n    }\n    System.out.println(i);     // line 6\n    return sum;                // line 7\n}\n```',
      options: [
        { text: 'Line 6', correct: true, why: '`i` was declared in the for header, so its scope ends with the loop. After the loop there is no `i`: cannot find symbol.' },
        { text: 'Line 4', why: '`sum` was declared before the loop in the same method, so it is in scope inside the loop.' },
        { text: 'Line 7', why: '`sum` is still in scope at the end of the method, and it is an int, matching the return type.' },
        { text: 'Line 2', why: 'Declaring and initializing a local variable is fine.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Library cards',
      body: `Write the \`LibraryCard\` class so every card gets a unique ID number in order, starting at 1001.

- A **static** variable remembers the next ID to hand out.
- The constructor \`LibraryCard(String name)\` stores the name and takes the next ID.
- \`getId()\` returns this card's ID.
- static \`cardsIssued()\` returns how many cards have been made.
- \`toString()\` returns \`"1001 Ana"\` (the ID, a space, the name).

The tester makes one card per name in the input, prints each card, then prints \`cardsIssued()\`.`,
      starter: String.raw`public class LibraryCard {
    private String name;
    private int id;

    public LibraryCard(String name) {
        this.name = name;
    }

    public int getId() {
        return id;
    }

    public static int cardsIssued() {
        return 0;
    }

    public String toString() {
        return id + " " + name;
    }
}
`,
      solution: String.raw`public class LibraryCard {
    private static int nextId = 1001;
    private String name;
    private int id;

    public LibraryCard(String name) {
        this.name = name;
        id = nextId;
        nextId++;
    }

    public int getId() {
        return id;
    }

    public static int cardsIssued() {
        return nextId - 1001;
    }

    public String toString() {
        return id + " " + name;
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        while (in.hasNext()) {
            LibraryCard c = new LibraryCard(in.next());
            System.out.println(c);
        }
        System.out.println("Issued: " + LibraryCard.cardsIssued());
    }
}
`,
      tests: [
        { name: 'Three cards in order', stdin: 'Ana Bo Cy\n', stdout: '1001 Ana\n1002 Bo\n1003 Cy\nIssued: 3\n' },
        { name: 'One card', stdin: 'Dee\n', stdout: '1001 Dee\nIssued: 1\n' },
        { name: 'No cards', stdin: '\n', stdout: 'Issued: 0\n' },
      ],
      hints: [
        'Add `private static int nextId = 1001;`. Because it is static, every card sees the same counter.',
        'In the constructor, copy `nextId` into this card\'s `id`, then add 1 to `nextId`.',
        '`cardsIssued` can work out the count from the counter: `return nextId - 1001;`. A second static counter also works.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A static variable has one copy shared by every object; an instance variable has one copy per object.',
        'Static methods are called on the class and cannot use instance variables or `this`.',
        'Local variables live only inside the block where they are declared; parameters only inside their method.',
        'A local or parameter with the same name as an instance variable shadows it; `this.name` reaches the instance variable.',
        '`this` refers to the current object and can be passed to other methods.',
      ],
      mistakes: [
        'Making a counter an instance variable, so every object starts its own count at 0.',
        'Using an instance variable inside a static method.',
        'Using a loop variable after the loop ends.',
        'Making everything static to silence an error instead of creating an object.',
      ],
    },
  ],
};
