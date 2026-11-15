import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiMic, FiStopCircle, FiArrowRight, FiAlertCircle,
  FiLoader, FiCheckCircle, FiUser, FiFileText, FiBriefcase,
  FiVolume2, FiVolumeX, FiStar, FiTrendingUp, FiMaximize, FiMinimize, FiX,
  FiClock, FiPlay, FiRefreshCw, FiMessageSquare, FiUpload, FiHelpCircle,
  FiTarget, FiAward
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
import { evalixV1 } from '../api/evalixV1';
import { MOCK_QUESTION_COUNTS } from '../utils/constants';
import { getGradeColor } from '../utils/helpers';

// Build a minimal text PDF from pasted text (server accepts only PDF/DOCX uploads).
const textToPdfFile = (text, name = 'job-description.pdf') => {
  const clean = text.replace(/[^\x20-\x7E\n]/g, '?').replace(/\r/g, '');
  const lines = [];
  clean.split('\n').forEach((para) => {
    let line = '';
    para.split(/\s+/).forEach((w) => {
      if ((line + ' ' + w).trim().length > 90) { lines.push(line); line = w; }
      else line = (line + ' ' + w).trim();
    });
    lines.push(line);
  });
  const perPage = 50;
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (!pages.length) pages.push(['']);
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((pl, i) => {
    const stream = `BT /F1 11 Tf 14 TL 50 750 Td ${pl.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`;
    objs[4 + i * 2] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new File([pdf], name, { type: 'application/pdf' });
};

const pollUntil = async (fn, isDone, { intervalMs = 1500, timeoutMs = 90000 } = {}) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const res = await fn();
    if (isDone(res)) return res;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Operation timed out while waiting for pipeline step.');
};

// ─── Shristi Hybrid TTS Hook (Gemini Audio + Browser Web Speech API fallback) ─
const splitSpeechChunks = (text, maxLen = 180) => {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
  const chunks = [];
  let current = '';

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    if ((current + ' ' + sentence).trim().length <= maxLen) {
      current = current ? `${current} ${sentence}` : sentence;
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxLen) {
        current = sentence;
      } else {
        // Split very long sentence by commas/clauses
        const parts = sentence.split(/(?<=[,;:])\s+/);
        let sub = '';
        for (const part of parts) {
          if ((sub + ' ' + part).trim().length <= maxLen) {
            sub = sub ? `${sub} ${part}` : part;
          } else {
            if (sub) chunks.push(sub);
            sub = part;
          }
        }
        current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
};

const useShristi = ({ getToken }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const utteranceRef = useRef(null);
  const abortControllerRef = useRef(null);
  const safetyTimerRef = useRef(null);
  const resumeIntervalRef = useRef(null);
  const callIdRef = useRef(0);
  const voicesRef = useRef([]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

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

  // Browser Web Speech API fallback with natural English female voice (chunked to prevent mid-speech cutoff)
  const speakWithBrowserSpeech = useCallback((rawText, onEnd, expectedCallId) => {
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

      let voices = window.speechSynthesis.getVoices() || [];
      if (voices.length === 0 && voicesRef.current.length > 0) {
        voices = voicesRef.current;
      }

      const selectFemaleVoice = (vList) => {
        if (!vList || vList.length === 0) return null;
        const indianFemale =
          vList.find((v) =>
            /Neerja|Heera|Veena|Lekha|Swara|Aditi|Raveena|Kavya|Pooja|Geeta|Ananya|Google English \(India\)|Google हिन्दी/i.test(v.name || '')
          ) ||
          vList.find((v) =>
            (v.lang === 'en-IN' || v.lang === 'hi-IN' || v.lang === 'en_IN') &&
            !/male|david|alex|george|ravi|kumar|prabhat/i.test(v.name || '')
          );
        if (indianFemale) return indianFemale;

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
      const chunks = splitSpeechChunks(cleanText, 180);
      let chunkIdx = 0;
      let finishedAll = false;

      const finishAll = () => {
        if (finishedAll) return;
        finishedAll = true;
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
        if (expectedCallId === undefined || callIdRef.current === expectedCallId) {
          onEnd?.();
        }
      };

      setIsSpeaking(true);

      // Gentle keepalive: only resume if Chrome paused synthesis (never call pause() mid-speech!)
      if (resumeIntervalRef.current) clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = setInterval(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis?.paused) {
          try {
            window.speechSynthesis.resume();
          } catch (e) { /* ignore */ }
        }
      }, 2000);

      const speakNextChunk = () => {
        if (finishedAll) return;
        if (expectedCallId !== undefined && callIdRef.current !== expectedCallId) {
          finishedAll = true;
          setIsSpeaking(false);
          return;
        }
        if (chunkIdx >= chunks.length) {
          finishAll();
          return;
        }

        const chunkText = chunks[chunkIdx++];
        const utterance = new SpeechSynthesisUtterance(chunkText);
        utteranceRef.current = utterance;

        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }
        utterance.rate = 0.96;
        utterance.pitch = 1.03;

        let chunkDone = false;
        const onChunkDone = () => {
          if (chunkDone) return;
          chunkDone = true;
          if (safetyTimerRef.current) {
            clearTimeout(safetyTimerRef.current);
            safetyTimerRef.current = null;
          }
          speakNextChunk();
        };

        utterance.onend = onChunkDone;
        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis chunk error:', e);
          onChunkDone();
        };

        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        } catch (e) { /* ignore */ }

        window.speechSynthesis.speak(utterance);

        // Generous per-chunk safety timeout so long utterances never stall or get cut short
        const maxChunkSeconds = Math.max(12, chunkText.length / 5 + 6);
        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = setTimeout(() => {
          if (!chunkDone) {
            onChunkDone();
          }
        }, maxChunkSeconds * 1000);
      };

      speakNextChunk();
    } catch (e) {
      console.warn('Browser speech synthesis failed:', e);
      setIsSpeaking(false);
      onEnd?.();
    }
  }, []);

  const speak = useCallback(
    async (text, onEnd) => {
      if (isMutedRef.current) {
        onEnd?.();
        return;
      }

      stopSpeaking();
      const currentCallId = ++callIdRef.current;

      // Hybrid pipeline: Attempt external backend audio generation with timeout fallback
      try {
        const token = await getToken();
        const geminiKey = localStorage.getItem('custom_gemini_key');
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        if (geminiKey) headers['x-gemini-api-key'] = geminiKey;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        // 12s timeout for TTS request so the interview flow is never stalled
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 12000);

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
          if (callIdRef.current === currentCallId) {
            onEnd?.();
          }
        };

        source.start(0);
      } catch (err) {
        if (callIdRef.current !== currentCallId) return;
        // Fall back seamlessly to browser Web Speech API — NEVER show error toasts or block interview
        speakWithBrowserSpeech(text, onEnd, currentCallId);
      }
    },
    [getToken, stopSpeaking, speakWithBrowserSpeech]
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

  // ── Modules 1–8 Pipeline & Practice State
  const [resumeFile, setResumeFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [practiceMode, setPracticeMode] = useState('REALISTIC_MOCK');
  const [focusCompetency, setFocusCompetency] = useState('');
  const [pipelineStatus, setPipelineStatus] = useState('');
  const [recentIntakes, setRecentIntakes] = useState([]);
  const [v1Profile, setV1Profile] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [hints, setHints] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [evaluationReport, setEvaluationReport] = useState(null);
  const [learningInsights, setLearningInsights] = useState(null);
  const [developmentPlan, setDevelopmentPlan] = useState(null);
  const [practiceHistory, setPracticeHistory] = useState(null);

  useEffect(() => {
    const loadV1Context = async () => {
      try {
        const [profRes, intakesRes] = await Promise.allSettled([
          evalixV1.getProfile(),
          evalixV1.listIntakes(),
        ]);
        if (profRes.status === 'fulfilled') setV1Profile(profRes.value);
        if (intakesRes.status === 'fulfilled') {
          const list = Array.isArray(intakesRes.value)
            ? intakesRes.value
            : intakesRes.value?.intakes || [];
          setRecentIntakes(list);
        }
      } catch (_) {
        // Non-blocking initial fetch
      }
    };
    void loadV1Context();
  }, []);

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

  const isMutedLiveRef = useRef(isMuted);
  const isTextModeLiveRef = useRef(isTextMode);
  const smallTalkStartedRef = useRef(false);
  const introTimeoutRef = useRef(null);
  const introFinishedRef = useRef(false);

  useEffect(() => {
    isMutedLiveRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isTextModeLiveRef.current = isTextMode;
  }, [isTextMode]);

  // ── Voice recording
  const handleTranscriptCompleteRef = useRef(null);
  const { isRecording, isTranscribing, error: recorderError, toggleRecording, startRecording } = useVoiceRecorder({
    onTranscriptComplete: (t) => handleTranscriptCompleteRef.current?.(t),
    getToken,
  });

  // ── Single-fire Shristi message delivery (prevents duplicate/hallucinated repeats)
  const deliverShristiMessage = useCallback((text, { messageId = null, onSpoken = null, autoMic = true } = {}) => {
    if (!text) return;
    const id = messageId || `shristi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setShristiMessage(text);
    setChatHistory((prev) => {
      if (messageId && prev.some((m) => m.id === messageId)) return prev;
      const last = prev[prev.length - 1];
      if (last && last.sender === 'shristi' && last.text === text) return prev;
      return [...prev, { id, sender: 'shristi', text }];
    });

    speak(text, () => {
      setShristiHasSpoken(true);
      if (onSpoken) {
        onSpoken();
      } else if (autoMic && !isMutedLiveRef.current && !isTextModeLiveRef.current) {
        startRecording();
      }
    });
  }, [speak, startRecording]);

  // ── Handle Auto-Submit (Modules 5 & 8 /api/v1/sessions)
  const handleSubmitAnswer = async (answerText) => {
    if (!answerText || answerText.trim().length < 2) {
      toast.error('Answer too short. Please try again.');
      return;
    }
    if (!session?.sessionId) return;

    stopSpeaking();
    setIsSubmitting(true);
    setIsThinking(true);
    setShristiHasSpoken(false);
    const idempotencyKey = `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      if (session.practiceMode === 'GUIDED_PRACTICE') {
        const res = await evalixV1.submitPracticeAttempt(session.sessionId, {
          idempotencyKey,
          answerText: answerText.trim(),
          questionId: session.currentQuestionId,
        });
        setIsThinking(false);
        if (res.ignored) {
          toast('Partial speech ignored; please complete your answer.');
          return;
        }
        setAttempts((prev) => [...prev, res.attempt]);
        setTypedAnswer('');
        const coachingReply =
          res.attempt?.coachingFeedback?.summary ||
          res.attempt?.coachingFeedback?.encouragement ||
          `Attempt #${res.attempt?.attemptNumber || 1} recorded. You can retry with improvements or continue to the next question.`;
        deliverShristiMessage(coachingReply, { autoMic: false });
      } else {
        const res = await evalixV1.submitTurn(session.sessionId, {
          idempotencyKey,
          transcriptText: answerText.trim(),
          transcriptStatus: 'FINAL',
        });
        setIsThinking(false);
        setSession(res.session);
        setTypedAnswer('');
        if (typeof res.session?.currentQuestionIndex === 'number') {
          setCurrentQIndex(res.session.currentQuestionIndex);
        }
        const replyText = res.aiTurn?.spokenText || res.session?.activePrompt?.text;
        if (res.session?.status === 'COMPLETED') {
          if (replyText) {
            deliverShristiMessage(replyText, {
              autoMic: false,
              onSpoken: async () => {
                await handleComplete(res.session.sessionId);
              },
            });
          } else {
            await handleComplete(res.session.sessionId);
          }
        } else if (replyText) {
          deliverShristiMessage(replyText);
        }
      }
    } catch (err) {
      setIsThinking(false);
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to evaluate answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    handleTranscriptCompleteRef.current = async (t) => {
      if (isTextMode) {
        setTypedAnswer((prev) => (prev ? `${prev.trimEnd()} ${t}` : t));
        toast.success('Speech transcribed to answer field! Review and press Send.');
      } else {
        setTypedAnswer(t);
        setChatHistory(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: t }]);
        await handleSubmitAnswer(t);
      }
    };
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
    const q1Text = firstQ.question;

    deliverShristiMessage(q1Text, { messageId: 'q-0' });
  }, [session, deliverShristiMessage]);

  // ── Skip Intro / Small Talk action
  const handleSkipIntro = useCallback(() => {
    stopSpeaking();
    setIsSmallTalkPhase(false);
    setIsIntroPhase(false);
    presentFirstQuestion(session);
  }, [stopSpeaking, presentFirstQuestion, session]);

  // ── Guided Practice: Progressive Hint / Retry / Continue
  const handleAskHintOrCalm = async () => {
    if (isSubmitting || isThinking || !session?.sessionId) return;
    if (session.practiceMode === 'GUIDED_PRACTICE') {
      setIsSubmitting(true);
      try {
        const res = await evalixV1.requestHint(session.sessionId, {
          questionId: session.currentQuestionId,
          idempotencyKey: `hint_${session.currentQuestionId}_${hints.length + 1}_${Date.now()}`,
        });
        setHints((prev) => [...prev, res.hint]);
        const hintLabel = `Level ${res.hint.hintLevel} Hint (${res.hint.hintType}): ${res.hint.hintText}`;
        deliverShristiMessage(hintLabel, { autoMic: false });
      } catch (err) {
        toast.error(err.response?.data?.message || 'No more hints available for this question.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    setIsCalmingActive(true);
    setTimeout(() => setIsCalmingActive(false), 9000);
    deliverShristiMessage(
      'Take a slow breath — there is zero rush. Break your answer into what you built, why you chose that approach, and the trade-offs.',
      { autoMic: false }
    );
  };

  const handleRetryV1 = async () => {
    if (!session?.sessionId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await evalixV1.prepareRetry(session.sessionId, session.currentQuestionId);
      setAttempt(res.nextAttemptNumber || attempt + 1);
      toast.success(`Ready for Attempt #${res.nextAttemptNumber}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot retry this question');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueV1 = async () => {
    if (!session?.sessionId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await evalixV1.continuePracticeQuestion(
        session.sessionId,
        `cont_${session.currentQuestionId}_${Date.now()}`
      );
      setSession(res.session);
      setHints([]);
      setAttempts([]);
      setAttempt(1);
      if (typeof res.session?.currentQuestionIndex === 'number') {
        setCurrentQIndex(res.session.currentQuestionIndex);
      }
      if (res.completed || res.session?.status === 'COMPLETED') {
        await handleComplete(res.session.sessionId);
      } else if (res.nextQuestion?.prompt || res.session?.activePrompt?.text) {
        deliverShristiMessage(res.nextQuestion?.prompt || res.session.activePrompt.text);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot continue yet');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step 1: Shristi Opening Prompt Delivery (runs once per session)
  useEffect(() => {
    if (screen === SCREEN.INTERVIEW && session && !smallTalkStartedRef.current) {
      smallTalkStartedRef.current = true;
      introFinishedRef.current = true;
      setIsSmallTalkPhase(false);
      setIsIntroPhase(false);

      const openingText =
        session.openingPromptText ||
        session.activePrompt?.text ||
        `Hi ${userName}! Let's begin your ${jobRole} interview.`;

      deliverShristiMessage(openingText, {
        messageId: `opening-${session.sessionId || 'v1'}`,
      });
    }
  }, [screen, session, userName, jobRole, deliverShristiMessage]);

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

  const ensureV1Profile = async (seniorityLevel, totalExperienceMonths) => {
    if (v1Profile) return v1Profile;
    try {
      const existing = await evalixV1.getProfile();
      setV1Profile(existing);
      return existing;
    } catch (_) {
      const created = await evalixV1.createProfile({
        fullName: userName || user?.fullName || 'Evalix Student',
        email: user?.primaryEmailAddress?.emailAddress || 'student@evalix.dev',
        currentJobTitle: jobRole || 'Software Engineer',
        experienceLevel: seniorityLevel,
        totalExperienceMonths,
      });
      setV1Profile(created);
      return created;
    }
  };

  const launchV1Session = async (targetIntakeId, bp) => {
    let competencyId;
    if (practiceMode === 'FOCUSED_SKILL_PRACTICE') {
      const plan = bp?.competencyPlan || [];
      const needle = focusCompetency.trim().toLowerCase();
      const matched = needle
        ? plan.find((c) => `${c.name || ''} ${c.competencyId || ''}`.toLowerCase().includes(needle))
        : null;
      competencyId = matched?.competencyId || plan[0]?.competencyId;
    }

    setPipelineStatus('Module 5/8: Starting live interview session...');
    const created = await evalixV1.createSession(targetIntakeId, {
      practiceMode,
      ...(practiceMode === 'FOCUSED_SKILL_PRACTICE' && competencyId
        ? { competencyId, maxQuestions: Number(totalQuestions) || 3 }
        : {}),
    });
    const started = await evalixV1.startSession(created.sessionId, true);
    const activeSession = {
      ...started.session,
      openingPromptText: started.openingTurn?.spokenText || started.session?.activePrompt?.text,
    };

    smallTalkStartedRef.current = false;
    introFinishedRef.current = false;
    setSession(activeSession);
    setFinalSession(null);
    setEvaluationReport(null);
    setLearningInsights(null);
    setDevelopmentPlan(null);
    setHints([]);
    setAttempts([]);
    setIsSmallTalkPhase(false);
    setIsIntroPhase(false);
    setIsCalmingActive(false);
    setChatHistory([]);
    setCurrentQIndex(activeSession.currentQuestionIndex || 0);
    setAttempt(1);
    setPreviousAnswer(null);
    setShristiMessage('');
    setScreen(SCREEN.INTERVIEW);
  };

  // ─── Start interview (Modules 1–4 Pipeline -> Module 5/8 Session)
  const handleStart = async (e) => {
    e.preventDefault();
    if (!userName || !jobRole) {
      toast.error('Please enter your name and target role.');
      return;
    }
    if (!resumeFile) {
      toast.error('Please upload your Resume (PDF or DOCX) in the Resume placeholder.');
      return;
    }
    if (!jdFile && !jobDescription.trim()) {
      toast.error('Please paste a Job Description or upload a JD file.');
      return;
    }

    // Request Microphone permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      toast.error('Microphone permission recommended for voice mode. You can also type answers.');
    }

    if (containerRef.current && !document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    }

    const seniorityMap = {
      easy: { seniorityLevel: 'JUNIOR', months: 6 },
      medium: { seniorityLevel: 'MID', months: 24 },
      hard: { seniorityLevel: 'SENIOR', months: 60 },
    };
    const { seniorityLevel, months } = seniorityMap[difficulty] || seniorityMap.medium;

    setScreen(SCREEN.LOADING);
    try {
      setPipelineStatus('Module 1: Creating candidate profile & interview intake...');
      await ensureV1Profile(seniorityLevel, months);

      const intake = await evalixV1.createIntake({
        targetJob: {
          role: jobRole.trim(),
          jobDescription: jobDescription.trim(),
        },
        interviewPreferences: {
          interviewType: 'MIXED',
          durationMinutes: Math.min(120, Math.max(15, Number(totalQuestions) * 5 || 25)),
          difficulty: String(difficulty || 'medium').toUpperCase(),
        },
      });
      const intakeId = intake.intakeId || intake._id || intake.id;

      setPipelineStatus('Module 1: Uploading Resume & Job Description...');
      await evalixV1.uploadResume(intakeId, resumeFile);
      if (jdFile) {
        await evalixV1.uploadJobDescription(intakeId, jdFile);
      }
      await evalixV1.submitIntake(intakeId);

      setPipelineStatus('Module 2: Extracting structured Resume & JD intelligence...');
      await pollUntil(
        () => evalixV1.getExtractionStatus(intakeId),
        (s) => {
          if (
            ['FAILED', 'NEEDS_REVIEW'].includes(s?.status) ||
            ['BLOCKED_SECURITY_SCAN', 'REJECTED', 'NEEDS_OCR'].includes(s?.resume?.status) ||
            ['BLOCKED_SECURITY_SCAN', 'REJECTED', 'NEEDS_OCR'].includes(s?.jobDescription?.status)
          ) {
            throw new Error(
              s?.resume?.lastErrorCode || s?.jobDescription?.lastErrorCode || 'Document extraction failed.'
            );
          }
          return ['COMPLETED', 'COMPLETED_WITH_WARNINGS'].includes(s?.status);
        }
      );

      setPipelineStatus('Module 3: Analyzing candidate fit & competency gaps...');
      await evalixV1.analyzeCandidateIntelligence(intakeId);
      await pollUntil(
        () => evalixV1.getAnalysisStatus(intakeId),
        (s) => {
          if (s?.status === 'FAILED') throw new Error(s?.error || 'Candidate analysis failed.');
          return ['AWAITING_CANDIDATE_REVIEW', 'READY_FOR_INTERVIEW_PLANNING', 'NEEDS_REVIEW', 'PARTIALLY_COMPLETED'].includes(s?.status);
        }
      );
      // Skip manual claim review: accept extracted profile as-is so the blueprint can be planned.
      await evalixV1.completeCandidateReview(intakeId);

      setPipelineStatus('Module 4: Generating & locking interview blueprint...');
      await evalixV1.generateBlueprint(intakeId, {
        targetQuestionCount: Number(totalQuestions) || 5,
      });
      await pollUntil(
        () => evalixV1.getBlueprintStatus(intakeId),
        (s) => {
          if (s?.status === 'FAILED') throw new Error(s?.error || 'Blueprint generation failed.');
          return ['READY', 'NEEDS_REVIEW'].includes(s?.status);
        }
      );

      const bp = await evalixV1.getCurrentBlueprint(intakeId);
      setBlueprint(bp);
      await launchV1Session(intakeId, bp);
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to start interview.');
      setScreen(SCREEN.SETUP);
    }
  };

  const handleResumeExistingIntake = async (existingIntakeId) => {
    if (containerRef.current && !document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
    setScreen(SCREEN.LOADING);
    try {
      setPipelineStatus('Loading existing blueprint & starting live session...');
      const bp = await evalixV1.getCurrentBlueprint(existingIntakeId);
      setBlueprint(bp);
      await launchV1Session(existingIntakeId, bp);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Blueprint is not ready for this intake yet.');
      setScreen(SCREEN.SETUP);
    }
  };

  // ─── Complete interview (Module 6 Evaluation + Module 7 Coaching & Plan)
  const handleComplete = async (overrideSessionId = null) => {
    const targetSessionId = typeof overrideSessionId === 'string' ? overrideSessionId : session?.sessionId;
    if (!targetSessionId) {
      setScreen(SCREEN.RESULTS);
      return;
    }

    stopSpeaking();
    setPipelineStatus('Module 6: Running evidence-based evaluation & report...');
    setScreen(SCREEN.LOADING);

    try {
      if (session?.status !== 'COMPLETED') {
        await evalixV1.endSession(targetSessionId).catch(() => null);
      }

      await evalixV1.requestEvaluation(targetSessionId);
      await pollUntil(
        () => evalixV1.getEvaluationStatus(targetSessionId),
        (s) =>
          ['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'INSUFFICIENT_COVERAGE', 'NEEDS_REVIEW'].includes(
            s?.status
          )
      );
      const report = await evalixV1.getEvaluationReport(targetSessionId);
      setEvaluationReport(report);
      setFinalSession({ ...session, sessionId: targetSessionId });

      setPipelineStatus('Module 7: Generating student coaching & development plan...');
      const [insRes, planRes, histRes] = await Promise.allSettled([
        evalixV1.generateLearningInsights(targetSessionId).then(() =>
          evalixV1.getLearningInsights(targetSessionId)
        ),
        evalixV1.generateDevelopmentPlan(targetSessionId).then(() =>
          evalixV1.getDevelopmentPlan(targetSessionId)
        ),
        evalixV1.getMyPracticeHistory(),
      ]);

      if (insRes.status === 'fulfilled') setLearningInsights(insRes.value);
      if (planRes.status === 'fulfilled') setDevelopmentPlan(planRes.value);
      if (histRes.status === 'fulfilled') setPracticeHistory(histRes.value);

      const finalMsg = `Thank you ${userName}! Your evidence-based evaluation report and coaching plan are ready.`;
      setShristiMessage(finalMsg);
      speak(finalMsg, () => {
        if (document.fullscreenElement) document.exitFullscreen();
        setScreen(SCREEN.RESULTS);
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to finalize evaluation.');
      if (document.fullscreenElement) document.exitFullscreen();
      setScreen(SCREEN.RESULTS);
    }
  };

  const handleToggleObjective = async (objective) => {
    if (!developmentPlan?._id && !developmentPlan?.id) return;
    const planId = developmentPlan._id || developmentPlan.id;
    const objId = objective.objectiveId || objective._id;
    const nextStatus = objective.status === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED';
    try {
      const updated = await evalixV1.updateObjectiveProgress(planId, objId, { status: nextStatus });
      setDevelopmentPlan(updated);
      toast.success(`Objective marked ${nextStatus}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update objective');
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

  // ─── Render: RESULTS (Modules 6 & 7 Editorial Scorecard + Coaching Plan) ───────
  if (screen === SCREEN.RESULTS && (evaluationReport || finalSession)) {
    const overallScore = Math.round(
      evaluationReport?.overallScore ??
        evaluationReport?.overallReadinessScore ??
        evaluationReport?.summary?.overallScore ??
        0
    );
    const evalStatus = evaluationReport?.status || 'COMPLETED';
    const strengths =
      learningInsights?.strengths ||
      evaluationReport?.strengths ||
      evaluationReport?.summary?.strengths ||
      [];
    const improvements =
      learningInsights?.areasForImprovement ||
      learningInsights?.weaknesses ||
      evaluationReport?.weaknesses ||
      evaluationReport?.summary?.improvements ||
      [];
    const competencyScores = evaluationReport?.competencyEvaluations || evaluationReport?.competencies || [];
    const objectives = developmentPlan?.objectives || [];
    const historyItems = Array.isArray(practiceHistory)
      ? practiceHistory
      : practiceHistory?.attempts || practiceHistory?.history || [];

    const verdictLabel =
      overallScore >= 80
        ? 'Strong Readiness'
        : overallScore >= 60
        ? 'Interview Ready — Polish Gaps'
        : 'Keep Practicing in Arena';

    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-fade-in">
        <SEOHead title={`Live Interview Scorecard — ${jobRole}`} />

        {/* Top Scorecard Banner */}
        <div className="rounded-[24px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 rounded-[8px] bg-[#282828] text-[#C7F36B] font-mono text-xs uppercase font-bold">
                  MODULE 6 EVALUATION REPORT
                </span>
                <span className="px-3 py-1 rounded-[8px] bg-[#FF6B35]/20 text-[#FF6B35] font-mono text-xs uppercase font-semibold">
                  {session?.practiceMode || practiceMode}
                </span>
                <span className="text-xs font-mono text-[#B5AFA6]">
                  • {evalStatus}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">
                {jobRole || 'Live Interview'} — Evaluation &amp; Coaching
              </h1>

              <p className="text-sm sm:text-base text-[#B5AFA6]">
                Candidate: <strong className="text-white">{userName || 'Student'}</strong> • Evidence-based rubric evaluation with Module 7 coaching insights.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon={FiRefreshCw}
                  onClick={() => {
                    setFinalSession(null);
                    setSession(null);
                    setEvaluationReport(null);
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
                READINESS SCORE
              </span>
              <div
                className={`text-5xl sm:text-6xl font-editorial my-2 ${
                  overallScore >= 75
                    ? 'text-[#C7F36B]'
                    : overallScore >= 50
                    ? 'text-[#FF6B35]'
                    : 'text-[#F87171]'
                }`}
              >
                {overallScore}%
              </div>
              <span className="px-3 py-1 rounded-[8px] bg-[#282828] text-xs font-display font-bold text-white">
                {verdictLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Strengths, Improvements & Coaching Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 rounded-[18px] bg-bg-surface border border-border-subtle p-6 space-y-4">
            <h3 className="text-lg font-display font-bold text-text-primary">Key Strengths</h3>
            <ul className="space-y-2.5">
              {strengths.length > 0 ? (
                strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <FiCheckCircle className="text-success mt-0.5 shrink-0" />
                    <span>{typeof s === 'string' ? s : s?.summary || s?.title || JSON.stringify(s)}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-text-muted">Completed live voice session.</li>
              )}
            </ul>
          </div>

          <div className="lg:col-span-4 rounded-[18px] bg-bg-surface border border-border-subtle p-6 space-y-4">
            <h3 className="text-lg font-display font-bold text-text-primary">Areas to Improve</h3>
            <ul className="space-y-2.5">
              {improvements.length > 0 ? (
                improvements.map((w, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <span className="w-2 h-2 rounded-full bg-[#FF6B35] mt-2 shrink-0" />
                    <span>{typeof w === 'string' ? w : w?.summary || w?.title || JSON.stringify(w)}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-text-muted">Keep practicing deeper system trade-offs.</li>
              )}
            </ul>
          </div>

          <div className="lg:col-span-4 rounded-[18px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#C7F36B] font-bold">
              <FiAward size={14} /> Module 7 Coaching Summary
            </div>
            <p className="text-sm text-[#B5AFA6] leading-relaxed">
              {learningInsights?.executiveSummary ||
                learningInsights?.summary ||
                evaluationReport?.executiveSummary ||
                'Review your competency breakdown and development objectives below to level up for your next round.'}
            </p>
          </div>
        </div>

        {/* Competency Rubric Breakdown */}
        {competencyScores.length > 0 && (
          <div className="rounded-[20px] bg-bg-surface border border-border-subtle p-6 space-y-4">
            <h2 className="text-xl font-display font-bold text-text-primary">
              Competency Rubric Breakdown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {competencyScores.map((c, idx) => (
                <div
                  key={c.competencyId || idx}
                  className="p-4 rounded-[14px] bg-bg-canvas border border-border-subtle space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-display font-bold text-text-primary">
                      {c.competencyName || c.name || c.competencyId}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-[8px] bg-[#151515] text-[#C7F36B] text-xs font-mono font-bold">
                      {Math.round(c.score ?? c.normalizedScore ?? 0)}%
                    </span>
                  </div>
                  {c.rationale && (
                    <p className="text-xs text-text-secondary leading-relaxed">{c.rationale}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Module 7 Development Plan Objectives */}
        {objectives.length > 0 && (
          <div className="rounded-[20px] bg-bg-surface border border-border-subtle p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-display font-bold text-text-primary">
                Module 7 Development Plan
              </h2>
              <span className="text-xs font-mono text-text-muted">Click objective to toggle progress</span>
            </div>
            <div className="space-y-3">
              {objectives.map((obj, idx) => (
                <div
                  key={obj.objectiveId || obj._id || idx}
                  onClick={() => handleToggleObjective(obj)}
                  className="p-4 rounded-[14px] bg-bg-canvas border border-border-subtle hover:border-[#FF6B35] transition-colors cursor-pointer flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-display font-bold text-text-primary">
                      {obj.title || obj.goal || obj.competencyName}
                    </p>
                    {obj.description && (
                      <p className="text-xs text-text-secondary">{obj.description}</p>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-[8px] text-[11px] font-mono uppercase font-bold shrink-0 ${
                      obj.status === 'COMPLETED'
                        ? 'bg-[#C7F36B]/20 text-[#151515]'
                        : 'bg-[#FF6B35]/15 text-[#FF6B35]'
                    }`}
                  >
                    {obj.status || 'PENDING'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Longitudinal Practice History */}
        {historyItems.length > 0 && (
          <div className="rounded-[20px] bg-bg-surface border border-border-subtle p-6 space-y-3">
            <h2 className="text-lg font-display font-bold text-text-primary">
              Longitudinal Practice History ({historyItems.length} sessions)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {historyItems.slice(0, 6).map((h, i) => (
                <div
                  key={h.sessionId || i}
                  className="p-3.5 rounded-[12px] bg-bg-canvas border border-border-subtle text-xs space-y-1"
                >
                  <div className="font-display font-bold text-text-primary">
                    {h.targetRole || jobRole}
                  </div>
                  <div className="font-mono text-text-muted">
                    {h.practiceMode || 'REALISTIC_MOCK'} • Score:{' '}
                    <strong className="text-[#FF6B35]">{Math.round(h.overallScore ?? 0)}%</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
            {pipelineStatus || (
              <>
                Generating <strong className="text-white">{totalQuestions} {difficulty}-level questions</strong> from your resume &amp; job description and connecting the voice room.
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  // ─── Render: INTERVIEW (Phase 6 — 3-Zone Dark Interview Arena) ───────────────
  if (screen === SCREEN.INTERVIEW && session) {
    const v1TotalQuestions =
      session.totalQuestions || blueprint?.questionCount || Number(totalQuestions) || 5;
    const progress = Math.min(100, Math.round(((currentQIndex + 1) / v1TotalQuestions) * 100));
    const orbState = isSpeaking
      ? 'speaking'
      : isRecording
      ? 'listening'
      : isThinking || isTranscribing
      ? 'evaluating'
      : 'idle';

    const currentQuestionObj = session.questions?.[currentQIndex];
    const activePromptText =
      session.activePrompt?.text || currentQuestionObj?.question || shristiMessage;

    return renderArenaContainer(
      <div className="flex flex-col flex-1 w-full max-w-6xl mx-auto justify-between gap-4 min-h-0">
        {/* ── ZONE 1: Top Arena Telemetry Bar ── */}
        <div className="pb-3.5 border-b border-[#2E2E2E] shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-display font-bold text-white">
                    {session.targetRole || session.jobRole || jobRole}
                  </h2>
                  <span className="px-2 py-0.5 rounded-[6px] bg-[#282828] border border-[#383838] text-[11px] font-mono uppercase text-[#C7F36B]">
                    {session.practiceMode || practiceMode}
                  </span>
                </div>
                <p className="text-xs font-mono text-[#B5AFA6]">
                  {`Question ${currentQIndex + 1} of ${v1TotalQuestions} • Attempt #${attempt}`}
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
                onClick={() => handleComplete()}
                className="px-3 py-1.5 rounded-[10px] bg-[#282828] hover:bg-[#DC2626] text-[#F8F5EF] border border-[#383838] text-xs font-display font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="End session and generate Module 6 evaluation & Module 7 coaching plan"
              >
                <FiX size={14} /> End &amp; Evaluate
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
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#FF6B35] font-bold">
                  {`ACTIVE PROMPT • ${session.activePrompt?.competencyName || currentQuestionObj?.category || session.practiceMode || 'Interview'}`}
                </span>
                {session.practiceMode === 'GUIDED_PRACTICE' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAskHintOrCalm}
                      disabled={isSubmitting || isThinking || hints.length >= 3}
                      className="px-2.5 py-1 rounded-[8px] bg-[#282828] border border-[#383838] text-[#C7F36B] text-xs font-mono hover:border-[#C7F36B] disabled:opacity-40 cursor-pointer flex items-center gap-1"
                    >
                      <FiHelpCircle size={12} /> Hint ({hints.length}/3)
                    </button>
                    {attempts.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={handleRetryV1}
                          disabled={isSubmitting || isThinking}
                          className="px-2.5 py-1 rounded-[8px] bg-[#282828] border border-[#383838] text-[#F8F5EF] text-xs font-mono hover:border-[#FF6B35] cursor-pointer"
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={handleContinueV1}
                          disabled={isSubmitting || isThinking}
                          className="px-2.5 py-1 rounded-[8px] bg-[#FF6B35] text-white text-xs font-display font-semibold hover:bg-[#EB5822] cursor-pointer"
                        >
                          Next Question →
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm sm:text-base font-display font-semibold text-white leading-snug">
                {activePromptText}
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
            Upload your <strong className="text-text-primary font-semibold">Resume &amp; Job Details</strong> to run a realistic mock, guided practice, or focused skill voice interview with <strong className="text-text-primary font-semibold">Shristi AI</strong>.
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

            {/* Resume Upload Placeholder (Module 1 & 2) */}
            <div className="space-y-2">
              <label className="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary block">
                3. Upload Resume (PDF or DOCX) *
              </label>
              <label
                htmlFor="resumeUpload"
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-[14px] border-2 border-dashed cursor-pointer transition-colors ${
                  resumeFile
                    ? 'border-[#C7F36B] bg-[#C7F36B]/10'
                    : 'border-border-subtle bg-bg-canvas hover:border-[#FF6B35]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-[#151515] text-[#C7F36B] flex items-center justify-center shrink-0">
                    <FiUpload size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-display font-bold text-text-primary">
                      {resumeFile ? resumeFile.name : 'Click to attach your Resume'}
                    </p>
                    <p className="text-xs font-mono text-text-muted">
                      {resumeFile
                        ? `${Math.max(1, Math.round(resumeFile.size / 1024))} KB • Ready for extraction`
                        : 'Placeholder: PDF or DOCX (used for Module 2–4 personalized blueprint)'}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-[8px] bg-bg-surface border border-border-subtle text-xs font-mono font-semibold text-text-primary shrink-0">
                  {resumeFile ? 'Change File' : 'Browse Resume'}
                </span>
                <input
                  id="resumeUpload"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            {/* Job Description (Text or File) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  className="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary block"
                  htmlFor="jobDescription"
                >
                  4. Job Description &amp; Role Requirements *
                </label>
                <label
                  htmlFor="jdFileUpload"
                  className="text-xs font-mono text-[#FF6B35] hover:underline cursor-pointer"
                >
                  {jdFile ? `Attached: ${jdFile.name}` : '+ Attach JD File (optional)'}
                  <input
                    id="jdFileUpload"
                    type="file"
                    accept=".pdf,.docx"
                    onChange={(e) => setJdFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                id="jobDescription"
                rows={4}
                placeholder="Paste the target job description, required tech stack, and responsibilities. Shristi will build your Module 4 interview blueprint from your Resume + JD..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                required={!jdFile}
                className="w-full px-4 py-3 rounded-[11px] border border-border-subtle bg-bg-surface text-text-primary placeholder-text-muted resize-y text-sm focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/15 focus:outline-none transition-all"
              />
            </div>

            {/* Practice Mode Selector (Module 8) */}
            <div className="space-y-2">
              <label className="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary block">
                5. Practice Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'REALISTIC_MOCK', label: 'Realistic Mock', sub: 'Full timed simulation' },
                  { id: 'GUIDED_PRACTICE', label: 'Guided Practice', sub: '3-level hints & retries' },
                  { id: 'FOCUSED_SKILL_PRACTICE', label: 'Focused Skill', sub: 'Target 1 competency' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPracticeMode(m.id)}
                    className={`p-3 rounded-[12px] border text-left transition-all cursor-pointer ${
                      practiceMode === m.id
                        ? 'bg-[#151515] text-[#F8F5EF] border-[#151515]'
                        : 'bg-bg-canvas border-border-subtle text-text-secondary hover:border-[#FF6B35]'
                    }`}
                  >
                    <div className="text-xs font-display font-bold">{m.label}</div>
                    <div className="text-[10px] font-mono opacity-75 mt-0.5">{m.sub}</div>
                  </button>
                ))}
              </div>
              {practiceMode === 'FOCUSED_SKILL_PRACTICE' && (
                <Input
                  id="focusCompetency"
                  label="Target Competency (optional)"
                  placeholder="e.g., System Design, React State, Node.js Concurrency"
                  value={focusCompetency}
                  onChange={(e) => setFocusCompetency(e.target.value)}
                  icon={FiTarget}
                />
              )}
            </div>

            {recentIntakes.length > 0 && (
              <div className="p-3.5 rounded-[12px] bg-bg-canvas border border-border-subtle space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted font-bold block">
                  Quick Start from Previous Resume/JD Intake
                </span>
                <div className="flex flex-wrap gap-2">
                  {recentIntakes.slice(0, 4).map((item) => {
                    const id = item._id || item.id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleResumeExistingIntake(id)}
                        className="px-3 py-1.5 rounded-[8px] bg-bg-surface border border-border-subtle hover:border-[#FF6B35] text-xs font-mono text-text-primary cursor-pointer"
                      >
                        {item.targetRole || 'Saved Intake'} ({item.seniorityLevel || 'MID'}) →
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
