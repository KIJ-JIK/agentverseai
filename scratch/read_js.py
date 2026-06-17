import re

js_path = r"C:\Users\anshv\.gemini\antigravity\scratch\devflow_ai\static\script.js"

with open(js_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("Searching for button click handlers or element IDs:")
for i, line in enumerate(lines):
    if any(k in line for k in ["trigger-btn", "clear-btn", "triggerBtn", "clearBtn", "clear-btn", "POST", "/api/", "feature-input"]):
        print(f"Line {i+1}: {line.strip()}")
