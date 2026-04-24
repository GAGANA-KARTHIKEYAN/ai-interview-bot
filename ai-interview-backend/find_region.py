import boto3
import sys

def find_region():
    regions = ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ap-south-1', 'ap-southeast-1', 'eu-central-1', 'eu-west-1']
    found = {}
    for r in regions:
        print(f"Checking {r}...")
        try:
            db = boto3.client('dynamodb', region_name=r)
            tables = db.list_tables()['TableNames']
            matches = [t for t in tables if 'Interview' in t]
            if matches:
                found[r] = matches
        except Exception as e:
            print(f"  Error in {r}: {e}")
            
    if not found:
        print("\n❌ No Interview tables found in common regions.")
    else:
        print("\n✅ FOUND TABLES:")
        for r, t in found.items():
            print(f"  - {r}: {t}")

if __name__ == "__main__":
    find_region()
