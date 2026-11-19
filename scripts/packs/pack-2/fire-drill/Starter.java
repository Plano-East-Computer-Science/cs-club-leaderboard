import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(in.readLine());
        int r = Integer.parseInt(st.nextToken());
        int c = Integer.parseInt(st.nextToken());
        char[][] grid = new char[r][];
        for (int i = 0; i < r; i++) {
            grid[i] = in.readLine().trim().toCharArray();
        }
        // first work out the minute the fire reaches every square,
        // then search from S, only stepping where you get there before the fire
    }
}
