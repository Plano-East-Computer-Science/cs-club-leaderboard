import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String record = in.readLine().trim();
        int best = 0;
        int run = 0;
        for (int i = 0; i < record.length(); i++) {
            // a W makes the current run longer; an L ends it
        }
        System.out.println(best);
    }
}
