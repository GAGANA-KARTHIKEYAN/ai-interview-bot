import boto3

def update_and_deploy():
    client = boto3.client('amplify', region_name='us-east-1')
    try:
        # Search for the app
        apps = client.list_apps()['apps']
        app = next((a for a in apps if 'ai-interview-bit' in a['name'].lower() or 'ai-interview-bot' in a['name'].lower()), None)
        
        if not app:
            print("[Error] App 'ai-interview-bot' not found in Amplify.")
            return

        app_id = app['appId']
        print(f"Found app ID: {app_id}")
        
        # Get existing environment variables
        existing_env = app.get('environmentVariables', {})
        print(f"Existing env vars: {list(existing_env.keys())}")
        
        # Update URLs to point to the new backend
        new_url = "https://wrt0xf7505.execute-api.us-east-1.amazonaws.com/dev"
        existing_env['NEXT_PUBLIC_BACKEND_URL'] = new_url
        existing_env['NEXT_PUBLIC_API_URL'] = new_url
        
        print("Updating environment variables in Amplify...")
        client.update_app(
            appId=app_id,
            environmentVariables=existing_env
        )
        print("Environment variables updated successfully!")

        # Search for the branch (usually 'main' or 'master')
        branches = client.list_branches(appId=app_id)['branches']
        if not branches:
            print(f"[Error] No branches found for app {app_id}.")
            return

        branch_name = branches[0]['branchName']
        print(f"[Info] Triggering redeploy for App: {app_id}, Branch: {branch_name}...")
        
        # Start the redeploy job
        response = client.start_job(
            appId=app_id,
            branchName=branch_name,
            jobType='RELEASE'
        )
        
        job_id = response['jobSummary']['jobId']
        print(f"[Success] Redeploy job started successfully! (Job ID: {job_id})")
        print("\nWait 2-3 minutes for the build to finish, then check your live URL!")
    except Exception as e:
        print(f"[Error] Exception occurred: {e}")

if __name__ == "__main__":
    update_and_deploy()
