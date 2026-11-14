import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiMic, FiStopCircle, FiArrowRight, FiAlertCircle,
  FiLoader, FiCheckCircle, FiUser, FiFileText, FiBriefcase,
  FiVolume2, FiVolumeX, FiStar, FiTrendingUp, FiMaximize, FiMinimize, FiX,
  FiClock, FiPlay, FiRefreshCw, FiMessageSquare
} from 'react-icons/fi';
import { useAuth, useUser } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import LottieComponent from 'lottie-react';
const Lottie = LottieComponent.default || LottieComponent;
import interviewLoader from '../assets/interviewLoader.json';
import SEOHead from '../components/common/SEOHead';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import { EvalixOrb, EvalixStarburst } from '../components/ui/EvalixOrb';
import api from '../api/axios';
import { API } from '../api/endpoints';
import { MOCK_QUESTION_COUNTS } from '../utils/constants';
import { getGradeColor } from '../utils/helpers';

// ─── Shristi Hybrid TTS Hook (Gemini Audio + Browser Web Speech API fallback) ─
const useShristi = ({ getToken }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const utteranceRef = useRef(null);
  const abortControllerRef = useRef(null);
  const safetyTimerRef = useRef(null);
  const resumeIntervalRef = useRef(null);
  const callIdRef = useRef(0);
  const voicesRef = useRef([]);

  // Pre-load voices for window.speechSynthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        try {
          const v = window.speechSynthesis.getVoices();
          if (v && v.length > 0) {
            voicesRef.current = v;
          }
        } catch (e) { /* ignore */ }
      };
      loadVoices();
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      };
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    callIdRef.current += 1;

    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) { /* ignore */ }
      abortControllerRef.current = null;
    }

    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }

    if (resumeIntervalRef.current) {
      clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) { /* ignore */ }
      sourceNodeRef.current = null;
    }

    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) { /* ignore */ }
    }
    setIsSpeaking(false);
  }, []);

  // Browser Web Speech API fallback with natural English female voice
  const speakWithBrowserSpeech = useCallback((rawText, onEnd) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSpeaking(false);
      onEnd?.();
      return;
    }

    try {
      window.speechSynthesis.cancel();

      // Clean markdown formatting for natural spoken speech
      const cleanText = (rawText || '')
        .replace(/[*_#`~>]/g, '')
        .replace(/\n+/g, ' ')
        .trim();

      if (!cleanText) {
        setIsSpeaking(false);
        onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utteranceRef.current = utterance;

      let voices = window.speechSynthesis.getVoices() || [];
      if (voices.length === 0 && voicesRef.current.length > 0) {
        voices = voicesRef.current;
      }

      const selectFemaleVoice = (vList) => {
        if (!vList || vList.length === 0) return null;
        // Priority 1: Natural Indian English & Hindi female voices
        const indianFemale =
          vList.find((v) =>
            /Neerja|Heera|Veena|Lekha|Swara|Aditi|Raveena|Kavya|Pooja|Geeta|Ananya|Google English \(India\)|Google हिन्दी/i.test(v.name || '')
          ) ||
          vList.find((v) =>
            (v.lang === 'en-IN' || v.lang === 'hi-IN' || v.lang === 'en_IN') &&
            !/male|david|alex|george|ravi|kumar|prabhat/i.test(v.name || '')
          );
        if (indianFemale) return indianFemale;

        // Priority 2: Other warm, gentle natural female voices
        return (
          vList.find((v) =>
            /Google UK English Female|Natural|Jenny|Aria|Samantha|Victoria|Karen|Moira|Tessa|Ava|Allison|Susan/i.test(v.name || '')
          ) ||
          vList.find((v) => (v.lang || '').startsWith('en') && /female/i.test(v.name || '')) ||
          vList.find((v) => (v.lang || '').startsWith('en') && !/male|david|alex|george|mark/i.test(v.name || '')) ||
          vList.find((v) => (v.lang || '').startsWith('en')) ||
          vList[0]
        );
      };

      const femaleVoice = selectFemaleVoice(voices);
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      } else {
        const onVoices = () => {
          window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
          const updated = window.speechSynthesis.getVoices() || [];
          const matched = selectFemaleVoice(updated);
          if (matched) utterance.voice = matched;
        };
        window.speechSynthesis.addEventListener('voiceschanged', onVoices);
      }

      // Calm, polite, soothing conversational pace (unhurried Indian rhythm)
      utterance.rate = 0.94;
      utterance.pitch = 1.03; // Gentle, friendly, warm female tone

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (resumeIntervalRef.current) {
          clearInterval(resumeIntervalRef.current);
          resumeIntervalRef.current = null;
        }
        if (safetyTimerRef.current) {
          clearTimeout(safetyTimerRef.current);
          safetyTimerRef.current = null;
        }
        utteranceRef.current = null;
        setIsSpeaking(false);
        onEnd?.();
      };

      utterance.onend = finish;
      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis event error:', e);
        finish();
      };

      setIsSpeaking(true);
      try {
        window.speechSynthesis.resume();
      } catch (e) { /* ignore */ }
      window.speechSynthesis.speak(utterance);

      // Chrome long-utterance keepalive fix
      if (resumeIntervalRef.current) clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          if (resumeIntervalRef.current) {
            clearInterval(resumeIntervalRef.current);
            resumeIntervalRef.current = null;
          }
        } else {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 5000);

      const maxSeconds = Math.max(6, cleanText.length / 10 + 3);
      safetyTimerRef.current = setTimeout(() => {
        if (resumeIntervalRef.current) {
          clearInterval(resumeIntervalRef.current);
          resumeIntervalRef.current = null;
        }
        if (!finished) {
          finish();
        }
      }, maxSeconds * 1000);
    } catch (e) {
      console.warn('Browser speech synthesis failed:', e);
      setIsSpeaking(false);
      onEnd?.();
    }
  }, []);

  const speak = useCallback(
    async (text, onEnd) => {
      if (isMuted) {
        onEnd?.();
        return;
      }

      stopSpeaking();
      const currentCallId = ++callIdRef.current;

      // Hybrid pipeline: Attempt external backend audio generation with quick timeout fallback
      try {
        const token = await getToken();
        const geminiKey = localStorage.getItem('custom_gemini_key');
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        if (geminiKey) headers['x-gemini-api-key'] = geminiKey;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        // 8s timeout for TTS request (ElevenLabs) so the interview flow is never stalled
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 8000);

        const response = await api.post(
          API.TTS,
          { text },
          {
            headers,
            responseType: 'arraybuffer',
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (callIdRef.current !== currentCallId) return;

        const contentType = response.headers?.['content-type'] || '';
        if (contentType.includes('application/json') || !response.data || response.data.byteLength < 100) {
          throw new Error('TTS response was non-audio or empty fallback');
        }

        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        const audioBuffer = await audioContextRef.current.decodeAudioData(response.data.slice(0));
        if (callIdRef.current !== currentCallId) return;

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);

        setIsSpeaking(true);
        sourceNodeRef.current = source;

        source.onended = () => {
          setIsSpeaking(false);
          sourceNodeRef.current = null;
          onEnd?.();
        };

        source.start(0);
      } catch (err) {
        if (callIdRef.current !== currentCallId) return;
        // Fall back seamlessly to browser Web Speech API — NEVER show error toasts or block interview
        speakWithBrowserSpeech(text, onEnd);
      }
    },
    [isMuted, getToken, stopSpeaking, speakWithBrowserSpeech]
  );

  const toggleMute = useCallback(() => {
    if (!isMuted) stopSpeaking();
    setIsMuted((m) => !m);
  }, [isMuted, stopSpeaking]);

  return { speak, stopSpeaking, isSpeaking, isMuted, toggleMute };
};

