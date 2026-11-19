import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String code = in.readLine();
        // positions (from 1) of opening brackets not closed yet
        ArrayDeque<Integer> stack = new ArrayDeque<>();
        int problem = 0;
        for (int i = 0; i < code.length() && problem == 0; i++) {
            char ch = code.charAt(i);
            if (ch == '(' || ch == '[' || ch == '{') {
                stack.push(i + 1);
            } else if (ch == ')' || ch == ']' || ch == '}') {
                char want = ch == ')' ? '(' : ch == ']' ? '[' : '{';
                if (stack.isEmpty() || code.charAt(stack.peek() - 1) != want) {
                    problem = i + 1;
                } else {
                    stack.pop();
                }
            }
        }
        if (problem == 0 && !stack.isEmpty()) {
            problem = stack.peekLast(); // the first one opened and never closed
        }
        System.out.println(problem == 0 ? "OK" : String.valueOf(problem));
    }
}
