export default {
  id: 'variables',
  title: 'Variables, types and input',
  minutes: 30,
  summary: 'Store values in named boxes, pick the right type for each one, and read what the user types with a Scanner.',
  topics: ['1.2', '1.4'],
  steps: [
    {
      kind: 'explain',
      title: 'A labelled box',
      body: `Think about the lockers at school. Each one has a label on the front and something inside. You can open locker 214, look at what is in it, or swap it for something else. The label stays the same; the contents change.

A **variable** is a locker in the computer's memory. It has a **name** (the label), a **type** (what kind of thing fits inside) and a **value** (what is in it right now).

\`\`\`java
int score = 42;
\`\`\`

Read that line out loud as "make a box called \`score\` that holds a whole number, and put 42 in it." Three things happen in one line:

- \`int\` is the **type**: this box only holds whole numbers.
- \`score\` is the **name** you will use to get at the box later.
- \`= 42\` puts the first value in the box. This is called **initializing** the variable.

Once the box exists, writing \`score\` anywhere in your code means "whatever is in the score box right now."`,
      diagram: {
        type: 'vars',
        vars: [{ name: 'score', type: 'int', value: '42' }],
        caption: 'One box in memory: its label is score, it holds an int, and right now it holds 42.',
      },
    },
    {
      kind: 'explain',
      title: 'Four types to start with',
      body: `Every variable has exactly one type, chosen when you declare it, and it can never hold anything else. These four cover most of Unit 1:

- \`int\` holds a whole number: \`17\`, \`0\`, \`-250\`. No decimal point.
- \`double\` holds a number that can have a decimal part: \`3.14\`, \`-0.5\`, \`72.0\`.
- \`boolean\` holds one of exactly two values: \`true\` or \`false\`. No quotes; they are not words, they are values.
- \`String\` holds text: \`"Maya"\`, \`"GG"\`, even \`""\` (the empty string).

The first three are **primitive types**. Their box holds the value itself. Notice they start with a lowercase letter.

\`String\` starts with a capital letter because it is a **class**, so it is a **reference type**. Its box holds an arrow to a String object that lives somewhere else in memory. You will see exactly what that means in the objects lesson. For now you can use a String variable like any other.

Pick the type that matches the real thing: a count of people is an \`int\`, a price is a \`double\`, "is the game over?" is a \`boolean\`, a username is a \`String\`.`,
      diagram: {
        type: 'vars',
        vars: [
          { name: 'players', type: 'int', value: '4' },
          { name: 'price', type: 'double', value: '4.99' },
          { name: 'gameOver', type: 'boolean', value: 'false' },
          { name: 'username', type: 'String', value: '"Maya"' },
        ],
        caption: 'Four boxes, four types. Each box only ever holds its own kind of value.',
      },
    },
    {
      kind: 'example',
      title: 'Make some boxes',
      body: 'Run it. Then change the values (try a different name, or `true` for `gameOver`) and run it again. Try putting `4.5` in `players` and read the error you get.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int players = 4;
        double price = 4.99;
        boolean gameOver = false;
        String username = "Maya";

        System.out.println(username + " is playing with " + players + " people.");
        System.out.println("Ticket price: $" + price);
        System.out.println("Game over? " + gameOver);
    }
}
`,
      output: 'Maya is playing with 4 people.\nTicket price: $4.99\nGame over? false\n',
    },
    {
      kind: 'explain',
      title: 'The equals sign means store',
      body: `In math class, \`=\` means "these two things are the same." In Java it means something different: **take the value on the right and store it in the box on the left.** It is called the **assignment operator**.

You can split creating a variable into two steps:

\`\`\`java
int lives;      // declare: make the box, nothing useful in it yet
lives = 3;      // assign: put 3 in the box
lives = 2;      // assign again: 3 is thrown away, the box now holds 2
\`\`\`

Two rules follow from "store":

1. **The right side is worked out first, then stored.** So \`lives = lives - 1;\` is not nonsense. Java reads the current value (2), subtracts 1, and stores 1 back in the same box.
2. **Storing copies a value.** After \`int b = a;\`, the box \`b\` holds its own copy of whatever \`a\` held at that moment. Changing \`a\` later does not reach into \`b\`.

You only write the type once, when the variable is declared. Writing \`int lives = 5;\` a second time is a compile error, because that box already exists.`,
    },
    {
      kind: 'predict',
      body: 'Trace it on paper, one line at a time, keeping track of what is in each box. Then type the output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int a = 5;
        int b = a;
        a = 10;
        b = b + 1;
        System.out.println(a + " " + b);
    }
}
`,
      output: '10 6\n',
      explain: `Box by box:

