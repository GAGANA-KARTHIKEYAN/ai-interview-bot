import os
import sys
import boto3

# Ensure we can import aws_db
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from aws_db import TABLE_HISTORY, dynamodb

def clean_all_histories():
    try:
        print(f"Scanning {TABLE_HISTORY} to wipe corrupted sessions...")
        response = dynamodb.scan(TableName=TABLE_HISTORY)
        items = response.get('Items', [])
        
        for item in items:
            email = item.get('email', {}).get('S')
            if not email: continue
            
            print(f"Wiping corrupted sessions array for {email}")
            # Keep weaknesses but wipe sessions
            dynamodb.update_item(
                TableName=TABLE_HISTORY,
                Key={'email': {'S': email}},
                UpdateExpression="SET sessions = :empty_arr",
                ExpressionAttributeValues={':empty_arr': {'S': '[]'}}
            )
            
        print("Done cleaning histories!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    clean_all_histories()