// ─── Voice Recorder Hook (ElevenLabs Scribe + Gemini + Browser Web Speech Fallback) ─
const useVoiceRecorder = ({ onTranscriptComplete, getToken }) => {
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const browserTranscriptRef = useRef('');
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);

  const onTranscriptRef = useRef(onTranscriptComplete);
  useEffect(() => {
    onTranscriptRef.current = onTranscriptComplete;
  }, [onTranscriptComplete]);

  const stopBrowserRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      return;
    }
    setError(null);
    browserTranscriptRef.current = '';

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      streamRef.current = stream;

      // Start parallel browser SpeechRecognition as a zero-latency fallback
      const SpeechRecognitionAPI =
        typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
      if (SpeechRecognitionAPI) {
        try {
          stopBrowserRecognition();
          const recognition = new SpeechRecognitionAPI();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';
          let finalParts = '';
          recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const piece = event.results[i][0]?.transcript || '';
              if (event.results[i].isFinal) {
                finalParts += `${piece} `;
              } else {
                interim += piece;
              }
            }
            browserTranscriptRef.current = `${finalParts}${interim}`.trim();
          };
          recognition.onerror = () => {};
          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) { /* ignore browser speech recognition init errors */ }
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';
      const cleanType = mimeType.split(';')[0] || 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopBrowserRecognition();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const fallbackText = (browserTranscriptRef.current || '').trim();
        const blob = new Blob(chunksRef.current, { type: cleanType });

        if (!blob || blob.size < 50) {
          if (fallbackText) {
            onTranscriptRef.current?.(fallbackText);
            setIsTranscribing(false);
            return;
          }
          toast('No audible speech detected. Please speak louder into your microphone, or use the text mode toggle to type.', {
            icon: '🎙️',
            duration: 4000,
          });
          setIsTranscribing(false);
          return;
        }

        setIsTranscribing(true);
        try {
          const token = await getToken();
          const geminiKey = localStorage.getItem('custom_gemini_key');
          const headers = { Authorization: `Bearer ${token}` };
          if (geminiKey) headers['x-gemini-api-key'] = geminiKey;

          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');
          const { data } = await api.post(API.TRANSCRIBE, formData, {
            headers,
          });

          const finalTranscript = data?.transcript?.trim() || fallbackText;
          if (finalTranscript) {
            onTranscriptRef.current?.(finalTranscript);
          } else {
            toast('No audible speech detected. Please speak louder into your microphone, or use the "Type Answer Instead" toggle to type.', {
              icon: '🎙️',
              duration: 4000,
            });
          }
        } catch (err) {
          console.error('Transcription error:', err);
          if (fallbackText) {
            onTranscriptRef.current?.(fallbackText);
          } else {
            toast.error(err.response?.data?.error || 'Transcription failed. Please speak louder or switch to typing.');
          }
        } finally {
          setIsTranscribing(false);
        }
      };

      // Collect audio slices in 250ms chunks
      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      if (err.name === 'NotAllowedError') setError('Microphone access denied. Please allow microphone permissions.');
      else setError(`Could not start recording: ${err.message}`);
    }
  }, [getToken, stopBrowserRecognition]);

  const stopRecording = useCallback(() => {
    stopBrowserRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Error stopping MediaRecorder:', e);
      }
    }
    setIsRecording(false);
  }, [stopBrowserRecognition]);

  useEffect(() => {
    return () => {
      stopBrowserRecognition();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopBrowserRecognition]);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording(); else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  return { isRecording, isTranscribing, error, toggleRecording, startRecording, stopRecording };
};

// Backwards-compatibility alias
const useDeepgramRecorder = useVoiceRecorder;

// ─── Shristi Avatar ────────────────────────────────────────────────────────────
const ShristiAvatar = ({ isSpeaking, isThinking }) => (
  <div className="flex flex-col items-center gap-3">
    <div className="relative">
      <AnimatePresence>
        {(isSpeaking || isThinking) && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: 'rgba(79, 70, 229, 0.15)' }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.2, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </AnimatePresence>
      <motion.div
        className="w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-lg relative z-10 border-4 border-white"
        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
        animate={isSpeaking ? { scale: [1, 1.04, 1] } : {}}
        transition={{ duration: 0.6, repeat: isSpeaking ? Infinity : 0 }}
      >
        👩‍💼
      </motion.div>
      {isSpeaking && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 bg-white rounded-full px-2 py-1 shadow-md border border-gray-100">
          {[0, 0.15, 0.3].map((delay, i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay }}
            />
          ))}
        </div>
      )}
      {isThinking && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 bg-white rounded-full px-2 py-1 shadow-md border border-gray-100">
          <FiLoader className="animate-spin text-primary w-3 h-3" />
        </div>
      )}
    </div>
    <div className="text-center">
      <p className="font-bold text-text-primary text-sm">Shristi</p>
      <p className="text-xs text-text-muted">AI Interviewer</p>
    </div>
  </div>
);

// ─── User Avatar ───────────────────────────────────────────────────────────────
const UserAvatar = ({ isSpeaking, imageUrl, name }) => (
  <div className="flex flex-col items-center gap-3">
    <div className="relative">
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: 'rgba(16, 185, 129, 0.15)' }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.2, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </AnimatePresence>
      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg relative z-10 bg-surface-hover flex items-center justify-center">
         {imageUrl ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" /> : <FiUser className="w-10 h-10 text-text-muted" />}
      </div>
      {isSpeaking && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 bg-white rounded-full px-2 py-1 shadow-md border border-gray-100">
          <FiMic className="text-success w-3 h-3 animate-pulse" />
        </div>
      )}
    </div>
    <div className="text-center">
      <p className="font-bold text-text-primary text-sm">{name || 'You'}</p>
      <p className="text-xs text-text-muted">Candidate</p>
    </div>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const SCREEN = { SETUP: 'setup', LOADING: 'loading', INTERVIEW: 'interview', RESULTS: 'results' };

