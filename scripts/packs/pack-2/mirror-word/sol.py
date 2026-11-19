word = input().strip()
ok = True
for i in range(len(word) // 2):
    if word[i] != word[len(word) - 1 - i]:
        ok = False
print("YES" if ok else "NO")
