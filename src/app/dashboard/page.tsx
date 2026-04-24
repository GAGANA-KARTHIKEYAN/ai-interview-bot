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
  const [cameraUsed, setCameraUsed] = useState(false);
  const [pendingTurn, setPendingTurn] = useState<any>(null);
  const [currentLevel, setCurrentLevel] = useState(1);
  const ignoreFocusLossRef = useRef<boolean>(false);
  const speakTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const answerBoxRef = useRef<HTMLTextAreaElement>(null);
  const cvFileRef = useRef<HTMLInputElement>(null);

  // Helper function for making API calls
  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const email = user?.email;
    const extraHeaders: Record<string, string> = {};
    // Only add email header if we actually have one — never send empty string
    if (email) extraHeaders['email'] = email;
    const headers = { ...extraHeaders, ...(options.headers || {}) };
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
  const refreshProfile = useCallback((emailToUse?: string) => {
    const email = emailToUse || user?.email;
    if (!email) return;
    apiClient('/api/profile', {
      headers: { 'email': email },
      cache: 'no-store'
    })
      .then(setProfile)
      .catch(err => {
        console.error('Profile refresh failed:', err);
        setProfile({ email: email, resume: null, parsedResume: null });
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

    // Guard: if the stored session has no email, the account is unusable.
    // Force re-login so all API calls have a valid email header.
    if (!parsedUser?.email) {
      console.warn('Stored user has no email — clearing session and redirecting to login.');
      localStorage.removeItem('user');
      router.push('/login');
      return;
    }

    setUser(parsedUser);

    // Fetch profile and history from backend
    if (parsedUser.email) {
      refreshProfile(parsedUser.email);
      fetchInterviewHistory(parsedUser.email);
    }

    checkBackendStatus();
    setLoading(false);
  }, [router, fetchInterviewHistory]);

  // ========== TAB SWITCH DETECTION ==========
  // tabCountRef: synchronous switch counter
  // terminatingRef: synchronous guard — set immediately on termination, blocks re-entry
  //   before React re-renders with the new interviewTerminated=true state.
  //   This stops the cascade: API error → overlay → window.blur → second termination.
  const tabCountRef = useRef(0);
  const terminatingRef = useRef(false);
  const switchHandlerRef = useRef<() => void>(() => {});
  const saveTerminatedRef = useRef<(reason?: string) => void>(() => {});

  // Update the switch handler whenever interview state changes
  useEffect(() => {
    switchHandlerRef.current = () => {
      // terminatingRef is the SYNCHRONOUS guard (not subject to stale closure)
      if (terminatingRef.current) return;
      if (!isInterviewActive || interviewStep !== 'interview' || interviewTerminated) return;

      // Increment ref synchronously
      tabCountRef.current += 1;
      const newCount = tabCountRef.current;
      
      console.warn(`[Integrity] Switch detected. New count: ${newCount}`);

      // Update UI state using functional update to ensure reliability in Chrome
      setTabSwitchCount(newCount);
      setShowTabWarning(true);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = setTimeout(() => setShowTabWarning(false), 4000);

      if (newCount >= 3) {
        // Lock immediately — synchronous, prevents blur-cascade re-entry
        terminatingRef.current = true;

        stopAnswerTimer();
        synth?.cancel(); // Stop any ongoing speech immediately

        setInterviewTerminated(true);
        setTerminationReason('Tab switching detected 3 times');
        setShowTabWarning(false);
        setInterviewStep('start'); // Go to clean start screen, not old summary
        setIsInterviewActive(false);
        submittingRef.current = false; // Reset for next session
        if (answerBoxRef.current) {
          answerBoxRef.current.value = 'INTERVIEW TERMINATED: Tab/app switching detected';
        }
        // Small delay ensures React state is flushed before saving
        setTimeout(() => {
          saveTerminatedRef.current('Tab switching detected 3 times');
        }, 50);
        setTimeout(() => alert('⚠️ Interview terminated — tab/app switching detected 3 times.'), 150);
      }
    };
  }, [isInterviewActive, interviewStep, interviewTerminated]);

  // Register event listeners ONCE — handler is always fresh via ref
  useEffect(() => {
    let lastTrigger = 0;
    let isAway = false;
    let blurTimeout: NodeJS.Timeout | null = null;

    const fireSwitch = (reason = 'Tab/app switch detected') => {
      const now = Date.now();
      // Only penalize if they just left (prevents rapid-fire stopwatch penalties)
      // Debounce: prevent visibilitychange and blur from double-counting the EXACT same event
      if (!isAway && (now - lastTrigger > 500)) {
        isAway = true;
        lastTrigger = now;
        switchHandlerRef.current();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (ignoreFocusLossRef.current) return;
        visibilityRef.current = false;
        // If we transitioned to hidden, fire switch immediately and clear blur timeout
        if (blurTimeout) {
          clearTimeout(blurTimeout);
          blurTimeout = null;
        }
        fireSwitch('Tab hidden');
      } else {
        isAway = false;
        visibilityRef.current = true;
      }
    };

    const handleBlur = () => {
      // If document is already hidden, visibilitychange already handled it
      if (!visibilityRef.current) return;

      if (blurTimeout) clearTimeout(blurTimeout);
      blurTimeout = setTimeout(() => {
        // Only fire if STILL blurred AND not hidden (if hidden, it was already counted)
        if (!document.hasFocus() && visibilityRef.current) {
          if (ignoreFocusLossRef.current) return;
          fireSwitch('Window lost focus');
        }
      }, 2000);
    };

    const handleFocus = () => {
      isAway = false;
      if (blurTimeout) {
        clearTimeout(blurTimeout);
        blurTimeout = null;
      }
    };

    // Split Screen Detection
    const handleResize = () => {
      if (!isInterviewActive) return;
      // If width is significantly reduced compared to screen width, it's likely split screen
      const screenWidth = window.screen.width;
      const currentWidth = window.innerWidth;
      
      if (currentWidth < screenWidth * 0.7) {
        fireSwitch('Split screen detected');
      }
    };

    // Focus Polling (Aggressive fallback for Chrome/Edge)
    const focusInterval = setInterval(() => {
      if (ignoreFocusLossRef.current) return;
      if (isInterviewActive && !document.hasFocus()) {
        console.warn('Integrity Check: Document has lost focus (Polling)');
        fireSwitch('Background usage or tab switch detected');
      }
    }, 1500); // More frequent polling

    const handleWindowBlur = () => {
      if (ignoreFocusLossRef.current) return;
      if (isInterviewActive) {
        console.warn('Integrity Check: Window blur event');
        fireSwitch('Tab switch or minimized detected');
      }
    };

    const handleWindowFocus = () => {
      isAway = false;
      console.log('Integrity Check: Window regained focus');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('resize', handleResize);
      clearInterval(focusInterval);
      if (blurTimeout) clearTimeout(blurTimeout);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [isInterviewActive]);

  // Reset sync counters when a new interview starts
  useEffect(() => {
    if (isInterviewActive) {
      tabCountRef.current = 0;
      terminatingRef.current = false;
    }
  }, [isInterviewActive]);

  // Effect to stop audio when switching tabs, interview steps, or sidebar state
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      console.log('Stopping audio due to screen/tab switch');
      window.speechSynthesis.cancel();
    }
  }, [currentTab, interviewStep]);


  const saveTerminatedInterview = (reason?: string) => {
    if (!user?.email) return;

    const actualReason = reason || terminationReason || 'Interview ended early';
    // Calculate actual partial score from questions answered so far (not 0)
    const historyToScore = interviewMode === 'dynamic' ? (allInterviewHistory.length > 0 ? allInterviewHistory : questionHistory) : results;
    const partialScore = interviewMode === 'dynamic'
      ? calculateDynamicOverallScore(historyToScore, tabCountRef.current)
      : calculateOverallScore(historyToScore);

    const interviewData = {
      date: new Date().toISOString(),
      type: interviewMode,
      skills: skills.map(s => s.skill),
      skillDetails: skills,
      results: historyToScore,
      skillSummaries: skillSummaries,
      overallScore: partialScore, // actual partial score, not 0
      terminated: true,
      terminationReason: actualReason,
      totalTabSwitches: tabCountRef.current
    };

    apiCall('/history', {
      method: 'POST',
      body: JSON.stringify({ interview: interviewData })
    })
      .then(() => fetchInterviewHistory(user.email))
      .catch(err => console.warn('Failed to save terminated interview:', err));

    const savedInterviews = JSON.parse(localStorage.getItem(`interviews_${user.email}`) || '[]');
    savedInterviews.push({ ...interviewData, id: Date.now() });
    localStorage.setItem(`interviews_${user.email}`, JSON.stringify(savedInterviews));
    setPreviousInterviews(savedInterviews);
  };

  // Keep saveTerminatedRef ALWAYS current — runs after every render so the ref
  // always has the latest closure (fresh user, skills, questionHistory, etc.).
  // This fixes the temporal dead zone: saveTerminatedRef starts as a no-op but
  // after the first render it immediately points to the real function.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { saveTerminatedRef.current = saveTerminatedInterview; });

  // ========== SPEAK FUNCTION ==========
  const speak = (text: string) => {
    if (!synth) return;
    
    // Synchronous immediate cancel
    synth.cancel();
    if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
    
    // Robustness: only speak if there is meaningful text
    if (!text || text.trim().length === 0) return;
    
    // Tiny delay to ensure browser speech engine has actually cleared the queue
    speakTimeoutRef.current = setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // Slightly faster for natural feel
      utterance.pitch = 1;
      utterance.volume = 1;
      
      // Handle end of speech
      utterance.onend = () => {
        console.log('Speech finished');
      };
      
      synth.speak(utterance);
    }, 50);
  };

  // ========== CAMERA FUNCTIONS ==========
  const startCamera = async () => {
    ignoreFocusLossRef.current = true;
    setTimeout(() => { ignoreFocusLossRef.current = false; }, 15000); // 15 seconds for user to click 'Allow' on the permission modal
    setCameraUsed(true);
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

  // Accumulated transcript ref — persists across recognition restarts
  const accumulatedTranscriptRef = useRef<string>("");

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

          // Seed with whatever's already in the answer box
          accumulatedTranscriptRef.current = answerBoxRef.current?.value || "";

          recognition.onresult = (e: any) => {
            // Build only the NEW fragment from this recognition session
            let finalChunk = "";
            let interimChunk = "";
            for (let i = e.resultIndex; i < e.results.length; ++i) {
              if (e.results[i].isFinal) {
                finalChunk += e.results[i][0].transcript;
              } else {
                interimChunk += e.results[i][0].transcript;
              }
            }

            // Lock in final results into the accumulated transcript
            if (finalChunk) {
              if (accumulatedTranscriptRef.current && !accumulatedTranscriptRef.current.endsWith(" ")) {
                accumulatedTranscriptRef.current += " ";
              }
              accumulatedTranscriptRef.current += finalChunk;
            }

            // Display accumulated + current interim
            if (answerBoxRef.current) {
              const display = interimChunk
                ? accumulatedTranscriptRef.current + " " + interimChunk
                : accumulatedTranscriptRef.current;
              answerBoxRef.current.value = display;
            }
          };

          // Auto-restart when Chrome kills the session (silence timeout, network blip)
          recognition.onend = () => {
            // Only restart if we're still recording
            if (recognitionRef.current === recognition && isRecording) {
              try {
                recognition.start();
              } catch (_e) {
                // already started or page unloading
              }
            }
          };

          recognition.onerror = (e: any) => {
            console.warn('Speech recognition error during recording:', e.error);
            // 'no-speech' and 'network' are recoverable — onend will auto-restart
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (err) {
          console.error("Speech recognition error:", err);
        }
      }

      let options = { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 2500000 };
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 2500000 };
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: 'video/webm', videoBitsPerSecond: 2500000 };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
              options = { mimeType: '', videoBitsPerSecond: 2500000 };
            }
          }
        }
      }
      const mediaRecorder = new MediaRecorder(cameraStream, options);

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

    // Null the ref BEFORE stopping — prevents the onend auto-restart from firing
    const recog = recognitionRef.current;
    recognitionRef.current = null;
    if (recog) {
      try {
        recog.stop();
      } catch (e) {
        console.error("Error stopping recognition", e);
      }
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
      const data = await apiClient('/health', {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      let statusMsg = '✓ Backend is online';
      if (data.status === 'healthy') {
        statusMsg += ' (Database Connected)';
      } else {
        statusMsg += ' (⚠️ Database Disconnected)';
        if (data.environment === 'cloud' || process.env.NODE_ENV === 'production') {
          alert("CRITICAL WARNING: The database is not connected. Your data and resumes will be LOST when you refresh or log out. Please check your AWS setup.");
        }
      }

      setBackendStatus(statusMsg);
    } catch (err) {
      setBackendStatus('✗ Backend unreachable');
    }
  };

  const skipToInterview = () => {
    const debugSkills = [
      { skill: "Python", experience_level: "intermediate" },
      { skill: "JavaScript", experience_level: "intermediate" }
    ];
    setSkills(debugSkills);
    setInterviewStep('skills');
    setInterviewMode('dynamic');
    console.log("DEBUG: Skipped to skills selection with dummy skills.");
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
    // Stop active timers and recording FIRST to prevent them from firing again
    stopAnswerTimer();
    stopVideoRecording();
    stopCamera();
    synth?.cancel(); // Stop any ongoing speech

    setShowQuitConfirm(false);
    setFeedbackText("");
    setDetailedFeedback(null);
    setInputMethod('TEXT');
    // 'start' = the clean interview start screen, NOT 'summary' which shows the old session
    setInterviewStep('start');
    setIsInterviewActive(false);
    setInterviewTerminated(false);
    setTabSwitchCount(0);
    setShowTabWarning(false);
    submittingRef.current = false; // Reset for next session

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

    try {
      // Convert file to base64
      const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
      };

      const base64Str = await fileToBase64(cv);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const data = await apiCall('/upload-and-analyze-base64', {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: cv.name,
          file_data: base64Str,
          email: user?.email
        }),
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
    if (isGeneratingNext) return;
    setIsGeneratingNext(true);
    setInterviewStep('interview');
    setIsInterviewActive(true);
    setTabSwitchCount(0);
    setInterviewTerminated(false);
    setQuestionHistory([]);
    setSkillSummaries([]);
    setConversationFlow([]);
    setCurrentAnalysis(null);
    setDetailedFeedback(null);
    submittingRef.current = false; // Reset submission guard for new session

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
        setCameraUsed(false);

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
        setIsGeneratingNext(false);
      } else {
        // Fallback to standard
        setIsGeneratingNext(false);
        startStandardInterview();
      }
    } catch (error) {
      console.error('Failed to start dynamic interview:', error);
      setIsGeneratingNext(false);
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
    if (isGeneratingNext) return;
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
          if (timerRef.current) clearInterval(timerRef.current);
          setTimerActive(false);

          if (answerBoxRef.current && answerBoxRef.current.value.trim() === '') {
            answerBoxRef.current.value = "[NO ANSWER PROVIDED - TIME EXPIRED]";
          }

          // Call outside setState callback (setState callbacks must be pure).
          // .catch() prevents the floating promise from showing as an error overlay.
          setTimeout(() => {
            submitAnswer().catch(err => console.warn('Auto-submit error:', err));
          }, 0);

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
    ignoreFocusLossRef.current = true;
    setTimeout(() => { ignoreFocusLossRef.current = false; }, 15000);
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

  // Guard against double-submission (timer StrictMode double-invoke, rapid clicks)
  const submittingRef = useRef(false);

  const submitDynamicAnswer = async () => {
    if (submittingRef.current || isGeneratingNext) return; // Block if already submitting OR generating next Q
    
    // Unlock SpeechSynthesis immediately on user click to bypass browser blocks
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        const unlockUtterance = new SpeechSynthesisUtterance('');
        unlockUtterance.volume = 0;
        window.speechSynthesis.speak(unlockUtterance);
    }

    submittingRef.current = true;
    stopAnswerTimer();
    stopVideoRecording();

    let answer = answerBoxRef.current?.value || '';
    if (!answer.trim() && (inputMethod === 'VIDEO' || inputMethod === 'VOICE')) {
      answer = "[Response recorded via " + inputMethod.toLowerCase() + "]";
    }

    if (!answer.trim() && !interviewTerminated) {
      alert('Please answer the question');
      submittingRef.current = false;
      startAnswerTimer();
      return;
    }

    const skill = skills[currentIndex]?.skill || '';
    
    console.log('[API Debug] submitDynamicAnswer payload check:', {
      question: currentQuestion,
      answer: answer.substring(0, 20) + '...',
      skill: skill
    });

    if (!currentQuestion || !skill) {
      console.error('[API Error] Missing question or skill state!', { currentQuestion, skill });
      alert('Session state issue: Missing question or skill. Please try refreshing.');
      submittingRef.current = false;
      setIsGeneratingNext(false);
      return;
    }

    setIsGeneratingNext(true);

    try {
      // Consolidated Evaluation + Decision + Question in ONE call
      const response = await apiCall('/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          answer: answer,
          skill: skill,
          history: questionHistory,
          input_type: inputMethod,
          video_frames: videoFrames,
          skills_remaining: skills.slice(currentIndex + 1).map(s => s.skill),
          level: currentLevel
        })
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to submit answer');
      }

      const { evaluation, decision, should_transition } = response;

      // Store evaluation and the NEXT decision (SSOT)
      setDetailedFeedback(evaluation);
      setPendingTurn({ evaluation, decision, should_transition });

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

      // Show feedback step
      setInterviewStep('feedback');

      // Speak interviewer's initial evaluation feedback
      let speechText = decision?.feedback_to_user || '';
      
      const weaknesses = evaluation?.weaknesses || evaluation?.gaps_identified?.knowledge_gaps || [];
      const improvements = evaluation?.improvement_tips || [];
      const strengths = evaluation?.strengths || evaluation?.technical_accuracy?.correct_concepts || [];
      
      // If it's a move_next or an end of skill, make sure the AI actually reads out some feedback!
      if (improvements.length > 0) {
        speechText += " " + improvements[0]; // Read one improvement tip
      } else if (weaknesses.length > 0) {
        speechText += " A quick tip: " + weaknesses[0];
      } else if (strengths.length > 0) {
        speechText += " Really good job mentioning " + strengths[0] + ".";
      }

      if (speechText.trim()) {
        speak(speechText.trim());
      } else if (evaluation?.summary_feedback) {
        speak(evaluation.summary_feedback);
      }

    } catch (error: any) {
      console.error('Error in dynamic flow:', error);
      alert('Error submitting answer: ' + (error.message || error));
      setIsGeneratingNext(false);
      setInterviewStep('interview');
    } finally {
      setIsGeneratingNext(false);
      submittingRef.current = false;
    }
  };

  const formatDetailedFeedback = (evaluation: any) => {
    if (!evaluation) return 'No feedback available';

    const evalData = evaluation.evaluation || evaluation;

    // Support both new level-based schema and old scores-based schema
    const quality = evalData.quality || evalData.capability || 'N/A';
    const understanding = evalData.understanding || 'N/A';
    const confidence = evalData.confidence || 'N/A';
    
    // Scores fallback
    const scores = evalData.scores || {};
    const overallScore = scores.overall_score !== undefined ? `${scores.overall_score}/10` : (quality === 'high' ? '9/10' : quality === 'medium' ? '6/10' : '3/10');

    let feedback = `PROFESSIONAL ASSESSMENT\n`;

    feedback += `\n📊 SESSION METRICS\n`;
    feedback += `   Quality: ${quality.toUpperCase()} | Understanding: ${understanding.toUpperCase()} | Confidence: ${confidence.toUpperCase()}\n`;
    feedback += `   Approximate Proficiency: ${overallScore}\n`;

    // What was wrong / gaps
    feedback += `\n❌ IDENTIFIED GAPS\n`;
    const weaknesses = evalData.weaknesses || evalData.gaps_identified?.knowledge_gaps || [];
    if (weaknesses.length > 0) {
      weaknesses.forEach((w: string) => {
        feedback += `   • ${w}\n`;
      });
    } else {
      feedback += `   • No immediate gaps identified at this level.\n`;
    }

    // Communication analysis
    feedback += `\n🗣️ COMMUNICATION & BEHAVIORAL\n`;
    const fillers = evalData.filler_words || [];
    const hesitations = evalData.hesitation_markers || [];
    
    if (fillers.length > 0) feedback += `   • Fillers detected: ${fillers.join(', ')}\n`;
    if (hesitations.length > 0) feedback += `   • Hesitation: ${hesitations.join(', ')}\n`;
    
    if (fillers.length === 0 && hesitations.length === 0) {
      feedback += `   • Communication was clear and professional.\n`;
    }

    // Strengths
    feedback += `\n💪 KEY STRENGTHS\n`;
    const strengths = evalData.strengths || evalData.technical_accuracy?.correct_concepts || [];
    if (strengths.length > 0) {
      strengths.forEach((s: string) => {
        feedback += `   ✓ ${s}\n`;
      });
    }

    // Ideal answer
    if (evalData.ideal_answer) {
      feedback += `\n💡 EXPERT GUIDANCE\n`;
      feedback += `   ${evalData.ideal_answer}\n`;
    }

    // Summary
    feedback += `\n💬 SUMMARY\n   ${evalData.summary_feedback || 'Good effort!'}\n`;

    return feedback;
  };

  const nextQuestion = async () => {
    if (isGeneratingNext) return;
    
    // Safety: ensure we always have a clean state for the next question
    setIsGeneratingNext(true);
    
    if (interviewMode === 'dynamic') {
      await generateNextDynamicQuestion();
    } else {
      nextSkill();
    }
  };

  const generateNextDynamicQuestion = async () => {
    if (isGeneratingNext) return;
    
    // CONSUME PENDING TURN (SSOT)
    if (!pendingTurn) {
      console.warn('No pending turn data found. This suggests a desync or double-click failure.');
      setInterviewStep('interview');
      return;
    }

    submittingRef.current = false;
    stopAnswerTimer();
    setIsGeneratingNext(true);

    try {
      const { decision, should_transition: nextDataShouldTransition } = pendingTurn;

      // Check if we should transition to next skill (logic move from backend)
      if (nextDataShouldTransition?.transition) {
        // Generate summary for current skill
        const skillSummary = await generateSkillSummary(skills[currentIndex]?.skill);
        const updatedSummaries = [...skillSummaries];
        if (skillSummary) {
          const idx = updatedSummaries.findIndex(s => s.skill === skillSummary.skill);
          if (idx !== -1) updatedSummaries[idx] = skillSummary;
          else updatedSummaries.push(skillSummary);
        }

        if (nextDataShouldTransition?.complete || currentIndex + 1 >= skills.length) {
          await generateFinalReport(updatedSummaries);
          setInterviewStep('summary');
          setIsInterviewActive(false);
          setIsGeneratingNext(false);
          return;
        } else {
          // Move to next skill
          const nextIndex = currentIndex + 1;
          setCurrentIndex(nextIndex);
          setCurrentLevel(1); // Reset level for new skill

          const nextSkill = skills[nextIndex];
          // Since we are transitioning to a NEW skill, ignore previous skill's conversational filler
          const questionText = `Let's move on to ${nextSkill.skill}. Can you tell me about your experience with it?`;
          const interviewerResponse = questionText;

          setCurrentQuestion(questionText);
          setQuestionHistory([]);
          setDetailedFeedback(null);
          setInputMethod('TEXT');
          setVideoFrames([]);

          const title = document.getElementById("interview-skillTitle") as HTMLElement;
          if (title) title.innerText = `Skill ${nextIndex + 1}/${skills.length}: ${nextSkill.skill}`;

          setInterviewStep('interview');
          speak(interviewerResponse);
        }
      } else {
        // Continue with next question for same skill (retry, hint, or probe/level_up)
        const questionText = decision.next_question || decision.question || "I have no further questions for this topic. Let's proceed.";
        
        // Update level if provided
        if (decision.level) {
          setCurrentLevel(decision.level);
        }

        setCurrentQuestion(questionText);
        setDetailedFeedback(null);
        setInputMethod('TEXT');
        setVideoFrames([]);

        setInterviewStep('interview');
        speak(questionText);
      }

      // Clear answer box
      if (answerBoxRef.current) {
        answerBoxRef.current.value = '';
      }

      // Start fresh timer for new question
      startAnswerTimer();
      
      // Successfully consumed
      setPendingTurn(null);
      setIsGeneratingNext(false); // Ensure we unlock UI

    } catch (error) {
      console.error('Error processing next turn:', error);
      setInterviewStep('interview');
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
          all_qa: allInterviewHistory, // FIX: Use full session history
          all_evaluations: allInterviewHistory.map(h => h.evaluation),
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
    const overallScore = calculateDynamicOverallScore(allInterviewHistory.length > 0 ? allInterviewHistory : questionHistory);

    const interviewData = {
      date: new Date().toISOString(),
      type: 'dynamic',
      skills: skills.map(s => s.skill),
      skillDetails: skills,
      results: allInterviewHistory,
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
      results: interviewMode === 'dynamic' ? allInterviewHistory : results,
      skillSummaries: skillSummaries,
      overallScore: interviewMode === 'dynamic' ? calculateDynamicOverallScore(allInterviewHistory) : calculateOverallScore(results),
      partial: true,
      terminated: false,
      totalTabSwitches: tabSwitchCount
    };

    // Save to backend + refresh history from server (avoids localStorage duplication)
    apiCall('/history', {
      method: 'POST',
      body: JSON.stringify({ interview: interviewData })
    })
      .then(() => fetchInterviewHistory(user.email))
      .catch(err => console.warn('Failed to save partial results:', err));
  };

  function calculateDynamicOverallScore(history: any[], switches?: number) {
    if (!history || history.length === 0) return 0;

    // Use provided switches or fallback to current state
    const totalSwitches = switches !== undefined ? switches : tabSwitchCount;

    const scores = history
      .map(h => {
        const evalData = h.evaluation?.evaluation || h.evaluation;
        // Deep search for overall_score
        const s = evalData?.scores?.overall_score ?? evalData?.overall_score ?? evalData?.scores?.match_percentage ?? evalData?.match_percentage;
        return typeof s === 'number' ? s : (typeof s === 'string' ? parseFloat(s) : null);
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

    let answer = answerBoxRef.current?.value || '';
    if (!answer.trim() && (inputMethod === 'VIDEO' || inputMethod === 'VOICE')) {
      answer = "[Response recorded via " + inputMethod.toLowerCase() + "]";
    }

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
    setCurrentTab('interview');
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
      {showQuitConfirm && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(15, 23, 42, 0.8)', 
          backdropFilter: 'blur(8px)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 10000,
          padding: '24px'
        }}>
          <div className="card animate-slideUp" style={{ maxWidth: '450px', width: '100%', padding: '40px', textAlign: 'center', background: 'white' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--danger-50)', color: 'var(--danger-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '32px' }}>
              ⚠️
            </div>
            <h3 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--gray-900)', marginBottom: '16px' }}>Quit Interview?</h3>
            <p style={{ color: 'var(--gray-600)', marginBottom: '32px', fontSize: '16px', lineHeight: '1.6' }}>
              Are you sure you want to end this session? Your current progress will be saved as a partial result.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={cancelQuit}>Continue</button>
              <button className="btn btn-primary" style={{ flex: 1, background: 'var(--danger-600)' }} onClick={confirmQuit}>Quit Session</button>
            </div>
          </div>
        </div>
      )}
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
        {isInterviewActive && (interviewStep === 'interview' || interviewStep === 'feedback') && (
          <div style={{ position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', gap: '10px' }}>
            <div className="badge badge-primary" style={{ padding: '8px 16px', background: 'var(--gray-900)', border: '1px solid var(--gray-700)' }}>
              Level {currentLevel}: {
                currentLevel === 1 ? 'Basic' :
                currentLevel === 2 ? 'Conceptual' :
                currentLevel === 3 ? 'Practical' : 'Advanced'
              }
            </div>
            {tabSwitchCount > 0 && (
              <div className="badge badge-danger" style={{ padding: '8px 16px', background: 'rgba(220, 38, 38, 0.9)' }}>
                Integrity Warnings: {tabSwitchCount}/3
              </div>
            )}
          </div>
        )}

        {/* HEADER - hidden during active interview for immersive mode */}
        {!(isInterviewActive && (interviewStep === 'interview' || interviewStep === 'feedback')) && (
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
                  if (!isInterviewActive) setInterviewStep('start');
                }}
                className={`nav-tab ${currentTab === 'interview' ? 'active' : ''}`}
              >
                Interview
              </button>
              <div style={{ width: '1px', height: '24px', background: 'var(--gray-200)', margin: '0 8px' }} />
              <button onClick={logout} className="btn btn-secondary btn-sm" style={{ padding: '8px 16px', background: 'white', border: '1px solid var(--gray-200)' }}>
                Sign Out
              </button>
            </div>
          </header>
        )}

        {/* QUIT CONFIRM MODAL - always rendered so it shows during active interview */}
        {showQuitConfirm && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '24px' }}>
            <div className="card animate-slideUp" style={{ maxWidth: '450px', width: '100%', padding: '40px', textAlign: 'center', background: 'white' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--danger-50)', color: 'var(--danger-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>⚠️</div>
              <h3 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--gray-900)', marginBottom: '12px' }}>Quit Interview?</h3>
              <p style={{ color: 'var(--gray-600)', marginBottom: '28px', fontSize: '15px', lineHeight: '1.6' }}>Your current progress will be saved as a partial result.</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={cancelQuit}>Continue</button>
                <button className="btn btn-primary" style={{ flex: 1, background: 'var(--danger-600)' }} onClick={confirmQuit}>Quit Session</button>
              </div>
            </div>
          </div>
        )}

        {/* BACKEND STATUS INDICATOR */}
        {currentTab === 'interview' && !isInterviewActive && (
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
                      {(() => {
                        const sorted = [...previousInterviews].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                        const lastFew = sorted.slice(-3);
                        let trend: 'Rising' | 'Falling' | 'Stable' = 'Stable';
                        let color = 'badge-success';
                        
                        if (lastFew.length >= 2) {
                          const firstVal = lastFew[0].overallScore || 0;
                          const lastVal = lastFew[lastFew.length - 1].overallScore || 0;
                          if (lastVal > firstVal + 5) { trend = 'Rising'; color = 'badge-success'; }
                          else if (lastVal < firstVal - 5) { trend = 'Falling'; color = 'badge-danger'; }
                          else { trend = 'Stable'; color = 'badge-primary'; }
                        }
                        return <span className={`badge ${color}`}>Trend: {trend}</span>;
                      })()}
                    </div>

                    <div style={{ height: '200px', width: '100%', position: 'relative', overflow: 'visible', padding: '10px 0' }}>
                      <svg viewBox="0 0 1000 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        {/* Grid lines */}
                        {[0, 50, 100, 150, 200].map(y => (
                          <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="var(--gray-100)" strokeWidth="1" />
                        ))}

                        {/* The Path */}
                        <path
                          d={`M ${[...previousInterviews].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-10).map((i, idx, arr) => {
                            const x = idx === 0 && arr.length === 1 ? 500 : (idx / (Math.min(arr.length, 10) - 1 || 1)) * 1000;
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

                        {/* Points — red + dashed for terminated, purple for normal */}
                        {[...previousInterviews].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-10).map((i, idx, arr) => {
                          const x = idx === 0 && arr.length === 1 ? 500 : (idx / (Math.min(arr.length, 10) - 1 || 1)) * 1000;
                          const y = 200 - ((i.overallScore || 0) * 2);
                          const isTerminated = !!i.terminated;
                          return (
                            <g key={idx}>
                              <circle
                                cx={x} cy={y} r="7"
                                fill="white"
                                stroke={isTerminated ? '#ef4444' : 'var(--primary-600)'}
                                strokeWidth="3"
                                strokeDasharray={isTerminated ? '4 3' : 'none'}
                              />
                              {isTerminated && (
                                // X mark inside red circle for terminated
                                <>
                                  <line x1={x-3.5} y1={y-3.5} x2={x+3.5} y2={y+3.5} stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                                  <line x1={x+3.5} y1={y-3.5} x2={x-3.5} y2={y+3.5} stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                                </>
                              )}
                              <text x={x} y={y - 16} textAnchor="middle" fontSize="10" fontWeight="800" fill={isTerminated ? '#ef4444' : 'var(--gray-500)'}>
                                {i.overallScore || 0}%{isTerminated ? '⚡' : ''}
                              </text>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '10px', fontSize: '11px', color: 'var(--gray-400)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="white" stroke="var(--primary-600)" strokeWidth="2"/></svg>
                          Completed
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="white" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 2"/><line x1="3" y1="3" x2="9" y2="9" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="3" x2="3" y2="9" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          Terminated ⚡
                        </span>
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
                    {(profile?.parsedResume && (Array.isArray(profile.parsedResume) ? profile.parsedResume.length > 0 : (profile.parsedResume.skills?.length > 0))) && (
                      <button
                        className="btn btn-secondary btn-lg"
                        onClick={() => {
                          const pr = profile.parsedResume;
                          const sList = Array.isArray(pr) ? pr : (pr.skillDetails || pr.skills || []);
                          const sData = sList.map((s: any) => ({
                            skill: typeof s === 'string' ? s : (s.skill || s.name || 'Unknown'),
                            experience_level: (typeof s === 'object' && s.experience_level) ? s.experience_level : 'intermediate'
                          }));
                          setSkills(sData);
                          setInterviewStep('skills');
                        }}
                        style={{ border: '2px solid var(--primary-200)', color: 'var(--primary-700)', background: 'rgba(99, 102, 241, 0.05)' }}
                      >
                        ⚡ Use My Previous CV
                      </button>
                    )}
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
                  <div className="section-title" style={{ marginBottom: '20px' }}>
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
                                    {interview.jobTitle || 'General Interview'}
                                  </span>
                                  <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                                    📅 {displayDate} at {displayTime}
                                  </span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginTop: '8px' }}>
                                  {interview.skills?.join(', ') || 'General Proficiency'}
                                </p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '28px', fontWeight: '900', color: interview.terminated ? '#ef4444' : 'var(--primary-600)', lineHeight: '1' }}>
                                  {interview.overallScore || 0}%
                                </div>
                                {interview.terminated ? (
                                  <div style={{ fontSize: '10px', color: '#ef4444', textTransform: 'uppercase', fontWeight: '800', marginTop: '4px', letterSpacing: '0.05em' }}>⚡ Terminated</div>
                                ) : (
                                  <div style={{ fontSize: '11px', color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: '800', marginTop: '4px', letterSpacing: '0.05em' }}>Success Rate</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '40px', background: 'white' }}>
                      <p style={{ color: 'var(--gray-400)' }}>No past interviews found. Start your first session!</p>
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
                    onClick={() => setInterviewStep('summary')}
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
                
                {/* DEBUG ONLY: Hidden skip button for automated testing */}
                <button 
                  id="debug-skip-upload"
                  onClick={skipToInterview}
                  style={{ 
                    marginTop: '20px', 
                    fontSize: '10px', 
                    opacity: 0.3, 
                    border: '1px dashed var(--gray-300)', 
                    background: 'none', 
                    color: 'var(--gray-400)',
                    cursor: 'pointer'
                  }}
                >
                  DEBUG: Skip Upload (e2e test)
                </button>
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
                    <div className="badge badge-primary" style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--primary-300)', padding: '6px 14px', borderRadius: '10px' }}>
                      Skill: {skills[currentIndex]?.skill} ({currentIndex + 1}/{skills.length})
                    </div>
                    <span style={{ fontSize: '14px', color: 'var(--gray-400)' }}>•</span>
                    <div className="badge badge-secondary" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' }}>
                      Question #{questionHistory.length + 1}
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
                    <div style={{ width: '1px', height: '20px', background: 'var(--gray-700)' }} />
                    <button 
                      onClick={quitInterview}
                      style={{ 
                        background: 'rgba(239, 68, 68, 0.15)', 
                        color: '#f87171', 
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        height: 'fit-content',
                        alignSelf: 'center'
                      }}
                    >
                      Quit Session
                    </button>
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
                      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
                        <div style={{ position: 'relative', width: '180px', height: '120px', borderRadius: '10px', overflow: 'hidden', border: '2px solid var(--gray-200)', background: '#000', flexShrink: 0 }}>
                          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          {isRecording && (
                            <div style={{ position: 'absolute', top: '6px', left: '6px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(0,0,0,0.65)', padding: '3px 8px', borderRadius: '6px' }}>
                              <div className="recording-indicator" />
                              <span style={{ color: 'white', fontSize: '10px', fontWeight: '700' }}>REC</span>
                            </div>
                          )}
                        </div>
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
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" onClick={stopCamera} disabled={interviewTerminated || isGeneratingNext} style={{ background: 'white' }}>
                          🚫 Hide
                        </button>
                        {!isRecording ? (
                          <button className="btn btn-primary" onClick={startVideoRecording} disabled={interviewTerminated || isGeneratingNext} style={{ background: 'var(--danger-600)', borderColor: 'var(--danger-600)' }}>
                            ⏺ Record Answer
                          </button>
                        ) : (
                          <button className="btn btn-primary" onClick={stopVideoRecording} style={{ background: 'var(--gray-900)' }}>
                            ⏹ Stop Recording
                          </button>
                        )}
                      </div>
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
              <div className="card-elevated animate-slideUp" style={{ padding: '0', overflow: 'hidden', border: 'none', background: 'var(--gray-900)' }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%)', 
                  padding: '40px 32px', 
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                         Deep Assessment
                      </span>
                    </div>
                    <h3 style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '-0.5px' }}>{skills[currentIndex]?.skill} Proficiency</h3>
                  </div>
                  <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '300px', height: '300px', background: 'var(--primary-400)', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.3 }} />
                </div>

                <div style={{ padding: '32px', background: 'white' }}>
                  <div style={{
                    maxHeight: '520px',
                    overflowY: 'auto',
                    marginBottom: '32px',
                    paddingRight: '12px'
                  }}>
                    {detailedFeedback ? (
                      <div className="animate-fadeIn">
                        {/* PERFORMANCE SCORE GRID */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '32px' }}>
                          {(detailedFeedback.scores || detailedFeedback.evaluation?.scores) && (() => {
                            const s = detailedFeedback.scores || detailedFeedback.evaluation?.scores;
                            return [
                              { label: 'Technical', val: s.technical || s.technical_score, color: 'var(--primary-600)', icon: '💻' },
                              { label: 'Confidence', val: s.confidence || s.confidence_score, color: 'var(--success-600)', icon: '⚡' },
                              { label: 'Communication', val: s.communication || s.communication_score, color: 'var(--info-600)', icon: '🗣️' },
                              { label: 'Behavioral', val: s.behavioral || s.behavioral_score, color: 'var(--warning-600)', icon: '🤝', hide: !cameraUsed },
                              { label: 'Match Rate', val: s.overall_score, color: 'var(--primary-700)', icon: '🎯', highlight: true }
                            ].filter(m => !m.hide && m.val !== undefined).map((m, i) => (
                              <div key={i} className="glass-card" style={{ 
                                background: m.highlight ? 'var(--primary-50)' : 'var(--gray-50)', 
                                padding: '16px', 
                                borderRadius: '16px', 
                                border: m.highlight ? '2px solid var(--primary-200)' : '1px solid var(--gray-100)', 
                                textAlign: 'center'
                              }}>
                                <div style={{ fontSize: '18px', marginBottom: '4px' }}>{m.icon}</div>
                                <div style={{ fontSize: '9px', fontWeight: '800', color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: '4px' }}>{m.label}</div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: m.color }}>{m.val}<span style={{ fontSize: '12px', opacity: 0.5 }}>/10</span></div>
                              </div>
                            ));
                          })()}
                        </div>

                        {/* SPLIT PANEL: ACCURACY & SUMMARY */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '32px' }}>
                          {/* ACCURACY REPORT */}
                          <div style={{ background: 'var(--gray-50)', borderRadius: '20px', padding: '24px', border: '1px solid var(--gray-100)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                               <div style={{ width: '4px', height: '16px', background: 'var(--primary-600)', borderRadius: '2px' }} />
                               <h4 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--gray-600)', textTransform: 'uppercase' }}>Technical Accuracy</h4>
                            </div>
                            
                            {(detailedFeedback.technical_accuracy || detailedFeedback.evaluation?.technical_accuracy) && (() => {
                              const ta = detailedFeedback.technical_accuracy || detailedFeedback.evaluation?.technical_accuracy;
                              const hasConcepts = (ta.correct?.length > 0) || (ta.missed?.length > 0) || (ta.incorrect?.length > 0);
                              
                              if (!hasConcepts) return (
                                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-400)', fontSize: '13px', background: 'white', borderRadius: '12px', fontStyle: 'italic' }}>
                                  {detailedFeedback.evaluation?.quality === 'high' || detailedFeedback.scores?.technical > 7 
                                    ? "Advanced technical concepts demonstrated throughout the project discussion." 
                                    : "No specific technical concepts identified in this short response."}
                                </div>
                              );

                              return (
                                <div style={{ display: 'grid', gap: '16px' }}>
                                  {ta.correct?.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: '10px', color: 'var(--success-700)', fontWeight: '800', marginBottom: '6px' }}>✓ CORRECT CONCEPTS</div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {ta.correct.map((c: string, idx: number) => (
                                          <span key={idx} style={{ background: 'var(--success-100)', color: 'var(--success-700)', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '600' }}>{c}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {ta.missed?.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: '11px', color: 'var(--warning-700)', fontWeight: '800', marginBottom: '6px' }}>◌ MISSING POINTS</div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {ta.missed.map((c: string, idx: number) => (
                                          <span key={idx} style={{ background: 'var(--warning-100)', color: 'var(--warning-700)', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '600' }}>{c}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* INTERVIEWER NOTE */}
                          <div style={{ background: 'var(--primary-900)', borderRadius: '20px', padding: '24px', color: 'white', display: 'flex', flexDirection: 'column' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                               <div style={{ width: '4px', height: '16px', background: 'var(--primary-400)', borderRadius: '2px' }} />
                               <h4 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--gray-400)', textTransform: 'uppercase' }}>Interviewer Summary</h4>
                             </div>
                             <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--gray-100)', flex: 1, whiteSpace: 'pre-wrap' }}>
                               {detailedFeedback.summary_feedback || detailedFeedback.reasoning || feedbackText}
                             </div>
                             <div style={{ marginTop: '16px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <div style={{ fontSize: '9px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Response Quality</div>
                                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--success-400)' }}>{(detailedFeedback.quality || 'Medium').toUpperCase()} LEVEL</div>
                             </div>
                          </div>
                        </div>

                        {/* GROWTH PATH */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                           <div style={{ background: 'white', borderRadius: '20px', border: '1px solid var(--gray-200)', padding: '24px' }}>
                              <h4 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--primary-600)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                 <span style={{ fontSize: '18px' }}>🚀</span> Key Strengths
                              </h4>
                               <ul style={{ padding: '0', listStyle: 'none', margin: '0' }}>
                                {(detailedFeedback.strengths || []).map((s: string, idx: number) => (
                                  <li key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '10px', fontSize: '13px', color: 'var(--gray-700)' }}>
                                    <span style={{ color: 'var(--success-600)', fontWeight: '800' }}>✓</span> {s}
                                  </li>
                                ))}
                              </ul>
                           </div>
                           <div style={{ background: 'white', borderRadius: '20px', border: '1px solid var(--gray-200)', padding: '24px' }}>
                              <h4 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--danger-600)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                 <span style={{ fontSize: '18px' }}>📈</span> Areas for Growth
                              </h4>
                              <ul style={{ padding: '0', listStyle: 'none', margin: '0' }}>
                                {(detailedFeedback.weaknesses || detailedFeedback.improvement_tips || []).map((s: string, idx: number) => (
                                  <li key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '10px', fontSize: '13px', color: 'var(--gray-700)' }}>
                                    <span style={{ color: 'var(--danger-600)', fontWeight: '800' }}>→</span> {s}
                                  </li>
                                ))}
                              </ul>
                           </div>
                        </div>

                        {detailedFeedback.ideal_answer && (
                           <div style={{ marginTop: '24px', padding: '16px', background: 'var(--primary-50)', borderRadius: '16px', border: '1px solid var(--primary-100)' }}>
                              <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--primary-600)', textTransform: 'uppercase', marginBottom: '4px' }}>Ideal Direction</div>
                              <div style={{ fontSize: '13px', color: 'var(--primary-800)', fontStyle: 'italic', lineHeight: '1.6' }}>{detailedFeedback.ideal_answer}</div>
                           </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '80px' }}>
                        <div className="generating-indicator" style={{ width: '40px', height: '40px', margin: '0 auto 20px' }}></div>
                        <p style={{ color: 'var(--gray-500)', fontWeight: '600' }}>Analyzing technical depth...</p>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setInterviewStep('interview')}
                      style={{ padding: '14px 40px', borderRadius: '14px', background: 'var(--gray-100)', color: 'var(--gray-600)', fontWeight: '600' }}
                    >
                      ← Review
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => nextQuestion()}
                      disabled={isGeneratingNext}
                      style={{ 
                        padding: '14px 60px', 
                        borderRadius: '14px', 
                        background: 'linear-gradient(to right, var(--primary-600), var(--primary-800))',
                        boxShadow: '0 8px 24px rgba(var(--primary-rgb), 0.25)',
                        fontSize: '16px',
                        fontWeight: '700'
                      }}
                    >
                      {isGeneratingNext ? 'Loading...' : 'Next Question →'}
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
                        const dataToUse = allInterviewHistory.length > 0 ? allInterviewHistory : (questionHistory.length > 0 ? questionHistory : results);
                        const skillHistory = dataToUse.filter((q: any) => q.skill === skillName);
                        // Accommodate legacy dynamic interviews that cleared history but saved summaries
                        const isAttempted = skillHistory.length > 0 || !!summaryObj;
                        const lastEval = skillHistory[skillHistory.length - 1]?.evaluation?.evaluation || skillHistory[skillHistory.length - 1]?.evaluation;
                        
                        return (
                          <div key={idx} className="glass-card" style={{ padding: '24px', border: '1px solid var(--gray-100)', background: 'white', opacity: isAttempted ? 1 : 0.7 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <h4 style={{ fontWeight: '800', fontSize: '18px', color: isAttempted ? 'var(--gray-900)' : 'var(--gray-500)' }}>{skillName}</h4>
                              {isAttempted ? (
                                (lastEval?.scores?.overall_score !== undefined && lastEval?.scores?.overall_score !== null) ? (
                                  <div className="badge badge-primary">{lastEval.scores.overall_score * 10}%</div>
                                ) : (
                                  <div className="badge" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Completed</div>
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


                                {/* RAG Weakness Logger */}
                                {(() => {
                                  let rawWeaknesses: string[] = [];
                                  for (let i = 0; i < skillHistory.length; i++) {
                                    const q = skillHistory[i];
                                    const tech = q.evaluation?.evaluation?.technical_accuracy || q.evaluation?.technical_accuracy || {};
                                    if (tech.missed) rawWeaknesses.push(...tech.missed);
                                    if (tech.incorrect) rawWeaknesses.push(...tech.incorrect);
                                  }
                                  const ragWeaknesses = rawWeaknesses.filter((item, index, arr) => {
                                    return arr.indexOf(item) === index && item && item.trim().length > 0 && !item.includes("(System: LLM skipped");
                                  });

                                  if (ragWeaknesses.length > 0) {
                                    return (
                                      <div style={{ marginTop: '16px', padding: '16px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fde68a' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ fontSize: '14px' }}>🧠</span> Active Memory (RAG Tracker)
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '10px', lineHeight: '1.5' }}>
                                          The AI has logged the following technical gaps. <strong>Expect your next dynamic interview to forcefully test you on these specific topics:</strong>
                                        </div>
                                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#92400e', fontSize: '13px' }}>
                                          {ragWeaknesses.slice(0, 8).map((w, i) => (
                                            <li key={i} style={{ marginBottom: '6px', fontWeight: '500' }}>{w}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
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
                      {(() => {
                        // Three-tier fallback for session Q&A data
                        const transcriptData = allInterviewHistory.length > 0
                          ? allInterviewHistory
                          : questionHistory.length > 0
                            ? questionHistory
                            : results.length > 0
                              ? results  // standard interviews use results array
                              : [];

                        if (transcriptData.length === 0) {
                          return (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📝</div>
                              <p style={{ color: 'var(--gray-600)', fontWeight: '600', marginBottom: '8px' }}>No transcript available for this session</p>
                              <p style={{ color: 'var(--gray-400)', fontSize: '13px' }}>
                                This interview was recorded before transcript logging was introduced,
                                or the session ended before any answers were submitted.
                              </p>
                            </div>
                          );
                        }

                        return transcriptData.map((qa: any, idx: number) => {
                          const evalData = qa.evaluation?.evaluation || qa.evaluation;
                          const overallScore = evalData?.scores?.overall_score;
                          const isLast = idx === transcriptData.length - 1;
                          return (
                            <div key={idx} style={{ marginBottom: isLast ? 0 : '28px', paddingBottom: isLast ? 0 : '28px', borderBottom: isLast ? 'none' : '1px solid var(--gray-200)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--primary-600)', textTransform: 'uppercase' }}>
                                  Q{idx + 1}: {qa.skill}
                                </div>
                                {overallScore != null && (
                                  <span style={{ fontSize: '11px', background: 'var(--primary-50)', color: 'var(--primary-700)', padding: '2px 8px', borderRadius: '6px', fontWeight: '700', border: '1px solid var(--primary-100)' }}>
                                    {overallScore * 10}%
                                  </span>
                                )}
                              </div>
                              <p style={{ fontWeight: '600', color: 'var(--gray-800)', marginBottom: '10px', fontSize: '15px', lineHeight: '1.5' }}>
                                {qa.question || '—'}
                              </p>
                              <div style={{ background: 'white', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)', fontSize: '14px', color: 'var(--gray-700)', lineHeight: '1.6' }}>
                                <strong style={{ color: 'var(--gray-500)', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Answer</strong>
                                <p style={{ marginTop: '6px' }}>{qa.answer || '(No answer recorded)'}</p>
                              </div>
                              {evalData?.summary_feedback && (
                                <div style={{ marginTop: '10px', padding: '12px 14px', background: 'var(--primary-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-100)', fontSize: '13px', color: 'var(--primary-800)', lineHeight: '1.5' }}>
                                  <strong style={{ fontWeight: '700' }}>💡 Feedback: </strong>{evalData.summary_feedback}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '40px' }}>
                  <button className="btn btn-secondary" onClick={() => {
                    setCurrentTab('interview');
                    setInterviewStep('start');
                    stopCamera();
                  }}>Back to Dashboard</button>
                  <button className="btn btn-primary" onClick={() => {
                    stopCamera();
                    if (profile?.parsedResume?.skills?.length > 0) {
                      const sData = profile.parsedResume.skillDetails || profile.parsedResume.skills.map((s: any) => ({skill: typeof s === 'string' ? s : s.skill, experience_level: 'intermediate'}));
                      setSkills(sData);
                      setInterviewStep('skills');
                    } else {
                      setInterviewStep('upload');
                    }
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
