export default {
  id: 'arrays',
  title: 'Arrays: many values, one name',
  minutes: 30,
  summary: 'Store a whole data set under one name, read and change it by index, and see why two array variables can share the same array.',
  topics: ['4.1', '4.2', '4.3'],
  steps: [
    {
      kind: 'explain',
      title: 'A row of lockers',
      body: `Your phone's step counter records one number every day. After a month it has 30 numbers. That collection is a **data set**: many related values of the same kind, kept together so you can ask questions about them. What was my best day? How many days did I reach 8000 steps?

With what you know so far, you would need 30 variables: \`day1\`, \`day2\`, all the way to \`day30\`. That is painful to type, and worse, a loop cannot walk through \`day1\` to \`day30\`, because the number is part of the variable's *name*, not a value Java can count with.

An **array** fixes this. Picture a row of lockers in a hallway. The whole row has one name, every locker holds one value of the same type, and each locker has a number painted on it. That number is the **index**, and the value inside is an **element**. Because the index is just an \`int\`, a loop can count through it.`,
    },
    {
      kind: 'explain',
      title: 'Data about people is a responsibility',
      body: `Many real data sets describe people: grades, locations, health readings, what you click on. Collecting that data has consequences, and the AP exam expects you to think about them.

- **Privacy.** Data collected for one purpose can be shared, sold, leaked or combined with other data to reveal things nobody agreed to share. A step counter's data also shows when you are home and when you are not. Collect only what you need, and protect it.
- **Bias.** A data set is only a sample of the world. If a face-recognition program is trained mostly on photos of one group of people, it works worse on everyone else. The code can be perfectly correct and the results still unfair, because the data was skewed.

So before you write the loop, ask two questions: who is in this data, and who is missing? And would the people in it be comfortable with how it is used?`,
    },
    {
      kind: 'explain',
      title: 'Making an array',
      body: `There are two ways to create an array.

**With \`new\` and a size**, when you know how many values you need but not what they are yet:

\`\`\`java
int[] steps = new int[5];
\`\`\`

Read it as: \`steps\` is an \`int[]\` (an "int array"), and it refers to a brand new array with room for 5 ints. Java fills every element with a **default value**:

- \`0\` for \`int\`, \`0.0\` for \`double\`
- \`false\` for \`boolean\`
- \`null\` for any object type, such as \`String\` (no object yet)

**With an initializer list**, when you already know the values:

\`\`\`java
int[] steps = {4200, 8100, 7600, 10050, 3900};
\`\`\`

Java counts the values and makes the array exactly that size. Either way, **an array's size is fixed once it is created**. You can change what is in the lockers, but you cannot add more lockers.`,
      diagram: { type: 'array', name: 'steps (made with new int[5])', values: [0, 0, 0, 0, 0], caption: 'Every element starts at the default value for int, which is 0.' },
    },
    {
      kind: 'predict',
      body: 'None of these arrays was given values, except one element. Type exactly what you think prints.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int[] counts = new int[4];
        double[] prices = new double[2];
        boolean[] seen = new boolean[3];
        String[] names = new String[2];
        counts[2] = 7;
        System.out.println(counts[2] + counts[3]);
        System.out.println(prices[1]);
        System.out.println(seen[0]);
        System.out.println(names[1]);
    }
}
`,
      output: '7\n0.0\nfalse\nnull\n',
      explain: `\`counts[2]\` was set to 7 and \`counts[3]\` still holds the default \`0\`, so the sum is \`7\`. A \`double\` array starts full of \`0.0\` (always printed with the decimal point), a \`boolean\` array starts full of \`false\`, and a \`String\` array starts full of \`null\`, because no \`String\` objects have been made yet. Printing \`null\` is fine; calling a method on it, like \`names[1].length()\`, would crash with a \`NullPointerException\`.`,
    },
    {
      kind: 'explain',
      title: 'Indexes start at 0',
      body: `You reach one element with square brackets: \`steps[2]\` means "the element at index 2". You can read it or assign to it, just like a variable:

\`\`\`java
int third = steps[2];   // read
steps[0] = 5000;        // write
\`\`\`

The first index is **0**, not 1. So in an array of 5 elements the indexes are 0, 1, 2, 3 and 4. The last index is always one less than the size.

Every array knows its size: \`steps.length\`. Notice there are **no parentheses**. \`length\` is a value stored in the array, not a method. That is the opposite of \`String\`, where \`name.length()\` is a method call with parentheses. Mixing them up is a compile error, and the exam checks it.

Put those together and you get the one expression you will write constantly: the last element is \`steps[steps.length - 1]\`.`,
      diagram: { type: 'array', name: 'steps', values: [4200, 8100, 7600, 10050, 3900], highlight: [4], caption: 'steps.length is 5, so the highlighted last element is steps[4], which is steps[steps.length - 1].' },
    },
    {
      kind: 'example',
      title: 'Read and change elements',
      body: 'Run it. Then change one value in the initializer list, or add a sixth day to the list, and watch how `length` and the last element follow along.',
      editable: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int[] steps = {4200, 8100, 7600, 10050, 3900};
        System.out.println("Days recorded: " + steps.length);
        System.out.println("First day: " + steps[0]);
        System.out.println("Last day: " + steps[steps.length - 1]);

        steps[1] = steps[1] + 500;   // a late sync added 500 steps to day 2
        System.out.println("Day 2 is now: " + steps[1]);
    }
}
`,
      output: 'Days recorded: 5\nFirst day: 4200\nLast day: 3900\nDay 2 is now: 8600\n',
    },
    {
      kind: 'check',
      title: 'The last element',
      prompt: 'Assume `int[] arr` has been created and has at least one element. Which of the following prints the last element of `arr`?',
      options: [
        { text: '`System.out.println(arr[arr.length - 1]);`', correct: true, why: 'The indexes run from 0 to `arr.length - 1`, so this is the last one, whatever the size.' },
        { text: '`System.out.println(arr[arr.length]);`', why: 'Off by one. `arr.length` is one past the last index, so this compiles but crashes with an `ArrayIndexOutOfBoundsException`.' },
        { text: '`System.out.println(arr[arr.length() - 1]);`', why: 'For an array, `length` has no parentheses. `length()` is the `String` method, so this does not compile.' },
        { text: '`System.out.println(arr.length - 1);`', why: 'This prints a number computed from the size (the last *index*), not the element stored there.' },
      ],
    },
    {
      kind: 'explain',
      title: 'Stepping outside the array',
      body: `What happens if you ask for a locker that does not exist? Java checks every index while the program runs. Any index below 0, or at \`length\` or above, throws an **\`ArrayIndexOutOfBoundsException\`** and the program stops.

Two things make this error sneaky:

- It is a **run-time error**, not a compile error. \`steps[5]\` is perfectly good grammar, so the compiler accepts it. The crash only happens when that line runs.
- The usual cause is an off-by-one mistake: using \`arr[arr.length]\` for the last element, or counting from 1 instead of 0.

When you see this exception, look at the line it names and ask: what was the index, and what was the array's length at that moment?`,
    },
    {
      kind: 'example',
      title: 'Watch it crash',
      body: 'The first two lines print. The third asks for index 3 in an array whose indexes are 0, 1 and 2.',
      crashes: true,
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int[] temps = {72, 75, 68};
        System.out.println("First: " + temps[0]);
        System.out.println("Last: " + temps[temps.length - 1]);
        System.out.println("Past the end: " + temps[temps.length]);
    }
}
`,
      output: 'First: 72\nLast: 68\n',
    },
    {
      kind: 'explain',
      title: 'An array variable holds a reference',
      body: `Arrays are **objects**, just like the objects you made in Unit 3. So an array variable does not hold the elements. It holds a **reference**: an arrow pointing at the array somewhere in memory.

