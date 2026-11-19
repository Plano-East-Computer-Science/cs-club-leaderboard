import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(in.readLine().trim());
        int[] starts = new int[n];
        int[] ends = new int[n];
        for (int i = 0; i < n; i++) {
            StringTokenizer st = new StringTokenizer(in.readLine());
            starts[i] = Integer.parseInt(st.nextToken());
            ends[i] = Integer.parseInt(st.nextToken());
        }
        // how many meetings are running at the busiest moment?
    }
}
