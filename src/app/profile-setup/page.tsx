"use client";

import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { apiClient } from "@/lib/api";

export default function ProfileSetup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 🔐 Protect page + load email
  useEffect(() => {
    const storedUserStr = localStorage.getItem("user");
    const storedEmail = localStorage.getItem("email");

    if (storedUserStr) {
      const storedUser = JSON.parse(storedUserStr);
      setEmail(storedUser.email);
    } else if (storedEmail) {
      setEmail(storedEmail);
    } else {
      router.push("/login");
    }
  }, [router]);

  async function handleSave() {
    setMessage("");
    setLoading(true);

    if (!email || !name || !age || !role) {
      setMessage("Please fill all fields");
      setLoading(false);
      return;
    }

    try {
      const data = await apiClient('/api/profile', {
        method: "POST",
        body: JSON.stringify({
          email,
          name,
          age,
          role,
        }),
      });

      if (data.success) {
        router.push("/dashboard");
      } else {
        setMessage(data.error || "Failed to save profile");
      }
    } catch (err: any) {
      setMessage(err.message || "Server error. Try again.");
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at bottom left, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
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
        maxWidth: '500px',
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
          Complete Your Profile
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
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Age</label>
          <input
            placeholder="e.g. 24"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            style={{
              width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
              fontSize: '16px', color: 'white', outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Target Role</label>
          <input
            placeholder="e.g. Frontend Intern"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{
              width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
              fontSize: '16px', color: 'white', outline: 'none'
            }}
          />
        </div>

        {message && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#fca5a5', padding: '12px', borderRadius: '10px', marginBottom: '20px', textAlign: 'center'
          }}>
            {message}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            width: '100%', padding: '16px', background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
            color: 'white', border: 'none', borderRadius: '14px', fontSize: '18px', fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            boxShadow: '0 10px 15px -3px rgba(168, 85, 247, 0.3)',
            transition: 'transform 0.2s'
          }}
        >
          {loading ? 'Saving Details...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
}
