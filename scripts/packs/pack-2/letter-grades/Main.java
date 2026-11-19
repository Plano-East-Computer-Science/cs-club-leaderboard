import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(in.readLine().trim());
        StringTokenizer st = new StringTokenizer(in.readLine());
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < n; i++) {
            int s = Integer.parseInt(st.nextToken());
            if (s >= 90) {
                out.append("A");
            } else if (s >= 80) {
                out.append("B");
            } else if (s >= 70) {
                out.append("C");
            } else if (s >= 60) {
                out.append("D");
            } else {
                out.append("F");
            }
            out.append('\n');
        }
        System.out.print(out);
    }
}
