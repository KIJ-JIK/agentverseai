import os
import json
import urllib.request
import urllib.error

def parse_env_file():
    env_vars = {}
    env_path = ".env"
    if not os.path.exists(env_path):
        print("Error: .env file not found.")
        return None
        
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip("'").strip('"')
                env_vars[key] = val
    return env_vars

def trigger_deploy():
    print("=== DevFlow AI — Live Render Deployment Manager ===")
    
    env_vars = parse_env_file()
    if not env_vars:
        return
        
    render_api_key = env_vars.get("RENDER_API_KEY")
    if not render_api_key:
        print("[!] ERROR: RENDER_API_KEY is missing from .env file.")
        return

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {render_api_key}"
    }

    # 1. List services to find agentverseai-backend
    print("[*] Retrieving active services from Render...")
    url_list = "https://api.render.com/v1/services?limit=20"
    req_list = urllib.request.Request(url_list, headers=headers)
    
    service_id = None
    live_url = None
    
    try:
        with urllib.request.urlopen(req_list) as response:
            services = json.loads(response.read().decode())
            for item in services:
                service = item.get("service", {})
                if service.get("name") == "agentverseai-backend":
                    service_id = service.get("id")
                    live_url = service.get("url")
                    break
    except Exception as e:
        print(f"[!] Error listing services: {e}")
        return

    if not service_id:
        print("[!] ERROR: Could not find service 'agentverseai-backend' on Render.")
        print("Please verify the service name matches or create it first.")
        return

    print(f"[+] Found existing service: {service_id}")
    print(f"[*] Live URL: {live_url}")
    print(f"[*] Triggering manual deploy for the latest pushed commit...")

    # 2. Trigger deploy on that service
    url_deploy = f"https://api.render.com/v1/services/{service_id}/deploys"
    req_deploy = urllib.request.Request(
        url_deploy,
        data=b"{}",  # Empty payload for POST trigger
        headers={**headers, "Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req_deploy) as response:
            raw_res = response.read().decode()
            print(f"[*] Raw Render API Response: {raw_res}")
            if not raw_res.strip():
                print("\n[+] SUCCESS: Render deploy triggered (empty response returned).")
                return
            deploy_res = json.loads(raw_res)
            deploy_id = deploy_res.get("id")
            status = deploy_res.get("status")
            dashboard_url = f"https://dashboard.render.com/web/{service_id}/deploys/{deploy_id}"
            
            print("\n[+] SUCCESS: Render deploy triggered successfully!")
            print(f"Deploy ID: {deploy_id}")
            print(f"Status: {status}")
            print(f"Dashboard Deploy URL: {dashboard_url}")
            print(f"Live App URL: {live_url}")
            print("\nYour changes are building now. It takes a few minutes for Render to build and swap instances.")
    except urllib.error.HTTPError as e:
        print(f"\n[!] HTTP Error {e.code}: {e.reason}")
        print(e.read().decode())
    except Exception as e:
        print(f"\n[!] Error triggering deploy: {e}")

if __name__ == "__main__":
    trigger_deploy()
