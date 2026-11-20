/**
 * Plain-English explanations for the compiler and run-time errors beginners
 * hit most. `explainError(text)` takes javac output or a stack trace and
 * returns the explanations that apply, most specific first.
 */
const RULES = [
  [/cannot find symbol/i, 'Java does not know a name you used. Check the spelling and capital letters (`string` is not `String`), that the variable was declared above this line and inside the same braces, and that the method exists with exactly that name.'],
  [/';' expected/i, 'A statement is missing its semicolon. Java usually points at the line after the real problem, so look at the end of the line above too.'],
  [/possible lossy conversion from double to int/i, 'You are putting a `double` into an `int`, which would drop the decimal part. If that is what you want, cast it: `(int) x`. Otherwise make the variable a `double`.'],
  [/possible lossy conversion/i, 'You are storing a value in a type that is too small to hold it. Use a wider type or cast on purpose.'],
  [/incompatible types: String cannot be converted to (int|double)/i, 'Text and numbers are different types. To turn text like "42" into a number use `Integer.parseInt(s)` or `Double.parseDouble(s)`, or read it with `nextInt()`.'],
  [/incompatible types: (int|double|boolean) cannot be converted to String/i, 'A number is not a `String`. Join it to a string with `"" + x` if you need text.'],
  [/incompatible types: int cannot be converted to boolean/i, 'A condition needs a true or false value. You probably wrote `=` (assign) where you meant `==` (compare).'],
  [/incompatible types/i, 'A value of one type is being used where Java expects another type. Compare the declared type of the variable or return type with what you are giving it.'],
  [/missing return statement/i, 'Your method promises to return a value, but some path through it reaches the end without a `return`. Make sure every branch returns, often with a `return` after the loop.'],
  [/unexpected return value/i, 'A `void` method cannot return a value. Either remove the value from `return`, or change `void` to the type you want to return.'],
  [/reached end of file while parsing/i, 'A `{` was never closed. Count your braces: every `{` needs a matching `}`.'],
  [/class, interface, enum, or record expected/i, 'There is code outside of a class, usually because of an extra `}` that closed the class too early.'],
  [/illegal start of (expression|type)/i, 'Java found something it did not expect here. Often a missing `}` above, a method written inside another method, or a stray symbol.'],
  [/unclosed string literal/i, 'A string is missing its closing `"`. Strings must start and end on the same line.'],
  [/might not have been initialized/i, 'You used a variable before giving it a value. Give it a starting value when you declare it, or make sure every path assigns it first.'],
  [/is already defined/i, 'You declared the same variable name twice in the same scope. Declare it once, then just assign to it (no type in front).'],
  [/non-static (method|variable) .* cannot be referenced from a static context/i, '`main` is static, so it cannot use instance methods or variables directly. Create an object and call the method on it, or make the method `static`.'],
  [/cannot be applied to given types|no suitable (method|constructor) found/i, 'The arguments you passed do not match the method or constructor parameters. Check how many there are, their types, and their order.'],
  [/bad operand types for binary operator/i, 'That operator does not work with those types, for example `&&` on numbers or `<` on Strings. Strings are compared with `.equals` and `.compareTo`.'],
  [/'else' without 'if'/i, 'An `else` has no `if` right before it. Usually a stray semicolon after `if (...)` or a missing brace.'],
  [/unreachable statement/i, 'This line can never run, usually because it comes right after a `return` or `break`.'],
  [/not a statement/i, 'This line computes something but does nothing with it. Did you mean to assign it, print it, or use `==` inside an `if`?'],
  [/No main method found/i, 'Java starts at `public static void main(String[] args)`. Keep the main method from the starter code.'],
  [/ArrayIndexOutOfBoundsException/, 'Your code used an array index that does not exist. Valid indexes go from 0 to `length - 1`; check loop bounds such as `i <= arr.length`, which should be `i < arr.length`.'],
  [/StringIndexOutOfBoundsException/, 'A `substring` or index went past the end of the string. Indexes go from 0 to `length() - 1`, and `substring(a, b)` needs `b <= length()`.'],
  [/IndexOutOfBoundsException/, 'An ArrayList index does not exist. Valid indexes go from 0 to `size() - 1`, and the list shrinks when you remove.'],
  [/NullPointerException/, 'You called a method or used a field on `null`, a variable that does not point to any object yet. Find which variable is null and create its object with `new` first.'],
  [/ArithmeticException/, 'Integer division by zero. Check the divisor before dividing.'],
  [/InputMismatchException/, 'The input did not match what you asked for, for example `nextInt()` when the next word is not a whole number.'],
  [/NoSuchElementException/, 'Your program tried to read more input than there is. Read exactly as many values as the input gives, or check with `hasNext()` first.'],
  [/ConcurrentModificationException/, 'You added or removed items from an ArrayList while walking through it with an enhanced for loop. Use an indexed loop instead.'],
  [/StackOverflowError/, 'A method called itself too many times. A recursive method needs a base case that stops it, and each call must move closer to it.'],
  [/ClassCastException/, 'An object was cast to a type it is not.'],
  [/took longer than|infinite loop/i, 'Your program did not finish in time. Look for a loop whose condition never becomes false, for example a missing `i++`.'],
];

export function explainError(text) {
  const t = String(text || '');
  const out = [];
  for (const [re, help] of RULES) if (re.test(t) && !out.includes(help)) out.push(help);
  // "IndexOutOfBounds" matches the array and string versions too; keep only the most specific.
  if (out.length > 1 && /ArrayIndex|StringIndex/.test(t)) return out.filter((h) => !h.startsWith('An ArrayList index'));
  return out;
}
