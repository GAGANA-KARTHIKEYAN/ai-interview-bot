'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, BACKEND_URL } from '@/lib/api';

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
  const [terminationReason, setTerminationReason] = useState<string | null>(null);
  const [summaryTab, setSummaryTab] = useState<'analysis' | 'transcripts'>('analysis');
  const [allInterviewHistory, setAllInterviewHistory] = useState<any[]>([]);

  const answerBoxRef = useRef<HTMLTextAreaElement>(null);
  const cvFileRef = useRef<HTMLInputElement>(null);

  // Helper function for making API calls
  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
      'email': user?.email || ''
    };
    return apiClient(`/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`, { ...options, headers });
  }, [user?.email]);

  // Debug logging
  useEffect(() => {
    console.log('🔧 Environment:', process.env.NODE_ENV);
    console.log('🔧 BACKEND_URL from env:', process.env.NEXT_PUBLIC_BACKEND_URL);
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
    console.log('🔧 Production Mode:', process.env.NODE_ENV === 'production');
  }, []);

  // ========== PROFILE FUNCTIONS ==========
  const refreshProfile = useCallback(() => {
    if (!user?.email) return;
    apiClient('/api/profile', {
      headers: { 'email': user.email },
      cache: 'no-store'
    })
      .then(setProfile)
      .catch(err => {
        console.error('Profile refresh failed:', err);
        setProfile({ email: user?.email, resume: null, parsedResume: null });
      });
  }, [user?.email]);

  const fetchInterviewHistory = useCallback(async (emailToUse: string) => {
    const email = emailToUse || user?.email;
    if (!email) return;

    try {
      const data = await apiCall('/history', { headers: { 'email': email } });
      console.log(`📜 History fetched for ${email}:`, data.history?.length || 0, "records");
      setPreviousInterviews(data.history || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, [apiCall, user?.email]);

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
      apiClient(`/api/profile`, {
        headers: { 'email': parsedUser.email },
        cache: 'no-store'
      })
        .then(setProfile)
        .catch(console.error);

      // Pass email directly to fetchInterviewHistory
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
            setTerminationReason("3 tab switches detected");
            setShowTabWarning(false);
            setInterviewStep('summary');
            setIsInterviewActive(false);

            const invalidAnswer = "INTERVIEW TERMINATED: Tab switching detected 3 times";
            if (answerBoxRef.current) {
              answerBoxRef.current.value = invalidAnswer;
            }

            // Save terminated interview
            saveTerminatedInterview("Multiple tab switches detected");

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

  const saveTerminatedInterview = (reason?: string) => {
    if (!user?.email) return;

    const actualReason = reason || terminationReason || 'Interview ended early';

    const interviewData = {
      date: new Date().toISOString(),
      type: interviewMode,
      skills: skills.map(s => s.skill),
      skillDetails: skills,
      results: interviewMode === 'dynamic' ? questionHistory : results,
      skillSummaries: skillSummaries,
      overallScore: 0,
      terminated: true,
      terminationReason: actualReason,
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
      const data = await apiClient('/api/status', {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      let statusMsg = '✓ Backend is online';
      if (data.supabase_connected) {
        statusMsg += ' (Database Connected)';
      } else {
        statusMsg += ' (⚠️ Database Disconnected)';
        if (data.environment === 'cloud') {
          alert("CRITICAL WARNING: The database is not connected. Your data and resumes will be LOST when you refresh or log out. Please check your Amplify Environment Variables.");
        }
      }

      setBackendStatus(statusMsg);
    } catch (err) {
      setBackendStatus('✗ Backend unreachable');
    }
  };

  const uploadResume = async () => {
    if (!file || !user?.email) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('resume', file);
    formData.append('email', user.email);
    try {
      // Use apiClient directly to ensure we control headers for file upload
      const response = await fetch(`${BACKEND_URL}/api/resume`, {
        method: 'POST',
        headers: {
          'email': user?.email || 'unknown',
          // Note: browser sets Content-Type for FormData
        },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || "Upload failed");
      }

      const data = await response.json();
      console.log("Resume upload success:", data);
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
    } catch (err: any) {
      console.error(err);
      alert('Upload error: ' + err.message);
    }
    setUploading(false);
  };

  const deleteResume = async () => {
    if (!user?.email || !confirm('Delete resume?')) return;
    try {
      await apiCall('/resume', {
        method: 'DELETE',
        headers: { 'email': user.email }
      });
      refreshProfile();
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert('Delete failed: ' + err.message);
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

      const data = await apiCall('/upload-and-analyze', {
        method: "POST",
        body: fd,
        signal: controller.signal
      });

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

      if (data.success === false) {
        const errorMsg = data.error || "Unknown analysis error";
        alert(`Analysis failed: ${errorMsg}`);
        if (status) status.innerText = `Error: ${errorMsg}`;
        setIsAnalyzing(false);
        return;
      }

      if (matchedSkills.length === 0) {
        alert("No skills matched. Using default skills to proceed.");
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

      // PERSISTENCE FIX: Save to profile immediately
      if (user?.email) {
        apiCall('/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: {
              ...profile,
              parsedResume: matchedSkills,
              email: user.email
            }
          })
        }).then(() => refreshProfile());
      }
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
      const data = await apiCall('/start-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: skills,
          userLevel: 'intermediate'
        })
      });

      if (data.success) {
        setInterviewSession(data.interview_state);
        setCurrentQuestion(data.question.question);
        setCurrentAnalysis(null);
        setAllInterviewHistory([]);

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

      // The API returns {evaluation: {...}} - unwrap it
      const evaluation = evalResponse?.evaluation || evalResponse;

      if (!evaluation || !evaluation.capability) {
        console.warn('Evaluation response missing capability, using fallback');
        // Don't throw - use a fallback so the interview can continue
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
      setAllInterviewHistory(prev => [...prev, newHistoryItem]);

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
`;

    // Score Table (Only show metrics > 0)
    feedback += `\n📊 SCORES\n`;

    const activeMetrics = [];
    if (scores.technical_score > 0) activeMetrics.push(` Technical: ${scores.technical_score}/10 `);
    if (scores.confidence_score > 0) activeMetrics.push(` Confidence: ${scores.confidence_score}/10 `);
    if (scores.communication_score > 0) activeMetrics.push(` Communication: ${scores.communication_score}/10 `);
    if (scores.behavioral_score > 0) activeMetrics.push(` Behavioral: ${scores.behavioral_score}/10 `);

    feedback += `   ${activeMetrics.join(' | ')}\n`;
    feedback += `\n   Overall Score: ${scores.overall_score}/10\n`;

    // Score explanations
    feedback += `\n📈 SCORE EXPLANATIONS\n`;
    if (scores.technical_score > 0 && scoreExplanations.technical_explanation) {
      feedback += `   • Technical: ${scoreExplanations.technical_explanation}\n`;
    }
    if (scores.confidence_score > 0 && scoreExplanations.confidence_explanation) {
      feedback += `   • Confidence: ${scoreExplanations.confidence_explanation}\n`;
    }
    if (scores.communication_score > 0 && scoreExplanations.communication_explanation) {
      feedback += `   • Communication: ${scoreExplanations.communication_explanation}\n`;
    }
    if (scores.behavioral_score > 0 && scoreExplanations.behavioral_explanation) {
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
      const nextData = await apiCall('/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: skills[currentIndex]?.skill,
          answer: questionHistory[questionHistory.length - 1]?.answer || '',
          question: currentQuestion,
          history: questionHistory,
          skills_remaining: skillsRemaining
        })
      });

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
      const summary = await apiCall('/generate-skill-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: skill,
          history: questionHistory,
          evaluations: questionHistory.map(h => h.evaluation)
        })
      });

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
      const report = await apiCall('/final-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: skills,
          all_qa: questionHistory,
          all_evaluations: questionHistory.map(h => h.evaluation),
          skillSummaries: summariesToUse
        })
      });

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
      results: allInterviewHistory.length > 0 ? allInterviewHistory : questionHistory,
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
    }).then(async () => {
      await fetchInterviewHistory(user.email);
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

      const data = await apiCall('/evaluate', {
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


      const e = data.evaluation || data;

      if (!e || !e.capability) {
        console.warn('Evaluation response missing capability, using fallback');
        // Don't throw - allow the interview to continue with partial data
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
    }).then(async () => {
      await fetchInterviewHistory(user.email);
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
      setAllInterviewHistory(interview.results || []);
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
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{
        __html: `
        .dashboard-container { 
          max-width: 1200px; 
          margin: 0 auto; 
          padding: 40px 20px;
          animation: fadeIn 0.4s ease-out;
        }
        .header-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
          background: white;
          padding: 20px 32px;
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-md);
          border: 1px solid var(--gray-100);
        }
        .nav-group { display: flex; gap: 12px; align-items: center; }
        .user-welcome { font-size: 24px; font-weight: 800; color: var(--gray-900); letter-spacing: -0.02em; }
        .user-name { background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        
        /* Smooth transitions for tab switching */
        .tab-content { animation: fadeInUp 0.4s ease-out; }
        
        /* Customized layout for dashboard specific cards */
        .profile-card { max-width: 800px; margin: 0 auto; }
        .interview-main { max-width: 900px; margin: 0 auto; }
      ` }} />

      <div className="dashboard-container">
        {/* HEADER */}
        <header className="header-nav">
          <h1 className="user-welcome">
            Welcome, <span className="user-name">{user?.name}</span>
          </h1>
          <div className="nav-group">
            <button
              onClick={() => setCurrentTab('profile')}
              className={`nav-tab ${currentTab === 'profile' ? 'active' : ''}`}
            >
              Overview
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
            <div style={{ width: '1px', height: '24px', background: 'var(--gray-200)', margin: '0 8px' }} />
            <button
              onClick={logout}
              className="btn btn-secondary btn-sm"
              style={{ padding: '8px 16px', background: 'white', border: '1px solid var(--gray-200)' }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* BACKEND STATUS INDICATOR */}
        {currentTab === 'interview' && (
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <div className={`backend-status ${backendStatus.includes('✓') ? 'status-good' :
              backendStatus.includes('✗') ? 'status-bad' : 'status-checking'
              }`}>
              <span style={{ fontSize: '18px' }}>{backendStatus.includes('✓') ? '●' : '○'}</span>
              {backendStatus}
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {currentTab === 'profile' && (
          <div className="tab-content profile-card">
            <div className="card-elevated" style={{ marginBottom: '32px' }}>
              <div className="section-title">
                <span style={{ padding: '8px', background: 'var(--primary-100)', borderRadius: '10px', fontSize: '20px' }}>👤</span>
                Profile Settings
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                <div className="input-group">
                  <label>Full Name</label>
                  <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--gray-900)' }}>{user?.name || 'User'}</p>
                </div>
                <div className="input-group">
                  <label>Email Address</label>
                  <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--gray-900)' }}>{user?.email}</p>
                </div>
              </div>

              <div className="divider" />

              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--gray-700)', marginBottom: '16px' }}>Resume & Documents</h3>

                {profile?.resume ? (
                  <div className="glass-card" style={{ padding: '24px', border: '1px solid var(--success-100)', background: 'var(--success-50)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ fontSize: '32px' }}>📄</div>
                        <div>
                          <p style={{ fontWeight: '700', color: 'var(--success-700)', marginBottom: '2px' }}>Resume Uploaded</p>
                          <p style={{ fontSize: '14px', color: 'var(--success-600)' }}>Your CV is active and ready for interviews.</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <a
                          href={profile.resume.startsWith('http') ? profile.resume : `${BACKEND_URL}${profile.resume.startsWith('/') ? '' : '/'}${profile.resume}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ background: 'white' }}
                        >
                          View PDF
                        </a>
                        <button onClick={deleteResume} className="btn btn-danger btn-sm">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      className="upload-zone"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ borderStyle: 'dashed', borderWidth: '2px' }}
                    >
                      <div style={{ fontSize: '40px', marginBottom: '16px' }}>📤</div>
                      <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Upload Your Resume</h4>
                      <p style={{ color: 'var(--gray-500)', fontSize: '14px', marginBottom: '20px' }}>Support for PDF format up to 5MB</p>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        style={{ display: 'none' }}
                      />

                      {file && (
                        <div className="badge badge-primary" style={{ marginBottom: '16px', padding: '8px 16px' }}>
                          Selected: {file.name}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); uploadResume(); }}
                          disabled={uploading || !file}
                          className="btn btn-primary"
                        >
                          {uploading ? 'Processing...' : 'Complete Upload'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* DASHBOARD STATISTICS & PROGRESS */}
              <div className="divider" style={{ margin: '32px 0' }} />

              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--gray-800)', marginBottom: '20px' }}>Performance Analytics</h3>

                <div className="stats-grid" style={{ marginBottom: '32px' }}>
                  <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', color: 'var(--gray-500)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Sessions</div>
                    <div style={{ fontSize: '36px', fontWeight: '900', color: 'var(--gray-900)', marginTop: '8px' }}>{previousInterviews.length}</div>
                  </div>
                  <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', color: 'var(--gray-500)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average Match</div>
                    <div style={{ fontSize: '36px', fontWeight: '900', color: 'var(--primary-600)', marginTop: '8px' }}>
                      {previousInterviews.length > 0
                        ? Math.round(previousInterviews.reduce((acc, i) => acc + (i.overallScore || 0), 0) / previousInterviews.length)
                        : 0}%
                    </div>
                  </div>
                  <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', color: 'var(--gray-500)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Terminated</div>
                    <div style={{ fontSize: '36px', fontWeight: '900', color: 'var(--danger-500)', marginTop: '8px' }}>
                      {previousInterviews.filter(i => i.terminated).length}
                    </div>
                  </div>
                </div>

                {/* PROGRESS GRAPH */}
                {previousInterviews.length > 1 && (
                  <div className="glass-card" style={{ padding: '32px', background: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                      <h4 style={{ fontWeight: '700', color: 'var(--gray-700)' }}>Improvement over time</h4>
                      <span className="badge badge-success">Trend: Rising</span>
                    </div>

                    <div style={{ height: '200px', width: '100%', position: 'relative', overflow: 'visible', padding: '10px 0' }}>
                      <svg viewBox="0 0 1000 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        {/* Grid lines */}
                        {[0, 50, 100, 150, 200].map(y => (
                          <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="var(--gray-100)" strokeWidth="1" />
                        ))}

                        {/* The Path */}
                        <path
                          d={`M ${previousInterviews.slice(-10).map((i, idx) => {
                            const x = (idx / (Math.min(previousInterviews.length, 10) - 1)) * 1000;
                            const y = 200 - ((i.overallScore || 0) * 2);
                            return `${x},${y}`;
                          }).join(' L ')}`}
                          fill="none"
                          stroke="var(--primary-500)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ filter: 'drop-shadow(0 4px 6px rgba(99, 102, 241, 0.3))' }}
                        />

                        {/* Points */}
                        {previousInterviews.slice(-10).map((i, idx) => {
                          const x = (idx / (Math.min(previousInterviews.length, 10) - 1)) * 1000;
                          const y = 200 - ((i.overallScore || 0) * 2);
                          return (
                            <g key={idx}>
                              <circle cx={x} cy={y} r="6" fill="white" stroke="var(--primary-600)" strokeWidth="3" />
                              <text x={x} y={y - 15} textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--gray-500)">{i.overallScore || 0}%</text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '12px', color: 'var(--gray-400)', fontWeight: '600' }}>
                      <span>First Recorded Session</span>
                      <span>Last 10 Sessions</span>
                      <span>Latest Activity</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}



        {/* INTERVIEW TAB */}
        {currentTab === 'interview' && (
          <div className="tab-content interview-main">
            {/* START STEP */}
            {interviewStep === 'start' && (
              <div className="animate-fadeInUp">
                <div className="card-elevated" style={{ textAlign: 'center', padding: '60px 40px' }}>
                  <div style={{ fontSize: '64px', marginBottom: '24px' }}>🚀</div>
                  <h2 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '16px', color: 'var(--gray-900)' }}>Ready to Level Up?</h2>
                  <p style={{ color: 'var(--gray-500)', fontSize: '18px', maxWidth: '500px', margin: '0 auto 40px', lineHeight: '1.6' }}>
                    Start a personalized AI interview session based on your profile or upload a new resume to target specific roles.
                  </p>

                  <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary btn-lg"
                      onClick={() => setInterviewStep('upload')}
                    >
                      New Interview Session
                    </button>
                    <button
                      onClick={() => checkBackendStatus()}
                      className="btn btn-secondary btn-lg"
                      style={{ background: 'white' }}
                    >
                      Check API Status
                    </button>
                  </div>
                </div>

                {/* HISTORY SECTION */}
                <div style={{ marginTop: '48px' }}>
                  <div className="section-title">
                    <span style={{ padding: '8px', background: 'var(--primary-100)', borderRadius: '10px', fontSize: '20px' }}>📜</span>
                    Interview History
                  </div>

                  {previousInterviews.length > 0 ? (
                    <div style={{ display: 'grid', gap: '16px' }}>
                      {previousInterviews.slice().reverse().map((interview, idx) => {
                        const dateObj = new Date(interview.date);
                        const displayDate = dateObj.toLocaleDateString();
                        const displayTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div key={idx} className="history-card" onClick={() => viewInterviewFeedback(interview)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                              <div style={{ minWidth: '240px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--gray-900)' }}>
                                    {interview.type === 'dynamic' ? '🚀 Dynamic Session' : '📋 Standard Interview'}
                                  </span>
                                  {interview.type === 'dynamic' && <span className="badge badge-primary" style={{ fontSize: '10px' }}>AI Adaptive</span>}
                                  {interview.terminated && <span className="badge badge-danger" style={{ fontSize: '10px' }}>Terminated</span>}
                                  {interview.partial && <span className="badge badge-warning" style={{ fontSize: '10px' }}>Partial</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--gray-500)' }}>
                                  <span>📅 {displayDate}</span>
                                  <span>⏰ {displayTime}</span>
                                  {interview.totalTabSwitches > 0 && (
                                    <span style={{ color: 'var(--danger-500)', fontWeight: '600' }}>⚠️ {interview.totalTabSwitches} Switches</span>
                                  )}
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginTop: '8px' }}>
                                  {interview.skills?.join(', ') || 'General Proficiency'}
                                </p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '28px', fontWeight: '900', color: interview.terminated ? 'var(--gray-400)' : 'var(--primary-600)', lineHeight: '1' }}>
                                  {interview.overallScore || 0}%
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: '800', marginTop: '4px', letterSpacing: '0.05em' }}>Success Rate</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '40px', background: 'white' }}>
                      <p style={{ color: 'var(--gray-400)' }}>No past interviews found. Start your first session above!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* UPLOAD STEP */}
            {interviewStep === 'upload' && (
              <div className="card-elevated animate-slideUp">
                <h3 className="section-title">
                  <span style={{ fontSize: '24px' }}>📄</span>
                  CV Analysis
                </h3>
                <p style={{ color: 'var(--gray-500)', marginBottom: '32px', fontSize: '16px' }}>
                  Upload your resume and we'll dynamically generate relevant interview questions based on your specific experience.
                </p>

                <div
                  className={`upload-zone ${file ? 'has-file' : ''}`}
                  onClick={() => cvFileRef.current?.click()}
                >
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📎</div>
                  <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
                    {file ? file.name : 'Select Resume File'}
                  </h4>
                  <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>PDF or DOCX accepted (Max 10MB)</p>

                  <input
                    ref={cvFileRef}
                    type="file"
                    accept=".pdf,.docx"
                    style={{ display: 'none' }}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setInterviewStep('start')}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={analyzeCV}
                    disabled={isAnalyzing || !file}
                    style={{ flex: 1 }}
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="generating-indicator" style={{ borderTopColor: 'white' }} />
                        Extracting Skills...
                      </>
                    ) : 'Analyze & Proceed'}
                  </button>
                </div>
              </div>
            )}

            {/* SKILLS STEP */}
            {interviewStep === 'skills' && (
              <div className="card-elevated animate-slideUp">
                <h3 className="section-title" style={{ color: 'var(--success-600)' }}>
                  <span style={{ fontSize: '24px' }}>🎯</span>
                  Skills Found In Your CV
                </h3>
                <p style={{ color: 'var(--gray-500)', marginBottom: '24px' }}>We've identified the following core competencies. You'll be interviewed on these topics.</p>

                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  margin: '24px 0',
                  padding: '32px',
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px solid var(--gray-100)',
                  minHeight: '120px'
                }}>
                  {skills.map((skill, index) => (
                    <div key={index} className="skill-chip selected animate-fadeIn" style={{ animationDelay: `${index * 0.1}s` }}>
                      <span>{skill.skill}</span>
                      <div className="badge badge-primary" style={{ fontSize: '10px', padding: '2px 8px' }}>
                        {skill.experience_level || 'intermediate'}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setInterviewStep('upload')}
                  >
                    Re-upload
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={startInterview}
                    style={{ flex: 1 }}
                  >
                    Begin Dynamic Interview
                  </button>
                </div>
              </div>
            )}

            {/* INTERVIEW STEP */}
            {interviewStep === 'interview' && (
              <div className="card animate-fadeIn" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ background: 'var(--gray-900)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="badge badge-primary" style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--primary-300)' }}>
                      Question {currentIndex + 1} of {skills.length}
                    </div>
                    <span style={{ fontSize: '14px', color: 'var(--gray-400)' }}>•</span>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{skills[currentIndex]?.skill}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', color: answerTimer < 30 ? 'var(--danger-500)' : 'white' }}>
                      {formatTime(answerTimer)}
                    </div>
                    <div style={{ width: '1px', height: '20px', background: 'var(--gray-700)' }} />
                    <div style={{ fontSize: '12px', color: 'var(--gray-400)', fontWeight: '600' }}>
                      Switches: <span style={{ color: tabSwitchCount > 1 ? 'var(--danger-400)' : 'white' }}>{tabSwitchCount}/3</span>
                    </div>
                  </div>
                </div>

                {showTabWarning && <div className="tab-warning">⚠️ WARNING: Tab switch detected! Don't leave this page.</div>}
                {interviewTerminated && (
                  <div className="termination-banner" style={{ margin: '0', borderRadius: '0' }}>
                    Interview Terminated - Integrity Check Failed
                  </div>
                )}

                <div style={{ padding: '32px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
                    <div className="chat-bubble bot">
                      <div style={{ fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: '8px', letterSpacing: '0.05em' }}>AI Interviewer</div>
                      <p style={{ fontSize: '18px', fontWeight: '500', lineHeight: '1.5' }}>{currentQuestion || "Preparing your next question..."}</p>
                    </div>

                    {showCamera && (
                      <div className="camera-container" style={{ margin: '12px 0', border: '4px solid var(--gray-100)' }}>
                        <video ref={videoRef} autoPlay playsInline muted />
                        {isRecording && (
                          <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}>
                            <div className="recording-indicator" />
                            <span style={{ color: 'white', fontSize: '12px', fontWeight: '700' }}>RECORDING</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="input-group">
                    <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      Your Response
                      <span style={{ fontWeight: 'normal', color: 'var(--gray-400)', fontSize: '14px' }}>
                        {isRecording ? 'Capturing input...' : 'Type or use Voice Input'}
                      </span>
                    </label>
                    <textarea
                      ref={answerBoxRef}
                      className="input-field"
                      style={{ height: '140px' }}
                      placeholder="Explain your thought process..."
                      disabled={interviewTerminated || isGeneratingNext}
                    />
                  </div>

                  {isGeneratingNext && (
                    <div className="animate-pulse" style={{ textAlign: 'center', margin: '24px 0', color: 'var(--primary-600)', fontSize: '15px', fontWeight: '600' }}>
                      <span className="generating-indicator"></span>
                      Processing your answer...
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button className="btn btn-secondary" onClick={() => startVoiceInput()} disabled={interviewTerminated || isGeneratingNext} style={{ background: 'white' }}>
                      🎤 Voice Input
                    </button>

                    {!showCamera ? (
                      <button className="btn btn-secondary" onClick={() => setShowCamera(true)} disabled={interviewTerminated || isGeneratingNext} style={{ background: 'white' }}>
                        📹 Enable Camera
                      </button>
                    ) : (
                      <button className="btn btn-secondary" onClick={stopCamera} disabled={interviewTerminated || isGeneratingNext} style={{ background: 'white', color: 'var(--danger-600)' }}>
                        🚫 Hide Camera
                      </button>
                    )}

                    <div style={{ flex: 1 }} />

                    <button
                      className="btn btn-primary"
                      onClick={() => submitAnswer()}
                      disabled={interviewTerminated || isGeneratingNext}
                      style={{ padding: '12px 32px' }}
                    >
                      Submit Answer →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* FEEDBACK STEP */}
            {interviewStep === 'feedback' && (
              <div className="card-elevated animate-slideUp" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ background: 'var(--success-600)', padding: '24px 32px', color: 'white' }}>
                  <h3 style={{ fontSize: '24px', fontWeight: '800' }}>Quick Feedback</h3>
                  <p style={{ opacity: 0.8, fontSize: '15px' }}>Topic: {skills[currentIndex]?.skill}</p>
                </div>

                <div style={{ padding: '32px' }}>
                  <div className="glass-card" style={{
                    padding: '24px',
                    background: 'var(--gray-50)',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    marginBottom: '32px',
                    lineHeight: '1.8'
                  }}>
                    <p style={{ fontSize: '16px', color: 'var(--gray-800)' }}>{feedbackText || "Evaluating..."}</p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button className="btn btn-primary" onClick={nextQuestion} style={{ padding: '14px 40px' }}>
                      {currentIndex < skills.length - 1 ? 'Next Question →' : 'Finish Session'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SUMMARY STEP */}
            {interviewStep === 'summary' && (
              <div className="card-elevated animate-fadeInUp">
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                  <div className="badge badge-success" style={{ marginBottom: '16px' }}>Interview Complete</div>
                  <h2 style={{ fontSize: '36px', fontWeight: '900', color: 'var(--gray-900)' }}>Report Summary</h2>
                </div>

                <div className="score-card">
                  <div className="score-grid">
                    <div className="score-item">
                      <div className="score-value">{viewedScore ?? 0}%</div>
                      <div className="score-label">Overall Match</div>
                    </div>
                    <div className="score-item">
                      <div className="score-value" style={{ color: 'var(--accent-500)' }}>{questionHistory.length}</div>
                      <div className="score-label">Questions</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', background: 'var(--gray-100)', padding: '6px', borderRadius: 'var(--radius-lg)', marginBottom: '32px' }}>
                  <button 
                    onClick={() => setSummaryTab('analysis')}
                    style={{ 
                      flex: 1, 
                      padding: '12px', 
                      borderRadius: 'var(--radius-md)', 
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: summaryTab === 'analysis' ? 'white' : 'transparent',
                      color: summaryTab === 'analysis' ? 'var(--primary-600)' : 'var(--gray-500)',
                      boxShadow: summaryTab === 'analysis' ? 'var(--shadow-sm)' : 'none'
                    }}
                  >
                    Skills Analysis
                  </button>
                  <button 
                    onClick={() => setSummaryTab('transcripts')}
                    style={{ 
                      flex: 1, 
                      padding: '12px', 
                      borderRadius: 'var(--radius-md)', 
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: summaryTab === 'transcripts' ? 'white' : 'transparent',
                      color: summaryTab === 'transcripts' ? 'var(--primary-600)' : 'var(--gray-500)',
                      boxShadow: summaryTab === 'transcripts' ? 'var(--shadow-sm)' : 'none'
                    }}
                  >
                    Session Transcripts
                  </button>
                </div>

                {summaryTab === 'analysis' ? (
                  <div className="animate-fadeIn">
                    <h3 className="section-title">Detailed Analysis</h3>
                    <div style={{ display: 'grid', gap: '20px', marginTop: '16px' }}>
                      {skills.map((skillItem: any, idx: number) => {
                        const skillName = skillItem.skill;
                        const summaryObj = skillSummaries.find((s: any) => s.skill === skillName);
                        const skillHistory = (allInterviewHistory.length > 0 ? allInterviewHistory : questionHistory).filter((q: any) => q.skill === skillName);
                        const lastEval = skillHistory[skillHistory.length - 1]?.evaluation?.evaluation || skillHistory[skillHistory.length - 1]?.evaluation;
                        const isAttempted = skillHistory.length > 0;
                        
                        return (
                          <div key={idx} className="glass-card" style={{ padding: '24px', border: '1px solid var(--gray-100)', background: 'white', opacity: isAttempted ? 1 : 0.7 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <h4 style={{ fontWeight: '800', fontSize: '18px', color: isAttempted ? 'var(--gray-900)' : 'var(--gray-500)' }}>{skillName}</h4>
                              {isAttempted ? (
                                lastEval?.scores?.overall_score && (
                                  <div className="badge badge-primary">{lastEval.scores.overall_score * 10}%</div>
                                )
                              ) : (
                                <div className="badge" style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}>Not Reached</div>
                              )}
                            </div>
                            
                            <div style={{ fontSize: '14px', color: isAttempted ? 'var(--gray-600)' : 'var(--gray-400)', lineHeight: '1.6', fontStyle: isAttempted ? 'normal' : 'italic' }}>
                              {isAttempted 
                                ? (summaryObj?.summary || lastEval?.summary_feedback || "Professional assessment completed for this skill area.")
                                : "This skill area was not reached during this session due to early termination or session flow."}
                            </div>

                            {isAttempted && (
                              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {/* Strengths */}
                                {lastEval?.strengths?.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--success-700)', textTransform: 'uppercase', marginBottom: '4px' }}>Strengths</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {lastEval.strengths.slice(0, 3).map((s: string, i: number) => (
                                        <span key={i} style={{ fontSize: '11px', background: 'var(--success-50)', color: 'var(--success-700)', padding: '4px 10px', borderRadius: '6px', fontWeight: '600', border: '1px solid var(--success-100)' }}>
                                          ✓ {s}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Areas to Improve */}
                                {(lastEval?.areas_for_improvement?.length > 0 || lastEval?.gaps_identified?.knowledge_gaps?.length > 0) && (
                                  <div>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--danger-700)', textTransform: 'uppercase', marginBottom: '4px' }}>Areas to Improve</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {(lastEval.areas_for_improvement || lastEval.gaps_identified?.knowledge_gaps || []).slice(0, 3).map((a: string, i: number) => (
                                        <span key={i} style={{ fontSize: '11px', background: 'var(--danger-50)', color: 'var(--danger-700)', padding: '4px 10px', borderRadius: '6px', fontWeight: '600', border: '1px solid var(--danger-100)' }}>
                                          ⚠ {a}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="animate-fadeIn">
                    <h3 className="section-title">Session Transcripts</h3>
                    <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)', padding: '24px', marginTop: '16px' }}>
                      {allInterviewHistory.length > 0 ? (
                        allInterviewHistory.map((qa: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: idx === questionHistory.length - 1 ? 0 : '24px', paddingBottom: idx === questionHistory.length - 1 ? 0 : '24px', borderBottom: idx === questionHistory.length - 1 ? 'none' : '1px solid var(--gray-200)' }}>
                            <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--primary-600)', textTransform: 'uppercase', marginBottom: '8px' }}>
                              Question {idx + 1}: {qa.skill}
                            </div>
                            <p style={{ fontWeight: '600', color: 'var(--gray-800)', marginBottom: '12px', fontSize: '15px' }}>{qa.question}</p>
                            <div style={{ background: 'white', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)', fontSize: '14px', color: 'var(--gray-700)' }}>
                              <strong>Your Answer:</strong> {qa.answer}
                            </div>
                          </div>
                        ))
                      ) : questionHistory.length > 0 ? (
                        questionHistory.map((qa: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: idx === questionHistory.length - 1 ? 0 : '24px', paddingBottom: idx === questionHistory.length - 1 ? 0 : '24px', borderBottom: idx === questionHistory.length - 1 ? 'none' : '1px solid var(--gray-200)' }}>
                            <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--primary-600)', textTransform: 'uppercase', marginBottom: '8px' }}>
                              Question {idx + 1}: {qa.skill}
                            </div>
                            <p style={{ fontWeight: '600', color: 'var(--gray-800)', marginBottom: '12px', fontSize: '15px' }}>{qa.question}</p>
                            <div style={{ background: 'white', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)', fontSize: '14px', color: 'var(--gray-700)' }}>
                              <strong>Your Answer:</strong> {qa.answer}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                          No transcript available for this session.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '40px' }}>
                  <button className="btn btn-secondary" onClick={() => {
                    setInterviewStep('start');
                    stopCamera();
                  }}>Back to Dashboard</button>
                  <button className="btn btn-primary" onClick={() => {
                    setInterviewStep('upload');
                    stopCamera();
                  }}>New Session</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
