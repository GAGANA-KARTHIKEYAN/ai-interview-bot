'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  // ========== YOUR ORIGINAL STATES ==========
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ========== INTERVIEW STATES ==========
  const [currentTab, setCurrentTab] = useState<'profile' | 'interview'>('profile');
  const [interviewStep, setInterviewStep] = useState<'start' | 'upload' | 'skills' | 'interview' | 'feedback' | 'summary'>('start');
  const [interviewFile, setInterviewFile] = useState<File | null>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [previousInterviews, setPreviousInterviews] = useState<any[]>([]);
  const [backendStatus, setBackendStatus] = useState<string>('Checking...');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const answerBoxRef = useRef<HTMLTextAreaElement>(null);
  const cvFileRef = useRef<HTMLInputElement>(null);
  const BACKEND = "http://127.0.0.1:8000";

  // ========== YOUR ORIGINAL FUNCTIONS ==========
  const refreshProfile = useCallback(() => {
    if (!user?.email) return;
    fetch('/api/profile', { 
      headers: { 'email': user.email },
      cache: 'no-store'
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
    
    // Load previous interviews
    const savedInterviews = localStorage.getItem(`interviews_${parsedUser.email}`);
    if (savedInterviews) {
      setPreviousInterviews(JSON.parse(savedInterviews));
    }
    
    // Check backend status
    checkBackendStatus();
    
    setLoading(false);
  }, [router, refreshProfile]);

  // Check if backend is running
  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${BACKEND}/`, { 
        method: 'GET',
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });
      if (response.ok) {
        setBackendStatus('✅ Backend is running');
      } else {
        setBackendStatus('❌ Backend error');
      }
    } catch (err) {
      setBackendStatus('❌ Backend not running');
    }
  };

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
        refreshProfile();
        router.refresh();
      } else {
        alert('Upload failed: ' + data.error);
      }
    } catch (err) {
      alert('Upload error');
    }
    setUploading(false);
  };

  const deleteResume = async () => {
    if (!user?.email || !confirm('Delete resume?')) return;
    try {
      const res = await fetch('/api/resume', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      if (res.ok) {
        refreshProfile();
        router.refresh();
      }
    } catch (err) {
      alert('Delete error');
    }
  };

  const parseResume = async () => {
    if (!profile?.resume) return alert('Upload resume first');
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

  // ========== SIMPLIFIED INTERVIEW FUNCTIONS ==========
  const analyzeCV = async () => {
    const cv = cvFileRef.current?.files?.[0];
    if (!cv) {
      alert("Please upload your CV");
      return;
    }

    setIsAnalyzing(true);
    const status = document.getElementById("interview-uploadStatus") as HTMLElement;
    if (status) status.innerText = "🔍 Analyzing CV...";

    const fd = new FormData();
    fd.append("cv", cv);

    try {
      // Set timeout for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const res = await fetch(`${BACKEND}/upload-and-analyze`, {
        method: "POST",
        body: fd,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      console.log("Backend response:", data); // Debug log
      
      const matchedSkills = data.matched_skills || [];
      
      if (matchedSkills.length === 0) {
        alert("No skills matched. Try another CV.");
        if (status) status.innerText = "❌ No skills found";
        setIsAnalyzing(false);
        return;
      }

      setSkills(matchedSkills);
      
      const list = document.getElementById("interview-skillsList") as HTMLElement;
      if (list) {
        list.innerHTML = "";
        matchedSkills.forEach((s: any) => {
          const skillTag = document.createElement('span');
          skillTag.className = 'skill-tag';
          skillTag.textContent = s.skill;
          list.appendChild(skillTag);
        });
      }

      setInterviewStep('skills');
      if (status) status.innerText = "✅ Analysis complete!";
    } catch (err: any) {
      console.error("CV Analysis error:", err);
      
      if (err.name === 'AbortError') {
        alert("Request timed out. The backend might be slow or not responding.");
      } else {
        alert(`Backend error: ${err.message}\n\nMake sure backend is running:\ncd ai-interview-backend && python -m uvicorn app:app --reload --port 8000`);
      }
      
      if (status) status.innerText = "❌ Failed to analyze CV";
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startInterview = async () => {
    setCurrentIndex(0);
    setResults([]);
    setInterviewStep('interview');
    
    // Load first question
    if (skills.length > 0) {
      const skill = skills[0]?.skill;
      setCurrentQuestion(`Tell me about your experience with ${skill}`);
      const title = document.getElementById("interview-skillTitle") as HTMLElement;
      if (title) title.innerText = `Skill 1/${skills.length}: ${skill}`;
    }
  };

  const startVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("🎤 Voice input only works in Chrome/Edge");
      return;
    }
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.onstart = () => {
      if (answerBoxRef.current) {
        answerBoxRef.current.value = "🎤 Listening...";
      }
    };
    recognition.onresult = (e: any) => {
      if (answerBoxRef.current && e.results[0][0].transcript) {
        answerBoxRef.current.value = e.results[0][0].transcript;
      }
    };
    recognition.onerror = () => {
      if (answerBoxRef.current) {
        answerBoxRef.current.value = "Voice recognition failed. Please type your answer.";
      }
    };
    recognition.start();
  };

  const submitAnswer = async () => {
    const answer = answerBoxRef.current?.value || '';
    if (!answer.trim()) return alert('Please answer the question');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${BACKEND}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: currentQuestion, 
          answer: answer 
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      const e = data.evaluation;

      const feedback = `Capability: ${e.capability}
Confidence: ${e.confidence_level}

Reasoning: ${e.reasoning}

Ideal Answer: ${e.ideal_answer}`;
      
      setFeedbackText(feedback);

      // Save result
      const newResult = { 
        skill: skills[currentIndex]?.skill || 'Unknown', 
        capability: e.capability,
        confidence: e.confidence_level,
        reasoning: e.reasoning,
        ideal_answer: e.ideal_answer,
        question: currentQuestion,
        answer: answer
      };
      
      setResults([...results, newResult]);
      setInterviewStep('feedback');

    } catch (err: any) {
      console.error("Evaluation error:", err);
      
      if (err.name === 'AbortError') {
        alert("Evaluation timed out. Using mock feedback.");
        // Fallback to mock feedback
        const mockFeedback = `Capability: medium
Confidence: medium

Reasoning: Your answer was received but could not be evaluated by AI.

Ideal Answer: The AI evaluation service is currently unavailable.`;
        setFeedbackText(mockFeedback);
        
        const mockResult = { 
          skill: skills[currentIndex]?.skill || 'Unknown', 
          capability: 'medium',
          confidence: 'medium',
          reasoning: 'AI evaluation service unavailable',
          ideal_answer: 'Service temporarily down',
          question: currentQuestion,
          answer: answer
        };
        
        setResults([...results, mockResult]);
        setInterviewStep('feedback');
      } else {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const nextSkill = () => {
    if (currentIndex + 1 < skills.length) {
      setCurrentIndex(currentIndex + 1);
      setCurrentQuestion(`Tell me about your experience with ${skills[currentIndex + 1]?.skill}`);
      const title = document.getElementById("interview-skillTitle") as HTMLElement;
      if (title) title.innerText = `Skill ${currentIndex + 2}/${skills.length}: ${skills[currentIndex + 1]?.skill}`;
      if (answerBoxRef.current) answerBoxRef.current.value = '';
      setInterviewStep('interview');
    } else {
      saveInterviewResults();
    }
  };

  const saveInterviewResults = () => {
    if (!user?.email) return;
    
    const interviewData = {
      id: Date.now(),
      date: new Date().toISOString(),
      skills: skills.map(s => s.skill),
      results: results,
      overallScore: calculateOverallScore(results),
      feedback: feedbackText
    };

    // Save to localStorage
    const savedInterviews = JSON.parse(localStorage.getItem(`interviews_${user.email}`) || '[]');
    savedInterviews.push(interviewData);
    localStorage.setItem(`interviews_${user.email}`, JSON.stringify(savedInterviews));
    setPreviousInterviews(savedInterviews);
    
    setInterviewStep('summary');
  };

  const calculateOverallScore = (results: any[]) => {
    if (results.length === 0) return 0;
    const scores: Record<string, number> = { strong: 3, medium: 2, weak: 1 };
    const total = results.reduce((sum, r) => sum + (scores[r.capability?.toLowerCase()] || 1), 0);
    return Math.round((total / (results.length * 3)) * 100);
  };

  const viewInterviewFeedback = (interview: any) => {
    setResults(interview.results || []);
    setSkills((interview.skills || []).map((s: string) => ({ skill: s })));
    setInterviewStep('summary');
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Loading...</p>
    </div>;
  }

  return (
    <div style={{ minHeight: '100vh', padding: '40px 20px', background: '#f8fafc' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .card, .interview-card { 
          background: white; 
          padding: 30px; 
          border-radius: 12px; 
          box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
          margin-bottom: 20px; 
        }
        .hidden { display: none !important; }
        .skill-tag { 
          display: inline-block; 
          background: linear-gradient(135deg, #e0e7ff, #ecfeff); 
          color: #1e3a8a; 
          padding: 8px 16px; 
          border-radius: 999px; 
          margin: 6px; 
          font-weight: 600; 
        }
        .interview-btn { 
          padding: 12px 24px; 
          border-radius: 8px; 
          border: none; 
          background: #3b82f6; 
          color: white; 
          font-size: 16px; 
          cursor: pointer; 
          margin: 10px; 
        }
        .interview-textarea { 
          width: 100%; 
          height: 140px; 
          padding: 12px; 
          border-radius: 8px; 
          border: 1px solid #d1d5db; 
          font-family: inherit; 
          resize: vertical; 
          margin: 15px 0; 
        }
        .backend-status {
          padding: 8px 16px;
          border-radius: 8px;
          margin: 10px 0;
          font-size: 14px;
        }
        .status-good { background: #d1fae5; color: #065f46; }
        .status-bad { background: #fee2e2; color: #991b1b; }
        .status-checking { background: #fef3c7; color: #92400e; }
      ` }} />

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', color: '#1e293b' }}>Welcome, <strong>{user?.name}</strong></h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setCurrentTab('profile')}
              style={{ 
                padding: '12px 24px', 
                background: currentTab === 'profile' ? '#10b981' : '#e5e7eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Profile
            </button>
            <button 
              onClick={() => { 
                setCurrentTab('interview'); 
                setInterviewStep('start'); 
              }}
              style={{ 
                padding: '12px 24px', 
                background: currentTab === 'interview' ? '#3b82f6' : '#e5e7eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              🤖 AI Interview
            </button>
            <button 
              onClick={logout}
              style={{ padding: '12px 24px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* BACKEND STATUS INDICATOR */}
        {currentTab === 'interview' && (
          <div style={{ marginBottom: '20px' }}>
            <div className={`backend-status ${
              backendStatus.includes('✅') ? 'status-good' : 
              backendStatus.includes('❌') ? 'status-bad' : 'status-checking'
            }`}>
              {backendStatus}
            </div>
          </div>
        )}

        {/* ========== YOUR ORIGINAL PROFILE TAB ========== */}
        {currentTab === 'profile' && (
          <div className="card">
            <h2 style={{ marginTop: 0, color: '#334155' }}>Profile</h2>
            <p><strong>Email:</strong> {user?.email}</p>
            
            {profile?.resume ? (
              <div>
                <p style={{ color: '#059669' }}>✅ Resume uploaded</p>
                <a href={profile.resume} target="_blank" style={{ 
                  display: 'inline-block',
                  padding: '10px 20px', 
                  background: '#3b82f6', 
                  color: 'white', 
                  textDecoration: 'none', 
                  borderRadius: '8px',
                  margin: '10px 0'
                }}>
                  📄 View PDF
                </a>
                <br/><br/>
                <button onClick={parseResume} disabled={parsing} style={{ 
                  padding: '12px 24px', 
                  background: parsing ? '#d1d5db' : '#8b5cf6', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px',
                  marginRight: '10px'
                }}>
                  {parsing ? 'Parsing...' : '🔍 Parse Resume'}
                </button>
                <button onClick={deleteResume} style={{ 
                  padding: '12px 24px', 
                  background: '#ef4444', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px' 
                }}>
                  🗑️ Delete
                </button>
              </div>
            ) : (
              <div>
                <input ref={fileInputRef} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ 
                  width: '100%', 
                  padding: '12px', 
                  marginBottom: '15px', 
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px'
                }} />
                <button onClick={uploadResume} disabled={uploading || !file} style={{ 
                  padding: '12px 24px', 
                  background: uploading || !file ? '#d1d5db' : '#10b981', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px' 
                }}>
                  {uploading ? 'Uploading...' : '📤 Upload Resume'}
                </button>
              </div>
            )}
            
            {profile?.parsedResume && (
              <>
                <hr style={{ margin: '30px 0', border: 'none', height: '1px', background: '#e2e8f0' }} />
                <h3 style={{ color: '#475569' }}>Skills Extracted</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                  {profile.parsedResume.skills?.slice(0, 12).map((skill: string, i: number) => (
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
        )}

        {/* ========== AI INTERVIEW TAB ========== */}
        {currentTab === 'interview' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            {/* START SCREEN */}
            {interviewStep === 'start' && (
              <div className="interview-card" style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#3b82f6' }}>🤖 AI Technical Interview</h2>
                <p style={{ fontSize: '18px', color: '#6b7280' }}>Upload CV → Match skills → Unlimited questions → Instant feedback + voice</p>
                
                {previousInterviews.length > 0 && (
                  <div style={{ marginTop: '30px', textAlign: 'left' }}>
                    <h3 style={{ color: '#475569' }}>📊 Previous Interviews</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '15px' }}>
                      {previousInterviews.slice().reverse().slice(0, 3).map((interview: any) => (
                        <div key={interview.id} style={{
                          background: '#f0f9ff',
                          padding: '20px',
                          borderRadius: '12px',
                          border: '1px solid #e0f2fe',
                          minWidth: '250px',
                          flex: '1 1 250px'
                        }}>
                          <p><strong>Date:</strong> {new Date(interview.date).toLocaleDateString()}</p>
                          <p><strong>Score:</strong> {interview.overallScore}%</p>
                          <p><strong>Skills:</strong> {interview.skills?.slice(0, 2).join(', ')}...</p>
                          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button 
                              onClick={() => viewInterviewFeedback(interview)}
                              style={{ 
                                padding: '8px 16px', 
                                background: '#10b981', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '6px', 
                                cursor: 'pointer',
                                flex: 1
                              }}
                            >
                              View Feedback
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div style={{ marginTop: '30px' }}>
                  <button 
                    className="interview-btn" 
                    onClick={() => setInterviewStep('upload')}
                    style={{ 
                      background: '#10b981', 
                      padding: '16px 40px', 
                      fontSize: '18px',
                      margin: '10px'
                    }}
                  >
                    🚀 Start New Interview
                  </button>
                  <br/>
                  <button 
                    onClick={checkBackendStatus}
                    style={{ 
                      padding: '8px 16px', 
                      background: '#e5e7eb', 
                      color: '#374151', 
                      border: 'none', 
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      marginTop: '10px'
                    }}
                  >
                    🔄 Check Backend Status
                  </button>
                </div>
              </div>
            )}

            {/* UPLOAD STEP */}
            {interviewStep === 'upload' && (
              <div className="interview-card">
                <h3>📤 Upload Your CV (PDF or DOCX)</h3>
                <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                  The AI will analyze your CV and extract relevant skills for the interview.
                </p>
                
                <input 
                  ref={cvFileRef} 
                  type="file" 
                  accept=".pdf,.docx" 
                  style={{ 
                    width: '100%', 
                    padding: '20px', 
                    margin: '20px 0', 
                    border: '2px dashed #3b82f6', 
                    borderRadius: '8px',
                    background: '#eff6ff',
                    cursor: 'pointer'
                  }} 
                />
                
                <div id="interview-uploadStatus" style={{ 
                  padding: '10px', 
                  margin: '10px 0',
                  borderRadius: '6px',
                  background: '#f8fafc'
                }}></div>
                
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    className="interview-btn" 
                    onClick={() => setInterviewStep('start')}
                    style={{ background: '#6b7280' }}
                  >
                    ← Back
                  </button>
                  <button 
                    className="interview-btn" 
                    onClick={analyzeCV}
                    disabled={isAnalyzing}
                    style={{ 
                      background: isAnalyzing ? '#d1d5db' : '#10b981',
                      opacity: isAnalyzing ? 0.7 : 1
                    }}
                  >
                    {isAnalyzing ? '🔍 Analyzing...' : '🔍 Analyze Skills'}
                  </button>
                </div>
              </div>
            )}

            {/* SKILLS STEP */}
            {interviewStep === 'skills' && (
              <div className="interview-card">
                <h3 style={{ color: '#10b981' }}>✅ Skills Found In Your CV</h3>
                <div id="interview-skillsList" style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '10px', 
                  margin: '20px 0', 
                  padding: '20px',
                  background: '#f0fdf4',
                  borderRadius: '12px',
                  minHeight: '80px'
                }}></div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="interview-btn" 
                    onClick={() => setInterviewStep('upload')}
                    style={{ background: '#6b7280' }}
                  >
                    ← Back
                  </button>
                  <button 
                    className="interview-btn" 
                    onClick={startInterview}
                    style={{ background: '#8b5cf6' }}
                  >
                    🚀 Start Interview
                  </button>
                </div>
              </div>
            )}

            {/* INTERVIEW STEP */}
            {interviewStep === 'interview' && (
              <div className="interview-card">
                <h4 id="interview-skillTitle" style={{ color: '#059669', fontSize: '18px', marginBottom: '20px' }}>
                  Skill {currentIndex + 1}/{skills.length}: {skills[currentIndex]?.skill || 'Loading...'}
                </h4>
                
                <div style={{ 
                  background: '#f8fafc', 
                  padding: '25px', 
                  borderRadius: '12px', 
                  marginBottom: '20px',
                  border: '1px solid #e5e7eb'
                }}>
                  <h4 style={{ marginTop: 0, color: '#334155' }}>Question:</h4>
                  <p id="interview-questionText" style={{ 
                    fontSize: '18px', 
                    lineHeight: '1.6',
                    color: '#1f2937'
                  }}>
                    {currentQuestion || "Loading question..."}
                  </p>
                </div>
                
                <textarea 
                  ref={answerBoxRef} 
                  className="interview-textarea" 
                  placeholder="Type your answer here or use voice input..."
                />
                
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  <button 
                    className="interview-btn" 
                    onClick={startVoiceInput}
                    style={{ background: '#8b5cf6' }}
                  >
                    🎤 Voice Input
                  </button>
                  <button 
                    className="interview-btn" 
                    onClick={submitAnswer}
                    style={{ background: '#10b981' }}
                  >
                    📤 Submit Answer
                  </button>
                </div>
              </div>
            )}

            {/* FEEDBACK STEP */}
            {interviewStep === 'feedback' && (
              <div className="interview-card">
                <h3 style={{ color: '#8b5cf6' }}>🤖 AI Feedback</h3>
                
                <div style={{ 
                  background: '#f0f9ff', 
                  padding: '25px', 
                  borderRadius: '12px', 
                  whiteSpace: 'pre-wrap',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  marginBottom: '20px',
                  border: '1px solid #e0f2fe'
                }}>
                  {feedbackText || "Loading feedback..."}
                </div>
                
                <button 
                  className="interview-btn" 
                  onClick={nextSkill}
                  style={{ background: '#3b82f6' }}
                >
                  {currentIndex + 1 < skills.length ? '➡️ Next Skill' : '📊 Finish Interview'}
                </button>
              </div>
            )}

            {/* SUMMARY STEP */}
            {interviewStep === 'summary' && (
              <div className="interview-card">
                <h2 style={{ color: '#10b981', textAlign: 'center' }}>🎉 Interview Complete!</h2>
                
                {/* Overall Score */}
                <div style={{ 
                  background: 'linear-gradient(135deg, #ecfeff, #f0fdf4)', 
                  padding: '30px', 
                  borderRadius: '12px', 
                  margin: '20px 0',
                  textAlign: 'center',
                  border: '1px solid #a7f3d0'
                }}>
                  <h3 style={{ color: '#059669', margin: 0 }}>Overall Score: {calculateOverallScore(results)}%</h3>
                </div>

                {/* Results Summary */}
                <div style={{ marginBottom: '30px' }}>
                  <h4 style={{ color: '#475569' }}>📊 Skill Performance</h4>
                  <div style={{ 
                    background: '#f8fafc', 
                    padding: '20px', 
                    borderRadius: '8px',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    {results.length > 0 ? (
                      results.map((r, i) => (
                        <div key={i} style={{ 
                          padding: '15px', 
                          margin: '10px 0', 
                          background: 'white', 
                          borderRadius: '8px',
                          borderLeft: `4px solid ${
                            r.capability === 'strong' ? '#10b981' : 
                            r.capability === 'medium' ? '#f59e0b' : '#ef4444'
                          }`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '16px' }}>{r.skill}</strong>
                            <span style={{ 
                              padding: '5px 15px', 
                              background: r.capability === 'strong' ? '#d1fae5' : 
                                        r.capability === 'medium' ? '#fef3c7' : '#fee2e2',
                              color: r.capability === 'strong' ? '#065f46' : 
                                    r.capability === 'medium' ? '#92400e' : '#991b1b',
                              borderRadius: '20px',
                              fontWeight: 'bold',
                              fontSize: '14px'
                            }}>
                              {r.capability?.toUpperCase() || 'UNKNOWN'}
                            </span>
                          </div>
                          {r.reasoning && (
                            <p style={{ marginTop: '10px', fontSize: '14px', color: '#6b7280' }}>
                              {r.reasoning}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p style={{ textAlign: 'center', color: '#6b7280' }}>No results available</p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
                  <button 
                    className="interview-btn" 
                    onClick={() => setInterviewStep('start')}
                    style={{ background: '#6b7280' }}
                  >
                    🏠 Back to Dashboard
                  </button>
                  <button 
                    className="interview-btn" 
                    onClick={() => setInterviewStep('upload')}
                    style={{ background: '#3b82f6' }}
                  >
                    🔄 Retake Interview
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}