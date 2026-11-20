export default {
  id: 'frq-class-design',
  kind: 'frq',
  title: 'FRQ 2: class design',
  minutes: 25,
  summary: 'Practice the second free-response question: write a whole class from a description, with private state, a constructor and methods.',
  steps: [
    {
      kind: 'explain',
      title: 'How question 2 works',
      body: `Question 2, **Class Design**, describes a class in words and with an example of it being used, and asks you to write the **complete class**: header, instance variables, constructor and methods.

The rubric typically awards points for:

- a class header and **private** instance variables that can hold everything the class must remember,
- a constructor that **initializes** those variables from its parameters,
- each method header matching the description (name, parameters, return type),
- each method's logic, including the limits and edge cases in the description,
- **returning** values from the methods that return.

Read the example table of calls and results carefully. It is the specification: every call in it must produce exactly the result shown. Before writing, list what each object must remember between calls. Those, and only those, are your instance variables.`,
    },
    {
      kind: 'explain',
      title: 'The question',
      body: `Write the class \`ParkingMeter\`.

- \`ParkingMeter(int maxMinutes)\` creates a meter with 0 minutes on it that can never hold more than \`maxMinutes\`.
- \`void addQuarters(int q)\` adds 15 minutes per quarter, but the time on the meter never goes above the maximum.
- \`void tick(int minutes)\` lets that many minutes pass. Time never drops below 0.
- \`int getMinutes()\` returns the minutes left.
- \`boolean isExpired()\` returns true when no time is left.
- \`int getTotalPaid()\` returns the total number of quarters ever inserted, including any that bought time over the maximum.

| call | result |
| --- | --- |
| \`ParkingMeter m = new ParkingMeter(60);\` | |
| \`m.isExpired()\` | \`true\` |
| \`m.addQuarters(3);\` then \`m.getMinutes()\` | \`45\` |
| \`m.addQuarters(2);\` then \`m.getMinutes()\` | \`60\` (capped) |
| \`m.tick(70);\` then \`m.getMinutes()\` | \`0\` |
| \`m.getTotalPaid()\` | \`5\` |`,
    },
    {
      kind: 'exercise',
      title: 'Write ParkingMeter',
      body: 'Write the whole class. The tester runs commands from the input against one meter and prints the result of each call, the way the table above does.',
      starter: String.raw`public class ParkingMeter {
    // instance variables

    public ParkingMeter(int maxMinutes) {
    }

    public void addQuarters(int q) {
    }

    public void tick(int minutes) {
    }

    public int getMinutes() {
        return 0;
    }

    public boolean isExpired() {
        return false;
    }

    public int getTotalPaid() {
        return 0;
    }
}
`,
      solution: String.raw`public class ParkingMeter {
    private int max;
    private int minutes;
    private int quarters;

    public ParkingMeter(int maxMinutes) {
        max = maxMinutes;
        minutes = 0;
        quarters = 0;
    }

    public void addQuarters(int q) {
        quarters += q;
        minutes += 15 * q;
        if (minutes > max) {
            minutes = max;
        }
    }

    public void tick(int m) {
        minutes -= m;
        if (minutes < 0) {
            minutes = 0;
        }
    }

    public int getMinutes() {
        return minutes;
    }

    public boolean isExpired() {
        return minutes == 0;
    }

    public int getTotalPaid() {
        return quarters;
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        ParkingMeter m = new ParkingMeter(in.nextInt());
        while (in.hasNext()) {
            String cmd = in.next();
            if (cmd.equals("add")) {
                m.addQuarters(in.nextInt());
                System.out.println("minutes " + m.getMinutes());
            } else if (cmd.equals("tick")) {
                m.tick(in.nextInt());
                System.out.println("minutes " + m.getMinutes());
            } else if (cmd.equals("expired")) {
                System.out.println("expired " + m.isExpired());
            } else if (cmd.equals("paid")) {
                System.out.println("paid " + m.getTotalPaid());
            }
        }
    }
}
`,
      tests: [
        { name: 'A new meter is empty', rubric: 'Constructor initializes the time to 0; isExpired returns true at 0', stdin: '60\nexpired\n', stdout: 'expired true\n' },
        { name: 'Quarters add 15 minutes each', rubric: 'addQuarters updates the time; getMinutes returns it', stdin: '60\nadd 3\nexpired\n', stdout: 'minutes 45\nexpired false\n' },
        { name: 'Never over the maximum', rubric: 'addQuarters caps the time at the maximum passed to the constructor', stdin: '60\nadd 3\nadd 2\n', stdout: 'minutes 45\nminutes 60\n' },
        { name: 'Never below zero', rubric: 'tick reduces the time and never goes below 0', stdin: '60\nadd 2\ntick 10\ntick 70\nexpired\n', stdout: 'minutes 30\nminutes 20\nminutes 0\nexpired true\n' },
        { name: 'Counts every quarter paid', rubric: 'A separate instance variable tracks all quarters, including ones over the cap', stdin: '60\nadd 3\nadd 2\ntick 70\npaid\n', stdout: 'minutes 45\nminutes 60\nminutes 0\npaid 5\n' },
        { name: 'Each meter keeps its own maximum', rubric: 'The maximum is stored per object, not hard-coded', stdin: '30\nadd 5\n', stdout: 'minutes 30\n' },
      ],
      hints: [
        'The meter must remember three things between calls: its maximum, the minutes left and the quarters paid. Make each a private instance variable.',
        'In `addQuarters`, add to the quarter count first (all of them count), then add `15 * q` minutes and cap at the maximum.',
        'In `tick`, subtract, then set the time to 0 if it went negative. `isExpired` can return `minutes == 0`.',
      ],
    },
    {
      kind: 'check',
      title: 'Instance variable or not?',
      prompt: 'A student writes `addQuarters` with a local variable `int total = 0;` inside the method and adds the quarters to it. What happens to `getTotalPaid`?',
      options: [
        { text: 'It cannot report the total, because a local variable is gone when the method ends', correct: true, why: 'Anything the object must remember between calls has to be an instance variable. A local starts at 0 on every call and disappears afterwards.' },
        { text: 'It works, because the variable is updated on every call', why: 'A local variable is created fresh, at 0, each time the method runs, and cannot be seen by other methods.' },
        { text: 'It works if the local is declared `public`', why: 'Local variables cannot have access modifiers. This does not compile.' },
        { text: 'It works if `getTotalPaid` declares a local with the same name', why: 'That would be a different variable, also starting from scratch.' },
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'List what each object must remember between calls; those become private instance variables.',
        'The constructor sets every instance variable, using its parameters for the ones the caller chooses.',
        'Method headers must match the description exactly: name, parameter types, return type.',
        'Enforce every limit in the description inside the mutator that could break it.',
      ],
      mistakes: [
        'Public instance variables.',
        'Hard-coding a value (like 60) that should come from the constructor.',
        'Keeping state in local variables.',
        'A constructor with a return type, or a getter that prints instead of returning.',
      ],
    },
  ],
};
