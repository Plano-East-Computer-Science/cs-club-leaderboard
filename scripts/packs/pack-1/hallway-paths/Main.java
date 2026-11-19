import java.io.*;
import java.util.*;

public class Main {
    static final long MOD = 1_000_000_007L;

    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(in.readLine());
        int r = Integer.parseInt(st.nextToken());
        int c = Integer.parseInt(st.nextToken());
        // ways[j] = paths to square (row, j): from above (old ways[j]) plus from the left.
        long[] ways = new long[c];
        for (int i = 0; i < r; i++) {
            String row = in.readLine();
            for (int j = 0; j < c; j++) {
                if (row.charAt(j) == '#') {
                    ways[j] = 0;
                } else if (i == 0 && j == 0) {
                    ways[j] = 1;
                } else if (j > 0) {
                    ways[j] = (ways[j] + ways[j - 1]) % MOD;
                }
            }
        }
        System.out.println(ways[c - 1]);
    }
}
