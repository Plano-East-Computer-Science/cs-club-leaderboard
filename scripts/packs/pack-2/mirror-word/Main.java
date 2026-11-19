import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String word = in.readLine().trim();
        boolean ok = true;
        for (int i = 0; i < word.length() / 2; i++) {
            if (word.charAt(i) != word.charAt(word.length() - 1 - i)) {
                ok = false;
            }
        }
        System.out.println(ok ? "YES" : "NO");
    }
}
