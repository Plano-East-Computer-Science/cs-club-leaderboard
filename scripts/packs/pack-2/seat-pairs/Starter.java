import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(in.readLine());
        int r = Integer.parseInt(st.nextToken());
        int c = Integer.parseInt(st.nextToken());
        int pairs = 0;
        for (int i = 0; i < r; i++) {
            String row = in.readLine();
            // look at each seat and the one to its right
        }
        System.out.println(pairs);
    }
}
