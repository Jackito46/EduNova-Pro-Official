import sys
from PIL import Image

def print_image(path):
    chars = " .:-=+*#%@"
    try:
        img = Image.open(path).convert('L')
        img = img.resize((40, 20))
        print(f"\n--- {path} ---")
        for y in range(20):
            row = ""
            for x in range(40):
                val = img.getpixel((x, y))
                row += chars[int(val / 256 * len(chars))]
            print(row)
    except Exception as e:
        print(f"Error reading {path}: {e}")

for f in sys.argv[1:]:
    print_image(f)
