import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiMic, FiStopCircle, FiArrowRight, FiAlertCircle,
  FiLoader, FiCheckCircle, FiUser, FiFileText, FiBriefcase,
  FiVolume2, FiVolumeX, FiStar, FiTrendingUp, FiMaximize, FiMinimize, FiX
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
  const { getToken } = useAuth();
  const { user } = useUser();
  const containerRef = useRef(null);
  const chatEndRef = useRef(null);

  // ── Setup form state
  const [userName, setUserName] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // ─── Render: RESULTS ─────────────────────────────────────────────────────────
  if (screen === SCREEN.RESULTS && finalSession) {
    const { overallFeedback, questions, turns, userName: name, jobRole: role } = finalSession;
    // Best turn per question
    const bestTurnByQ = {};
    (turns || []).forEach((t) => {
      if (!bestTurnByQ[t.questionIndex] || t.score > bestTurnByQ[t.questionIndex].score) {
        bestTurnByQ[t.questionIndex] = t;
      }
    });

    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-10">
        <SEOHead title={`Live Interview Results — ${role}`} />

        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Interview Complete! 🎉</h1>
              <Badge variant={finalSession.difficulty === 'hard' ? 'error' : finalSession.difficulty === 'easy' ? 'success' : 'primary'} className="capitalize">
                {finalSession.difficulty || difficulty} Level
              </Badge>
            </div>
            <p className="text-text-muted mt-1">Role: <strong className="text-text-primary">{role}</strong> &bull; Candidate: {name}</p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>

        {/* Score overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 flex flex-col items-center justify-center p-8 text-center border-t-4 border-t-accent-primary bg-bg-surface border-border-subtle shadow-md shadow-accent-primary/5">
            <h3 className="text-lg font-medium text-text-secondary mb-4">Overall Score</h3>
            <div
              className="w-32 h-32 rounded-full border-8 flex items-center justify-center mb-4"
              style={{
                borderColor:
                  overallFeedback?.averageScore >= 70 ? '#10b981' :
                  overallFeedback?.averageScore >= 50 ? '#f59e0b' : '#ef4444',
              }}
            >
              <span className="text-4xl font-bold text-text-primary">{overallFeedback?.averageScore}%</span>
            </div>
            <p className="text-text-primary font-medium">
              {overallFeedback?.averageScore >= 70 ? '🌟 Excellent!' :
               overallFeedback?.averageScore >= 50 ? '👍 Good effort!' : '📚 Keep practicing!'}
            </p>
            <p className="text-xs text-text-secondary mt-2">{overallFeedback?.totalTurns} total attempts</p>
          </Card>

          <Card className="col-span-2 p-6 bg-bg-surface border-border-subtle shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-bold text-success mb-3 flex items-center gap-2">
                  <FiStar /> Key Strengths
                </h3>
                <ul className="space-y-2">
                  {overallFeedback?.strengths?.map((s, i) => (
                    <li key={i} className="flex items-start text-sm text-text-secondary">
                      <FiCheckCircle className="text-success mt-0.5 mr-2 flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-warning mb-3 flex items-center gap-2">
                  <FiTrendingUp /> Areas to Improve
                </h3>
                <ul className="space-y-2">
                  {overallFeedback?.weaknesses?.map((w, i) => (
                    <li key={i} className="flex items-start text-sm text-text-secondary">
                      <div className="w-1.5 h-1.5 rounded-full bg-warning mt-2 mr-2 flex-shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 bg-accent-primary/10 border-accent-glow/30 shadow-md">
          <h3 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
            <span className="text-xl">👩‍💼</span> Shristi's Recommendations
          </h3>
          <p className="text-text-secondary leading-relaxed">{overallFeedback?.recommendations}</p>
        </Card>

        {/* Detailed transcript */}
        <h3 className="text-2xl font-bold text-text-primary mt-10 mb-4">Full Interview Transcript</h3>
        <div className="space-y-6">
          {questions?.map((q, i) => {
            const best = bestTurnByQ[i];
            const allAttempts = (turns || []).filter((t) => t.questionIndex === i);
            if (!best) return null;
            return (
              <Card key={i} className="p-6 bg-bg-surface border-border-subtle shadow-sm">
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-border-subtle">
                  <h4 className="text-lg font-medium text-text-primary flex-1">
                    <span className="text-accent-primary font-bold mr-2">Q{i + 1}.</span>{q.question}
                  </h4>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <Badge variant="secondary">{q.category}</Badge>
                    {allAttempts.length > 1 && (
                      <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full border border-warning/20">
                        {allAttempts.length} attempts
                      </span>
                    )}
                  </div>
                </div>

                {allAttempts.map((turn, ti) => (
                  <div key={ti} className={`mb-3 p-4 rounded-xl border ${turn.isPassing ? 'bg-success/5 border-success/20' : 'bg-bg-canvas border-border-subtle'}`}>
                    {allAttempts.length > 1 && (
                      <span className="text-xs font-bold text-text-secondary uppercase mb-2 block tracking-wider">
                        Attempt {turn.attempt}
                      </span>
                    )}
                    <p className="text-sm text-text-primary italic">"{turn.userAnswer}"</p>
                  </div>
                ))}

                <div className="grid grid-cols-3 gap-3 my-4">
                  {[
                    { label: 'Score', val: `${best.score}/10` },
                    { label: 'Status', val: best.isPassing ? '✅ Passed' : '❌ Needs Work' },
                    { label: 'Action', val: best.action === 'next' ? '➡️ Next' : best.action === 'retry' ? '🔄 Retry' : '🔍 Follow-up' },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-bg-canvas p-3 rounded-xl text-center border border-border-subtle">
                      <span className="text-xs text-text-secondary uppercase tracking-wider block mb-1">{label}</span>
                      <span className={`font-bold text-sm ${getGradeColor((best.score || 0) * 10)}`}>{val}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-accent-primary/10 p-5 rounded-xl border border-accent-primary/20">
                  <span className="text-xs uppercase font-bold text-accent-primary mb-2 block tracking-wider">Shristi's Feedback:</span>
                  <p className="text-sm text-text-primary leading-relaxed">{best.feedback}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Render: MAIN APP CONTAINER (used for LOADING and INTERVIEW) ───────────────
  const renderAppContainer = (content) => (
    <div 
      ref={containerRef} 
      className={`bg-bg-canvas transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen overflow-hidden flex flex-col p-4 sm:p-6' : 'h-[calc(100vh-5rem)] overflow-hidden flex flex-col p-4 sm:p-6'}`}
    >
       <SEOHead title={`Live Interview — ${jobRole}`} />
       {content}
    </div>
  );

  // ─── Render: LOADING ─────────────────────────────────────────────────────────
  if (screen === SCREEN.LOADING) {
    return renderAppContainer(
      <div className="flex flex-col items-center justify-center h-full min-h-[500px]">
        <div className="w-64 h-64 mb-4">
          <Lottie animationData={interviewLoader} loop={true} />
        </div>
        <h2 className="text-xl font-bold text-text-primary animate-pulse">Shristi is preparing your interview...</h2>
        <p className="text-text-secondary mt-2 text-center max-w-md">
          Analysing the job description and generating tailored questions for <strong>{jobRole}</strong>.
        </p>
      </div>
    );
  }

  // ─── Render: INTERVIEW ────────────────────────────────────────────────────────
  if (screen === SCREEN.INTERVIEW && session) {
    const progress = Math.round((currentQIndex / session.totalQuestions) * 100);

    return renderAppContainer(
      <div className="flex flex-col h-full w-full max-w-6xl mx-auto">
        {/* Top bar */}
        <div className="mb-4 flex-shrink-0">
          <div className="flex justify-between items-center mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-text-primary">{session.jobRole} Interview</h2>
                <Badge variant={session.difficulty === 'hard' ? 'error' : session.difficulty === 'easy' ? 'success' : 'primary'} className="capitalize">
                  {session.difficulty || difficulty}
                </Badge>
              </div>
              <p className="text-xs text-text-muted">with {userName} &bull; {isSmallTalkPhase ? '🌸 Icebreaker Check-in' : `Question ${currentQIndex + 1} of ${session.totalQuestions}`}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                aria-label={isMuted ? 'Unmute Shristi' : 'Mute Shristi'}
                onClick={toggleMute}
                className="flex items-center justify-center text-text-muted hover:text-text-primary transition-colors bg-surface-hover border border-border rounded-lg p-2 cursor-pointer"
                title={isMuted ? 'Unmute Shristi' : 'Mute Shristi'}
              >
                {isMuted ? <FiVolumeX className="w-4 h-4" /> : <FiVolume2 className="w-4 h-4" />}
              </button>
              <button
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                onClick={toggleFullscreen}
                className="flex items-center justify-center text-text-muted hover:text-text-primary transition-colors bg-surface-hover border border-border rounded-lg p-2 hidden sm:flex cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? <FiMinimize className="w-4 h-4" /> : <FiMaximize className="w-4 h-4" />}
              </button>
              <button
                aria-label="Exit Interview"
                onClick={exitInterview}
                className="flex items-center justify-center text-error hover:bg-error/10 transition-colors bg-surface-hover border border-border rounded-lg p-2 ml-2 cursor-pointer"
                title="Exit Interview"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="w-full bg-surface-hover rounded-full h-2">
            <motion.div
              className="bg-accent-primary h-2 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Main interview area */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
          
          {/* Left - Avatars */}
          <div className="md:col-span-1 flex flex-row md:flex-col gap-4">
             <Card className="flex-1 flex items-center justify-center p-6 bg-bg-surface border-border-subtle shadow-md shadow-accent-primary/5 relative overflow-hidden">
               <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent-primary/10 to-transparent pointer-events-none" />
               <ShristiAvatar isSpeaking={isSpeaking} isThinking={isThinking} />
             </Card>
             <Card className="flex-1 flex items-center justify-center p-6 bg-bg-surface border-border-subtle shadow-md shadow-success/5 relative overflow-hidden">
               <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-success/10 to-transparent pointer-events-none" />
               <UserAvatar isSpeaking={isRecording} imageUrl={user?.imageUrl} name={userName} />
             </Card>
          </div>

          {/* Right - Chat & Controls */}
          <Card className="md:col-span-2 flex flex-col p-0 overflow-hidden bg-bg-canvas border-border-subtle">
             
             {/* WhatsApp Style Chat Area */}
             <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
                {isSmallTalkPhase && (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 text-xs text-accent-primary animate-fade-in shadow-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent-primary animate-ping" />
                      🌸 Warm Check-in with Shristi (Non-technical small talk to comfort you)
                    </span>
                    <button
                      type="button"
                      onClick={handleSkipIntro}
                      className="px-3 py-1 rounded-lg bg-accent-primary text-white font-semibold hover:bg-accent-glow transition-all cursor-pointer text-xs"
                    >
                      Skip to Question 1 &rarr;
                    </button>
                  </div>
                )}

                {isCalmingActive && (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 animate-fade-in shadow-sm">
                    <span className="flex items-center gap-2">
                      <span>🌱</span>
                      <span>Take a slow, deep breath — Shristi understands! There is zero rush, relax.</span>
                    </span>
                  </div>
                )}

                {chatHistory.map(msg => (
                   <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm border ${msg.sender === 'user' ? 'bg-accent-primary border-accent-glow text-white rounded-tr-none' : 'bg-bg-surface border-border-subtle text-text-primary rounded-tl-none'}`}>
                         <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                   </div>
                ))}
                
                {isThinking && (
                   <div className="flex justify-start">
                      <div className="bg-bg-surface border border-border-subtle p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                         <FiLoader className="animate-spin text-accent-primary" />
                         <span className="text-sm text-text-secondary italic">Shristi is evaluating your answer...</span>
                      </div>
                   </div>
                )}
                
                {isTranscribing && (
                   <div className="flex justify-end">
                      <div className="bg-accent-primary/80 border border-accent-glow/50 text-white p-4 rounded-2xl rounded-tr-none flex items-center gap-3 shadow-sm">
                         <FiLoader className="animate-spin" />
                         <span className="text-sm italic">Transcribing your speech...</span>
                      </div>
                   </div>
                )}
                <div ref={chatEndRef} />
             </div>

             {/* Controls */}
             <div className="p-4 sm:p-5 bg-bg-surface border-t border-border-subtle flex-shrink-0 flex flex-col items-center justify-center gap-3">
                {recorderError && (
                  <div className="flex items-center gap-2 text-xs text-danger bg-danger/10 px-3 py-1.5 rounded-lg mb-1">
                    <FiAlertCircle /> {recorderError}
                  </div>
                )}

                {isSpeaking && isSmallTalkPhase && (
                  <div className="flex items-center justify-between w-full max-w-lg px-3 py-1.5 rounded-xl bg-accent-primary/10 border border-accent-primary/20 text-xs text-accent-primary">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
                      🌸 Shristi is greeting you...
                    </span>
                    <button
                      type="button"
                      onClick={handleSkipIntro}
                      className="font-bold underline hover:text-accent-glow cursor-pointer text-xs"
                    >
                      Skip to Question 1 &rarr;
                    </button>
                  </div>
                )}

                {isTextMode ? (
                   <form onSubmit={handleSendTypedAnswer} className="w-full flex flex-col gap-2">
                     <div className="flex gap-2">
                       <textarea
                         value={typedAnswer}
                         onChange={(e) => setTypedAnswer(e.target.value)}
                         placeholder={
                           isRecording
                             ? '🎙️ Recording... click mic button to stop and transcribe'
                             : isTranscribing
                             ? '⏳ Transcribing your speech...'
                             : isSmallTalkPhase
                             ? 'Reply to Shristi (e.g., "Doing great, ready to get started!"), or click mic...'
                             : 'Type your answer here, or click mic to dictate...'
                         }
                         rows={2}
                         disabled={isSubmitting || isThinking || isTranscribing}
                         className="flex-1 px-4 py-2.5 rounded-xl border border-border-subtle bg-bg-canvas text-text-primary text-sm focus:border-accent-primary focus:outline-none resize-none"
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
                         className={`p-2.5 rounded-xl border border-border-subtle transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                           isRecording
                             ? 'bg-danger text-white animate-pulse'
                             : 'bg-bg-canvas hover:bg-bg-surface text-text-primary'
                         }`}
                         title={isRecording ? 'Stop recording & transcribe' : 'Dictate answer with microphone'}
                       >
                         {isRecording ? <FiStopCircle className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
                       </button>
                       <button
                         type="submit"
                         disabled={isSubmitting || isThinking || !typedAnswer.trim() || isRecording || isTranscribing}
                         className="bg-accent-primary text-white px-5 rounded-xl font-bold hover:bg-accent-glow transition-all disabled:opacity-50 cursor-pointer text-sm shrink-0 flex items-center justify-center"
                       >
                         {isSubmitting ? <FiLoader className="animate-spin" /> : isSmallTalkPhase ? 'Reply' : 'Send'}
                       </button>
                     </div>
                     <div className="flex justify-between items-center text-xs text-text-muted">
                       {isSmallTalkPhase ? (
                         <button
                           type="button"
                           onClick={handleSkipIntro}
                           className="text-accent-primary hover:underline cursor-pointer font-medium"
                         >
                           Skip to Question 1 &rarr;
                         </button>
                       ) : (
                         <button
                           type="button"
                           onClick={handleAskHintOrCalm}
                           disabled={isSubmitting || isThinking}
                           className="text-emerald-500 hover:text-emerald-400 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                         >
                           🌱 Feeling nervous or blanking out? Ask Shristi for a hint
                         </button>
                       )}
                       <button
                         type="button"
                         onClick={() => setIsTextMode(false)}
                         className="text-accent-primary hover:underline cursor-pointer font-medium"
                       >
                         Switch to Voice Mode 🎙️
                       </button>
                     </div>
                   </form>
                ) : (
                   <div className="flex flex-col items-center gap-2.5 w-full">
                     {isRecording ? (
                        <button 
                          type="button"
                          onClick={toggleRecording} 
                          className="flex items-center gap-2 bg-danger text-white px-8 py-3.5 rounded-full font-bold hover:bg-danger/90 transition-all animate-pulse shadow-lg shadow-danger/30 cursor-pointer"
                        >
                           <FiStopCircle className="w-5 h-5" /> {isSmallTalkPhase ? "Stop & Send Reply" : "Stop & Submit Answer"}
                        </button>
                     ) : (
                        <button 
                          type="button"
                          onClick={toggleRecording} 
                          disabled={isSpeaking || isSubmitting || isTranscribing} 
                          className="flex items-center gap-2 bg-accent-primary text-white px-8 py-3.5 rounded-full font-bold hover:bg-accent-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-accent-primary/20 cursor-pointer"
                        >
                           <FiMic className="w-5 h-5" /> {isSpeaking ? (isSmallTalkPhase ? "Listening to Shristi..." : "Wait for Shristi...") : (isSmallTalkPhase ? "Tap to Reply to Shristi" : "Tap to Answer")}
                        </button>
                     )}
                     <div className="flex items-center justify-between w-full max-w-lg px-2 text-xs text-text-muted">
                       {isSmallTalkPhase ? (
                         <>
                           <span className="text-text-muted">🌸 Zero stress: friendly warm-up with Shristi</span>
                           <div className="flex items-center gap-3">
                             <button
                               type="button"
                               onClick={handleSkipIntro}
                               className="text-accent-primary hover:underline font-semibold cursor-pointer"
                             >
                               Skip to Q1 &rarr;
                             </button>
                             <button
                               type="button"
                               onClick={() => setIsTextMode(true)}
                               className="text-accent-primary hover:underline font-semibold cursor-pointer shrink-0"
                             >
                               Type Instead
                             </button>
                           </div>
                         </>
                       ) : (
                         <>
                           <button
                             type="button"
                             onClick={handleAskHintOrCalm}
                             disabled={isSpeaking || isSubmitting || isThinking}
                             className="text-emerald-500 hover:text-emerald-400 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                           >
                             🌱 Feeling nervous or stuck? Ask for a hint
                           </button>
                           <button
                             type="button"
                             onClick={() => setIsTextMode(true)}
                             className="text-accent-primary hover:underline font-semibold cursor-pointer ml-3 shrink-0"
                           >
                             Type Answer Instead
                           </button>
                         </>
                       )}
                     </div>
                   </div>
                )}
             </div>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Render: SETUP ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-8rem)]">
      <SEOHead title="Live AI Interview with Shristi" />

      {/* Left — form */}
      <div className="w-full lg:w-5/12 flex flex-col space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Live AI Interview</h1>
          <p className="text-text-secondary mt-1">
            Practice with <strong>Shristi</strong>, your AI interviewer. She'll ask questions based on your
            actual job description, evaluate your answers in real-time, and guide you to improve.
          </p>
        </div>

        <Card>
          <form onSubmit={handleStart} className="space-y-5">
            <Input
              id="userName"
              label="Your Name"
              placeholder="e.g., Rahul Sharma"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
            <Input
              id="jobRole"
              label="Target Role"
              placeholder="e.g., Frontend Engineer"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary" htmlFor="jobDescription">
                Job Description <span className="text-error">*</span>
              </label>
              <textarea
                id="jobDescription"
                rows={5}
                placeholder="Paste the full job description here. Shristi will tailor questions based on it..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-border-subtle bg-bg-surface text-text-primary placeholder-text-secondary resize-none transition-all duration-200 outline-none text-sm focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20"
              />
            </div>
            {/* Difficulty Level Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-primary">
                Difficulty Level <span className="text-danger">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'easy', label: 'Easy', tag: 'Concepts', color: 'border-success/40 bg-success/10 text-success' },
                  { id: 'medium', label: 'Medium', tag: 'Practical', color: 'border-accent-primary bg-accent-primary/10 text-accent-primary' },
                  { id: 'hard', label: 'Hard', tag: 'Advanced', color: 'border-danger/40 bg-danger/10 text-danger' },
                ].map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`cursor-pointer text-center p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${
                      difficulty === d.id
                        ? `${d.color} font-bold shadow-sm ring-1`
                        : 'border-border-subtle bg-bg-canvas text-text-secondary hover:border-text-secondary/50'
                    }`}
                  >
                    <span className="capitalize text-sm font-bold">{d.label}</span>
                    <span className="text-[10px] opacity-80 mt-0.5">{d.tag}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-primary">
                Number of Questions <span className="text-danger">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {MOCK_QUESTION_COUNTS.map((opt) => (
                  <div
                    key={opt}
                    onClick={() => setTotalQuestions(opt)}
                    className={`cursor-pointer text-center py-3 rounded-xl border-2 transition-all ${
                      totalQuestions === opt
                        ? 'border-accent-primary bg-accent-primary/10 text-accent-primary font-bold'
                        : 'border-border-subtle bg-bg-canvas text-text-secondary hover:border-text-secondary/50'
                    }`}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            </div>
            
            <button
              type="submit"
              disabled={!userName || !jobRole || !jobDescription}
              className="w-full bg-accent-primary text-white px-4 py-3 rounded-xl font-bold hover:bg-accent-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-4 shadow-md shadow-accent-primary/20"
            >
              Start Interview with Shristi <FiArrowRight />
            </button>
          </form>
        </Card>
      </div>

      {/* Right — about Shristi */}
      <div className="w-full lg:w-7/12 flex flex-col gap-6">
        {/* Shristi intro card */}
        <Card className="p-8 bg-bg-surface border-border-subtle shadow-lg shadow-accent-primary/5 relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent-primary/10 via-transparent to-transparent pointer-events-none blur-3xl" />
          
          <div className="flex items-center gap-5 mb-6 relative z-10">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-lg border-2 border-border-subtle"
              style={{ background: 'linear-gradient(135deg, #1C1D21 0%, #26272B 100%)' }}>
              👩‍💼
            </div>
            <div>
              <h2 className="text-2xl font-bold text-text-primary">Meet Shristi</h2>
              <p className="text-text-secondary">Your AI Interviewer</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="success">Live Voice</Badge>
                <Badge variant="secondary">JD-Aware</Badge>
                <Badge variant="info">Adaptive AI</Badge>
              </div>
            </div>
          </div>
          <p className="text-text-secondary leading-relaxed">
            Shristi is a professional AI interviewer trained to conduct realistic interviews. She adapts to your
            answers — if you need more guidance, she'll give you a hint; if you nail it, she'll move on. She speaks
            using natural voice, making it feel like a real interview.
          </p>
        </Card>

        <Card className="p-6 bg-bg-surface border-border-subtle">
          <h3 className="font-bold text-text-primary mb-4">How it works</h3>
          <div className="space-y-4">
            {[
              { icon: FiFileText, step: '1', title: 'Paste your Job Description', desc: 'Shristi reads the JD and generates role-specific questions tailored to the exact skills required.' },
              { icon: FiMic, step: '2', title: 'Answer by voice automatically', desc: 'Use the microphone for a realistic feel. Gemini AI transcribes your speech accurately when you finish.' },
              { icon: FiBriefcase, step: '3', title: 'Shristi evaluates live', desc: 'She evaluates your answer, gives feedback, and either asks a follow-up or moves to the next question.' },
              { icon: FiStar, step: '4', title: 'Get a full performance report', desc: 'After the interview, see your score per question, strengths, areas to improve, and Shristi\'s final recommendation.' },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-accent-primary/10 flex items-center justify-center text-accent-primary font-bold text-sm flex-shrink-0">
                  {step}
                </div>
                <div>
                  <p className="font-medium text-text-primary text-sm">{title}</p>
                  <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LiveInterview;
