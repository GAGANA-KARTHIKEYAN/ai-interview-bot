import boto3

db = boto3.client('dynamodb', region_name='us-east-1')
s3 = boto3.client('s3', region_name='us-east-1')

tables = ['InterviewUsers', 'InterviewProfiles', 'InterviewHistory']
print('=== DynamoDB Tables ===')
for t in tables:
    try:
        info = db.describe_table(TableName=t)['Table']
        print(f'  [OK] {t} - Status: {info["TableStatus"]}')
    except Exception as e:
        print(f'  [MISSING] {t}: {e}')

print('\n=== S3 Bucket ===')
try:
    s3.head_bucket(Bucket='ai-interview-bot-storage')
    print('  [OK] ai-interview-bot-storage EXISTS')
except Exception as e:
    print(f'  [MISSING] ai-interview-bot-storage: {e}')
