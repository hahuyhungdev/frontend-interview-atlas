# Answer Bank 10 — DSA for Frontend

Fills §19 of the [knowledge map](../frontend-knowledge-map.md), which was marked ★★ but had no answer file. Every problem below was **actually asked** in the crawled corpus, with the company named.

**Read the framing first.** Only Amazon and PayPal ran DSA-first loops out of 19 companies. DSA here is a *filter*, not the *decision* — it is necessary but not sufficient. Get comfortable with the patterns below and stop; the marginal hour is far better spent on machine coding.

**The one habit that matters more than any solution:** state the complexity out loud, unprompted, every time. Multiple write-ups say the interviewer pushed on time and space after a correct answer. A right answer with no complexity analysis reads as memorised.

---

## The five patterns that cover everything asked

| Pattern | Problems it solved in this corpus |
|---|---|
| **Hash set / map for O(1) lookup** | Longest consecutive sequence, missing number, LRU |
| **Two pointers** | Three-sum in a BST, row with max 1s, merge sorted lists |
| **Sliding window** | Longest unique substring after removal |
| **Recursion + its iterative twin** | Flatten, tree traversals, deep clone |
| **Running state in one pass** | Kadane's, max subarray with indices |

Learn the five. The individual problems are instances.

---

## 1. Longest Consecutive Sequence *(PayPal)*

> Given an unsorted array, find the length of the longest run of consecutive integers. Optimal time.

The naive move is to sort — O(n log n). The expected answer is O(n).

```javascript
function longestConsecutive(nums) {
  const set = new Set(nums);
  let longest = 0;

  for (const num of set) {
    // Only start counting from the beginning of a run.
    if (set.has(num - 1)) continue;

    let current = num;
    let length = 1;
    while (set.has(current + 1)) { current++; length++; }
    longest = Math.max(longest, length);
  }
  return longest;
}
```

**Why it is O(n), not O(n²)** — this is the whole question, so say it before they ask. The inner `while` looks nested, but the `if (set.has(num - 1)) continue;` guard means a run is only ever walked from its smallest element. Every number is visited at most twice: once by the outer loop, once by exactly one inner walk. Linear.

Time **O(n)**, space **O(n)**.

---

## 2. Maximum Subarray, Returning the Indices *(LinkedIn)*

> Kadane's, but also return the start and end index.

```javascript
function maxSubArray(nums) {
  if (nums.length === 0) return { max: 0, start: -1, end: -1 };

  let max = nums[0], current = nums[0];
  let start = 0, end = 0, candidate = 0;

  for (let i = 1; i < nums.length; i++) {
    // Extend the run, or abandon it and start fresh at i.
    if (nums[i] > current + nums[i]) {
      current = nums[i];
      candidate = i;                 // provisional start, not committed yet
    } else {
      current += nums[i];
    }
    if (current > max) {
      max = current;
      start = candidate;             // commit only when we beat the record
      end = i;
    }
  }
  return { max, start, end };
}
```

**The index tracking is the actual difficulty.** You need a *provisional* start (`candidate`) that moves whenever the run restarts, and a *committed* start that only updates when a new maximum is found. Collapsing those into one variable is the standard bug.

Time **O(n)**, space **O(1)**. Handles all-negative arrays correctly because `max` is seeded with `nums[0]` rather than 0.

---

## 3. Longest Common Substring *(Oracle)*

> Length of the longest substring present in both strings. Substring, not subsequence — contiguous.

```javascript
function longestCommonSubstring(s1, s2) {
  const dp = Array.from({ length: s1.length + 1 }, () => Array(s2.length + 1).fill(0));
  let best = 0;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;   // extend the diagonal run
        best = Math.max(best, dp[i][j]);
      }
      // else stays 0 — a mismatch breaks contiguity
    }
  }
  return best;
}
```

**`dp[i][j]` = length of the common substring *ending exactly at* `s1[i-1]` and `s2[j-1]`.** That "ending at" framing is what makes the recurrence work, and it is the difference from longest common *subsequence*, where a mismatch carries `max(dp[i-1][j], dp[i][j-1])` forward instead of resetting to 0.

