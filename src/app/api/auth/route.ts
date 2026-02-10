export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const usersPath = path.join(process.cwd(), 'src/app/data/users.json');

function readUsers() {
  if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, '[]');
    return [];
  }
  return JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
}

function writeUsers(users: any[]) {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

export async function POST(request: NextRequest) {
  try {
    const { type, email, password, name } = await request.json();

    const users = readUsers();

    if (type === 'signup') {
      const exists = users.find((u: any) => u.email === email);
      if (exists) {
        return NextResponse.json({ success: false, error: 'User exists' });
      }
      const newUser = {
        id: Date.now(),
        email,
        password,
        name: name || email.split('@')[0],
        resume: null,
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      writeUsers(users);
      return NextResponse.json({ success: true });
    }

    if (type === 'login') {
      const user = users.find((u: any) => u.email === email && u.password === password);
      if (!user) {
        return NextResponse.json({ success: false, error: 'Invalid credentials' });
      }
      return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
    }

    return NextResponse.json({ success: false, error: 'Invalid type' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