1. \`int a = 5;\` makes \`a\` and stores 5.
2. \`int b = a;\` reads \`a\` (5) and stores a **copy** in \`b\`. Now both hold 5, but they are separate boxes.
3. \`a = 10;\` replaces what is in \`a\`. \`b\` is not touched; it still holds 5.
4. \`b = b + 1;\` reads \`b\` (5), adds 1, stores 6 back in \`b\`.

So \`a\` is 10 and \`b\` is 6. If you said \`10 11\`, you imagined \`b\` was tied to \`a\`. It was not: assignment copies the value once and that is it.`,
    },
    {
      kind: 'check',
      title: 'The wrong kind of value',
      prompt: 'Each choice is a single statement inside `main`. Which one causes a compile-time error?',
      options: [
        { text: '`int count = 3.5;`', correct: true, why: 'An `int` box only holds whole numbers. Java will not quietly throw away the `.5`, so the compiler stops with a "possible lossy conversion from double to int" error.' },
        { text: '`double average = 3;`', why: 'This compiles. The whole number 3 fits in a `double` box with no loss, so Java stores it as `3.0`. You will see this rule again in the casting lesson.' },
        { text: '`boolean ready = false;`', why: 'This compiles. `false` is one of the two boolean values. It is written without quotes.' },
        { text: '`String team = "42";`', why: 'This compiles. The quotes make `"42"` text, not a number, so it fits in a `String`.' },
      ],
    },
    {
      kind: 'explain',
      title: 'Naming boxes and locking them',
      body: `Java has strict rules for names (break them and the code will not compile) and conventions (break them and other programmers will wince).

**Rules.** A name is made of letters, digits, \`_\` and \`$\`. It cannot start with a digit, cannot contain spaces, and cannot be a Java keyword like \`int\`, \`class\` or \`public\`. Names are case-sensitive: \`score\` and \`Score\` are two different variables.

**Conventions.** Variable names use **camelCase**: start lowercase, and capitalize the first letter of each later word, like \`highScore\` or \`numberOfPlayers\`. Choose names that say what the value means. \`x\` tells a reader nothing; \`minutesLeft\` tells them everything.

**Constants.** Some values should never change once set, like the number of minutes in an hour or a tax rate. Add the keyword \`final\`:

\`\`\`java
final int MINUTES_PER_HOUR = 60;
final double TAX_RATE = 0.0825;
\`\`\`

Any later line that tries \`MINUTES_PER_HOUR = 61;\` is a compile error. By convention, constants are written in ALL_CAPS with underscores between words.`,
    },
    {
      kind: 'check',
      title: 'A good name',
      prompt: 'Which of the following is a legal variable name that also follows Java naming conventions?',
      options: [
        { text: '`totalPoints`', correct: true, why: 'Legal (only letters, does not start with a digit) and in camelCase: lowercase first word, capital P to start the second.' },
        { text: '`2ndPlace`', why: 'A name cannot start with a digit. `secondPlace` or `place2` would work.' },
        { text: '`total points`', why: 'A name cannot contain a space. Java reads this as two separate words and the line fails to compile.' },
        { text: '`double`', why: '`double` is a keyword, a word Java has reserved for itself, so it cannot be used as a name.' },
      ],
    },
    {
      kind: 'explain',
      title: 'Reading input with Scanner',
      body: `So far every value was typed into the code. Real programs ask the user. In Java you read input with a **Scanner**:

\`\`\`java
import java.util.Scanner;           // at the very top of the file

Scanner in = new Scanner(System.in); // inside main: a reader for the keyboard
\`\`\`

\`System.in\` is the keyboard (on this site, the **Input** box under the code). You will learn what \`new\` does in the objects lesson; for now, copy these two lines as they are.

The Scanner sees input as **tokens**: chunks of text separated by spaces or line breaks. Each method reads the next piece and hands it back so you can store it:

- \`in.nextInt()\` reads the next token as an \`int\`.
- \`in.nextDouble()\` reads the next token as a \`double\`.
- \`in.next()\` reads the next token as a \`String\` (one word, stops at a space).
- \`in.nextLine()\` reads **everything up to the end of the current line**, spaces included, as a \`String\`.

If the next token is not a number and you call \`nextInt()\`, the program crashes with an \`InputMismatchException\`, a run-time error.`,
    },
    {
      kind: 'example',
      title: 'A program that listens',
      body: 'This one reads from the Input box. Change the input to your own name and age, then run it again. Notice that `next()` stops at the space, so a two-word name loses its second word here.',
      editable: true,
      stdin: 'Maya 16\n',
      code: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String name = in.next();
        int age = in.nextInt();
        System.out.println("Hi " + name + ".");
        System.out.println("Next year you will be " + (age + 1) + ".");
    }
}
`,
      output: 'Hi Maya.\nNext year you will be 17.\n',
    },
    {
      kind: 'explain',
      title: 'The nextLine trap',
      body: `Here is the most common Scanner bug on the planet. The input is two lines:

