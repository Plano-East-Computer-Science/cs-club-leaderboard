export default {
  id: 'arraylist',
  title: 'ArrayList methods',
  minutes: 30,
  summary: 'Use a list that grows and shrinks: create an ArrayList, then add, get, set and remove elements by index.',
  topics: ['4.8'],
  steps: [
    {
      kind: 'explain',
      title: 'A row of lockers that can grow',
      body: `An array's size is fixed when it is created. That is a problem for a playlist, a cart or a waitlist, where items come and go. An **ArrayList** is a list that grows and shrinks as you add and remove, and keeps its elements in order with indexes from 0, just like an array.

\`\`\`java
import java.util.ArrayList;

ArrayList<String> songs = new ArrayList<String>();
\`\`\`

- \`<String>\` is the **type parameter**: the type of every element. It must be a class type, so for numbers you write \`ArrayList<Integer>\` or \`ArrayList<Double>\`, never \`<int>\`. Autoboxing does the wrapping for you.
- A new ArrayList starts **empty**, size 0.
- You can shorten the right side to \`new ArrayList<>()\`; Java fills in the type.`,
    },
    {
      kind: 'explain',
      title: 'The methods on the exam',
      body: `| method | what it does | returns |
| --- | --- | --- |
| \`size()\` | how many elements | int |
| \`add(obj)\` | appends to the end | true |
| \`add(index, obj)\` | inserts at index; later elements move right | nothing |
| \`get(index)\` | the element at index | the element |
| \`set(index, obj)\` | replaces the element at index | the **old** element |
| \`remove(index)\` | removes it; later elements move left | the removed element |

Indexes go from 0 to \`size() - 1\` (a method call with parentheses, unlike an array's \`length\`). An index outside that range throws an IndexOutOfBoundsException. \`add(index, obj)\` may use \`size()\` itself as the index, which is the same as appending.`,
    },
    {
      kind: 'example',
      title: 'A playlist',
      body: 'Run it. Then insert a song at index 0 and remove the last one.',
      editable: true,
      code: String.raw`import java.util.ArrayList;

public class Main {
    public static void main(String[] args) {
        ArrayList<String> songs = new ArrayList<String>();
        songs.add("Levitating");
        songs.add("Yellow");
        songs.add("Hey Jude");
        System.out.println(songs + " size " + songs.size());

        songs.add(1, "Shake It Off");
        System.out.println(songs);

        String old = songs.set(2, "Clocks");
        System.out.println("Replaced " + old + ": " + songs);

        String gone = songs.remove(0);
        System.out.println("Removed " + gone + ": " + songs.get(0) + " is first now");
    }
}
`,
      output: '[Levitating, Yellow, Hey Jude] size 3\n[Levitating, Shake It Off, Yellow, Hey Jude]\nReplaced Yellow: [Levitating, Shake It Off, Clocks, Hey Jude]\nRemoved Levitating: Shake It Off is first now\n',
    },
    {
      kind: 'explain',
      title: 'Indexes move when the list changes',
      body: `This is the idea that trips people up. When you insert or remove, **every element after that spot gets a new index**.

After \`list.remove(1)\` on \`[A, B, C, D]\`, the list is \`[A, C, D]\`: C moved from index 2 to index 1, and the size dropped to 3. Any index you computed before the removal may now point at a different element.

Draw the list as a row of boxes and redraw it after every add and remove. That is how you trace ArrayList code on the exam.`,
      diagram: { type: 'array', name: 'after list.remove(1) on [A, B, C, D]', values: ['A', 'C', 'D'], highlight: [1, 2], caption: 'C and D each moved one index to the left.' },
    },
    {
      kind: 'predict',
      body: 'Redraw the list after every line. Type the output.',
      code: String.raw`import java.util.ArrayList;

public class Main {
    public static void main(String[] args) {
        ArrayList<Integer> nums = new ArrayList<Integer>();
        nums.add(4);
        nums.add(8);
        nums.add(0, 6);
        nums.add(2);
        nums.remove(1);
        nums.set(0, nums.get(0) + 10);
        System.out.println(nums);
        System.out.println(nums.size());
    }
}
`,
      output: '[16, 8, 2]\n3\n',
      choices: ['[16, 8, 2]\n3\n', '[16, 4, 8]\n3\n', '[6, 8, 2]\n3\n', '[16, 4, 2]\n3\n'],
      explain: `After the adds: [4], [4, 8], [6, 4, 8] (6 inserted at index 0), [6, 4, 8, 2]. \`remove(1)\` takes out the 4: [6, 8, 2]. Then index 0 becomes 6 + 10 = 16. Three elements remain.`,
    },
    {
      kind: 'explain',
      title: 'remove(int) or remove(Object)?',
      body: `\`ArrayList\` actually has two \`remove\` methods: \`remove(int index)\` and \`remove(Object obj)\`, which removes the first element equal to \`obj\`. With a list of Integers this is a trap:

\`\`\`java
ArrayList<Integer> list = new ArrayList<Integer>();  // [10, 20, 30]
list.remove(1);   // removes INDEX 1 (the 20), not the value 1
\`\`\`

Because \`1\` is an int, Java picks the index version. The AP Java subset focuses on \`remove(int index)\`, so when you see \`remove\` with an int on the exam, read it as an index.

Also: printing an ArrayList directly shows its elements in brackets, like \`[10, 30]\`. Printing an array shows a memory code, which is why you needed \`Arrays.toString\` for arrays.`,
    },
    {
      kind: 'check',
      title: 'What does set return?',
      prompt: '`list` is `["a", "b", "c"]`. What is printed by `System.out.println(list.set(1, "z") + list.get(1));`?',
      options: [
        { text: '`bz`', correct: true, why: '`set` replaces "b" with "z" and returns the old element, "b". Then `get(1)` is the new "z".' },
        { text: '`zz`', why: '`set` returns the element that was replaced, not the new one.' },
        { text: '`truez`', why: 'That is what `add(obj)` returns. `set` returns the old element.' },
        { text: '`az`', why: 'Index 1 is the second element, "b". Indexes start at 0.' },
      ],
    },
    {
      kind: 'check',
      title: 'Declaring a list of numbers',
      prompt: 'Which declaration creates an empty list that can hold whole numbers?',
      options: [
        { text: '`ArrayList<Integer> nums = new ArrayList<Integer>();`', correct: true, why: 'The type parameter must be a class, so ints are stored as Integer objects through autoboxing.' },
        { text: '`ArrayList<int> nums = new ArrayList<int>();`', why: 'Type parameters cannot be primitives. This does not compile.' },
        { text: '`ArrayList<Integer> nums = new ArrayList<Integer>;`', why: '`new` calls a constructor, which needs parentheses: `new ArrayList<Integer>()`. This does not compile.' },
        { text: '`int[] nums = new ArrayList<Integer>();`', why: 'An ArrayList is not an array; the types do not match.' },
      ],
    },
    {
      kind: 'exercise',
      title: 'The waitlist',
      body: `A club runs a waitlist. Write \`process(ArrayList<String> list, String cmd, String name)\`, which changes the list according to the command:

- \`join\`: add \`name\` to the end
- \`vip\`: insert \`name\` at the front
- \`leave\`: remove the person at the front (do nothing if the list is empty)

The tester runs one command per line and prints the list after each.`,
      starter: String.raw`import java.util.ArrayList;

public class Main {
    public static void process(ArrayList<String> list, String cmd, String name) {
    }
}
`,
      solution: String.raw`import java.util.ArrayList;

public class Main {
    public static void process(ArrayList<String> list, String cmd, String name) {
        if (cmd.equals("join")) {
            list.add(name);
        } else if (cmd.equals("vip")) {
            list.add(0, name);
        } else if (cmd.equals("leave") && list.size() > 0) {
            list.remove(0);
        }
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        java.util.ArrayList<String> list = new java.util.ArrayList<String>();
        while (in.hasNext()) {
            String cmd = in.next();
            String name = cmd.equals("leave") ? "" : in.next();
            Main.process(list, cmd, name);
            System.out.println(list);
        }
    }
}
`,
      tests: [
        { name: 'Join in order', stdin: 'join Ana\njoin Bo\n', stdout: '[Ana]\n[Ana, Bo]\n' },
        { name: 'A VIP goes first', stdin: 'join Ana\nvip Cy\njoin Bo\n', stdout: '[Ana]\n[Cy, Ana]\n[Cy, Ana, Bo]\n' },
        { name: 'Leaving from the front', stdin: 'join Ana\njoin Bo\nleave\n', stdout: '[Ana]\n[Ana, Bo]\n[Bo]\n' },
        { name: 'Leave on an empty list', stdin: 'leave\njoin Di\n', stdout: '[]\n[Di]\n' },
      ],
      hints: [
        'Compare commands with `equals`: `if (cmd.equals("join"))`.',
        '`list.add(name)` appends; `list.add(0, name)` inserts at the front.',
        '`list.remove(0)` takes the front person, but only when `list.size() > 0`, or it crashes.',
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'ArrayList grows and shrinks; declare it as `ArrayList<Type>` with a class type such as Integer.',
        '`size`, `add(obj)`, `add(i, obj)`, `get(i)`, `set(i, obj)`, `remove(i)` are the exam methods.',
        '`set` and `remove` return the old element.',
        'Inserting or removing shifts the indexes of every later element.',
      ],
      mistakes: [
        '`ArrayList<int>` instead of `ArrayList<Integer>`.',
        '`list.length` or `list.size` instead of `list.size()`.',
        'Using an index from before an insert or removal.',
        'Forgetting `import java.util.ArrayList;`.',
      ],
    },
  ],
};
