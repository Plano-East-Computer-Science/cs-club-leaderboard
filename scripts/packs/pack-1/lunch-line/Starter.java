import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(in.readLine().trim());
        String[] line = in.readLine().trim().split(" ");
        int m = Integer.parseInt(in.readLine().trim());
        String[] cutters = in.readLine().trim().split(" ");
        // each cutter goes to the very front, one at a time
        System.out.println(String.join(" ", line));
    }
}
