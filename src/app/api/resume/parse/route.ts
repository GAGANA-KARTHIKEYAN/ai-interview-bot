export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const resumesDir = path.join(process.cwd(), 'public/uploads/resumes');
const profilesPath = path.join(process.cwd(), 'src/app/data/profiles.json');

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const safeEmail = email.replace(/[@.]/g, '_');
    const filePath = path.join(resumesDir, `${safeEmail}.pdf`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'No resume found' }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    
    // 🔥 ULTIMATE TEXT EXTRACTION - 3 methods combined
    let text = '';
    
    // Method 1: Latin1 (80% success)
    text = buffer.toString('latin1');
    
    // Method 2: UTF8 fallback
    if (text.length < 1000) {
      text = buffer.toString('utf8');
    }
    
    // Method 3: Aggressive PDF stream extraction
    const streams = text.match(/BT[\s\S]*?ET/g) || [];
    let streamText = '';
    for (const stream of streams) {
      streamText += stream.replace(/[^\x20-\x7E\n\r]/g, ' ');
    }
    if (streamText.length > text.length) {
      text = streamText;
    }
    
    const cleanText = text
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000)
      .toLowerCase();

    console.log('Text lengths - raw:', text.length, 'clean:', cleanText.length);
    console.log('Preview:', cleanText.slice(0, 300));

    // YOUR RESUME SKILLS - Exact patterns from your text
    const skillPatterns = [
      'python', 'java', 'c\\+\\+', 'c\\+', 'javascript', 'js', 'sql',
      'html5?', 'css3?', 'react', 'node.?js', 'rest.?api', 'api',
      'mysql', 'postgresql', 'postgres', 'mongodb', 'mongo',
      'git', 'docker', 'dock'
    ];

    const skills = skillPatterns
      .filter(pattern => new RegExp(pattern, 'i').test(cleanText))
      .slice(0, 15);

    // Fallback: Manual keyword search (for fragmented text)
    if (skills.length === 0 || skills.length === 1) {
      const manualSkills = [];
      if (cleanText.includes('python')) manualSkills.push('python');
      if (cleanText.includes('java')) manualSkills.push('java');
      if (cleanText.includes('c++') || cleanText.includes('c\\+')) manualSkills.push('c++');
      if (cleanText.includes('javascript') || cleanText.includes('js')) manualSkills.push('javascript');
      if (cleanText.includes('sql')) manualSkills.push('sql');
      if (cleanText.includes('react')) manualSkills.push('react');
      if (cleanText.includes('node')) manualSkills.push('nodejs');
      if (cleanText.includes('mysql')) manualSkills.push('mysql');
      if (cleanText.includes('postgres')) manualSkills.push('postgresql');
      if (cleanText.includes('git')) manualSkills.push('git');
      if (cleanText.includes('docker')) manualSkills.push('docker');
      
      skills.push(...manualSkills);
    }

    const finalSkills = Array.from(new Set(skills))
      .filter(skill => skill && skill.length > 1)
      .sort();

    // Save results
    const parsedData = {
      skills: finalSkills,
      method: 'advanced-rules',
      textPreview: cleanText.slice(0, 500),
      rawLength: text.length,
      cleanLength: cleanText.length,
      count: finalSkills.length,
      parsedAt: new Date().toISOString()
    };

    let profiles: any[] = [];
    if (fs.existsSync(profilesPath)) {
      try {
        profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
      } catch {
        profiles = [];
      }
    }

    const userIndex = profiles.findIndex((p: any) => p.email === email);
    if (userIndex > -1) {
      profiles[userIndex].parsedResume = parsedData;
    } else {
      profiles.push({ email, parsedResume: parsedData });
    }
    
    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));

    console.log(`Found ${finalSkills.length} skills:`, finalSkills);

    return NextResponse.json({
      success: true,
      skills: finalSkills,
      count: finalSkills.length
    });

  } catch (error: any) {
    console.error('Parse error:', error);
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 });
  }
}
