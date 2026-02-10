'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // FIXED: Always refresh profile
  const refreshProfile = useCallback(() => {
    if (!user?.email) return;
    fetch('/api/profile', { 
      headers: { 'email': user.email },
      cache: 'no-store' // Prevent caching issues
    })
      .then(res => {
        if (!res.ok) throw new Error('Profile fetch failed');
        return res.json();
      })
      .then(setProfile)
      .catch(err => {
        console.error('Profile refresh failed:', err);
        setProfile({ email: user?.email, resume: null, parsedResume: null });
      });
  }, [user?.email]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }
    
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    refreshProfile();
    setLoading(false);
  }, [router, refreshProfile]);

  const uploadResume = async () => {
    if (!file || !user?.email) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('resume', file);
    formData.append('email', user.email);

    try {
      const res = await fetch('/api/resume', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success) {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        refreshProfile(); // Refresh immediately
        router.refresh();  // Hard refresh
      } else {
        alert('Upload failed: ' + data.error);
      }
    } catch (err) {
      alert('Upload error');
    }
    setUploading(false);
  };

  // FIXED: Delete function
  const deleteResume = async () => {
    if (!user?.email || !confirm('Delete resume? This cannot be undone.')) return;
    
    try {
      const res = await fetch('/api/resume', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      
      if (res.ok) {
        refreshProfile();
        router.refresh();
      } else {
        alert('Delete failed');
      }
    } catch (err) {
      alert('Delete error');
    }
  };

  const parseResume = async () => {
    if (!profile?.resume) {
      alert('Upload resume first');
      return;
    }
    
    setParsing(true);
    try {
      const res = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      
      const data = await res.json();
      if (data.success) {
        refreshProfile();
        router.refresh();
      } else {
        alert('Parse failed: ' + data.error);
      }
    } catch (err) {
      alert('Parse error');
    }
    setParsing(false);
  };

  const logout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Loading...</p>
    </div>;
  }

  return (
    <div style={{ minHeight: '100vh', padding: '40px 20px', background: '#f8fafc' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', color: '#1e293b', margin: 0 }}>
            Welcome, <strong>{user?.name}</strong>
          </h1>
          <button onClick={logout} style={{
            padding: '10px 20px', background: '#ef4444', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500'
          }}>
            Logout
          </button>
        </div>

        <div style={{ background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginTop: 0, color: '#334155' }}>Profile</h2>
          <p><strong>Email:</strong> {user?.email}</p>

          <hr style={{ margin: '30px 0', border: 'none', height: '1px', background: '#e2e8f0' }} />

          <h3 style={{ color: '#475569', marginBottom: '20px' }}>Resume Management</h3>
          
          {profile?.resume ? (
            <div style={{ marginBottom: '30px' }}>
              <p style={{ color: '#059669', fontWeight: '500', marginBottom: '15px' }}>
                Resume uploaded
              </p>
              <div style={{ marginBottom: '15px' }}>
                <a 
                  href={profile.resume} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', marginRight: '10px', padding: '10px 20px',
                    background: '#3b82f6', color: 'white', textDecoration: 'none', 
                    borderRadius: '8px', fontWeight: '500'
                  }}
                >
                  View PDF
                </a>
                <button 
                  onClick={deleteResume}
                  style={{
                    padding: '10px 20px', background: '#ef4444', color: 'white',
                    border: 'none', borderRadius: '8px', cursor: 'pointer', 
                    fontWeight: '500', marginLeft: '5px'
                  }}
                >
                  Delete
                </button>
              </div>
              
              {!profile.parsedResume && (
                <button 
                  onClick={parseResume} 
                  disabled={parsing}
                  style={{
                    padding: '12px 24px', background: '#8b5cf6', color: 'white',
                    border: 'none', borderRadius: '8px', cursor: parsing ? 'not-allowed' : 'pointer',
                    opacity: parsing ? 0.6 : 1
                  }}
                >
                  {parsing ? 'Parsing...' : ' Analyze Skills'}
                </button>
              )}
            </div>
          ) : (
            <div>
              <p style={{ color: '#6b7280', marginBottom: '20px' }}>No resume uploaded</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{
                  width: '100%', padding: '12px', marginBottom: '15px', 
                  border: '2px dashed #d1d5db', borderRadius: '8px', 
                  background: '#f8fafc', cursor: 'pointer'
                }}
              />
              <button
                onClick={uploadResume}
                disabled={!file || uploading}
                style={{
                  padding: '12px 24px', background: '#10b981', color: 'white',
                  border: 'none', borderRadius: '8px', cursor: !file || uploading ? 'not-allowed' : 'pointer',
                  opacity: !file || uploading ? 0.6 : 1
                }}
              >
                {uploading ? 'Uploading...' : ' Upload Resume'}
              </button>
            </div>
          )}

          {profile?.parsedResume && (
            <>
              <hr style={{ margin: '30px 0', border: 'none', height: '1px', background: '#e2e8f0' }} />
              <h3 style={{ color: '#475569' }}>Skills Extracted</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                {profile.parsedResume.skills.slice(0, 12).map((skill: string, i: number) => (
                  <span key={i} style={{
                    padding: '6px 12px', background: '#dbeafe', color: '#1e40af',
                    borderRadius: '20px', fontSize: '14px', fontWeight: '500'
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
