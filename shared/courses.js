/**
 * Course content. Plain data, versioned in git, so a lesson is a pull request
 * and an officer can review it like any other change.
 *
 * Step kinds:
 *   read  -- explanation; passes when the student marks it done.
 *   mcq   -- multiple choice. `answer` is an index into `options`.
 *   flag  -- free-text answer, HackTheBox style. `flag` is compared case-insensitively.
 *   code  -- Python run in the student's own browser against `cases`
 *            (stdin -> expected stdout). `solution` is the reference answer.
 *
 * SERVER-ONLY fields (never sent to browsers): answer, flag, solution.
 * Code-step `cases` ARE sent: the check runs client-side, so it is an honour
 * system, which is fine for a club (a student can only cheat themselves).
 */

export const TRACKS = [
  { id: 'cp', name: 'Competitive programming', blurb: 'USACO, UIL, BOT. Contest-style problems you solve and check right here.' },
  { id: 'cyber', name: 'Cybersecurity', blurb: 'CTF-style flags: decode, find, capture. The skills behind CyberPatriot and picoCTF.' },
  { id: 'projects', name: 'Projects and tools', blurb: 'Git, GitHub and shipping something real that goes on your portfolio.' },
  { id: 'llm', name: 'LLMs and AI', blurb: 'Prompting, evaluating and building with language models.', soon: true },
  { id: 'data', name: 'Data analysis', blurb: 'Python and real datasets, from spreadsheets to charts.', soon: true },
  { id: 'circuits', name: 'Circuits and hardware', blurb: 'Build and simulate circuits, then wire up microcontrollers.', soon: true },
];

