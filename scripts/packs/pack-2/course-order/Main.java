import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(in.readLine());
        int n = Integer.parseInt(st.nextToken());
        int m = Integer.parseInt(st.nextToken());
        List<List<Integer>> unlocks = new ArrayList<>();
        for (int i = 0; i <= n; i++) {
            unlocks.add(new ArrayList<>());
        }
        int[] needs = new int[n + 1]; // required courses not taken yet
        for (int i = 0; i < m; i++) {
            st = new StringTokenizer(in.readLine());
            int a = Integer.parseInt(st.nextToken());
            int b = Integer.parseInt(st.nextToken());
            unlocks.get(a).add(b);
            needs[b]++;
        }
        // PriorityQueue hands back the lowest-numbered course that can be taken now.
        PriorityQueue<Integer> ready = new PriorityQueue<>();
        for (int c = 1; c <= n; c++) {
            if (needs[c] == 0) {
                ready.add(c);
            }
        }
        StringBuilder out = new StringBuilder();
        int taken = 0;
        while (!ready.isEmpty()) {
            int c = ready.poll();
            if (taken > 0) {
                out.append(' ');
            }
            out.append(c);
            taken++;
            for (int b : unlocks.get(c)) {
                needs[b]--;
                if (needs[b] == 0) {
                    ready.add(b);
                }
            }
        }
        System.out.println(taken == n ? out.toString() : "IMPOSSIBLE");
    }
}
