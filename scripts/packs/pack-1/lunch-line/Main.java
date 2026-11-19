import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(in.readLine().trim());
        String[] line = in.readLine().trim().split(" ");
        int m = Integer.parseInt(in.readLine().trim());
        String[] cutters = in.readLine().trim().split(" ");
        // Each arrival goes in front of everyone, so the last to arrive is first.
        ArrayDeque<String> queue = new ArrayDeque<>(Arrays.asList(line));
        for (String name : cutters) {
            queue.addFirst(name);
        }
        System.out.println(String.join(" ", queue));
    }
}
