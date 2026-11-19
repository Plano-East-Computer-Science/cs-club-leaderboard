/**
 * Source preparation for the in-browser Java runner (TeaVM's javac compiled
 * to WebAssembly, see docs/v3c-java-ide.md).
 *
 * TeaVM's class library has no java.util.Scanner, its System.in always
 * throws EOF, InputStreamReader pulls in code that will not build for
 * WebAssembly, and System.exit does not exist. So before compiling we:
 *  - blank the imports of those classes (same length, spaces only),
 *  - rewrite `System.in` and `System.exit` to our own `$Stdin` (same length),
 *  - append small replacements (Scanner, InputStreamReader, ...) after the
 *    student's last line. A top-level class in the file shadows `java.util.*`
 *    and `java.io.*`, so their code compiles unchanged.
 * Every edit keeps each line's length, so javac's line and column numbers
 * point at the student's own text with no mapping.
 *
 * Pure functions only: the worker and the tests both import this file.
 */

const PRELUDE = `
final class $Exit extends Error { }
final class $Stdin {
  static String data = "";
  static int status;
  static final java.io.InputStream in = new java.io.InputStream() {
    private byte[] bytes;
    private int pos;
    public int read() {
      if (bytes == null) bytes = $Stdin.utf8(data);
      return pos < bytes.length ? (bytes[pos++] & 0xff) : -1;
    }
  };
  static void exit(int code) { status = code; throw new $Exit(); }
  static byte[] utf8(String s) {
    java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
    for (int i = 0; i < s.length(); i++) {
      int c = s.charAt(i);
      if (Character.isHighSurrogate((char) c) && i + 1 < s.length()) c = Character.toCodePoint((char) c, s.charAt(++i));
      if (c < 0x80) out.write(c);
      else if (c < 0x800) { out.write(0xc0 | c >> 6); out.write(0x80 | c & 63); }
      else if (c < 0x10000) { out.write(0xe0 | c >> 12); out.write(0x80 | c >> 6 & 63); out.write(0x80 | c & 63); }
      else { out.write(0xf0 | c >> 18); out.write(0x80 | c >> 12 & 63); out.write(0x80 | c >> 6 & 63); out.write(0x80 | c & 63); }
    }
    return out.toByteArray();
  }
  static String slurp(java.io.Reader r) {
    StringBuilder sb = new StringBuilder();
    try { int c; while ((c = r.read()) >= 0) sb.append((char) c); } catch (java.io.IOException e) { }
    return sb.toString();
  }
}
class InputMismatchException extends java.util.NoSuchElementException {
  InputMismatchException(String s) { super(s); }
}
class InputStreamReader extends java.io.Reader {
  private final java.io.InputStream in;
  InputStreamReader(java.io.InputStream in) { this.in = in; }
  InputStreamReader(java.io.InputStream in, Object charset) { this.in = in; }
  private int pending = -1;
  private int readCodeUnit() throws java.io.IOException {
    if (pending >= 0) { int p = pending; pending = -1; return p; }
    int b = in.read();
    if (b < 0x80) return b;
    int n = b >= 0xf0 ? 3 : b >= 0xe0 ? 2 : 1;
    int cp = b & (0x3f >> n);
    for (int i = 0; i < n; i++) cp = cp << 6 | (in.read() & 63);
    if (cp < 0x10000) return cp;
    pending = Character.lowSurrogate(cp);
    return Character.highSurrogate(cp);
  }
  public int read(char[] buf, int off, int len) throws java.io.IOException {
    int n = 0;
    while (n < len) {
      int c = readCodeUnit();
      if (c < 0) break;
      buf[off + n++] = (char) c;
      if (c == '\\n') break;
    }
    return n == 0 && len > 0 ? -1 : n;
  }
  public void close() { }
}
class Scanner implements java.io.Closeable {
  private java.io.Reader source;
  private String buf;
  private int pos;
  Scanner(java.io.InputStream in) { source = new InputStreamReader(in); }
  Scanner(java.io.Reader in) { source = in; }
  Scanner(String s) { buf = s; }
  private String text() { if (buf == null) { buf = $Stdin.slurp(source); source = null; } return buf; }
  private int tokenStart() {
    String t = text(); int i = pos;
    while (i < t.length() && Character.isWhitespace(t.charAt(i))) i++;
    return i;
  }
  private int tokenEnd(int i) {
    String t = text();
    while (i < t.length() && !Character.isWhitespace(t.charAt(i))) i++;
    return i;
  }
  private String peek() { int s = tokenStart(); return s < text().length() ? text().substring(s, tokenEnd(s)) : null; }
  public boolean hasNext() { return peek() != null; }
  public String next() {
    int s = tokenStart();
    if (s >= text().length()) throw new java.util.NoSuchElementException();
    pos = tokenEnd(s);
    return text().substring(s, pos);
  }
  private String token() {
    String t = peek();
    if (t == null) throw new java.util.NoSuchElementException();
    return t;
  }
  public int nextInt() {
    String t = token();
    try { int v = Integer.parseInt(t); next(); return v; }
    catch (NumberFormatException e) { throw new InputMismatchException("For input string: \\"" + t + "\\""); }
  }
  public long nextLong() {
    String t = token();
    try { long v = Long.parseLong(t); next(); return v; }
    catch (NumberFormatException e) { throw new InputMismatchException("For input string: \\"" + t + "\\""); }
  }
  public double nextDouble() {
    String t = token();
    try { double v = Double.parseDouble(t); next(); return v; }
    catch (NumberFormatException e) { throw new InputMismatchException("For input string: \\"" + t + "\\""); }
  }
  public float nextFloat() { return (float) nextDouble(); }
  public short nextShort() { return (short) nextInt(); }
  public byte nextByte() { return (byte) nextInt(); }
  public java.math.BigInteger nextBigInteger() {
    String t = token();
    try { java.math.BigInteger v = new java.math.BigInteger(t); next(); return v; }
    catch (NumberFormatException e) { throw new InputMismatchException("For input string: \\"" + t + "\\""); }
  }
  public boolean nextBoolean() {
    String t = token();
    if (!t.equalsIgnoreCase("true") && !t.equalsIgnoreCase("false")) throw new InputMismatchException(t);
    next();
    return t.equalsIgnoreCase("true");
  }
  public boolean hasNextInt() { String t = peek(); if (t == null) return false; try { Integer.parseInt(t); return true; } catch (NumberFormatException e) { return false; } }
  public boolean hasNextLong() { String t = peek(); if (t == null) return false; try { Long.parseLong(t); return true; } catch (NumberFormatException e) { return false; } }
  public boolean hasNextDouble() { String t = peek(); if (t == null) return false; try { Double.parseDouble(t); return true; } catch (NumberFormatException e) { return false; } }
  public boolean hasNextLine() { return pos < text().length(); }
  public String nextLine() {
    String t = text();
    if (pos >= t.length()) throw new java.util.NoSuchElementException("No line found");
    int nl = t.indexOf('\\n', pos);
    int end = nl < 0 ? t.length() : nl;
    String line = t.substring(pos, end > pos && t.charAt(end - 1) == '\\r' ? end - 1 : end);
    pos = nl < 0 ? t.length() : nl + 1;
    return line;
  }
  public void close() { }
}
`;

