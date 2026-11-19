import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(in.readLine().trim());
        // LinkedHashMap remembers the order names were first added
        LinkedHashMap<String, Integer> counts = new LinkedHashMap<>();
        for (int i = 0; i < n; i++) {
            String name = in.readLine().trim();
            counts.put(name, counts.getOrDefault(name, 0) + 1);
        }
        StringBuilder out = new StringBuilder();
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            out.append(e.getKey()).append(' ').append(e.getValue()).append('\n');
        }
        System.out.print(out);
    }
}
