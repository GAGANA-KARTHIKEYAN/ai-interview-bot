'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 100%)',
      color: 'white',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Floating orbs background */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          top: '-10%', right: '-5%', animation: 'float 6s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
          bottom: '10%', left: '-5%', animation: 'float 8s ease-in-out infinite 1s',
        }} />
        <div style={{
          position: 'absolute', width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)',
          top: '50%', left: '50%', animation: 'float 7s ease-in-out infinite 2s',
        }} />
      </div>

      {/* Navigation */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 40px', position: 'relative', zIndex: 10, maxWidth: 1200, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800,
          }}>
            AI
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>InterviewBot</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/login" style={{
            padding: '10px 22px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.15)', color: 'white',
            fontSize: 14, fontWeight: 500, transition: 'all 0.25s',
            background: 'rgba(255,255,255,0.05)',
          }}>
            Log In
          </Link>
          <Link href="/signup" style={{
            padding: '10px 22px', borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white', fontSize: 14, fontWeight: 600,
            boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
          }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '80px 40px 60px',
        textAlign: 'center', position: 'relative', zIndex: 10,
      }}>
        <div className="animate-fadeInUp" style={{ marginBottom: 24 }}>
          <span style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: 50,
            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
            fontSize: 13, fontWeight: 600, color: '#a5b4fc', letterSpacing: '0.03em',
          }}>
            ✨ Powered by Advanced AI
          </span>
        </div>

        <h1 className="animate-fadeInUp" style={{
          fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 800,
          lineHeight: 1.1, marginBottom: 24, letterSpacing: '-0.03em',
        }}>
          Ace Your Next<br />
          <span style={{
            background: 'linear-gradient(135deg, #818cf8, #a78bfa, #c084fc)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Technical Interview
          </span>
        </h1>

        <p className="animate-fadeInUp" style={{
          fontSize: 'clamp(16px, 2vw, 20px)', color: 'rgba(255,255,255,0.6)',
          maxWidth: 580, margin: '0 auto 48px', lineHeight: 1.7,
        }}>
          Practice with AI-driven interviews that adapt to your skill level. Get instant, detailed feedback on your performance & confidence.
        </p>

        <div className="animate-fadeInUp" style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" style={{
            padding: '16px 36px', borderRadius: 14,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white', fontSize: 17, fontWeight: 700,
            boxShadow: '0 8px 30px rgba(99,102,241,0.4)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            Start Practicing Free →
          </Link>
          <Link href="/login" style={{
            padding: '16px 36px', borderRadius: 14,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'white', fontSize: 17, fontWeight: 600,
            backdropFilter: 'blur(10px)',
          }}>
            I Have an Account
          </Link>
        </div>
      </div>

      {/* Feature Cards */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '40px 40px 100px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 24, position: 'relative', zIndex: 10,
      }}>
        {[
          {
            icon: '📄', title: 'Smart Resume Analysis',
            desc: 'Upload your CV and our AI extracts your key skills, experience, and tech stack to build a personalized interview.',
          },
          {
            icon: '🎯', title: 'Adaptive Questions',
            desc: 'Questions dynamically adjust based on your answers. Struggle? We drill down. Excel? We push harder.',
          },
          {
            icon: '📊', title: 'Instant Feedback',
            desc: 'Get detailed scoring, strengths analysis, and actionable improvement tips after every session.',
          },
        ].map((feat, i) => (
          <div key={i} className="glass-card-dark animate-fadeInUp" style={{
            padding: 32, animationDelay: `${i * 0.15}s`, animationFillMode: 'both',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(99,102,241,0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 24, marginBottom: 16,
            }}>
              {feat.icon}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: 'white' }}>
              {feat.title}
            </h3>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              {feat.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center', padding: '30px 40px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        color: 'rgba(255,255,255,0.3)', fontSize: 13, position: 'relative', zIndex: 10,
      }}>
        © 2026 AI InterviewBot. Built with ❤️ and AI.
      </div>
    </div>
  );
}