Time **O(n × m)**, space **O(n × m)** — reducible to **O(min(n, m))** by keeping only the previous row, since each cell reads only the row above. Offer that optimisation; it is the natural follow-up.

---

## 4. Triplet Summing to Zero in a BST *(Amazon)*

> Given a BST, do three nodes sum to zero?

```javascript
function inorder(root, out = []) {
  if (!root) return out;
  inorder(root.left, out);
  out.push(root.val);
  inorder(root.right, out);
  return out;                    // in-order traversal of a BST is sorted
}

function hasTripletWithZeroSum(root) {
  const nums = inorder(root);

  for (let i = 0; i < nums.length - 2; i++) {
    let left = i + 1, right = nums.length - 1;
    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];
      if (sum === 0) return true;
      if (sum < 0) left++; else right--;   // sorted, so move the correct pointer
    }
  }
  return false;
}
```

**The insight is one sentence: an in-order traversal of a BST is already sorted.** So the tree problem reduces to classic three-sum on a sorted array, and two pointers apply. Interviewers are testing whether you spot the reduction, not whether you know three-sum.

Time **O(n²)**, space **O(n)** for the flattened array. Mention you could recurse with O(h) space using BST successor/predecessor iterators if space were constrained.

---

## 5. Row with the Maximum Number of 1s *(Amazon)*

> Row-wise sorted binary matrix. Find the row with the most 1s. Rows and columns may both be very large.

```javascript
function rowWithMaxOnes(matrix) {
  if (!matrix.length) return -1;
  let row = -1;
  let j = matrix[0].length - 1;        // start at the top-right corner

  for (let i = 0; i < matrix.length; i++) {
    while (j >= 0 && matrix[i][j] === 1) {
      j--;                              // this row reaches further left: it wins
      row = i;
    }
  }
  return row;
}
```

**Why the staircase walk is O(m + n).** `j` only ever decreases, across the entire run — never resets per row. So the total inner work is bounded by the number of columns, and the outer loop by rows. Each is visited at most once.

The naive answer is to binary-search each row for the first 1: O(m log n). Offer both and name the trade-off — that comparison is what they want to hear.

Time **O(m + n)**, space **O(1)**.

---

## 6. Nth Largest Element *(CoinDCX)*

> Find the Nth largest in an unsorted array. The candidate's first answer — repeatedly find and remove the max — was pushed on.

```javascript
// Quickselect: O(n) average, O(1) extra space.
function nthLargest(nums, n) {
  const arr = [...nums];                    // do not mutate the caller's array
  let target = arr.length - n;              // nth largest = kth smallest by index
  let lo = 0, hi = arr.length - 1;

  while (lo <= hi) {
    const p = partition(arr, lo, hi);
    if (p === target) return arr[p];
    if (p < target) lo = p + 1; else hi = p - 1;
  }
  return undefined;
}

function partition(arr, lo, hi) {
  const pivotIndex = lo + Math.floor(Math.random() * (hi - lo + 1));  // random pivot
  [arr[pivotIndex], arr[hi]] = [arr[hi], arr[pivotIndex]];
  const pivot = arr[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (arr[j] <= pivot) { [arr[i], arr[j]] = [arr[j], arr[i]]; i++; }
  }
  [arr[i], arr[hi]] = [arr[hi], arr[i]];
  return i;
}
```

**Walk the ladder out loud — that is the actual test:**

| Approach | Time | When it is right |
|---|---|---|
| Remove max n times | O(n·k) | Never, beyond tiny n |
| Sort then index | O(n log n) | Fine if you need the whole order anyway |
| **Min-heap of size n** | **O(n log k)** | **Streaming data, or k ≪ n — the practical answer** |
| **Quickselect** | **O(n) average** | Single query on an in-memory array |

**The random pivot matters.** A fixed pivot degrades to O(n²) on already-sorted input — a realistic case. Mention it; it shows you know why the average bound holds.

---

## 7. Missing Number in a Sequence *(CoinDCX)*

