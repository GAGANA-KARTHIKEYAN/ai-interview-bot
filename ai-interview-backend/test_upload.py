import requests
import json

BASE_URL = "http://127.0.0.1:8000"
FILE_PATH = r"c:\Users\gagan\Downloads\ai-interview-bot\public\uploads\Lab Experiment 1 Activity_1RVU23CSE162(GenAI).pdf"

def main():
    print(f"Uploading {FILE_PATH}...")
    with open(FILE_PATH, "rb") as f:
        response = requests.post(f"{BASE_URL}/upload-and-analyze", files={"cv": f})
    
    print(f"Status Code: {response.status_code}")
    print("Response JSON:")
    try:
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Failed to parse JSON: {e}")
        print("Raw text:", response.text)

if __name__ == "__main__":
    main()
