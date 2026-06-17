import os
import zipfile

zip_path = r"C:\Users\anshv\.gemini\antigravity\scratch\devflow_ai.zip"
root_dir = r"C:\Users\anshv\.gemini\antigravity\scratch\devflow_ai"

print(f"Archiving directory {root_dir}...")
print(f"Saving to {zip_path}...")

# Check if old zip exists, delete it to ensure fresh packaging
if os.path.exists(zip_path):
    try:
        os.remove(zip_path)
        print("Removed existing zip archive.")
    except Exception as e:
        print(f"Warning: Could not remove old zip: {e}")

file_count = 0
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            filepath = os.path.join(root, file)
            # Make sure we don't zip the output zip itself if it's placed inside the same folder
            if zip_path in filepath:
                continue
            
            # Get relative path
            relpath = os.path.relpath(filepath, root_dir)
            zipf.write(filepath, relpath)
            file_count += 1

print(f"Done! Packaged {file_count} files successfully into {zip_path}.")
