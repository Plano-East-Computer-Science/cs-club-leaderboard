n = int(input())
line = input().split()
m = int(input())
cutters = input().split()
# The last to arrive ends up first, so the cutters stand in reverse order.
print(" ".join(cutters[::-1] + line))
