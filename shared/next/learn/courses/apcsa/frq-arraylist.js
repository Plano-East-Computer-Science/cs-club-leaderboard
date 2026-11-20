const REVIEW = String.raw`
class Review {
    private int rating;
    private String comment;

    public Review(int rating, String comment) {
        this.rating = rating;
        this.comment = comment;
    }

    public int getRating() {
        return rating;
    }

    public String getComment() {
        return comment;
    }
}
`;

const HEAD = String.raw`import java.util.ArrayList;

public class ReviewList {
    private ArrayList<Review> reviews;

    public ReviewList(ArrayList<Review> reviews) {
        this.reviews = reviews;
    }
`;

const PART_A = String.raw`
    /** Returns the average rating, or 0.0 if there are no reviews. */
    public double averageRating() {
        if (reviews.size() == 0) {
            return 0.0;
        }
        int sum = 0;
        for (Review r : reviews) {
            sum += r.getRating();
        }
        return (double) sum / reviews.size();
    }
`;

const HARNESS = String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        java.util.ArrayList<Review> list = new java.util.ArrayList<Review>();
        while (in.hasNextLine()) {
            String line = in.nextLine().trim();
            if (line.length() == 0) {
                continue;
            }
            int space = line.indexOf(" ");
            list.add(new Review(Integer.parseInt(line.substring(0, space)), line.substring(space + 1)));
        }
        ReviewList rl = new ReviewList(list);
        PART
    }
}
`;

export default {
  id: 'frq-arraylist',
  kind: 'frq',
  title: 'FRQ 3: data analysis with ArrayList',
  minutes: 25,
  summary: 'Practice the third free-response question: analyze and change an ArrayList of objects inside a class.',
  steps: [
    {
      kind: 'explain',
      title: 'How question 3 works',
      body: `Question 3, **Data Analysis with ArrayList**, gives you a class that holds an \`ArrayList\` of objects (each with getters) and asks you to write methods that compute something from the list or change it.

The rubric usually checks:

- **traversing** the whole list without going out of bounds,
- calling the right **getter** on each element (the list holds objects, so \`reviews.get(i)\` is a Review, not a number),
- the **algorithm**: sum, count, filter, maximum,
- for removal, that **no element is skipped**,
- and the **return** value, including an empty list.

Keep the ArrayList method names straight: \`size()\`, \`get(i)\`, \`add\`, \`remove(i)\`. Using \`length\` or brackets on an ArrayList costs points.`,
    },
    {
      kind: 'explain',
      title: 'The question',
      body: `A store keeps product reviews. Each \`Review\` has \`getRating()\` (1 to 5) and \`getComment()\`. The class \`ReviewList\` stores them:

\`\`\`java
public class ReviewList {
    private ArrayList<Review> reviews;
    ...
}
\`\`\`

**(a)** Write \`averageRating()\`, which returns the average rating as a double, or \`0.0\` if there are no reviews.

**(b)** Write \`removeSpam()\`, which removes every review whose comment contains \`"http"\` (they are ads) and returns the **number** of reviews removed. The remaining reviews stay in their original order.`,
    },
    {
      kind: 'exercise',
      title: 'Part (a): averageRating',
      body: 'Write `averageRating`. The constructor and the `Review` class are provided. Each input line is a rating followed by a comment.',
      starter: `${HEAD}
    /** Returns the average rating, or 0.0 if there are no reviews. */
    public double averageRating() {
        return 0.0;
    }
}
${REVIEW}`,
      solution: `${HEAD}${PART_A}}
${REVIEW}`,
      harness: HARNESS.replace('PART', 'System.out.println(rl.averageRating());'),
      tests: [
        { name: 'Several reviews', rubric: 'Accesses every Review and calls getRating on each', stdin: '5 great\n4 good\n2 meh\n', stdout: '3.6666666666666665\n' },
        { name: 'A whole-number average', rubric: 'Computes the average with double division', stdin: '5 love it\n4 nice\n', stdout: '4.5\n' },
        { name: 'One review', rubric: 'Works for a list of one', stdin: '3 fine\n', stdout: '3.0\n' },
        { name: 'No reviews', rubric: 'Returns 0.0 for an empty list instead of dividing by zero', stdin: '', stdout: '0.0\n' },
      ],
      hints: [
        'Loop over `reviews` and add `r.getRating()` for each Review `r`.',
        'Divide with a cast: `(double) sum / reviews.size()`.',
        'Check `reviews.size() == 0` before dividing and return 0.0 in that case.',
      ],
    },
    {
      kind: 'exercise',
      title: 'Part (b): removeSpam',
      body: 'Write `removeSpam`. Part (a) is written for you. The tester prints the count removed, then the comments that remain.',
      starter: `${HEAD}${PART_A}
    /** Removes every review whose comment contains "http"; returns how many were removed. */
    public int removeSpam() {
        return 0;
    }

    public String comments() {
        String out = "";
        for (Review r : reviews) {
            out += "[" + r.getComment() + "]";
        }
        return out;
    }
}
${REVIEW}`,
      solution: `${HEAD}${PART_A}
    /** Removes every review whose comment contains "http"; returns how many were removed. */
    public int removeSpam() {
        int removed = 0;
        for (int i = reviews.size() - 1; i >= 0; i--) {
            if (reviews.get(i).getComment().indexOf("http") >= 0) {
                reviews.remove(i);
                removed++;
            }
        }
        return removed;
    }

    public String comments() {
        String out = "";
        for (Review r : reviews) {
            out += "[" + r.getComment() + "]";
        }
        return out;
    }
}
${REVIEW}`,
      harness: HARNESS.replace('PART', 'System.out.println(rl.removeSpam() + " " + rl.comments());'),
      tests: [
        { name: 'One spam review', rubric: 'Calls getComment and checks for "http" on every review', stdin: '5 great\n1 buy now http://x.co\n4 good\n', stdout: '1 [great][good]\n' },
        { name: 'Two spam reviews in a row', rubric: 'Removes consecutive matches without skipping any', stdin: '1 http://a\n1 http://b\n5 real\n', stdout: '2 [real]\n' },
        { name: 'Spam at the end', rubric: 'Checks the last element', stdin: '4 ok\n2 see https://spam\n', stdout: '1 [ok]\n' },
        { name: 'No spam', rubric: 'Returns 0 and leaves the list unchanged', stdin: '3 fine\n4 nice\n', stdout: '0 [fine][nice]\n' },
      ],
      hints: [
        'A comment contains "http" when `comment.indexOf("http") >= 0`.',
        'Removing while looping forwards skips the element after each removal. Loop from `reviews.size() - 1` down to 0.',
        'Count each removal in a local variable and return it after the loop.',
      ],
    },
    {
      kind: 'check',
      title: 'Object or number?',
      prompt: 'Inside `averageRating`, which line correctly adds the rating of the review at index `i`?',
      options: [
        { text: '`sum += reviews.get(i).getRating();`', correct: true, why: '`get(i)` returns a Review object; calling its getter gives the int rating.' },
        { text: '`sum += reviews.get(i);`', why: '`reviews.get(i)` is a Review, not a number. This does not compile.' },
        { text: '`sum += reviews[i].getRating();`', why: 'Brackets are for arrays. An ArrayList uses `get(i)`.' },
        { text: '`sum += reviews.get(i).rating;`', why: '`rating` is private in Review, so other classes must use `getRating()`.' },
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Elements of an ArrayList of objects need a getter: `list.get(i).getX()`.',
        'Guard against an empty list before dividing.',
        'Remove matches with a backward indexed loop, and count as you go.',
        'Use `size()`, `get`, `remove`; never `length` or brackets on a list.',
      ],
      mistakes: [
        'Treating a list element as the number inside it.',
        'Reading a private field of another class directly.',
        'Forward removal loops that skip consecutive matches.',
        'Integer division in an average.',
      ],
    },
  ],
};
