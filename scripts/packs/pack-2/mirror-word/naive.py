# Cross-check: compare with the reversed word.
word = input().strip()
print("YES" if word == word[::-1] else "NO")
