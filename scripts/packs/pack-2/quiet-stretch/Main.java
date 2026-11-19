import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(in.readLine());
        int n = Integer.parseInt(st.nextToken());
        long s = Long.parseLong(st.nextToken());
        int[] a = new int[n];
        st = new StringTokenizer(in.readLine());
        for (int i = 0; i < n; i++) {
            a[i] = Integer.parseInt(st.nextToken());
        }
        // Sliding window: grow on the right, shrink from the left while the total is over S.
        int best = 0;
        long total = 0;
        int left = 0;
        for (int right = 0; right < n; right++) {
            total += a[right];
            while (total > s) {
                total -= a[left];
                left++;
            }
            best = Math.max(best, right - left + 1);
        }
        System.out.println(best);
    }
}
