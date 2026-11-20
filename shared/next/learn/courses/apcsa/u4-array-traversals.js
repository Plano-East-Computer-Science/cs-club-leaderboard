export default {
  id: 'array-traversals',
  title: 'Walking through an array',
  minutes: 25,
  summary: 'Visit every element with an indexed for loop or an enhanced for loop, and know which one a task needs.',
  topics: ['4.4'],
  steps: [
    {
      kind: 'explain',
      title: 'Checking every locker',
      body: `A **traversal** visits the elements of an array one at a time, like a custodian walking down the hall and opening every locker in order. The standard way is a for loop whose variable is the index:

\`\`\`java
for (int i = 0; i < arr.length; i++) {
    System.out.println(arr[i]);
}
\`\`\`

The header has the same shape as the string loop from Unit 2, with \`arr.length\` (no parentheses) as the bound. The first pass looks at index 0 and the last at \`arr.length - 1\`. Writing \`i <= arr.length\` makes the last pass reach one locker past the end, and the program crashes with an ArrayIndexOutOfBoundsException.`,
      diagram: { type: 'array', name: 'int[] arr = {7, 3, 9, 4};', values: [7, 3, 9, 4], highlight: [0, 1, 2, 3], caption: 'i takes the values 0, 1, 2, 3. arr.length is 4, and i < 4 stops at the last real index.' },
    },
    {
      kind: 'example',
      title: 'Forwards, backwards and changing values',
      body: 'Run it. Then change the third loop to triple every element instead of doubling it.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int[] arr = {7, 3, 9, 4};

        for (int i = 0; i < arr.length; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();

        for (int i = arr.length - 1; i >= 0; i--) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();

        for (int i = 0; i < arr.length; i++) {
            arr[i] = arr[i] * 2;
        }
        System.out.println(java.util.Arrays.toString(arr));
    }
}
`,
      output: '7 3 9 4 \n4 9 3 7 \n[14, 6, 18, 8]\n',
    },
    {
      kind: 'explain',
      title: 'The enhanced for loop',
      body: `When you just need to **look at** each value, Java has a shorter loop, the **enhanced for** (or for-each):

\`\`\`java
for (int value : arr) {
    sum += value;
}
\`\`\`

Read it as "for each \`value\` in \`arr\`". On each pass, \`value\` holds a **copy** of the next element. There is no index.

That copy is the catch:

- Assigning to the loop variable (\`value = 0;\`) changes only the copy, **not the array**.
- You cannot tell where you are, so you cannot compare neighbors or report "found at index 3".
- It always goes front to back, every element.

Use enhanced for to read every element. Use an indexed loop when you need the index, need to change elements, or need a different order or part of the array.`,
    },
    {
      kind: 'predict',
      body: 'Two loops try to reset the array. Type the output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int[] nums = {5, 8, 2};
        for (int n : nums) {
            n = 0;
        }
        System.out.println(nums[0] + nums[1] + nums[2]);
        for (int i = 0; i < nums.length; i++) {
            nums[i] = 0;
        }
        System.out.println(nums[0] + nums[1] + nums[2]);
    }
}
`,
      output: '15\n0\n',
      explain: `In the enhanced for loop, \`n\` is a copy of each element. Setting the copy to 0 leaves the array as 5, 8, 2, which sum to 15. The indexed loop assigns to \`nums[i]\`, the actual elements, so afterwards they sum to 0.`,
    },
    {
      kind: 'check',
      title: 'Which loop fits?',
      prompt: 'Which task **cannot** be done with an enhanced for loop alone?',
      options: [
        { text: 'Print the index of the first negative value', correct: true, why: 'An enhanced for loop never tells you the index. You would need a separate counter, or an indexed loop.' },
        { text: 'Add up all the values', why: 'Summing only reads each value, which is exactly what enhanced for does well.' },
        { text: 'Count how many values are even', why: 'Counting only reads each value.' },
        { text: 'Find the largest value', why: 'Tracking a maximum only reads each value, so enhanced for works.' },
      ],
    },
    {
      kind: 'explain',
      title: 'Partial traversals',
      body: `Not every traversal covers the whole array. Change the start, the bound or the step:

\`\`\`java
for (int i = 1; i < arr.length; i++)        // skip the first element
for (int i = 0; i < arr.length; i += 2)     // every other element: indexes 0, 2, 4...
for (int i = 0; i < arr.length / 2; i++)    // the first half
\`\`\`

A frequent need is comparing each element with the next one: \`arr[i]\` and \`arr[i + 1]\`. Then the last valid \`i\` is \`arr.length - 2\`, so the header is \`i < arr.length - 1\`. Going all the way to \`arr.length - 1\` would ask for \`arr[arr.length]\` and crash.

Arrays of objects traverse the same way. With \`String[] names\`, \`names[i].length()\` calls a method on each element.`,
    },
    {
      kind: 'check',
      title: 'Fill in the bound',
      prompt: 'This code should count how many times an element is larger than the one before it. Which replacement for `/* bound */` works without crashing and checks every pair?\n\n```java\nint rises = 0;\nfor (int i = 1; /* bound */; i++) {\n    if (arr[i] > arr[i - 1]) {\n        rises++;\n    }\n}\n```',
      options: [
        { text: '`i < arr.length`', correct: true, why: 'i starts at 1 and compares with i - 1, so the last pass uses i = length - 1 and i - 1 = length - 2. Every pair, no index past the end.' },
        { text: '`i <= arr.length`', why: 'The last pass would read `arr[arr.length]`, which does not exist, and crash.' },
        { text: '`i < arr.length - 1`', why: 'This stops one pass early and never compares the last two elements.' },
        { text: '`i < arr.length + 1`', why: 'Same as `<=`: it reads past the end.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Above average',
      body: `Write \`countAbove(int[] scores)\`, which returns how many scores are **strictly greater** than the average of all the scores. You may assume the array has at least one element.

For \`{70, 80, 90, 100}\` the average is 85, and two scores are above it, so return \`2\`.

The method will need two traversals: one to find the average, one to count.`,
      starter: String.raw`public class Main {
    public static int countAbove(int[] scores) {
        return 0;
    }
}
`,
      solution: String.raw`public class Main {
    public static int countAbove(int[] scores) {
        int sum = 0;
        for (int s : scores) {
            sum += s;
        }
        double avg = (double) sum / scores.length;
        int count = 0;
        for (int s : scores) {
            if (s > avg) {
                count++;
            }
        }
        return count;
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
            System.out.println(Main.countAbove(a));
        }
    }
}
`,
      tests: [
        { name: 'Four scores', stdin: '4  70 80 90 100\n', stdout: '2\n' },
        { name: 'The average is not a whole number', stdin: '3  1 2 2\n', stdout: '2\n' },
        { name: 'All the same', stdin: '3  5 5 5\n', stdout: '0\n' },
        { name: 'One score', stdin: '1  42\n', stdout: '0\n' },
        { name: 'One big outlier', stdin: '5  1 1 1 1 100\n', stdout: '1\n' },
      ],
      hints: [
        'First traversal: add every score into `sum`. Then compute the average as a double: `(double) sum / scores.length`.',
        'Second traversal: count the scores with `s > avg`. Strictly greater, so a score equal to the average does not count.',
        'Integer division would make the average of 1, 2, 2 equal 1 instead of 1.67, and you would count wrong.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Indexed traversal: `for (int i = 0; i < arr.length; i++)`, with `arr[i]` for each element.',
        'Enhanced for, `for (int v : arr)`, reads each value but gives no index and cannot change the array.',
        'Change elements, compare neighbors or go backwards with an indexed loop.',
        'When you use `arr[i + 1]`, stop at `i < arr.length - 1`.',
      ],
      mistakes: [
        '`i <= arr.length`, which reads past the end.',
        'Assigning to an enhanced for variable and expecting the array to change.',
        '`arr.length()` with parentheses. For arrays it is `arr.length`.',
        'Integer division when computing an average.',
      ],
    },
  ],
};