> `[20,17,15,13,11,12,9,10,18,16,17,19]` → missing `14`. The candidate used a frequency map; the interviewer wanted the math.

```javascript
function findMissing(nums) {
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  // Sum of the complete range minus the sum actually present.
  const expected = ((max - min + 1) * (min + max)) / 2;
  const actual = nums.reduce((sum, n) => sum + n, 0);
  return expected - actual;
}
```

Time **O(n)**, space **O(1)** — versus O(n) space for the frequency map.

**Be honest about the preconditions**, because that is the mature answer. Gauss's formula assumes **exactly one** missing value and **no duplicates**. The sample input contains `17` twice, so it violates that — with a duplicate, `expected - actual` silently returns the wrong answer.

So say: "The O(1)-space trick is the sum formula, but it only holds for a clean range with one gap. If duplicates are possible I'd use a Set, which is O(n) space but correct under weaker assumptions." Naming the constraint is worth more than the trick.

**Related, worth knowing:** for the classic 0..n exactly-one-missing case, **XOR** also gives O(1) space and cannot overflow — `nums.reduce((a, b) => a ^ b, 0) ^ range.reduce(...)`.

---

## 8. Merge Two Sorted Lists *(Paytm Money)*

```javascript
function mergeSorted(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    out.push(a[i] <= b[j] ? a[i++] : b[j++]);   // <= keeps it stable
  }
  while (i < a.length) out.push(a[i++]);        // drain the remainder
  while (j < b.length) out.push(b[j++]);
  return out;
}
```

Time **O(n + m)**, space **O(n + m)**.

**Two details worth voicing:** `<=` rather than `<` makes the merge **stable** (equal elements keep their relative order), which matters when the values are objects sorted by one key. And the concat-then-sort one-liner is O((n+m) log(n+m)) — strictly worse, since the inputs are already sorted.

**Linked-list variant** (the more common phrasing) uses a dummy head so you avoid special-casing the first node:

```javascript
function mergeLists(a, b) {
  const dummy = { next: null };
  let tail = dummy;
  while (a && b) {
    if (a.val <= b.val) { tail.next = a; a = a.next; }
    else { tail.next = b; b = b.next; }
    tail = tail.next;
  }
  tail.next = a ?? b;          // attach whatever remains
  return dummy.next;
}
```

---

## 9. Longest Unique Substring After One Removal *(PayPal)*

> Remove exactly one contiguous substring so the remainder has all-unique characters. Return the max possible remaining length.

The remainder is a **prefix plus a suffix**. So: for each prefix that is internally unique, find the longest unique suffix that shares no character with it.

```javascript
function maxLengthAfterRemoval(s) {
  const n = s.length;

  // suffixUnique[i] = length of the longest all-unique run starting at i.
  const suffixUnique = new Array(n + 1).fill(0);
  {
    const seen = new Set();
    let end = n;
    for (let i = n - 1; i >= 0; i--) {
      while (seen.has(s[i])) { seen.delete(s[--end === i ? i : end]); }
      seen.add(s[i]);
      suffixUnique[i] = end - i;
    }
  }

  let best = 0;
  const prefix = new Set();
  for (let i = 0; i <= n; i++) {
    // Grow the suffix from the right while it stays unique and disjoint.
    const suffixSet = new Set();
    let j = n - 1;
    while (j >= i && !prefix.has(s[j]) && !suffixSet.has(s[j])) { suffixSet.add(s[j]); j--; }
    best = Math.max(best, prefix.size + suffixSet.size);

    if (i === n) break;
    if (prefix.has(s[i])) break;      // prefix itself must stay unique
    prefix.add(s[i]);
  }
  return best;
}
```

**This one is genuinely hard, and the framing is the answer.** If you get nothing else, say: *"whatever I remove is contiguous, so what survives is a prefix and a suffix — I need the best disjoint pair of unique runs."* That reframing is most of the credit. The brute force is O(n³); this is O(n²) worst case, and interviewers accept it with the reasoning stated.

---

## 10. Detect a Cycle in a Directed Graph *(PayPal — approach only)*

