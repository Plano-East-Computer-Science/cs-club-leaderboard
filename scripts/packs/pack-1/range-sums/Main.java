import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(in.readLine());
        int n = Integer.parseInt(st.nextToken());
        int q = Integer.parseInt(st.nextToken());
        // prefix[i] = a1 + ... + ai; long because the sums pass 2,147,483,647
        long[] prefix = new long[n + 1];
        st = new StringTokenizer(in.readLine());
        for (int i = 0; i < n; i++) {
            prefix[i + 1] = prefix[i] + Long.parseLong(st.nextToken());
        }
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < q; i++) {
            st = new StringTokenizer(in.readLine());
            int l = Integer.parseInt(st.nextToken());
            int r = Integer.parseInt(st.nextToken());
            out.append(prefix[r] - prefix[l - 1]).append('\n');
        }
        System.out.print(out);
    }
}
