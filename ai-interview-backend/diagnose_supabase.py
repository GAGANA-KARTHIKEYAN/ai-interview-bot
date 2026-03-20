import os
import sys
from supabase import create_client, Client

def diagnose():
    print("=== SUPABASE DIAGNOSTIC (AWS LAMBDA ENV) ===")
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    
    if not url:
        print("❌ ERROR: SUPABASE_URL is missing!")
    else:
        print(f"✅ SUPABASE_URL found (starts with: {url[:10]}...)")
        
    if not key:
        print("❌ ERROR: SUPABASE_KEY is missing!")
    else:
        print(f"✅ SUPABASE_KEY found (length: {len(key)})")
        
    if url and key:
        try:
            client: Client = create_client(url, key)
            print("✅ Supabase client initialized successfuly.")
            # Test a simple query
            res = client.table("users").select("count", count="exact").limit(1).execute()
            print(f"✅ Database query test: OK (Found {res.count} users)")
        except Exception as e:
            print(f"❌ ERROR connecting to Supabase: {str(e)}")
    else:
        print("\n💡 ACTION REQUIRED: Go to Amplify -> Hosting -> Environment variables")
        print("Add 'SUPABASE_URL' and 'SUPABASE_KEY' exactly as seen in your Supabase Project Settings.")

if __name__ == "__main__":
    diagnose()
