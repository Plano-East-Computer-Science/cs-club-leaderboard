# Cross-check without a stack: keep deleting a bracket pair that sits side by side
# (ignoring other characters) until none is left. What remains decides the answer:
# nothing means OK; otherwise the first closing bracket left, or else the first
# bracket left.
code = input()
left = [(ch, pos) for pos, ch in enumerate(code, start=1) if ch in "()[]{}"]
pairs = {"()", "[]", "{}"}
changed = True
while changed:
    changed = False
    for i in range(len(left) - 1):
        if left[i][0] + left[i + 1][0] in pairs:
            del left[i:i + 2]
            changed = True
            break
if not left:
    print("OK")
else:
    closers = [pos for ch, pos in left if ch in ")]}"]
    print(closers[0] if closers else left[0][1])
