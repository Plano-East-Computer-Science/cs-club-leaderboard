export default {
  id: 'writing-methods',
  title: 'Writing methods',
  minutes: 30,
  summary: 'Write accessors, mutators and toString, return values instead of printing them, and protect an object from bad input.',
  topics: ['3.5'],
  steps: [
    {
      kind: 'explain',
      title: 'Questions and commands',
      body: `Most methods in a class are one of two kinds:

- An **accessor** answers a question about the object without changing it. Getters such as \`getBalance()\` are accessors. They have a return type and a \`return\` statement.
- A **mutator** is a command that changes the object's state, such as \`deposit(double amount)\`. Mutators are often \`void\`.

The anatomy of a method you write:

\`\`\`java
public double withdraw(double amount) {   // header: access, return type, name, parameters
    if (amount > balance) {
        return 0.0;                         // refuse, hand back nothing
    }
    balance -= amount;
    return amount;                          // hand back what was taken
}
\`\`\`

When \`return\` runs, the method ends immediately and its value goes back to the caller. Every path through a non-void method must reach a \`return\`, or it does not compile ("missing return statement").`,
    },
    {
      kind: 'explain',
      title: 'Return it, do not print it',
      body: `This is the most common way students lose points on free-response questions. Compare:

\`\`\`java
public int getTotal() {           public void getTotal() {
    return a + b + c;                 System.out.println(a + b + c);
}                                 }
\`\`\`

The left version **gives the number back** to whatever code asked, which can store it, compare it or add to it. The right version only puts characters on the screen; the caller gets nothing and cannot use the value.

When a question says a method "returns" something, it must use \`return\`, and printing is wrong even if the screen shows the right number. Print only when the task says to print.`,
    },
    {
      kind: 'example',
      title: 'Accessors, mutators and toString',
      body: 'Run it. Then add a mutator `cool(int degrees)` that lowers the target but never below 50.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        Thermostat t = new Thermostat(68);
        t.warm(5);
        t.warm(20);
        System.out.println(t.getTarget());
        System.out.println(t);
    }
}

class Thermostat {
    private int target;

    public Thermostat(int start) {
        target = start;
    }

    /** Raises the target, but never above 85. */
    public void warm(int degrees) {
        target += degrees;
        if (target > 85) {
            target = 85;
        }
    }

    public int getTarget() {
        return target;
    }

    public String toString() {
        return "Thermostat set to " + target;
    }
}
`,
      output: '85\nThermostat set to 85\n',
    },
    {
      kind: 'explain',
      title: 'toString and guarding state',
      body: `\`toString\` is special. If a class has \`public String toString()\`, Java calls it automatically whenever the object is printed or joined to a string. Without it, printing an object shows something like \`Thermostat@1b6d3586\`, which helps nobody.

Mutators are where you **protect** the object. The \`warm\` method above refuses to go past 85. Because \`target\` is private, there is no other way to change it, so the rule can never be broken. That is encapsulation doing real work.

Methods can also use their **parameters** and **local variables**. Parameters and locals exist only while the method runs; instance variables persist for the object's whole life. Use a local for a temporary result, and an instance variable only for something the object must remember.`,
    },
    {
      kind: 'predict',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        Wallet w = new Wallet(20);
        int got = w.spend(15);
        int again = w.spend(15);
        System.out.println(got + " " + again);
        System.out.println(w.getCash());
    }
}

class Wallet {
    private int cash;

    public Wallet(int c) {
        cash = c;
    }

    public int spend(int amount) {
        if (amount > cash) {
            return 0;
        }
        cash -= amount;
        return amount;
    }

