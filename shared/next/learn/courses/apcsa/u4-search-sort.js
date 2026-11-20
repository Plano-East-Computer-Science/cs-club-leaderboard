export default {
  id: 'searching-sorting',
  title: 'Searching and sorting',
  minutes: 35,
  summary: 'Find a value with linear and binary search, and put data in order with selection sort and insertion sort.',
  topics: ['4.14', '4.15'],
  steps: [
    {
      kind: 'explain',
      title: 'Finding a name in a phone book',
      body: `There are two ways to find a name in a list.

**Linear search** checks every element from the start until it finds a match, like scanning a messy pile of papers. It works on **any** list, sorted or not. In the worst case it looks at all n elements.

\`\`\`java
for (int i = 0; i < arr.length; i++) {
    if (arr[i] == target) {
        return i;
    }
}
return -1;   // not found, only after checking everything
\`\`\`

**Binary search** works like opening a phone book in the middle: if the name you want comes later, ignore the whole first half. Each check **halves** what is left. It only works on **sorted** data, but it is fast: a sorted list of a million names needs about 20 checks instead of up to a million.`,
    },
    {
      kind: 'explain',
      title: 'Binary search step by step',
      body: `Keep two indexes, \`low\` and \`high\`, marking the part of the array where the target could still be:

\`\`\`java
int low = 0;
int high = arr.length - 1;
while (low <= high) {
    int mid = (low + high) / 2;
    if (arr[mid] == target) {
        return mid;
    } else if (arr[mid] < target) {
        low = mid + 1;      // target is in the right half
    } else {
        high = mid - 1;     // target is in the left half
    }
}
return -1;
\`\`\`

When \`low\` passes \`high\`, the range is empty and the target is not there. The trace below finds 23 in a 9-element array in three checks.`,
      diagram: { type: 'trace', columns: ['low', 'high', 'mid', 'arr[mid]', 'next'], rows: [[0, 8, 4, 16, '16 < 23, so low = 5'], [5, 8, 6, 30, '30 > 23, so high = 5'], [5, 5, 5, 23, 'found at index 5']], caption: 'arr = {2, 5, 8, 12, 16, 23, 30, 38, 56}, target 23.' },
    },
    {
      kind: 'example',
      title: 'Count the checks',
      body: 'Both searches report how many elements they looked at. Change the target to 2, then to 56, then to 7 (not present).',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int[] arr = {2, 5, 8, 12, 16, 23, 30, 38, 56};
        int target = 38;

        int checks = 0;
        int foundAt = -1;
        for (int i = 0; i < arr.length && foundAt == -1; i++) {
            checks++;
            if (arr[i] == target) {
                foundAt = i;
            }
        }
        System.out.println("Linear: index " + foundAt + " after " + checks + " checks");

        int low = 0;
        int high = arr.length - 1;
        checks = 0;
        foundAt = -1;
        while (low <= high && foundAt == -1) {
            int mid = (low + high) / 2;
            checks++;
            if (arr[mid] == target) {
                foundAt = mid;
            } else if (arr[mid] < target) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        System.out.println("Binary: index " + foundAt + " after " + checks + " checks");
    }
}
`,
      output: 'Linear: index 7 after 8 checks\nBinary: index 7 after 3 checks\n',
    },
    {
      kind: 'check',
      title: 'When does binary search work?',
      prompt: 'Binary search on `{9, 3, 7, 1, 5}` for the value 1 returns -1, even though 1 is in the array. Why?',
      options: [
        { text: 'The array is not sorted, so discarding half of it can throw away the target', correct: true, why: 'Binary search assumes everything left of mid is smaller. Here mid is 7, which is larger than 1, so it searches the left half {9, 3} and never sees the 1.' },
        { text: 'Binary search cannot find the smallest value', why: 'On sorted data it finds any value, including the smallest.' },
        { text: 'The array has an odd number of elements', why: 'Binary search handles any length.' },
        { text: 'It should have used `low < high`', why: 'The loop condition is fine. The problem is that the data is not in order.' },
      ],
    },
    {
      kind: 'explain',
      title: 'Selection sort',
      body: `**Selection sort** builds the sorted array from the front. On pass \`i\`, it **selects** the smallest element in the unsorted part and **swaps** it into position \`i\`.

\`\`\`java
for (int i = 0; i < arr.length - 1; i++) {
    int minIndex = i;
    for (int j = i + 1; j < arr.length; j++) {
        if (arr[j] < arr[minIndex]) {
            minIndex = j;
        }
    }
    int temp = arr[i];
    arr[i] = arr[minIndex];
    arr[minIndex] = temp;
}
\`\`\`

After pass \`i\`, the first \`i + 1\` elements are the smallest, in order, and never move again. It is the "max/min index" pattern from earlier, run once per position.

For \`{5, 2, 8, 1}\`: pass 0 swaps 1 to the front, \`{1, 2, 8, 5}\`; pass 1 finds 2 already in place; pass 2 swaps 5 and 8, \`{1, 2, 5, 8}\`.`,
    },
    {
      kind: 'explain',
      title: 'Insertion sort',
      body: `**Insertion sort** is how most people sort a hand of cards: take the next card and slide it left into its place among the cards already sorted.

\`\`\`java
for (int i = 1; i < arr.length; i++) {
    int key = arr[i];
    int j = i - 1;
    while (j >= 0 && arr[j] > key) {
        arr[j + 1] = arr[j];     // shift the bigger element right
        j--;
    }
    arr[j + 1] = key;            // drop the card into the gap
}
\`\`\`

After pass \`i\`, the first \`i + 1\` elements are sorted **among themselves**, but a later element can still be inserted between them, unlike selection sort.

Both sorts take roughly n² steps on random data. Insertion sort is very fast on data that is already nearly sorted, because the inner while loop barely runs. AP questions often show an array after a few passes and ask which sort produced it.`,
    },
    {
      kind: 'predict',
      body: 'This is selection sort, stopped after two passes of the outer loop. Type the array it prints.',
      code: String.raw`import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] arr = {6, 3, 9, 1, 4};
        for (int i = 0; i < 2; i++) {
            int minIndex = i;
            for (int j = i + 1; j < arr.length; j++) {
                if (arr[j] < arr[minIndex]) {
                    minIndex = j;
                }
            }
            int temp = arr[i];
            arr[i] = arr[minIndex];
            arr[minIndex] = temp;
        }
        System.out.println(Arrays.toString(arr));
    }
}
`,
      output: '[1, 3, 9, 6, 4]\n',
      choices: ['[1, 3, 9, 6, 4]\n', '[1, 3, 4, 6, 9]\n', '[3, 6, 9, 1, 4]\n', '[1, 3, 6, 9, 4]\n'],
      explain: `Pass 0 finds the smallest value, 1 at index 3, and swaps it with the 6 at index 0: [1, 3, 9, 6, 4]. Pass 1 looks from index 1 on; the smallest is 3, already at index 1, so it swaps with itself. The rest is not sorted yet. Two passes of insertion sort would instead give [3, 6, 9, 1, 4]: it sorts the front part without looking ahead for the minimum.`,
    },
    {
      kind: 'check',
      title: 'Which sort was it?',
      prompt: 'An array starts as `{7, 2, 5, 1, 9}`. After one pass of the outer loop of a sort, it is `{2, 7, 5, 1, 9}`. Which sort is it?',
      options: [
        { text: 'Insertion sort', correct: true, why: 'Pass 1 of insertion sort takes 2 and slides it left past the 7. Selection sort would have moved the smallest value, 1, to the front.' },
        { text: 'Selection sort', why: 'Selection sort\'s first pass swaps the minimum (1) into index 0, giving {1, 2, 5, 7, 9}.' },
        { text: 'Binary search', why: 'Binary search finds values; it never rearranges an array.' },
        { text: 'Either one', why: 'They produce different arrays after the first pass. Only insertion sort gives this one.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Binary search with a count',
      body: `Write \`search(int[] sorted, int target)\` using **binary search**. It returns a String: \`"found at 5 in 3 checks"\` or \`"not found in 4 checks"\`, where a check is one comparison of \`sorted[mid]\` with the target (one pass of the loop).

Use \`mid = (low + high) / 2\`. The array is sorted in increasing order and may be empty.`,
      starter: String.raw`public class Main {
    public static String search(int[] sorted, int target) {
        int checks = 0;
        for (int i = 0; i < sorted.length; i++) {
            checks++;
            if (sorted[i] == target) {
                return "found at " + i + " in " + checks + " checks";
            }
        }
        return "not found in " + checks + " checks";
    }
}
`,
      solution: String.raw`public class Main {
    public static String search(int[] sorted, int target) {
        int low = 0;
        int high = sorted.length - 1;
        int checks = 0;
        while (low <= high) {
            int mid = (low + high) / 2;
            checks++;
            if (sorted[mid] == target) {
                return "found at " + mid + " in " + checks + " checks";
            } else if (sorted[mid] < target) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return "not found in " + checks + " checks";
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        int n = in.nextInt();
        int[] a = new int[n];
        for (int i = 0; i < n; i++) {
            a[i] = in.nextInt();
        }
        while (in.hasNextInt()) {
            System.out.println(Main.search(a, in.nextInt()));
        }
    }
}
`,
      tests: [
        { name: 'Found after three checks', stdin: '9  2 5 8 12 16 23 30 38 56\n23\n', stdout: 'found at 5 in 3 checks\n' },
        { name: 'Found in the middle at once', stdin: '9  2 5 8 12 16 23 30 38 56\n16\n', stdout: 'found at 4 in 1 checks\n' },
        { name: 'The last element', stdin: '9  2 5 8 12 16 23 30 38 56\n56\n', stdout: 'found at 8 in 4 checks\n' },
        { name: 'Missing value', stdin: '9  2 5 8 12 16 23 30 38 56\n7\n', stdout: 'not found in 3 checks\n' },
        { name: 'Empty array', stdin: '0\n4\n', stdout: 'not found in 0 checks\n' },
      ],
      hints: [
        'Start with `low = 0` and `high = sorted.length - 1`, and loop while `low <= high`.',
        'Each pass: compute `mid`, add 1 to `checks`, then compare `sorted[mid]` with the target.',
        'Move `low` to `mid + 1` or `high` to `mid - 1`, never to `mid` itself, or the loop can get stuck.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Linear search works on any data and checks up to n elements.',
        'Binary search needs sorted data and halves the range each check: about log2(n) checks.',
        'Selection sort swaps the minimum of the unsorted part into place each pass; placed elements never move again.',
        'Insertion sort slides each new element left into the sorted part; great on nearly sorted data.',
        'Both sorts take about n² steps in general.',
      ],
      mistakes: [
        'Running binary search on unsorted data.',
        'Setting `low = mid` or `high = mid`, which can loop forever.',
        'Returning -1 inside the loop of a linear search, after checking one element.',
        'Swapping without a temp variable in selection sort.',
      ],
    },
  ],
};
