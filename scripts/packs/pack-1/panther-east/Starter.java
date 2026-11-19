import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(in.readLine().trim());
        for (int i = 1; i <= n; i++) {
            // check the multiple of both first, then 3, then 5
            System.out.println(i);
        }
    }
}
