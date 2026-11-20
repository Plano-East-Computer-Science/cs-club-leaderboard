export default {
  id: 'objects',
  title: 'Objects: classes, instances and references',
  minutes: 30,
  summary: 'Create objects from a class with new, understand that a variable holds a reference to an object, and call methods on it.',
  topics: ['1.12', '1.13', '1.14'],
  steps: [
    {
      kind: 'explain',
      title: 'A blueprint and the houses built from it',
      body: `A **class** is a blueprint. It describes what every object of that kind *has* (its data, called **attributes** or instance variables) and what it can *do* (its **methods**).

An **object** is one thing built from that blueprint, also called an **instance**. One blueprint for a house; many houses on the street, each with its own paint color and its own family inside.

You have used one class of objects already: every piece of text in Java is a \`String\` object. In this lesson we use a small class called \`BankAccount\`. Every account *has* an owner and a balance, and every account *can* deposit, withdraw and report its balance. Two accounts are built from the same class but hold different money.`,
    },
    {
      kind: 'explain',
      title: 'Building an object with new',
      body: `You create an object with the keyword \`new\` followed by a call to a **constructor**, a special method with the same name as the class that sets up the new object:

\`\`\`java
BankAccount ana = new BankAccount("Ana", 50.0);
\`\`\`

Read it right to left. \`new BankAccount("Ana", 50.0)\` builds a brand new account object somewhere in memory with owner \`"Ana"\` and balance \`50.0\`. Then the variable \`ana\` stores a **reference** to it: not the object itself, but directions to where it lives, like a house address on a sticky note.

A class can have several constructors with different parameter lists (overloading again). \`new BankAccount("Bo")\` might start Bo with a balance of \`0.0\`. The arguments must match one of the constructors' parameter lists.`,
      diagram: {
        type: 'refs',
        vars: [{ name: 'ana', type: 'BankAccount', to: 'a' }, { name: 'n', type: 'int', value: 3 }],
        objects: [{ id: 'a', type: 'BankAccount', fields: [{ name: 'owner', value: '"Ana"' }, { name: 'balance', value: '50.0' }] }],
        caption: 'A primitive variable like n holds its value in the box. An object variable holds an arrow to the object.',
      },
    },
    {
      kind: 'example',
      title: 'Create objects and call their methods',
      body: 'The `BankAccount` class is written for you at the bottom of the file. `main` creates two accounts and calls methods on them with a dot. Run it, then add a third account.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        BankAccount ana = new BankAccount("Ana", 50.0);
        BankAccount bo = new BankAccount("Bo");

        ana.deposit(25.0);
        bo.deposit(10.0);
        bo.withdraw(4.0);

        System.out.println(ana.getOwner() + " has " + ana.getBalance());
        System.out.println(bo.getOwner() + " has " + bo.getBalance());
    }
}

class BankAccount {
    private String owner;
    private double balance;

    public BankAccount(String owner, double balance) {
        this.owner = owner;
        this.balance = balance;
    }

    public BankAccount(String owner) {
        this.owner = owner;
        this.balance = 0.0;
    }

    public void deposit(double amount) {
        balance += amount;
    }

    public void withdraw(double amount) {
        balance -= amount;
    }

    public double getBalance() {
        return balance;
    }

    public String getOwner() {
        return owner;
    }
}
`,
      output: 'Ana has 75.0\nBo has 6.0\n',
    },
    {
      kind: 'explain',
      title: 'Calling instance methods',
      body: `\`deposit\` and \`getBalance\` are **instance methods**: they belong to a particular object, so you call them on a reference with a dot: \`ana.deposit(25.0)\`. The method works on *that* object's data. Depositing into \`ana\` does not touch \`bo\`.

Instance methods follow the same rules as any method:

- \`deposit\` is \`void\`: it changes the object and returns nothing.
- \`getBalance\` returns a \`double\`: use the result or it is lost.

Compare this with the \`Math\` methods from the last lesson. Those are **static**, called on the class (\`Math.abs(x)\`), because they do not belong to any particular object. Instance methods are called on an object (\`ana.getBalance()\`).`,
    },
    {
      kind: 'predict',
      body: 'Both variables end up pointing somewhere. Type the output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        Counter a = new Counter();
        Counter b = new Counter();
        a.click();
        a.click();
        b.click();
        Counter c = a;
        c.click();
        System.out.println(a.getCount());
        System.out.println(b.getCount());
    }
}

class Counter {
    private int count;

    public void click() {
        count++;
    }