const LiveInterview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken } = useAuth();
  const { user } = useUser();
  const containerRef = useRef(null);
  const chatEndRef = useRef(null);

  // ── Setup form state
  const [userName, setUserName] = useState(user?.firstName || '');
  const [jobRole, setJobRole] = useState(location.state?.jobRole || '');
  const [jobDescription, setJobDescription] = useState(location.state?.skills || '');
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [micStatus, setMicStatus] = useState('untested'); // 'untested' | 'testing' | 'ready' | 'denied'
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (user?.firstName && !userName) {
      setUserName(user.firstName);
    }
  }, [user?.firstName]);

  const handleCheckMicrophone = async () => {
    setMicStatus('testing');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicStatus('ready');
      toast.success('Microphone connected and ready!');
    } catch (err) {
      setMicStatus('denied');
      toast.error('Microphone access blocked. You can still use keyboard text mode.');
    }
  };

  // ── Session state
  const [screen, setScreen] = useState(SCREEN.SETUP);
  const [session, setSession] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [previousAnswer, setPreviousAnswer] = useState(null);
  
  // ── Flow & Mode State
  const [isIntroPhase, setIsIntroPhase] = useState(true);
  const [isSmallTalkPhase, setIsSmallTalkPhase] = useState(true);
  const [isCalmingActive, setIsCalmingActive] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');

  // ── Chat State
  const [chatHistory, setChatHistory] = useState([]);
  const [shristiMessage, setShristiMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalSession, setFinalSession] = useState(null);
  const [shristiHasSpoken, setShristiHasSpoken] = useState(false);

  // ── Fullscreen Listeners
  const handleFullscreenChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [handleFullscreenChange]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => toast.error(`Error enabling fullscreen: ${err.message}`));
    } else {
      document.exitFullscreen();
    }
  };

  const exitInterview = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    stopSpeaking();
    navigate('/dashboard');
  };

  // ── Scroll to bottom of chat
  useEffect(() => {
    if (screen === SCREEN.INTERVIEW) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isThinking, screen]);

  // ── Shristi TTS
  const { speak, stopSpeaking, isSpeaking, isMuted, toggleMute } = useShristi({ getToken });

  // ── Handle Auto-Submit
  const handleSubmitAnswer = async (answerText) => {
    if (!answerText || answerText.trim().length < 2) {
       toast.error("Answer too short. Please try again.");
       return;
    }
    
    stopSpeaking();
    setIsSubmitting(true);
    setIsThinking(true);
    setShristiHasSpoken(false);

    // If currently in Small Talk icebreaker phase, submit turn to comfort candidate
    if (isSmallTalkPhase) {
      try {
        const token = await getToken();
        const geminiKey = localStorage.getItem('custom_gemini_key');
        const headers = { Authorization: `Bearer ${token}` };
        if (geminiKey) headers['x-gemini-api-key'] = geminiKey;

        const { data } = await api.post(
          API.LIVE_INTERVIEW.TURN(session._id),
          { questionIndex: -1, userAnswer: answerText },
          { headers }
        );

        const result = data.data;
        setIsThinking(false);
        setIsSmallTalkPhase(false);
        setIsIntroPhase(false);

        const comfortingReply = result.shristiResponse ||
          "That is so wonderful to hear! Take a slow, comfortable breath — zero stress today, we are just having a friendly conversation. Let's start nice and easy with a quick warm-up question!";

        setChatHistory(prev => [...prev, { id: 'shristi-comfort', sender: 'shristi', text: comfortingReply }]);

        speak(comfortingReply, () => {
          setTimeout(() => {
            presentFirstQuestion(session);
          }, 600);
        });
      } catch (err) {
        setIsThinking(false);
        setIsSmallTalkPhase(false);
        setIsIntroPhase(false);
        presentFirstQuestion(session);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Regular question turn
    try {
      const token = await getToken();
      const geminiKey = localStorage.getItem('custom_gemini_key');
      const headers = { Authorization: `Bearer ${token}` };
      if (geminiKey) headers['x-gemini-api-key'] = geminiKey;

      const { data } = await api.post(
        API.LIVE_INTERVIEW.TURN(session._id),
        { questionIndex: currentQIndex, userAnswer: answerText, attempt, previousAnswer },
        { headers }
      );

      const result = data.data;
      setIsThinking(false);

      if (result.isPanicOrFumble) {
        setIsCalmingActive(true);
        setTimeout(() => setIsCalmingActive(false), 9000);
      }

      if (result.action === 'retry') {
        // Re-ask same question with Shristi's calming guidance
        setPreviousAnswer(answerText);
        setAttempt((a) => a + 1);
        setShristiMessage(result.shristiResponse);
      } else {
        // Move to next question (action = "next" or "followup")
        const nextIndex = currentQIndex + 1;
        if (nextIndex < session.totalQuestions) {
          const nextQ = session.questions[nextIndex];
          setCurrentQIndex(nextIndex);
          setAttempt(1);
          setPreviousAnswer(null);
          setTypedAnswer('');
          const lengthLabel = nextIndex === 0 ? 'Warm-up' : nextIndex === 1 ? 'Foundational' : 'Technical';
          setShristiMessage(`${result.shristiResponse}\n\nQuestion ${nextIndex + 1} (${lengthLabel}): ${nextQ.question}`);
        } else {
          // All questions done — complete interview
          setTypedAnswer('');
          setShristiMessage(result.shristiResponse);
          const completeDelay = isMuted ? 800 : Math.max(result.shristiResponse.length * 50, 1500);
          setTimeout(async () => {
            await handleComplete(result.shristiResponse);
          }, completeDelay);
        }
      }
    } catch (err) {
      setIsThinking(false);
      toast.error(err.response?.data?.error || 'Failed to evaluate answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const introTimeoutRef = useRef(null);
  const introFinishedRef = useRef(false);

  // ── Voice recording
  const handleTranscriptComplete = useCallback(async (t) => {
    if (isTextMode) {
      setTypedAnswer((prev) => (prev ? `${prev.trimEnd()} ${t}` : t));
      toast.success('Speech transcribed to answer field! Review and press Send.');
    } else {
      setTypedAnswer(t);
      setChatHistory(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: t }]);
      await handleSubmitAnswer(t);
    }
  }, [isTextMode, isSmallTalkPhase, currentQIndex, attempt, previousAnswer, session]);

  const { isRecording, isTranscribing, error: recorderError, toggleRecording, startRecording } = useVoiceRecorder({
    onTranscriptComplete: handleTranscriptComplete,
    getToken,
  });

  // ── Present First Question ONLY after Intro finishes
  const presentFirstQuestion = useCallback((targetSession) => {
    if (introTimeoutRef.current) {
      clearTimeout(introTimeoutRef.current);
      introTimeoutRef.current = null;
    }
    if (introFinishedRef.current) return;
    introFinishedRef.current = true;

    const s = targetSession || session;
    if (!s || !s.questions || s.questions.length === 0) return;
    setIsSmallTalkPhase(false);
    setIsIntroPhase(false);

    const firstQ = s.questions[0];
    const q1Text = `Question 1 (Warm-up): ${firstQ.question}`;

    setChatHistory(prev => {
      if (prev.some(m => m.id === 'q-0')) return prev;
      return [...prev, { id: 'q-0', sender: 'shristi', text: q1Text }];
    });

    speak(q1Text, () => {
      setShristiHasSpoken(true);
      if (!isMuted && !isTextMode) {
        startRecording();
      }
    });
  }, [session, isMuted, isTextMode, speak, startRecording]);

  // ── Skip Intro / Small Talk action
  const handleSkipIntro = useCallback(() => {
    stopSpeaking();
    setIsSmallTalkPhase(false);
    setIsIntroPhase(false);
    presentFirstQuestion(session);
  }, [stopSpeaking, presentFirstQuestion, session]);

  // ── Helper to request gentle hint / calming reassurance
  const handleAskHintOrCalm = async () => {
    if (isSubmitting || isThinking) return;
    const calmMsg = "I'm feeling a bit nervous and blanking out, could you help calm me down and give a small hint?";
    setChatHistory(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: calmMsg }]);
    await handleSubmitAnswer(calmMsg);
  };

  // ── Step 1: Shristi Warm Indian Greeting & Non-Technical Small Talk
  useEffect(() => {
    if (screen === SCREEN.INTERVIEW && session && chatHistory.length === 0) {
      introFinishedRef.current = false;
      const smallTalkGreeting = session.smallTalkQuestion ||
        `Namaste ${userName}! It is so lovely to meet you today. I'm Shristi! Before we jump into anything technical, please take a slow, comfortable breath and relax. How has your day been going so far? Did you manage to grab a nice cup of chai or coffee before joining?`;

      setIsSmallTalkPhase(true);
      setIsIntroPhase(true);
      setChatHistory([{ id: 'smalltalk-intro', sender: 'shristi', text: smallTalkGreeting }]);

      speak(smallTalkGreeting, () => {
        setShristiHasSpoken(true);
        setIsIntroPhase(false);
        // Candidate is now encouraged to answer! If in voice mode, automatically start recording!
        if (!isMuted && !isTextMode) {
          startRecording();
        }
      });
    }
  }, [screen, session, chatHistory.length, userName, difficulty, isMuted, isTextMode, speak, startRecording]);

  // ── Speak Shristi's subsequent responses in interview
  useEffect(() => {
    if (shristiMessage && screen === SCREEN.INTERVIEW && !isIntroPhase) {
      setChatHistory(prev => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'shristi' && last.text === shristiMessage) return prev;
        return [...prev, { id: Date.now().toString(), sender: 'shristi', text: shristiMessage }];
      });
      speak(shristiMessage, () => {
         setShristiHasSpoken(true);
         // Automatically start listening when Shristi finishes speaking question
         if (!isMuted && !isTextMode) {
           startRecording();
         }
      });
    }
  }, [shristiMessage, screen, isIntroPhase, isMuted, isTextMode, speak, startRecording]);

  // Cleanup speech and pending timeouts on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (introTimeoutRef.current) {
        clearTimeout(introTimeoutRef.current);
      }
    };
  }, [stopSpeaking]);

  // ── Submit typed answer
  const handleSendTypedAnswer = async (e) => {
    e?.preventDefault();
    if (!typedAnswer || typedAnswer.trim().length < 2) {
      toast.error('Please enter a valid answer.');
      return;
    }
    const ans = typedAnswer.trim();
    setTypedAnswer('');
    setChatHistory(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: ans }]);
    await handleSubmitAnswer(ans);
  };

  // ─── Start interview
  const handleStart = async (e) => {
    e.preventDefault();
    if (!userName || !jobRole || !jobDescription) return;
    
    // Request Microphone permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      toast.error("Microphone permission recommended for voice mode. You can also type answers.");
    }

    // Go Fullscreen
    if (containerRef.current && !document.fullscreenElement) {
       containerRef.current.requestFullscreen().catch(() => {});
    }

    setScreen(SCREEN.LOADING);
    try {
      const token = await getToken();
      const geminiKey = localStorage.getItem('custom_gemini_key');
      const headers = { Authorization: `Bearer ${token}` };
      if (geminiKey) headers['x-gemini-api-key'] = geminiKey;
      const { data } = await api.post(
        API.LIVE_INTERVIEW.START,
        { userName, jobRole, jobDescription, totalQuestions: Number(totalQuestions), difficulty },
        { headers }
      );
      setSession(data.data);
      setIsSmallTalkPhase(true);
      setIsIntroPhase(true);
      setIsCalmingActive(false);
      setChatHistory([]);
      setCurrentQIndex(0);
      setAttempt(1);
      setPreviousAnswer(null);
      setShristiMessage('');
      setScreen(SCREEN.INTERVIEW);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start interview. Please try again.');
      setScreen(SCREEN.SETUP);
    }
  };

  // ─── Complete interview
  const handleComplete = async (lastMessage = '') => {
    try {
      const token = await getToken();
      const geminiKey = localStorage.getItem('custom_gemini_key');
      const headers = { Authorization: `Bearer ${token}` };
      if (geminiKey) headers['x-gemini-api-key'] = geminiKey;

      const { data } = await api.post(API.LIVE_INTERVIEW.COMPLETE(session._id), {}, { headers });
      setFinalSession(data.data);
      stopSpeaking();
      const finalMsg = `Thank you ${userName}! That concludes our interview. You did a great job. Your results are now ready.`;
      speak(finalMsg, () => {
         if (document.fullscreenElement) document.exitFullscreen();
         setScreen(SCREEN.RESULTS);
      });
      setShristiMessage(finalMsg);
    } catch (err) {
      toast.error('Failed to complete interview. Please try again.');
      setScreen(SCREEN.RESULTS);
    }
  };

  // ─── Elapsed timer during active interview
  useEffect(() => {
    if (screen !== SCREEN.INTERVIEW) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [screen]);

  const formatClock = (secs) => {
    const mins = Math.floor(secs / 60).toString().padStart(2, '0');
    const rem = (secs % 60).toString().padStart(2, '0');
    return `${mins}:${rem}`;
  };

  // ─── Render: RESULTS (Phase 7 Editorial Scorecard) ───────────────────────────
  if (screen === SCREEN.RESULTS && finalSession) {
    const { overallFeedback, questions, turns, userName: name, jobRole: role } = finalSession;
    const bestTurnByQ = {};
    (turns || []).forEach((t) => {
      if (!bestTurnByQ[t.questionIndex] || t.score > bestTurnByQ[t.questionIndex].score) {
        bestTurnByQ[t.questionIndex] = t;
      }
    });

    const avgScore = overallFeedback?.averageScore || 0;
    const verdictLabel =
      avgScore >= 80
        ? 'Strong Hire Signal'
        : avgScore >= 60
        ? 'Hire Ready — Minor Polish'
        : 'Keep Training in Arena';

    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-fade-in">
        <SEOHead title={`Live Interview Scorecard — ${role}`} />

        {/* Top Scorecard Banner */}
        <div className="rounded-[24px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 rounded-[8px] bg-[#282828] text-[#C7F36B] font-mono text-xs uppercase font-bold">
                  SESSION REPORT
                </span>
                <span className="px-3 py-1 rounded-[8px] bg-[#FF6B35]/20 text-[#FF6B35] font-mono text-xs uppercase font-semibold">
                  {finalSession.difficulty || difficulty} Difficulty
                </span>
                <span className="text-xs font-mono text-[#B5AFA6]">
                  • {overallFeedback?.totalTurns || turns?.length || 0} Total Exchanges
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">
                {role} — Live Voice Evaluation
              </h1>

              <p className="text-sm sm:text-base text-[#B5AFA6]">
                Candidate: <strong className="text-white">{name}</strong> • Evaluated across technical accuracy, clarity, and depth.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon={FiRefreshCw}
                  onClick={() => {
                    setFinalSession(null);
                    setSession(null);
                    setScreen(SCREEN.SETUP);
                  }}
                >
                  Practice Another Round
                </Button>
                <Button variant="lime" size="md" onClick={() => navigate('/dashboard')}>
                  Back to Dashboard
                </Button>
              </div>
            </div>

            {/* Overall Score Dial Box */}
            <div className="rounded-[20px] bg-[#1F1F1F] border border-[#333333] p-6 flex flex-col items-center justify-center min-w-[220px] text-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#B5AFA6]">
                OVERALL SCORE
              </span>
              <div
                className={`text-5xl sm:text-6xl font-editorial my-2 ${
                  avgScore >= 75
                    ? 'text-[#C7F36B]'
                    : avgScore >= 50
                    ? 'text-[#FF6B35]'
                    : 'text-[#F87171]'
                }`}
              >
                {avgScore}%
              </div>
              <span className="px-3 py-1 rounded-[8px] bg-[#282828] text-xs font-display font-bold text-white">
                {verdictLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Strengths, Improvements & Shristi's Verdict */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 rounded-[18px] bg-bg-surface border border-border-subtle p-6 space-y-4">
            <h3 className="text-lg font-display font-bold text-text-primary">
              Key Strengths
            </h3>
            <ul className="space-y-2.5">
              {overallFeedback?.strengths?.length > 0 ? (
                overallFeedback.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <FiCheckCircle className="text-success mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-text-muted">Completed live voice session.</li>
              )}
            </ul>
          </div>

          <div className="lg:col-span-4 rounded-[18px] bg-bg-surface border border-border-subtle p-6 space-y-4">
            <h3 className="text-lg font-display font-bold text-text-primary">
              Areas to Improve
            </h3>
            <ul className="space-y-2.5">
              {overallFeedback?.weaknesses?.length > 0 ? (
                overallFeedback.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <span className="w-2 h-2 rounded-full bg-[#FF6B35] mt-2 shrink-0" />
                    <span>{w}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-text-muted">Keep practicing deeper system trade-offs.</li>
              )}
            </ul>
          </div>

          <div className="lg:col-span-4 rounded-[18px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#C7F36B] block">
                  INTERVIEWER NOTE
                </span>
                <h3 className="text-base font-display font-bold text-white mt-0.5">
                  Shristi’s Summary
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-[#B5AFA6] leading-relaxed">
                {overallFeedback?.recommendations ||
                  'Focus on structuring technical answers with concrete metrics and architectural trade-offs.'}
              </p>
            </div>
            <div className="pt-3 border-t border-[#2E2E2E] flex items-center justify-between text-xs font-mono text-[#C7F36B]">
              <span>Saved to Session History</span>
              <span>✓ Saved</span>
            </div>
          </div>
        </div>

        {/* Question-by-Question Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#FF6B35] font-bold">
                QUESTION-BY-QUESTION RUBRIC
              </span>
              <h2 className="text-2xl font-display font-bold text-text-primary">
                Detailed Exchange Breakdown
              </h2>
            </div>
          </div>

          <div className="space-y-5">
            {questions?.map((q, i) => {
              const best = bestTurnByQ[i];
              const allAttempts = (turns || []).filter((t) => t.questionIndex === i);
              if (!best) return null;
              return (
                <div
                  key={i}
                  className="rounded-[20px] bg-bg-surface border border-border-subtle p-6 space-y-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-border-subtle">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-[6px] bg-[#151515] text-[#F8F5EF] font-mono text-xs font-bold">
                          Q0{i + 1}
                        </span>
                        <Badge variant="secondary">{q.category}</Badge>
                        {allAttempts.length > 1 && (
                          <Badge variant="warning">{allAttempts.length} Attempts</Badge>
                        )}
                      </div>
                      <h4 className="text-base sm:text-lg font-display font-bold text-text-primary pt-1">
                        {q.question}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-3 py-1.5 rounded-[10px] font-mono text-sm font-bold ${
                          best.score >= 7
                            ? 'bg-[#C7F36B] text-[#151515]'
                            : best.score >= 5
                            ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                            : 'bg-danger/15 text-danger'
                        }`}
                      >
                        {best.score}/10
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted block">
                        YOUR SPOKEN RESPONSE
                      </span>
                      {allAttempts.map((turn, ti) => (
                        <div
                          key={ti}
                          className="p-4 rounded-[14px] bg-bg-canvas border border-border-subtle text-sm text-text-primary italic leading-relaxed"
                        >
                          {allAttempts.length > 1 && (
                            <span className="text-[10px] font-mono uppercase font-bold text-[#FF6B35] block mb-1 not-italic">
                              Attempt {turn.attempt}
                            </span>
                          )}
                          “{turn.userAnswer}”
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#FF6B35] font-bold block">
                        SHRISTI’S RUBRIC EVALUATION
                      </span>
                      <div className="p-4 rounded-[14px] bg-[#FF6B35]/8 border border-[#FF6B35]/25 text-sm text-text-primary leading-relaxed">
                        {best.feedback}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: MAIN ARENA CONTAINER (Focused Ink Black Experience) ─────────────
  const renderArenaContainer = (content) => (
    <div
      ref={containerRef}
      className={`theme-interview bg-[#151515] text-[#F8F5EF] rounded-[24px] border-2 border-[#2E2E2E] transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen rounded-none border-0 overflow-hidden flex flex-col p-4 sm:p-6'
          : 'min-h-[calc(100vh-6.5rem)] overflow-hidden flex flex-col p-4 sm:p-6 shadow-xl'
      }`}
    >
      <SEOHead title={`Live Interview Arena — ${jobRole}`} />
      {content}
    </div>
  );

  // ─── Render: LOADING ─────────────────────────────────────────────────────────
  if (screen === SCREEN.LOADING) {
    return renderArenaContainer(
      <div className="flex flex-col items-center justify-center flex-1 py-16 text-center space-y-6">
        <EvalixOrb state="thinking" size="xl" showLabel />
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">
            Preparing your {jobRole} interview...
          </h2>
          <p className="text-sm text-[#B5AFA6] leading-relaxed">
            Generating <strong className="text-white">{totalQuestions} {difficulty}-level questions</strong> from your job description and connecting the voice room.
          </p>
        </div>
      </div>
    );
  }

  // ─── Render: INTERVIEW (Phase 6 — 3-Zone Dark Interview Arena) ───────────────
  if (screen === SCREEN.INTERVIEW && session) {
    const progress = Math.round(((currentQIndex + 1) / session.totalQuestions) * 100);
    const orbState = isSpeaking
      ? 'speaking'
      : isRecording
      ? 'listening'
      : isThinking || isTranscribing
      ? 'evaluating'
      : 'idle';

    const currentQuestionObj = session.questions?.[currentQIndex];

    return renderArenaContainer(
      <div className="flex flex-col flex-1 w-full max-w-6xl mx-auto justify-between gap-4 min-h-0">
        {/* ── ZONE 1: Top Arena Telemetry Bar ── */}
        <div className="pb-3.5 border-b border-[#2E2E2E] shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-display font-bold text-white">
                    {session.jobRole}
                  </h2>
                  <span className="px-2 py-0.5 rounded-[6px] bg-[#282828] border border-[#383838] text-[11px] font-mono uppercase text-[#C7F36B]">
                    {session.difficulty || difficulty}
                  </span>
                </div>
                <p className="text-xs font-mono text-[#B5AFA6]">
                  {isSmallTalkPhase
                    ? 'Warm-Up Check-in with Shristi'
                    : `Question ${currentQIndex + 1} of ${session.totalQuestions} • Attempt #${attempt}`}
                </p>
              </div>
            </div>

            {/* Right Arena Status & Session Controls */}
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[#1F1F1F] border border-[#333333] text-xs font-mono text-[#F8F5EF]">
                <FiClock className="text-[#FF6B35]" size={13} />
                <span>{formatClock(elapsedSeconds)}</span>
              </div>

              <button
                type="button"
                onClick={toggleMute}
                className={`px-3 py-1.5 rounded-[10px] border text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isMuted
                    ? 'bg-[#F87171]/15 border-[#F87171]/40 text-[#F87171]'
                    : 'bg-[#1F1F1F] border-[#333333] text-[#F8F5EF] hover:border-[#FF6B35]'
                }`}
                title={isMuted ? 'Unmute Shristi AI Voice' : 'Mute Shristi AI Voice'}
              >
                {isMuted ? <FiVolumeX size={14} /> : <FiVolume2 size={14} />}
                <span className="hidden md:inline">{isMuted ? 'AI Muted' : 'Voice On'}</span>
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2 rounded-[10px] bg-[#1F1F1F] border border-[#333333] text-[#B5AFA6] hover:text-white hidden sm:flex items-center justify-center cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Arena'}
              >
                {isFullscreen ? <FiMinimize size={14} /> : <FiMaximize size={14} />}
              </button>

              <button
                type="button"
                onClick={exitInterview}
                className="px-3 py-1.5 rounded-[10px] bg-[#282828] hover:bg-[#DC2626] text-[#F8F5EF] border border-[#383838] text-xs font-display font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FiX size={14} /> End
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#242424] rounded-full h-1.5 overflow-hidden">
            <motion.div
              className="bg-[#C7F36B] h-full rounded-full"
              animate={{ width: `${isSmallTalkPhase ? 8 : progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* ── ZONE 2: Main Interview Stage (Left Presence + Right Active Question & Transcript) ── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
          {/* Left Column: AI Interviewer Presence & Candidate Pod (4 Cols) */}
          <div className="lg:col-span-4 flex flex-row lg:flex-col gap-4">
            {/* Shristi AI Presence Card */}
            <div className="flex-1 rounded-[20px] bg-[#1F1F1F] border border-[#333333] p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B5AFA6] mb-3">
                AI INTERVIEWER
              </span>
              <EvalixOrb state={orbState} size="lg" showLabel />
              <h3 className="font-display font-bold text-base text-white mt-3">
                Shristi
              </h3>
              <p className="text-xs text-[#B5AFA6] mt-0.5">
                {isSpeaking
                  ? 'Speaking prompt aloud...'
                  : isRecording
                  ? 'Listening to your answer...'
                  : isThinking
                  ? 'Evaluating against rubric...'
                  : 'Waiting for your response'}
              </p>
            </div>

            {/* Candidate Pod */}
            <div className="flex-1 rounded-[20px] bg-[#1F1F1F] border border-[#333333] p-5 flex flex-col items-center justify-center text-center relative">
              <div
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 flex items-center justify-center mb-3 transition-all ${
                  isRecording
                    ? 'border-[#C7F36B] shadow-[0_0_20px_rgba(199,243,107,0.3)]'
                    : 'border-[#383838] bg-[#282828]'
                }`}
              >
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  <FiUser className="w-8 h-8 text-[#B5AFA6]" />
                )}
              </div>
              <p className="font-display font-bold text-sm text-white">{userName || 'You'}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRecording ? 'bg-[#C7F36B] animate-ping' : 'bg-[#7C7872]'
                  }`}
                />
                <span className="text-[11px] font-mono text-[#B5AFA6]">
                  {isRecording ? 'Mic Live — Recording' : isTextMode ? 'Keyboard Mode' : 'Mic Standby'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Prominent Question Banner + Live Transcript Feed (8 Cols) */}
          <div className="lg:col-span-8 rounded-[20px] bg-[#1F1F1F] border border-[#333333] flex flex-col overflow-hidden min-h-0">
            {/* Pinned Current Question Header */}
            <div className="p-4 sm:p-5 bg-[#242424] border-b border-[#333333] shrink-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#FF6B35] font-bold">
                  {isSmallTalkPhase
                    ? 'WARM-UP ICEBREAKER'
                    : `ACTIVE PROMPT • ${currentQuestionObj?.category || 'Technical'}`}
                </span>
                {isSmallTalkPhase && (
                  <button
                    type="button"
                    onClick={handleSkipIntro}
                    className="px-2.5 py-1 rounded-[8px] bg-[#FF6B35] text-white text-xs font-display font-semibold hover:bg-[#EB5822] transition-colors cursor-pointer"
                  >
                    Skip to Question 1 →
                  </button>
                )}
              </div>
              <p className="text-sm sm:text-base font-display font-semibold text-white leading-snug">
                {isSmallTalkPhase
                  ? 'Take a slow breath and say hello to Shristi — or skip directly to Question 1 whenever you feel ready.'
                  : currentQuestionObj?.question}
              </p>
            </div>

            {/* Conversation & Live Transcript Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 scrollbar-thin">
              {isCalmingActive && (
                <div className="p-3.5 rounded-[14px] bg-[#C7F36B]/15 border border-[#C7F36B]/40 text-xs text-[#C7F36B] flex items-center gap-2">
                  <span>🌱</span>
                  <span>
                    Take your time — Shristi is here to help you practice. Zero rush!
                  </span>
                </div>
              )}

              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[86%] p-4 rounded-[16px] text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#FF6B35] text-white rounded-tr-xs'
                        : 'bg-[#151515] border border-[#333333] text-[#F8F5EF] rounded-tl-xs'
                    }`}
                  >
                    <span className="text-[10px] font-mono uppercase tracking-wider opacity-75 block mb-1">
                      {msg.sender === 'user' ? `${userName || 'You'}` : 'Shristi AI'}
                    </span>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-[#151515] border border-[#333333] px-4 py-3 rounded-[14px] flex items-center gap-3 text-xs font-mono text-[#C7F36B]">
                    <FiLoader className="animate-spin text-[#FF6B35]" />
                    <span>Shristi is evaluating your answer...</span>
                  </div>
                </div>
              )}

              {isTranscribing && (
                <div className="flex justify-end">
                  <div className="bg-[#282828] border border-[#383838] px-4 py-3 rounded-[14px] flex items-center gap-3 text-xs font-mono text-[#F8F5EF]">
                    <FiLoader className="animate-spin text-[#C7F36B]" />
                    <span>Transcribing your voice response...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* ── ZONE 3: Bottom Control Dock ── */}
            <div className="p-4 bg-[#181818] border-t border-[#2E2E2E] shrink-0">
              {recorderError && (
                <div className="flex items-center gap-2 text-xs text-[#F87171] bg-[#F87171]/10 border border-[#F87171]/30 px-3 py-1.5 rounded-[10px] mb-3">
                  <FiAlertCircle /> {recorderError}
                </div>
              )}

              {isTextMode ? (
                <form onSubmit={handleSendTypedAnswer} className="space-y-2.5">
                  <div className="flex gap-2">
                    <textarea
                      value={typedAnswer}
                      onChange={(e) => setTypedAnswer(e.target.value)}
                      placeholder={
                        isRecording
                          ? 'Recording voice... click mic to stop & transcribe'
                          : isSmallTalkPhase
                          ? 'Reply to Shristi (e.g., "Doing great, ready to start!")...'
                          : 'Type your technical explanation or click the mic to dictate...'
                      }
                      rows={2}
                      disabled={isSubmitting || isThinking || isTranscribing}
                      className="flex-1 px-4 py-2.5 rounded-[12px] border border-[#383838] bg-[#151515] text-[#F8F5EF] placeholder-[#7C7872] text-sm focus:border-[#FF6B35] focus:outline-none resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendTypedAnswer();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={toggleRecording}
                      disabled={isSubmitting || isThinking || isTranscribing}
                      className={`px-3.5 rounded-[12px] border transition-all cursor-pointer flex items-center justify-center ${
                        isRecording
                          ? 'bg-[#DC2626] border-[#DC2626] text-white animate-pulse'
                          : 'bg-[#242424] border-[#383838] text-[#F8F5EF] hover:border-[#FF6B35]'
                      }`}
                      title={isRecording ? 'Stop & transcribe' : 'Dictate with mic'}
                    >
                      {isRecording ? <FiStopCircle size={18} /> : <FiMic size={18} />}
                    </button>
                    <button
                      type="submit"
                      disabled={
                        isSubmitting ||
                        isThinking ||
                        !typedAnswer.trim() ||
                        isRecording ||
                        isTranscribing
                      }
                      className="px-5 rounded-[12px] bg-[#FF6B35] hover:bg-[#EB5822] text-white font-display font-bold text-sm disabled:opacity-40 cursor-pointer"
                    >
                      {isSubmitting ? <FiLoader className="animate-spin" /> : 'Submit'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono text-[#B5AFA6]">
                    {!isSmallTalkPhase ? (
                      <button
                        type="button"
                        onClick={handleAskHintOrCalm}
                        disabled={isSubmitting || isThinking}
                        className="text-[#C7F36B] hover:underline cursor-pointer"
                      >
                        Need a hint from Shristi?
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={() => setIsTextMode(false)}
                      className="text-[#FF6B35] hover:underline cursor-pointer"
                    >
                      Switch to Voice Dock 🎙️
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#B5AFA6]">
                    {!isSmallTalkPhase && (
                      <button
                        type="button"
                        onClick={handleAskHintOrCalm}
                        disabled={isSpeaking || isSubmitting || isThinking}
                        className="px-3 py-2 rounded-[10px] bg-[#242424] hover:bg-[#2E2E2E] text-[#C7F36B] border border-[#383838] transition-colors cursor-pointer"
                      >
                        💡 Ask for a Hint
                      </button>
                    )}
                  </div>

                  {/* Center Primary Mic Control */}
                  <div>
                    {isRecording ? (
                      <button
                        type="button"
                        onClick={toggleRecording}
                        className="inline-flex items-center gap-2.5 px-7 py-3 rounded-[14px] bg-[#DC2626] text-white font-display font-bold text-sm shadow-[0_3px_0_#000000] animate-pulse cursor-pointer"
                      >
                        <FiStopCircle size={18} />
                        {isSmallTalkPhase ? 'Done Speaking Reply' : 'Finish & Submit Answer'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={toggleRecording}
                        disabled={isSpeaking || isSubmitting || isTranscribing}
                        className="inline-flex items-center gap-2.5 px-7 py-3 rounded-[14px] bg-[#FF6B35] hover:bg-[#EB5822] text-white font-display font-bold text-sm shadow-[0_3px_0_#000000] disabled:opacity-40 cursor-pointer transition-all"
                      >
                        <FiMic size={18} />
                        {isSpeaking
                          ? 'Shristi is speaking...'
                          : isSmallTalkPhase
                          ? 'Tap Mic to Reply'
                          : 'Tap Mic to Speak Answer'}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsTextMode(true)}
                    className="px-3 py-2 rounded-[10px] bg-[#242424] hover:bg-[#2E2E2E] text-[#F8F5EF] border border-[#383838] text-xs font-mono transition-colors cursor-pointer"
                  >
                    <FiMessageSquare className="inline mr-1.5" size={13} />
                    Type Answer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: SETUP (Phase 5 — Structured Interview Configuration + Equipment Check) ───
  return (
    <div className="space-y-6 animate-fade-in">
      <SEOHead title="Live AI Voice Interview — Evalix" />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <h1 className="heading-page text-text-primary">
            Live AI Voice Interview
          </h1>
          <p className="text-sm sm:text-base text-text-secondary mt-1">
            Practice a <strong className="text-text-primary font-semibold">multi-turn spoken interview</strong> with <strong className="text-text-primary font-semibold">Shristi AI</strong> tailored to your target role and job description.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Step-by-Step Configuration Form (7 Cols) */}
        <div className="lg:col-span-7 rounded-[20px] bg-bg-surface border border-border-subtle p-6 sm:p-8">
          <form onSubmit={handleStart} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="userName"
                label="1. Candidate Name"
                placeholder="e.g., Shubham Maurya"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                icon={FiUser}
                required
              />
              <Input
                id="jobRole"
                label="2. Target Role / Track"
                placeholder="e.g., Senior Frontend Engineer"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                icon={FiBriefcase}
                required
              />
            </div>

            {/* Quick Role Preset Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-text-muted mr-1">Quick Fill:</span>
              {[
                'Frontend React Engineer',
                'Full Stack Developer',
                'Backend Node.js Engineer',
                'System Design Architect',
                'SDE-1 (Fresher)',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setJobRole(preset)}
                  className={`px-2.5 py-1 rounded-[8px] text-xs font-mono transition-colors cursor-pointer border ${
                    jobRole === preset
                      ? 'bg-[#151515] text-[#F8F5EF] border-[#151515]'
                      : 'bg-bg-canvas text-text-secondary border-border-subtle hover:border-[#FF6B35]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Job Description / Resume Context */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary block"
                htmlFor="jobDescription"
              >
                3. Job Description or Resume Project Highlights *
              </label>
              <textarea
                id="jobDescription"
                rows={5}
                placeholder="Paste the target job description, required tech stack, or key projects from your resume. Shristi will tailor her questions and follow-ups to this context..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-[11px] border border-border-subtle bg-bg-surface text-text-primary placeholder-text-muted resize-y text-sm focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/15 focus:outline-none transition-all"
              />
            </div>

            {/* Difficulty & Question Count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary block">
                  4. Seniority & Difficulty
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'easy', label: 'Easy', sub: 'Fundamentals' },
                    { id: 'medium', label: 'Medium', sub: 'Practical' },
                    { id: 'hard', label: 'Hard', sub: 'Deep Dive' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      className={`p-3 rounded-[12px] border text-center transition-all cursor-pointer flex flex-col items-center ${
                        difficulty === d.id
                          ? 'bg-[#151515] text-[#F8F5EF] border-[#151515]'
                          : 'bg-bg-canvas border-border-subtle text-text-secondary hover:border-text-primary/40'
                      }`}
                    >
                      <span className="text-xs font-display font-bold">{d.label}</span>
                      <span className="text-[10px] font-mono opacity-75 mt-0.5">{d.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary block">
                  5. Session Length (Questions)
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {MOCK_QUESTION_COUNTS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setTotalQuestions(opt)}
                      className={`p-3 rounded-[12px] border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                        totalQuestions === opt
                          ? 'bg-[#FF6B35] text-white border-[#151515] font-bold'
                          : 'bg-bg-canvas border-border-subtle text-text-secondary hover:border-text-primary/40'
                      }`}
                    >
                      <span className="text-sm font-display font-bold">{opt} Qs</span>
                      <span className="text-[10px] font-mono opacity-80">~{opt * 2} mins</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pre-Interview Equipment Check Bar */}
            <div className="p-4 rounded-[14px] bg-bg-canvas border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-display font-bold text-text-primary">
                  Microphone Check
                </p>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  {micStatus === 'ready'
                    ? 'Microphone verified and ready for live voice mode.'
                    : micStatus === 'denied'
                    ? 'Mic blocked — keyboard answer fallback will be available.'
                    : 'Test microphone access before starting your session.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCheckMicrophone}
                className="px-3.5 py-2 rounded-[10px] bg-bg-surface border border-border-subtle hover:border-[#151515] text-xs font-mono font-semibold text-text-primary shrink-0 cursor-pointer transition-colors"
              >
                {micStatus === 'testing'
                  ? 'Checking...'
                  : micStatus === 'ready'
                  ? '✓ Mic Verified'
                  : 'Test Microphone'}
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={!userName || !jobRole || !jobDescription}
              icon={FiArrowRight}
            >
              Start Live Voice Interview
            </Button>
          </form>
        </div>

        {/* Right Column: Persistent Session Summary & Shristi Briefing Card (5 Cols) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <div className="rounded-[22px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-6 sm:p-7 space-y-6">
            <div className="flex items-center gap-4 pb-5 border-b border-[#2E2E2E]">
              <EvalixOrb state="speaking" size="md" />
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#C7F36B] block">
                  VOICE INTERVIEWER
                </span>
                <h2 className="text-xl font-display font-bold text-white">
                  Shristi AI
                </h2>
                <p className="text-xs text-[#B5AFA6]">
                  Multi-turn Technical &amp; Behavioral Interviewer
                </p>
              </div>
            </div>

            {/* Live Session Summary Preview */}
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#B5AFA6] block">
                SESSION SUMMARY
              </span>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-[12px] bg-[#1F1F1F] border border-[#333333]">
                  <span className="text-[#B5AFA6] font-mono block text-[10px]">TARGET ROLE</span>
                  <span className="font-display font-bold text-white mt-0.5 block truncate">
                    {jobRole || 'Not selected yet'}
                  </span>
                </div>
                <div className="p-3 rounded-[12px] bg-[#1F1F1F] border border-[#333333]">
                  <span className="text-[#B5AFA6] font-mono block text-[10px]">FORMAT</span>
                  <span className="font-display font-bold text-[#FF6B35] uppercase mt-0.5 block">
                    {difficulty} • {totalQuestions} Qs
                  </span>
                </div>
              </div>
            </div>

            {/* What to Expect */}
            <div className="space-y-3 pt-2 border-t border-[#2E2E2E]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#C7F36B] block">
                SESSION FLOW
              </span>
              <div className="space-y-2.5 text-xs text-[#B5AFA6]">
                <p>
                  <strong className="text-white">1. Optional Warm-Up:</strong> Start with a brief check-in or skip directly to Question 1.
                </p>
                <p>
                  <strong className="text-white">2. Spoken Q&amp;A + Follow-Ups:</strong> Shristi reads each question aloud and probes shallow answers with up to <strong className="text-white">2 follow-ups</strong>.
                </p>
                <p>
                  <strong className="text-white">3. Hints &amp; Text Fallback:</strong> Request a hint anytime or switch between microphone and keyboard input.
                </p>
                <p>
                  <strong className="text-white">4. Per-Question Scorecard:</strong> Review your transcript, scores out of 10, and feedback after completing the session.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveInterview;
