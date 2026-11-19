import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String caption = in.readLine();
        int count = 0;
        for (int i = 0; i < caption.length(); i++) {
            char c = Character.toLowerCase(caption.charAt(i));
            if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u') {
                count++;
            }
        }
        System.out.println(count);
    }
}
