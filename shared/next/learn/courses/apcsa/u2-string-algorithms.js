export default {
  id: 'string-algorithms',
  title: 'Loops over strings',
  minutes: 30,
  summary: 'Walk through a string one character at a time to count, reverse, search and build new strings.',
  topics: ['2.10'],
  steps: [
    {
      kind: 'explain',
      title: 'Reading a word letter by letter',
      body: `When you check a word for vowels by hand, your finger moves along it one letter at a time. A loop does the same, with the index as the finger:

\`\`\`java
for (int i = 0; i < word.length(); i++) {
    String letter = word.substring(i, i + 1);
    // do something with letter
}
\`\`\`

Three details make this work:

- \`i\` starts at **0**, the first index.
- The test is \`i < word.length()\`, so the last pass has \`i\` equal to \`length() - 1\`, the last index.
- \`substring(i, i + 1)\` is the one-character string at index \`i\`. On the last pass, \`i + 1\` equals \`length()\`, which \`substring\` allows as an end index.

Change \`<\` to \`<=\` and the last pass asks for \`substring(length(), length() + 1)\`, which crashes.`,
      diagram: { type: 'array', name: 'word = "loop"', values: ['l', 'o', 'o', 'p'], highlight: [1, 2], caption: 'i runs 0, 1, 2, 3. The highlighted letters are where a vowel counter adds 1.' },
    },
    {
      kind: 'example',
      title: 'Count the vowels',
      body: 'Change the word and run it. Then make it count the letter "s" instead.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        String word = "Mississippi";
        int vowels = 0;
        for (int i = 0; i < word.length(); i++) {
            String letter = word.substring(i, i + 1);
            if ("aeiouAEIOU".indexOf(letter) >= 0) {
                vowels++;
            }
        }
        System.out.println(vowels + " vowels in " + word);
    }
}
`,
      output: '4 vowels in Mississippi\n',
    },
    {
      kind: 'explain',
      title: 'Building a new string',
      body: `Strings never change, but a loop can **build a new one**, starting from the empty string \`""\` and joining pieces on with \`+=\`.

**Reverse**: put each letter in front of what you have so far.

\`\`\`java
String rev = "";
for (int i = 0; i < s.length(); i++) {
    rev = s.substring(i, i + 1) + rev;
}
\`\`\`

**Filter**: keep only the letters you want, for example everything except spaces:

\`\`\`java
String squished = "";
for (int i = 0; i < s.length(); i++) {
    String c = s.substring(i, i + 1);
    if (!c.equals(" ")) {
        squished += c;
    }
}
\`\`\`

Compare single letters with \`equals\`, never \`==\`.`,
    },
    {
      kind: 'predict',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        String s = "stressed";
        String out = "";
        for (int i = 0; i < s.length(); i++) {
            out = s.substring(i, i + 1) + out;
        }
        System.out.println(out);
        System.out.println(out.indexOf("s"));
    }
}
`,
      output: 'desserts\n2\n',
      choices: ['desserts\n2\n', 'stressed\n0\n', 'desserts\n7\n', 'dessert\n2\n'],
      explain: `Each letter goes in front of the result so far, so the string comes out reversed: "stressed" backwards is "desserts". In "desserts" the indexes are d0 e1 s2 s3 e4 r5 t6 s7, and \`indexOf\` reports the **first** match, index 2, not the last one at 7.`,
    },
    {
      kind: 'explain',
      title: 'Looking at every window',
      body: `To find a pattern longer than one letter, slide a **window** of that length along the string. For a pattern of length \`k\`, the window starting at \`i\` is \`s.substring(i, i + k)\`.

The last window must end at \`s.length()\`, so the last start is \`s.length() - k\`. That gives the loop header:

\`\`\`java
for (int i = 0; i <= s.length() - k; i++) {
    if (s.substring(i, i + k).equals(pattern)) {
        count++;
    }
}
\`\`\`

Note the \`<=\`: here we compare against the last *start*, not the length. Using \`i < s.length()\` would let \`i + k\` run past the end and crash.

This counts overlapping matches too: "aa" appears twice in "aaa" (starting at 0 and at 1).`,
    },
    {
      kind: 'check',
      title: 'The right bound',
      prompt: 'A loop checks every two-letter window of `String s` with `s.substring(i, i + 2)`. Which header visits every window without crashing?',
      options: [
        { text: '`for (int i = 0; i < s.length() - 1; i++)`', correct: true, why: 'The last start is `length() - 2`, and `i < length() - 1` stops exactly there. Same as `i <= s.length() - 2`.' },
        { text: '`for (int i = 0; i < s.length(); i++)`', why: 'On the last pass i is `length() - 1`, so `i + 2` is `length() + 1`, past the end. It crashes.' },
        { text: '`for (int i = 1; i < s.length(); i++)`', why: 'Starting at 1 skips the first window, and the last pass still runs past the end.' },
        { text: '`for (int i = 0; i < s.length() - 2; i++)`', why: 'This stops one window early and misses the window at the very end of the string.' },
      ],
    },
    {
      kind: 'check',
      title: 'Comparing letters',
      prompt: 'Inside a loop, `String c = word.substring(i, i + 1);`. Which condition correctly tests whether `c` is the letter e?',
      options: [
        { text: '`c.equals("e")`', correct: true, why: '`c` is a String, so compare its contents with `equals`.' },
        { text: '`c == "e"`', why: '`==` compares references. `substring` builds a new String object, so this is usually false even when the letter is e.' },
        { text: "`c == 'e'`", why: "`'e'` is a char, not a String. Comparing a String to a char with `==` does not compile." },
        { text: '`c.indexOf("e")`', why: '`indexOf` returns an int (0 or -1 here), not a boolean, so it cannot be a condition on its own.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Clean up a hashtag',
      body: `Turn a phrase into a hashtag. The input is one line of text. Print \`#\` followed by the phrase with **all spaces removed**, then on a second line the number of words, which is the number of spaces plus one.

For \`go panthers go\`:

\`\`\`
#gopanthersgo
Words: 3
\`\`\`

You may assume words are separated by single spaces and the line does not start or end with a space. Read the line with \`in.nextLine()\`.`,
      starter: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String phrase = in.nextLine();
        String tag = "#";
        int spaces = 0;
        // walk through phrase one character at a time
        System.out.println(tag);
        System.out.println("Words: " + (spaces + 1));
    }
}
`,
      solution: String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String phrase = in.nextLine();
        String tag = "#";
        int spaces = 0;
        for (int i = 0; i < phrase.length(); i++) {
            String c = phrase.substring(i, i + 1);
            if (c.equals(" ")) {
                spaces++;
            } else {
                tag += c;
            }
        }
        System.out.println(tag);
        System.out.println("Words: " + (spaces + 1));
    }
}
`,
      tests: [
        { name: 'Three words', stdin: 'go panthers go\n', stdout: '#gopanthersgo\nWords: 3\n' },
        { name: 'One word', stdin: 'java\n', stdout: '#java\nWords: 1\n' },
        { name: 'Keeps capitals and digits', stdin: 'AP CSA 2026 Ready\n', stdout: '#APCSA2026Ready\nWords: 4\n' },
      ],
      hints: [
        'Loop `i` from 0 while `i < phrase.length()` and take `phrase.substring(i, i + 1)` each time.',
        'If the character equals `" "`, count it; otherwise add it to `tag` with `+=`.',
        'Use `equals`, not `==`, to compare the one-letter string with a space.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Visit each character with `for (int i = 0; i < s.length(); i++)` and `s.substring(i, i + 1)`.',
        'Build new strings from `""` with `+=`; put letters in front to reverse.',
        'For windows of length k, loop while `i <= s.length() - k`.',
        'Compare one-letter strings with `equals`.',
      ],
      mistakes: [
        'Using `i <= s.length()`, which crashes on the last pass.',
        'Comparing letters with `==`.',
        'Calling `s.substring(i)` (to the end) when you meant one character, `s.substring(i, i + 1)`.',
        'Expecting a loop that changes nothing but a local copy to edit the original string.',
      ],
    },
  ],
};
