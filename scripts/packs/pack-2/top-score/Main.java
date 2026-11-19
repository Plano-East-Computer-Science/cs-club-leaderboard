import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(in.readLine().trim());
        StringTokenizer st = new StringTokenizer(in.readLine());
        int top = -1;
        int count = 0;
        for (int i = 0; i < n; i++) {
            int s = Integer.parseInt(st.nextToken());
            if (s > top) {
                top = s;
                count = 1;
            } else if (s == top) {
                count++;
            }
        }
        System.out.println(top + " " + count);
    }
}
