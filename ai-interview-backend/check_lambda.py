import boto3
import json

client = boto3.client('lambda', region_name='us-east-1')

response = client.invoke(
    FunctionName='ai-interview-backend-dev-api',
    InvocationType='RequestResponse',
    Payload=json.dumps({
        "httpMethod": "GET",
        "path": "/health",
        "requestContext": {}
    })
)

payload = response['Payload'].read().decode('utf-8')
with open("result.json", "w") as f:
    f.write(payload)
print("Saved to result.json")
