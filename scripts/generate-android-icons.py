import os
from PIL import Image

def generate_icons():
    src_path = os.path.join(os.path.dirname(__file__), '../public/pwa-512x512.png')
    if not os.path.exists(src_path):
        src_path = os.path.join(os.path.dirname(__file__), '../public/icon-192.png')
    
    if not os.path.exists(src_path):
        print(f"Source icon not found at {src_path}")
        return
    
    img = Image.open(src_path).convert("RGBA")
    print(f"Loaded source image: {src_path} ({img.size})")

    res_dir = os.path.join(os.path.dirname(__file__), '../android/app/src/main/res')

    sizes = {
        'mipmap-mdpi': (48, 108),
        'mipmap-hdpi': (72, 162),
        'mipmap-xhdpi': (96, 216),
        'mipmap-xxhdpi': (144, 324),
        'mipmap-xxxhdpi': (192, 432),
    }

    for folder, (app_size, fg_size) in sizes.items():
        folder_path = os.path.join(res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)

        # Standard icon
        icon = img.resize((app_size, app_size), Image.Resampling.LANCZOS)
        icon.save(os.path.join(folder_path, 'ic_launcher.png'), 'PNG')
        icon.save(os.path.join(folder_path, 'ic_launcher_round.png'), 'PNG')

        # Foreground for adaptive icon (with padding so it doesn't get cut by the circle/squircle mask)
        fg_canvas = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
        # icon takes ~70% of adaptive area
        inner_size = int(fg_size * 0.72)
        inner_img = img.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
        offset = (fg_size - inner_size) // 2
        fg_canvas.paste(inner_img, (offset, offset), inner_img)
        fg_canvas.save(os.path.join(folder_path, 'ic_launcher_foreground.png'), 'PNG')

        print(f"Generated icons for {folder}: launcher={app_size}x{app_size}, foreground={fg_size}x{fg_size}")

if __name__ == '__main__':
    generate_icons()
