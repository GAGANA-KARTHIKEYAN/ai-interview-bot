'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'signup', name, email, password })
      });
      const data = await res.json();
      
      if (data.success) {
        router.push('/login');
      } else {
        setError(data.error || 'Signup failed');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#f3f4f6' 
    }}>
      <div style={{ 
        padding: '40px', 
        background: 'white', 
        borderRadius: '12px', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#1f2937' }}>Sign Up</h1>
        
        <input
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #d1d5db',
            borderRadius: '8px', fontSize: '16px'
          }}
        />
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #d1d5db',
            borderRadius: '8px', fontSize: '16px'
          }}
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #d1d5db',
            borderRadius: '8px', fontSize: '16px'
          }}
        />
        
        {error && (
          <p style={{ color: '#ef4444', marginBottom: '16px', textAlign: 'center' }}>
            {error}
          </p>
        )}
        
        <button
          onClick={handleSignup}
          disabled={loading || !name || !email || !password}
          style={{
            width: '100%', padding: '14px', background: '#10b981', color: 'white',
            border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '500',
            cursor: loading || !name || !email || !password ? 'not-allowed' : 'pointer',
            opacity: loading || !name || !email || !password ? 0.6 : 1
          }}
        >
          {loading ? 'Creating...' : 'Create Account'}
        </button>
        
        <p style={{ textAlign: 'center', marginTop: '20px', color: '#6b7280' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#3b82f6', textDecoration: 'none' }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
