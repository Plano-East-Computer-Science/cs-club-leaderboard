export default {
  id: 'arraylist-algorithms',
  title: 'Traversing and changing ArrayLists',
  minutes: 30,
  summary: 'Loop over an ArrayList safely, remove elements without skipping any, and write the standard list algorithms.',
  topics: ['4.9', '4.10'],
  steps: [
    {
      kind: 'explain',
      title: 'Same loops, different methods',
      body: `Traversing an ArrayList looks just like traversing an array, with method calls in place of brackets:

| array | ArrayList |
| --- | --- |
| \`arr.length\` | \`list.size()\` |
| \`arr[i]\` | \`list.get(i)\` |
| \`arr[i] = x;\` | \`list.set(i, x);\` |

\`\`\`java
for (int i = 0; i < list.size(); i++) {
    System.out.println(list.get(i));
}
for (String s : list) {          // enhanced for works too
    System.out.println(s);
}
\`\`\`

Every algorithm from the array lessons (sum, max, count, all/any) carries over. What is new is that a list can **change size while you loop over it**, and that is where the bugs live.`,
    },
    {
      kind: 'explain',
      title: 'Removing while looping skips elements',
      body: `Suppose you want to remove every negative number from \`[3, -1, -2, 5]\`:

\`\`\`java
for (int i = 0; i < list.size(); i++) {
    if (list.get(i) < 0) {
        list.remove(i);
    }
}
\`\`\`

Trace it. At i = 1 the -1 is removed, and the -2 **slides left into index 1**. Then \`i++\` moves on to index 2, so the -2 is never checked. The result is \`[3, -2, 5]\`.

Two standard fixes:

1. **Loop backwards**, from \`list.size() - 1\` down to 0. Removing an element only shifts elements you have already visited.
2. Loop forwards, but **only increase i when you did not remove**.`,
      diagram: { type: 'trace', columns: ['i', 'list before the check', 'list.get(i)', 'action'], rows: [[0, '[3, -1, -2, 5]', 3, 'keep'], [1, '[3, -1, -2, 5]', -1, 'remove'], [2, '[3, -2, 5]', 5, 'keep (the -2 was skipped)']] },
    },
    {
      kind: 'example',
      title: 'The bug and two fixes',
      body: 'Run it and compare the three results.',
      code: String.raw`import java.util.ArrayList;

public class Main {
    public static ArrayList<Integer> make() {
        ArrayList<Integer> list = new ArrayList<Integer>();
        list.add(3);
        list.add(-1);
        list.add(-2);
        list.add(5);
        return list;
    }

    public static void main(String[] args) {
        ArrayList<Integer> a = make();
        for (int i = 0; i < a.size(); i++) {
            if (a.get(i) < 0) {
                a.remove(i);
            }
        }
        System.out.println("buggy:     " + a);

        ArrayList<Integer> b = make();
        for (int i = b.size() - 1; i >= 0; i--) {
            if (b.get(i) < 0) {
                b.remove(i);
            }
        }
        System.out.println("backwards: " + b);

        ArrayList<Integer> c = make();
        int i = 0;
        while (i < c.size()) {
            if (c.get(i) < 0) {
                c.remove(i);
            } else {
                i++;
            }
        }
        System.out.println("careful:   " + c);
    }
}
`,
      output: 'buggy:     [3, -2, 5]\nbackwards: [3, 5]\ncareful:   [3, 5]\n',
    },
    {
      kind: 'explain',
      title: 'Never change the list inside enhanced for',
      body: `An enhanced for loop over an ArrayList must not \`add\` or \`remove\`. Java keeps track of changes while the loop runs, and on desktop Java the next pass throws a **ConcurrentModificationException**. Even where it does not crash, the loop cannot see the shifted elements correctly.

So the rule is simple:

- Only **reading** each element? Enhanced for is fine.
- **Changing the size** of the list? Use an indexed loop (backwards for removal).
- **Replacing** elements with \`set\`? Use an indexed loop, because you need the index.

Another clean approach is to **build a new list** with only the elements you want, and leave the original alone. This is often what a free-response question asks for: "returns a new ArrayList containing...".`,
    },
    {
      kind: 'predict',
      body: 'Removing the matches, forwards, with no fix. Type the output.',
      code: String.raw`import java.util.ArrayList;

public class Main {
    public static void main(String[] args) {
        ArrayList<String> words = new ArrayList<String>();
        words.add("ok");
        words.add("no");
        words.add("no");
        words.add("yes");
        words.add("no");
        for (int i = 0; i < words.size(); i++) {
            if (words.get(i).equals("no")) {
                words.remove(i);
            }
        }
        System.out.println(words);
    }
}
`,
      output: '[ok, no, yes]\n',
      choices: ['[ok, no, yes]\n', '[ok, yes]\n', '[ok, no, yes, no]\n', '[ok, yes, no]\n'],
      explain: `At i = 1 the first "no" is removed and the second "no" slides into index 1, but i moves on to 2 and skips it. At i = 2 the element is "yes". At i = 3 the last "no" is removed. One "no" survives because it was skipped.`,
    },
    {
      kind: 'check',
      title: 'Fix the removal',
      prompt: 'Which code segment correctly removes every String of length 0 from `ArrayList<String> list`?',
      options: [
        { text: '```java\nfor (int i = list.size() - 1; i >= 0; i--) {\n    if (list.get(i).length() == 0) {\n        list.remove(i);\n    }\n}\n```', correct: true, why: 'Going backwards, a removal only shifts elements that were already checked, so nothing is skipped.' },
        { text: '```java\nfor (int i = 0; i < list.size(); i++) {\n    if (list.get(i).length() == 0) {\n        list.remove(i);\n    }\n}\n```', why: 'Two empty strings in a row: the second slides into the removed spot and is skipped.' },
        { text: '```java\nfor (String s : list) {\n    if (s.length() == 0) {\n        list.remove(s);\n    }\n}\n```', why: 'Changing a list inside an enhanced for loop throws a ConcurrentModificationException.' },
        { text: '```java\nfor (int i = list.size(); i >= 0; i--) {\n    if (list.get(i).length() == 0) {\n        list.remove(i);\n    }\n}\n```', why: 'The first pass calls `get(list.size())`, which is past the end and throws an exception.' },
      ],
    },
    {
      kind: 'check',
      title: 'Building a new list',
      prompt: 'A method should return a new list of the scores in `scores` that are at least 90, without changing `scores`. What should replace `/* missing */`?\n\n```java\npublic static ArrayList<Integer> honors(ArrayList<Integer> scores) {\n    ArrayList<Integer> result = new ArrayList<Integer>();\n    for (int s : scores) {\n        /* missing */\n    }\n    return result;\n}\n```',
      options: [
        { text: '`if (s >= 90) { result.add(s); }`', correct: true, why: 'It reads from `scores` and adds matches to the new list. Adding to a different list inside the enhanced for is fine.' },
        { text: '`if (s >= 90) { scores.add(s); }`', why: 'This changes the list being looped over, which throws an exception and also breaks the "do not change scores" rule.' },
        { text: '`if (s < 90) { scores.remove(s); }`', why: 'Removing from `scores` inside its own enhanced for loop throws an exception, and the task says not to change it.' },
        { text: '`if (s >= 90) { return result.add(s); }`', why: 'That returns a boolean after the first match. The method must return the list, after the loop.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Clean the sensor readings',
      body: `A sensor sends temperature readings, but a broken reading is reported as \`-999\`. Write \`clean(ArrayList<Integer> readings)\`, which **removes every -999 from the list** (changing it in place) and **returns the average** of the readings that remain as a double. If nothing remains, return \`0.0\`.

For \`[70, -999, -999, 74]\`, the list becomes \`[70, 74]\` and the method returns \`72.0\`.`,
      starter: String.raw`import java.util.ArrayList;

public class Main {
    public static double clean(ArrayList<Integer> readings) {
        return 0.0;
    }
}
`,
      solution: String.raw`import java.util.ArrayList;

public class Main {
    public static double clean(ArrayList<Integer> readings) {
        for (int i = readings.size() - 1; i >= 0; i--) {
            if (readings.get(i) == -999) {
                readings.remove(i);
            }
        }
        if (readings.size() == 0) {
            return 0.0;
        }
        int sum = 0;
        for (int r : readings) {
            sum += r;
        }
        return (double) sum / readings.size();
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        java.util.ArrayList<Integer> list = new java.util.ArrayList<Integer>();
        while (in.hasNextInt()) {
            list.add(in.nextInt());
        }
        double avg = Main.clean(list);
        System.out.println(list + " " + avg);
    }
}
`,
      tests: [
        { name: 'Two bad readings in a row', stdin: '70 -999 -999 74\n', stdout: '[70, 74] 72.0\n' },
        { name: 'Bad readings at both ends', stdin: '-999 60 61 -999\n', stdout: '[60, 61] 60.5\n' },
        { name: 'Nothing to clean', stdin: '50 51 52\n', stdout: '[50, 51, 52] 51.0\n' },
        { name: 'All broken', stdin: '-999 -999\n', stdout: '[] 0.0\n' },
      ],
      hints: [
        'Remove with an indexed loop that goes backwards, from `readings.size() - 1` down to 0, so two -999s in a row are both removed.',
        'Compare with `readings.get(i) == -999`. Comparing an Integer with an int literal unboxes it, so `==` is safe here.',
        'Check for an empty list before dividing, then average with `(double) sum / readings.size()`.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Use `size()`, `get(i)` and `set(i, x)` where arrays use `length`, `[i]` and assignment.',
        'Removing while looping forwards skips the next element. Loop backwards, or only `i++` when you keep an element.',
        'Never add to or remove from a list inside an enhanced for loop over that same list.',
        'Building and returning a new list leaves the original untouched.',
      ],
      mistakes: [
        'Forward removal loops that skip consecutive matches.',
        'Starting a backward loop at `list.size()` instead of `list.size() - 1`.',
        'Modifying a list in its own enhanced for loop.',
        'Returning from inside the loop instead of after it.',
      ],
    },
  ],
};
