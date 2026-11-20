const PART_A = String.raw`public class PasswordChecker {
    /** Returns the number of characters in pw that are digits 0 to 9. */
    public static int countDigits(String pw) {
        int count = 0;
        for (int i = 0; i < pw.length(); i++) {
            if ("0123456789".indexOf(pw.substring(i, i + 1)) >= 0) {
                count++;
            }
        }
        return count;
    }
`;

export default {
  id: 'frq-methods-control',
  kind: 'frq',
  title: 'FRQ 1: methods and control structures',
  minutes: 25,
  summary: 'Practice the first free-response question: write two methods with loops and conditions, graded point by point like the real rubric.',
  steps: [
    {
      kind: 'explain',
      title: 'How question 1 works',
      body: `The exam has four free-response questions, about 22 minutes each. Question 1, **Methods and Control Structures**, describes a small class and asks you to write one or two methods using loops, if statements, String methods and calls to other methods.

It is graded with a **rubric**: a list of points, each for one specific thing your code must do, such as "accesses every character of the string" or "returns the correct value in all cases". Points are independent, so a method with one bug can still earn most of its points.

What graders reward:

- **Call the methods you are given** instead of rewriting them. In part (b), assume part (a) works, even if you skipped it.
- **Return** when the question says returns; never print instead.
- Handle the edge cases the description mentions.

Small syntax slips, like a missing semicolon, usually cost nothing. Wrong logic, wrong bounds and printing instead of returning do.`,
    },
    {
      kind: 'explain',
      title: 'The question',
      body: `A website rates passwords. You will write two static methods of the class \`PasswordChecker\`.

**(a)** Write \`countDigits(String pw)\`, which returns the number of characters in \`pw\` that are digits \`0\` to \`9\`. For \`"tiger42go7"\` it returns \`3\`.

**(b)** Write \`strength(String pw)\`, which returns:

- \`"strong"\` if \`pw\` has at least 12 characters **and** at least 2 digits,
- \`"medium"\` if it is not strong but has at least 8 characters **and** at least 1 digit,
- \`"weak"\` otherwise.

You must call \`countDigits\` in part (b).

A useful trick for (a): \`"0123456789".indexOf(c)\` is at least 0 exactly when the one-character string \`c\` is a digit.`,
    },
    {
      kind: 'exercise',
      title: 'Part (a): countDigits',
      body: 'Write `countDigits`. The tests are named after the rubric points they check.',
      starter: String.raw`public class PasswordChecker {
    /** Returns the number of characters in pw that are digits 0 to 9. */
    public static int countDigits(String pw) {
        return 0;
    }
}
`,
      solution: `${PART_A}}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        while (in.hasNextLine()) {
            String pw = in.nextLine();
            if (pw.equals("<empty>")) {
                pw = "";
            }
            System.out.println(PasswordChecker.countDigits(pw));
        }
    }
}
`,
      tests: [
        { name: 'Digits mixed with letters', rubric: 'Accesses every character of the string, including the first and the last', stdin: '4tiger42go7\n', stdout: '4\n' },
        { name: 'No digits', rubric: 'Checks whether each character is a digit, and counts only digits', stdin: 'password\n', stdout: '0\n' },
        { name: 'All digits', rubric: 'Counts every match, not just whether one exists', stdin: '2026\n', stdout: '4\n' },
        { name: 'Empty password', rubric: 'Returns the count (0 when there is nothing to count) without crashing', stdin: '<empty>\n', stdout: '0\n' },
      ],
      hints: [
        'Loop `i` from 0 while `i < pw.length()` and take `pw.substring(i, i + 1)`.',
        'A character `c` is a digit when `"0123456789".indexOf(c) >= 0`.',
        'Return the count after the loop ends, not inside it.',
      ],
    },
    {
      kind: 'exercise',
      title: 'Part (b): strength',
      body: 'Write `strength`. Part (a) is already written for you; call it instead of counting digits again.',
      starter: `${PART_A}
    public static String strength(String pw) {
        return "weak";
    }
}
`,
      solution: `${PART_A}
    public static String strength(String pw) {
        int digits = countDigits(pw);
        if (pw.length() >= 12 && digits >= 2) {
            return "strong";
        } else if (pw.length() >= 8 && digits >= 1) {
            return "medium";
        }
        return "weak";
    }
}
`,
      harness: String.raw`class Grader {
    public static void main(String[] args) {
        java.util.Scanner in = new java.util.Scanner(System.in);
        while (in.hasNextLine()) {
            System.out.println(PasswordChecker.strength(in.nextLine()));
        }
    }
}
`,
      tests: [
        { name: 'Strong', rubric: 'Returns "strong" when length is at least 12 and there are at least 2 digits', stdin: 'correcthorse42\n', stdout: 'strong\n' },
        { name: 'Long but only one digit', rubric: 'Checks the strong conditions together with && and falls through to medium', stdin: 'correcthorse4\n', stdout: 'medium\n' },
        { name: 'Exactly 8 with a digit', rubric: 'Uses >= at the boundaries (8 characters, 1 digit)', stdin: 'abcdefg1\n', stdout: 'medium\n' },
        { name: 'Long with no digits', rubric: 'Returns "weak" when neither rule holds', stdin: 'abcdefghijklmnop\n', stdout: 'weak\n' },
        { name: 'Short with digits', rubric: 'Requires the length as well as the digits', stdin: 'ab12\n', stdout: 'weak\n' },
      ],
      hints: [
        'Call `countDigits(pw)` once and store the result in a variable.',
        'Check strong first, then medium, with an else-if, so a strong password is not reported as medium.',
        'Each rule needs both conditions joined with `&&`, and the boundaries use `>=`.',
      ],
    },
    {
      kind: 'check',
      title: 'Where points go missing',
      prompt: 'A student\'s part (b) prints the correct word with `System.out.println` and has return type `void`. How is it scored?',
      options: [
        { text: 'It loses the return point even though the word on screen is right', correct: true, why: 'The question says the method returns a String. Printing gives the caller nothing to use, and the rubric checks the returned value.' },
        { text: 'Full credit, because the output is correct', why: 'Rubrics score what the method returns. Printing is not returning.' },
        { text: 'Zero for the whole question', why: 'Rubric points are independent. The checks for calling countDigits and the conditions can still be earned.' },
        { text: 'Full credit if it also calls countDigits', why: 'Calling countDigits earns its own point, but the return point is still lost.' },
      ],
    },
    {
      kind: 'recap',
      takeaways: [
        'Read the whole question first and underline "returns", the boundaries and the edge cases.',
        'Call the methods you are given, and in part (b) call part (a).',
        'Check the most specific case first in an else-if chain.',
        'Return after the loop finishes when you need every element.',
      ],
      mistakes: [
        'Printing instead of returning.',
        'Rewriting the digit-counting loop in part (b) instead of calling part (a).',
        'Using `>` where the question says "at least".',
        'Returning inside the loop after the first character.',
      ],
    },
  ],
};
