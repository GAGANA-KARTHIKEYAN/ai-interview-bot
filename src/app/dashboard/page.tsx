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

  // ========== CAMERA STATES ==========
  const [showCamera, setShowCamera] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(180);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const cameraTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ========== TAB SWITCH DETECTION ==========
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [interviewTerminated, setInterviewTerminated] = useState(false);
  const visibilityRef = useRef<boolean>(true);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ========== AUTO-ADVANCE TIMER ==========
  const [answerTimer, setAnswerTimer] = useState(180);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
    
    // Load ALL previous interviews
    const savedInterviews = localStorage.getItem(`interviews_${parsedUser.email}`);
    if (savedInterviews) {
      setPreviousInterviews(JSON.parse(savedInterviews));
    }
    
    checkBackendStatus();
    setLoading(false);
  }, [router, refreshProfile]);

  // ========== TAB SWITCH DETECTION ==========
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isInterviewActive || interviewStep !== 'interview' || interviewTerminated) return;
      
      const isHidden = document.hidden;
      
      if (isHidden && visibilityRef.current) {
        visibilityRef.current = false;
        
        setTabSwitchCount(prev => {
          const newCount = prev + 1;
          
          if (newCount >= 3) {
            setInterviewTerminated(true);
            setShowTabWarning(false);
            
            const invalidAnswer = "INTERVIEW TERMINATED: Tab switching detected 3 times";
            if (answerBoxRef.current) {
              answerBoxRef.current.value = invalidAnswer;
            }
            
            setTimeout(() => {
              submitAnswer(true);
            }, 1000);
            
            alert("Interview terminated due to multiple tab switches.");
            
          } else {
            setShowTabWarning(true);
            
            if (warningTimeoutRef.current) {
              clearTimeout(warningTimeoutRef.current);
            }
            warningTimeoutRef.current = setTimeout(() => {
              setShowTabWarning(false);
            }, 5000);
          }
          
          return newCount;
        });
        
      } else if (!isHidden && !visibilityRef.current) {
        visibilityRef.current = true;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [isInterviewActive, interviewStep, interviewTerminated]);

  // ========== CAMERA FUNCTIONS ==========
  const startCamera = async () => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true 
      });
      
      setCameraStream(stream);
      setIsCameraActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.error("Video play error:", e));
      }
      
      setShowCamera(true);
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera/microphone. Please ensure permissions are granted.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
      });
      setCameraStream(null);
      setIsCameraActive(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
    setShowCamera(false);
  };

  const startVideoRecording = async () => {
    if (!isCameraActive) {
      await startCamera();
      setTimeout(() => {
        beginRecording();
      }, 1000);
    } else {
      beginRecording();
    }
  };

  const beginRecording = () => {
    if (!cameraStream) {
      alert("Camera not initialized. Please try again.");
      return;
    }
    
    try {
      recordedChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(cameraStream, {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `interview_${skills[currentIndex]?.skill || 'answer'}_${Date.now()}.webm`;
        a.click();
        
        const videoAnswer = `[VIDEO RECORDING: ${Math.floor(180 - recordingTimeLeft)} seconds] - Answer captured on video`;
        if (answerBoxRef.current) {
          answerBoxRef.current.value = videoAnswer;
        }
        
        setTimeout(() => {
          submitAnswer();
        }, 1500);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTimeLeft(180);
      
      if (cameraTimerRef.current) {
        clearInterval(cameraTimerRef.current);
      }
      
      cameraTimerRef.current = setInterval(() => {
        setRecordingTimeLeft(prev => {
          if (prev <= 1) {
            stopVideoRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (err) {
      console.error("Recording error:", err);
      alert("Failed to start recording. Please try again.");
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    
    if (cameraTimerRef.current) {
      clearInterval(cameraTimerRef.current);
      cameraTimerRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${BACKEND}/`, { 
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        setBackendStatus('✓ Backend is running');
      } else {
        setBackendStatus('✗ Backend error');
      }
    } catch (err) {
      setBackendStatus('✗ Backend not running');
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

  // ========== INTERVIEW FUNCTIONS ==========
  const analyzeCV = async () => {
    const cv = cvFileRef.current?.files?.[0];
    if (!cv) {
      alert("Please upload your CV");
      return;
    }

    setIsAnalyzing(true);
    const status = document.getElementById("interview-uploadStatus") as HTMLElement;
    if (status) status.innerText = "Analyzing CV...";

    const fd = new FormData();
    fd.append("cv", cv);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

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
      console.log("Backend response:", data);
      
      const matchedSkills = data.matched_skills || [];
      
      if (matchedSkills.length === 0) {
        alert("No skills matched. Try another CV.");
        if (status) status.innerText = "No skills found";
        setIsAnalyzing(false);
        return;
      }

      setSkills(matchedSkills);
      
      const list = document.getElementById("interview-skillsList");
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
      if (status) status.innerText = "Analysis complete!";
    } catch (err: any) {
      console.error("CV Analysis error:", err);
      
      if (err.name === 'AbortError') {
        alert("Request timed out. The backend might be slow or not responding.");
      } else {
        alert(`Backend error: ${err.message}`);
      }
      
      if (status) status.innerText = "Failed to analyze CV";
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startInterview = async () => {
    setCurrentIndex(0);
    setResults([]);
    setInterviewStep('interview');
    setIsInterviewActive(true);
    setTabSwitchCount(0);
    setInterviewTerminated(false);
    
    startAnswerTimer();
    
    if (skills.length > 0) {
      const skill = skills[0]?.skill;
      setCurrentQuestion(`Tell me about your experience with ${skill}`);
      const title = document.getElementById("interview-skillTitle") as HTMLElement;
      if (title) title.innerText = `Skill 1/${skills.length}: ${skill}`;
    }
  };

  const startAnswerTimer = () => {
    setAnswerTimer(180);
    setTimerActive(true);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setAnswerTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          setTimerActive(false);
          
          if (answerBoxRef.current && answerBoxRef.current.value.trim() === '') {
            answerBoxRef.current.value = "[NO ANSWER PROVIDED - TIME EXPIRED]";
          }
          
          submitAnswer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopAnswerTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerActive(false);
  };

  const resetAnswerTimer = () => {
    stopAnswerTimer();
    startAnswerTimer();
  };

  const startVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Voice input only works in Chrome/Edge");
      return;
    }
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => {
      if (answerBoxRef.current) {
        answerBoxRef.current.value = "Listening...";
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

  const submitAnswer = async (isTerminated = false) => {
    stopAnswerTimer();
    stopVideoRecording();
    
    const answer = answerBoxRef.current?.value || '';
    if (!answer.trim() && !isTerminated) {
      alert('Please answer the question');
      resetAnswerTimer();
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${BACKEND}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: currentQuestion, 
          answer: answer,
          terminated: isTerminated,
          tabSwitches: tabSwitchCount
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      const e = data.evaluation;

      const violationNote = isTerminated ? "\n\nINTERVIEW TERMINATED DUE TO MULTIPLE TAB SWITCHES" : 
                           tabSwitchCount > 0 ? `\n\nWarning: Tab switched ${tabSwitchCount} time(s) during this answer` : "";

      const feedback = `Capability: ${e.capability}
Confidence: ${e.confidence_level}

Reasoning: ${e.reasoning}

Ideal Answer: ${e.ideal_answer}${violationNote}`;
      
      setFeedbackText(feedback);

      const newResult = { 
        skill: skills[currentIndex]?.skill || 'Unknown', 
        capability: e.capability,
        confidence: e.confidence_level,
        reasoning: e.reasoning,
        ideal_answer: e.ideal_answer,
        question: currentQuestion,
        answer: answer,
        tabSwitches: tabSwitchCount,
        terminated: isTerminated,
        timestamp: new Date().toISOString()
      };
      
      setResults([...results, newResult]);
      setInterviewStep('feedback');

    } catch (err: any) {
      console.error("Evaluation error:", err);
      
      if (err.name === 'AbortError') {
        alert("Evaluation timed out. Using local feedback.");
        const mockFeedback = `Capability: medium
Confidence: medium

Reasoning: Your answer was received but could not be evaluated.

Ideal Answer: The evaluation service is currently unavailable.`;
        setFeedbackText(mockFeedback);
        
        const mockResult = { 
          skill: skills[currentIndex]?.skill || 'Unknown', 
          capability: 'medium',
          confidence: 'medium',
          reasoning: 'Evaluation service unavailable',
          ideal_answer: 'Service temporarily down',
          question: currentQuestion,
          answer: answer,
          tabSwitches: tabSwitchCount,
          terminated: isTerminated
        };
        
        setResults([...results, mockResult]);
        setInterviewStep('feedback');
      } else {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const nextSkill = () => {
    if (currentIndex + 1 < skills.length && !interviewTerminated) {
      setCurrentIndex(currentIndex + 1);
      setCurrentQuestion(`Tell me about your experience with ${skills[currentIndex + 1]?.skill}`);
      const title = document.getElementById("interview-skillTitle") as HTMLElement;
      if (title) title.innerText = `Skill ${currentIndex + 2}/${skills.length}: ${skills[currentIndex + 1]?.skill}`;
      if (answerBoxRef.current) answerBoxRef.current.value = '';
      
      setTabSwitchCount(0);
      resetAnswerTimer();
      
      setInterviewStep('interview');
    } else {
      saveInterviewResults();
    }
  };

  const saveInterviewResults = () => {
    if (!user?.email) return;
    
    stopCamera();
    
    const interviewData = {
      id: Date.now(),
      date: new Date().toISOString(),
      skills: skills.map(s => s.skill),
      results: results,
      overallScore: calculateOverallScore(results),
      feedback: feedbackText,
      terminated: interviewTerminated,
      totalTabSwitches: results.reduce((sum, r) => sum + (r.tabSwitches || 0), 0)
    };

    // Get ALL existing interviews
    const savedInterviews = JSON.parse(localStorage.getItem(`interviews_${user.email}`) || '[]');
    
    // Add new interview
    savedInterviews.push(interviewData);
    
    // Store ALL interviews back to localStorage
    localStorage.setItem(`interviews_${user.email}`, JSON.stringify(savedInterviews));
    
    // Update state with ALL interviews
    setPreviousInterviews(savedInterviews);
    
    setInterviewStep('summary');
    setIsInterviewActive(false);
  };

  const calculateOverallScore = (results: any[]) => {
    if (results.length === 0) return 0;
    
    const baseScores: Record<string, number> = { strong: 3, medium: 2, weak: 1 };
    let total = results.reduce((sum, r) => sum + (baseScores[r.capability?.toLowerCase()] || 1), 0);
    
    const maxPossible = results.length * 3;
    
    const totalTabSwitches = results.reduce((sum, r) => sum + (r.tabSwitches || 0), 0);
    const penalty = Math.min(totalTabSwitches * 5, 30);
    
    const rawPercentage = (total / maxPossible) * 100;
    const finalPercentage = Math.max(0, rawPercentage - penalty);
    
    return Math.round(finalPercentage);
  };

  const viewInterviewFeedback = (interview: any) => {
    setResults(interview.results || []);
    setSkills((interview.skills || []).map((s: string) => ({ skill: s })));
    setInterviewTerminated(interview.terminated || false);
    setInterviewStep('summary');
  };

  const deleteInterview = (index: number) => {
    if (!user?.email || !confirm('Delete this interview record?')) return;
    
    const updated = [...previousInterviews];
    updated.splice(index, 1);
    
    localStorage.setItem(`interviews_${user.email}`, JSON.stringify(updated));
    setPreviousInterviews(updated);
  };

  const clearAllInterviews = () => {
    if (!user?.email || !confirm('Clear all interview history?')) return;
    
    localStorage.removeItem(`interviews_${user.email}`);
    setPreviousInterviews([]);
  };

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (cameraTimerRef.current) {
        clearInterval(cameraTimerRef.current);
      }
    };
  }, [cameraStream]);

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
          border-radius: 8px; 
          box-shadow: 0 2px 10px rgba(0,0,0,0.05); 
          margin-bottom: 20px; 
          border: 1px solid #e5e7eb;
        }
        .hidden { display: none !important; }
        .skill-tag { 
          display: inline-block; 
          background: #e0e7ff; 
          color: #1e3a8a; 
          padding: 6px 14px; 
          border-radius: 16px; 
          margin: 4px; 
          font-size: 14px;
          font-weight: 500; 
        }
        .btn { 
          padding: 10px 20px; 
          border-radius: 6px; 
          border: none; 
          background: #3b82f6; 
          color: white; 
          font-size: 14px; 
          font-weight: 500;
          cursor: pointer; 
          margin: 5px; 
          transition: background 0.2s;
        }
        .btn:hover { background: #2563eb; }
        .btn-secondary { background: #6b7280; }
        .btn-secondary:hover { background: #4b5563; }
        .btn-success { background: #10b981; }
        .btn-success:hover { background: #059669; }
        .btn-danger { background: #ef4444; }
        .btn-danger:hover { background: #dc2626; }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .textarea { 
          width: 100%; 
          height: 140px; 
          padding: 12px; 
          border-radius: 6px; 
          border: 1px solid #d1d5db; 
          font-family: inherit; 
          resize: vertical; 
          margin: 15px 0; 
          font-size: 14px;
        }
        .textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
        }
        .backend-status {
          padding: 8px 16px;
          border-radius: 6px;
          margin: 10px 0;
          font-size: 14px;
        }
        .status-good { background: #d1fae5; color: #065f46; }
        .status-bad { background: #fee2e2; color: #991b1b; }
        .status-checking { background: #fef3c7; color: #92400e; }
        .camera-container {
          width: 100%;
          max-width: 640px;
          margin: 20px auto;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          background: #1e293b;
          position: relative;
        }
        .camera-container video {
          width: 100%;
          display: block;
        }
        .timer-display {
          font-size: 20px;
          font-weight: 600;
          text-align: center;
          padding: 8px;
          background: #1e293b;
          color: white;
          border-radius: 6px;
          margin: 10px 0;
        }
        .recording-indicator {
          display: inline-block;
          width: 10px;
          height: 10px;
          background: #ef4444;
          border-radius: 50%;
          margin-right: 6px;
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .warning-banner {
          background: #fee2e2;
          color: #991b1b;
          padding: 12px;
          border-radius: 6px;
          margin: 10px 0;
          border: 1px solid #ef4444;
          text-align: center;
          font-weight: 500;
          font-size: 14px;
        }
        .termination-banner {
          background: #7f1d1d;
          color: white;
          padding: 16px;
          border-radius: 6px;
          margin: 10px 0;
          text-align: center;
          font-weight: 500;
          font-size: 16px;
        }
        .tab-switch-counter {
          font-size: 13px;
          color: #6b7280;
          text-align: right;
          margin: 5px 0;
        }
        .nav-tab {
          padding: 10px 20px;
          background: #e5e7eb;
          color: #374151;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        .nav-tab.active {
          background: #3b82f6;
          color: white;
        }
        .section-title {
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 20px;
        }
        .result-item {
          padding: 15px;
          margin: 10px 0;
          background: white;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }
        .interview-history {
          max-height: 500px;
          overflow-y: auto;
          padding: 5px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }
      ` }} />

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#1e293b' }}>
            Welcome, <span style={{ color: '#3b82f6' }}>{user?.name}</span>
          </h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setCurrentTab('profile')}
              className={`nav-tab ${currentTab === 'profile' ? 'active' : ''}`}
            >
              Profile
            </button>
            <button 
              onClick={() => { 
                setCurrentTab('interview'); 
                setInterviewStep('start'); 
              }}
              className={`nav-tab ${currentTab === 'interview' ? 'active' : ''}`}
            >
              Interview
            </button>
            <button 
              onClick={logout}
              className="btn btn-danger"
            >
              Logout
            </button>
          </div>
        </div>

        {/* BACKEND STATUS INDICATOR */}
        {currentTab === 'interview' && (
          <div style={{ marginBottom: '20px' }}>
            <div className={`backend-status ${
              backendStatus.includes('✓') ? 'status-good' : 
              backendStatus.includes('✗') ? 'status-bad' : 'status-checking'
            }`}>
              {backendStatus}
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {currentTab === 'profile' && (
          <div className="card">
            <h2 className="section-title">Profile</h2>
            <p style={{ marginBottom: '15px' }}><strong>Email:</strong> {user?.email}</p>
            
            {profile?.resume ? (
              <div>
                <p style={{ color: '#059669' }}>✓ Resume uploaded</p>
                <a href={profile.resume} target="_blank" style={{ 
                  display: 'inline-block',
                  padding: '8px 16px', 
                  background: '#3b82f6', 
                  color: 'white', 
                  textDecoration: 'none', 
                  borderRadius: '6px',
                  margin: '10px 0',
                  fontSize: '14px'
                }}>
                  View PDF
                </a>
                <br/>
                <button onClick={parseResume} disabled={parsing} className="btn" style={{ background: parsing ? '#d1d5db' : '#8b5cf6', marginRight: '10px' }}>
                  {parsing ? 'Parsing...' : 'Parse Resume'}
                </button>
                <button onClick={deleteResume} className="btn btn-danger">
                  Delete
                </button>
              </div>
            ) : (
              <div>
                <input ref={fileInputRef} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ 
                  width: '100%', 
                  padding: '8px', 
                  marginBottom: '15px', 
                  border: '1px dashed #d1d5db',
                  borderRadius: '6px'
                }} />
                <button onClick={uploadResume} disabled={uploading || !file} className="btn btn-success">
                  {uploading ? 'Uploading...' : 'Upload Resume'}
                </button>
              </div>
            )}
            
            {profile?.parsedResume && (
              <>
                <hr style={{ margin: '30px 0', border: 'none', height: '1px', background: '#e2e8f0' }} />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#475569' }}>Skills Extracted</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '15px' }}>
                  {profile.parsedResume.skills?.slice(0, 12).map((skill: string, i: number) => (
                    <span key={i} className="skill-tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* INTERVIEW TAB */}
        {currentTab === 'interview' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            {/* START SCREEN - WITH ALL INTERVIEWS */}
            {interviewStep === 'start' && (
              <div className="interview-card" style={{ textAlign: 'center' }}>
                <h2 className="section-title">Technical Interview</h2>
                <p style={{ fontSize: '16px', color: '#6b7280' }}>Upload CV → Match skills → Answer questions → Get feedback</p>
                
                {previousInterviews.length > 0 && (
                  <div style={{ marginTop: '30px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#475569' }}>
                        Interview History ({previousInterviews.length})
                      </h3>
                      <button 
                        onClick={clearAllInterviews}
                        className="btn btn-secondary"
                        style={{ padding: '6px 16px', fontSize: '13px' }}
                      >
                        Clear All
                      </button>
                    </div>
                    
                    <div className="interview-history">
                      {previousInterviews.slice().reverse().map((interview: any, index: number) => {
                        const originalIndex = previousInterviews.length - 1 - index;
                        return (
                          <div key={interview.id || index} style={{
                            background: '#f8fafc',
                            padding: '16px',
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb',
                            marginBottom: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '15px'
                          }}>
                            <div style={{ flex: 2, minWidth: '250px' }}>
                              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: '#4b5563' }}>
                                  <strong>Date:</strong> {new Date(interview.date).toLocaleDateString()} {new Date(interview.date).toLocaleTimeString()}
                                </span>
                                <span style={{ 
                                  padding: '4px 12px', 
                                  background: interview.terminated ? '#fee2e2' : '#d1fae5',
                                  color: interview.terminated ? '#991b1b' : '#065f46',
                                  borderRadius: '4px',
                                  fontWeight: '500',
                                  fontSize: '13px'
                                }}>
                                  Score: {interview.overallScore || 0}%
                                </span>
                                {interview.terminated && (
                                  <span style={{ 
                                    padding: '4px 12px', 
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                  }}>
                                    Terminated
                                  </span>
                                )}
                              </div>
                              <div style={{ marginTop: '8px' }}>
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                                  <strong>Skills:</strong> {interview.skills?.slice(0, 5).join(', ')}{interview.skills?.length > 5 ? '...' : ''}
                                </span>
                              </div>
                              {interview.totalTabSwitches > 0 && (
                                <div style={{ marginTop: '4px', fontSize: '12px', color: '#ef4444' }}>
                                  Tab switches: {interview.totalTabSwitches}
                                </div>
                              )}
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={() => viewInterviewFeedback(interview)}
                                className="btn btn-success" 
                                style={{ padding: '6px 16px', fontSize: '13px' }}
                              >
                                View Details
                              </button>
                              <button 
                                onClick={() => deleteInterview(originalIndex)}
                                className="btn btn-danger"
                                style={{ padding: '6px 12px', fontSize: '13px' }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Summary Statistics */}
                    <div className="stats-grid">
                      <div style={{ padding: '15px', background: '#f1f5f9', borderRadius: '6px' }}>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>Total Interviews</div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: '#1e293b' }}>{previousInterviews.length}</div>
                      </div>
                      <div style={{ padding: '15px', background: '#f1f5f9', borderRadius: '6px' }}>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>Average Score</div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: '#1e293b' }}>
                          {Math.round(previousInterviews.reduce((acc, i) => acc + (i.overallScore || 0), 0) / previousInterviews.length)}%
                        </div>
                      </div>
                      <div style={{ padding: '15px', background: '#f1f5f9', borderRadius: '6px' }}>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>Terminated</div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: '#ef4444' }}>
                          {previousInterviews.filter(i => i.terminated).length}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div style={{ marginTop: '30px' }}>
                  <button 
                    className="btn btn-success" 
                    onClick={() => setInterviewStep('upload')}
                    style={{ padding: '12px 32px', fontSize: '16px' }}
                  >
                    Start New Interview
                  </button>
                  <br/>
                  <button 
                    onClick={checkBackendStatus}
                    className="btn btn-secondary" 
                    style={{ marginTop: '15px' }}
                  >
                    Check Backend Status
                  </button>
                </div>
              </div>
            )}

            {/* UPLOAD STEP */}
            {interviewStep === 'upload' && (
              <div className="interview-card">
                <h3 className="section-title" style={{ fontSize: '18px' }}>Upload Your CV</h3>
                <p style={{ color: '#6b7280', marginBottom: '20px', fontSize: '14px' }}>
                  The system will analyze your CV and extract relevant skills for the interview. (PDF or DOCX)
                </p>
                
                <input 
                  ref={cvFileRef} 
                  type="file" 
                  accept=".pdf,.docx" 
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    margin: '15px 0', 
                    border: '1px dashed #3b82f6', 
                    borderRadius: '6px',
                    background: '#f8fafc',
                    cursor: 'pointer'
                  }} 
                />
                
                <div id="interview-uploadStatus" style={{ 
                  padding: '8px', 
                  margin: '10px 0',
                  borderRadius: '4px',
                  background: '#f8fafc',
                  fontSize: '14px',
                  color: '#6b7280'
                }}></div>
                
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setInterviewStep('start')}
                  >
                    Back
                  </button>
                  <button 
                    className="btn" 
                    onClick={analyzeCV}
                    disabled={isAnalyzing}
                    style={{ 
                      background: isAnalyzing ? '#d1d5db' : '#3b82f6',
                    }}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze Skills'}
                  </button>
                </div>
              </div>
            )}

            {/* SKILLS STEP */}
            {interviewStep === 'skills' && (
              <div className="interview-card">
                <h3 className="section-title" style={{ fontSize: '18px', color: '#10b981' }}>Skills Found In Your CV</h3>
                <div id="interview-skillsList" style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '8px', 
                  margin: '20px 0', 
                  padding: '20px',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  minHeight: '80px',
                  border: '1px solid #e5e7eb'
                }}></div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setInterviewStep('upload')}
                  >
                    Back
                  </button>
                  <button 
                    className="btn btn-success" 
                    onClick={startInterview}
                  >
                    Start Interview
                  </button>
                </div>
              </div>
            )}

            {/* INTERVIEW STEP */}
            {interviewStep === 'interview' && (
              <div className="interview-card">
                {/* Tab Switch Warning Banner */}
                {showTabWarning && (
                  <div className="warning-banner">
                    Warning {tabSwitchCount}/3: Tab switching detected! Interview will terminate after 3 violations.
                  </div>
                )}

                {/* Termination Banner */}
                {interviewTerminated && (
                  <div className="termination-banner">
                    Interview Terminated - Multiple tab switching detected
                  </div>
                )}

                {/* Tab Switch Counter */}
                <div className="tab-switch-counter">
                  Tab switches: {tabSwitchCount}/3
                </div>

                {/* Timer Display */}
                <div className="timer-display">
                  {isRecording && <span className="recording-indicator"></span>}
                  Time Remaining: {formatTime(answerTimer)}
                </div>

                <h4 id="interview-skillTitle" style={{ color: '#059669', fontSize: '16px', fontWeight: '600', marginBottom: '20px' }}>
                  Skill {currentIndex + 1}/{skills.length}: {skills[currentIndex]?.skill || 'Loading...'}
                </h4>
                
                <div style={{ 
                  background: '#f8fafc', 
                  padding: '20px', 
                  borderRadius: '6px', 
                  marginBottom: '20px',
                  border: '1px solid #e5e7eb'
                }}>
                  <h4 style={{ marginTop: 0, color: '#334155', fontSize: '14px', fontWeight: '600' }}>Question:</h4>
                  <p id="interview-questionText" style={{ 
                    fontSize: '16px', 
                    lineHeight: '1.5',
                    color: '#1f2937',
                    margin: '10px 0 0 0'
                  }}>
                    {currentQuestion || "Loading question..."}
                  </p>
                </div>

                {/* Camera Section */}
                {showCamera && (
                  <div className="camera-container">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline
                      muted
                    />
                    {isRecording && (
                      <div style={{ 
                        position: 'absolute', 
                        bottom: '10px', 
                        left: '10px',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}>
                        REC {formatTime(recordingTimeLeft)}
                      </div>
                    )}
                  </div>
                )}
                
                <textarea 
                  ref={answerBoxRef} 
                  className="textarea" 
                  placeholder="Type your answer here or use voice/video input..."
                  disabled={interviewTerminated}
                />
                
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button 
                    className="btn" 
                    onClick={startVoiceInput}
                    style={{ background: '#8b5cf6' }}
                    disabled={interviewTerminated}
                  >
                    Voice Input
                  </button>
                  
                  {!showCamera ? (
                    <button 
                      className="btn btn-danger" 
                      onClick={() => startVideoRecording()}
                      disabled={interviewTerminated}
                    >
                      Start Video Recording
                    </button>
                  ) : (
                    <button 
                      className="btn" 
                      onClick={isRecording ? stopVideoRecording : () => startVideoRecording()}
                      style={{ background: isRecording ? '#ef4444' : '#10b981' }}
                      disabled={interviewTerminated}
                    >
                      {isRecording ? 'Stop Recording' : 'Record Answer'}
                    </button>
                  )}
                  
                  <button 
                    className="btn btn-success" 
                    onClick={() => submitAnswer()}
                    disabled={interviewTerminated}
                  >
                    Submit Answer
                  </button>
                </div>

                {/* Camera toggle */}
                {!showCamera && !isRecording && (
                  <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <button 
                      onClick={() => setShowCamera(true)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: '#6b7280', 
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      Show camera preview
                    </button>
                  </div>
                )}
                
                {showCamera && !isRecording && (
                  <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <button 
                      onClick={stopCamera}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                      Hide Camera
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* FEEDBACK STEP */}
            {interviewStep === 'feedback' && (
              <div className="interview-card">
                <h3 className="section-title" style={{ fontSize: '18px' }}>AI Feedback</h3>
                
                <div style={{ 
                  background: '#f8fafc', 
                  padding: '20px', 
                  borderRadius: '6px', 
                  whiteSpace: 'pre-wrap',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  marginBottom: '20px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  lineHeight: '1.6'
                }}>
                  {feedbackText || "Loading feedback..."}
                </div>
                
                <button 
                  className="btn" 
                  onClick={nextSkill}
                >
                  {currentIndex + 1 < skills.length && !interviewTerminated ? 'Next Skill' : 'Finish Interview'}
                </button>
              </div>
            )}

            {/* SUMMARY STEP */}
            {interviewStep === 'summary' && (
              <div className="interview-card">
                <h2 className="section-title" style={{ textAlign: 'center', color: interviewTerminated ? '#ef4444' : '#10b981' }}>
                  {interviewTerminated ? 'Interview Terminated' : 'Interview Complete'}
                </h2>
                
                {/* Overall Score */}
                <div style={{ 
                  background: interviewTerminated ? '#fee2e2' : '#f0fdf4', 
                  padding: '24px', 
                  borderRadius: '6px', 
                  margin: '20px 0',
                  textAlign: 'center',
                  border: `1px solid ${interviewTerminated ? '#ef4444' : '#a7f3d0'}`
                }}>
                  <h3 style={{ color: interviewTerminated ? '#991b1b' : '#059669', margin: 0, fontSize: '20px' }}>
                    Overall Score: {calculateOverallScore(results)}%
                  </h3>
                  {interviewTerminated && (
                    <p style={{ color: '#991b1b', marginTop: '10px', fontWeight: '500', fontSize: '14px' }}>
                      Interview was terminated due to multiple tab switches
                    </p>
                  )}
                </div>

                {/* Results Summary */}
                <div style={{ marginBottom: '30px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#475569' }}>Skill Performance</h4>
                  <div style={{ 
                    background: '#f8fafc', 
                    padding: '15px', 
                    borderRadius: '6px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb'
                  }}>
                    {results.length > 0 ? (
                      results.map((r, i) => (
                        <div key={i} className="result-item" style={{ 
                          borderLeft: `4px solid ${
                            r.capability === 'strong' ? '#10b981' : 
                            r.capability === 'medium' ? '#f59e0b' : '#ef4444'
                          }`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '14px' }}>{r.skill}</strong>
                            <span style={{ 
                              padding: '4px 12px', 
                              background: r.capability === 'strong' ? '#d1fae5' : 
                                        r.capability === 'medium' ? '#fef3c7' : '#fee2e2',
                              color: r.capability === 'strong' ? '#065f46' : 
                                    r.capability === 'medium' ? '#92400e' : '#991b1b',
                              borderRadius: '4px',
                              fontWeight: '500',
                              fontSize: '12px'
                            }}>
                              {r.capability?.toUpperCase() || 'UNKNOWN'}
                            </span>
                          </div>
                          {r.tabSwitches > 0 && (
                            <p style={{ marginTop: '8px', fontSize: '12px', color: '#ef4444' }}>
                              Tab switches during this answer: {r.tabSwitches}
                            </p>
                          )}
                          {r.reasoning && (
                            <p style={{ marginTop: '10px', fontSize: '13px', color: '#6b7280' }}>
                              {r.reasoning}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>No results available</p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setInterviewStep('start');
                      stopCamera();
                    }}
                  >
                    Back to Dashboard
                  </button>
                  <button 
                    className="btn btn-success" 
                    onClick={() => {
                      setInterviewStep('upload');
                      stopCamera();
                    }}
                  >
                    New Interview
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