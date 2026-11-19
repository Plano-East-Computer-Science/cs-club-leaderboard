import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(in.readLine());
        int r = Integer.parseInt(st.nextToken());
        int c = Integer.parseInt(st.nextToken());
        char[][] grid = new char[r][];
        for (int i = 0; i < r; i++) {
            grid[i] = in.readLine().trim().toCharArray();
        }
        int[] di = {1, -1, 0, 0};
        int[] dj = {0, 0, 1, -1};
        final int INF = Integer.MAX_VALUE;

        // 1. The minute the fire reaches each square: one search from every F at once.
        int[][] fire = new int[r][c];
        ArrayDeque<int[]> q = new ArrayDeque<>();
        int si = 0, sj = 0;
        for (int i = 0; i < r; i++) {
            for (int j = 0; j < c; j++) {
                fire[i][j] = INF;
                if (grid[i][j] == 'F') {
                    fire[i][j] = 0;
                    q.add(new int[] {i, j});
                }
                if (grid[i][j] == 'S') {
                    si = i;
                    sj = j;
                }
            }
        }
        while (!q.isEmpty()) {
            int[] p = q.poll();
            for (int d = 0; d < 4; d++) {
                int a = p[0] + di[d], b = p[1] + dj[d];
                if (a >= 0 && a < r && b >= 0 && b < c && grid[a][b] != '#' && fire[a][b] == INF) {
                    fire[a][b] = fire[p[0]][p[1]] + 1;
                    q.add(new int[] {a, b});
                }
            }
        }

        // 2. Search from S, stepping only where you arrive before the fire does.
        int[][] seen = new int[r][c];
        for (int[] row : seen) {
            Arrays.fill(row, -1);
        }
        seen[si][sj] = 0;
        q.add(new int[] {si, sj});
        int answer = -1;
        while (!q.isEmpty() && answer < 0) {
            int[] p = q.poll();
            int t = seen[p[0]][p[1]] + 1;
            for (int d = 0; d < 4; d++) {
                int a = p[0] + di[d], b = p[1] + dj[d];
                if (a >= 0 && a < r && b >= 0 && b < c && grid[a][b] != '#' && seen[a][b] < 0 && t < fire[a][b]) {
                    if (grid[a][b] == 'E') {
                        answer = t;
                        break;
                    }
                    seen[a][b] = t;
                    q.add(new int[] {a, b});
                }
            }
        }
        System.out.println(answer);
    }
}
