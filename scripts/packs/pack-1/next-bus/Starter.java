import java.io.*;

public class Main {
    // "07:15" -> 435 minutes after midnight
    static int minutes(String text) {
        String[] parts = text.trim().split(":");
        return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
    }

    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int now = minutes(in.readLine());
        int n = Integer.parseInt(in.readLine().trim());
        for (int i = 0; i < n; i++) {
            int bus = minutes(in.readLine());
            // how long until this bus? remember it may be tomorrow
        }
        // print the shortest wait
    }
}
