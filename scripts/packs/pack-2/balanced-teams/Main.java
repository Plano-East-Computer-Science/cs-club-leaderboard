import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(in.readLine().trim());
        int[] r = new int[n];
        StringTokenizer st = new StringTokenizer(in.readLine());
        for (int i = 0; i < n; i++) {
            r[i] = Integer.parseInt(st.nextToken());
        }
        Arrays.sort(r);
        // slowest with fastest, second slowest with second fastest, ...
        int worst = 0;
        for (int i = 0; i < n / 2; i++) {
            worst = Math.max(worst, r[i] + r[n - 1 - i]);
        }
        System.out.println(worst);
    }
}