\`\`\`
16
Maya Lopez
\`\`\`

and the code reads them like this:

\`\`\`java
int age = in.nextInt();
String name = in.nextLine();
\`\`\`

Picture a cursor moving through the input. \`nextInt()\` reads the digits \`16\` and **stops right before the line break**. It does not eat the line break. Then \`nextLine()\` means "read up to the end of the current line." The cursor is already sitting at the end of the first line, so \`nextLine()\` reads nothing and returns the empty string \`""\`. \`Maya Lopez\` is never read.

The fix is one extra call that throws away the rest of the number's line:

\`\`\`java
int age = in.nextInt();
in.nextLine();                 // skip past the line break after 16
String name = in.nextLine();   // now reads "Maya Lopez"
\`\`\`

Any time you call \`nextLine()\` after \`nextInt()\`, \`nextDouble()\` or \`next()\`, ask yourself whether a leftover line break is in the way.`,
    },
    {
      kind: 'predict',
      body: 'The input is `16` on the first line and `Maya Lopez` on the second. What prints?',
      stdin: '16\nMaya Lopez\n',
      code: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int age = in.nextInt();
        String name = in.nextLine();
        System.out.println("[" + name + "] is " + age);
    }
}
`,
      output: '[] is 16\n',
      choices: ['[Maya Lopez] is 16\n', '[] is 16\n', '[Maya] is 16\n', '[16] is 16\n'],
      explain: `\`nextInt()\` reads \`16\` and leaves the cursor just before the line break. \`nextLine()\` reads from there to the end of that same line, which is nothing, so \`name\` holds the empty string. The square brackets make the empty string visible: \`[]\`. The second line of input is never read at all. Adding \`in.nextLine();\` right after \`nextInt()\` would make it print \`[Maya Lopez] is 16\`.`,
    },
    {
      kind: 'check',
      title: 'Which method reads it?',
      prompt: 'The user types `New York City` and presses Enter. Which statement stores the whole phrase, spaces included, in `city`? Assume nothing has been read yet.',
      options: [
        { text: '`String city = in.nextLine();`', correct: true, why: '`nextLine()` reads everything up to the end of the line, spaces included, so `city` is `"New York City"`.' },
        { text: '`String city = in.next();`', why: '`next()` reads one token and stops at the first space, so `city` would be just `"New"`.' },
        { text: '`String city = in.nextString();`', why: 'There is no `nextString` method in Scanner, so this does not compile. Text is read with `next()` or `nextLine()`.' },
        { text: '`String city = in;`', why: '`in` is the Scanner itself, not something it read. A Scanner is not a String, so this does not compile.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Player card',
      body: `Your gaming club wants a program that prints a player card. The input is three lines: a gamertag (one word), a level (a whole number) and a favorite game (a full line that can contain spaces).

\`\`\`
Maya
7
Rocket League
\`\`\`

For that input, print exactly:

\`\`\`
Player: Maya
Level: 7
Next level: 8
Favorite game: Rocket League
\`\`\`

The starter already reads everything and prints the card, but something is off. Run it first and look closely at the last line.`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String tag = in.next();
        int level = in.nextInt();
        String game = in.nextLine();

        System.out.println("Player: " + tag);
        System.out.println("Level: " + level);
        System.out.println("Next level: " + level);
        System.out.println("Favorite game: " + game);
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String tag = in.next();
        int level = in.nextInt();
        in.nextLine();
        String game = in.nextLine();

        System.out.println("Player: " + tag);
        System.out.println("Level: " + level);
        System.out.println("Next level: " + (level + 1));
        System.out.println("Favorite game: " + game);
    }
}
`,
      tests: [
        { name: 'A game with spaces in its name', stdin: 'Maya\n7\nRocket League\n', stdout: 'Player: Maya\nLevel: 7\nNext level: 8\nFavorite game: Rocket League\n' },
        { name: 'A brand new player at level 0', stdin: 'n00b\n0\nMinecraft\n', stdout: 'Player: n00b\nLevel: 0\nNext level: 1\nFavorite game: Minecraft\n' },
        { name: 'A game whose name is a number', stdin: 'Dev\n41\n2048\n', stdout: 'Player: Dev\nLevel: 41\nNext level: 42\nFavorite game: 2048\n' },
      ],
      hints: [
        'There are two bugs. One is on the "Next level" line: it prints the same number as "Level". The other is that the favorite game comes out empty.',
        'For the next level, add 1 inside parentheses so it is done as math before joining: `(level + 1)`. For the empty game, remember that `nextInt()` leaves the line break behind.',
        'Put `in.nextLine();` on its own line right after `int level = in.nextInt();`, before the line that reads `game`.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A variable is a named box with a type and a value. `int` holds whole numbers, `double` decimals, `boolean` true or false, `String` text.',
        '`=` means store: work out the right side, then put it in the box on the left. Assigning copies the value; the boxes stay separate.',
        'Declare a variable once with its type. `final` makes a constant that cannot be reassigned; name it in ALL_CAPS.',
        'Scanner reads input: `nextInt`, `nextDouble`, `next` (one word) and `nextLine` (the rest of the line).',
        'After `nextInt()`, `nextDouble()` or `next()`, call `in.nextLine()` once before reading a full line.',
      ],
      mistakes: [
        'Storing a decimal in an `int` (`int x = 2.5;`), which does not compile.',
        'Writing the type again when reassigning (`int score = 10;` twice), which redeclares the variable and does not compile.',
        'Putting quotes around a boolean: `"true"` is a String, `true` is a boolean.',
        'Calling `nextLine()` right after `nextInt()` and getting an empty string.',
        'Using `next()` for input that can contain spaces, so only the first word is read.',
      ],
    },
  ],
};
