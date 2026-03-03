'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
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
      const data = await apiClient('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ type: 'signup', email, password, name }),
      });
      router.push('/login');
    } catch (err: any) {
      setError(err.message || 'Server error. Try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      padding: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        padding: '50px',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        width: '100%',
        maxWidth: '450px',
        color: 'white'
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '40px',
          fontSize: '32px',
          fontWeight: '700',
          background: 'linear-gradient(to right, #60a5fa, #a855f7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Get Started
        </h1>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Full Name</label>
          <input
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
              fontSize: '16px', color: 'white', outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Email Address</label>
          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
              fontSize: '16px', color: 'white', outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Password</label>
          <input
            type="password"
            placeholder="Min 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
              fontSize: '16px', color: 'white', outline: 'none'
            }}
          />
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#fca5a5', padding: '12px', borderRadius: '10px', marginBottom: '20px', textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSignup}
          disabled={loading || !name || !email || !password}
          style={{
            width: '100%', padding: '16px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white', border: 'none', borderRadius: '14px', fontSize: '18px', fontWeight: '600',
            cursor: loading || !name || !email || !password ? 'not-allowed' : 'pointer',
            opacity: loading || !name || !email || !password ? 0.6 : 1,
            boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)',
            transition: 'transform 0.2s'
          }}
        >
          {loading ? 'Creating Experience...' : 'Create Account'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '30px', color: 'rgba(255,255,255,0.5)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#10b981', textDecoration: 'none', fontWeight: '500' }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
