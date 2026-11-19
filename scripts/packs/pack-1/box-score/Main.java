import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(in.readLine().trim());
        StringTokenizer st = new StringTokenizer(in.readLine());
        int total = 0;
        for (int i = 0; i < n; i++) {
            total += Integer.parseInt(st.nextToken());
        }
        System.out.println(total);
    }
}
