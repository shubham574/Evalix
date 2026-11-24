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
import { Aura, Eyebrow, NumberTicker, PageHeader, Reveal, ScoreRing } from '@/components/studio';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/shadcn/tooltip';
import { Progress } from '@/components/shadcn/progress';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/shadcn/accordion';

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

const pollUntil = async (fn, isDone, { intervalMs = 1500, timeoutMs = 180000 } = {}) => {
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

// ─── Setup form labels (mono index + sentence label) ───────────────────────────
const FieldIndex = ({ n }) => (
  <span className="font-mono text-[11px] text-[#1D9E4B] mr-2 tabular-nums">{n}</span>
);

const FieldLabel = ({ n, htmlFor, children }) => (
  <label htmlFor={htmlFor} className="flex items-center text-[13px] font-medium text-text-secondary">
    <FieldIndex n={n} />
    {children}
  </label>
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

    const scoreTone = (score) =>
      score >= 75
        ? { ring: '#1F8A4C', text: 'text-success', pill: 'bg-success-bg text-success' }
        : score >= 50
        ? { ring: '#1D9E4B', text: 'text-[#167A3A]', pill: 'bg-peach text-[#167A3A]' }
        : { ring: '#D92D20', text: 'text-danger', pill: 'bg-danger-bg text-danger' };
    const overallTone = scoreTone(overallScore);

    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-fade-in">
        <SEOHead title={`Live Interview Scorecard — ${jobRole}`} />

        {/* Top Scorecard Banner */}
        <Reveal y={20}>
          <section className="relative isolate overflow-hidden rounded-[32px] border border-border-subtle bg-bg-surface shadow-md">
            <Aura intensity={0.75} />
            <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] items-center gap-8 lg:gap-12 p-6 sm:p-8 lg:p-12">
              <div className="space-y-5 max-w-2xl min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-lilac text-[#1D6FB8] font-mono text-[11px] uppercase tracking-[0.12em]">
                    Module 6 evaluation report
                  </span>
                  <span className="px-3 py-1 rounded-full bg-peach text-[#167A3A] font-mono text-[11px] uppercase tracking-[0.12em]">
                    {session?.practiceMode || practiceMode}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass font-mono text-[11px] uppercase tracking-[0.12em] text-text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    {evalStatus}
                  </span>
                </div>

                <h1 className="heading-page text-text-primary text-balance break-words">
                  {jobRole || 'Live Interview'}{' '}
                  <span className="serif italic text-[#1D9E4B]">— Evaluation &amp; Coaching</span>
                </h1>

                <p className="text-[15px] sm:text-base text-text-secondary leading-relaxed text-pretty">
                  Candidate: <strong className="text-text-primary font-semibold">{userName || 'Student'}</strong> • Evidence-based rubric evaluation with Module 7 coaching insights.
                </p>

                <div className="flex flex-wrap gap-2.5 pt-1">
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
                  <Button variant="secondary" size="md" onClick={() => navigate('/dashboard')}>
                    Back to Dashboard
                  </Button>
                </div>
              </div>

              {/* Overall Score Dial */}
              <div className="glass rounded-[28px] shadow-sm p-6 sm:p-7 flex flex-col items-center justify-center text-center mx-auto lg:mx-0 w-full sm:w-auto sm:min-w-[260px]">
                <Eyebrow>Readiness score</Eyebrow>
                <ScoreRing value={overallScore} size={176} stroke={10} color={overallTone.ring} className="my-5">
                  <span className="font-display font-normal tracking-[-0.05em] text-5xl text-text-primary leading-none">
                    <NumberTicker value={overallScore} />
                    <span className="text-2xl text-text-muted">%</span>
                  </span>
                </ScoreRing>
                <span className={`px-3.5 py-1.5 rounded-full text-xs font-display font-normal ${overallTone.pill}`}>
                  {verdictLabel}
                </span>
              </div>
            </div>
          </section>
        </Reveal>

        {/* Strengths, Improvements & Coaching Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Reveal delay={0.05} className="lg:col-span-4">
            <div className="h-full rounded-[24px] bg-bg-surface border border-border-subtle shadow-sm p-6 sm:p-7 space-y-5">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-mint text-[#2F6B12] flex items-center justify-center">
                  <FiCheckCircle size={16} />
                </span>
                <h3 className="heading-card text-text-primary">Key Strengths</h3>
              </div>
              <ul className="space-y-3">
                {strengths.length > 0 ? (
                  strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary leading-relaxed">
                      <FiCheckCircle className="text-success mt-0.5 shrink-0" />
                      <span>{typeof s === 'string' ? s : s?.summary || s?.title || JSON.stringify(s)}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-text-muted">Completed live voice session.</li>
                )}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-4">
            <div className="h-full rounded-[24px] bg-bg-surface border border-border-subtle shadow-sm p-6 sm:p-7 space-y-5">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-peach text-[#167A3A] flex items-center justify-center">
                  <FiTrendingUp size={16} />
                </span>
                <h3 className="heading-card text-text-primary">Areas to Improve</h3>
              </div>
              <ul className="space-y-3">
                {improvements.length > 0 ? (
                  improvements.map((w, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E4B] mt-2 shrink-0" />
                      <span>{typeof w === 'string' ? w : w?.summary || w?.title || JSON.stringify(w)}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-text-muted">Keep practicing deeper system trade-offs.</li>
                )}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.15} className="lg:col-span-4">
            <div className="h-full rounded-[24px] bg-lilac border border-border-subtle/60 p-6 sm:p-7 space-y-4">
              <div className="flex items-center gap-2 eyebrow !text-[#1D6FB8]">
                <FiAward size={14} /> Module 7 Coaching Summary
              </div>
              <p className="text-[15px] text-text-primary/80 leading-relaxed">
                {learningInsights?.executiveSummary ||
                  learningInsights?.summary ||
                  evaluationReport?.executiveSummary ||
                  'Review your competency breakdown and development objectives below to level up for your next round.'}
              </p>
            </div>
          </Reveal>
        </div>

        {/* Competency Rubric Breakdown */}
        {competencyScores.length > 0 && (
          <Reveal>
            <section className="rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-6 sm:p-8 space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2 pb-2">
                <div className="space-y-2">
                  <Eyebrow index="01">Rubric</Eyebrow>
                  <h2 className="font-display font-normal tracking-[-0.03em] text-2xl text-text-primary">
                    Competency Rubric Breakdown
                  </h2>
                </div>
                <span className="text-xs text-text-muted">Expand a competency to read the rationale</span>
              </div>
              <Accordion type="multiple" className="w-full">
                {competencyScores.map((c, idx) => {
                  const cScore = Math.round(c.score ?? c.normalizedScore ?? 0);
                  const tone = scoreTone(cScore);
                  return (
                    <AccordionItem
                      key={c.competencyId || idx}
                      value={String(c.competencyId || idx)}
                      className="border-border-subtle"
                    >
                      <AccordionTrigger className="py-5 text-base hover:no-underline items-center">
                        <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 min-w-0">
                          <span className="font-display font-normal text-text-primary sm:w-[38%] truncate">
                            {c.competencyName || c.name || c.competencyId}
                          </span>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Progress value={cScore} className="h-1.5 bg-bg-elevated flex-1" />
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono shrink-0 ${tone.pill}`}>
                              {cScore}%
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
                          {c.rationale || 'No rationale was provided for this competency.'}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </section>
          </Reveal>
        )}

        {/* Module 7 Development Plan Objectives */}
        {objectives.length > 0 && (
          <Reveal>
            <section className="rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-6 sm:p-8 space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="space-y-2">
                  <Eyebrow index="02">Coaching</Eyebrow>
                  <h2 className="font-display font-normal tracking-[-0.03em] text-2xl text-text-primary">
                    Module 7 Development Plan
                  </h2>
                </div>
                <span className="text-xs text-text-muted">Click objective to toggle progress</span>
              </div>
              <div className="space-y-2.5">
                {objectives.map((obj, idx) => (
                  <motion.div
                    key={obj.objectiveId || obj._id || idx}
                    onClick={() => handleToggleObjective(obj)}
                    whileHover={{ y: -2 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                    className={`p-4 sm:p-5 rounded-[20px] border transition-colors cursor-pointer flex items-start justify-between gap-4 ${
                      obj.status === 'COMPLETED'
                        ? 'bg-mint/60 border-transparent'
                        : 'bg-bg-canvas border-border-subtle hover:border-[#1D9E4B]/50 hover:bg-bg-surface'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          obj.status === 'COMPLETED'
                            ? 'bg-success text-white'
                            : 'border border-border-subtle bg-bg-surface'
                        }`}
                      >
                        {obj.status === 'COMPLETED' && <FiCheckCircle size={12} />}
                      </span>
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-display font-normal text-text-primary">
                          {obj.title || obj.goal || obj.competencyName}
                        </p>
                        {obj.description && (
                          <p className="text-xs text-text-secondary leading-relaxed">{obj.description}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.1em] shrink-0 ${
                        obj.status === 'COMPLETED'
                          ? 'bg-success-bg text-success'
                          : 'bg-peach text-[#167A3A]'
                      }`}
                    >
                      {obj.status || 'PENDING'}
                    </span>
                  </motion.div>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        {/* Longitudinal Practice History */}
        {historyItems.length > 0 && (
          <Reveal>
            <section className="rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-6 sm:p-8 space-y-5">
              <div className="space-y-2">
                <Eyebrow index="03">History</Eyebrow>
                <h2 className="font-display font-normal tracking-[-0.03em] text-2xl text-text-primary">
                  Longitudinal Practice History ({historyItems.length} sessions)
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {historyItems.slice(0, 6).map((h, i) => {
                  const hScore = Math.round(h.overallScore ?? 0);
                  return (
                    <div
                      key={h.sessionId || i}
                      className="p-4 rounded-[20px] bg-bg-canvas border border-border-subtle flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="text-sm font-display font-normal text-text-primary truncate">
                          {h.targetRole || jobRole}
                        </div>
                        <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-text-muted truncate">
                          {h.practiceMode || 'REALISTIC_MOCK'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono uppercase text-text-muted block">Score:</span>
                        <strong className="font-display font-normal tracking-[-0.03em] text-xl text-[#1D9E4B]">{hScore}%</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </Reveal>
        )}
      </div>
    );
  }

  // ─── Render: MAIN ARENA CONTAINER (Light Studio Room over a pastel aura) ──────
  const renderArenaContainer = (content) => (
    <div
      ref={containerRef}
      className={`theme-interview relative isolate bg-bg-canvas text-text-primary transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen rounded-none border-0 overflow-hidden flex flex-col p-3 sm:p-6'
          : 'min-h-[calc(100vh-6.5rem)] rounded-[32px] border border-border-subtle overflow-hidden flex flex-col p-3 sm:p-6 shadow-md'
      }`}
    >
      <SEOHead title={`Live Interview Arena — ${jobRole}`} />
      <Aura intensity={0.85} />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">{content}</div>
    </div>
  );

  // Small round icon control used in the room's top bar.
  const roomIconBtn =
    'h-9 w-9 rounded-full bg-bg-surface/80 border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-surface hover:shadow-sm flex items-center justify-center cursor-pointer transition-all';

  // ─── Render: LOADING ─────────────────────────────────────────────────────────
  if (screen === SCREEN.LOADING) {
    return renderArenaContainer(
      <div className="flex flex-col items-center justify-center flex-1 py-16 px-4 text-center">
        <div className="relative">
          <div className="absolute inset-[-40%] rounded-full bg-bg-surface/50 blur-2xl" />
          <EvalixOrb state="thinking" size="xl" showLabel className="relative" />
        </div>
        <div className="mt-8 space-y-3 max-w-lg">
          <Eyebrow dot className="justify-center">Setting up your room</Eyebrow>
          <h2 className="font-display font-normal tracking-[-0.04em] text-3xl sm:text-4xl text-text-primary text-balance">
            Preparing your <span className="serif italic text-[#1D9E4B]">{jobRole}</span> interview...
          </h2>
          <p className="text-sm sm:text-[15px] text-text-secondary leading-relaxed text-pretty">
            {pipelineStatus || (
              <>
                Generating <strong className="text-text-primary font-semibold">{totalQuestions} {difficulty}-level questions</strong> from your resume &amp; job description and connecting the voice room.
              </>
            )}
          </p>
        </div>
        <div className="mt-8 w-full max-w-xs">
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-bg-surface/70">
            <motion.div
              className="absolute inset-y-0 w-1/3 rounded-full bg-[#1D9E4B]"
              animate={{ x: ['-100%', '300%'] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: INTERVIEW (3-zone light studio room) ─────────────────────────────
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

    const orbStatusText = isSpeaking
      ? 'Speaking prompt aloud...'
      : isRecording
      ? 'Listening to your answer...'
      : isThinking
      ? 'Evaluating against rubric...'
      : 'Waiting for your response';

    return renderArenaContainer(
      <div className="flex flex-col flex-1 w-full max-w-6xl mx-auto justify-between gap-3 sm:gap-4 min-h-0">
        {/* ── ZONE 1: Top Room Bar ── */}
        <div className="glass rounded-[24px] shadow-sm px-4 py-3 sm:px-5 shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-display font-normal tracking-[-0.03em] text-text-primary truncate max-w-[60vw] sm:max-w-none">
                  {session.targetRole || session.jobRole || jobRole}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-lilac text-[#1D6FB8] text-[10px] font-mono uppercase tracking-[0.1em]">
                  {session.practiceMode || practiceMode}
                </span>
              </div>
              <p className="text-xs font-mono text-text-muted mt-0.5">
                {`Question ${currentQIndex + 1} of ${v1TotalQuestions} • Attempt #${attempt}`}
              </p>
            </div>

            {/* Right status & session controls */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 h-9 px-3.5 rounded-full bg-bg-surface/80 border border-border-subtle text-xs font-mono text-text-primary tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E4B] animate-pulse-soft" />
                <FiClock className="text-text-muted" size={13} />
                <span>{formatClock(elapsedSeconds)}</span>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Unmute Shristi AI Voice' : 'Mute Shristi AI Voice'}
                    className={`h-9 px-3.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      isMuted
                        ? 'bg-danger-bg border-transparent text-danger'
                        : 'bg-bg-surface/80 border-border-subtle text-text-primary hover:bg-bg-surface hover:shadow-sm'
                    }`}
                  >
                    {isMuted ? <FiVolumeX size={14} /> : <FiVolume2 size={14} />}
                    <span className="hidden md:inline">{isMuted ? 'AI Muted' : 'Voice On'}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  {isMuted ? 'Unmute Shristi AI Voice' : 'Mute Shristi AI Voice'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Arena'}
                    className={`${roomIconBtn} hidden sm:flex`}
                  >
                    {isFullscreen ? <FiMinimize size={14} /> : <FiMaximize size={14} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Arena'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleComplete()}
                    className="h-9 px-3.5 rounded-full bg-bg-surface border border-border-subtle text-text-primary hover:bg-danger hover:border-transparent hover:text-white text-xs font-display font-normal flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FiX size={14} /> End &amp; Evaluate
                  </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  End session and generate Module 6 evaluation &amp; Module 7 coaching plan
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Progress */}
          <Progress value={isSmallTalkPhase ? 8 : progress} className="h-1 bg-bg-elevated" />
        </div>

        {/* ── ZONE 2: Main Stage (presence left, question & transcript right) ── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 min-h-0">
          {/* Left Column: AI presence & candidate pod */}
          <div className="lg:col-span-4 grid grid-cols-[1.4fr_1fr] lg:grid-cols-1 lg:grid-rows-[1.5fr_1fr] gap-3 sm:gap-4">
            {/* Shristi AI presence */}
            <div className="glass rounded-[28px] shadow-sm p-4 sm:p-6 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[200px]">
              <span className="eyebrow mb-4">AI interviewer</span>
              <div className="relative">
                <motion.div
                  aria-hidden
                  className="absolute inset-[-28%] rounded-full border border-white/70"
                  animate={isSpeaking ? { scale: [1, 1.12, 1], opacity: [0.9, 0.3, 0.9] } : { scale: 1, opacity: 0.6 }}
                  transition={{ repeat: isSpeaking ? Infinity : 0, duration: 1.6, ease: 'easeInOut' }}
                />
                <div className="lg:hidden">
                  <EvalixOrb state={orbState} size="lg" showLabel />
                </div>
                <div className="hidden lg:block">
                  <EvalixOrb state={orbState} size="xl" showLabel />
                </div>
              </div>
              <h3 className="font-display font-normal tracking-[-0.03em] text-lg text-text-primary mt-4">
                Shristi
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">{orbStatusText}</p>
            </div>

            {/* Candidate pod */}
            <div className="glass rounded-[28px] shadow-sm p-4 sm:p-5 flex flex-col items-center justify-center text-center relative">
              <div className="relative mb-3">
                {isRecording && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-[#8BD45E]/40"
                    animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
                    transition={{ repeat: Infinity, duration: 1.6 }}
                  />
                )}
                <div
                  className={`relative w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden flex items-center justify-center transition-all ring-4 ${
                    isRecording ? 'ring-[#8BD45E]/70 bg-mint' : 'ring-white/80 bg-bg-elevated'
                  }`}
                >
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt={userName} className="w-full h-full object-cover" />
                  ) : (
                    <FiUser className="w-7 h-7 text-text-muted" />
                  )}
                </div>
              </div>
              <p className="font-display font-normal text-sm text-text-primary">{userName || 'You'}</p>
              <div
                className={`flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full ${
                  isRecording ? 'bg-mint text-[#2F6B12]' : 'bg-bg-surface/80 text-text-secondary'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isRecording ? 'bg-[#4FA82B] animate-ping' : 'bg-text-muted'
                  }`}
                />
                <span className="text-[10px] sm:text-[11px] font-mono">
                  {isRecording ? 'Mic Live — Recording' : isTextMode ? 'Keyboard Mode' : 'Mic Standby'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Question + live transcript */}
          <div className="lg:col-span-8 rounded-[28px] bg-bg-surface/85 backdrop-blur-xl border border-border-subtle shadow-md flex flex-col overflow-hidden min-h-[420px] lg:min-h-0">
            {/* Pinned current question */}
            <div className="relative p-5 sm:p-6 shrink-0 bg-linear-to-br from-peach via-bg-surface to-lilac border-b border-border-subtle">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <span className="eyebrow !text-[#167A3A] inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E4B]" />
                  {`ACTIVE PROMPT • ${session.activePrompt?.competencyName || currentQuestionObj?.category || session.practiceMode || 'Interview'}`}
                </span>
                {session.practiceMode === 'GUIDED_PRACTICE' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAskHintOrCalm}
                      disabled={isSubmitting || isThinking || hints.length >= 3}
                      className="h-8 px-3 rounded-full bg-mint text-[#2F6B12] text-xs font-medium hover:shadow-sm disabled:opacity-40 cursor-pointer flex items-center gap-1.5 transition-all"
                    >
                      <FiHelpCircle size={12} /> Hint ({hints.length}/3)
                    </button>
                    {attempts.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={handleRetryV1}
                          disabled={isSubmitting || isThinking}
                          className="h-8 px-3 rounded-full bg-bg-surface border border-border-subtle text-text-primary text-xs font-medium hover:shadow-sm disabled:opacity-40 cursor-pointer transition-all"
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={handleContinueV1}
                          disabled={isSubmitting || isThinking}
                          className="h-8 px-3.5 rounded-full bg-[#1D9E4B] text-white text-xs font-display font-normal hover:bg-[#178A40] shadow-[0_8px_20px_-10px_rgba(29,158,75,0.8)] disabled:opacity-40 cursor-pointer transition-all"
                        >
                          Next Question →
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={activePromptText}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="text-lg sm:text-xl font-display font-normal tracking-[-0.025em] text-text-primary leading-snug text-pretty"
                >
                  {activePromptText}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Conversation & live transcript */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 scrollbar-thin">
              {isCalmingActive && (
                <div className="p-3.5 rounded-[18px] bg-mint text-[#2F6B12] text-xs flex items-center gap-2">
                  <span>🌱</span>
                  <span>
                    Take your time — Shristi is here to help you practice. Zero rush!
                  </span>
                </div>
              )}

              {chatHistory.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[80%] px-4 py-3 rounded-[20px] text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#1D9E4B] text-white rounded-tr-md shadow-[0_10px_24px_-14px_rgba(29,158,75,0.9)]'
                        : 'bg-bg-surface border border-border-subtle text-text-primary rounded-tl-md shadow-xs'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-mono uppercase tracking-[0.12em] block mb-1 ${
                        msg.sender === 'user' ? 'text-white/80' : 'text-text-muted'
                      }`}
                    >
                      {msg.sender === 'user' ? `${userName || 'You'}` : 'Shristi AI'}
                    </span>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </motion.div>
              ))}

              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-lilac px-4 py-3 rounded-[18px] rounded-tl-md flex items-center gap-2.5 text-xs font-medium text-[#1D6FB8]">
                    <FiLoader className="animate-spin" />
                    <span>Shristi is evaluating your answer...</span>
                  </div>
                </div>
              )}

              {isTranscribing && (
                <div className="flex justify-end">
                  <div className="bg-bg-elevated px-4 py-3 rounded-[18px] rounded-tr-md flex items-center gap-2.5 text-xs font-medium text-text-secondary">
                    <FiLoader className="animate-spin text-[#1D9E4B]" />
                    <span>Transcribing your voice response...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* ── ZONE 3: Bottom Control Dock ── */}
            <div className="p-3 sm:p-4 bg-bg-canvas/70 border-t border-border-subtle shrink-0">
              {recorderError && (
                <div className="flex items-center gap-2 text-xs text-danger bg-danger-bg px-3.5 py-2 rounded-full mb-3">
                  <FiAlertCircle className="shrink-0" /> {recorderError}
                </div>
              )}

              {isTextMode ? (
                <form onSubmit={handleSendTypedAnswer} className="space-y-2.5">
                  <div className="flex items-end gap-2 p-1.5 rounded-[22px] bg-bg-surface border border-border-subtle shadow-xs focus-within:border-[#1D9E4B]/50 focus-within:ring-4 focus-within:ring-[#1D9E4B]/10 transition-all">
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
                      className="flex-1 min-w-0 px-3.5 py-2.5 bg-transparent text-text-primary placeholder:text-text-muted text-sm focus:outline-none resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendTypedAnswer();
                        }
                      }}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={toggleRecording}
                          disabled={isSubmitting || isThinking || isTranscribing}
                          aria-label={isRecording ? 'Stop & transcribe' : 'Dictate with mic'}
                          className={`h-10 w-10 shrink-0 rounded-full transition-all cursor-pointer flex items-center justify-center disabled:opacity-40 ${
                            isRecording
                              ? 'bg-danger text-white animate-pulse'
                              : 'bg-bg-elevated text-text-primary hover:bg-peach hover:text-[#167A3A]'
                          }`}
                        >
                          {isRecording ? <FiStopCircle size={17} /> : <FiMic size={17} />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        {isRecording ? 'Stop & transcribe' : 'Dictate with mic'}
                      </TooltipContent>
                    </Tooltip>
                    <button
                      type="submit"
                      disabled={
                        isSubmitting ||
                        isThinking ||
                        !typedAnswer.trim() ||
                        isRecording ||
                        isTranscribing
                      }
                      className="h-10 px-5 shrink-0 rounded-full bg-[#1D9E4B] hover:bg-[#178A40] text-white font-display font-normal text-sm shadow-[0_8px_20px_-10px_rgba(29,158,75,0.8)] disabled:opacity-40 disabled:shadow-none cursor-pointer flex items-center justify-center transition-all"
                    >
                      {isSubmitting ? <FiLoader className="animate-spin" /> : 'Submit'}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    {!isSmallTalkPhase ? (
                      <button
                        type="button"
                        onClick={handleAskHintOrCalm}
                        disabled={isSubmitting || isThinking}
                        className="h-8 px-3 rounded-full bg-mint text-[#2F6B12] font-medium hover:shadow-sm disabled:opacity-40 cursor-pointer transition-all"
                      >
                        Need a hint from Shristi?
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={() => setIsTextMode(false)}
                      className="h-8 px-3 rounded-full bg-bg-surface border border-border-subtle text-text-primary font-medium hover:shadow-sm cursor-pointer inline-flex items-center gap-1.5 transition-all"
                    >
                      <FiMic size={12} className="text-[#1D9E4B]" /> Switch to Voice Dock
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs order-2 sm:order-1 sm:w-44">
                    {!isSmallTalkPhase && (
                      <button
                        type="button"
                        onClick={handleAskHintOrCalm}
                        disabled={isSpeaking || isSubmitting || isThinking}
                        className="h-9 px-3.5 rounded-full bg-mint text-[#2F6B12] font-medium hover:shadow-sm disabled:opacity-40 transition-all cursor-pointer"
                      >
                        💡 Ask for a Hint
                      </button>
                    )}
                  </div>

                  {/* Center primary mic control */}
                  <div className="order-1 sm:order-2 relative">
                    {isRecording ? (
                      <>
                        <motion.span
                          aria-hidden
                          className="absolute inset-0 rounded-full bg-danger/30"
                          animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0, 0.8] }}
                          transition={{ repeat: Infinity, duration: 1.4 }}
                        />
                        <button
                          type="button"
                          onClick={toggleRecording}
                          className="relative inline-flex items-center gap-2.5 h-13 px-7 rounded-full bg-danger text-white font-display font-normal text-sm shadow-[0_12px_30px_-12px_rgba(217,45,32,0.8)] cursor-pointer"
                        >
                          <FiStopCircle size={18} />
                          {isSmallTalkPhase ? 'Done Speaking Reply' : 'Finish & Submit Answer'}
                        </button>
                      </>
                    ) : (
                      <motion.button
                        type="button"
                        onClick={toggleRecording}
                        disabled={isSpeaking || isSubmitting || isTranscribing}
                        whileHover={!(isSpeaking || isSubmitting || isTranscribing) ? { y: -2 } : {}}
                        whileTap={!(isSpeaking || isSubmitting || isTranscribing) ? { scale: 0.98 } : {}}
                        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                        className="inline-flex items-center gap-2.5 h-13 px-7 rounded-full bg-[#1D9E4B] hover:bg-[#178A40] text-white font-display font-normal text-sm shadow-[0_14px_34px_-12px_rgba(29,158,75,0.75)] disabled:opacity-45 disabled:shadow-none cursor-pointer transition-colors"
                      >
                        <span className="w-7 h-7 -ml-2 rounded-full bg-white/20 flex items-center justify-center">
                          <FiMic size={15} />
                        </span>
                        {isSpeaking
                          ? 'Shristi is speaking...'
                          : isSmallTalkPhase
                          ? 'Tap Mic to Reply'
                          : 'Tap Mic to Speak Answer'}
                      </motion.button>
                    )}
                  </div>

                  <div className="order-3 sm:w-44 flex sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setIsTextMode(true)}
                      className="h-9 px-3.5 rounded-full bg-bg-surface border border-border-subtle text-text-primary text-xs font-medium hover:shadow-sm inline-flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <FiMessageSquare size={13} />
                      Type Answer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: SETUP (Structured Interview Configuration + Equipment Check) ─────
  const chipBase = 'transition-all cursor-pointer border';
  const chipOn = 'bg-peach text-[#167A3A] border-[#1D9E4B]/30';
  const chipOff = 'bg-bg-canvas text-text-secondary border-border-subtle hover:border-[#1D9E4B]/40 hover:bg-bg-surface';

  return (
    <div className="space-y-2 animate-fade-in">
      <SEOHead title="Live AI Voice Interview — Evalix" />

      {/* Page Header */}
      <PageHeader
        eyebrow="Voice interview room"
        title="Live AI Voice"
        accent="Interview"
        description={
          <>
            Upload your <strong className="text-text-primary font-semibold">Resume &amp; Job Details</strong> to run a realistic mock, guided practice, or focused skill voice interview with <strong className="text-text-primary font-semibold">Shristi AI</strong>.
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: configuration form */}
        <div className="lg:col-span-7 rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-5 sm:p-8">
          <form onSubmit={handleStart} className="space-y-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="userName"
                label={<><FieldIndex n="01" />Candidate Name</>}
                placeholder="e.g., Shubham Maurya"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                icon={FiUser}
                required
              />
              <Input
                id="jobRole"
                label={<><FieldIndex n="02" />Target Role / Track</>}
                placeholder="e.g., Senior Frontend Engineer"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                icon={FiBriefcase}
                required
              />
            </div>

            {/* Quick Role Preset Chips */}
            <div className="flex flex-wrap items-center gap-2 -mt-2">
              <span className="eyebrow mr-1">Quick fill</span>
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
                  className={`h-8 px-3.5 rounded-full text-xs font-medium ${chipBase} ${
                    jobRole === preset ? chipOn : chipOff
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Resume Upload (Module 1 & 2) */}
            <div className="space-y-2">
              <FieldLabel n="03">Upload Resume (PDF or DOCX) *</FieldLabel>
              <label
                htmlFor="resumeUpload"
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-[20px] border border-dashed cursor-pointer transition-all ${
                  resumeFile
                    ? 'border-[#8BD45E] bg-mint'
                    : 'border-border-subtle bg-bg-canvas hover:border-[#1D9E4B]/50 hover:bg-bg-surface'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                      resumeFile ? 'bg-bg-surface text-[#2F6B12]' : 'bg-peach text-[#167A3A]'
                    }`}
                  >
                    {resumeFile ? <FiCheckCircle size={18} /> : <FiUpload size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-display font-normal text-text-primary truncate">
                      {resumeFile ? resumeFile.name : 'Click to attach your Resume'}
                    </p>
                    <p className="text-xs text-text-muted">
                      {resumeFile
                        ? `${Math.max(1, Math.round(resumeFile.size / 1024))} KB • Ready for extraction`
                        : 'Placeholder: PDF or DOCX (used for Module 2–4 personalized blueprint)'}
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-auto h-8 px-3.5 inline-flex items-center rounded-full bg-bg-surface border border-border-subtle text-xs font-medium text-text-primary shrink-0">
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
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FieldLabel n="04" htmlFor="jobDescription">
                  Job Description &amp; Role Requirements *
                </FieldLabel>
                <label
                  htmlFor="jdFileUpload"
                  className={`h-7 px-3 inline-flex items-center rounded-full text-xs font-medium cursor-pointer transition-colors max-w-full truncate ${
                    jdFile ? 'bg-mint text-[#2F6B12]' : 'bg-peach text-[#167A3A] hover:bg-[#FFDCCB]'
                  }`}
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
                className="w-full px-4 py-3 rounded-[14px] border border-border-subtle bg-bg-surface text-text-primary placeholder:text-text-muted resize-y text-sm leading-relaxed hover:border-text-primary/25 focus:border-[#1D9E4B]/60 focus:ring-4 focus:ring-[#1D9E4B]/10 focus:outline-none transition-all"
              />
            </div>

            {/* Practice Mode Selector (Module 8) */}
            <div className="space-y-2.5">
              <FieldLabel n="05">Practice Mode</FieldLabel>
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
                    className={`p-4 rounded-[18px] text-left ${chipBase} ${practiceMode === m.id ? chipOn : chipOff}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-display font-normal">{m.label}</span>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          practiceMode === m.id ? 'border-[#1D9E4B] bg-[#1D9E4B]' : 'border-border-subtle bg-bg-surface'
                        }`}
                      >
                        {practiceMode === m.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <div className="text-xs opacity-75 mt-1">{m.sub}</div>
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
                  className="pt-2"
                />
              )}
            </div>

            {recentIntakes.length > 0 && (
              <div className="p-4 sm:p-5 rounded-[20px] bg-sky space-y-3">
                <span className="eyebrow block !text-[#2D5F99]">
                  Quick start from previous Resume/JD intake
                </span>
                <div className="flex flex-wrap gap-2">
                  {recentIntakes.slice(0, 4).map((item) => {
                    const id = item._id || item.id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleResumeExistingIntake(id)}
                        className="h-8 px-3.5 rounded-full bg-bg-surface border border-border-subtle hover:border-[#1D9E4B]/40 hover:shadow-sm text-xs font-medium text-text-primary cursor-pointer transition-all"
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
              <div className="space-y-2.5">
                <FieldLabel n="06">Seniority &amp; Difficulty</FieldLabel>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-[20px] bg-bg-elevated">
                  {[
                    { id: 'easy', label: 'Easy', sub: 'Fundamentals' },
                    { id: 'medium', label: 'Medium', sub: 'Practical' },
                    { id: 'hard', label: 'Hard', sub: 'Deep Dive' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      className={`py-2.5 px-1 rounded-[16px] text-center transition-all cursor-pointer flex flex-col items-center ${
                        difficulty === d.id
                          ? 'bg-bg-surface text-text-primary shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <span className="text-sm font-display font-normal">{d.label}</span>
                      <span className="text-[10px] opacity-70 mt-0.5">{d.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <FieldLabel n="07">Session Length (Questions)</FieldLabel>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-[20px] bg-bg-elevated">
                  {MOCK_QUESTION_COUNTS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setTotalQuestions(opt)}
                      className={`py-2.5 px-1 rounded-[16px] text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                        totalQuestions === opt
                          ? 'bg-bg-surface text-[#167A3A] shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <span className="text-sm font-display font-normal">{opt} Qs</span>
                      <span className="text-[10px] opacity-70">~{opt * 2} mins</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pre-Interview Equipment Check */}
            <div
              className={`p-4 sm:p-5 rounded-[20px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                micStatus === 'ready' ? 'bg-mint' : micStatus === 'denied' ? 'bg-warning-bg' : 'bg-tint-sand'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-bg-surface ${
                    micStatus === 'ready' ? 'text-[#2F6B12]' : micStatus === 'denied' ? 'text-warning' : 'text-text-primary'
                  }`}
                >
                  <FiMic size={16} className={micStatus === 'testing' ? 'animate-pulse' : ''} />
                </span>
                <div>
                  <p className="text-sm font-display font-normal text-text-primary">
                    Microphone Check
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {micStatus === 'ready'
                      ? 'Microphone verified and ready for live voice mode.'
                      : micStatus === 'denied'
                      ? 'Mic blocked — keyboard answer fallback will be available.'
                      : 'Test microphone access before starting your session.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckMicrophone}
                className="self-start sm:self-auto h-9 px-4 rounded-full bg-bg-surface border border-border-subtle hover:shadow-sm text-xs font-medium text-text-primary shrink-0 cursor-pointer transition-all"
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

        {/* Right Column: Shristi briefing card */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <div className="relative isolate overflow-hidden rounded-[32px] border border-border-subtle bg-bg-surface shadow-md">
            <Aura intensity={0.8} />
            <div className="relative p-6 sm:p-7 space-y-6">
              <div className="flex flex-col items-center text-center pt-4 pb-2">
                <EvalixOrb state="speaking" size="xl" />
                <Eyebrow dot className="mt-6">Voice interviewer</Eyebrow>
                <h2 className="mt-3 font-display font-normal tracking-[-0.04em] text-3xl text-text-primary">
                  Shristi <span className="serif italic text-[#1D9E4B]">AI</span>
                </h2>
                <p className="text-sm text-text-secondary mt-1">
                  Multi-turn Technical &amp; Behavioral Interviewer
                </p>
              </div>

              {/* Live Session Summary Preview */}
              <div className="space-y-3">
                <span className="eyebrow block">Session summary</span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="glass p-4 rounded-[18px] min-w-0">
                    <span className="eyebrow block !text-[10px]">Target role</span>
                    <span className="text-sm font-display font-normal text-text-primary mt-2 block truncate">
                      {jobRole || 'Not selected yet'}
                    </span>
                  </div>
                  <div className="glass p-4 rounded-[18px] min-w-0">
                    <span className="eyebrow block !text-[10px]">Format</span>
                    <span className="text-sm font-display font-normal text-[#167A3A] capitalize mt-2 block truncate">
                      {difficulty} • {totalQuestions} Qs
                    </span>
                  </div>
                </div>
              </div>

              {/* What to Expect */}
              <div className="glass rounded-[22px] p-5 space-y-4">
                <span className="eyebrow block">Session flow</span>
                <ol className="space-y-3.5 text-[13px] text-text-secondary leading-relaxed">
                  {[
                    ['Optional Warm-Up:', <>Start with a brief check-in or skip directly to Question 1.</>],
                    [
                      'Spoken Q&A + Follow-Ups:',
                      <>Shristi reads each question aloud and probes shallow answers with up to <strong className="text-text-primary font-semibold">2 follow-ups</strong>.</>,
                    ],
                    ['Hints & Text Fallback:', <>Request a hint anytime or switch between microphone and keyboard input.</>],
                    [
                      'Per-Question Scorecard:',
                      <>Review your transcript, scores out of 10, and feedback after completing the session.</>,
                    ],
                  ].map(([title, body], i) => (
                    <li key={title} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-bg-surface border border-border-subtle text-[11px] font-mono text-[#1D9E4B] flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <p>
                        <strong className="text-text-primary font-semibold">{title}</strong> {body}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveInterview;