// Imports of classes the prelude replaces. Blanked so javac does not look for them.
const IMPORTS = /\bimport\s+java\s*\.\s*(?:util\s*\.\s*(?:Scanner|InputMismatchException)|io\s*\.\s*InputStreamReader)\s*;/g;
// Fully qualified uses, e.g. `new java.util.Scanner(System.in)`.
const QUALIFIED = /\bjava\s*\.\s*(?:util|io)\s*\.\s*(?=(?:Scanner|InputMismatchException|InputStreamReader)\b)/g;
// `System.in` and `System.exit`, same length as `$Stdin.in` and `$Stdin.exit`.
const SYSTEM = /\bSystem\s*\.\s*(in|exit)\b/g;

const blank = (s) => s.replace(/[^\n]/g, ' ');

/**
 * Masks comments and string/char/text-block literals with spaces (keeping
 * newlines) so the rewrites below never touch text inside them.
 */
export function maskJava(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    let end = -1;
    if (c === '/' && n === '/') {
      end = src.indexOf('\n', i);
      if (end < 0) end = src.length;
    } else if (c === '/' && n === '*') {
      end = src.indexOf('*/', i + 2);
      end = end < 0 ? src.length : end + 2;
    } else if (c === '"' && src.startsWith('"""', i)) {
      end = src.indexOf('"""', i + 3);
      end = end < 0 ? src.length : end + 3;
    } else if (c === '"' || c === "'") {
      end = i + 1;
      while (end < src.length && src[end] !== c && src[end] !== '\n') end += src[end] === '\\' ? 2 : 1;
      end = Math.min(end + 1, src.length);
    }
    if (end < 0) {
      out += c;
      i++;
    } else {
      out += blank(src.slice(i, end));
      i = end;
    }
  }
  return out;
}

