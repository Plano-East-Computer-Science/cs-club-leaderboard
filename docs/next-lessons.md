# Writing a lesson for Learn

Lessons on the `next` site are data, not JSX. The player in `src/next/learn/` renders them one step at
a time. This page is how to write one that actually teaches.

## Where things live

```
shared/next/learn/schema.js          the schema (read its header) and the validator
shared/next/learn/courses/index.js   the list of courses
shared/next/learn/courses/apcsa.js   a course: id, title, units
shared/next/learn/courses/apcsa/unit1.js            a unit: imports its lessons in order
shared/next/learn/courses/apcsa/u1-first-program.js one lesson per file (the model to copy)
test/learn-next.test.js              runs the validator over every course (part of npm test)
test/learn-next-java.js              compiles and runs every piece of Java (run it yourself)
```

To add a lesson: write `courses/<course>/<file>.js` exporting the lesson object, import it in the unit
file at the right position, then run

```
node test/learn-next-java.js <lesson-id>     # the schema rules, then every example, predict and exercise really runs
npm test                                     # the schema over every course, with the rest of the site's tests
```

To add a course (Python, USACO Bronze, web, ...): write `courses/<id>.js` with its units, add it to
`courses/index.js`. The catalog, course map, player and progress API pick it up with no other change.
Python courses validate today; the Java verifier skips them (add a Python pass when the first one lands).

## What a lesson is

8 to 15 short steps, one idea per step. The student moves through them one at a time.

| kind | what the student does |
| --- | --- |
| `explain` | reads a short idea, optionally with a diagram (variables, references, array, 2D grid, trace table) |
| `example` | runs real code and sees its output; `editable: true` invites them to change it |
| `predict` | commits to a guess (choices or typed), then sees it run and reads why |
| `check` | answers a concept question; every option explains itself |
| `exercise` | writes code that is judged by tests, with up to 3 hints and a solution after a few tries |
| `recap` | key takeaways and the common mistakes |

Required in a normal lesson: starts with `explain`, ends with `recap`, at least one `example`, one
`predict`, two `check`s and one `exercise`. A lesson is done when its exercise passes (or, with no
exercise, when every check is answered). Free-response practice lessons are `kind: 'frq'` (see below).

## The teaching standard

The student has never seen the topic. Write like a great teacher sitting next to them.

1. **Start concrete.** Open with an analogy or a situation they already understand (a labelled box for
   a variable, a recipe for an algorithm, seats in a row for an array). Then name the idea.
2. **One idea per step.** An explain body is 60 to 200 words. If you need a second heading, it is a
   second step.
3. **Show, then ask.** Put an `example` right after the idea, then a `predict` that targets the
   misconception (integer division, `print` vs `println`, off-by-one, `==` on strings, aliasing).
   The `explain` on a predict says *why*, step by step, like tracing on paper.
4. **Checks are AP-exam style.** Four options where possible. Wrong options are the mistakes students
   really make, and each `why` says exactly what that mistake is. Use the exam's phrasing ("Which of
   the following...", "What is printed as a result of executing...", "Which code segment can replace
   /* missing code */...").
5. **Diagrams for memory.** Use `vars` for primitives, `refs` for objects and aliasing, `array` and
   `grid` for collections, `trace` to show a loop step by step.
6. **Exercises are small and judged.** One clear task, a starter that compiles, tests that include an
   edge case (zero, empty string, one element, negative). Hints go from a nudge to nearly the answer.
   Use only ideas taught so far in the course (no loops in Unit 1, no ArrayList before Unit 4).
7. **Recap names the traps.** Takeaways are the rules to remember; mistakes are what AP graders
   actually see (missing `return`, printing instead of returning, `=` vs `==`, `str == "x"`,
   `i <= arr.length`, forgetting to `new` an object, changing a parameter and expecting the caller's
   variable to change).

## House style (it is UI text)

Sentence case titles. Second person, plain words, short sentences. No em dashes (use a comma, colon or
a new sentence), no exclamation marks, no emojis, no "Let's dive in", no "simply". Java code uses 4
spaces, `public class Main` for runnable programs, and the conventions of the AP Java subset.

## Writing the data

Text fields are markdown in JavaScript template literals. Inside a template literal:

- write a backtick as `` \` ``, and `${` as `\${`;
- a backslash is doubled. Java `"a\n"` inside a template literal is written `"a\\n"`, and a
  markdown escape like `\"` in prose is written `\\"`.

`code`, `starter`, `solution` and `harness` are easiest as `String.raw` templates: there, backslashes
stay exactly as typed, so the Java `"a\n"` is written `"a\n"`. Java rarely needs a backtick or `${`,
which `String.raw` cannot hold.

`output` (and test `stdout`) is exactly what the program prints. Trailing spaces and the final newline
do not matter; everything else does.

## Exercises

Two shapes:

**Whole program.** Input comes on stdin, output is checked exactly. Teach `Scanner` first (Unit 1,
variables lesson). Each test is `{ name, stdin, stdout }`.

**Write a method** (most of Units 2 to 4, and every FRQ). The student edits a class with a method stub;
a hidden `harness` (shown on request as "How this is tested") calls it:

```js
starter: String.raw`public class Main {
    /** Returns how many times ch appears in s. */
    public static int countChar(String s, String ch) {
        // your code here
        return 0;
    }
}
`,
harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        while (in.hasNextLine()) {
            String[] p = in.nextLine().split(" ");
            System.out.println(Main.countChar(p[0], p[1]));
        }
    }
}
`,
```

The harness is a non-public class with `main`, appended after the student's code, so it cannot use
`import` (write `java.util.Scanner`, `java.util.ArrayList`). For a class-design task, the student writes
the class and the harness constructs it.

## What the browser Java runner can and cannot do

It is OpenJDK's javac plus TeaVM, compiled to WebAssembly.

- `Scanner` reads stdin and splits on whitespace: `nextInt`, `nextDouble`, `next`, `nextLine`,
  `hasNext...`. No `useDelimiter`, no `Scanner(File)`, no files at all. Teach file reading with
  `explain` code blocks and practice the same parsing on stdin.
- `array.clone()` crashes: use `Arrays.copyOf(a, a.length)`.
- Exception messages differ from desktop Java (`ArrayIndexOutOfBoundsException` has no "Index 5 out of
  bounds" text). Never print an exception's message in an example. An example that is *meant* to crash
  sets `crashes: true`; its `output` is what printed before the crash.
- `printf`, `String.format`, `Math`, `String`, `StringBuilder`, `ArrayList`, `Arrays`, `Integer`,
  `Double` and recursion all work. Threads, reflection and the network do not.

## Free-response practice (`kind: 'frq'`)

3 to 15 steps: explain the question type and what the rubric rewards, then one exercise per part
(a), (b). Every test has a `rubric` field naming the point it checks ("Accesses every element of the
ArrayList", "Returns the computed average, not prints it"), so a failing test reads like a grader's
note. End with a recap of the points students most often lose.

## Checklist

- [ ] Opens with something concrete; one idea per step.
- [ ] Every example and predict prints exactly its `output` (`node test/learn-next-java.js <id>`).
- [ ] Every check option has a `why`; wrong options are real mistakes.
- [ ] The exercise's solution passes, its starter compiles and fails, tests include an edge case.
- [ ] No em dashes, no exclamation marks, sentence case.
- [ ] `node test/learn-next.test.js` passes.
