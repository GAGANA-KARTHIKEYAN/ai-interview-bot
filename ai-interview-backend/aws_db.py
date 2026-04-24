import boto3
import json
import logging
import os
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

# In Lambda, boto3 auto-detects region from the execution context.
# APP_REGION is only used for local development (avoids the reserved AWS_ prefix).
AWS_REGION = os.getenv("APP_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "ai-interview-bot-storage")

dynamodb = boto3.client('dynamodb', region_name=AWS_REGION)
s3 = boto3.client('s3', region_name=AWS_REGION)

# DynamoDB Table Names
TABLE_USERS = "InterviewUsers"
TABLE_PROFILES = "InterviewProfiles" 
TABLE_HISTORY = "InterviewHistory"

def get_user(email: str) -> Dict:
    try:
        response = dynamodb.get_item(
            TableName=TABLE_USERS,
            Key={"email": {"S": email}}
        )
        item = response.get("Item")
        if not item: return {}
        return {
            "email": item.get("email", {}).get("S"),
            "name": item.get("name", {}).get("S"),
            "created_at": item.get("created_at", {}).get("S")
        }
    except Exception as e:
        logger.error(f"Error getting user from DynamoDB: {e}")
        return {}

def save_user(email: str, name: str, created_at: str) -> bool:
    try:
        dynamodb.put_item(
            TableName=TABLE_USERS,
            Item={
                "email": {"S": email},
                "name": {"S": name},
                "created_at": {"S": created_at}
            }
        )
        return True
    except Exception as e:
        logger.error(f"Error saving user to DynamoDB: {e}")
        return False

def get_profile(email: str) -> Dict:
    try:
        response = dynamodb.get_item(
            TableName=TABLE_PROFILES,
            Key={"email": {"S": email}}
        )
        item = response.get("Item")
        if not item: return {}
        return json.loads(item.get("profile_data", {}).get("S", "{}"))
    except Exception as e:
        logger.error(f"Error getting profile from DynamoDB: {e}")
        return {}

def save_profile(email: str, profile_data: Dict) -> bool:
    try:
        dynamodb.put_item(
            TableName=TABLE_PROFILES,
            Item={
                "email": {"S": email},
                "profile_data": {"S": json.dumps(profile_data)}
            }
        )
        return True
    except Exception as e:
        logger.error(f"Error saving profile to DynamoDB: {e}")
        return False

def get_history(email: str) -> List[Dict]:
    try:
        response = dynamodb.get_item(
            TableName=TABLE_HISTORY,
            Key={"email": {"S": email}}
        )
        item = response.get("Item")
        if not item: return []
        return json.loads(item.get("sessions", {}).get("S", "[]"))
    except Exception as e:
        logger.error(f"Error getting history from DynamoDB: {e}")
        return []

def get_candidate_weaknesses(email: str, skill: str) -> List[str]:
    """Retrieve historical weaknesses for a specific skill."""
    try:
        response = dynamodb.get_item(
            TableName=TABLE_HISTORY,
            Key={"email": {"S": email}}
        )
        item = response.get("Item")
        if not item: return []
        weaknesses_json = item.get("weaknesses", {}).get("S", "{}")
        weaknesses_dict = json.loads(weaknesses_json)
        return weaknesses_dict.get(skill, [])
    except Exception as e:
        logger.error(f"Error getting weaknesses from DynamoDB: {e}")
        return []

def append_history_and_extract_weaknesses(email: str, skill: str, question: str, answer: str, evaluation: Dict):
    """
    Extracts missed_concepts into their persistent weaknesses ledger for Historical RAG.
    """
    try:
        # Retrieve existing
        response = dynamodb.get_item(TableName=TABLE_HISTORY, Key={"email": {"S": email}})
        item = response.get("Item", {})
        
        # Keep existing sessions unchanged
        sessions_str = item.get("sessions", {}).get("S", "[]")
        weaknesses_dict = json.loads(item.get("weaknesses", {}).get("S", "{}"))
        
        # Extract Weaknesses for RAG
        skill_weaknesses = weaknesses_dict.get(skill, [])
        tech_acc = evaluation.get("technical_accuracy", {})
        
        if "missed" in tech_acc:
            skill_weaknesses.extend(tech_acc["missed"])
        if "incorrect" in tech_acc:
            skill_weaknesses.extend(tech_acc["incorrect"])
            
        # Deduplicate and limit to top 15 most recent weaknesses to prevent prompt blowout
        unique_weaknesses = list(dict.fromkeys(skill_weaknesses))[-15:]
        weaknesses_dict[skill] = unique_weaknesses
        
        # Save back
        dynamodb.put_item(
            TableName=TABLE_HISTORY,
            Item={
                "email": {"S": email},
                "sessions": {"S": sessions_str},
                "weaknesses": {"S": json.dumps(weaknesses_dict)}
            }
        )
        return True
    except Exception as e:
        logger.error(f"Error saving history to DynamoDB: {e}")
        return False

def save_full_session(email: str, session_data: Dict):
    """
    Appends a full interview session (with date, overallScore, etc.) to the user's dashboard history.
    """
    try:
        response = dynamodb.get_item(TableName=TABLE_HISTORY, Key={"email": {"S": email}})
        item = response.get("Item", {})
        
        sessions = json.loads(item.get("sessions", {}).get("S", "[]"))
        weaknesses_str = item.get("weaknesses", {}).get("S", "{}")
        
        sessions.append(session_data)
        
        dynamodb.put_item(
            TableName=TABLE_HISTORY,
            Item={
                "email": {"S": email},
                "sessions": {"S": json.dumps(sessions)},
                "weaknesses": {"S": weaknesses_str}
            }
        )
        return True
    except Exception as e:
        logger.error(f"Error saving full session: {e}")
        return False

def upload_to_s3(file_bytes: bytes, filename: str, content_type: str = "application/pdf") -> str:
    try:
        s3.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=f"resumes/{filename}",
            Body=file_bytes,
            ContentType=content_type
        )
        s3_url = f"s3://{S3_BUCKET_NAME}/resumes/{filename}"
        return s3_url
    except Exception as e:
        logger.error(f"Error uploading to S3: {e}")
        raise e
