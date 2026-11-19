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
        Arrays.sort(starts);
        Arrays.sort(ends);
        // Rooms in use at a start = meetings started so far - meetings ended by then.
        int best = 0;
        int ended = 0;
        for (int i = 0; i < n; i++) {
            while (ended < n && ends[ended] <= starts[i]) {
                ended++;
            }
            best = Math.max(best, i + 1 - ended);
        }
        System.out.println(best);
    }
}