    public int getCash() {
        return cash;
    }
}
`,
      output: '15 0\n5\n',
      choices: ['15 0\n5\n', '15 15\n-10\n', '15 5\n0\n', '0 0\n20\n'],
      explain: `The first spend: 15 is not more than 20, so cash drops to 5 and 15 is returned. The second spend: 15 is more than 5, so the first \`return 0\` runs and ends the method before \`cash -= amount\`. Cash stays 5.`,
    },
    {
      kind: 'check',
      title: 'Return or print?',
      prompt: 'A class `Quiz` has `private int correct;` and `private int total;`. Which method best matches this description: "returns the percent correct as a double"?',
      options: [
        { text: '```java\npublic double percent() {\n    return 100.0 * correct / total;\n}\n```', correct: true, why: 'It returns a double, and multiplying by 100.0 first makes the division a double division.' },
        { text: '```java\npublic void percent() {\n    System.out.println(100.0 * correct / total);\n}\n```', why: 'The description says returns. Printing shows the number but gives the caller nothing to use.' },
        { text: '```java\npublic double percent() {\n    return correct / total * 100;\n}\n```', why: '`correct / total` is int division, so 7 out of 10 becomes 0, and the result is 0.0.' },
        { text: '```java\npublic double percent() {\n    double p = 100.0 * correct / total;\n}\n```', why: 'It computes the value but never returns it, so this does not compile: missing return statement.' },
      ],
    },
    {
      kind: 'check',
      title: 'What does it print?',
      prompt: 'The class `Dog` has no `toString` method. What is printed by `System.out.println(new Dog("Rex"));`?',
      options: [
        { text: 'Something like `Dog@5e91993f`', correct: true, why: 'Without its own toString, Java uses a default that prints the class name and a code, not the dog\'s data.' },
        { text: '`Rex`', why: 'Java does not know which instance variable to show. You have to write toString to choose.' },
        { text: 'Nothing; it does not compile', why: 'Every object can be printed. It just prints something unhelpful without toString.' },
        { text: '`null`', why: 'The object exists, so it is not null. It prints the default object description.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Phone battery',
      body: `Finish the \`Battery\` class. A battery has a charge from 0 to 100.

- \`use(int minutes)\` drains 1 percent per 2 whole minutes (\`minutes / 2\`), never going below 0.
- \`charge(int amount)\` adds the amount, never going above 100.
- \`isLow()\` returns true when the charge is below 20.
- \`toString()\` returns \`"Battery 75%"\`.

The tester starts a battery at the first number, then runs commands such as \`use 30\` and \`charge 10\`, printing the battery and \`isLow()\` after each.`,
      starter: String.raw`public class Battery {
    private int level;

    public Battery(int start) {
        level = start;
    }

    public void use(int minutes) {
    }

    public void charge(int amount) {
    }

    public boolean isLow() {
        return false;
    }

    public String toString() {
        return "Battery " + level + "%";
    }
}
`,
      solution: String.raw`public class Battery {
    private int level;

    public Battery(int start) {
        level = start;
    }

    public void use(int minutes) {
        level -= minutes / 2;
        if (level < 0) {
            level = 0;
        }
    }

    public void charge(int amount) {
        level += amount;
        if (level > 100) {
            level = 100;
        }
    }

    public boolean isLow() {
        return level < 20;
    }

    public String toString() {
        return "Battery " + level + "%";
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        Battery b = new Battery(in.nextInt());
        while (in.hasNext()) {
            String cmd = in.next();
            int n = in.nextInt();
            if (cmd.equals("use")) {
                b.use(n);
            } else {
                b.charge(n);
            }
            System.out.println(b + " " + b.isLow());
        }
    }
}
`,
      tests: [
        { name: 'Drain a little', stdin: '80\nuse 30\n', stdout: 'Battery 65% false\n' },
        { name: 'Odd minutes round down', stdin: '50\nuse 5\nuse 61\n', stdout: 'Battery 48% false\nBattery 18% true\n' },
        { name: 'Never below 0', stdin: '10\nuse 100\n', stdout: 'Battery 0% true\n' },
        { name: 'Never above 100', stdin: '95\ncharge 20\n', stdout: 'Battery 100% false\n' },
        { name: 'Exactly 20 is not low', stdin: '30\nuse 20\n', stdout: 'Battery 20% false\n' },
      ],
      hints: [
        'In `use`, subtract `minutes / 2` (int division drops the half minute), then fix the level if it went below 0.',
        'In `charge`, add first, then clamp: `if (level > 100) level = 100;`.',
        '`isLow` can return a comparison directly: `return level < 20;`.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Accessors return information; mutators change state.',
        '`return` ends the method and hands back a value. Every path of a non-void method must return.',
        'When a task says "returns", return the value. Do not print it.',
        '`toString` is called automatically when an object is printed.',
        'Mutators can enforce rules (like a maximum), because private data has no other way in.',
      ],
      mistakes: [
        'Printing instead of returning.',
        'Missing a return on one branch of an if.',
        'Code after a `return` on the same path, which never runs.',
        'Making something an instance variable that should be a local variable.',
      ],
    },
  ],
};
