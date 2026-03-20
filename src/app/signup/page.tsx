'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

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
        body: JSON.stringify({ type: 'signup', name, email, password })
      });
      
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
          <div style={{ position: 'absolute', top: '5%', right: '15%', width: '450px', height: '450px', background: 'var(--primary-400)', borderRadius: '50%', filter: 'blur(120px)' }} />
          <div style={{ position: 'absolute', bottom: '20%', left: '5%', width: '350px', height: '350px', background: 'var(--accent-600)', borderRadius: '50%', filter: 'blur(100px)' }} />
        </div>
        {/* Mobile Logo Tag */}
        <div style={{ position: 'absolute', top: '40px', left: '40px' }} className="mobile-logo">
           <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, marginRight: 8 }}>AI</div>
           <span style={{ color: 'var(--gray-900)', fontWeight: 700, fontSize: '20px' }}>InterviewBot</span>
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
            Start Your <span className="text-gradient">Journey</span> Today
          </h1>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>
            Join thousands of professionals using AI to perfect their interview skills. Create your account in seconds.
          </p>
        </div>
        
        <style dangerouslySetInnerHTML={{ __html: `
          .branding-panel { display: none; }
          @media (min-width: 1024px) {
            .branding-panel { display: flex !important; }
          }
          .mobile-logo { display: flex; }
          @media (min-width: 1024px) {
            .mobile-logo { display: none !important; }
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
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--gray-900)', marginBottom: '8px' }}>Create Account</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '15px' }}>Join AI InterviewBot and start practicing</p>
          </div>
          
          <div className="input-group">
            <label>Full Name</label>
            <input
              className="input-field"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name && email && password && handleSignup()}
            />
          </div>

          <div className="input-group">
            <label>Email Address</label>
            <input
              type="email"
              className="input-field"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name && email && password && handleSignup()}
            />
          </div>
          
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name && email && password && handleSignup()}
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
            onClick={handleSignup}
            disabled={loading || !name || !email || !password}
            className="btn btn-primary"
            style={{ width: '100%', padding: '16px', fontSize: '16px', marginBottom: '24px' }}
          >
            {loading ? (
              <>
                <div className="generating-indicator" style={{ borderTopColor: 'white', borderRightColor: 'white', borderBottomColor: 'white', width: '16px', height: '16px' }} />
                Creating...
              </>
            ) : 'Create Account'}
          </button>
          
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--primary-600)', fontWeight: '600', textDecoration: 'none' }}>
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