    public int getCount() {
        return count;
    }
}
`,
      output: '3\n1\n',
      explain: `\`a\` and \`b\` are two separate Counter objects. \`a\` is clicked twice and \`b\` once. Then \`Counter c = a;\` does **not** make a new counter: it copies the reference, so \`c\` and \`a\` point at the same object. Clicking \`c\` clicks that shared object, so \`a.getCount()\` is 3. \`b\` was never touched again, so it stays at 1. Two variables that refer to the same object are called **aliases**.`,
    },
    {
      kind: 'explain',
      title: 'null: a reference to nothing',
      body: `An object variable can hold the special value \`null\`, which means "no object". It is a sticky note with no address on it:

\`\`\`java
BankAccount mystery = null;
mystery.deposit(5.0);   // crash
\`\`\`

Calling a method on \`null\` has no object to work on, so the program stops with a **NullPointerException**. It compiles fine; it fails at run time. This is one of the most common crashes in Java. When you see it, look for the variable that never got a \`new\` object.

Forgetting \`new\` is the usual cause: \`BankAccount cat;\` only creates the variable, not an account.`,
    },
    {
      kind: 'example',
      title: 'Watch it crash',
      body: 'The first line prints, then the program stops. Read the error under the output.',
      crashes: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        String name = null;
        System.out.println("Before the crash");
        System.out.println(name.length());
        System.out.println("This line never runs");
    }
}
`,
      output: 'Before the crash\n',
    },
    {
      kind: 'check',
      title: 'How many objects?',
      prompt: 'How many `BankAccount` objects exist after this code runs?\n\n```java\nBankAccount x = new BankAccount("X");\nBankAccount y = x;\nBankAccount z = new BankAccount("Z", 9.0);\nBankAccount w = null;\n```',
      options: [
        { text: '2', correct: true, why: 'Only `new` makes an object, and it appears twice. `y` is an alias of `x`, and `w` refers to nothing.' },
        { text: '4', why: 'There are four variables, but a variable is not an object. `y = x` copies a reference and `w` is null.' },
        { text: '3', why: '`BankAccount y = x;` copies the reference in `x`; it does not build a new account.' },
        { text: '1', why: '`x` and `z` each come from their own `new`, so there are two separate objects.' },
      ],
    },
    {
      kind: 'check',
      title: 'Which call is valid?',
      prompt: 'Using the `BankAccount` class from this lesson and `BankAccount acct = new BankAccount("Lee", 20.0);`, which statement compiles?',
      options: [
        { text: '`double b = acct.getBalance();`', correct: true, why: '`getBalance` is an instance method that returns a double, called on an object reference.' },
        { text: '`double b = BankAccount.getBalance();`', why: '`getBalance` is an instance method. It needs a particular account to ask, so it must be called on an object, not the class.' },
        { text: '`acct.deposit();`', why: '`deposit` has one double parameter, so the call needs one argument.' },
        { text: '`double b = acct.deposit(5.0);`', why: '`deposit` is void, so it has no value to store.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Game scores',
      body: `The \`Player\` class at the bottom is written for you: \`new Player(name)\` starts at 0 points, \`addPoints(int)\` adds points, \`getScore()\` returns the score and \`getName()\` returns the name.

The input is a name and three ints. Create a player with that name, add each of the three numbers as points, and print the player's name and final score in this format:

\`\`\`
Mia: 42
\`\`\``,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String name = in.next();
        int r1 = in.nextInt();
        int r2 = in.nextInt();
        int r3 = in.nextInt();
        // create a Player, add the three rounds, print "name: score"
    }
}

class Player {
    private String name;
    private int score;

    public Player(String name) {
        this.name = name;
        score = 0;
    }

    public void addPoints(int points) {
        score += points;
    }

    public int getScore() {
        return score;
    }

    public String getName() {
        return name;
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String name = in.next();
        int r1 = in.nextInt();
        int r2 = in.nextInt();
        int r3 = in.nextInt();
        Player p = new Player(name);
        p.addPoints(r1);
        p.addPoints(r2);
        p.addPoints(r3);
        System.out.println(p.getName() + ": " + p.getScore());
    }
}

class Player {
    private String name;
    private int score;

    public Player(String name) {
        this.name = name;
        score = 0;
    }

    public void addPoints(int points) {
        score += points;
    }

    public int getScore() {
        return score;
    }

    public String getName() {
        return name;
    }
}
`,
      tests: [
        { name: 'Three rounds', stdin: 'Mia 10 20 12\n', stdout: 'Mia: 42\n' },
        { name: 'All zero', stdin: 'Sam 0 0 0\n', stdout: 'Sam: 0\n' },
        { name: 'A penalty round', stdin: 'Rae 15 -5 3\n', stdout: 'Rae: 13\n' },
      ],
      hints: [
        'Start with `Player p = new Player(name);`. Without `new` there is no player to add points to.',
        'Call the method on your object three times: `p.addPoints(r1);` and so on.',
        'Print with the getters: `p.getName() + ": " + p.getScore()`.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A class is a blueprint; an object is one instance built from it with `new` and a constructor.',
        'An object variable stores a reference (an arrow) to the object, not the object itself.',
        'Instance methods are called on an object with a dot and work on that object\'s own data.',
        'Assigning one object variable to another makes an alias: both refer to the same object.',
        '`null` means no object. Calling a method on null throws a NullPointerException.',
      ],
      mistakes: [
        'Declaring `Player p;` and then calling `p.addPoints(5)` without ever writing `new Player(...)`.',
        'Thinking `b = a` copies the object. It copies the reference.',
        'Calling an instance method on the class name, like `BankAccount.getBalance()`.',
        'Passing constructor arguments that match no constructor.',
      ],
    },
  ],
};
