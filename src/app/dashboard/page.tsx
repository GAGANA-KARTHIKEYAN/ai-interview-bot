'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  // ========== USER STATE ==========
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

  // ========== DYNAMIC INTERVIEW STATES ==========
  const [interviewSession, setInterviewSession] = useState<any>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);
  const [questionHistory, setQuestionHistory] = useState<any[]>([]);
  const [skillSummaries, setSkillSummaries] = useState<any[]>([]);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [inputMethod, setInputMethod] = useState<'TEXT' | 'VOICE' | 'VIDEO'>('TEXT');
  const [interviewMode, setInterviewMode] = useState<'standard' | 'dynamic'>('dynamic');
  const [conversationFlow, setConversationFlow] = useState<any[]>([]);
  const [detailedFeedback, setDetailedFeedback] = useState<any>(null);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [viewedScore, setViewedScore] = useState<number | null>(null);

  const answerBoxRef = useRef<HTMLTextAreaElement>(null);
  const cvFileRef = useRef<HTMLInputElement>(null);
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const API_BASE = "https://ai-interview-bot-docker.onrender.com";
  // Helper function for making API calls
  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const url = process.env.NODE_ENV === 'production'
      ? `/api${endpoint}`  // Use relative path in production
      : `${API_BASE}/api${endpoint}`;  // Use full URL in development

    const storedUser = localStorage.getItem('user');
    const userEmail = storedUser ? JSON.parse(storedUser).email : null;

    const mergedOptions = {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(userEmail ? { 'email': userEmail } : {}),
        ...options.headers,
      }
    };

    console.log(`🌐 API Call: ${url}`, mergedOptions.method || 'GET');
    if (mergedOptions.headers) console.log(`📋 Headers:`, { ...mergedOptions.headers });
    return fetch(url, mergedOptions);
  }, [BACKEND, API_BASE]);

  // Debug logging
  useEffect(() => {
    console.log('🔧 Environment:', process.env.NODE_ENV);
    console.log('🔧 API_BASE from env:', process.env.NEXT_PUBLIC_API_URL);
    console.log('🔧 Final API_BASE:', API_BASE);
    console.log('🔧 Test URL:', `${API_BASE}/api/health`);
  }, []);
  // ========== VOICE SYNTHESIS ============
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  // ========== CAMERA STATES ===========
  const [showCamera, setShowCamera] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(180);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const cameraTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  // ========== VIDEO ANALYSIS FRAMES ==========
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const frameCaptureIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Debug logging for API configuration
  useEffect(() => {
    console.log('🔧 Environment:', process.env.NODE_ENV);
    console.log('🔧 API Base:', API_BASE);
    console.log('🔧 Production Mode:', process.env.NODE_ENV === 'production');
    console.log('🔧 Sample API URL (health):',
      process.env.NODE_ENV === 'production'
        ? '/api/health'
        : `${API_BASE}/api/health`
    );
  }, []);

  // ========== PROFILE FUNCTIONS ==========
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

  const fetchInterviewHistory = useCallback(async (email: string) => {
    try {
      const res = await apiCall('/history');
      if (res.ok) {
        const data = await res.json();
        console.log(`📜 History fetched for ${email}:`, data.history?.length || 0, "records");
        setPreviousInterviews(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
      // Fallback to local if needed, but we want to move away from it
    }
  }, [apiCall]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    // Fetch profile and history from backend
    // Use parsedUser.email directly because setUser is async
    if (parsedUser.email) {
      fetch(`/api/profile`, {
        headers: { 'email': parsedUser.email },
        cache: 'no-store'
      })
        .then(res => res.json())
        .then(setProfile)
        .catch(console.error);

      fetchInterviewHistory(parsedUser.email);
    }

    checkBackendStatus();
    setLoading(false);
  }, [router, fetchInterviewHistory]);

  // ========== TAB SWITCH DETECTION ==========
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isInterviewActive || interviewStep !== 'interview' || interviewTerminated) return;

      const isHidden = document.hidden;

      if (isHidden && visibilityRef.current) {
        visibilityRef.current = false;

        setTabSwitchCount(prev => {
          const newCount = prev + 1;

          // Show warning immediately on each switch
          setShowTabWarning(true);

          if (warningTimeoutRef.current) {
            clearTimeout(warningTimeoutRef.current);
          }

          warningTimeoutRef.current = setTimeout(() => {
            setShowTabWarning(false);
          }, 5000);

          if (newCount >= 3) {
            setInterviewTerminated(true);
            setShowTabWarning(false);
            setInterviewStep('summary');
            setIsInterviewActive(false);

            const invalidAnswer = "INTERVIEW TERMINATED: Tab switching detected 3 times";
            if (answerBoxRef.current) {
              answerBoxRef.current.value = invalidAnswer;
            }

            // Save terminated interview
            saveTerminatedInterview();

            alert("Interview terminated due to multiple tab switches.");

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

  const saveTerminatedInterview = () => {
    if (!user?.email) return;

    const interviewData = {
      date: new Date().toISOString(),
      type: interviewMode,
      skills: skills.map(s => s.skill),
      skillDetails: skills,
      results: interviewMode === 'dynamic' ? questionHistory : results,
      skillSummaries: skillSummaries,
      overallScore: 0,
      terminated: true,
      terminationReason: 'Multiple tab switches detected',
      totalTabSwitches: tabSwitchCount
    };

    apiCall('/history', {
      method: 'POST',
      body: JSON.stringify({ interview: interviewData })
    }).then(() => fetchInterviewHistory(user.email));

    const savedInterviews = JSON.parse(localStorage.getItem(`interviews_${user.email}`) || '[]');
    savedInterviews.push({ ...interviewData, id: Date.now() });
    localStorage.setItem(`interviews_${user.email}`, JSON.stringify(savedInterviews));
    setPreviousInterviews(savedInterviews);
  };

  // ========== SPEAK FUNCTION ==========
  const speak = (text: string) => {
    if (!synth) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    synth.speak(utterance);
  };

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
      const recordingStartTime = Date.now();

      if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
        try {
          const recognition = new (window as any).webkitSpeechRecognition();
          recognition.lang = "en-US";
          recognition.continuous = true;
          recognition.interimResults = true;

          const existingText = answerBoxRef.current?.value || "";

          recognition.onresult = (e: any) => {
            let currentTranscript = existingText;
            if (currentTranscript && !currentTranscript.endsWith(" ") && !currentTranscript.endsWith("\n")) {
              currentTranscript += " ";
            }
            for (let i = e.resultIndex; i < e.results.length; ++i) {
              currentTranscript += e.results[i][0].transcript;
            }
            if (answerBoxRef.current) {
              answerBoxRef.current.value = currentTranscript;
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (err) {
          console.error("Speech recognition error:", err);
        }
      }

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

        const durationSeconds = Math.floor((Date.now() - recordingStartTime) / 1000);
        const videoAnswerInfo = `[VIDEO RECORDING DURATION: ${durationSeconds} seconds]`;

        if (answerBoxRef.current) {
          const currentText = answerBoxRef.current.value.trim();
          if (!currentText || currentText === "Listening..." || currentText === "[NO ANSWER PROVIDED - TIME EXPIRED]") {
            answerBoxRef.current.value = `${videoAnswerInfo}\nAnswer captured on video but no speech detected.`;
          } else {
            answerBoxRef.current.value = `${currentText}\n\n${videoAnswerInfo}`;
          }
        }

        // Only auto-submit if we transitioned from recording state non-interactively
        // Otherwise, the submitButton handler handles it
      };

      mediaRecorder.start();
      setIsRecording(true);
      setInputMethod('VIDEO');
      setRecordingTimeLeft(180);

      // Start capturing frames for AI vision analysis
      setVideoFrames([]);
      if (videoRef.current) {
        frameCaptureIntervalRef.current = setInterval(() => {
          if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = 320; // low res for LLM
            canvas.height = 240;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const base64Frame = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
              setVideoFrames(prev => {
                const newFrames = [...prev, base64Frame];
                if (newFrames.length > 3) {
                  return [newFrames[0], newFrames[Math.floor(newFrames.length / 2)], newFrames[newFrames.length - 1]];
                }
                return newFrames;
              });
            }
          }
        }, 5000); // capture every 5 seconds
      }

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

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Error stopping recognition", e);
      }
      recognitionRef.current = null;
    }

    setIsRecording(false);

    if (cameraTimerRef.current) {
      clearInterval(cameraTimerRef.current);
      cameraTimerRef.current = null;
    }

    if (frameCaptureIntervalRef.current) {
      clearInterval(frameCaptureIntervalRef.current);
      frameCaptureIntervalRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const checkBackendStatus = async () => {
    try {
      const response = await apiCall('/health', {
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
      const res = await apiCall('/resume', {
        method: 'POST',
        headers: { 'email': user.email },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        refreshProfile();
        router.refresh();
      } else {
        const errorMessage = typeof data.error === 'string' ? data.error :
          typeof data.detail === 'string' ? data.detail :
            JSON.stringify(data.error || data.detail || 'Unknown error');
        alert('Upload failed: ' + errorMessage);
      }
    } catch (err) {
      console.error(err);
      alert('Upload error');
    }
    setUploading(false);
  };

  const deleteResume = async () => {
    if (!user?.email || !confirm('Delete resume?')) return;
    try {
      const res = await apiCall('/resume', {
        method: 'DELETE',
        headers: { 'email': user.email }
      });
      if (res.ok) {
        refreshProfile();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert('Delete failed: ' + (data.error || data.detail || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Delete error');
    }
  };



  const logout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  // ========== QUIT INTERVIEW ==========
  const quitInterview = () => {
    setShowQuitConfirm(true);
  };

  const confirmQuit = () => {
    setShowQuitConfirm(false);
    setFeedbackText("");
    setDetailedFeedback(null);
    setInputMethod('TEXT');
    startAnswerTimer();
    stopCamera();
    stopVideoRecording();
    stopAnswerTimer();
    setInterviewStep('start');
    setIsInterviewActive(false);
    setInterviewTerminated(false);
    setTabSwitchCount(0);
    setShowTabWarning(false);

    // Save partial results if any
    if ((interviewMode === 'dynamic' && questionHistory.length > 0) ||
      (interviewMode === 'standard' && results.length > 0)) {
      savePartialResults();
    }
  };

  const cancelQuit = () => {
    setShowQuitConfirm(false);
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
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const res = await apiCall('/upload-and-analyze', {
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

      // Get skills from response and deduplicate
      let rawMatchedSkills = [];
      if (data.matched_skills && Array.isArray(data.matched_skills)) {
        rawMatchedSkills = data.matched_skills;
      } else if (data.skills && Array.isArray(data.skills)) {
        rawMatchedSkills = data.skills;
      }

      const matchedSkills = rawMatchedSkills.filter((v: any, i: number, a: any[]) =>
        v.skill && a.findIndex(t => (t.skill === v.skill)) === i
      );

      if (matchedSkills.length === 0) {
        alert("No skills matched. Using default skills.");
        // Use default skills
        setSkills([
          { skill: "Python", experience_level: "intermediate", category: "language", typical_questions: ["Explain Python decorators", "What are list comprehensions?"] },
          { skill: "JavaScript", experience_level: "intermediate", category: "language", typical_questions: ["Explain closures", "How does the event loop work?"] },
          { skill: "React", experience_level: "intermediate", category: "framework", typical_questions: ["Explain the virtual DOM", "What are hooks?"] },
          { skill: "Node.js", experience_level: "intermediate", category: "framework", typical_questions: ["How does event loop work?", "Explain middleware"] },
          { skill: "SQL", experience_level: "intermediate", category: "database", typical_questions: ["Explain JOIN types", "What's normalization?"] },
          { skill: "Git", experience_level: "intermediate", category: "tool", typical_questions: ["Explain branching strategy", "How to resolve conflicts?"] }
        ]);
      } else {
        setSkills(matchedSkills);
      }

      // Display skills in the UI
      const list = document.getElementById("interview-skillsList");
      if (list) {
        list.innerHTML = "";
        matchedSkills.forEach((s: any) => {
          const skillTag = document.createElement('span');
          skillTag.className = 'skill-tag';
          skillTag.textContent = `${s.skill} (${s.experience_level || 'intermediate'})`;
          list.appendChild(skillTag);
        });
      }

      setInterviewStep('skills');
      if (status) status.innerText = `Found ${matchedSkills.length} skills!`;
    } catch (err: any) {
      console.error("CV Analysis error:", err);

      // Use default skills on error
      const defaultSkills = [
        { skill: "Python", experience_level: "intermediate", category: "language", typical_questions: ["Explain Python decorators", "What are list comprehensions?"] },
        { skill: "JavaScript", experience_level: "intermediate", category: "language", typical_questions: ["Explain closures", "How does the event loop work?"] },
        { skill: "React", experience_level: "intermediate", category: "framework", typical_questions: ["Explain the virtual DOM", "What are hooks?"] },
        { skill: "Node.js", experience_level: "intermediate", category: "framework", typical_questions: ["How does event loop work?", "Explain middleware"] },
        { skill: "SQL", experience_level: "intermediate", category: "database", typical_questions: ["Explain JOIN types", "What's normalization?"] },
        { skill: "Git", experience_level: "intermediate", category: "tool", typical_questions: ["Explain branching strategy", "How to resolve conflicts?"] }
      ];

      setSkills(defaultSkills);

      const list = document.getElementById("interview-skillsList");
      if (list) {
        list.innerHTML = "";
        defaultSkills.forEach((s: any) => {
          const skillTag = document.createElement('span');
          skillTag.className = 'skill-tag';
          skillTag.textContent = `${s.skill} (${s.experience_level || 'intermediate'})`;
          list.appendChild(skillTag);
        });
      }

      setInterviewStep('skills');
      if (status) status.innerText = "Using default skills (API error)";
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ========== DYNAMIC INTERVIEW FUNCTIONS ==========
  const startDynamicInterview = async () => {
    setInterviewStep('interview');
    setIsInterviewActive(true);
    setTabSwitchCount(0);
    setInterviewTerminated(false);
    setQuestionHistory([]);
    setSkillSummaries([]);
    setConversationFlow([]);
    setCurrentAnalysis(null);
    setDetailedFeedback(null);

    try {
      const response = await apiCall('/start-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: skills,
          userLevel: 'intermediate'
        })
      });

      const data = await response.json();

      if (data.success) {
        setInterviewSession(data.interview_state);
        setCurrentQuestion(data.question.question);
        setCurrentAnalysis(null);

        // Add to conversation flow
        setConversationFlow([{
          type: 'question',
          content: data.question,
          timestamp: new Date().toISOString()
        }]);

        // Update title
        const title = document.getElementById("interview-skillTitle") as HTMLElement;
        if (title) title.innerText = `Skill 1/${skills.length}: ${skills[0]?.skill} (${skills[0]?.experience_level || 'intermediate'})`;

        startAnswerTimer();

        // Speak the question
        speak(data.question.question);
      } else {
        // Fallback to standard
        startStandardInterview();
      }
    } catch (error) {
      console.error('Failed to start dynamic interview:', error);
      startStandardInterview();
    }
  };

  const startStandardInterview = () => {
    setCurrentIndex(0);
    setResults([]);
    setInterviewStep('interview');
    setIsInterviewActive(true);
    setTabSwitchCount(0);
    setInterviewTerminated(false);
    setInterviewMode('standard');

    startAnswerTimer();

    if (skills.length > 0) {
      const skill = skills[0]?.skill;

      // Use first typical question if available
      if (skills[0]?.typical_questions && skills[0].typical_questions.length > 0) {
        setCurrentQuestion(skills[0].typical_questions[0]);
        speak(skills[0].typical_questions[0]);
      } else {
        const question = `Tell me about your experience with ${skill}`;
        setCurrentQuestion(question);
        speak(question);
      }

      const title = document.getElementById("interview-skillTitle") as HTMLElement;
      if (title) title.innerText = `Skill 1/${skills.length}: ${skill}`;
    }
  };

  const startInterview = () => {
    setViewedScore(null);
    setResults([]);
    setQuestionHistory([]);
    setSkillSummaries([]);
    setCurrentIndex(0);
    setDetailedFeedback(null);
    setTabSwitchCount(0);
    setInterviewTerminated(false);

    setInterviewMode('dynamic');
    startDynamicInterview();
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
      setInputMethod('VOICE');
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
    if (interviewMode === 'dynamic') {
      await submitDynamicAnswer();
    } else {
      await submitStandardAnswer(isTerminated);
    }
  };

  const submitDynamicAnswer = async () => {
    stopAnswerTimer();
    stopVideoRecording();

    const answer = answerBoxRef.current?.value || '';
    if (!answer.trim() && !interviewTerminated) {
      alert('Please answer the question');
      resetAnswerTimer();
      return;
    }

    setIsGeneratingNext(true);

    try {
      // Evaluate this answer
      const evalResponse = await apiCall('/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          answer: answer,
          skill: skills[currentIndex]?.skill,
          history: questionHistory,
          input_type: inputMethod,
          video_frames: videoFrames
        })
      });

      if (!evalResponse.ok) {
        throw new Error(`Evaluation HTTP error: ${evalResponse.status}`);
      }

      const evalData = await evalResponse.json();
      const evaluation = evalData.evaluation || evalData;

      if (!evaluation || !evaluation.capability) {
        throw new Error("Evaluation response missing capability field");
      }

      // Store detailed feedback
      setDetailedFeedback(evaluation);

      // Add to conversation flow
      const newFlowItem = {
        type: 'answer',
        content: {
          question: currentQuestion,
          answer: answer,
          evaluation: evaluation
        },
        timestamp: new Date().toISOString()
      };
      setConversationFlow([...conversationFlow, newFlowItem]);

      // Add to history
      const newHistoryItem = {
        skill: skills[currentIndex]?.skill,
        question: currentQuestion,
        answer: answer,
        evaluation: evaluation,
        timestamp: new Date().toISOString()
      };

      const updatedHistory = [...questionHistory, newHistoryItem];
      setQuestionHistory(updatedHistory);

      // Format feedback for display
      const formattedFeedback = formatDetailedFeedback(evaluation);
      setFeedbackText(formattedFeedback);

      // Show feedback step (stays until user clicks Next)
      setInterviewStep('feedback');

      // Speak short summary
      if (evaluation.summary_feedback) {
        speak(evaluation.summary_feedback);
      }

    } catch (error) {
      console.error('Error in dynamic flow:', error);
      setIsGeneratingNext(false);
      setInterviewStep('interview');
    } finally {
      setIsGeneratingNext(false);
    }
  };

  const formatDetailedFeedback = (evaluation: any) => {
    if (!evaluation) return 'No feedback available';

    const evalData = evaluation.evaluation || evaluation;

    const scores = evalData.scores || {
      technical_score: 0,
      confidence_score: 0,
      communication_score: 0,
      behavioral_score: 0,
      overall_score: 0
    };

    const scoreExplanations = evalData.score_explanations || {};
    const gaps = evalData.gaps_identified || {};
    const comm = evalData.communication || {};

    let feedback = `
╔══════════════════════════════════════════════════════════╗
║                     DETAILED FEEDBACK                     ║
╚══════════════════════════════════════════════════════════╝

📊 SCORES
`;

    // Score cards
    feedback += `
   ╔══════════════════════════════════════════════════════════╗
   ║  Technical    │  Confidence  │  Communic.   │  Behavioral  ║
   ║  ${scores.technical_score?.toString().padStart(2, ' ')}/10        │  ${scores.confidence_score?.toString().padStart(2, ' ')}/10        │  ${scores.communication_score?.toString().padStart(2, ' ')}/10        │  ${scores.behavioral_score?.toString().padStart(2, ' ')}/10        ║
   ╚══════════════════════════════════════════════════════════╝

   Overall Score: ${scores.overall_score}/10
`;

    // Score explanations
    feedback += `\n📈 SCORE EXPLANATIONS\n`;
    if (scoreExplanations.technical_explanation) {
      feedback += `   • Technical: ${scoreExplanations.technical_explanation}\n`;
    }
    if (scoreExplanations.confidence_explanation) {
      feedback += `   • Confidence: ${scoreExplanations.confidence_explanation}\n`;
    }
    if (scoreExplanations.communication_explanation) {
      feedback += `   • Communication: ${scoreExplanations.communication_explanation}\n`;
    }
    if (scoreExplanations.behavioral_explanation) {
      feedback += `   • Behavioral: ${scoreExplanations.behavioral_explanation}\n`;
    }

    // What was wrong / gaps
    feedback += `\n❌ WHAT WAS MISSING / WRONG\n`;

    if (gaps.knowledge_gaps && gaps.knowledge_gaps.length > 0) {
      gaps.knowledge_gaps.forEach((gap: string) => {
        feedback += `   • Knowledge Gap: ${gap}\n`;
      });
    }

    if (gaps.depth_gaps && gaps.depth_gaps.length > 0) {
      gaps.depth_gaps.forEach((gap: string) => {
        feedback += `   • Depth Gap: ${gap}\n`;
      });
    }

    if (gaps.example_gaps) {
      feedback += `   • Example Gap: ${gaps.example_gaps}\n`;
    }

    if (evalData.technical_accuracy?.misunderstood_concepts?.length > 0) {
      evalData.technical_accuracy.misunderstood_concepts.forEach((c: string) => {
        feedback += `   • Misunderstood: ${c}\n`;
      });
    }

    if (evalData.technical_accuracy?.missed_concepts?.length > 0) {
      evalData.technical_accuracy.missed_concepts.forEach((c: string) => {
        feedback += `   • Missed Concept: ${c}\n`;
      });
    }

    // Ideal answer
    feedback += `\n💡 IDEAL ANSWER\n`;
    feedback += `   ${evalData.ideal_answer || 'A comprehensive answer would include specific technical details, real-world examples, and clear structure.'}\n`;

    // Communication analysis
    feedback += `\n🗣️ COMMUNICATION ANALYSIS\n`;
    feedback += `   • Clarity: ${comm.clarity || 'N/A'}\n`;
    feedback += `   • Structure: ${comm.structure || 'N/A'}\n`;
    if (comm.hesitation_markers !== undefined) {
      feedback += `   • Hesitation markers: ${comm.hesitation_markers ? 'Detected' : 'Not detected'}\n`;
    }
    if (comm.pacing) {
      feedback += `   • Pacing: ${comm.pacing}\n`;
    }
    if (comm.filler_words !== undefined) {
      feedback += `   • Filler words: ${comm.filler_words ? 'Detected' : 'Not detected'}\n`;
    }

    // Strengths
    feedback += `\n💪 STRENGTHS\n`;
    if (evalData.strengths && evalData.strengths.length > 0) {
      evalData.strengths.forEach((s: string) => {
        feedback += `   ✓ ${s}\n`;
      });
    } else if (evalData.technical_accuracy?.correct_concepts?.length > 0) {
      evalData.technical_accuracy.correct_concepts.forEach((c: string) => {
        feedback += `   ✓ ${c}\n`;
      });
    }

    // Areas to improve
    feedback += `\n📝 AREAS TO IMPROVE\n`;
    if (evalData.areas_for_improvement && evalData.areas_for_improvement.length > 0) {
      evalData.areas_for_improvement.forEach((a: string) => {
        feedback += `   ○ ${a}\n`;
      });
    }

    // Experience indicators
    if (evalData.experience_indicators) {
      feedback += `\n💼 EXPERIENCE INDICATORS\n`;
      if (evalData.experience_indicators.had_real_examples) {
        feedback += `   ✓ Provided real-world examples\n`;
      } else {
        feedback += `   ✗ No real-world examples provided\n`;
      }
      if (evalData.experience_indicators.discussed_challenges) {
        feedback += `   ✓ Discussed challenges faced\n`;
      }
      if (evalData.experience_indicators.star_method_used) {
        feedback += `   ✓ Used STAR method effectively\n`;
      }
      feedback += `   • Example quality: ${evalData.experience_indicators.example_quality || 'N/A'}\n`;
    }

    // Summary
    feedback += `\n💬 SUMMARY\n   ${evalData.summary_feedback || 'Good effort!'}\n`;

    return feedback;
  };

  const nextQuestion = async () => {
    if (interviewMode === 'dynamic') {
      await generateNextDynamicQuestion();
    } else {
      nextSkill();
    }
  };

  const generateNextDynamicQuestion = async () => {
    setIsGeneratingNext(true);

    try {
      // Get skills remaining
      const skillsRemaining = skills.slice(currentIndex + 1).map(s => s.skill);

      // Generate next question
      const nextResponse = await apiCall('/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: skills[currentIndex]?.skill,
          answer: questionHistory[questionHistory.length - 1]?.answer || '',
          question: currentQuestion,
          history: questionHistory,
          skillsRemaining: skillsRemaining
        })
      });

      const nextData = await nextResponse.json();

      if (nextData.success) {
        setCurrentAnalysis(nextData.analysis || {});

        // Check if we should transition to next skill
        if (nextData.should_transition?.transition) {
          // Generate summary for current skill
          const skillSummary = await generateSkillSummary(skills[currentIndex]?.skill);
          const updatedSummaries = [...skillSummaries];
          if (skillSummary) {
            const idx = updatedSummaries.findIndex(s => s.skill === skillSummary.skill);
            if (idx !== -1) updatedSummaries[idx] = skillSummary;
            else updatedSummaries.push(skillSummary);
          }

          if (nextData.should_transition?.complete || currentIndex + 1 >= skills.length) {
            // Already summarized current skill above. Proceed to finish.

            // FINISH INTERVIEW LOGIC
            await generateFinalReport(updatedSummaries);
            setInterviewStep('summary');
            setIsInterviewActive(false);
          } else {
            // Move to next skill
            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);

            // Use first typical question for next skill if available
            const nextSkill = skills[nextIndex];
            let nextQuestionText = `Let's move on to ${nextSkill.skill}. Can you tell me about your experience with it?`;

            if (nextSkill.typical_questions && nextSkill.typical_questions.length > 0) {
              nextQuestionText = nextSkill.typical_questions[0];
            }

            setCurrentQuestion(nextQuestionText);
            setQuestionHistory([]); // Reset history for new skill
            setDetailedFeedback(null);
            setInputMethod('TEXT');
            setVideoFrames([]);

            // Update title
            const title = document.getElementById("interview-skillTitle") as HTMLElement;
            if (title) title.innerText = `Skill ${nextIndex + 1}/${skills.length}: ${nextSkill.skill}`;

            setInterviewStep('interview');

            // Speak the question
            speak(nextQuestionText);
          }
        } else {
          // Continue with next question for same skill
          const nextQuestion = nextData.next_question || {};
          const questionText = nextQuestion.question || `Let's continue with ${skills[currentIndex]?.skill}. Can you tell me more?`;

          setCurrentQuestion(questionText);
          setCurrentAnalysis(nextData.analysis || {});
          setDetailedFeedback(null);
          setInputMethod('TEXT');
          setVideoFrames([]);

          setInterviewStep('interview');

          // Speak the question
          speak(questionText);
        }

        // Clear answer box
        if (answerBoxRef.current) {
          answerBoxRef.current.value = '';
        }

        // Reset timer
        resetAnswerTimer();
      } else {
        // Fallback
        setInterviewStep('interview');
        const fallbackQuestion = `Let's continue with ${skills[currentIndex]?.skill}. Can you provide more details?`;
        setCurrentQuestion(fallbackQuestion);
        speak(fallbackQuestion);
        resetAnswerTimer();
      }
    } catch (error) {
      console.error('Error generating next question:', error);
      // Fallback
      setInterviewStep('interview');
      const fallbackQuestion = `Let's continue with ${skills[currentIndex]?.skill}. Can you elaborate further?`;
      setCurrentQuestion(fallbackQuestion);
      speak(fallbackQuestion);
      resetAnswerTimer();
    } finally {
      setIsGeneratingNext(false);
    }
  };

  const generateSkillSummary = async (skill: string) => {
    try {
      const response = await apiCall('/generate-skill-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: skill,
          history: questionHistory,
          evaluations: questionHistory.map(h => h.evaluation)
        })
      });

      const summary = await response.json();

      setSkillSummaries(prev => {
        const existingIdx = prev.findIndex(s => s.skill === summary.skill);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = summary;
          return updated;
        }
        return [...prev, summary];
      });
      return summary;

    } catch (error) {
      console.error('Failed to generate skill summary:', error);
      return null;
    }
  };

  const generateFinalReport = async (latestSummaries?: any[]) => {
    const summariesToUse = latestSummaries || skillSummaries;
    try {
      const response = await apiCall('/final-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: skills,
          all_qa: questionHistory,
          all_evaluations: questionHistory.map(h => h.evaluation),
          skillSummaries: summariesToUse
        })
      });

      const report = await response.json();

      // Save interview results
      saveDynamicInterviewResults(report, summariesToUse);

    } catch (error) {
      console.error('Failed to generate final report:', error);
      // Save without report
      saveDynamicInterviewResults(null, summariesToUse);
    }
  };

  const saveDynamicInterviewResults = (finalReport: any, latestSummaries?: any[]) => {
    if (!user?.email) return;

    stopCamera();

    const summariesToUse = latestSummaries || skillSummaries;
    const overallScore = calculateDynamicOverallScore(questionHistory);

    const interviewData = {
      date: new Date().toISOString(),
      type: 'dynamic',
      skills: skills.map(s => s.skill),
      skillDetails: skills,
      results: questionHistory,
      skillSummaries: summariesToUse,
      finalReport: finalReport,
      overallScore: overallScore,
      conversationFlow: conversationFlow,
      terminated: interviewTerminated,
      totalTabSwitches: tabSwitchCount
    };

    apiCall('/history', {
      method: 'POST',
      body: JSON.stringify({ interview: interviewData })
    }).then(async (res) => {
      if (res.ok) {
        await fetchInterviewHistory(user.email);
      }
    });

    const savedInterviews = JSON.parse(localStorage.getItem(`interviews_${user.email}`) || '[]');
    savedInterviews.push({ ...interviewData, id: Date.now() });
    localStorage.setItem(`interviews_${user.email}`, JSON.stringify(savedInterviews));
    setPreviousInterviews(savedInterviews);
  };

  const savePartialResults = () => {
    if (!user?.email) return;

    const interviewData = {
      date: new Date().toISOString(),
      type: interviewMode,
      skills: skills.map(s => s.skill),
      skillDetails: skills,
      results: interviewMode === 'dynamic' ? questionHistory : results,
      skillSummaries: skillSummaries,
      overallScore: interviewMode === 'dynamic' ? calculateDynamicOverallScore(questionHistory) : calculateOverallScore(results),
      partial: true,
      terminated: false,
      totalTabSwitches: tabSwitchCount
    };

    apiCall('/history', {
      method: 'POST',
      body: JSON.stringify({ interview: interviewData })
    }).then(() => fetchInterviewHistory(user.email));

    const savedInterviews = JSON.parse(localStorage.getItem(`interviews_${user.email}`) || '[]');
    savedInterviews.push({ ...interviewData, id: Date.now() });
    localStorage.setItem(`interviews_${user.email}`, JSON.stringify(savedInterviews));
    setPreviousInterviews(savedInterviews);
  };

  function calculateDynamicOverallScore(history: any[], switches?: number) {
    if (!history || history.length === 0) return 0;

    // Use provided switches or fallback to current state
    const totalSwitches = switches !== undefined ? switches : tabSwitchCount;

    const scores = history
      .map(h => {
        const evalData = h.evaluation?.evaluation || h.evaluation;
        // Prefer explicit numeric scores from backend
        return evalData?.scores?.overall_score ?? evalData?.overall_score;
      })
      .filter((score): score is number => score !== null && score !== undefined);

    if (scores.length === 0) return 0;

    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    // backend returns 0-10, we want 0-100%
    const baseScore = Math.round(averageScore * 10);

    // Apply tab switch penalty
    const penalty = Math.min(totalSwitches * 5, 30);

    return Math.max(0, baseScore - penalty);
  }

  // ========== STANDARD INTERVIEW FUNCTIONS ==========
  const submitStandardAnswer = async (isTerminated = false) => {
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

      const res = await apiCall('/evaluate', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion,
          answer: answer,
          skill: skills[currentIndex]?.skill,
          terminated: isTerminated,
          tabSwitches: tabSwitchCount,
          input_type: inputMethod,
          video_frames: videoFrames
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Evaluation HTTP error: ${res.status}`);
      }

      const data = await res.json();
      const e = data.evaluation || data;

      if (!e || !e.capability) {
        throw new Error("Evaluation response missing capability field");
      }

      // Store detailed feedback
      setDetailedFeedback(e);

      const violationNote = isTerminated ? "\n\nINTERVIEW TERMINATED DUE TO MULTIPLE TAB SWITCHES" :
        tabSwitchCount > 0 ? `\n\nWarning: Tab switched ${tabSwitchCount} time(s) during this answer` : "";

      const feedback = formatDetailedFeedback(e) + violationNote;

      setFeedbackText(feedback);

      const newResult = {
        skill: skills[currentIndex]?.skill || 'Unknown',
        capability: e.capability,
        confidence: e.confidence,
        reasoning: e.summary_feedback || e.reasoning,
        question: currentQuestion,
        answer: answer,
        tabSwitches: tabSwitchCount,
        terminated: isTerminated,
        timestamp: new Date().toISOString(),
        scores: e.scores || {},
        evaluation: e
      };

      setResults([...results, newResult]);
      setInterviewStep('feedback');

      // Speak summary
      if (e.summary_feedback) {
        speak(e.summary_feedback);
      }

    } catch (err: any) {
      console.error("Evaluation error:", err);

      const mockEval = {
        capability: 'medium',
        confidence: 'medium',
        summary_feedback: 'Your answer was received but could not be evaluated.',
        scores: { technical_score: 6, confidence_score: 6, communication_score: 6, behavioral_score: 5, overall_score: 6 }
      };

      setDetailedFeedback(mockEval);

      const mockFeedback = formatDetailedFeedback(mockEval);
      setFeedbackText(mockFeedback);

      const mockResult = {
        skill: skills[currentIndex]?.skill || 'Unknown',
        capability: 'medium',
        confidence: 'medium',
        reasoning: 'Evaluation service unavailable',
        question: currentQuestion,
        answer: answer,
        tabSwitches: tabSwitchCount,
        terminated: isTerminated,
        scores: mockEval.scores,
        evaluation: mockEval
      };

      setResults([...results, mockResult]);
      setInterviewStep('feedback');
    }
  };

  const nextSkill = () => {
    if (currentIndex + 1 < skills.length && !interviewTerminated) {
      setCurrentIndex(currentIndex + 1);

      // Use first typical question if available
      const nextSkill = skills[currentIndex + 1];
      let nextQuestion = `Tell me about your experience with ${nextSkill?.skill}`;

      if (nextSkill?.typical_questions && nextSkill.typical_questions.length > 0) {
        nextQuestion = nextSkill.typical_questions[0];
      }

      setCurrentQuestion(nextQuestion);
      const title = document.getElementById("interview-skillTitle") as HTMLElement;
      if (title) title.innerText = `Skill ${currentIndex + 2}/${skills.length}: ${nextSkill?.skill}`;
      if (answerBoxRef.current) answerBoxRef.current.value = '';
      setDetailedFeedback(null);

      setTabSwitchCount(0);
      resetAnswerTimer();

      setInterviewStep('interview');

      // Speak the question
      speak(nextQuestion);
    } else {
      saveStandardInterviewResults();
    }
  };

  const saveStandardInterviewResults = () => {
    if (!user?.email) return;

    stopCamera();

    const interviewData = {
      date: new Date().toISOString(),
      type: 'standard',
      skills: skills.map(s => s.skill),
      results: results,
      overallScore: calculateOverallScore(results),
      feedback: feedbackText,
      terminated: interviewTerminated,
      totalTabSwitches: results.reduce((sum, r) => sum + (r.tabSwitches || 0), 0)
    };

    apiCall('/history', {
      method: 'POST',
      body: JSON.stringify({ interview: interviewData })
    }).then(async (res) => {
      if (res.ok) {
        await fetchInterviewHistory(user.email);
      }
    });

    const savedInterviews = JSON.parse(localStorage.getItem(`interviews_${user.email}`) || '[]');
    savedInterviews.push({ ...interviewData, id: Date.now() });
    localStorage.setItem(`interviews_${user.email}`, JSON.stringify(savedInterviews));
    setPreviousInterviews(savedInterviews);

    setInterviewStep('summary');
    setIsInterviewActive(false);
  };

  function calculateOverallScore(results: any[], switches?: number) {
    if (!results || results.length === 0) return 0;

    // Use provided switches or sum from results
    const totalSwitches = switches !== undefined ? switches :
      results.reduce((sum, r) => sum + (r.tabSwitches || 0), 0);

    const numericScores = results
      .map(r => r.scores?.overall_score)
      .filter((s): s is number => s !== undefined && s !== null);
    let rawPercentage = 0;
    if (numericScores.length > 0) {
      rawPercentage = (numericScores.reduce((a, b) => a + b, 0) / numericScores.length) * 10;
    } else {
      const baseScores: Record<string, number> = { expert: 4, strong: 3, medium: 2, weak: 1 };
      let total = results.reduce((sum, r) => sum + (baseScores[r.capability?.toLowerCase()] || 1), 0);
      rawPercentage = (total / (results.length * 4)) * 100;
    }
    const penalty = Math.min(totalSwitches * 5, 30);
    return Math.round(Math.max(0, rawPercentage - penalty));
  }


  const viewInterviewFeedback = (interview: any) => {
    const historicalScore = interview.overallScore ??
      (interview.type === 'dynamic' ?
        calculateDynamicOverallScore(interview.results || [], interview.totalTabSwitches || 0) :
        calculateOverallScore(interview.results || [], interview.totalTabSwitches || 0));

    setViewedScore(historicalScore);

    if (interview.type === 'dynamic') {
      setQuestionHistory(interview.results || []);
      setResults([]);
      setSkills(interview.skillDetails || (interview.skills || []).map((s: string) => ({ skill: s })));
      setSkillSummaries(interview.skillSummaries || []);
      setInterviewTerminated(interview.terminated || false);
      setInterviewMode('dynamic');
    } else {
      setResults(interview.results || []);
      setQuestionHistory([]);
      setSkills((interview.skills || []).map((s: string) => ({ skill: s })));
      setSkillSummaries([]);
      setInterviewTerminated(interview.terminated || false);
      setInterviewMode('standard');
    }
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
      <style dangerouslySetInnerHTML={{
        __html: `
        .card, .interview-card { 
          background: white; 
          padding: 30px; 
          border-radius: 12px; 
          box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
          margin-bottom: 20px; 
          border: 1px solid #e5e7eb;
        }
        .hidden { display: none !important; }
        .skill-tag { 
          display: inline-block; 
          background: #e0e7ff; 
          color: #1e3a8a; 
          padding: 8px 16px; 
          border-radius: 20px; 
          margin: 6px; 
          font-size: 14px;
          font-weight: 500; 
        }
        .btn { 
          padding: 12px 24px; 
          border-radius: 8px; 
          border: none; 
          background: #3b82f6; 
          color: white; 
          font-size: 16px; 
          font-weight: 500;
          cursor: pointer; 
          margin: 5px; 
          transition: all 0.2s;
        }
        .btn:hover { background: #2563eb; transform: translateY(-1px); }
        .btn-secondary { background: #6b7280; }
        .btn-secondary:hover { background: #4b5563; }
        .btn-success { background: #10b981; }
        .btn-success:hover { background: #059669; }
        .btn-danger { background: #ef4444; }
        .btn-danger:hover { background: #dc2626; }
        .btn-warning { background: #f59e0b; color: white; }
        .btn-warning:hover { background: #d97706; }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .textarea { 
          width: 100%; 
          height: 160px; 
          padding: 16px; 
          border-radius: 8px; 
          border: 2px solid #d1d5db; 
          font-family: inherit; 
          resize: vertical; 
          margin: 15px 0; 
          font-size: 16px;
          transition: border-color 0.2s;
        }
        .textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.2);
        }
        .backend-status {
          padding: 12px 20px;
          border-radius: 8px;
          margin: 10px 0;
          font-size: 16px;
        }
        .status-good { background: #d1fae5; color: #065f46; }
        .status-bad { background: #fee2e2; color: #991b1b; }
        .status-checking { background: #fef3c7; color: #92400e; }
        .camera-container {
          width: 100%;
          max-width: 640px;
          margin: 20px auto;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.15);
          background: #1e293b;
          position: relative;
        }
        .camera-container video {
          width: 100%;
          display: block;
        }
        .timer-display {
          font-size: 24px;
          font-weight: 600;
          text-align: center;
          padding: 12px;
          background: #1e293b;
          color: white;
          border-radius: 8px;
          margin: 15px 0;
        }
        .recording-indicator {
          display: inline-block;
          width: 12px;
          height: 12px;
          background: #ef4444;
          border-radius: 50%;
          margin-right: 8px;
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
          padding: 16px;
          border-radius: 8px;
          margin: 15px 0;
          border: 2px solid #ef4444;
          text-align: center;
          font-weight: 600;
          font-size: 16px;
          animation: pulse-warning 1s infinite;
        }
        @keyframes pulse-warning {
          0% { background: #fee2e2; }
          50% { background: #fecaca; }
          100% { background: #fee2e2; }
        }
        .termination-banner {
          background: #7f1d1d;
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin: 15px 0;
          text-align: center;
          font-weight: 600;
          font-size: 18px;
          border: 2px solid #ef4444;
        }
        .tab-switch-counter {
          font-size: 14px;
          color: #6b7280;
          text-align: right;
          margin: 5px 0;
          font-weight: 500;
        }
        .nav-tab {
          padding: 12px 24px;
          background: #e5e7eb;
          color: #374151;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          font-size: 16px;
        }
        .nav-tab.active {
          background: #3b82f6;
          color: white;
        }
        .section-title {
          font-size: 28px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 25px;
        }
        .result-item {
          padding: 20px;
          margin: 10px 0;
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          font-size: 16px;
        }
        .interview-history {
          max-height: 500px;
          overflow-y: auto;
          padding: 5px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .feedback-panel {
          background: #f8fafc;
          padding: 30px;
          border-radius: 12px;
          white-space: pre-wrap;
          max-height: 600px;
          overflow-y: auto;
          margin-bottom: 20px;
          border: 2px solid #e5e7eb;
          font-size: 16px;
          line-height: 1.8;
          font-family: 'Courier New', monospace;
        }
        .generating-indicator {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 3px solid #3b82f6;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 10px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .score-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #e5e7eb;
          margin-bottom: 20px;
        }
        .score-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 15px;
          margin: 20px 0;
        }
        .score-item {
          background: #f1f5f9;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
        }
        .score-value {
          font-size: 36px;
          font-weight: 700;
          color: #3b82f6;
        }
        .score-label {
          font-size: 14px;
          color: #6b7280;
          margin-top: 5px;
        }
        .quit-confirm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .quit-confirm-box {
          background: white;
          padding: 30px;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
          text-align: center;
        }
        .button-group {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin-top: 20px;
        }
        .quit-button {
          position: fixed;
          bottom: 30px;
          right: 30px;
          z-index: 100;
          padding: 15px 30px;
          font-size: 18px;
          box-shadow: 0 4px 15px rgba(239,68,68,0.3);
        }
      ` }} />

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>
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
            <div className={`backend-status ${backendStatus.includes('✓') ? 'status-good' :
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
            <p style={{ marginBottom: '15px', fontSize: '18px' }}><strong>Email:</strong> {user?.email}</p>

            {profile?.resume ? (
              <div>
                <p style={{ color: '#059669', fontSize: '16px' }}>✓ Resume uploaded</p>
                <a href={profile.resume} target="_blank" style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: '#3b82f6',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  margin: '15px 0',
                  fontSize: '16px'
                }}>
                  View PDF
                </a>
                <br />
                <button onClick={deleteResume} className="btn btn-danger">
                  Delete
                </button>
              </div>
            ) : (
              <div>
                <input ref={fileInputRef} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{
                  width: '100%',
                  padding: '12px',
                  marginBottom: '15px',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px'
                }} />
                <button onClick={uploadResume} disabled={uploading || !file} className="btn btn-success">
                  {uploading ? 'Uploading...' : 'Upload Resume'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* INTERVIEW TAB */}
        {currentTab === 'interview' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            {/* QUIT INTERVIEW BUTTON - Show only during active interview steps */}
            {['interview', 'feedback'].includes(interviewStep) && !showQuitConfirm && (
              <button
                onClick={quitInterview}
                className="btn btn-danger quit-button"
              >
                Quit Interview
              </button>
            )}

            {/* QUIT CONFIRMATION DIALOG */}
            {showQuitConfirm && (
              <div className="quit-confirm-overlay">
                <div className="quit-confirm-box">
                  <h3 style={{ fontSize: '24px', marginBottom: '15px' }}>Quit Interview?</h3>
                  <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '20px' }}>
                    Your progress will be saved and you can review it later in history.
                  </p>
                  <div className="button-group">
                    <button onClick={cancelQuit} className="btn btn-secondary">
                      Cancel
                    </button>
                    <button onClick={confirmQuit} className="btn btn-danger">
                      Yes, Quit
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* START SCREEN */}
            {interviewStep === 'start' && (
              <div className="interview-card" style={{ textAlign: 'center', padding: '50px' }}>
                <h2 className="section-title">AI-Powered Dynamic Interview</h2>
                <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '20px' }}>
                  Upload CV → Extract skills → Adaptive interview → Comprehensive feedback
                </p>
                <p style={{ fontSize: '16px', color: '#3b82f6', marginBottom: '20px' }}>
                  ✨ The interview adapts to your answers in real-time!
                </p>

                {previousInterviews.length > 0 && (
                  <div style={{ marginTop: '30px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#475569' }}>
                        Interview History ({previousInterviews.length})
                      </h3>
                      <button
                        onClick={clearAllInterviews}
                        className="btn btn-secondary"
                        style={{ padding: '8px 20px', fontSize: '14px' }}
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="interview-history">
                      {previousInterviews.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((interview: any, index: number) => {
                        const originalIndex = previousInterviews.findIndex(i => i === interview);
                        const displayScore = interview.overallScore ??
                          (interview.type === 'dynamic' ?
                            calculateDynamicOverallScore(interview.results || [], interview.totalTabSwitches || 0) :
                            calculateOverallScore(interview.results || [], interview.totalTabSwitches || 0));

                        return (
                          <div key={interview.id || index} style={{
                            background: '#f8fafc',
                            padding: '20px',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            marginBottom: '15px',
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
                                  padding: '6px 12px',
                                  background: interview.terminated ? '#fee2e2' : '#d1fae5',
                                  color: interview.terminated ? '#991b1b' : '#065f46',
                                  borderRadius: '6px',
                                  fontWeight: '600',
                                  fontSize: '14px'
                                }}>
                                  Score: {displayScore}%
                                </span>
                                {interview.type === 'dynamic' && (
                                  <span style={{
                                    padding: '6px 12px',
                                    background: '#dbeafe',
                                    color: '#1e40af',
                                    borderRadius: '6px',
                                    fontSize: '13px'
                                  }}>
                                    Dynamic
                                  </span>
                                )}
                                {interview.partial && (
                                  <span style={{
                                    padding: '6px 12px',
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    borderRadius: '6px',
                                    fontSize: '13px'
                                  }}>
                                    Partial
                                  </span>
                                )}
                                {interview.terminated && (
                                  <span style={{
                                    padding: '6px 12px',
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    borderRadius: '6px',
                                    fontSize: '13px'
                                  }}>
                                    Terminated
                                  </span>
                                )}
                              </div>
                              <div style={{ marginTop: '8px' }}>
                                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                                  <strong>Skills:</strong> {interview.skills?.slice(0, 5).join(', ')}{interview.skills?.length > 5 ? '...' : ''}
                                </span>
                              </div>
                              {interview.totalTabSwitches > 0 && (
                                <div style={{ marginTop: '4px', fontSize: '13px', color: '#ef4444' }}>
                                  Tab switches: {interview.totalTabSwitches}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => viewInterviewFeedback(interview)}
                                className="btn btn-success"
                                style={{ padding: '8px 16px', fontSize: '14px' }}
                              >
                                View Details
                              </button>
                              <button
                                onClick={() => deleteInterview(originalIndex)}
                                className="btn btn-danger"
                                style={{ padding: '8px 12px', fontSize: '14px' }}
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
                      <div style={{ padding: '20px', background: '#f1f5f9', borderRadius: '8px' }}>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Interviews</div>
                        <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>{previousInterviews.length}</div>
                      </div>
                      <div style={{ padding: '20px', background: '#f1f5f9', borderRadius: '8px' }}>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>Average Score</div>
                        <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>
                          {Math.round(previousInterviews.reduce((acc, i) => acc + (i.overallScore || 0), 0) / previousInterviews.length)}%
                        </div>
                      </div>
                      <div style={{ padding: '20px', background: '#f1f5f9', borderRadius: '8px' }}>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>Terminated</div>
                        <div style={{ fontSize: '32px', fontWeight: '700', color: '#ef4444' }}>
                          {previousInterviews.filter(i => i.terminated).length}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '40px' }}>
                  <button
                    className="btn btn-success"
                    onClick={() => setInterviewStep('upload')}
                    style={{ padding: '16px 40px', fontSize: '18px' }}
                  >
                    Start New Interview
                  </button>
                  <br />
                  <button
                    onClick={checkBackendStatus}
                    className="btn btn-secondary"
                    style={{ marginTop: '20px', padding: '10px 24px', fontSize: '16px' }}
                  >
                    Check Backend Status
                  </button>
                </div>
              </div>
            )}

            {/* UPLOAD STEP */}
            {interviewStep === 'upload' && (
              <div className="interview-card">
                <h3 className="section-title" style={{ fontSize: '24px' }}>Upload Your CV</h3>
                <p style={{ color: '#6b7280', marginBottom: '20px', fontSize: '16px' }}>
                  The system will analyze your CV and extract relevant skills with experience levels. (PDF or DOCX)
                </p>

                <input
                  ref={cvFileRef}
                  type="file"
                  accept=".pdf,.docx"
                  style={{
                    width: '100%',
                    padding: '16px',
                    margin: '15px 0',
                    border: '2px dashed #3b82f6',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                />

                <div id="interview-uploadStatus" style={{
                  padding: '12px',
                  margin: '10px 0',
                  borderRadius: '6px',
                  background: '#f8fafc',
                  fontSize: '16px',
                  color: '#6b7280'
                }}></div>

                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
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
                <h3 className="section-title" style={{ fontSize: '24px', color: '#10b981' }}>Skills Found In Your CV</h3>
                <div id="interview-skillsList" style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  margin: '20px 0',
                  padding: '20px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  minHeight: '100px',
                  border: '2px solid #e5e7eb'
                }}>
                  {skills.map((skill, index) => (
                    <span key={index} className="skill-tag">
                      {skill.skill} ({skill.experience_level || 'intermediate'})
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
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
                    Start Dynamic Interview
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
                    ⚠️ Warning {tabSwitchCount}/3: Tab switch detected! {3 - tabSwitchCount} more and interview ends.
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

                <h4 id="interview-skillTitle" style={{ color: '#059669', fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>
                  Skill {currentIndex + 1}/{skills.length}: {skills[currentIndex]?.skill || 'Loading...'}
                  {skills[currentIndex]?.experience_level && ` (${skills[currentIndex].experience_level})`}
                </h4>

                <div style={{
                  background: '#f8fafc',
                  padding: '25px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  border: '2px solid #e5e7eb'
                }}>
                  <h4 style={{ marginTop: 0, color: '#334155', fontSize: '16px', fontWeight: '600' }}>Question:</h4>
                  <p id="interview-questionText" style={{
                    fontSize: '18px',
                    lineHeight: '1.6',
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
                        bottom: '15px',
                        left: '15px',
                        background: 'rgba(0,0,0,0.8)',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontSize: '16px'
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
                  disabled={interviewTerminated || isGeneratingNext}
                />

                {isGeneratingNext && (
                  <div style={{ textAlign: 'center', margin: '15px 0', color: '#3b82f6', fontSize: '16px' }}>
                    <span className="generating-indicator"></span>
                    Analyzing your answer and generating next question...
                  </div>
                )}

                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    className="btn"
                    onClick={startVoiceInput}
                    style={{ background: '#8b5cf6' }}
                    disabled={interviewTerminated || isGeneratingNext}
                  >
                    Voice Input
                  </button>

                  {!showCamera ? (
                    <button
                      className="btn btn-danger"
                      onClick={() => startVideoRecording()}
                      disabled={interviewTerminated || isGeneratingNext}
                    >
                      Start Video Recording
                    </button>
                  ) : (
                    <button
                      className="btn"
                      onClick={isRecording ? stopVideoRecording : () => startVideoRecording()}
                      style={{ background: isRecording ? '#ef4444' : '#10b981' }}
                      disabled={interviewTerminated || isGeneratingNext}
                    >
                      {isRecording ? 'Stop Recording' : 'Record Answer'}
                    </button>
                  )}

                  <button
                    className="btn btn-success"
                    onClick={() => submitAnswer()}
                    disabled={interviewTerminated || isGeneratingNext}
                  >
                    Submit Answer
                  </button>
                </div>

                {/* Camera toggle */}
                {!showCamera && !isRecording && (
                  <div style={{ textAlign: 'center', marginTop: '15px' }}>
                    <button
                      onClick={() => setShowCamera(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Show camera preview
                    </button>
                  </div>
                )}

                {showCamera && !isRecording && (
                  <div style={{ textAlign: 'center', marginTop: '15px' }}>
                    <button
                      onClick={stopCamera}
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '14px' }}
                    >
                      Hide Camera
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* FEEDBACK STEP - PERSISTENT SCREEN */}
            {interviewStep === 'feedback' && (
              <div className="interview-card">
                <h2 className="section-title" style={{ color: '#3b82f6' }}>Detailed Feedback</h2>

                {/* Score Grid */}
                {detailedFeedback && (detailedFeedback.scores || detailedFeedback.evaluation?.scores) && (
                  <div className="score-grid">
                    {Object.entries(detailedFeedback.scores || detailedFeedback.evaluation?.scores || {}).map(([key, value]) => {
                      if (key === 'overall_score') return null;
                      return (
                        <div key={key} className="score-item">
                          <div className="score-value">{value as number}/10</div>
                          <div className="score-label">{key.replace('_score', '').replace('_', ' ').toUpperCase()}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Overall Score */}
                {detailedFeedback && (detailedFeedback.scores?.overall_score || detailedFeedback.evaluation?.scores?.overall_score) && (
                  <div className="score-item" style={{ background: '#3b82f6', color: 'white' }}>
                    <div className="score-value" style={{ color: 'white' }}>
                      {detailedFeedback.scores?.overall_score || detailedFeedback.evaluation?.scores?.overall_score}/10
                    </div>
                    <div className="score-label" style={{ color: 'white' }}>OVERALL</div>
                  </div>
                )}

                <div className="feedback-panel">
                  {feedbackText || "Loading feedback..."}
                </div>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button
                    className="btn btn-success"
                    onClick={nextQuestion}
                    disabled={isGeneratingNext}
                    style={{ padding: '16px 40px', fontSize: '18px' }}
                  >
                    {interviewMode === 'dynamic' ? 'Next Question' :
                      (currentIndex + 1 < skills.length ? 'Next Question' : 'Finish Interview')}
                  </button>
                </div>
              </div>
            )}

            {/* SUMMARY STEP */}
            {interviewStep === 'summary' && (
              <div className="interview-card">
                <h2 className="section-title" style={{ textAlign: 'center', color: interviewTerminated ? '#ef4444' : '#10b981' }}>
                  {interviewTerminated ? 'Interview Terminated' : 'Interview Complete'}
                </h2>

                {/* Termination Reason */}
                {interviewTerminated && (
                  <div className="termination-banner" style={{ marginBottom: '20px' }}>
                    ⚠️ Terminated due to multiple tab switches (3 violations)
                  </div>
                )}

                {/* Overall Score */}
                <div style={{
                  background: interviewTerminated ? '#fee2e2' : '#f0fdf4',
                  padding: '30px',
                  borderRadius: '8px',
                  margin: '20px 0',
                  textAlign: 'center',
                  border: `2px solid ${interviewTerminated ? '#ef4444' : '#a7f3d0'}`
                }}>
                  <h3 style={{ color: interviewTerminated ? '#991b1b' : '#059669', margin: 0, fontSize: '28px' }}>
                    Overall Score: {viewedScore !== null ? viewedScore : (interviewMode === 'dynamic' ? calculateDynamicOverallScore(questionHistory) : calculateOverallScore(results))}%
                  </h3>
                  {interviewTerminated && (
                    <p style={{ color: '#991b1b', marginTop: '10px', fontWeight: '500', fontSize: '16px' }}>
                      Interview was terminated due to multiple tab switches
                    </p>
                  )}
                </div>

                {/* Consolidated Skill Summaries */}
                <div style={{ marginBottom: '30px' }}>
                  <h4 style={{ fontSize: '20px', fontWeight: '600', color: '#475569' }}>Skill Summaries</h4>
                  <div style={{
                    background: '#f8fafc',
                    padding: '20px',
                    borderRadius: '8px',
                    maxHeight: '600px',
                    overflowY: 'auto',
                    border: '2px solid #e5e7eb'
                  }}>
                    {skills.length > 0 ? (
                      skills.map((sObj: any, idx: number) => {
                        const skillName = typeof sObj === 'string' ? sObj : sObj.skill;
                        const summary = skillSummaries.find(s => s.skill.toLowerCase() === skillName.toLowerCase());
                        const result = results.findLast(r => r.skill.toLowerCase() === skillName.toLowerCase());
                        const historyItem = questionHistory.findLast(h => h.skill.toLowerCase() === skillName.toLowerCase());

                        const hasAttempted = summary || result || historyItem;
                        const rawData = summary || result || (historyItem?.evaluation?.evaluation || historyItem?.evaluation);
                        const cap = hasAttempted ? (rawData?.proficiency_level || rawData?.capability || rawData?.level || '').toLowerCase() : 'not attempted';

                        // Extract strengths/weaknesses from history if summary is missing
                        const fallbackStrengths = !summary && historyItem ? (historyItem.evaluation?.evaluation?.strengths || historyItem.evaluation?.strengths || []) : [];
                        const fallbackWeaknesses = !summary && historyItem ? (historyItem.evaluation?.evaluation?.areas_for_improvement || historyItem.evaluation?.areas_for_improvement || []) : [];

                        return (
                          <div key={idx} className="result-item" style={{
                            borderLeft: `6px solid ${!hasAttempted ? '#94a3b8' :
                              cap === 'expert' ? '#8b5cf6' :
                                cap === 'advanced' ? '#3b82f6' :
                                  cap === 'strong' || cap === 'intermediate' ? '#10b981' : '#f59e0b'
                              }`,
                            marginBottom: '20px',
                            padding: '15px',
                            background: 'white',
                            borderRadius: '0 8px 8px 0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '18px' }}>{skillName}</strong>
                              <span style={{
                                padding: '6px 16px',
                                background: !hasAttempted ? '#f1f5f9' :
                                  cap === 'expert' ? '#ede9fe' :
                                    cap === 'advanced' ? '#dbeafe' :
                                      cap === 'strong' || cap === 'intermediate' ? '#d1fae5' : '#fef3c7',
                                color: !hasAttempted ? '#475569' :
                                  cap === 'expert' ? '#6d28d9' :
                                    cap === 'advanced' ? '#1e40af' :
                                      cap === 'strong' || cap === 'intermediate' ? '#065f46' : '#92400e',
                                borderRadius: '6px',
                                fontWeight: '600',
                                fontSize: '14px'
                              }}>
                                {cap.toUpperCase()}
                              </span>
                            </div>

                            {hasAttempted ? (
                              <>
                                {(summary || (fallbackStrengths.length > 0 || fallbackWeaknesses.length > 0)) ? (
                                  <>
                                    {(summary?.strengths || fallbackStrengths).length > 0 && (
                                      <div style={{ marginTop: '10px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>Strengths:</span>
                                        <ul style={{ margin: '8px 0 0 20px', fontSize: '14px', color: '#6b7280' }}>
                                          {(summary?.strengths || fallbackStrengths).slice(0, 3).map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {(summary?.weaknesses || fallbackWeaknesses).length > 0 && (
                                      <div style={{ marginTop: '10px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#ef4444' }}>Areas to Improve:</span>
                                        <ul style={{ margin: '8px 0 0 20px', fontSize: '14px', color: '#6b7280' }}>
                                          {(summary?.weaknesses || fallbackWeaknesses).slice(0, 3).map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {(summary?.summary || rawData?.summary_feedback || rawData?.reasoning) && (
                                      <p style={{ marginTop: '10px', fontSize: '14px', color: '#4b5563', fontStyle: 'italic' }}>
                                        {summary?.summary || rawData?.summary_feedback || rawData?.reasoning}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p style={{ marginTop: '10px', fontSize: '14px', color: '#6b7280' }}>
                                    {result?.reasoning || (historyItem?.evaluation?.evaluation || historyItem?.evaluation)?.summary_feedback || 'No detailed summary available.'}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p style={{ marginTop: '10px', fontSize: '14px', color: '#94a3b8', fontStyle: 'italic' }}>
                                You did not reach this skill during the interview.
                              </p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p style={{ textAlign: 'center', color: '#64748b' }}>No skills were selected for this interview.</p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setInterviewStep('start');
                      stopCamera();
                      setInterviewMode('standard');
                      setDetailedFeedback(null);
                    }}
                    style={{ padding: '12px 30px', fontSize: '16px' }}
                  >
                    Back to Dashboard
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      setInterviewStep('upload');
                      stopCamera();
                      setInterviewMode('standard');
                      setQuestionHistory([]);
                      setSkillSummaries([]);
                      setDetailedFeedback(null);
                    }}
                    style={{ padding: '12px 30px', fontSize: '16px' }}
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