export const COURSES = [
  /* ------------------------------------------------------------------ */
  {
    slug: 'python-contests',
    track: 'cp',
    title: 'Python for contests',
    level: 'Beginner',
    minutes: 40,
    blurb: 'Read input, loop, and solve real contest-style problems. Your code runs in this page.',
    steps: [
      {
        id: 'how-it-works',
        kind: 'read',
        title: 'How a contest problem works',
        body: `A contest problem gives your program **input on stdin** and checks the **output on stdout**. That is all. No buttons, no prompts.

\`\`\`python
line = input()          # reads one line as a string
n = int(line)           # turn it into a number
print(n * 2)            # whatever you print is your answer
\`\`\`

Two things trip beginners up:
- \`input()\` always returns text. Convert with \`int()\` or \`float()\`.
- Print **only** the answer. An extra "Enter a number:" makes the judge mark you wrong.

Next, try it for real.`,
      },
      {
        id: 'sum-two',
        kind: 'code',
        title: 'Add two numbers',
        body: 'The input is one line with two integers separated by a space. Print their sum.',
        starter: `a, b = map(int, input().split())\n# print the sum\n`,
        cases: [
          { stdin: '3 4\n', stdout: '7' },
          { stdin: '-5 12\n', stdout: '7' },
          { stdin: '1000000 2000000\n', stdout: '3000000' },
        ],
        solution: `a, b = map(int, input().split())\nprint(a + b)\n`,
      },
      {
        id: 'membership',
        kind: 'mcq',
        title: 'Which is fast?',
        body: 'You must check "have I seen this number?" a million times. Which structure is fastest?',
        options: ['A list', 'A set', 'A string', 'A sorted list, searched from the front'],
        answer: 1,
        explain: 'A set answers membership in roughly constant time. A list scans every item, so a million checks over a big list is a million long scans.',
      },
      {
        id: 'max-of-n',
        kind: 'code',
        title: 'Largest of N',
        body: 'First line: N. Second line: N integers. Print the largest. (Try it without the built-in `max` first.)',
        starter: `n = int(input())\nnums = list(map(int, input().split()))\n`,
        cases: [
          { stdin: '5\n3 9 2 7 4\n', stdout: '9' },
          { stdin: '3\n-8 -3 -20\n', stdout: '-3' },
          { stdin: '1\n42\n', stdout: '42' },
        ],
        solution: `n = int(input())\nnums = list(map(int, input().split()))\nprint(max(nums))\n`,
      },
      {
        id: 'count-evens',
        kind: 'code',
        title: 'Count the evens',
        body: 'First line: N. Next N lines: one integer each. Print how many are even.',
        starter: `n = int(input())\ncount = 0\nfor _ in range(n):\n    x = int(input())\n    # update count\nprint(count)\n`,
        cases: [
          { stdin: '4\n1\n2\n3\n4\n', stdout: '2' },
          { stdin: '3\n7\n9\n11\n', stdout: '0' },
          { stdin: '5\n0\n-2\n-3\n8\n10\n', stdout: '4' },
        ],
        solution: `n = int(input())\ncount = 0\nfor _ in range(n):\n    x = int(input())\n    if x % 2 == 0:\n        count += 1\nprint(count)\n`,
      },
      {
        id: 'prefix-sums',
        kind: 'code',
        title: 'Range sums (prefix sums)',
        body: `First line: N and Q. Second line: N integers. Then Q lines, each with \`l r\` (1-indexed, inclusive). For each query print the sum of that range.

A loop per query is too slow when N and Q are large. Build a **prefix sum** array once, then every query is one subtraction. This trick shows up constantly in USACO Bronze and Silver.`,
        starter: `n, q = map(int, input().split())\nnums = list(map(int, input().split()))\n# build prefix sums here\nfor _ in range(q):\n    l, r = map(int, input().split())\n    # print the range sum\n`,
        cases: [
          { stdin: '5 3\n1 2 3 4 5\n1 5\n2 4\n3 3\n', stdout: '15\n9\n3' },
          { stdin: '4 2\n-1 -2 3 4\n1 2\n2 4\n', stdout: '-3\n5' },
        ],
        solution: `n, q = map(int, input().split())\nnums = list(map(int, input().split()))\npre = [0]\nfor x in nums:\n    pre.append(pre[-1] + x)\nfor _ in range(q):\n    l, r = map(int, input().split())\n    print(pre[r] - pre[l - 1])\n`,
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'cyber-first-flags',
    track: 'cyber',
    title: 'First flags',
    level: 'Beginner',
    minutes: 25,
    blurb: 'Decode, shift and unscramble your way to your first five flags.',
    steps: [
      {
        id: 'what-is-ctf',
        kind: 'read',
        title: 'What is a CTF?',
        body: `A **Capture the Flag** gives you a puzzle. The solution is a secret string called a **flag**, usually shaped like \`csclub{something}\`. Submit it and you score.

You do not need to hack anything real. Every challenge here is a puzzle you solve with a browser and some thinking. Tools you will meet: encodings (base64, hex), simple ciphers, and reading carefully.`,
      },
      {
        id: 'base64',
        kind: 'flag',
        title: 'Flag 1: base64',
        body: 'This looks like gibberish but it is **base64**. Decode it to get the flag.\n\n`Y3NjbHVie2hlbGxvX2N0Zn0=`\n\nHint: in a browser console, `atob("...")` decodes base64.',
        flag: 'csclub{hello_ctf}',
      },
      {
        id: 'caesar',
        kind: 'flag',
        title: 'Flag 2: Caesar shift',
        body: 'Each letter below was shifted **3 places forward** in the alphabet (a becomes d). Shift each letter back 3 to recover the flag. Braces and underscores are unchanged.\n\n`fvfoxe{urw_wkuhh_lv_hdvb}`',
        flag: 'csclub{rot_three_is_easy}',
      },
      {
        id: 'hex',
        kind: 'flag',
        title: 'Flag 3: hex',
        body: 'Each pair of hex digits is one character\'s code. Decode them to text.\n\n`6373636c75627b6865785f69735f6a7573745f6261736531367d`\n\nHint: 63 is "c".',
        flag: 'csclub{hex_is_just_base16}',
      },
      {
        id: 'reverse',
        kind: 'flag',
        title: 'Flag 4: backwards',
        body: 'Sometimes the trick is simply that it is backwards.\n\n`}desrever{bulcsc`',
        flag: 'csclub{reversed}',
      },
      {
        id: 'hashing',
        kind: 'mcq',
        title: 'Why hash passwords?',
        body: 'A website stores user passwords. What is the right approach?',
        options: [
          'Store them in plain text so users can recover them',
          'Encrypt them with a key stored next to the database',
          'Store a salted, slow hash so the real password is never kept',
          'Store them in base64, which hides them',
        ],
        answer: 2,
        explain: 'Hashes cannot be reversed, salts stop precomputed tables, and slow hashing (bcrypt, argon2) makes guessing expensive. Base64 is encoding, not protection, as Flag 1 just showed.',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'git-and-the-gateway',
    track: 'projects',
    title: 'Git, GitHub and the club gateway',
    level: 'Beginner',
    minutes: 20,
    blurb: 'The five git commands that matter, and how to reach GitHub from a school machine in a meeting.',
    steps: [
      {
        id: 'why-git',
        kind: 'read',
        title: 'Why git',
        body: `Git remembers every version of your project. GitHub is where those versions live online, so teammates can work together and your project is public proof of what you built.

For college applications a GitHub profile with real, finished projects is worth more than a list of clubs.`,
      },
      {
        id: 'commands',
        kind: 'mcq',
        title: 'Pick the right command',
        body: 'You want a copy of a project that lives on GitHub, on your machine. Which command?',
        options: ['git push', 'git clone', 'git commit', 'git merge'],
        answer: 1,
        explain: '`git clone <url>` downloads the whole repository and its history.',
      },
      {
        id: 'order',
        kind: 'mcq',
        title: 'The save loop',
        body: 'You edited a file and want it saved in history and sent to GitHub. What is the correct order?',
        options: [
          'git push, git commit, git add',
          'git add, git commit, git push',
          'git commit, git add, git push',
          'git add, git push, git commit',
        ],
        answer: 1,
        explain: 'Stage the change (`add`), record it (`commit`), then publish it (`push`).',
      },
      {
        id: 'gateway',
        kind: 'read',
        title: 'Using the club gateway in a meeting',
        body: `School machines block GitHub. During a meeting your officers open a **gateway code** that works for a few hours and only reaches an approved list of sites (GitHub and PyPI).

1. Ask an officer for today's code.
2. Open **Gateway** in the site menu and enter it. The page shows ready-to-copy links and commands.
3. To clone: \`git clone https://peshcompsci.org/gw/<CODE>/github.com/<owner>/<repo>.git\`

Never type your GitHub password into a page loaded through the gateway. Sign-in pages are blocked on purpose. Use a personal access token with git, or work at home for anything that needs your account.`,
      },
      {
        id: 'safe',
        kind: 'mcq',
        title: 'What is safe?',
        body: 'You are on the gateway and a page asks you to log in to GitHub. What do you do?',
        options: [
          'Log in, it is the real GitHub',
          'Do not enter your password; use a token with git, or finish at home',
          'Ask a friend to log in for you',
          'Reuse your school password so you remember it',
        ],
        answer: 1,
        explain: 'Anything you type passes through a server you do not control. The gateway blocks sign-in pages for exactly this reason.',
      },
    ],
  },
];

/** What browsers are allowed to see: no answers, flags or solutions. */
export function publicStep(step) {
  const { answer, flag, solution, explain, ...rest } = step; // eslint-disable-line no-unused-vars
  return rest;
}

export const findCourse = (slug) => COURSES.find((c) => c.slug === slug);
