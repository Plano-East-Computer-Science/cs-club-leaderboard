caption = input()
count = 0
for ch in caption:
    if ch.lower() in "aeiou":
        count += 1
print(count)
