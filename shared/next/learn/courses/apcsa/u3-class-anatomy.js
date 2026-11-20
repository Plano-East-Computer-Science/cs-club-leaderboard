export default {
  id: 'class-anatomy',
  title: 'Designing a class',
  minutes: 30,
  summary: 'Decide what an object should know and do, then write a class with private data and public methods.',
  topics: ['3.1', '3.2', '3.3'],
  steps: [
    {
      kind: 'explain',
      title: 'Leave out what does not matter',
      body: `A music app needs to represent a song. A real song has a composer's childhood, the studio's carpet color and a thousand other facts. The app needs a title, an artist, a length and a play count. Keeping only the details that matter for the job, and hiding how they work, is called **abstraction**.

Abstraction is what makes big programs possible. You used \`String\` for weeks without knowing how it stores its characters; you only needed its methods. Now you will design your own classes the same way.

To design a class, ask two questions:

1. What does each object need to **know**? Those become **instance variables** (attributes).
2. What does each object need to **do**? Those become **methods** (behaviors).`,
    },
    {
      kind: 'explain',
      title: 'The parts of a class',
      body: `\`\`\`java
public class Song {
    // instance variables: what every Song knows
    private String title;
    private int seconds;
    private int plays;

    // constructor: sets up a new Song
    public Song(String t, int s) {
        title = t;
        seconds = s;
        plays = 0;
    }

    // methods: what every Song can do
    public String getTitle() {
        return title;
    }

    public void play() {
        plays++;
    }
}
\`\`\`

- **Instance variables** are declared inside the class but outside any method. Every object gets its **own copy**, which lives as long as the object.
- The **constructor** has the class's name and no return type. It runs once, when \`new\` is called.
- **Methods** describe behavior and can use the instance variables directly.`,
    },
    {
      kind: 'explain',
      title: 'private data, public behavior',
      body: `Notice that the instance variables are \`private\` and the methods are \`public\`.

- \`private\` means only code **inside this class** can see it.
- \`public\` means any class can use it.

Hiding data behind methods is called **encapsulation**. It is like a car: you use the steering wheel and pedals (public), and you cannot reach in and turn the fuel injector by hand (private). The benefit is control. If \`plays\` were public, any code could write \`song.plays = -50\`. With it private, the only way to change it is \`play()\`, which can only add one.

On the AP exam, **instance variables are always private**, and a class's constructors and the methods other classes use are public. Writing a public instance variable in a free-response answer can cost you a point.`,
      diagram: {
        type: 'refs',
        vars: [{ name: 'a', type: 'Song', to: 1 }, { name: 'b', type: 'Song', to: 2 }],
        objects: [
          { id: 1, type: 'Song', fields: [{ name: 'title', value: '"Hey Jude"' }, { name: 'seconds', value: 431 }, { name: 'plays', value: 2 }] },
          { id: 2, type: 'Song', fields: [{ name: 'title', value: '"Yellow"' }, { name: 'seconds', value: 266 }, { name: 'plays', value: 0 }] },
        ],
        caption: 'Two Song objects, each with its own copy of every instance variable.',
      },
    },
    {
      kind: 'example',
      title: 'A class and a program that uses it',
      body: 'Two classes in one file: `Main` uses `Song`. Add a method `getMinutes()` to Song that returns `seconds / 60.0`, and print it.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        Song a = new Song("Hey Jude", 431);
        Song b = new Song("Yellow", 266);
        a.play();
        a.play();
        System.out.println(a.getTitle() + " played " + a.getPlays() + " times");
        System.out.println(b.getTitle() + " played " + b.getPlays() + " times");
    }
}

class Song {
    private String title;
    private int seconds;
    private int plays;

    public Song(String t, int s) {
        title = t;
        seconds = s;
        plays = 0;
    }

    public String getTitle() {
        return title;
    }

    public int getPlays() {
        return plays;
    }

    public void play() {
        plays++;
    }
}
`,
      output: 'Hey Jude played 2 times\nYellow played 0 times\n',
    },
    {
      kind: 'check',
      title: 'What can Main see?',
      prompt: 'With the `Song` class above, which statement inside `Main.main` does **not** compile?',
      options: [
        { text: '`a.plays = 10;`', correct: true, why: '`plays` is private, so only code inside `Song` can use it. Outside, you must go through a public method such as `play()`.' },
        { text: '`a.play();`', why: '`play` is public, so any class can call it.' },
        { text: '`String t = a.getTitle();`', why: '`getTitle` is public and returns a String.' },
        { text: '`Song c = new Song("Hello", 295);`', why: 'The constructor is public and takes a String and an int, which match the arguments.' },
      ],
    },
    {
      kind: 'predict',
      body: 'Each object keeps its own state. Type the output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        Lamp desk = new Lamp();
        Lamp hall = new Lamp();
        desk.toggle();
        hall.toggle();
        hall.toggle();
        desk.toggle();
        desk.toggle();
        System.out.println(desk.isOn() + " " + hall.isOn());
        System.out.println(desk.getFlips() + hall.getFlips());
    }
}

class Lamp {
    private boolean on;
    private int flips;

    public Lamp() {
        on = false;
        flips = 0;
    }

    public void toggle() {
        on = !on;
        flips++;
    }

    public boolean isOn() {
        return on;
    }

    public int getFlips() {
        return flips;
    }
}
`,
      output: 'true false\n5\n',
      choices: ['true false\n5\n', 'false true\n5\n', 'true false\n3\n', 'true true\n5\n'],
      explain: `\`desk\` is toggled three times: off to on, on to off, off to on, so it ends on. \`hall\` is toggled twice and ends off. The flips are counted separately for each lamp, 3 and 2, and the sum is 5.`,
    },
    {
      kind: 'explain',
      title: 'Design has consequences',
      body: `Programs run hospitals, cars and bank accounts, so design choices matter beyond the code.

- **Reliability**: encapsulation lets a class refuse bad values, like a negative balance, so one bug elsewhere cannot corrupt the data. Testing every method with normal and edge cases makes software dependable.
- **Legal and ethical issues**: code you did not write may be under a license or copyright that limits how you use it. Data you store about people (like the play history in our Song class) can reveal private things and must be protected.
- **Who is affected**: a design that works for you can fail for others, for example a form that only accepts one style of name.

The AP framework calls this the impact of program design. In practice: hide data, validate inputs, test, and think about who will use what you build.`,
    },
    {
      kind: 'check',
      title: 'Choosing instance variables',
      prompt: 'A class `Student` will be used to print report cards. Which is the best set of instance variables?',
      options: [
        { text: '`private String name;` `private double gpa;` `private int gradeLevel;`', correct: true, why: 'These are what each student needs to know for a report card, and they are private, as AP requires.' },
        { text: '`public String name;` `public double gpa;` `public int gradeLevel;`', why: 'The right data, but public instance variables break encapsulation. Any class could set a GPA of 12.' },
        { text: '`private String name;` `private double gpa;` `private int i;`', why: '`i` sounds like a loop counter. A loop variable belongs inside the method that loops, not in every Student object.' },
        { text: '`private String name;` `private String favoriteColor;` `private double gpa;`', why: 'A favorite color is not needed for a report card. Abstraction means keeping only what the job needs.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Finish the Pet class',
      body: `The \`Pet\` class has its instance variables and constructor already. Write its three methods:

- \`getName()\` returns the name
- \`getAge()\` returns the age
- \`describe()\` returns a String like \`"Rex is a 3 year old dog"\`

A hidden tester creates pets from the input and prints what your methods return (open "How this is tested" below to see it).`,
      starter: String.raw`public class Pet {
    private String name;
    private String species;
    private int age;

    public Pet(String n, String s, int a) {
        name = n;
        species = s;
        age = a;
    }

    public String getName() {
        return "";
    }

    public int getAge() {
        return 0;
    }

    public String describe() {
        return "";
    }
}
`,
      solution: String.raw`public class Pet {
    private String name;
    private String species;
    private int age;

    public Pet(String n, String s, int a) {
        name = n;
        species = s;
        age = a;
    }

    public String getName() {
        return name;
    }

    public int getAge() {
        return age;
    }

    public String describe() {
        return name + " is a " + age + " year old " + species;
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        while (in.hasNext()) {
            Pet p = new Pet(in.next(), in.next(), in.nextInt());
            System.out.println(p.getName() + " " + p.getAge());
            System.out.println(p.describe());
        }
    }
}
`,
      tests: [
        { name: 'A dog', stdin: 'Rex dog 3\n', stdout: 'Rex 3\nRex is a 3 year old dog\n' },
        { name: 'Two pets keep separate data', stdin: 'Mochi cat 7\nBubbles fish 1\n', stdout: 'Mochi 7\nMochi is a 7 year old cat\nBubbles 1\nBubbles is a 1 year old fish\n' },
        { name: 'A newborn', stdin: 'Pip hamster 0\n', stdout: 'Pip 0\nPip is a 0 year old hamster\n' },
      ],
      hints: [
        'A getter just returns the instance variable: `return name;`.',
        'Methods can use instance variables directly by name; you do not need parameters for them.',
        'Build the sentence with `+`: `name + " is a " + age + " year old " + species`. Watch the spaces.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Abstraction: keep only the data and behavior the job needs.',
        'Instance variables (what an object knows) are private; every object has its own copy.',
        'Constructors share the class name and have no return type.',
        'Public methods are the only way other classes use the object. That is encapsulation.',
        'Good design is reliable, respects licenses and privacy, and works for everyone who uses it.',
      ],
      mistakes: [
        'Declaring instance variables public.',
        'Declaring an instance variable inside a method, where it becomes a temporary local variable.',
        'Storing things every object does not need, like loop counters.',
        'Trying to read a private variable from another class instead of calling a getter.',
      ],
    },
  ],
};
