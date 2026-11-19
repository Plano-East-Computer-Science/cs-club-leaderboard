import java.io.*;
import java.util.*;

public class Main {
    static final long MOD = 1_000_000_007L;

    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(in.readLine());
        int r = Integer.parseInt(st.nextToken());
        int c = Integer.parseInt(st.nextToken());
        String[] grid = new String[r];
        for (int i = 0; i < r; i++) {
            grid[i] = in.readLine();
        }
        // paths to a square = paths to the square above + paths to the square on its left
    }
}
