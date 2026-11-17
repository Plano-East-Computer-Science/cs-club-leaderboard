-- GENERATED FILE -- edit shared/courses*.js and run `npm run build:problems`.
-- Safe to re-run: existing slugs are left alone.
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('python-contests-sum-two', 'Add two numbers', 'The input is one line with two integers separated by a space. Print their sum.', 1, 'cp', 'a, b = map(int, input().split())
# print the sum
', '[{"stdin":"3 4\n","stdout":"7"},{"stdin":"-5 12\n","stdout":"7"},{"stdin":"1000000 2000000\n","stdout":"3000000"}]', 'a, b = map(int, input().split())
print(a + b)
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('python-contests-max-of-n', 'Largest of N', 'First line: N. Second line: N integers. Print the largest. (Try it without the built-in `max` first.)', 1, 'cp', 'n = int(input())
nums = list(map(int, input().split()))
', '[{"stdin":"5\n3 9 2 7 4\n","stdout":"9"},{"stdin":"3\n-8 -3 -20\n","stdout":"-3"},{"stdin":"1\n42\n","stdout":"42"}]', 'n = int(input())
nums = list(map(int, input().split()))
print(max(nums))
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('python-contests-count-evens', 'Count the evens', 'First line: N. Next N lines: one integer each. Print how many are even.', 1, 'cp', 'n = int(input())
count = 0
for _ in range(n):
    x = int(input())
    # update count
print(count)
', '[{"stdin":"4\n1\n2\n3\n4\n","stdout":"2"},{"stdin":"3\n7\n9\n11\n","stdout":"0"},{"stdin":"5\n0\n-2\n-3\n8\n10\n","stdout":"4"}]', 'n = int(input())
count = 0
for _ in range(n):
    x = int(input())
    if x % 2 == 0:
        count += 1
print(count)
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('python-contests-prefix-sums', 'Range sums (prefix sums)', 'First line: N and Q. Second line: N integers. Then Q lines, each with `l r` (1-indexed, inclusive). For each query print the sum of that range.

A loop per query is too slow when N and Q are large. Build a **prefix sum** array once, then every query is one subtraction. This trick shows up constantly in USACO Bronze and Silver.', 1, 'cp', 'n, q = map(int, input().split())
nums = list(map(int, input().split()))
# build prefix sums here
for _ in range(q):
    l, r = map(int, input().split())
    # print the range sum
', '[{"stdin":"5 3\n1 2 3 4 5\n1 5\n2 4\n3 3\n","stdout":"15\n9\n3"},{"stdin":"4 2\n-1 -2 3 4\n1 2\n2 4\n","stdout":"-3\n5"}]', 'n, q = map(int, input().split())
nums = list(map(int, input().split()))
pre = [0]
for x in nums:
    pre.append(pre[-1] + x)
for _ in range(q):
    l, r = map(int, input().split())
    print(pre[r] - pre[l - 1])
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('lab-madlibs-fill-template', 'Fill the template', 'A Mad Libs game asks for words, then slots them into a story. Your program reads three lines from stdin (an animal, a verb, a place) and prints one sentence.

An **f-string** puts variables inside text. Put `f` before the quote and wrap names in braces:

```python
name = input()
print(f"Hello, {name}!")
```

Print exactly: `The <animal> decided to <verb> in the <place>.`', 1, 'labs', 'animal = input()
verb = input()
place = input()
# print the sentence with an f-string
', '[{"stdin":"goat\ndance\nlibrary\n","stdout":"The goat decided to dance in the library."},{"stdin":"octopus\nsing\nkitchen\n","stdout":"The octopus decided to sing in the kitchen."}]', 'animal = input()
verb = input()
place = input()
print(f"The {animal} decided to {verb} in the {place}.")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('lab-madlibs-capitalise', 'Fix the capitals', 'Players type words however they like: `priya`, `PRIYA`, ` pRiYa `. Your machine should clean them up.

- `s.strip()` removes spaces at both ends.
- `s.capitalize()` makes the first letter upper case and the rest lower case.
- `s.lower()` makes everything lower case.

Line 1 is a name, line 2 is a feeling. Print: `<Name> is feeling <feeling> today.` The name is stripped and capitalised. The feeling is stripped and lower case.', 1, 'labs', 'name = input()
feeling = input()
# clean both, then print
', '[{"stdin":"priya\nSLEEPY\n","stdout":"Priya is feeling sleepy today."},{"stdin":"  aRjUn \n Nervous\n","stdout":"Arjun is feeling nervous today."}]', 'name = input().strip().capitalize()
feeling = input().strip().lower()
print(f"{name} is feeling {feeling} today.")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('lab-madlibs-a-or-an', 'A or an?', '"I saw a apple" sounds wrong. English uses **an** before a vowel sound. For this lab, use the simple rule: if the first letter (ignoring case) is one of `a e i o u`, use `an`, otherwise `a`.

```python
word = "Umbrella"
if word[0].lower() in "aeiou":
    ...
```

Read one noun. Print `I saw <a or an> <noun>.` Keep the noun exactly as typed.', 1, 'labs', 'noun = input().strip()
# choose the article, then print
', '[{"stdin":"apple\n","stdout":"I saw an apple."},{"stdin":"dog\n","stdout":"I saw a dog."},{"stdin":"Umbrella\n","stdout":"I saw an Umbrella."}]', 'noun = input().strip()
article = "an" if noun[0].lower() in "aeiou" else "a"
print(f"I saw {article} {noun}.")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('lab-madlibs-repeat-word', 'Say it N times', 'Mad Libs stories love emphasis: "a very very very big dog". Strings can be repeated, but watch the spaces.

```python
"ab" * 3                  # "ababab", no spaces
" ".join(["ab"] * 3)      # "ab ab ab", spaces only between
```

Line 1 is a word, line 2 is N (at least 1). Print `It was a <word repeated N times, separated by single spaces> big dog.` There must be no double spaces anywhere.', 1, 'labs', 'word = input().strip()
n = int(input())
# build the repeated phrase, then print
', '[{"stdin":"very\n3\n","stdout":"It was a very very very big dog."},{"stdin":"super\n1\n","stdout":"It was a super big dog."},{"stdin":"really\n5\n","stdout":"It was a really really really really really big dog."}]', 'word = input().strip()
n = int(input())
print(f"It was a {'' ''.join([word] * n)} big dog.")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('lab-madlibs-make-your-own', 'Make your own', 'Time to ship your own machine. Read three lines: an author name, a hero, and a place. Print exactly three lines:

```
Story by <name>
<hero> walked into the <place>.
Everyone cheered for <hero>.
```

Use what you learned: f-strings for the template, `strip()` on each input. Keep the words as typed otherwise. No trailing spaces.

Once it passes, change the story text for fun. The checker only locks the format above, so keep this version as your submission and experiment in a copy.', 1, 'labs', 'name = input().strip()
hero = input().strip()
place = input().strip()
# print the three lines
', '[{"stdin":"Maya\nCaptain Pickle\ncafeteria\n","stdout":"Story by Maya\nCaptain Pickle walked into the cafeteria.\nEveryone cheered for Captain Pickle."},{"stdin":"Dev\nZed\ngym\n","stdout":"Story by Dev\nZed walked into the gym.\nEveryone cheered for Zed."}]', 'name = input().strip()
hero = input().strip()
place = input().strip()
print(f"Story by {name}")
print(f"{hero} walked into the {place}.")
print(f"Everyone cheered for {hero}.")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('lab-ascii-art-rectangle', 'Filled rectangle', 'Everything in this lab is one idea: a loop that prints one row at a time. A string times a number repeats it: `"#" * 4` is `####`.

Input: one line with `W H` (width and height, both at least 1). Print a rectangle of `#` that is H rows tall and W characters wide.

Spacing rule: no spaces anywhere, and no trailing spaces on any line.', 1, 'labs', 'w, h = map(int, input().split())
for row in range(h):
    # print one row of w characters
    pass
', '[{"stdin":"4 3\n","stdout":"####\n####\n####"},{"stdin":"1 1\n","stdout":"#"},{"stdin":"2 4\n","stdout":"##\n##\n##\n##"}]', 'w, h = map(int, input().split())
for row in range(h):
    print("#" * w)
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('lab-ascii-art-right-triangle', 'Right triangle', 'Now the row length changes with the row number. Input: one integer N. Print N rows. Row 1 has one `#`, row 2 has two, and so on up to N.

```
N = 3
#
##
###
```

Spacing rule: no spaces at all, so nothing trails.', 1, 'labs', 'n = int(input())
for i in range(1, n + 1):
    # row i has i characters
    pass
', '[{"stdin":"3\n","stdout":"#\n##\n###"},{"stdin":"1\n","stdout":"#"},{"stdin":"5\n","stdout":"#\n##\n###\n####\n#####"}]', 'n = int(input())
for i in range(1, n + 1):
    print("#" * i)
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('lab-ascii-art-pyramid', 'Centred pyramid', 'A pyramid needs **leading spaces** to push each row right. Input: one integer N. For row `i` from 1 to N print:

- `N - i` spaces, then
- `2 * i - 1` stars (`*`).

```
N = 3
  *
 ***
*****
```

Spacing rule: leading spaces are required (even on row 1), but there are **no trailing spaces**. Print the star run and stop.', 1, 'labs', 'n = int(input())
for i in range(1, n + 1):
    spaces = n - i
    # print the spaces then the stars, in one print
    pass
', '[{"stdin":"3\n","stdout":"  *\n ***\n*****"},{"stdin":"1\n","stdout":"*"},{"stdin":"4\n","stdout":"   *\n  ***\n *****\n*******"}]', 'n = int(input())
for i in range(1, n + 1):
    print(" " * (n - i) + "*" * (2 * i - 1))
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('lab-ascii-art-hollow-box', 'Hollow box', 'Only the border is drawn. Input: `W H`, both at least 2. Print H rows, each W characters wide:

- The first and last rows are all `#`.
- Every other row is `#`, then `W - 2` spaces, then `#`.

```
5 4
#####
#   #
#   #
#####
```

Spacing rule: the inside spaces are real, but the line ends with `#`, so there is nothing trailing. When W is 2 a middle row is just `##`.', 1, 'labs', 'w, h = map(int, input().split())
for row in range(h):
    if row == 0 or row == h - 1:
        pass  # full row
    else:
        pass  # border, gap, border
', '[{"stdin":"5 4\n","stdout":"#####\n#   #\n#   #\n#####"},{"stdin":"2 2\n","stdout":"##\n##"},{"stdin":"3 3\n","stdout":"###\n# #\n###"}]', 'w, h = map(int, input().split())
for row in range(h):
    if row == 0 or row == h - 1:
        print("#" * w)
    else:
        print("#" + " " * (w - 2) + "#")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('lab-ascii-art-checkerboard', 'Checkerboard', 'Now the pattern depends on both row and column. Input: `W H`. Number rows and columns from 0. A cell is `#` when `(row + col)` is even, otherwise `.`. The top-left cell is always `#`.

```
5 3
#.#.#
.#.#.
#.#.#
```

Spacing rule: no spaces at all. Build each row as a string, then print it.', 1, 'labs', 'w, h = map(int, input().split())
for r in range(h):
    row = ""
    for c in range(w):
        # add "#" or "." to row
        pass
    print(row)
', '[{"stdin":"5 3\n","stdout":"#.#.#\n.#.#.\n#.#.#"},{"stdin":"1 1\n","stdout":"#"},{"stdin":"4 2\n","stdout":"#.#.\n.#.#"}]', 'w, h = map(int, input().split())
for r in range(h):
    row = ""
    for c in range(w):
        row += "#" if (r + c) % 2 == 0 else "."
    print(row)
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('lab-ascii-art-banner', 'The banner', 'Boss level: put a line of text in a box of `*`. Input: one line of text (not empty, may contain spaces; it has no leading or trailing spaces). Let `n` be its length. Print three lines:

- `n + 4` stars.
- `*`, a space, the text, a space, `*`.
- `n + 4` stars again.

```
Plano East
**************
* Plano East *
**************
```

Spacing rule: the only spaces are the ones inside the middle line. Nothing trails. Use `len(text)`.', 1, 'labs', 'text = input()
n = len(text)
# top border, middle line, bottom border
', '[{"stdin":"Plano East\n","stdout":"**************\n* Plano East *\n**************"},{"stdin":"A\n","stdout":"*****\n* A *\n*****"},{"stdin":"hi\n","stdout":"******\n* hi *\n******"}]', 'text = input()
n = len(text)
print("*" * (n + 4))
print("* " + text + " *")
print("*" * (n + 4))
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('cp-patterns-simulation', 'Simulation: the lost robot', 'A robot starts at (0, 0) facing north (the +y direction). One input line holds commands, each one letter:

- `F`: move one step forward.
- `L`: turn 90 degrees left, no movement.
- `R`: turn 90 degrees right, no movement.

Print the final position as `x y`. The line may be empty, and then the answer is `0 0`.

Tip: keep directions in a list in clockwise order (north, east, south, west) and a number for which one you face. Turning is just adding or subtracting 1 modulo 4.', 3, 'cp', 'cmds = input().strip()
x, y = 0, 0
dirs = [(0, 1), (1, 0), (0, -1), (-1, 0)]  # N, E, S, W
d = 0
for ch in cmds:
    pass  # handle F, L, R
print(x, y)
', '[{"stdin":"FFRFF\n","stdout":"2 2"},{"stdin":"LF\n","stdout":"-1 0"},{"stdin":"\n","stdout":"0 0"}]', 'cmds = input().strip()
x, y = 0, 0
dirs = [(0, 1), (1, 0), (0, -1), (-1, 0)]
d = 0
for ch in cmds:
    if ch == "R":
        d = (d + 1) % 4
    elif ch == "L":
        d = (d - 1) % 4
    else:
        x += dirs[d][0]
        y += dirs[d][1]
print(x, y)
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('cp-patterns-brute-pairs', 'Brute force: matching candy bags', 'N friends each brought a bag of candy with a known count. Two friends can trade bags into one team prize if their counts add up to exactly T. How many different pairs of friends (i, j) with i < j add up to T?

Input: first line `N T`, second line N integers. Print the number of pairs.

N is at most about 2000 here, so checking every pair is fine: that is N * N / 2 checks. Two nested loops, with the inner one starting after the outer.', 3, 'cp', 'n, t = map(int, input().split())
a = list(map(int, input().split()))
count = 0
for i in range(n):
    for j in range(i + 1, n):
        pass  # check a[i] + a[j]
print(count)
', '[{"stdin":"4 10\n3 7 5 5\n","stdout":"2"},{"stdin":"3 100\n1 2 3\n","stdout":"0"},{"stdin":"5 6\n3 3 3 3 3\n","stdout":"10"}]', 'n, t = map(int, input().split())
a = list(map(int, input().split()))
count = 0
for i in range(n):
    for j in range(i + 1, n):
        if a[i] + a[j] == t:
            count += 1
print(count)
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('cp-patterns-sort-key', 'Sorting: the leaderboard', 'A contest has N players. Rank them: higher score first, and if scores tie, the name that comes first alphabetically goes first.

Input: first line N, then N lines of `name score` (the name has no spaces, the score is an integer). Print the names in rank order, one per line.

Python''s `sort` takes a **key**. A tuple compares item by item, so `(-score, name)` sorts by score descending, then name ascending:

```python
rows.sort(key=lambda r: (-r[1], r[0]))
```', 3, 'cp', 'n = int(input())
rows = []
for _ in range(n):
    name, score = input().split()
    rows.append((name, int(score)))
# sort rows with a key, then print names
', '[{"stdin":"4\nzoe 90\namy 90\nbo 75\ncy 100\n","stdout":"cy\namy\nzoe\nbo"},{"stdin":"1\nsolo 5\n","stdout":"solo"},{"stdin":"3\nmax 10\nada 10\nlee 10\n","stdout":"ada\nlee\nmax"}]', 'n = int(input())
rows = []
for _ in range(n):
    name, score = input().split()
    rows.append((name, int(score)))
rows.sort(key=lambda r: (-r[1], r[0]))
for name, score in rows:
    print(name)
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('cp-patterns-count-dict', 'Counting: the popular song', 'Every student votes for a song by its ID number. Find the song with the most votes. If several songs tie, print the **smallest** ID.

Input: first line N, second line N integers (the votes). Print one integer.

Use a dict that maps ID to count:

```python
counts = {}
for v in votes:
    counts[v] = counts.get(v, 0) + 1
```

Then scan for the best count, breaking ties by the smaller ID. IDs can be negative.', 3, 'cp', 'n = int(input())
votes = list(map(int, input().split()))
counts = {}
for v in votes:
    counts[v] = counts.get(v, 0) + 1
best = None
# find the id with the highest count, smallest id on ties
print(best)
', '[{"stdin":"7\n3 1 3 2 2 5 1\n","stdout":"1"},{"stdin":"1\n42\n","stdout":"42"},{"stdin":"5\n-1 -1 4 4 4\n","stdout":"4"}]', 'n = int(input())
votes = list(map(int, input().split()))
counts = {}
for v in votes:
    counts[v] = counts.get(v, 0) + 1
best = None
for v in counts:
    if best is None or counts[v] > counts[best] or (counts[v] == counts[best] and v < best):
        best = v
print(best)
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('cp-patterns-two-pointers', 'Two pointers: canoe trip', 'N campers must cross a lake. Each canoe holds **at most 2** people and a total weight of at most W. Every camper weighs at most W alone. What is the fewest canoes needed?

Input: first line `N W`, second line N weights. Print the number of canoes.

Greedy idea: sort the weights. The heaviest camper must ride, so see if the lightest camper can share. If yes, both go. If not, the heaviest goes alone. Keep two pointers, `lo` at the lightest and `hi` at the heaviest, and move them inward.', 3, 'cp', 'n, w = map(int, input().split())
weights = sorted(map(int, input().split()))
lo, hi = 0, n - 1
canoes = 0
while lo <= hi:
    # heaviest rides; take the lightest too if it fits
    pass
print(canoes)
', '[{"stdin":"4 10\n9 1 5 5\n","stdout":"2"},{"stdin":"5 10\n6 7 8 9 10\n","stdout":"5"},{"stdin":"1 5\n3\n","stdout":"1"},{"stdin":"3 6\n3 3 3\n","stdout":"2"}]', 'n, w = map(int, input().split())
weights = sorted(map(int, input().split()))
lo, hi = 0, n - 1
canoes = 0
while lo <= hi:
    if lo < hi and weights[lo] + weights[hi] <= w:
        lo += 1
    hi -= 1
    canoes += 1
print(canoes)
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('data-first-look-total-listening', 'Total listening time', 'Your playlist export has one song per line as `title,seconds`. First line is N.

Print the total length of the playlist in **minutes**, rounded to 1 decimal place (for example `11.7`).', 1, 'data', 'n = int(input())
total = 0
for _ in range(n):
    title, secs = input().split(",")
    # add secs to total (convert it first)
# print total minutes with one decimal: f"{x:.1f}"
', '[{"stdin":"4\nSunflower,158\nBlinding Lights,200\nLevitating,203\nStay,141\n","stdout":"11.7"},{"stdin":"3\nA,90\nB,45\nC,45\n","stdout":"3.0"},{"stdin":"1\nSolo,60\n","stdout":"1.0"}]', 'n = int(input())
total = 0
for _ in range(n):
    title, secs = input().split(",")
    total += int(secs)
print(f"{total / 60:.1f}")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('data-first-look-lunch-average', 'Average lunch rating', 'A school lunch survey: each line is `student,rating` where rating is 1 to 5. First line is N.

The **average** (mean) is the total divided by the count. Print it rounded to **2 decimal places**.', 1, 'data', 'n = int(input())
total = 0
for _ in range(n):
    name, rating = input().split(",")
    # add the rating
# print total / n with two decimals
', '[{"stdin":"5\nAva,4\nBen,2\nCara,5\nDev,3\nEli,4\n","stdout":"3.60"},{"stdin":"3\nA,1\nB,2\nC,2\n","stdout":"1.67"},{"stdin":"1\nZoe,5\n","stdout":"5.00"}]', 'n = int(input())
total = 0
for _ in range(n):
    name, rating = input().split(",")
    total += int(rating)
print(f"{total / n:.2f}")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('data-first-look-best-seller', 'Best-selling game', 'Video game sales: each line is `title,millions_sold` (a decimal number). First line is N.

Find the row with the biggest sales. Print `title: sales` with sales to **1 decimal place**, for example `Tetris: 520.0`.

Keep two variables as you loop: the best sales so far and the title that went with it.', 1, 'data', 'n = int(input())
best_title = ""
best_sales = -1.0
for _ in range(n):
    title, sales = input().split(",")
    sales = float(sales)
    # is this the new best? update both variables
print(f"{best_title}: {best_sales:.1f}")
', '[{"stdin":"4\nMinecraft,300\nGTA V,195\nTetris,520\nWii Sports,82.9\n","stdout":"Tetris: 520.0"},{"stdin":"3\nFortnite,26.5\nRoblox,9.5\nAmong Us,12\n","stdout":"Fortnite: 26.5"},{"stdin":"1\nPong,0.5\n","stdout":"Pong: 0.5"}]', 'n = int(input())
best_title = ""
best_sales = -1.0
for _ in range(n):
    title, sales = input().split(",")
    sales = float(sales)
    if sales > best_sales:
        best_sales = sales
        best_title = title
print(f"{best_title}: {best_sales:.1f}")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('data-first-look-count-favorites', 'Favorite lunch tally', 'Another survey: each line is `student,favorite_food`. First line is N.

Count how many students picked each food using a **dict**: the food is the key, the count is the value. `counts.get(food, 0)` gives 0 when the food has not appeared yet.

Print one line per food as `food: count`, **sorted alphabetically by food**.', 1, 'data', 'n = int(input())
counts = {}
for _ in range(n):
    name, food = input().split(",")
    counts[food] = counts.get(food, 0) + 1
# print each food in alphabetical order: sorted(counts)
', '[{"stdin":"6\nAva,pizza\nBen,tacos\nCara,pizza\nDev,salad\nEli,pizza\nFay,tacos\n","stdout":"pizza: 3\nsalad: 1\ntacos: 2"},{"stdin":"3\nA,ramen\nB,ramen\nC,ramen\n","stdout":"ramen: 3"},{"stdin":"1\nZed,burger\n","stdout":"burger: 1"}]', 'n = int(input())
counts = {}
for _ in range(n):
    name, food = input().split(",")
    counts[food] = counts.get(food, 0) + 1
for food in sorted(counts):
    print(f"{food}: {counts[food]}")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('data-first-look-high-scorers', 'Filter the scorers', 'Basketball stats (made-up players): each line is `player,team,points_per_game`. First line is N.

**Filtering** means keeping only the rows that pass a test. Print the names of players averaging **at least 20.0** points, one per line, in input order. Then print a last line `Total: k` with how many passed.

If nobody qualifies, the output is just `Total: 0`.', 1, 'data', 'n = int(input())
kept = []
for _ in range(n):
    player, team, ppg = input().split(",")
    # if float(ppg) passes the test, add player to kept
for p in kept:
    print(p)
print(f"Total: {len(kept)}")
', '[{"stdin":"5\nMarcus Hill,DAL,27.4\nTy Brooks,BOS,14.2\nJoel Park,DEN,20.0\nSam Ortiz,MIA,19.9\nRay Cole,LAL,31.1\n","stdout":"Marcus Hill\nJoel Park\nRay Cole\nTotal: 3"},{"stdin":"2\nA B,NYK,8.5\nC D,CHI,12.0\n","stdout":"Total: 0"}]', 'n = int(input())
kept = []
for _ in range(n):
    player, team, ppg = input().split(",")
    if float(ppg) >= 20.0:
        kept.append(player)
for p in kept:
    print(p)
print(f"Total: {len(kept)}")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('data-text-charts-bar-chart', 'Draw a bar chart', 'First line is N. Then N lines of `label,value` (value is a whole number, possibly 0).

Print one line per row, in input order: the label padded to the **length of the longest label**, then ` | `, then the bar of `#`, then a space and the number. Example:

```
Mon       | #### 4
Wednesday | ## 2
```', 2, 'data', 'n = int(input())
rows = []
for _ in range(n):
    label, value = input().split(",")
    rows.append((label, int(value)))
width = max(len(label) for label, v in rows)
for label, v in rows:
    # print label.ljust(width), then " | ", then the bar, then the number
    pass
', '[{"stdin":"3\nMon,4\nTue,7\nWednesday,2\n","stdout":"Mon       | #### 4\nTue       | ####### 7\nWednesday | ## 2"},{"stdin":"2\nA,0\nBB,3\n","stdout":"A  |  0\nBB | ### 3"},{"stdin":"1\nSolo,1\n","stdout":"Solo | # 1"}]', 'n = int(input())
rows = []
for _ in range(n):
    label, value = input().split(",")
    rows.append((label, int(value)))
width = max(len(label) for label, v in rows)
for label, v in rows:
    print(f"{label.ljust(width)} | {''#'' * v} {v}")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('data-text-charts-leaderboard', 'Sort a leaderboard', 'First line is N. Then N lines of `name,points`.

Print the leaderboard with the most points first. If two players tie, the name that comes first alphabetically goes first. Each line is `rank. name points`, with rank starting at 1, for example `1. Ava 30`.

Tip: `sorted(rows, key=lambda r: (-r[1], r[0]))` sorts by points descending, then name ascending.', 2, 'data', 'n = int(input())
rows = []
for _ in range(n):
    name, pts = input().split(",")
    rows.append((name, int(pts)))
rows.sort(key=lambda r: (-r[1], r[0]))
for i, (name, pts) in enumerate(rows, start=1):
    # print rank, name and points
    pass
', '[{"stdin":"4\nBen,25\nAva,30\nDev,25\nCara,12\n","stdout":"1. Ava 30\n2. Ben 25\n3. Dev 25\n4. Cara 12"},{"stdin":"1\nSolo,0\n","stdout":"1. Solo 0"}]', 'n = int(input())
rows = []
for _ in range(n):
    name, pts = input().split(",")
    rows.append((name, int(pts)))
rows.sort(key=lambda r: (-r[1], r[0]))
for i, (name, pts) in enumerate(rows, start=1):
    print(f"{i}. {name} {pts}")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('data-text-charts-histogram', 'Histogram of test scores', 'One line of integer scores from 0 to 100, separated by spaces.

A **histogram** counts how many values land in each bucket. Use five buckets: `0-19`, `20-39`, `40-59`, `60-79`, `80-100`. Score 100 belongs in the last bucket. The bucket index is `score // 20`, capped at 4.

Print all five buckets in order, even empty ones, as the label padded to width 6, then ` | `, then the bar, then a space and the count, for example `80-100 | ### 3`.', 2, 'data', 'scores = list(map(int, input().split()))
labels = ["0-19", "20-39", "40-59", "60-79", "80-100"]
counts = [0] * 5
for s in scores:
    i = min(s // 20, 4)
    # add one to counts[i]
for label, c in zip(labels, counts):
    # print label padded to 6, " | ", bar, then count
    pass
', '[{"stdin":"95 72 88 100 45 61 79 12\n","stdout":"0-19   | # 1\n20-39  |  0\n40-59  | # 1\n60-79  | ### 3\n80-100 | ### 3"},{"stdin":"0 0 19 20\n","stdout":"0-19   | ### 3\n20-39  | # 1\n40-59  |  0\n60-79  |  0\n80-100 |  0"}]', 'scores = list(map(int, input().split()))
labels = ["0-19", "20-39", "40-59", "60-79", "80-100"]
counts = [0] * 5
for s in scores:
    i = min(s // 20, 4)
    counts[i] += 1
for label, c in zip(labels, counts):
    print(f"{label:<6} | {''#'' * c} {c}")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('data-text-charts-median', 'Find the median', 'One line of integers separated by spaces.

Sort them. With an odd count the median is the middle value. With an even count it is the average of the two middle values. Always print it to **1 decimal place**, for example `5.0` or `2.5`.', 2, 'data', 'nums = sorted(map(int, input().split()))
n = len(nums)
if n % 2 == 1:
    m = 0  # the middle item
else:
    m = 0  # average of the two middle items
print(f"{m:.1f}")
', '[{"stdin":"5 1 9 3 7\n","stdout":"5.0"},{"stdin":"1 2 3 4\n","stdout":"2.5"},{"stdin":"10\n","stdout":"10.0"}]', 'nums = sorted(map(int, input().split()))
n = len(nums)
if n % 2 == 1:
    m = nums[n // 2]
else:
    m = (nums[n // 2 - 1] + nums[n // 2]) / 2
print(f"{m:.1f}")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('data-text-charts-trend', 'Is it going up?', 'One line of integers: a series over time (daily steps, weekly sales).

A simple trend check: compare the sum of the **first half** to the sum of the **second half**. For an odd count, ignore the middle value. Print `up` if the second half is bigger, `down` if smaller, `flat` if equal.

This ignores spikes in the middle, which is the point: one noisy day should not decide the trend.', 2, 'data', 'a = list(map(int, input().split()))
h = len(a) // 2
first = sum(a[:h])
second = sum(a[len(a) - h:])
# print up, down or flat
', '[{"stdin":"4 6 100 5 7\n","stdout":"up"},{"stdin":"10 9 9 4 5 2\n","stdout":"down"},{"stdin":"5 9 1 1 9 5\n","stdout":"flat"}]', 'a = list(map(int, input().split()))
h = len(a) // 2
first = sum(a[:h])
second = sum(a[len(a) - h:])
if second > first:
    print("up")
elif second < first:
    print("down")
else:
    print("flat")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('llm-how-it-works-tokenize', 'Step 1: tokenize', 'Read one line of text. Lowercase it and split it into **words**, where a word is a run of the letters `a` to `z`. Punctuation and digits are separators and are dropped. Print the words separated by single spaces.

Hint: `re.findall(r"[a-z]+", text)` does the splitting.', 2, 'llm', 'import re

line = input()
# lowercase it, pull out the words, print them separated by spaces
', '[{"stdin":"The Cat SAT\n","stdout":"the cat sat"},{"stdin":"Wait... what?? 42 times!\n","stdout":"wait what times"},{"stdin":"123 !!!\n","stdout":""}]', 'import re

line = input()
words = re.findall(r"[a-z]+", line.lower())
print(" ".join(words))
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('llm-how-it-works-bigrams', 'Step 2: count word pairs', 'A **bigram** is two words in a row. Counting bigrams is how our model "reads".

Read one line, tokenize it as before, and count how many times each consecutive pair appears. Print one line per pair in the form `first second: count`, sorted alphabetically by the pair (first word, then second word).

If there are fewer than two words, print nothing.', 2, 'llm', 'import re

words = re.findall(r"[a-z]+", input().lower())
counts = {}
# for each consecutive pair, add 1 to counts[(a, b)]
# then print the pairs in sorted order
', '[{"stdin":"the cat sat on the mat\n","stdout":"cat sat: 1\non the: 1\nsat on: 1\nthe cat: 1\nthe mat: 1"},{"stdin":"Go go GO go\n","stdout":"go go: 3"},{"stdin":"alone\n","stdout":""}]', 'import re

words = re.findall(r"[a-z]+", input().lower())
counts = {}
for a, b in zip(words, words[1:]):
    counts[(a, b)] = counts.get((a, b), 0) + 1
for (a, b) in sorted(counts):
    print(f"{a} {b}: {counts[(a, b)]}")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('llm-how-it-works-predict', 'Step 3: predict the next word', 'Now use the counts. Line 1 is the training text. Line 2 is a single word. Print the word that most often came **right after** that word in the training text.

- If two words tie, print the one that comes first alphabetically.
- If the word never has a next word (it is missing, or only appears last), print `?`.', 2, 'llm', 'import re

words = re.findall(r"[a-z]+", input().lower())
query = input().strip().lower()
counts = {}
# count the words that follow query
# print the best one, or ? if there are none
', '[{"stdin":"the cat sat on the mat the cat ran\nthe\n","stdout":"cat"},{"stdin":"a b a c\na\n","stdout":"b"},{"stdin":"hello world\nworld\n","stdout":"?"}]', 'import re

words = re.findall(r"[a-z]+", input().lower())
query = input().strip().lower()
counts = {}
for a, b in zip(words, words[1:]):
    if a == query:
        counts[b] = counts.get(b, 0) + 1
if counts:
    print(min(counts, key=lambda w: (-counts[w], w)))
else:
    print("?")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('llm-how-it-works-generate', 'Step 4: generate text', 'Predict, append, repeat. That loop is **generation**.

Input: line 1 is the training text, line 2 is a start word, line 3 is an integer N. Starting from the start word, repeatedly add the most likely next word (same tie rule as before: alphabetical) until you have added N words. Print the start word followed by the generated words, separated by spaces.

If the current word has no next word, stop early.', 2, 'llm', 'import re

words = re.findall(r"[a-z]+", input().lower())
current = input().strip().lower()
n = int(input())
out = [current]
for _ in range(n):
    # find the best next word after current; stop if there is none
    pass
print(" ".join(out))
', '[{"stdin":"the cat sat on the mat the cat sat\nthe\n6\n","stdout":"the cat sat on the cat sat"},{"stdin":"hello world\nhello\n5\n","stdout":"hello world"},{"stdin":"a b\na\n0\n","stdout":"a"}]', 'import re

words = re.findall(r"[a-z]+", input().lower())
current = input().strip().lower()
n = int(input())
nxt = {}
for a, b in zip(words, words[1:]):
    nxt.setdefault(a, {})
    nxt[a][b] = nxt[a].get(b, 0) + 1
out = [current]
for _ in range(n):
    options = nxt.get(current)
    if not options:
        break
    current = min(options, key=lambda w: (-options[w], w))
    out.append(current)
print(" ".join(out))
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('llm-how-it-works-cosine', 'Step 5: words as vectors', 'Real models do not store words as text. They turn each token into a list of numbers called an **embedding**, so that similar words end up with similar numbers. "Similar" is measured with **cosine similarity**:

```
cos(a, b) = (a . b) / (|a| * |b|)
```

where `a . b` is the sum of products of matching entries and `|a|` is the square root of the sum of squares. It is 1 for the same direction, 0 for unrelated, -1 for opposite.

Input: two lines, each a list of numbers separated by spaces (same length). Print the cosine similarity formatted with exactly 2 decimals, like `f"{x:.2f}"`. If either vector is all zeros, print `0.00`.', 2, 'llm', 'import math

a = list(map(float, input().split()))
b = list(map(float, input().split()))
# dot product, then the two lengths, then divide
', '[{"stdin":"1 2 3\n2 4 6\n","stdout":"1.00"},{"stdin":"3 4\n4 3\n","stdout":"0.96"},{"stdin":"1 0\n0 1\n","stdout":"0.00"},{"stdin":"1 2\n-1 -2\n","stdout":"-1.00"},{"stdin":"0 0\n1 1\n","stdout":"0.00"}]', 'import math

a = list(map(float, input().split()))
b = list(map(float, input().split()))
dot = sum(x * y for x, y in zip(a, b))
na = math.sqrt(sum(x * x for x in a))
nb = math.sqrt(sum(y * y for y in b))
if na == 0 or nb == 0:
    print("0.00")
else:
    print(f"{dot / (na * nb):.2f}")
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('llm-prompting-few-shot', 'Show, do not just tell: few-shot prompts', 'Giving a few worked **examples** in the prompt (**few-shot**) is often more reliable than describing the format in words. The model continues the pattern.

Build the prompt from a template. Input: line 1 is the instruction, line 2 is N, then N lines of `text|label` examples, then a final line with the new text. Print exactly this layout:

```
<instruction>

Input: <text 1>
Label: <label 1>

Input: <new text>
Label:
```

There is a blank line between blocks. With N = 0 you print the instruction, a blank line, and the final block. The last line is `Label:` with nothing after it.', 1, 'llm', 'instruction = input()
n = int(input())
parts = [instruction, '''']
for _ in range(n):
    text, label = input().split(''|'')
    # add the Input and Label lines, then a blank line
new_text = input()
# add the final Input line and the bare Label: line
print(*parts, sep=''\n'')
', '[{"stdin":"Classify the sentiment as positive or negative.\n2\nI love it|positive\nTotal waste of money|negative\nPretty good overall\n","stdout":"Classify the sentiment as positive or negative.\n\nInput: I love it\nLabel: positive\n\nInput: Total waste of money\nLabel: negative\n\nInput: Pretty good overall\nLabel:"},{"stdin":"Translate to French.\n0\ngood morning\n","stdout":"Translate to French.\n\nInput: good morning\nLabel:"}]', 'instruction = input()
n = int(input())
parts = [instruction, '''']
for _ in range(n):
    text, label = input().split(''|'')
    parts += [f"Input: {text}", f"Label: {label}", '''']
new_text = input()
parts += [f"Input: {new_text}", "Label:"]
print(*parts, sep=''\n'')
', '', 'live', 'import');
INSERT OR IGNORE INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by) VALUES ('llm-prompting-eval', 'Test your prompt: a tiny eval', 'Engineers do not trust a prompt because one answer looked good. They run it on many examples and measure. That is an **eval**.

Input: line 1 is N, then N lines of `expected|model_output`. Compare them after **lowercasing** and **collapsing whitespace** (trim the ends, and treat any run of spaces as one space). Print the accuracy as a whole-number percent with a `%` sign, rounded to the nearest whole number with halves rounding up. If N is 0, print `0%`.

Hint: `" ".join(s.split()).lower()` normalizes a string. For the percent use integers: `(200 * correct + n) // (2 * n)`.', 1, 'llm', 'n = int(input())
correct = 0
for _ in range(n):
    expected, output = input().split(''|'', 1)
    # normalize both, compare, update correct
# print the percent, handling n == 0
', '[{"stdin":"3\nPositive|positive\nnegative|  Negative \nneutral|positive\n","stdout":"67%"},{"stdin":"2\nyes|YES\nno|no\n","stdout":"100%"},{"stdin":"8\na|a\nb|x\nc|x\nd|x\ne|x\nf|x\ng|x\nh|x\n","stdout":"13%"},{"stdin":"0\n","stdout":"0%"}]', 'n = int(input())
correct = 0
for _ in range(n):
    expected, output = input().split(''|'', 1)
    norm = lambda s: " ".join(s.split()).lower()
    if norm(expected) == norm(output):
        correct += 1
if n == 0:
    print("0%")
else:
    print(f"{(200 * correct + n) // (2 * n)}%")
', '', 'live', 'import');
