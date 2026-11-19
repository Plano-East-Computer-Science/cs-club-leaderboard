import java.io.*;

public class Main {
    static int minutes(String text) {
        String[] parts = text.trim().split(":");
        return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
    }

    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int now = minutes(in.readLine());
        int n = Integer.parseInt(in.readLine().trim());
        int best = 1440;
        for (int i = 0; i < n; i++) {
            int bus = minutes(in.readLine());
            // Java's % can be negative, so add a day before taking it again
            int wait = ((bus - now) % 1440 + 1440) % 1440;
            best = Math.min(best, wait);
        }
        System.out.println(best);
    }
}
