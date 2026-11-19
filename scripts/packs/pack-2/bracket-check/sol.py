code = input()
partner = {")": "(", "]": "[", "}": "{"}
stack = []  # (bracket, position) for every opening bracket not closed yet
problem = 0
for pos, ch in enumerate(code, start=1):
    if ch in "([{":
        stack.append((ch, pos))
    elif ch in partner:
        if not stack or stack[-1][0] != partner[ch]:
            problem = pos
            break
        stack.pop()
if not problem and stack:
    problem = stack[0][1]  # the bottom of the stack is the first one left open
print(problem if problem else "OK")
