export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const resumesDir = path.join(process.cwd(), 'public/uploads/resumes');
const profilesPath = path.join(process.cwd(), 'src/app/data/profiles.json');

// Create directories if missing
if (!fs.existsSync(resumesDir)) {
  fs.mkdirSync(resumesDir, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume') as File | null;
    const email = formData.get('email') as string | null;

    if (!file || !email) {
      return NextResponse.json({ error: 'Missing file or email' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files allowed' }, { status: 400 });
    }

    // Generate filename and save (OVERWRITES old file)
    const safeEmail = email.replace(/[@.]/g, '_');
    const fileName = `${safeEmail}.pdf`;
    const filePath = path.join(resumesDir, fileName);
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    fs.writeFileSync(filePath, buffer);

    // Update profiles.json (clear old parsed data)
    let profiles: any[] = [];
    if (fs.existsSync(profilesPath)) {
      try {
        profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
      } catch {
        profiles = [];
      }
    }

    const userIndex = profiles.findIndex((p: any) => p.email === email);
    const profileData = {
      email,
      resume: `/uploads/resumes/${fileName}`,
      parsedResume: null,  // Reset parsing
      updatedAt: new Date().toISOString()
    };

    if (userIndex > -1) {  // FIXED: was userIndex > - -1
      profiles[userIndex] = profileData;
    } else {
      profiles.push(profileData);
    }

    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));

    return NextResponse.json({ 
      success: true, 
      resumeUrl: `/uploads/resumes/${fileName}`
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    
    let email: string;
    if (contentType?.includes('application/json')) {
      const body = await request.json();
      email = body.email;
    } else {
      const formData = await request.formData();
      email = formData.get('email') as string;
    }

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    console.log('DELETE request for email:', email);

    // Delete PDF file
    const safeEmail = email.replace(/[@.]/g, '_');
    const fileName = `${safeEmail}.pdf`;
    const filePath = path.join(resumesDir, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Deleted file:', filePath);
    }

    // Clear from profiles.json
    let profiles: any[] = [];
    if (fs.existsSync(profilesPath)) {
      profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
    }

    const userIndex = profiles.findIndex((p: any) => p.email === email);
    if (userIndex > -1) {
      profiles[userIndex].resume = null;
      profiles[userIndex].parsedResume = null;
      fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));
      console.log('Cleared profile data');
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE ERROR:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
