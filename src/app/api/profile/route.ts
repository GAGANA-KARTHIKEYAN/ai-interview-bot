export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const profilesPath = path.join(process.cwd(), 'src/app/data/profiles.json');
const usersPath = path.join(process.cwd(), 'src/app/data/users.json');

export async function GET(request: NextRequest) {
  try {
    const email = request.headers.get('email');
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Check profiles.json FIRST (resume data)
    let profile = null;
    if (fs.existsSync(profilesPath)) {
      const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
      profile = profiles.find((p: any) => p.email === email);
    }

    // Fallback to users.json
    if (!profile && fs.existsSync(usersPath)) {
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
      const user = users.find((u: any) => u.email === email);
      if (user) {
        profile = { email: user.email, name: user.name, resume: user.resume };
      }
    }

    // Default empty profile
    if (!profile) {
      profile = { email, resume: null, parsedResume: null };
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Profile Error:', error);
    return NextResponse.json({ error: 'Profile load failed' }, { status: 500 });
  }
}