/** Replaces each regex match in `src` (found on `masked`) with `fn(match)`, same length. */
function rewrite(src, masked, re, fn) {
  let out = src;
  for (const m of masked.matchAll(re)) {
    const rep = fn(m);
    out = out.slice(0, m.index) + rep + out.slice(m.index + rep.length);
  }
  return out;
}

/**
 * -> { source, lines }: the text to hand javac, and how many lines are the
 * student's (diagnostics past that line come from the prelude).
 */
export function prepareJava(src) {
  const text = String(src ?? '').replace(/\r\n?/g, '\n');
  const masked = maskJava(text);
  let out = rewrite(text, masked, IMPORTS, (m) => blank(m[0]));
  out = rewrite(out, masked, QUALIFIED, (m) => blank(m[0]));
  out = rewrite(out, masked, SYSTEM, (m) => {
    // `System` and `$Stdin` are both 6 characters, so this never grows the line.
    return `$Stdin.${m[1]}`.padEnd(m[0].length, ' ');
  });
  const lines = text.split('\n').length;
  return { source: `${out}\n${PRELUDE}`, lines };
}

/** javac wants a public class in a file of the same name: `public class Solution` -> Solution.java. */
export function javaFileName(src) {
  const m = /\bpublic\s+(?:(?:final|abstract|sealed|strictfp)\s+)*(?:class|record|interface|enum)\s+([A-Za-z_$][\w$]*)/.exec(maskJava(String(src ?? '')));
  return `${m ? m[1] : 'Main'}.java`;
}

/** The real entry point: feeds stdin to the prelude, runs the student's main, reports uncaught exceptions. */
export function wrapperSource(mainClass, fileName = 'Main.java', userLines = 1000000) {
  const dot = mainClass.lastIndexOf('.');
  const pkg = dot > 0 ? `package ${mainClass.slice(0, dot)};\n` : '';
  return `${pkg}public class $Run {
  public static void main(String[] args) {
    $Stdin.data = args.length > 0 ? args[0] : "";
    try {
      ${mainClass}.main(new String[0]);
    } catch ($Exit e) {
      System.out.flush();
      if ($Stdin.status != 0) throw e;
    } catch (Throwable t) {
      StringBuilder sb = new StringBuilder("Exception in thread \\"main\\" ").append(t);
      int shown = 0;
      for (StackTraceElement f : t.getStackTrace()) {
        if ("${fileName}".equals(f.getFileName()) && f.getLineNumber() <= ${userLines} && shown++ < 12) sb.append("\\n\\tat ").append(f);
      }
      System.out.flush();
      System.err.println(sb);
      throw new $Exit();
    }
  }
}
`;
}
