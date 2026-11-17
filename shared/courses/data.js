/** Data analysis track. Format documented in shared/courses.js. */

export default [
  /* ------------------------------------------------------------------ */
  {
    slug: 'data-first-look',
    track: 'data',
    title: 'Your first dataset',
    level: 'Beginner',
    minutes: 35,
    blurb: 'Read CSV data, add it up, find the biggest, count categories and filter. Plain Python, no libraries.',
    steps: [
      {
        id: 'what-is-csv',
        kind: 'read',
        title: 'Data is just lines of text',
        body: `A **CSV** (comma-separated values) file is a table stored as text. One row per line, columns split by commas.

\`\`\`
Sunflower,158
Stay,141
\`\`\`

Your program reads each line with \`input()\`, then \`split(",")\` cuts it into a list of strings.

\`\`\`python
line = input()                 # "Sunflower,158"
title, secs = line.split(",")  # two names for the two pieces
secs = int(secs)               # still text until you convert it
\`\`\`

Every dataset in this course starts with a line **N**, the number of rows, then N rows. Loop N times and you have all the data. The usual trap is forgetting \`int()\` or \`float()\`: \`"9" + "8"\` is \`"98"\`, not 17.`,
      },
      {
        id: 'total-listening',
        kind: 'code',
        title: 'Total listening time',
        body: `Your playlist export has one song per line as \`title,seconds\`. First line is N.

Print the total length of the playlist in **minutes**, rounded to 1 decimal place (for example \`11.7\`).`,
        starter: `n = int(input())\ntotal = 0\nfor _ in range(n):\n    title, secs = input().split(",")\n    # add secs to total (convert it first)\n# print total minutes with one decimal: f"{x:.1f}"\n`,
        cases: [
          { stdin: '4\nSunflower,158\nBlinding Lights,200\nLevitating,203\nStay,141\n', stdout: '11.7' },
          { stdin: '3\nA,90\nB,45\nC,45\n', stdout: '3.0' },
          { stdin: '1\nSolo,60\n', stdout: '1.0' },
        ],
        solution: `n = int(input())
total = 0
for _ in range(n):
    title, secs = input().split(",")
    total += int(secs)
print(f"{total / 60:.1f}")
`,
      },
      {
        id: 'lunch-average',
        kind: 'code',
        title: 'Average lunch rating',
        body: `A school lunch survey: each line is \`student,rating\` where rating is 1 to 5. First line is N.

The **average** (mean) is the total divided by the count. Print it rounded to **2 decimal places**.`,
        starter: `n = int(input())\ntotal = 0\nfor _ in range(n):\n    name, rating = input().split(",")\n    # add the rating\n# print total / n with two decimals\n`,
        cases: [
          { stdin: '5\nAva,4\nBen,2\nCara,5\nDev,3\nEli,4\n', stdout: '3.60' },
          { stdin: '3\nA,1\nB,2\nC,2\n', stdout: '1.67' },
          { stdin: '1\nZoe,5\n', stdout: '5.00' },
        ],
        solution: `n = int(input())
total = 0
for _ in range(n):
    name, rating = input().split(",")
    total += int(rating)
print(f"{total / n:.2f}")
`,
      },
      {
        id: 'best-seller',
        kind: 'code',
        title: 'Best-selling game',
        body: `Video game sales: each line is \`title,millions_sold\` (a decimal number). First line is N.

Find the row with the biggest sales. Print \`title: sales\` with sales to **1 decimal place**, for example \`Tetris: 520.0\`.

Keep two variables as you loop: the best sales so far and the title that went with it.`,
        starter: `n = int(input())\nbest_title = ""\nbest_sales = -1.0\nfor _ in range(n):\n    title, sales = input().split(",")\n    sales = float(sales)\n    # is this the new best? update both variables\nprint(f"{best_title}: {best_sales:.1f}")\n`,
        cases: [
          { stdin: '4\nMinecraft,300\nGTA V,195\nTetris,520\nWii Sports,82.9\n', stdout: 'Tetris: 520.0' },
          { stdin: '3\nFortnite,26.5\nRoblox,9.5\nAmong Us,12\n', stdout: 'Fortnite: 26.5' },
          { stdin: '1\nPong,0.5\n', stdout: 'Pong: 0.5' },
        ],
        solution: `n = int(input())
best_title = ""
best_sales = -1.0
for _ in range(n):
    title, sales = input().split(",")
    sales = float(sales)
    if sales > best_sales:
        best_sales = sales
        best_title = title
print(f"{best_title}: {best_sales:.1f}")
`,
      },
      {
        id: 'count-favorites',
        kind: 'code',
        title: 'Favorite lunch tally',
        body: `Another survey: each line is \`student,favorite_food\`. First line is N.

Count how many students picked each food using a **dict**: the food is the key, the count is the value. \`counts.get(food, 0)\` gives 0 when the food has not appeared yet.

Print one line per food as \`food: count\`, **sorted alphabetically by food**.`,
        starter: `n = int(input())\ncounts = {}\nfor _ in range(n):\n    name, food = input().split(",")\n    counts[food] = counts.get(food, 0) + 1\n# print each food in alphabetical order: sorted(counts)\n`,
        cases: [
          { stdin: '6\nAva,pizza\nBen,tacos\nCara,pizza\nDev,salad\nEli,pizza\nFay,tacos\n', stdout: 'pizza: 3\nsalad: 1\ntacos: 2' },
          { stdin: '3\nA,ramen\nB,ramen\nC,ramen\n', stdout: 'ramen: 3' },
          { stdin: '1\nZed,burger\n', stdout: 'burger: 1' },
        ],
        solution: `n = int(input())
counts = {}
for _ in range(n):
    name, food = input().split(",")
    counts[food] = counts.get(food, 0) + 1
for food in sorted(counts):
    print(f"{food}: {counts[food]}")
`,
      },
      {
        id: 'high-scorers',
        kind: 'code',
        title: 'Filter the scorers',
        body: `Basketball stats (made-up players): each line is \`player,team,points_per_game\`. First line is N.

**Filtering** means keeping only the rows that pass a test. Print the names of players averaging **at least 20.0** points, one per line, in input order. Then print a last line \`Total: k\` with how many passed.

If nobody qualifies, the output is just \`Total: 0\`.`,
        starter: `n = int(input())\nkept = []\nfor _ in range(n):\n    player, team, ppg = input().split(",")\n    # if float(ppg) passes the test, add player to kept\nfor p in kept:\n    print(p)\nprint(f"Total: {len(kept)}")\n`,
        cases: [
          { stdin: '5\nMarcus Hill,DAL,27.4\nTy Brooks,BOS,14.2\nJoel Park,DEN,20.0\nSam Ortiz,MIA,19.9\nRay Cole,LAL,31.1\n', stdout: 'Marcus Hill\nJoel Park\nRay Cole\nTotal: 3' },
          { stdin: '2\nA B,NYK,8.5\nC D,CHI,12.0\n', stdout: 'Total: 0' },
        ],
        solution: `n = int(input())
kept = []
for _ in range(n):
    player, team, ppg = input().split(",")
    if float(ppg) >= 20.0:
        kept.append(player)
for p in kept:
    print(p)
print(f"Total: {len(kept)}")
`,
      },
      {
        id: 'misleading-averages',
        kind: 'read',
        title: 'When the average lies',
        body: `The **mean** adds everything up and divides. One huge value drags it a long way. The **median** is the middle value after sorting, so outliers barely move it.

\`\`\`python
prices = [200, 210, 190, 205, 2000]   # thousands of dollars
mean = sum(prices) / len(prices)      # 561.0
median = sorted(prices)[2]            # 205
\`\`\`

Nobody on that street paid 561. When data has a few extreme values (income, followers, house prices), report the median or show both.

Second trap: two things rising together does not mean one causes the other. Ice cream sales and sunburns both climb in summer. Heat causes both.`,
      },
      {
        id: 'mean-vs-median',
        kind: 'mcq',
        title: 'Which number is honest?',
        body: 'A club of 5 students has these YouTube subscriber counts: 40, 55, 60, 70, and one creator with 5,000. A recruiter says "our members average 1,045 subscribers". What is the best response?',
        options: [
          'The mean is correct, so 1,045 describes a typical member',
          'The median (60) describes a typical member better, because one outlier inflates the mean',
          'Both numbers are wrong because the sample is too small to use',
          'Take the median of the mean and the maximum',
        ],
        answer: 1,
        explain: 'The mean is (40+55+60+70+5000)/5 = 1,045, and it is arithmetically right, but four of five members have under 100. The median, 60, matches what a typical member looks like. The outlier is real data, so report it separately rather than deleting it.',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'data-text-charts',
    track: 'data',
    title: 'Charts in the terminal',
    level: 'Beginner-Intermediate',
    minutes: 30,
    blurb: 'Bar charts, histograms, leaderboards, medians and trends, drawn with nothing but text.',
    steps: [
      {
        id: 'text-bars',
        kind: 'read',
        title: 'A bar is just a repeated character',
        body: `You do not need a plotting library to see data. Multiply a string by a number and you have a bar.

\`\`\`python
print("#" * 5)                     # #####
label = "Mon"
print(f"{label:<6}| {'#' * 3}")    # Mon   | ###
\`\`\`

\`{label:<6}\` pads the label with spaces to width 6 and left-aligns it, so every bar starts in the same column. To align to the longest label, compute \`width = max(len(l) for l in labels)\` first and use \`label.ljust(width)\`.

A chart is a loop plus string multiplication. Once the numbers are in a list, the picture is one line of code.`,
      },
      {
        id: 'bar-chart',
        kind: 'code',
        title: 'Draw a bar chart',
        body: `First line is N. Then N lines of \`label,value\` (value is a whole number, possibly 0).

Print one line per row, in input order: the label padded to the **length of the longest label**, then \` | \`, then the bar of \`#\`, then a space and the number. Example:

\`\`\`
Mon       | #### 4
Wednesday | ## 2
\`\`\``,
        starter: `n = int(input())\nrows = []\nfor _ in range(n):\n    label, value = input().split(",")\n    rows.append((label, int(value)))\nwidth = max(len(label) for label, v in rows)\nfor label, v in rows:\n    # print label.ljust(width), then " | ", then the bar, then the number\n    pass\n`,
        cases: [
          { stdin: '3\nMon,4\nTue,7\nWednesday,2\n', stdout: 'Mon       | #### 4\nTue       | ####### 7\nWednesday | ## 2' },
          { stdin: '2\nA,0\nBB,3\n', stdout: 'A  |  0\nBB | ### 3' },
          { stdin: '1\nSolo,1\n', stdout: 'Solo | # 1' },
        ],
        solution: `n = int(input())
rows = []
for _ in range(n):
    label, value = input().split(",")
    rows.append((label, int(value)))
width = max(len(label) for label, v in rows)
for label, v in rows:
    print(f"{label.ljust(width)} | {'#' * v} {v}")
`,
      },
      {
        id: 'leaderboard',
        kind: 'code',
        title: 'Sort a leaderboard',
        body: `First line is N. Then N lines of \`name,points\`.

Print the leaderboard with the most points first. If two players tie, the name that comes first alphabetically goes first. Each line is \`rank. name points\`, with rank starting at 1, for example \`1. Ava 30\`.

Tip: \`sorted(rows, key=lambda r: (-r[1], r[0]))\` sorts by points descending, then name ascending.`,
        starter: `n = int(input())\nrows = []\nfor _ in range(n):\n    name, pts = input().split(",")\n    rows.append((name, int(pts)))\nrows.sort(key=lambda r: (-r[1], r[0]))\nfor i, (name, pts) in enumerate(rows, start=1):\n    # print rank, name and points\n    pass\n`,
        cases: [
          { stdin: '4\nBen,25\nAva,30\nDev,25\nCara,12\n', stdout: '1. Ava 30\n2. Ben 25\n3. Dev 25\n4. Cara 12' },
          { stdin: '1\nSolo,0\n', stdout: '1. Solo 0' },
        ],
        solution: `n = int(input())
rows = []
for _ in range(n):
    name, pts = input().split(",")
    rows.append((name, int(pts)))
rows.sort(key=lambda r: (-r[1], r[0]))
for i, (name, pts) in enumerate(rows, start=1):
    print(f"{i}. {name} {pts}")
`,
      },
      {
        id: 'histogram',
        kind: 'code',
        title: 'Histogram of test scores',
        body: `One line of integer scores from 0 to 100, separated by spaces.

A **histogram** counts how many values land in each bucket. Use five buckets: \`0-19\`, \`20-39\`, \`40-59\`, \`60-79\`, \`80-100\`. Score 100 belongs in the last bucket. The bucket index is \`score // 20\`, capped at 4.

Print all five buckets in order, even empty ones, as the label padded to width 6, then \` | \`, then the bar, then a space and the count, for example \`80-100 | ### 3\`.`,
        starter: `scores = list(map(int, input().split()))\nlabels = ["0-19", "20-39", "40-59", "60-79", "80-100"]\ncounts = [0] * 5\nfor s in scores:\n    i = min(s // 20, 4)\n    # add one to counts[i]\nfor label, c in zip(labels, counts):\n    # print label padded to 6, " | ", bar, then count\n    pass\n`,
        cases: [
          { stdin: '95 72 88 100 45 61 79 12\n', stdout: '0-19   | # 1\n20-39  |  0\n40-59  | # 1\n60-79  | ### 3\n80-100 | ### 3' },
          { stdin: '0 0 19 20\n', stdout: '0-19   | ### 3\n20-39  | # 1\n40-59  |  0\n60-79  |  0\n80-100 |  0' },
        ],
        solution: `scores = list(map(int, input().split()))
labels = ["0-19", "20-39", "40-59", "60-79", "80-100"]
counts = [0] * 5
for s in scores:
    i = min(s // 20, 4)
    counts[i] += 1
for label, c in zip(labels, counts):
    print(f"{label:<6} | {'#' * c} {c}")
`,
      },
      {
        id: 'median',
        kind: 'code',
        title: 'Find the median',
        body: `One line of integers separated by spaces.

Sort them. With an odd count the median is the middle value. With an even count it is the average of the two middle values. Always print it to **1 decimal place**, for example \`5.0\` or \`2.5\`.`,
        starter: `nums = sorted(map(int, input().split()))\nn = len(nums)\nif n % 2 == 1:\n    m = 0  # the middle item\nelse:\n    m = 0  # average of the two middle items\nprint(f"{m:.1f}")\n`,
        cases: [
          { stdin: '5 1 9 3 7\n', stdout: '5.0' },
          { stdin: '1 2 3 4\n', stdout: '2.5' },
          { stdin: '10\n', stdout: '10.0' },
        ],
        solution: `nums = sorted(map(int, input().split()))
n = len(nums)
if n % 2 == 1:
    m = nums[n // 2]
else:
    m = (nums[n // 2 - 1] + nums[n // 2]) / 2
print(f"{m:.1f}")
`,
      },
      {
        id: 'bake-sale-flag',
        kind: 'flag',
        title: 'Flag: the bake sale',
        body: `The club sold baked goods all week. Items sold per day:

\`\`\`
Mon 12
Tue 9
Wed 14
Thu 7
Fri 21
Sat 18
Sun 11
\`\`\`

Find two things. The day with the **biggest increase over the day before** (Monday has no previous day), written as its three-letter name in lowercase. And the **median** of the seven values.

The flag is \`csclub{day_median}\`, for example \`csclub{wed_10}\`.`,
        flag: 'csclub{fri_12}',
      },
      {
        id: 'trend',
        kind: 'code',
        title: 'Is it going up?',
        body: `One line of integers: a series over time (daily steps, weekly sales).

A simple trend check: compare the sum of the **first half** to the sum of the **second half**. For an odd count, ignore the middle value. Print \`up\` if the second half is bigger, \`down\` if smaller, \`flat\` if equal.

This ignores spikes in the middle, which is the point: one noisy day should not decide the trend.`,
        starter: `a = list(map(int, input().split()))\nh = len(a) // 2\nfirst = sum(a[:h])\nsecond = sum(a[len(a) - h:])\n# print up, down or flat\n`,
        cases: [
          { stdin: '4 6 100 5 7\n', stdout: 'up' },
          { stdin: '10 9 9 4 5 2\n', stdout: 'down' },
          { stdin: '5 9 1 1 9 5\n', stdout: 'flat' },
        ],
        solution: `a = list(map(int, input().split()))
h = len(a) // 2
first = sum(a[:h])
second = sum(a[len(a) - h:])
if second > first:
    print("up")
elif second < first:
    print("down")
else:
    print("flat")
`,
      },
    ],
  },
];
