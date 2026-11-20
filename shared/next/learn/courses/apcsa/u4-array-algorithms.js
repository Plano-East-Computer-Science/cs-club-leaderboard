export default {
  id: 'array-algorithms',
  title: 'Array algorithms',
  minutes: 35,
  summary: 'The standard array algorithms the exam expects: max with its index, all and any, duplicates, reversing, shifting and rotating.',
  topics: ['4.5'],
  steps: [
    {
      kind: 'explain',
      title: 'The same patterns, now with indexes',
      body: `The loop patterns from Unit 2 (sum, count, min and max, all and any) work on arrays exactly the same way. Arrays add a few new ones, because you can look at **any** position, not just the next value:

- find the **index** of the best value, not just the value
- compare **pairs**, adjacent or all pairs
- **move** elements around: swap, reverse, shift, rotate

Free-response questions are built from these. Learn each one well enough to write it without thinking, and the exam becomes a matter of recognizing which one is being asked for.`,
    },
    {
      kind: 'explain',
      title: 'Where is the maximum?',
      body: `To find the position of the largest value, keep the **index** of the best so far instead of the value. Start at index 0, the first real element, and compare from index 1:

\`\`\`java
int best = 0;
for (int i = 1; i < arr.length; i++) {
    if (arr[i] > arr[best]) {
        best = i;
    }
}
// arr[best] is the max, best is where it is
\`\`\`

Storing the index gives you both answers. Using \`>\` keeps the **first** position if the maximum appears twice; \`>=\` would keep the last.`,
      diagram: { type: 'trace', columns: ['i', 'arr[i]', 'arr[best] before', 'best after'], rows: [['-', '-', '-', 0], [1, 9, 4, 1], [2, 2, 9, 1], [3, 9, 9, 1], [4, 6, 9, 1]], caption: 'For {4, 9, 2, 9, 6} the answer is index 1, the first 9.' },
    },
    {
      kind: 'explain',
      title: 'Swap, reverse, shift',
      body: `**Swap** two elements with a temporary variable. Without \`temp\`, the first assignment overwrites a value you still need:

\`\`\`java
int temp = arr[i];
arr[i] = arr[j];
arr[j] = temp;
\`\`\`

**Reverse in place**: swap the first with the last, the second with the second-to-last, and stop at the middle. Going all the way would swap everything back.

\`\`\`java
for (int i = 0; i < arr.length / 2; i++) {
    int temp = arr[i];
    arr[i] = arr[arr.length - 1 - i];
    arr[arr.length - 1 - i] = temp;
}
\`\`\`

**Rotate left by one**: save the first element, slide every element one place left, then put the saved one at the end. The loop must go **front to back**, so each value is copied before it is overwritten.`,
    },
    {
      kind: 'example',
      title: 'Reverse and rotate',
      body: 'Run it. Then change the reverse loop bound to `arr.length` and see the array come back unchanged.',
      editable: true,
      code: String.raw`import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] arr = {1, 2, 3, 4, 5};

        for (int i = 0; i < arr.length / 2; i++) {
            int temp = arr[i];
            arr[i] = arr[arr.length - 1 - i];
            arr[arr.length - 1 - i] = temp;
        }
        System.out.println(Arrays.toString(arr));

        int first = arr[0];
        for (int i = 0; i < arr.length - 1; i++) {
            arr[i] = arr[i + 1];
        }
        arr[arr.length - 1] = first;
        System.out.println(Arrays.toString(arr));
    }
}
`,
      output: '[5, 4, 3, 2, 1]\n[4, 3, 2, 1, 5]\n',
    },
    {
      kind: 'predict',
      body: 'This "swap" forgot the temporary variable. Type the output.',
      code: String.raw`import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] a = {10, 20, 30};
        a[0] = a[2];
        a[2] = a[0];
        System.out.println(Arrays.toString(a));
    }
}
`,
      output: '[30, 20, 30]\n',
      choices: ['[30, 20, 30]\n', '[30, 20, 10]\n', '[10, 20, 10]\n', '[10, 20, 30]\n'],
      explain: `The first line overwrites \`a[0]\` with 30, and the 10 is gone for good. The second line copies that 30 back into \`a[2]\`. Both ends end up 30. A swap needs a temp variable to hold one value while the other moves.`,
    },
    {
      kind: 'explain',
      title: 'Checking pairs for duplicates',
      body: `To ask "does any value appear twice?", compare every element with every element **after** it, using the nested-loop pair pattern from Unit 2:

\`\`\`java
for (int i = 0; i < arr.length; i++) {
    for (int j = i + 1; j < arr.length; j++) {
        if (arr[i] == arr[j]) {
            return true;      // found a duplicate
        }
    }
}
return false;                 // only after checking every pair
\`\`\`

Starting \`j\` at \`i + 1\` avoids comparing an element with itself (which would always match) and avoids checking each pair twice.

Notice where \`return false\` goes: **after** both loops. Returning false inside the loop, in an else, would give up after the first pair that differs.`,
    },
    {
      kind: 'check',
      title: 'The early return bug',
      prompt: 'This method should return true if every element of `arr` is positive. For which array does it return the wrong answer?\n\n```java\npublic static boolean allPositive(int[] arr) {\n    for (int v : arr) {\n        if (v > 0) {\n            return true;\n        } else {\n            return false;\n        }\n    }\n    return true;\n}\n```',
      options: [
        { text: '`{3, -1, 4}`', correct: true, why: 'The first element is 3, so it returns true immediately without ever looking at the -1. The method only checks the first element.' },
        { text: '`{-2, 5, 6}`', why: 'The first element is negative, so it returns false, which is the right answer.' },
        { text: '`{1, 2, 3}`', why: 'It returns true after the first element, which happens to be right.' },
        { text: '`{-1, -2}`', why: 'It returns false on the first element, which is right.' },
      ],
    },
    {
      kind: 'check',
      title: 'Which shifts right?',
      prompt: 'Which code segment shifts every element of `arr` one place to the **right**, putting the old last element at index 0? (For `{1, 2, 3, 4}` the result should be `{4, 1, 2, 3}`.)',
      options: [
        { text: '```java\nint last = arr[arr.length - 1];\nfor (int i = arr.length - 1; i > 0; i--) {\n    arr[i] = arr[i - 1];\n}\narr[0] = last;\n```', correct: true, why: 'Moving right, you must copy from the back, so each value is moved before its spot is overwritten. Then the saved last value goes to the front.' },
        { text: '```java\nint last = arr[arr.length - 1];\nfor (int i = 1; i < arr.length; i++) {\n    arr[i] = arr[i - 1];\n}\narr[0] = last;\n```', why: 'Going front to back copies arr[0] into arr[1], then that same value into arr[2], and so on. You get {4, 1, 1, 1}.' },
        { text: '```java\nfor (int i = arr.length - 1; i > 0; i--) {\n    arr[i] = arr[i - 1];\n}\n```', why: 'The last element was never saved, so it is lost. The result is {1, 1, 2, 3}.' },
        { text: '```java\nint last = arr[arr.length - 1];\nfor (int i = arr.length; i > 0; i--) {\n    arr[i] = arr[i - 1];\n}\narr[0] = last;\n```', why: 'The first pass writes to arr[arr.length], which does not exist, and crashes.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Longest winning streak',
      body: `A team's season is stored as an array of game results: \`1\` for a win, \`0\` for a loss. Write \`longestStreak(int[] games)\`, which returns the length of the longest run of **consecutive wins**.

For \`{1, 1, 0, 1, 1, 1, 0}\` it returns \`3\`. An empty season or one with no wins returns \`0\`.

Keep two counters: the current streak and the best streak so far.`,
      starter: String.raw`public class Main {
    public static int longestStreak(int[] games) {
        int best = 0;
        return best;
    }
}
`,
      solution: String.raw`public class Main {
    public static int longestStreak(int[] games) {
        int best = 0;
        int current = 0;
        for (int g : games) {
            if (g == 1) {
                current++;
                if (current > best) {
                    best = current;
                }
            } else {
                current = 0;
            }
        }
        return best;
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        while (in.hasNextInt()) {
            int n = in.nextInt();
            int[] a = new int[n];
            for (int i = 0; i < n; i++) {
                a[i] = in.nextInt();
            }
            System.out.println(Main.longestStreak(a));
        }
    }
}
`,
      tests: [
        { name: 'Streak in the middle', stdin: '7  1 1 0 1 1 1 0\n', stdout: '3\n' },
        { name: 'Streak at the very end', stdin: '5  0 1 0 1 1\n', stdout: '2\n' },
        { name: 'Undefeated', stdin: '4  1 1 1 1\n', stdout: '4\n' },
        { name: 'No wins', stdin: '3  0 0 0\n', stdout: '0\n' },
        { name: 'Empty season', stdin: '0\n', stdout: '0\n' },
      ],
      hints: [
        'Walk through the games. A win adds 1 to `current`; a loss resets `current` to 0.',
        'After adding to `current`, compare it with `best` right away. If you only compare when a loss happens, a streak at the very end of the season is never counted.',
        'Start both counters at 0. An empty array then returns 0 without any special case.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Track the index of the best value (`best = i`) to know both where and what.',
        'Swap with a temp variable; reverse by swapping ends up to `arr.length / 2`.',
        'Shift left by copying front to back; shift right by copying back to front. Save the element that falls off.',
        'Check all pairs with `j = i + 1`; return "not found" only after the loops end.',
      ],
      mistakes: [
        'Swapping without a temp variable.',
        'Reversing over the whole array, which undoes itself.',
        'Returning false (or true) in an else inside the loop, after checking just one element.',
        'Copying in the wrong direction when shifting, smearing one value across the array.',
      ],
    },
  ],
};
