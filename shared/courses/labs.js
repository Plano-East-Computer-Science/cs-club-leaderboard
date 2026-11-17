/**
 * Lab courses and a contest-patterns course. Same format as shared/courses.js.
 * Every code step is auto-checked: output must match exactly, with no trailing
 * spaces on any line.
 */

const madlibs = {
  slug: 'lab-madlibs',
  track: 'labs',
  title: 'Lab: Mad Libs machine',
  level: 'Beginner',
  minutes: 20,
  blurb: 'Read words from stdin, drop them into a story, then upgrade the machine step by step.',
  steps: [
    {
      id: 'fill-template',
      kind: 'code',
      title: 'Fill the template',
      body: `A Mad Libs game asks for words, then slots them into a story. Your program reads three lines from stdin (an animal, a verb, a place) and prints one sentence.

An **f-string** puts variables inside text. Put \`f\` before the quote and wrap names in braces:

\`\`\`python
name = input()
print(f"Hello, {name}!")
\`\`\`

Print exactly: \`The <animal> decided to <verb> in the <place>.\``,
      starter: `animal = input()\nverb = input()\nplace = input()\n# print the sentence with an f-string\n`,
      cases: [
        { stdin: 'goat\ndance\nlibrary\n', stdout: 'The goat decided to dance in the library.' },
        { stdin: 'octopus\nsing\nkitchen\n', stdout: 'The octopus decided to sing in the kitchen.' },
      ],
      solution: `animal = input()\nverb = input()\nplace = input()\nprint(f"The {animal} decided to {verb} in the {place}.")\n`,
    },
    {
      id: 'capitalise',
      kind: 'code',
      title: 'Fix the capitals',
      body: `Players type words however they like: \`priya\`, \`PRIYA\`, \` pRiYa \`. Your machine should clean them up.

- \`s.strip()\` removes spaces at both ends.
- \`s.capitalize()\` makes the first letter upper case and the rest lower case.
- \`s.lower()\` makes everything lower case.

Line 1 is a name, line 2 is a feeling. Print: \`<Name> is feeling <feeling> today.\` The name is stripped and capitalised. The feeling is stripped and lower case.`,
      starter: `name = input()\nfeeling = input()\n# clean both, then print\n`,
      cases: [
        { stdin: 'priya\nSLEEPY\n', stdout: 'Priya is feeling sleepy today.' },
        { stdin: '  aRjUn \n Nervous\n', stdout: 'Arjun is feeling nervous today.' },
      ],
      solution: `name = input().strip().capitalize()\nfeeling = input().strip().lower()\nprint(f"{name} is feeling {feeling} today.")\n`,
    },
    {
      id: 'a-or-an',
      kind: 'code',
      title: 'A or an?',
      body: `"I saw a apple" sounds wrong. English uses **an** before a vowel sound. For this lab, use the simple rule: if the first letter (ignoring case) is one of \`a e i o u\`, use \`an\`, otherwise \`a\`.

\`\`\`python
word = "Umbrella"
if word[0].lower() in "aeiou":
    ...
\`\`\`

Read one noun. Print \`I saw <a or an> <noun>.\` Keep the noun exactly as typed.`,
      starter: `noun = input().strip()\n# choose the article, then print\n`,
      cases: [
        { stdin: 'apple\n', stdout: 'I saw an apple.' },
        { stdin: 'dog\n', stdout: 'I saw a dog.' },
        { stdin: 'Umbrella\n', stdout: 'I saw an Umbrella.' },
      ],
      solution: `noun = input().strip()\narticle = "an" if noun[0].lower() in "aeiou" else "a"\nprint(f"I saw {article} {noun}.")\n`,
    },
    {
      id: 'repeat-word',
      kind: 'code',
      title: 'Say it N times',
      body: `Mad Libs stories love emphasis: "a very very very big dog". Strings can be repeated, but watch the spaces.

\`\`\`python
"ab" * 3                  # "ababab", no spaces
" ".join(["ab"] * 3)      # "ab ab ab", spaces only between
\`\`\`

Line 1 is a word, line 2 is N (at least 1). Print \`It was a <word repeated N times, separated by single spaces> big dog.\` There must be no double spaces anywhere.`,
      starter: `word = input().strip()\nn = int(input())\n# build the repeated phrase, then print\n`,
      cases: [
        { stdin: 'very\n3\n', stdout: 'It was a very very very big dog.' },
        { stdin: 'super\n1\n', stdout: 'It was a super big dog.' },
        { stdin: 'really\n5\n', stdout: 'It was a really really really really really big dog.' },
      ],
      solution: `word = input().strip()\nn = int(input())\nprint(f"It was a {' '.join([word] * n)} big dog.")\n`,
    },
    {
      id: 'make-your-own',
      kind: 'code',
      title: 'Make your own',
      body: `Time to ship your own machine. Read three lines: an author name, a hero, and a place. Print exactly three lines:

\`\`\`
Story by <name>
<hero> walked into the <place>.
Everyone cheered for <hero>.
\`\`\`

Use what you learned: f-strings for the template, \`strip()\` on each input. Keep the words as typed otherwise. No trailing spaces.

Once it passes, change the story text for fun. The checker only locks the format above, so keep this version as your submission and experiment in a copy.`,
      starter: `name = input().strip()\nhero = input().strip()\nplace = input().strip()\n# print the three lines\n`,
      cases: [
        { stdin: 'Maya\nCaptain Pickle\ncafeteria\n', stdout: 'Story by Maya\nCaptain Pickle walked into the cafeteria.\nEveryone cheered for Captain Pickle.' },
        { stdin: 'Dev\nZed\ngym\n', stdout: 'Story by Dev\nZed walked into the gym.\nEveryone cheered for Zed.' },
      ],
      solution: `name = input().strip()\nhero = input().strip()\nplace = input().strip()\nprint(f"Story by {name}")\nprint(f"{hero} walked into the {place}.")\nprint(f"Everyone cheered for {hero}.")\n`,
    },
  ],
};

