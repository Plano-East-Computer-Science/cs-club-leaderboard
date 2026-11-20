export default {
  id: 'recursion',
  title: 'Recursion',
  minutes: 35,
  summary: 'Solve a problem by having a method call itself on a smaller version, trace the calls, and see recursive binary search and merge sort.',
  topics: ['4.16', '4.17'],
  steps: [
    {
      kind: 'explain',
      title: 'Russian dolls',
      body: `Open a Russian nesting doll and there is a smaller doll inside, and inside that a smaller one, until you reach a tiny solid doll that does not open. That is **recursion**: a problem that contains a smaller copy of itself, down to a case simple enough to answer directly.

A **recursive method** calls itself. Every correct one has two parts:

1. A **base case**: an input small enough to answer without recursion. The solid doll.
2. A **recursive call** on a **smaller** input that moves toward the base case.

\`\`\`java
public static int factorial(int n) {
    if (n <= 1) {
        return 1;                    // base case
    }
    return n * factorial(n - 1);     // smaller problem
}
\`\`\`

\`factorial(4)\` is \`4 * factorial(3)\`, which is \`4 * 3 * factorial(2)\`, down to \`factorial(1)\`, which is just 1.`,
    },
    {
      kind: 'explain',
      title: 'How the calls stack up',
      body: `Each call waits for the call it made to finish. Java keeps the waiting calls in a **call stack**, like a stack of plates. The calls go down until the base case returns, and then the answers come back up, each one finishing its multiplication.

If there is no base case, or the input never gets smaller, the calls never stop. The stack runs out of space and the program crashes with a **StackOverflowError**.

On the exam, trace recursion by writing each call on its own line, indented, and filling in return values on the way back up.`,
      diagram: { type: 'trace', columns: ['call', 'waits for', 'returns'], rows: [['factorial(4)', '4 * factorial(3)', 24], ['factorial(3)', '3 * factorial(2)', 6], ['factorial(2)', '2 * factorial(1)', 2], ['factorial(1)', 'base case', 1]], caption: 'Read down for the calls, then up for the answers.' },
    },
    {
      kind: 'example',
      title: 'Three recursive methods',
      body: 'Run it. Then change `sumDigits` so the base case is missing and see what happens.',
      editable: true,
      code: String.raw`public class Main {
    public static int factorial(int n) {
        if (n <= 1) {
            return 1;
        }
        return n * factorial(n - 1);
    }

    public static int sumDigits(int n) {
        if (n < 10) {
            return n;
        }
        return n % 10 + sumDigits(n / 10);
    }

    public static String reverse(String s) {
        if (s.length() <= 1) {
            return s;
        }
        return reverse(s.substring(1)) + s.substring(0, 1);
    }

    public static void main(String[] args) {
        System.out.println(factorial(5));
        System.out.println(sumDigits(4096));
        System.out.println(reverse("panther"));
    }
}
`,
      output: '120\n19\nrehtnap\n',
    },
    {
      kind: 'predict',
      body: 'The print happens after the recursive call. Type the output.',
      code: String.raw`public class Main {
    public static void countdown(int n) {
        if (n == 0) {
            return;
        }
        countdown(n - 1);
        System.out.print(n + " ");
    }

    public static void main(String[] args) {
        countdown(3);
        System.out.println();
    }
}
`,
      output: '1 2 3 \n',
      choices: ['1 2 3 \n', '3 2 1 \n', '0 1 2 3 \n', '3 2 1 0 \n'],
      explain: `\`countdown(3)\` first calls \`countdown(2)\`, which first calls \`countdown(1)\`, which calls \`countdown(0)\`, which just returns. Only then does \`countdown(1)\` print 1, then \`countdown(2)\` prints 2, then 3. Code after the recursive call runs on the way back up, in reverse order of the calls.`,
    },
    {
      kind: 'check',
      title: 'Will it stop?',
      prompt: 'Which call causes infinite recursion (a StackOverflowError)?\n\n```java\npublic static int mystery(int n) {\n    if (n == 0) {\n        return 0;\n    }\n    return 1 + mystery(n - 2);\n}\n```',
      options: [
        { text: '`mystery(5)`', correct: true, why: 'n goes 5, 3, 1, -1, -3... It skips over 0, so the base case is never reached.' },
        { text: '`mystery(4)`', why: '4, 2, 0: it reaches the base case and returns 2.' },
        { text: '`mystery(0)`', why: 'That is the base case itself; it returns 0 immediately.' },
        { text: '`mystery(10)`', why: 'Even numbers count down by 2 and land exactly on 0.' },
      ],
    },
    {
      kind: 'explain',
      title: 'Recursive binary search and merge sort',
      body: `Binary search is naturally recursive: search the middle; if not found, **search half the array** with the same method.

\`\`\`java
public static int find(int[] arr, int target, int low, int high) {
    if (low > high) {
        return -1;                                   // base case: empty range
    }
    int mid = (low + high) / 2;
    if (arr[mid] == target) return mid;
    if (arr[mid] < target) return find(arr, target, mid + 1, high);
    return find(arr, target, low, mid - 1);
}
\`\`\`

**Merge sort** is the recursive sort on the exam. To sort an array: split it in half, **sort each half recursively**, then **merge** the two sorted halves by repeatedly taking the smaller front element. The base case is a piece of length 1, which is already sorted. Merge sort takes about n log n steps, much faster than selection or insertion sort on large data. You are expected to understand and trace it, not to write it from memory.`,
    },
    {
      kind: 'check',
      title: 'Tracing a return value',
      prompt: 'What does `f(3)` return?\n\n```java\npublic static int f(int n) {\n    if (n <= 0) {\n        return 1;\n    }\n    return f(n - 1) + f(n - 2);\n}\n```',
      options: [
        { text: '5', correct: true, why: 'f(0) and f(-1) are 1. f(1) = f(0) + f(-1) = 2. f(2) = f(1) + f(0) = 3. f(3) = f(2) + f(1) = 5.' },
        { text: '3', why: 'That is f(2). f(3) adds f(2) and f(1): 3 + 2.' },
        { text: '4', why: 'Remember f(-1) is also a base case returning 1, so f(1) is 2, not 1.' },
        { text: 'It never returns', why: 'Every call reduces n, and anything at or below 0 hits the base case.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Count a letter, recursively',
      body: `Write \`count(String s, String letter)\` **recursively** (no loops). It returns how many times the one-character string \`letter\` appears in \`s\`.

Think of it this way: the count in \`s\` is (1 if the first character matches, otherwise 0) plus the count in the rest of the string, \`s.substring(1)\`. What is the count in an empty string?`,
      starter: String.raw`public class Main {
    public static int count(String s, String letter) {
        return 0;
    }
}
`,
      solution: String.raw`public class Main {
    public static int count(String s, String letter) {
        if (s.length() == 0) {
            return 0;
        }
        int first = 0;
        if (s.substring(0, 1).equals(letter)) {
            first = 1;
        }
        return first + count(s.substring(1), letter);
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        while (in.hasNext()) {
            String letter = in.next();
            String s = in.hasNextLine() ? in.nextLine().trim() : "";
            System.out.println(Main.count(s, letter));
        }
    }
}
`,
      tests: [
        { name: 'Several matches', stdin: 's mississippi\n', stdout: '4\n' },
        { name: 'Match at both ends', stdin: 'a banana bread a\n', stdout: '5\n' },
        { name: 'No matches', stdin: 'z java\n', stdout: '0\n' },
        { name: 'Empty string', stdin: 'q\n', stdout: '0\n' },
      ],
      hints: [
        'Base case: an empty string has no letters, so `if (s.length() == 0) return 0;`.',
        'Look at only the first character, `s.substring(0, 1)`, and compare it with `letter` using `equals`.',
        'Recursive case: store 1 or 0 in a variable depending on the match, then `return first + count(s.substring(1), letter);`. Each call is one character shorter, so it reaches the base case.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'A recursive method calls itself on a smaller input and has a base case that stops it.',
        'Calls wait on a stack; answers come back up in reverse order.',
        'Code after the recursive call runs on the way back up.',
        'Binary search recurses on half the range; merge sort splits, sorts each half recursively, and merges.',
      ],
      mistakes: [
        'No base case, or a recursive call that skips past it.',
        'A recursive call on an input that is not smaller.',
        'Forgetting to return the result of the recursive call.',
        'Tracing only the way down and forgetting the work done on the way back up.',
      ],
    },
  ],
};
