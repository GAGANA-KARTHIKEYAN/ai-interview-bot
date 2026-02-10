import requests
import json

# Test the backend endpoints
BASE_URL = "http://127.0.0.1:8000"

def test_backend():
    print("Testing backend endpoints...")
    
    # Test 1: Home endpoint
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"1. Home endpoint: {response.status_code} - {response.json()}")
    except Exception as e:
        print(f"1. Home endpoint failed: {e}")
        return False
    
    # Test 2: Questions endpoint
    try:
        payload = {"skill": "Python"}
        response = requests.post(f"{BASE_URL}/questions", json=payload)
        print(f"2. Questions endpoint: {response.status_code}")
        print(f"   Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"2. Questions endpoint failed: {e}")
    
    # Test 3: Evaluate endpoint
    try:
        payload = {
            "question": "What is Python?",
            "answer": "Python is a programming language used for web development, data science, and automation."
        }
        response = requests.post(f"{BASE_URL}/evaluate", json=payload)
        print(f"3. Evaluate endpoint: {response.status_code}")
        print(f"   Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"3. Evaluate endpoint failed: {e}")
    
    return True

if __name__ == "__main__":
    test_backend()