const ascii = {
  slug: 'lab-ascii-art',
  track: 'labs',
  title: 'Lab: ASCII graphics',
  level: 'Beginner',
  minutes: 30,
  blurb: 'Draw rectangles, triangles, pyramids and banners using nothing but characters and loops.',
  steps: [
    {
      id: 'rectangle',
      kind: 'code',
      title: 'Filled rectangle',
      body: `Everything in this lab is one idea: a loop that prints one row at a time. A string times a number repeats it: \`"#" * 4\` is \`####\`.

Input: one line with \`W H\` (width and height, both at least 1). Print a rectangle of \`#\` that is H rows tall and W characters wide.

Spacing rule: no spaces anywhere, and no trailing spaces on any line.`,
      starter: `w, h = map(int, input().split())\nfor row in range(h):\n    # print one row of w characters\n    pass\n`,
      cases: [
        { stdin: '4 3\n', stdout: '####\n####\n####' },
        { stdin: '1 1\n', stdout: '#' },
        { stdin: '2 4\n', stdout: '##\n##\n##\n##' },
      ],
      solution: `w, h = map(int, input().split())\nfor row in range(h):\n    print("#" * w)\n`,
    },
    {
      id: 'right-triangle',
      kind: 'code',
      title: 'Right triangle',
      body: `Now the row length changes with the row number. Input: one integer N. Print N rows. Row 1 has one \`#\`, row 2 has two, and so on up to N.

\`\`\`
N = 3
#
##
###
\`\`\`

Spacing rule: no spaces at all, so nothing trails.`,
      starter: `n = int(input())\nfor i in range(1, n + 1):\n    # row i has i characters\n    pass\n`,
      cases: [
        { stdin: '3\n', stdout: '#\n##\n###' },
        { stdin: '1\n', stdout: '#' },
        { stdin: '5\n', stdout: '#\n##\n###\n####\n#####' },
      ],
      solution: `n = int(input())\nfor i in range(1, n + 1):\n    print("#" * i)\n`,
    },
    {
      id: 'pyramid',
      kind: 'code',
      title: 'Centred pyramid',
      body: `A pyramid needs **leading spaces** to push each row right. Input: one integer N. For row \`i\` from 1 to N print:

- \`N - i\` spaces, then
- \`2 * i - 1\` stars (\`*\`).

\`\`\`
N = 3
  *
 ***
*****
\`\`\`

Spacing rule: leading spaces are required (even on row 1), but there are **no trailing spaces**. Print the star run and stop.`,
      starter: `n = int(input())\nfor i in range(1, n + 1):\n    spaces = n - i\n    # print the spaces then the stars, in one print\n    pass\n`,
      cases: [
        { stdin: '3\n', stdout: '  *\n ***\n*****' },
        { stdin: '1\n', stdout: '*' },
        { stdin: '4\n', stdout: '   *\n  ***\n *****\n*******' },
      ],
      solution: `n = int(input())\nfor i in range(1, n + 1):\n    print(" " * (n - i) + "*" * (2 * i - 1))\n`,
    },
    {
      id: 'hollow-box',
      kind: 'code',
      title: 'Hollow box',
      body: `Only the border is drawn. Input: \`W H\`, both at least 2. Print H rows, each W characters wide:

- The first and last rows are all \`#\`.
- Every other row is \`#\`, then \`W - 2\` spaces, then \`#\`.

\`\`\`
5 4
#####
#   #
#   #
#####
\`\`\`

Spacing rule: the inside spaces are real, but the line ends with \`#\`, so there is nothing trailing. When W is 2 a middle row is just \`##\`.`,
      starter: `w, h = map(int, input().split())\nfor row in range(h):\n    if row == 0 or row == h - 1:\n        pass  # full row\n    else:\n        pass  # border, gap, border\n`,
      cases: [
        { stdin: '5 4\n', stdout: '#####\n#   #\n#   #\n#####' },
        { stdin: '2 2\n', stdout: '##\n##' },
        { stdin: '3 3\n', stdout: '###\n# #\n###' },
      ],
      solution: `w, h = map(int, input().split())\nfor row in range(h):\n    if row == 0 or row == h - 1:\n        print("#" * w)\n    else:\n        print("#" + " " * (w - 2) + "#")\n`,
    },
    {
      id: 'checkerboard',
      kind: 'code',
      title: 'Checkerboard',
      body: `Now the pattern depends on both row and column. Input: \`W H\`. Number rows and columns from 0. A cell is \`#\` when \`(row + col)\` is even, otherwise \`.\`. The top-left cell is always \`#\`.

\`\`\`
5 3
#.#.#
.#.#.
#.#.#
\`\`\`

Spacing rule: no spaces at all. Build each row as a string, then print it.`,
      starter: `w, h = map(int, input().split())\nfor r in range(h):\n    row = ""\n    for c in range(w):\n        # add "#" or "." to row\n        pass\n    print(row)\n`,
      cases: [
        { stdin: '5 3\n', stdout: '#.#.#\n.#.#.\n#.#.#' },
        { stdin: '1 1\n', stdout: '#' },
        { stdin: '4 2\n', stdout: '#.#.\n.#.#' },
      ],
      solution: `w, h = map(int, input().split())\nfor r in range(h):\n    row = ""\n    for c in range(w):\n        row += "#" if (r + c) % 2 == 0 else "."\n    print(row)\n`,
    },
    {
      id: 'banner',
      kind: 'code',
      title: 'The banner',
      body: `Boss level: put a line of text in a box of \`*\`. Input: one line of text (not empty, may contain spaces; it has no leading or trailing spaces). Let \`n\` be its length. Print three lines:

- \`n + 4\` stars.
- \`*\`, a space, the text, a space, \`*\`.
- \`n + 4\` stars again.

\`\`\`
Plano East
**************
* Plano East *
**************
\`\`\`

Spacing rule: the only spaces are the ones inside the middle line. Nothing trails. Use \`len(text)\`.`,
      starter: `text = input()\nn = len(text)\n# top border, middle line, bottom border\n`,
      cases: [
        { stdin: 'Plano East\n', stdout: '**************\n* Plano East *\n**************' },
        { stdin: 'A\n', stdout: '*****\n* A *\n*****' },
        { stdin: 'hi\n', stdout: '******\n* hi *\n******' },
      ],
      solution: `text = input()\nn = len(text)\nprint("*" * (n + 4))\nprint("* " + text + " *")\nprint("*" * (n + 4))\n`,
    },
  ],
};

