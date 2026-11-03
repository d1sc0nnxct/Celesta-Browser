with open(r"D:\browser\home\graph.js", "r", encoding="utf-8") as f:
    lines = f.read().splitlines()
end = next(i for i, line in enumerate(lines) if "const seedById" in line)
clean = lines[:27] + lines[end:]
with open(r"D:\browser\home\graph.js", "w", encoding="utf-8") as f:
    f.write("\n".join(clean) + "\n")
print("Cleaned — kept", len(clean), "lines")