That matters the moment you copy the variable:

\`\`\`java
int[] a = {5, 10, 15};
int[] b = a;      // copies the arrow, not the array
b[0] = 99;
System.out.println(a[0]);   // 99
\`\`\`

\`b = a\` does not make a second array. Now \`a\` and \`b\` are two names for the **same** array, which is called **aliasing**. A change made through either name is visible through the other.

To get a separate array you must create one with \`new\` (or an initializer list) and copy the values in. The same rule explains a powerful trick you will use soon: when you pass an array to a method, the method gets a copy of the arrow, so it can change the caller's elements.`,
      diagram: {
        type: 'refs',
        vars: [
          { name: 'a', type: 'int[]', to: 'arr' },
          { name: 'b', type: 'int[]', to: 'arr' },
        ],
        objects: [{ id: 'arr', type: 'int[]', fields: [{ name: '[0]', value: 99 }, { name: '[1]', value: 10 }, { name: '[2]', value: 15 }] }],
        caption: 'One array, two arrows. b[0] = 99 changed the only array there is.',
      },
    },
    {
      kind: 'predict',
      body: 'Three variables, but how many arrays? Pick the output.',
      code: String.raw`public class Main {
    public static void main(String[] args) {
        int[] a = {5, 10, 15};
        int[] b = a;
        int[] c = {5, 10, 15};
        b[1] = 0;
        c[2] = 1;
        System.out.println(a[1] + " " + a[2]);
    }
}
`,
      output: '0 15\n',
      choices: ['0 15\n', '10 15\n', '0 1\n', '10 1\n'],
      explain: `There are two arrays here. \`b = a\` copies the reference, so \`a\` and \`b\` share the first array, and \`b[1] = 0\` changes \`a[1]\` too. \`c\` was built from its own initializer list, so it is a separate array that happens to hold the same numbers. Changing \`c[2]\` leaves \`a[2]\` at \`15\`. Same values does not mean same array.`,
    },
    {
      kind: 'check',
      title: 'Fill in the missing code',
      prompt: 'Which code segment can replace `/* missing code */` so that the program prints `70`?',
      code: String.raw`int[] scores = {88, 92, 75, 64};
/* missing code */
System.out.println(scores[3]);`,
      options: [
        { text: '`scores[3] = 70;`', correct: true, why: 'Index 3 is the fourth element (the `64`), which is the one being printed. Assigning to it replaces `64` with `70`.' },
        { text: '`scores[4] = 70;`', why: 'This counts from 1. The array has indexes 0 to 3, so index 4 crashes with an `ArrayIndexOutOfBoundsException`.' },
        { text: '`scores.length = 70;`', why: 'An array\'s `length` cannot be changed; an array\'s size is fixed when it is created. This does not compile.' },
        { text: '`scores = 70;`', why: '`scores` holds a reference to an `int[]`, so you cannot store a plain `int` in it. You must pick an element with an index. This does not compile.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'Swap the ends',
      body: `Write the method \`swapEnds\`. It swaps the first and last elements of \`arr\`. If the array is empty, it does nothing.

- \`{3, 8, 1, 6}\` becomes \`{6, 8, 1, 3}\`
- \`{4, 9}\` becomes \`{9, 4}\`
- \`{7}\` stays \`{7}\` (the first element is also the last)
- \`{}\` stays \`{}\`

The method is \`void\`: it returns nothing. It does not need to, because \`arr\` refers to the caller's array, so your changes are the caller's changes.

You will need a temporary variable. If you write \`arr[0] = arr[arr.length - 1];\` first, the original first value is gone before you can put it at the end.`,
      starter: String.raw`public class Main {
    /** Swaps the first and last elements of arr. Does nothing if arr is empty. */
    public static void swapEnds(int[] arr) {
        // your code here
    }
}
`,
      solution: String.raw`public class Main {
    /** Swaps the first and last elements of arr. Does nothing if arr is empty. */
    public static void swapEnds(int[] arr) {
        if (arr.length > 0) {
            int temp = arr[0];
            arr[0] = arr[arr.length - 1];
            arr[arr.length - 1] = temp;
        }
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        while (in.hasNextInt()) {
            int n = in.nextInt();          // how many numbers follow
            int[] arr = new int[n];
            for (int i = 0; i < n; i++) {
                arr[i] = in.nextInt();
            }
            Main.swapEnds(arr);
            System.out.println(java.util.Arrays.toString(arr));
        }
    }
}
`,
      tests: [
        { name: 'Four elements', stdin: '4 3 8 1 6\n', stdout: '[6, 8, 1, 3]\n' },
        { name: 'Two elements', stdin: '2 4 9\n', stdout: '[9, 4]\n' },
        { name: 'Negative numbers and repeats', stdin: '5 -2 5 5 0 11\n', stdout: '[11, 5, 5, 0, -2]\n' },
        { name: 'One element stays put', stdin: '1 7\n', stdout: '[7]\n' },
        { name: 'Empty array does not crash', stdin: '0\n', stdout: '[]\n' },
      ],
      hints: [
        'The first element is `arr[0]` and the last is `arr[arr.length - 1]`. Those two are the only ones that change.',
        'Save `arr[0]` in a variable called `temp`, then copy the last element into index 0, then put `temp` into the last index.',
        'An empty array has no index 0, so wrap all three lines in `if (arr.length > 0) { ... }`.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'An array stores a data set of one type under one name. Each element is reached by an `int` index, so loops can count through it.',
        'Create one with `new int[n]` (every element starts at 0, 0.0, false or null) or with an initializer list like `{4, 8, 15}`. Its size never changes after that.',
        'Indexes run from `0` to `arr.length - 1`. `length` has no parentheses for arrays; `length()` is for strings.',
        'An array variable holds a reference. `b = a` makes two names for one array, so a change through one shows through the other.',
        'Data about people raises questions of privacy and bias. Ask who is in the data, who is missing, and how it will be used.',
      ],
      mistakes: [
        'Using `arr[arr.length]` for the last element, or counting indexes from 1. Both cause an `ArrayIndexOutOfBoundsException` at run time.',
        'Writing `arr.length()` instead of `arr.length`.',
        'Expecting `int[] copy = original;` to make a copy. It makes an alias.',
        'Calling a method on an element of a new `String` array before assigning it. The element is `null`.',
      ],
    },
  ],
};
