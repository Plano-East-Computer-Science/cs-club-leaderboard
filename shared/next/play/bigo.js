/**
 * Order Up: snippets to classify by worst-case time complexity in n. Arrays
 * and lists have length n unless the code says otherwise. Hash operations
 * count as O(1) on average, as in AP CSA and most interviews.
 *
 * `ans` is one of CLASSES' ids. `why` is shown after a wrong pick.
 */
export const CLASSES = [
  { id: '1', label: 'O(1)' },
  { id: 'logn', label: 'O(log n)' },
  { id: 'n', label: 'O(n)' },
  { id: 'nlogn', label: 'O(n log n)' },
  { id: 'n2', label: 'O(n²)' },
  { id: '2n', label: 'O(2ⁿ)' },
];

export const BIGO = [
  // constant
  { ans: '1', code: 'return a[0] + a[a.length - 1];', why: 'Two array reads, no matter how long the array is.' },
  { ans: '1', code: 'int t = a[i];\na[i] = a[j];\na[j] = t;', why: 'A swap is three steps whatever n is.' },
  { ans: '1', code: 'for (int i = 0; i < 1000; i++) {\n  sum += i;\n}', why: 'The loop runs 1000 times regardless of n. Constant, even if large.' },
  { ans: '1', code: 'return list.get(n / 2);', why: 'ArrayList.get jumps straight to an index.' },
  { ans: '1', code: 'map.put(key, map.getOrDefault(key, 0) + 1);', why: 'HashMap get and put are constant on average.' },
  { ans: '1', code: 'return n % 2 == 0;', why: 'One arithmetic check.' },
  { ans: '1', code: 'for (int i = 0; i < 10 && i < n; i++) {\n  System.out.println(a[i]);\n}', why: 'It never prints more than 10 items.' },
  { ans: '1', code: 'stack.push(x);\nreturn stack.peek();', why: 'Push and peek touch only the top.' },
  { ans: '1', code: 'return set.contains(x);', why: 'HashSet lookup is constant on average.' },
  { ans: '1', code: 'list.add(x);', why: 'Adding to the end of an ArrayList is amortized constant.' },
  { ans: '1', code: 'int mid = (lo + hi) / 2;\nreturn a[mid];', why: 'One calculation and one read.' },
  { ans: '1', code: 'return n * (n + 1) / 2;', why: 'A formula replaces the loop: one multiply and one divide.' },

  // logarithmic
  { ans: 'logn', code: 'int k = 1;\nwhile (k < n) {\n  k *= 2;\n}', why: 'k doubles each step, so it reaches n after about log n steps.' },
  { ans: 'logn', code: 'while (n > 1) {\n  n /= 2;\n}', why: 'Halving n repeatedly takes log n steps.' },
  { ans: 'logn', code: 'while (n > 0) {\n  digits++;\n  n /= 10;\n}', why: 'Dividing by 10 each step: the number of digits grows like log n.' },
  { ans: 'logn', code: 'int lo = 0, hi = n - 1;\nwhile (lo <= hi) {\n  int mid = (lo + hi) / 2;\n  if (a[mid] == k) return mid;\n  if (a[mid] < k) lo = mid + 1;\n  else hi = mid - 1;\n}', why: 'Binary search halves the range every step.' },
  { ans: 'logn', code: 'for (int i = n; i > 0; i /= 3) {\n  count++;\n}', why: 'Dividing by 3 is still logarithmic; the base does not matter in Big-O.' },
  { ans: 'logn', code: 'int f(int n) {\n  if (n <= 1) return 0;\n  return 1 + f(n / 2);\n}', why: 'Each call halves n, so the recursion is log n deep.' },
  { ans: 'logn', code: 'int power(int b, int e) {\n  if (e == 0) return 1;\n  int h = power(b, e / 2);\n  return e % 2 == 0 ? h * h : h * h * b;\n}', why: 'Fast exponentiation halves e each call. Here n is e.' },
  { ans: 'logn', code: 'while (b != 0) {\n  int t = a % b;\n  a = b;\n  b = t;\n}', why: 'Euclid\'s gcd shrinks the numbers at least by half every two steps. Here n is the larger input.' },
  { ans: 'logn', code: 'for (int i = 1; i < n; i *= 2) {\n  System.out.println(i);\n}', why: 'i takes the values 1, 2, 4, 8 and so on up to n.' },
  { ans: 'logn', code: 'treeMap.put(key, value);', why: 'TreeMap is a balanced tree, so put walks one path of height log n.' },
  { ans: 'logn', code: 'boolean find(Node t, int k) {\n  if (t == null) return false;\n  if (k == t.val) return true;\n  return k < t.val ? find(t.left, k) : find(t.right, k);\n}', why: 'In a balanced search tree each step goes down one level, and there are log n levels.' },
  { ans: 'logn', code: 'priorityQueue.add(x);', why: 'A binary heap sifts the new item up at most log n levels.' },

  // linear
  { ans: 'n', code: 'for (int i = 0; i < n; i++) {\n  sum += a[i];\n}', why: 'One pass over the array.' },
  { ans: 'n', code: 'for (int i = 0; i < n; i += 2) {\n  sum += a[i];\n}', why: 'n / 2 steps is still O(n); constants drop.' },
  { ans: 'n', code: 'for (int i = 0; i < n; i++) {\n  max = Math.max(max, a[i]);\n}\nfor (int i = 0; i < n; i++) {\n  min = Math.min(min, a[i]);\n}', why: 'Two loops one after the other is n + n, which is O(n).' },
  { ans: 'n', code: 'for (int i = 0; i < n; i++) {\n  for (int j = 0; j < 5; j++) {\n    grid[i][j] = 0;\n  }\n}', why: 'The inner loop is a fixed 5 steps, so this is 5n.' },
  { ans: 'n', code: 'int i = 0, j = n - 1;\nwhile (i < j) {\n  if (a[i] + a[j] == target) return true;\n  if (a[i] + a[j] < target) i++;\n  else j--;\n}', why: 'Two pointers move toward each other; together they take at most n steps.' },
  { ans: 'n', code: 'for (int x : a) {\n  if (seen.contains(x)) return true;\n  seen.add(x);\n}', why: 'n constant-time HashSet operations.' },
  { ans: 'n', code: 'int f(int n) {\n  if (n == 0) return 0;\n  return n + f(n - 1);\n}', why: 'One call per value from n down to 0.' },
  { ans: 'n', code: 'StringBuilder sb = new StringBuilder();\nfor (int i = 0; i < n; i++) {\n  sb.append(\'x\');\n}', why: 'StringBuilder appends in amortized constant time.' },
  { ans: 'n', code: 'for (int i = 0; i < n; i++) {\n  for (int j = 0; j < n; j++) {\n    if (a[i] == j) count++;\n    break;\n  }\n}', why: 'The break ends the inner loop after one step every time.' },
  { ans: 'n', code: 'for (int i = n; i > 0; i /= 2) {\n  for (int j = 0; j < i; j++) {\n    count++;\n  }\n}', why: 'n + n/2 + n/4 + ... adds up to less than 2n.' },
  { ans: 'n', code: 'for (int i = 1; i < n; i *= 2) {\n  for (int j = 0; j < i; j++) {\n    count++;\n  }\n}', why: '1 + 2 + 4 + ... up to n adds up to less than 2n.' },
  { ans: 'n', code: 'int f(int n) {\n  if (n <= 1) return 1;\n  return f(n / 2) + f(n / 2);\n}', why: 'The call tree has about 2n nodes: doubling the calls cancels out halving n.' },
  { ans: 'n', code: 'void f(int n) {\n  if (n <= 1) return;\n  for (int i = 0; i < n; i++) work();\n  f(n / 2);\n}', why: 'n + n/2 + n/4 + ... is less than 2n.' },
  { ans: 'n', code: 'int memo(int n) {\n  if (n < 2) return n;\n  if (cache[n] != 0) return cache[n];\n  return cache[n] = memo(n - 1) + memo(n - 2);\n}', why: 'Each value is computed once and then read from the cache.' },
  { ans: 'n', code: 'Node cur = head;\nwhile (cur != null) {\n  cur = cur.next;\n}', why: 'Walks a linked list of n nodes once.' },
  { ans: 'n', code: 'return list.contains(x);', why: 'ArrayList.contains checks elements one by one.' },
  { ans: 'n', code: 'list.add(0, x);', why: 'Adding at the front shifts all n elements right.' },
  { ans: 'n', code: 'int i = 0, j = 0;\nwhile (i < a.length && j < b.length) {\n  if (a[i] < b[j]) out.add(a[i++]);\n  else out.add(b[j++]);\n}', why: 'Merging two sorted lists takes one step per element.' },
  { ans: 'n', code: 'int[] count = new int[26];\nfor (char c : s.toCharArray()) {\n  count[c - \'a\']++;\n}', why: 'One pass over the n characters.' },
  { ans: 'n', code: 'void dfs(Node t) {\n  if (t == null) return;\n  visit(t);\n  dfs(t.left);\n  dfs(t.right);\n}', why: 'Every node of the tree is visited once.' },
  { ans: 'n', code: 'for (int i = 0; i < n; i++) {\n  for (int j = i; j < i + 3 && j < n; j++) {\n    sum += a[j];\n  }\n}', why: 'The inner loop is at most 3 steps.' },
  { ans: 'n', code: 'String t = s.toUpperCase();', why: 'Builds a new string by visiting all n characters.' },
  { ans: 'n', code: 'void f(int n) {\n  if (n <= 0) return;\n  f(n - 2);\n}', why: 'n / 2 calls is still linear.' },

  // n log n
  { ans: 'nlogn', code: 'Arrays.sort(a);', why: 'Library sorts of n items are O(n log n).' },
  { ans: 'nlogn', code: 'Arrays.sort(a);\nfor (int i = 1; i < n; i++) {\n  if (a[i] == a[i - 1]) return true;\n}', why: 'The sort dominates: n log n + n is O(n log n).' },
  { ans: 'nlogn', code: 'for (int i = 0; i < n; i++) {\n  for (int j = 1; j < n; j *= 2) {\n    count++;\n  }\n}', why: 'n outer steps, each with a log n inner loop.' },
  { ans: 'nlogn', code: 'for (int i = 1; i < n; i *= 2) {\n  for (int j = 0; j < n; j++) {\n    count++;\n  }\n}', why: 'log n outer steps, each with an n inner loop.' },
  { ans: 'nlogn', code: 'void sort(int[] a, int lo, int hi) {\n  if (hi - lo < 1) return;\n  int mid = (lo + hi) / 2;\n  sort(a, lo, mid);\n  sort(a, mid + 1, hi);\n  merge(a, lo, mid, hi);\n}', why: 'Merge sort: log n levels of splitting, n work merging at each level.' },
  { ans: 'nlogn', code: 'for (int x : queries) {\n  Arrays.binarySearch(sorted, x);\n}', why: 'n binary searches at log n each. Here there are n queries.' },
  { ans: 'nlogn', code: 'for (int i = 0; i < n; i++) {\n  pq.add(a[i]);\n}\nwhile (!pq.isEmpty()) {\n  out.add(pq.poll());\n}', why: 'Heap sort: n adds and n polls at log n each.' },
  { ans: 'nlogn', code: 'for (int i = 0; i < n; i++) {\n  for (int j = n; j > 0; j /= 2) {\n    count++;\n  }\n}', why: 'n times a halving loop of log n steps.' },
  { ans: 'nlogn', code: 'for (int i = 1; i <= n; i++) {\n  for (int j = 0; j < n; j += i) {\n    count++;\n  }\n}', why: 'n/1 + n/2 + n/3 + ... is n times the harmonic series, about n log n.' },
  { ans: 'nlogn', code: 'for (int x : a) {\n  treeSet.add(x);\n}', why: 'n inserts into a balanced tree at log n each.' },
  { ans: 'nlogn', code: 'void f(int n) {\n  if (n <= 1) return;\n  for (int i = 0; i < n; i++) work();\n  f(n / 2);\n  f(n / 2);\n}', why: 'n work per level and log n levels, like merge sort.' },
  { ans: 'nlogn', code: 'Collections.sort(names);\nreturn names.get(0);', why: 'Sorting n names dominates the constant-time get.' },

  // quadratic
  { ans: 'n2', code: 'for (int i = 0; i < n; i++) {\n  for (int j = 0; j < n; j++) {\n    count++;\n  }\n}', why: 'n times n.' },
  { ans: 'n2', code: 'for (int i = 0; i < n; i++) {\n  for (int j = i + 1; j < n; j++) {\n    if (a[i] == a[j]) return true;\n  }\n}', why: 'Every pair: about n² / 2 checks, which is O(n²).' },
  { ans: 'n2', code: 'for (int i = 0; i < n; i++) {\n  for (int j = 0; j < i; j++) {\n    count++;\n  }\n}', why: '0 + 1 + 2 + ... + (n - 1) is about n² / 2.' },
  { ans: 'n2', code: 'for (int i = 0; i < n - 1; i++) {\n  for (int j = 0; j < n - 1 - i; j++) {\n    if (a[j] > a[j + 1]) swap(a, j, j + 1);\n  }\n}', why: 'Bubble sort compares nearly every pair.' },
  { ans: 'n2', code: 'for (int i = 0; i < n; i++) {\n  int min = i;\n  for (int j = i + 1; j < n; j++) {\n    if (a[j] < a[min]) min = j;\n  }\n  swap(a, i, min);\n}', why: 'Selection sort scans the rest of the array for every position.' },
  { ans: 'n2', code: 'for (int i = 1; i < n; i++) {\n  int j = i;\n  while (j > 0 && a[j - 1] > a[j]) {\n    swap(a, j, j - 1);\n    j--;\n  }\n}', why: 'Insertion sort\'s worst case (reversed input) shifts every item all the way back.' },
  { ans: 'n2', code: 'String s = "";\nfor (int i = 0; i < n; i++) {\n  s += "x";\n}', why: 'Each += copies the whole string so far: 1 + 2 + ... + n characters.' },
  { ans: 'n2', code: 'for (int x : a) {\n  if (!list.contains(x)) list.add(x);\n}', why: 'list.contains is O(n) and it runs n times.' },
  { ans: 'n2', code: 'while (!list.isEmpty()) {\n  list.remove(0);\n}', why: 'Each remove(0) shifts the rest of the ArrayList left.' },
  { ans: 'n2', code: 'for (int r = 0; r < n; r++) {\n  for (int c = 0; c < n; c++) {\n    grid[r][c] = r * c;\n  }\n}', why: 'An n by n grid has n² cells.' },
  { ans: 'n2', code: 'for (int i = 0; i < n; i++) {\n  for (int j = 0; j < n; j++) {\n    for (int k = 0; k < 8; k++) {\n      count++;\n    }\n  }\n}', why: 'The innermost loop is a constant 8, so this is 8n².' },
  { ans: 'n2', code: 'for (int i = 0; i < n; i++) {\n  System.out.println(s.indexOf(s.charAt(i)));\n}', why: 'indexOf scans up to n characters, n times.' },
  { ans: 'n2', code: 'int f(int n) {\n  if (n == 0) return 0;\n  for (int i = 0; i < n; i++) work();\n  return f(n - 1);\n}', why: 'n + (n - 1) + ... + 1 is about n² / 2.' },
  { ans: 'n2', code: 'for (int i = 0; i < n; i++) {\n  for (int j = 0; j < n; j++) {\n    if (i == j) continue;\n    check(i, j);\n  }\n}\nfor (int k = 0; k < n; k++) work();', why: 'The nested loops dominate the single loop after them.' },
  { ans: 'n2', code: 'for (int i = 0; i < n; i++) {\n  list.add(0, a[i]);\n}', why: 'Each add at the front shifts everything already in the list.' },
  { ans: 'n2', code: 'for (int len = 1; len <= n; len++) {\n  for (int i = 0; i + len <= n; i++) {\n    count++;\n  }\n}', why: 'Counts every substring position: about n² / 2.' },

  // exponential
  { ans: '2n', code: 'int fib(int n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}', why: 'Each call makes two more, and the tree is about n levels deep.' },
  { ans: '2n', code: 'void f(int n) {\n  if (n == 0) return;\n  f(n - 1);\n  f(n - 1);\n}', why: 'Two calls on n - 1 doubles the work at every level: 2ⁿ calls.' },
  { ans: '2n', code: 'void subsets(int i, List<Integer> cur) {\n  if (i == n) { print(cur); return; }\n  subsets(i + 1, cur);\n  cur.add(a[i]);\n  subsets(i + 1, cur);\n  cur.remove(cur.size() - 1);\n}', why: 'Every element is either in or out: 2ⁿ subsets.' },
  { ans: '2n', code: 'void hanoi(int n, int from, int to, int via) {\n  if (n == 0) return;\n  hanoi(n - 1, from, via, to);\n  move(from, to);\n  hanoi(n - 1, via, to, from);\n}', why: 'The Tower of Hanoi takes 2ⁿ - 1 moves.' },
  { ans: '2n', code: 'for (int mask = 0; mask < (1 << n); mask++) {\n  check(mask);\n}', why: '1 << n is 2ⁿ, one for every bitmask.' },
  { ans: '2n', code: 'boolean canSum(int i, int target) {\n  if (target == 0) return true;\n  if (i == n) return false;\n  return canSum(i + 1, target - a[i]) || canSum(i + 1, target);\n}', why: 'Without memoization, it tries taking or skipping every element.' },
  { ans: '2n', code: 'int ways(int n) {\n  if (n <= 1) return 1;\n  return ways(n - 1) + ways(n - 2);\n}', why: 'The same branching as naive Fibonacci.' },
  { ans: '2n', code: 'void bits(String s, int n) {\n  if (n == 0) { System.out.println(s); return; }\n  bits(s + "0", n - 1);\n  bits(s + "1", n - 1);\n}', why: 'Prints all 2ⁿ binary strings of length n.' },
];
