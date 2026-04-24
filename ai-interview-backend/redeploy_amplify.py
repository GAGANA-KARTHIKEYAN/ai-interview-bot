import boto3
import sys

def trigger_amplify_redeploy():
    client = boto3.client('amplify', region_name='us-east-1')
    try:
        # Search for the app
        apps = client.list_apps()['apps']
        app = next((a for a in apps if 'ai-interview-bit' in a['name'].lower() or 'ai-interview-bot' in a['name'].lower()), None)
        
        if not app:
            print("❌ App 'ai-interview-bot' not found in Amplify.")
            return

        app_id = app['appId']
        # Search for the branch (usually 'main' or 'master')
        branches = client.list_branches(appId=app_id)['branches']
        if not branches:
            print(f"❌ No branches found for app {app_id}.")
            return

        branch_name = branches[0]['branchName']
        print(f"🚀 Triggering redeploy for App: {app_id}, Branch: {branch_name}...")
        
        # Start the redeploy job
        response = client.start_job(
            appId=app_id,
            branchName=branch_name,
            jobType='RELEASE'
        )
        
        job_id = response['jobSummary']['jobId']
        print(f"✅ Redeploy job started successfully! (Job ID: {job_id})")
        print("\nVisit your Amplify Console to watch the progress.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    trigger_amplify_redeploy()
