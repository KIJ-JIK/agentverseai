import os
import re
import json
import urllib.request
import urllib.error
import subprocess

def get_git_remote_url():
    try:
        # Get the URL of the origin remote
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True,
            text=True,
            check=True
        )
        url = result.stdout.strip()
        # Clean up ssh urls like git@github.com:username/repo.git to https://github.com/username/repo
        if url.startswith("git@"):
            url = url.replace(":", "/").replace("git@", "https://")
            if url.endswith(".git"):
                url = url[:-4]
        return url
    except subprocess.CalledProcessError:
        return None

def get_git_branch():
    try:
        # Get current branch
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip() or "main"
    except subprocess.CalledProcessError:
        return "main"

def parse_env_file():
    env_vars = {}
    env_path = ".env"
    if not os.path.exists(env_path):
        print("Error: .env file not found in the current directory.")
        return None
        
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                # Strip spaces and optional surrounding quotes
                key = key.strip()
                val = val.strip().strip("'").strip('"')
                env_vars[key] = val
    return env_vars

def deploy():
    print("=== AgentVerse AI — Automated Render Deployment ===")
    
    # 1. Detect git remote
    repo_url = get_git_remote_url()
    if not repo_url:
        print("\n[!] ERROR: Git remote 'origin' is not configured.")
        print("Please configure your GitHub repository remote first.")
        print("Example:")
        print("  git remote add origin \"https://github.com/YOUR_USERNAME/YOUR_REPO.git\"")
        print("  git push -u origin main")
        return
        
    branch = get_git_branch()
    print(f"[*] Detected Git Repository: {repo_url}")
    print(f"[*] Detected Active Branch: {branch}")
    
    # 2. Parse env file
    env_vars = parse_env_file()
    if not env_vars:
        return
        
    render_api_key = env_vars.get("RENDER_API_KEY")
    if not render_api_key:
        print("[!] ERROR: RENDER_API_KEY is missing from your .env file.")
        return
        
    # Render Owner ID (retrieved from workspace settings)
    owner_id = "tea-d8of62b6sc1c73blg4cg"  # Team: Ansh's workspace
    
    # Override MOCK_MODE to False for live deployment
    env_vars["MOCK_MODE"] = "False"
    
    # Prepare environment variables array for Render
    render_env_vars = []
    # Skip RENDER_API_KEY from being uploaded to Render settings
    keys_to_skip = {"RENDER_API_KEY"}
    for k, v in env_vars.items():
        if k not in keys_to_skip:
            render_env_vars.append({"key": k, "value": v})
            
    # Build payload
    payload = {
      "type": "web_service",
      "name": "agentverseai-backend",
      "ownerId": owner_id,
      "repo": repo_url,
      "branch": branch,
      "serviceDetails": {
        "env": "python",
        "buildCommand": "pip install -r requirements.txt",
        "startCommand": "uvicorn api_gateway:app --host 0.0.0.0 --port $PORT",
        "plan": "free"
      },
      "envVars": render_env_vars
    }
    
    print("\n[*] Sending request to Render API to create Web Service...")
    print(f"[*] Service Name: agentverseai-backend")
    print(f"[*] Deploying branch '{branch}' on Free Plan...")
    
    url = "https://api.render.com/v1/services"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {render_api_key}"
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            print("\n[+] SUCCESS: Render service created successfully!")
            print(f"Service ID: {res_data.get('id')}")
            
            # Find the dashboard URL or deploy status URL
            service_details = res_data.get("serviceDetails", {})
            dashboard_url = f"https://dashboard.render.com/web/{res_data.get('id')}"
            live_url = res_data.get("url")
            
            print(f"Dashboard URL: {dashboard_url}")
            print(f"Live Application URL: {live_url}")
            print("\nYour application is now building on Render. Monitor the progress in the Render dashboard.")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode()
        print(f"\n[!] HTTP Error {e.code}: {e.reason}")
        try:
            err_json = json.loads(err_msg)
            print("Render Error details:")
            print(json.dumps(err_json, indent=2))
        except:
            print(f"Raw error: {err_msg}")
    except Exception as e:
        print(f"\n[!] Unexpected error: {e}")

if __name__ == "__main__":
    deploy()
