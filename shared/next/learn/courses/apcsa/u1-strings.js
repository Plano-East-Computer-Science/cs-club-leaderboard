export default {
  id: 'strings',
  title: 'Working with strings',
  minutes: 30,
  summary: 'Measure, slice, search and compare text with the String methods on the AP exam, and see why strings never change.',
  topics: ['1.15'],
  steps: [
    {
      kind: 'explain',
      title: 'Letters in numbered seats',
      body: `A \`String\` is an object that holds a sequence of characters. Picture each character sitting in a numbered seat. The numbers are **indexes**, and like everything else in Java they start at **0**.

For \`"PANTHER"\`, \`P\` is at index 0 and \`R\` is at index 6. There are 7 characters, so \`length()\` returns \`7\`, and the last index is always \`length() - 1\`.

That off-by-one gap between "how many" and "last index" causes more AP mistakes than anything else in this lesson. Say it out loud once: **seven letters, last index six**.`,
      diagram: { type: 'array', name: 'String s = "PANTHER";', values: ['P', 'A', 'N', 'T', 'H', 'E', 'R'], highlight: [0, 6], caption: 's.length() is 7. The first index is 0 and the last is 6.' },
    },
    {
      kind: 'explain',
      title: 'Slicing with substring',
      body: `\`substring\` copies part of a string. It comes in two forms:

- \`s.substring(a, b)\` gives the characters from index \`a\` up to **but not including** index \`b\`. It has \`b - a\` characters.
- \`s.substring(a)\` gives everything from index \`a\` to the end.

With \`String s = "PANTHER";\`:

\`\`\`java
s.substring(0, 3)   // "PAN"   indexes 0, 1, 2
s.substring(3)      // "THER"
s.substring(2, 3)   // "N"     one character
s.substring(7)      // ""      empty: starting right at the end is allowed
\`\`\`

The one-character form \`s.substring(i, i + 1)\` is how AP Java gets the character at index \`i\` as a String. You will use it constantly in loops in Unit 2.

An index past the end, like \`s.substring(2, 9)\`, crashes with a **StringIndexOutOfBoundsException**.`,
    },
    {
      kind: 'example',
      title: 'Slice and search',
      body: 'Change the word and run it again. Try a word with no "a" in it.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        String s = "banana split";
        System.out.println(s.length());
        System.out.println(s.substring(0, 6));
        System.out.println(s.substring(7));
        System.out.println(s.indexOf("a"));
        System.out.println(s.indexOf("nan"));
        System.out.println(s.indexOf("z"));
        System.out.println(s.substring(s.indexOf(" ") + 1).toUpperCase());
    }
}
`,
      output: '12\nbanana\nsplit\n1\n2\n-1\nSPLIT\n',
    },
    {
      kind: 'explain',
      title: 'Searching and comparing',
      body: `- \`s.indexOf(str)\` returns the index where \`str\` **first** appears, or \`-1\` if it is not there. That \`-1\` is how you ask "does it contain this?".
- \`s.equals(other)\` returns \`true\` when both strings have exactly the same characters, upper and lower case included.
- \`s.compareTo(other)\` compares in dictionary order and returns an int: **negative** if \`s\` comes first, **zero** if they are equal, **positive** if \`s\` comes after. \`"apple".compareTo("banana")\` is negative.

Never compare strings with \`==\`. On objects, \`==\` asks "are these the same object in memory?", not "do they hold the same text?". Two strings with the same letters can be different objects, so \`==\` can say \`false\` when you expected \`true\`. Always use \`equals\`.

Strings also join with \`+\` and \`+=\`, and \`toUpperCase()\` / \`toLowerCase()\` return changed copies.`,
    },
    {
      kind: 'predict',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        String word = "computer";
        String part = word.substring(3, 6);
        int where = word.indexOf("t");
        System.out.println(part);
        System.out.println(where + part.length());
        System.out.println(word.substring(where - 1, where + 1));
    }
}
`,
      output: 'put\n8\nut\n',
      choices: ['put\n8\nut\n', 'pute\n9\nut\n', 'put\n9\nute\n', 'mpu\n8\nut\n'],
      explain: `In \`"computer"\`, the indexes are c0 o1 m2 p3 u4 t5 e6 r7. \`substring(3, 6)\` takes indexes 3, 4, 5: \`"put"\`. \`indexOf("t")\` is 5, and \`5 + 3\` is 8. Then \`substring(4, 6)\` takes indexes 4 and 5: \`"ut"\`. The end index is never included.`,
    },
    {
      kind: 'explain',
      title: 'Strings never change',
      body: `Strings are **immutable**: once a String object is made, its characters can never change. Methods like \`toUpperCase\` and \`substring\` do not edit the string; they build and **return a new one**.

\`\`\`java
String name = "ada";
name.toUpperCase();          // makes "ADA", then throws it away
System.out.println(name);    // still "ada"
name = name.toUpperCase();   // now name refers to the new "ADA"
\`\`\`

The last line does not change the old object either. It moves the arrow: \`name\` now refers to a new String, and the old \`"ada"\` is left behind.`,
      diagram: {
        type: 'refs',
        vars: [{ name: 'name', type: 'String', to: 'new' }],
        objects: [{ id: 'old', type: 'String', fields: [{ name: 'text', value: '"ada"' }] }, { id: 'new', type: 'String', fields: [{ name: 'text', value: '"ADA"' }] }],
        caption: 'After name = name.toUpperCase(), the variable points at a new object. The old one is unchanged.',
      },
    },
    {
      kind: 'check',
      title: 'Nothing changed',
      prompt: 'What is printed?\n\n```java\nString t = "Hello";\nt.substring(1);\nt.toLowerCase();\nSystem.out.println(t + t.length());\n```',
      options: [
        { text: '`Hello5`', correct: true, why: 'Strings are immutable and both results were thrown away, so `t` is still "Hello", which has 5 characters.' },
        { text: '`ello4`', why: 'That would need `t = t.substring(1);`. Calling a String method does not change the string itself.' },
        { text: '`hello5`', why: '`toLowerCase` returned a new string that nobody stored.' },
        { text: '`Hello4`', why: '"Hello" has 5 characters: H e l l o. Its last index is 4, but its length is 5.' },
      ],
    },
    {
      kind: 'check',
      title: 'Comparing names',
      prompt: '`String a` and `String b` hold names typed by a user. Which expression is `true` exactly when `a` comes before `b` in dictionary order?',
      options: [
        { text: '`a.compareTo(b) < 0`', correct: true, why: '`compareTo` returns a negative number when the string it is called on comes first.' },
        { text: '`a < b`', why: 'Relational operators do not work on Strings in Java. This does not compile.' },
        { text: '`a.compareTo(b) == -1`', why: '`compareTo` promises only the sign of the result. It may return -3 or -12, so checking for exactly -1 is a bug.' },
        { text: '`a.equals(b) < 0`', why: '`equals` returns a boolean, which cannot be compared with `< 0`. It only tells you if they are the same.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Username maker',
      body: `A school makes usernames from a first and last name. Read the two names (each one word) and print the username: the **first letter** of the first name, plus the **first five letters** of the last name (or the whole last name if it is shorter), all in lower case. Then on a second line print how many characters the username has.

For \`Grace Hopper\`:

\`\`\`
ghoppe
6
\`\`\`

You have not learned if statements yet, so here is a trick for "at most five letters": \`Math.min(5, last.length())\` is the smaller of 5 and the name's length.`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String first = in.next();
        String last = in.next();
        String user = first + last;
        System.out.println(user);
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String first = in.next();
        String last = in.next();
        int n = Math.min(5, last.length());
        String user = (first.substring(0, 1) + last.substring(0, n)).toLowerCase();
        System.out.println(user);
        System.out.println(user.length());
    }
}
`,
      tests: [
        { name: 'Grace Hopper', stdin: 'Grace Hopper\n', stdout: 'ghoppe\n6\n' },
        { name: 'A short last name', stdin: 'Alan Kay\n', stdout: 'akay\n4\n' },
        { name: 'Exactly five letters', stdin: 'Ada Byron\n', stdout: 'abyron\n6\n' },
        { name: 'Mixed case input', stdin: 'katherine JOHNSON\n', stdout: 'kjohns\n6\n' },
      ],
      hints: [
        'The first letter of `first` is `first.substring(0, 1)`.',
        'Take `last.substring(0, n)` where `n` is `Math.min(5, last.length())`. That never goes past the end.',
        'Join the two pieces, then call `.toLowerCase()` on the result and store it, because strings never change in place.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Indexes run from 0 to `length() - 1`.',
        '`substring(a, b)` includes index a and excludes index b; `substring(a)` goes to the end.',
        '`indexOf` returns the first index of a match, or -1 if there is none.',
        'Compare text with `equals` and order with `compareTo` (negative, zero, positive). Never `==`.',
        'Strings are immutable: methods return new strings, so store the result.',
      ],
      mistakes: [
        'Using `s.substring(i, i)` and getting an empty string, or `s.substring(0, s.length() + 1)` and crashing.',
        'Using `s.length` without parentheses (that is for arrays, in Unit 4).',
        'Writing `name == "Ada"` instead of `name.equals("Ada")`.',
        'Calling `s.toUpperCase();` and expecting `s` to change.',
      ],
    },
  ],
};
