export default function Home() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ 
        fontSize: '48px', 
        marginBottom: '20px', 
        fontWeight: '700' 
      }}>
        AI Interview Bot
      </h1>
      <p style={{ fontSize: '20px', marginBottom: '40px', maxWidth: '500px' }}>
        Prepare smarter. Interview better. Get hired faster.
      </p>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <a 
          href="/login"
          style={{
            padding: '16px 32px',
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '500',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}
        >
          Login
        </a>
        <a 
          href="/signup"
          style={{
            padding: '16px 32px',
            background: 'rgba(255,255,255,0.9)',
            color: '#1f2937',
            textDecoration: 'none',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '500'
          }}
        >
          Get Started
        </a>
      </div>
    </div>
  );
}