const patterns = {
  slug: 'cp-patterns',
  track: 'cp',
  title: 'Five patterns that win Bronze',
  level: 'Intermediate',
  minutes: 50,
  blurb: 'Simulation, brute force, custom sorting, counting and greedy. Most Bronze problems are one of these.',
  steps: [
    {
      id: 'the-patterns',
      kind: 'read',
      title: 'Most Bronze problems are one of five',
      body: `Bronze and UIL problems look different, but the solutions repeat:

- **Simulation**: do exactly what the statement says, step by step.
- **Brute force**: try every possibility. Fine when the input is small.
- **Sorting**: sort by a custom key and the answer falls out.
- **Counting**: a dict tallies things in one pass.
- **Greedy / two pointers**: make the locally best choice, often after sorting.

Before coding, read the limits. If n is 100, a triple loop is fine. If n is 10^5, you need something near O(n log n). Always check the limits first, then pick a pattern.`,
    },
    {
      id: 'simulation',
      kind: 'code',
      title: 'Simulation: the lost robot',
      body: `A robot starts at (0, 0) facing north (the +y direction). One input line holds commands, each one letter:

- \`F\`: move one step forward.
- \`L\`: turn 90 degrees left, no movement.
- \`R\`: turn 90 degrees right, no movement.

Print the final position as \`x y\`. The line may be empty, and then the answer is \`0 0\`.

Tip: keep directions in a list in clockwise order (north, east, south, west) and a number for which one you face. Turning is just adding or subtracting 1 modulo 4.`,
      starter: `cmds = input().strip()\nx, y = 0, 0\ndirs = [(0, 1), (1, 0), (0, -1), (-1, 0)]  # N, E, S, W\nd = 0\nfor ch in cmds:\n    pass  # handle F, L, R\nprint(x, y)\n`,
      cases: [
        { stdin: 'FFRFF\n', stdout: '2 2' },
        { stdin: 'LF\n', stdout: '-1 0' },
        { stdin: '\n', stdout: '0 0' },
      ],
      solution: `cmds = input().strip()\nx, y = 0, 0\ndirs = [(0, 1), (1, 0), (0, -1), (-1, 0)]\nd = 0\nfor ch in cmds:\n    if ch == "R":\n        d = (d + 1) % 4\n    elif ch == "L":\n        d = (d - 1) % 4\n    else:\n        x += dirs[d][0]\n        y += dirs[d][1]\nprint(x, y)\n`,
    },
    {
      id: 'brute-pairs',
      kind: 'code',
      title: 'Brute force: matching candy bags',
      body: `N friends each brought a bag of candy with a known count. Two friends can trade bags into one team prize if their counts add up to exactly T. How many different pairs of friends (i, j) with i < j add up to T?

Input: first line \`N T\`, second line N integers. Print the number of pairs.

N is at most about 2000 here, so checking every pair is fine: that is N * N / 2 checks. Two nested loops, with the inner one starting after the outer.`,
      starter: `n, t = map(int, input().split())\na = list(map(int, input().split()))\ncount = 0\nfor i in range(n):\n    for j in range(i + 1, n):\n        pass  # check a[i] + a[j]\nprint(count)\n`,
      cases: [
        { stdin: '4 10\n3 7 5 5\n', stdout: '2' },
        { stdin: '3 100\n1 2 3\n', stdout: '0' },
        { stdin: '5 6\n3 3 3 3 3\n', stdout: '10' },
      ],
      solution: `n, t = map(int, input().split())\na = list(map(int, input().split()))\ncount = 0\nfor i in range(n):\n    for j in range(i + 1, n):\n        if a[i] + a[j] == t:\n            count += 1\nprint(count)\n`,
    },
    {
      id: 'will-it-fit',
      kind: 'mcq',
      title: 'Will brute force fit?',
      body: 'A problem has n up to 10^5 and a 2 second limit. Your idea checks every pair of items. Python does very roughly 10^7 to 10^8 simple operations per second. What happens?',
      options: [
        'It passes: 10^5 pairs is tiny',
        'It passes if you use a list instead of a dict',
        'It fails: about 10^10 pair checks is far too many, so you need roughly O(n log n)',
        'It fails, because O(n^2) is too slow for every n',
      ],
      answer: 2,
      explain: 'Every pair is about n * n / 2, which is 5 * 10^9 checks for n = 10^5. At 10^8 per second that is around a minute. Sorting or a dict gets you to about n log n, around 2 * 10^6 steps. The last option is wrong: for n = 1000, n^2 is only 10^6, which is fine.',
    },
    {
      id: 'sort-key',
      kind: 'code',
      title: 'Sorting: the leaderboard',
      body: `A contest has N players. Rank them: higher score first, and if scores tie, the name that comes first alphabetically goes first.

Input: first line N, then N lines of \`name score\` (the name has no spaces, the score is an integer). Print the names in rank order, one per line.

Python's \`sort\` takes a **key**. A tuple compares item by item, so \`(-score, name)\` sorts by score descending, then name ascending:

\`\`\`python
rows.sort(key=lambda r: (-r[1], r[0]))
\`\`\``,
      starter: `n = int(input())\nrows = []\nfor _ in range(n):\n    name, score = input().split()\n    rows.append((name, int(score)))\n# sort rows with a key, then print names\n`,
      cases: [
        { stdin: '4\nzoe 90\namy 90\nbo 75\ncy 100\n', stdout: 'cy\namy\nzoe\nbo' },
        { stdin: '1\nsolo 5\n', stdout: 'solo' },
        { stdin: '3\nmax 10\nada 10\nlee 10\n', stdout: 'ada\nlee\nmax' },
      ],
      solution: `n = int(input())\nrows = []\nfor _ in range(n):\n    name, score = input().split()\n    rows.append((name, int(score)))\nrows.sort(key=lambda r: (-r[1], r[0]))\nfor name, score in rows:\n    print(name)\n`,
    },
    {
      id: 'count-dict',
      kind: 'code',
      title: 'Counting: the popular song',
      body: `Every student votes for a song by its ID number. Find the song with the most votes. If several songs tie, print the **smallest** ID.

Input: first line N, second line N integers (the votes). Print one integer.

Use a dict that maps ID to count:

\`\`\`python
counts = {}
for v in votes:
    counts[v] = counts.get(v, 0) + 1
\`\`\`

Then scan for the best count, breaking ties by the smaller ID. IDs can be negative.`,
      starter: `n = int(input())\nvotes = list(map(int, input().split()))\ncounts = {}\nfor v in votes:\n    counts[v] = counts.get(v, 0) + 1\nbest = None\n# find the id with the highest count, smallest id on ties\nprint(best)\n`,
      cases: [
        { stdin: '7\n3 1 3 2 2 5 1\n', stdout: '1' },
        { stdin: '1\n42\n', stdout: '42' },
        { stdin: '5\n-1 -1 4 4 4\n', stdout: '4' },
      ],
      solution: `n = int(input())\nvotes = list(map(int, input().split()))\ncounts = {}\nfor v in votes:\n    counts[v] = counts.get(v, 0) + 1\nbest = None\nfor v in counts:\n    if best is None or counts[v] > counts[best] or (counts[v] == counts[best] and v < best):\n        best = v\nprint(best)\n`,
    },
    {
      id: 'two-pointers',
      kind: 'code',
      title: 'Two pointers: canoe trip',
      body: `N campers must cross a lake. Each canoe holds **at most 2** people and a total weight of at most W. Every camper weighs at most W alone. What is the fewest canoes needed?

Input: first line \`N W\`, second line N weights. Print the number of canoes.

Greedy idea: sort the weights. The heaviest camper must ride, so see if the lightest camper can share. If yes, both go. If not, the heaviest goes alone. Keep two pointers, \`lo\` at the lightest and \`hi\` at the heaviest, and move them inward.`,
      starter: `n, w = map(int, input().split())\nweights = sorted(map(int, input().split()))\nlo, hi = 0, n - 1\ncanoes = 0\nwhile lo <= hi:\n    # heaviest rides; take the lightest too if it fits\n    pass\nprint(canoes)\n`,
      cases: [
        { stdin: '4 10\n9 1 5 5\n', stdout: '2' },
        { stdin: '5 10\n6 7 8 9 10\n', stdout: '5' },
        { stdin: '1 5\n3\n', stdout: '1' },
        { stdin: '3 6\n3 3 3\n', stdout: '2' },
      ],
      solution: `n, w = map(int, input().split())\nweights = sorted(map(int, input().split()))\nlo, hi = 0, n - 1\ncanoes = 0\nwhile lo <= hi:\n    if lo < hi and weights[lo] + weights[hi] <= w:\n        lo += 1\n    hi -= 1\n    canoes += 1\nprint(canoes)\n`,
    },
  ],
};

export default [madlibs, ascii, patterns];
