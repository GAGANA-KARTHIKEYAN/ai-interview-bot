export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top left, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Background Micro-animation logic could go here */}
      <div style={{
        padding: '60px',
        borderRadius: '30px',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        maxWidth: '800px',
        width: '100%',
        animation: 'fadeIn 1s ease-out'
      }}>
        <h1 style={{
          fontSize: '64px',
          marginBottom: '24px',
          fontWeight: '800',
          letterSpacing: '-0.02em',
          background: 'linear-gradient(to right, #60a5fa, #a855f7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Elevate Your Career
        </h1>
        <p style={{
          fontSize: '22px',
          lineHeight: '1.6',
          marginBottom: '48px',
          color: 'rgba(255, 255, 255, 0.8)',
          fontWeight: '400'
        }}>
          Master technical interviews with our AI-powered coach.
          Real-time feedback, dynamic questions, and comprehensive reports.
        </p>

        <div style={{
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <a
            href="/signup"
            style={{
              padding: '18px 48px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '16px',
              fontSize: '20px',
              fontWeight: '600',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
              display: 'inline-block'
            }}
          >
            Get Started Free
          </a>
          <a
            href="/login"
            style={{
              padding: '18px 48px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '16px',
              fontSize: '20px',
              fontWeight: '600',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              transition: 'background 0.2s'
            }}
          >
            Login
          </a>
        </div>

        <div style={{ marginTop: '40px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)' }}>
          🚀 Ready for Demo Mode | <span style={{ color: '#f87171' }}>Note: Persistent storage disabled</span>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        body { margin: 0; }
      `}</style>
    </div>
  );
}