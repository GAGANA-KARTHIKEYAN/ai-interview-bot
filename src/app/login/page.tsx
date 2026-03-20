'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiClient('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ type: 'login', email, password })
      });
      
      if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--gray-900)' }}>
      {/* Left Panel - Branding */}
      <div style={{ 
        flex: '1', 
        background: 'var(--gradient-dark)', 
        padding: '60px',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }} className="branding-panel">
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
          <div style={{ position: 'absolute', top: '10%', left: '10%', width: '400px', height: '400px', background: 'var(--primary-500)', borderRadius: '50%', filter: 'blur(100px)' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '300px', height: '300px', background: 'var(--accent-500)', borderRadius: '50%', filter: 'blur(80px)' }} />
        </div>
        
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '500px' }}>
          <div style={{ 
            width: '48px', height: '48px', borderRadius: '14px', 
            background: 'var(--gradient-primary)', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', 
            fontSize: '24px', fontWeight: '800', marginBottom: '32px',
            color: 'white', boxShadow: 'var(--shadow-glow)'
          }}>
            AI
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: '800', color: 'white', lineHeight: '1.2', marginBottom: '24px', letterSpacing: '-0.02em' }}>
            Welcome Back to <span className="text-gradient">InterviewBot</span>
          </h1>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>
            Ready to ace your next session? Log in to continue your preparation and track your progress.
          </p>
        </div>
        
        <style dangerouslySetInnerHTML={{ __html: `
          .branding-panel { display: none; }
          @media (min-width: 1024px) {
            .branding-panel { display: flex !important; }
          }
        ` }} />
      </div>

      {/* Right Panel - Form */}
      <div style={{ 
        flex: '1', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '40px',
        background: 'var(--gray-50)',
        position: 'relative'
      }}>
        <div className="card animate-slideUp" style={{ width: '100%', maxWidth: '440px', padding: '48px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--gray-900)', marginBottom: '8px' }}>Log In</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '15px' }}>Enter your credentials to access your dashboard</p>
          </div>
          
          <div className="input-group">
            <label>Email Address</label>
            <input
              type="email"
              className="input-field"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && email && password && handleLogin()}
            />
          </div>
          
          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ marginBottom: 0 }}>Password</label>
            </div>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && email && password && handleLogin()}
            />
          </div>
          
          {error && (
            <div className="animate-fadeIn" style={{ 
              background: 'var(--danger-50)', 
              color: 'var(--danger-600)', 
              padding: '12px 16px', 
              borderRadius: 'var(--radius-md)', 
              fontSize: '14px', 
              fontWeight: '500',
              marginBottom: '24px',
              border: '1px solid var(--danger-100)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>⚠️</span> {error}
            </div>
          )}
          
          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="btn btn-primary"
            style={{ width: '100%', padding: '16px', fontSize: '16px', marginBottom: '24px' }}
          >
            {loading ? (
              <>
                <div className="generating-indicator" style={{ borderTopColor: 'white', borderRightColor: 'white', borderBottomColor: 'white', width: '16px', height: '16px' }} />
                Authenticating...
              </>
            ) : 'Sign In'}
          </button>
          
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>
              Don't have an account?{' '}
              <Link href="/signup" style={{ color: 'var(--primary-600)', fontWeight: '600', textDecoration: 'none' }}>
                Create one for free
              </Link>
            </p>
          </div>
        </div>
        
        {/* Mobile Logo Tag */}
        <div style={{ position: 'absolute', top: '40px', left: '40px' }} className="lg:hidden text-gradient font-bold text-xl inline-flex items-center gap-2">
           <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14 }}>AI</div>
           <span style={{ color: 'var(--gray-900)', fontWeight: 700 }}>InterviewBot</span>
        </div>
      </div>
    </div>
  );
}
