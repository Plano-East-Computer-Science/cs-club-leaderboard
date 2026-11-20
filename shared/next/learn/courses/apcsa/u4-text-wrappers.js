export default {
  id: 'text-files-wrappers',
  title: 'Data from text, and wrapper classes',
  minutes: 30,
  summary: 'Read a data file line by line, split each line into fields, and turn text into numbers with the Integer and Double wrapper classes.',
  topics: ['4.6', '4.7'],
  steps: [
    {
      kind: 'explain',
      title: 'Real data lives in files',
      body: `Data sets usually arrive as text files: a spreadsheet saved as CSV, a log, a list of scores. Each **line** is one record, and the **fields** in a line are separated by commas or spaces:

\`\`\`
Ana,11,3.9
Bo,12,3.4
Cy,10,3.7
\`\`\`

Reading it takes three steps you will repeat in every data program:

1. Open the file and read it **one line at a time**.
2. **Split** each line into its fields.
3. **Convert** fields that are numbers from text into \`int\` or \`double\`.`,
    },
    {
      kind: 'explain',
      title: 'Reading a file with Scanner',
      body: `In desktop Java (and on the AP exam), you read a file with a \`Scanner\` built on a \`File\`:

\`\`\`java
import java.io.File;
import java.io.IOException;
import java.util.Scanner;

public class Main {
    public static void main(String[] args) throws IOException {
        Scanner file = new Scanner(new File("students.txt"));
        while (file.hasNextLine()) {
            String line = file.nextLine();
            // split and use the line
        }
        file.close();
    }
}
\`\`\`

- \`throws IOException\` is required: the file might be missing, and Java makes you acknowledge that.
- \`hasNextLine()\` is true while there is another line to read, which makes it the loop condition.

The in-browser runner on this site has no file system. So in the examples here, **standard input stands in for the file**: the code is identical except for \`new Scanner(System.in)\` instead of \`new Scanner(new File(...))\`.`,
    },
    {
      kind: 'explain',
      title: 'split turns a line into fields',
      body: `\`line.split(",")\` cuts a String wherever a comma appears and returns a \`String[]\` of the pieces:

\`\`\`java
String line = "Ana,11,3.9";
String[] parts = line.split(",");
// parts[0] is "Ana", parts[1] is "11", parts[2] is "3.9"
\`\`\`

Every piece is still **text**. \`"11" + 1\` is \`"111"\`, not 12. To do arithmetic you convert with the **wrapper classes**:

- \`Integer.parseInt("11")\` returns the int \`11\`
- \`Double.parseDouble("3.9")\` returns the double \`3.9\`

If the text is not a number, like \`Integer.parseInt("eleven")\`, the program crashes with a NumberFormatException.`,
    },
    {
      kind: 'example',
      title: 'Parse a small data file',
      body: 'The input under the code plays the role of `students.txt`. Run it, then add a fourth student to the input in your head and predict the new average.',
      stdin: 'Ana,11,3.9\nBo,12,3.4\nCy,10,3.7\n',
      code: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner file = new Scanner(System.in);   // new Scanner(new File("students.txt")) on a real computer
        double total = 0;
        int count = 0;
        while (file.hasNextLine()) {
            String line = file.nextLine();
            String[] parts = line.split(",");
            String name = parts[0];
            int grade = Integer.parseInt(parts[1]);
            double gpa = Double.parseDouble(parts[2]);
            System.out.println(name + " is in grade " + grade);
            total += gpa;
            count++;
        }
        System.out.println("Average GPA: " + total / count);
    }
}
`,
      output: 'Ana is in grade 11\nBo is in grade 12\nCy is in grade 10\nAverage GPA: 3.6666666666666665\n',
    },
    {
      kind: 'predict',
      body: 'Text and numbers behave very differently with `+`. Type the output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        String[] parts = "7,35".split(",");
        System.out.println(parts[0] + parts[1]);
        System.out.println(Integer.parseInt(parts[0]) + Integer.parseInt(parts[1]));
        System.out.println(parts.length);
    }
}
`,
      output: '735\n42\n2\n',
      explain: `\`parts\` is \`{"7", "35"}\`. Joining two Strings gives "735". After parsing, 7 + 35 is 42. Splitting at one comma gives two pieces, so \`parts.length\` is 2 (an array, so no parentheses).`,
    },
    {
      kind: 'explain',
      title: 'Wrapper classes and autoboxing',
      body: `Every primitive type has a matching class that "wraps" the value in an object: \`Integer\` for \`int\`, \`Double\` for \`double\`. Besides \`parseInt\`, they matter because some Java tools only hold **objects**. The next lesson's \`ArrayList\` is one: you write \`ArrayList<Integer>\`, never \`ArrayList<int>\`.

Java converts between the two automatically:

- **Autoboxing**: \`Integer boxed = 5;\` wraps the int in an Integer.
- **Unboxing**: \`int n = boxed;\` takes the int back out.

Useful constants live here too: \`Integer.MAX_VALUE\` and \`Integer.MIN_VALUE\`.

One trap: \`Integer\` objects are objects, so comparing two of them with \`==\` compares references. Use \`.equals\`, or unbox to int first.`,
    },
    {
      kind: 'check',
      title: 'Turning text into a number',
      prompt: '`String s = "128";`. Which statement stores the number 128 in an int?',
      options: [
        { text: '`int n = Integer.parseInt(s);`', correct: true, why: '`parseInt` reads the digits in the String and returns the int they spell.' },
        { text: '`int n = (int) s;`', why: 'A cast cannot turn a String into an int. This does not compile.' },
        { text: '`int n = s.length();`', why: 'That is the number of characters, 3, not the value 128.' },
        { text: '`int n = Integer.parseInt(s) + "";`', why: 'Adding `""` turns the result back into a String, which cannot be stored in an int.' },
      ],
    },
    {
      kind: 'check',
      title: 'What does split give?',
      prompt: 'What is `"red green blue".split(" ")[1].length()`?',
      options: [
        { text: '5', correct: true, why: 'Splitting at spaces gives {"red", "green", "blue"}. Index 1 is "green", which has 5 letters.' },
        { text: '3', why: 'That is the length of "red", index 0. Arrays start counting at 0, so index 1 is the second word.' },
        { text: '4', why: '"blue" is at index 2.' },
        { text: '14', why: 'That is the length of the whole original string. split returns separate pieces.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Top scorer from a game log',
      body: `A game server writes one line per player: \`name,score\`. The input is that log (stdin standing in for the file). Read every line and print the player with the highest score and their score, then the total of all scores:

\`\`\`
Top: Lia with 940
Total: 2200
\`\`\`

If two players tie for the top, report the one that appears first. There is at least one line.`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner file = new Scanner(System.in);
        String topName = "";
        int topScore = 0;
        int total = 0;
        while (file.hasNextLine()) {
            String line = file.nextLine();
            // split the line, convert the score, update the three variables
        }
        System.out.println("Top: " + topName + " with " + topScore);
        System.out.println("Total: " + total);
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner file = new Scanner(System.in);
        String topName = "";
        int topScore = Integer.MIN_VALUE;
        int total = 0;
        while (file.hasNextLine()) {
            String line = file.nextLine();
            if (line.length() == 0) {
                continue;
            }
            String[] parts = line.split(",");
            int score = Integer.parseInt(parts[1]);
            total += score;
            if (score > topScore) {
                topScore = score;
                topName = parts[0];
            }
        }
        System.out.println("Top: " + topName + " with " + topScore);
        System.out.println("Total: " + total);
    }
}
`,
      tests: [
        { name: 'Three players', stdin: 'Max,610\nLia,940\nJo,650\n', stdout: 'Top: Lia with 940\nTotal: 2200\n' },
        { name: 'A tie keeps the first', stdin: 'Ari,300\nBea,300\n', stdout: 'Top: Ari with 300\nTotal: 600\n' },
        { name: 'Negative scores', stdin: 'Zed,-5\nYu,-2\n', stdout: 'Top: Yu with -2\nTotal: -7\n' },
      ],
      hints: [
        'Split each line at the comma: `String[] parts = line.split(",");`. The name is `parts[0]` and the score is `Integer.parseInt(parts[1])`.',
        'Starting `topScore` at 0 fails when every score is negative. Start it at `Integer.MIN_VALUE`.',
        'Use `>` (not `>=`) so a later tie does not replace the first player.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Read a file with `new Scanner(new File(name))`, loop with `hasNextLine()`, and add `throws IOException`.',
        '`line.split(",")` returns a String array of fields.',
        'Fields are text; convert with `Integer.parseInt` and `Double.parseDouble`.',
        'Integer and Double wrap primitives as objects; Java boxes and unboxes automatically.',
      ],
      mistakes: [
        'Doing arithmetic on fields before parsing them.',
        'Forgetting `throws IOException` on the method that opens the file.',
        'Comparing Integer objects with `==`.',
        'Using the wrong index after split; fields start at index 0.',
      ],
    },
  ],
};
