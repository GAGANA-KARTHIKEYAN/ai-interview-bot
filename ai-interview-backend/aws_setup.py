"""
AWS Infrastructure Setup Script for AI Interview Bot
Creates: DynamoDB tables + S3 bucket + IAM policy
Run once: python aws_setup.py
"""
import boto3
import json
import sys

REGION = "us-east-1"
S3_BUCKET = "ai-interview-bot-storage"
TABLES = [
    {"name": "InterviewUsers",    "key": "email"},
    {"name": "InterviewProfiles", "key": "email"},
    {"name": "InterviewHistory",  "key": "email"},
]

def ok(msg): print(f"  [OK] {msg}")
def info(msg): print(f"  -->  {msg}")
def err(msg): print(f"  [FAIL] {msg}")

def create_dynamodb_tables():
    print("\n=== Creating DynamoDB Tables ===")
    db = boto3.client("dynamodb", region_name=REGION)
    for t in TABLES:
        try:
            db.create_table(
                TableName=t["name"],
                AttributeDefinitions=[{"AttributeName": t["key"], "AttributeType": "S"}],
                KeySchema=[{"AttributeName": t["key"], "KeyType": "HASH"}],
                BillingMode="PAY_PER_REQUEST",
            )
            ok(f"Created table: {t['name']}")
        except Exception as e:
            if "ResourceInUseException" in str(type(e)) or "already exists" in str(e).lower():
                info(f"Table already exists: {t['name']} (skipping)")
            else:
                err(f"Failed to create {t['name']}: {e}")

def create_s3_bucket():
    print("\n=== Creating S3 Bucket ===")
    s3 = boto3.client("s3", region_name=REGION)
    try:
        if REGION == "us-east-1":
            s3.create_bucket(Bucket=S3_BUCKET)
        else:
            s3.create_bucket(
                Bucket=S3_BUCKET,
                CreateBucketConfiguration={"LocationConstraint": REGION}
            )
        # Block all public access
        s3.put_public_access_block(
            Bucket=S3_BUCKET,
            PublicAccessBlockConfiguration={
                "BlockPublicAcls": True,
                "IgnorePublicAcls": True,
                "BlockPublicPolicy": True,
                "RestrictPublicBuckets": True
            }
        )
        ok(f"Created S3 bucket: {S3_BUCKET} (all public access blocked)")
    except s3.exceptions.BucketAlreadyOwnedByYou:
        info(f"Bucket already exists: {S3_BUCKET} (skipping)")
    except s3.exceptions.BucketAlreadyExists:
        err(f"Bucket name '{S3_BUCKET}' is taken globally. Try a unique name in aws_db.py")
    except Exception as e:
        err(f"Failed to create bucket: {e}")

def print_iam_policy():
    print("\n=== IAM Policy for Lambda Role ===")
    print("Paste this into your Lambda Execution Role in the AWS Console:\n")
    sts = boto3.client("sts")
    account_id = sts.get_caller_identity()["Account"]
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Scan", "dynamodb:Query"],
                "Resource": [f"arn:aws:dynamodb:{REGION}:{account_id}:table/{t['name']}" for t in TABLES]
            },
            {
                "Effect": "Allow",
                "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
                "Resource": [f"arn:aws:s3:::{S3_BUCKET}", f"arn:aws:s3:::{S3_BUCKET}/*"]
            }
        ]
    }
    print(json.dumps(policy, indent=2))
    print("\n  --> Go to: AWS Console > IAM > Roles > your Lambda role > Add Permissions > Create Inline Policy")
    print("      Paste the JSON above and save it.")

if __name__ == "__main__":
    print("AI Interview Bot - AWS Infrastructure Setup")
    print("=" * 50)
    create_dynamodb_tables()
    create_s3_bucket()
    print_iam_policy()
    print("\n=== DONE ===")
    print("All AWS resources are ready.")
    print(f"\nAdd these to your Amplify/Lambda environment variables:")
    print(f"  AWS_REGION     = {REGION}")
    print(f"  S3_BUCKET_NAME = {S3_BUCKET}")