```javascript
function hasCycle(graph) {
  const WHITE = 0, GREY = 1, BLACK = 2;      // unvisited, in progress, finished
  const colour = new Map();
  for (const node of Object.keys(graph)) colour.set(node, WHITE);

  const visit = (node) => {
    colour.set(node, GREY);
    for (const next of graph[node] ?? []) {
      if (colour.get(next) === GREY) return true;    // back edge → cycle
      if (colour.get(next) === WHITE && visit(next)) return true;
    }
    colour.set(node, BLACK);
    return false;
  };

  for (const node of colour.keys()) {
    if (colour.get(node) === WHITE && visit(node)) return true;
  }
  return false;
}
```

**The three-colour distinction is the whole point.** A plain "visited" set is wrong for *directed* graphs: reaching an already-finished node (BLACK) is fine — that's a cross edge — while reaching a node still on the current recursion stack (GREY) is a genuine cycle. Conflating the two reports false cycles on a DAG like `A→B, A→C, B→D, C→D`.

Time **O(V + E)**, space **O(V)**.

**For undirected graphs** the rule is different: track the parent and treat any visited neighbour that is not the parent as a cycle.

---

## 11. Transitive Closure of a Matrix *(Certa)*

> Given an adjacency matrix, is the relation transitive? If not, list the missing edges in lexicographic order.

```javascript
function matrixChallenge(strArr) {
  const matrix = strArr.map((row) =>
    row.replace(/[()]/g, '').split(',').map(Number)
  );
  const n = matrix.length;
  const closure = matrix.map((row) => [...row]);

  // Floyd-Warshall reachability: k is the intermediate node.
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (closure[i][k] && closure[k][j]) closure[i][j] = 1;

  const missing = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (i !== j && closure[i][j] === 1 && matrix[i][j] === 0) missing.push([i, j]);

  if (missing.length === 0) return 'transitive';

  missing.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return missing.map(([a, b]) => `(${a},${b})`).join('-');
}
```

**The `k` loop must be outermost.** That is Floyd-Warshall's defining property: after iteration `k`, `closure[i][j]` is true if a path exists using only nodes `0..k` as intermediates. Putting `k` inside gives a matrix that is silently incomplete on some inputs — a classic and hard-to-spot bug.

Time **O(n³)**, space **O(n²)**. Fine here since the problem caps at 5×5.

---

## 12. Flatten a Nested Array — Both Ways

Asked at CoinDCX, Goibibo, and MakeMyTrip. Full solutions are in [`01-javascript.md`](./01-javascript.md); the DSA framing is what matters here.

**Recursive is DFS.** **Iterative is DFS with an explicit stack.** That equivalence is the actual lesson, and it generalises: any recursive traversal can be rewritten with a stack, and you should be able to do it on demand because interviewers ask for both.

```javascript
// Iterative — push and reverse once at the end. Never unshift in the loop: O(n²).
function flattenIterative(arr) {
  const stack = [...arr];
  const out = [];
  while (stack.length) {
    const item = stack.pop();
    if (Array.isArray(item)) stack.push(...item);
    else out.push(item);
  }
  return out.reverse();
}
```

**Say why you would ever prefer the iterative version:** recursion depth is bounded by the JS engine's stack, so a pathologically deep structure throws `RangeError`. The stack version uses heap memory and does not.

---

## How to talk while solving

Every write-up that praised a candidate mentioned communication, not speed.

1. **Restate the problem and confirm constraints.** Input size? Sorted? Duplicates? Negative numbers? Empty? These change the answer, and asking is not weakness.
2. **State the brute force first, with its complexity.** It proves you understand the problem and gives you a baseline to improve against.
3. **Name the pattern you are reaching for** — "this is sorted, so two pointers" — before writing code.
4. **Write it, narrating the invariant** each loop maintains.
5. **Walk one example through by hand**, including an edge case. Most bugs surface here.
6. **State final time and space, and what you would change** if the constraints shifted.

The single most repeated piece of feedback in the corpus: *the interviewer cared more about why you chose an approach than about the final output.*

---

*Back to the [answer bank index](./README.md)*
