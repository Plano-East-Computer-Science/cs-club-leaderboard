import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(in.readLine().trim());
        StringBuilder out = new StringBuilder();
        for (int i = 1; i <= n; i++) {
            if (i % 15 == 0) {
                out.append("PantherEast");
            } else if (i % 3 == 0) {
                out.append("Panther");
            } else if (i % 5 == 0) {
                out.append("East");
            } else {
                out.append(i);
            }
            out.append('\n');
        }
        System.out.print(out);
    }
}
