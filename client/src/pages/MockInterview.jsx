import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  FiVideo, FiMic, FiStopCircle, FiCheckCircle,
  FiPlay, FiArrowRight, FiAlertCircle, FiLoader,
  FiVolume2, FiVolumeX, FiRotateCcw, FiAward,
  FiTrendingUp, FiCpu, FiClock,
} from 'react-icons/fi';
import EvalixOrb, { EvalixStarburst } from '../components/ui/EvalixOrb';
import LottieComponent from 'lottie-react';
const Lottie = LottieComponent.default || LottieComponent;
import interviewLoader from '../assets/interviewLoader.json';
import { useApiMutation, useApiQuery } from '../hooks/useApi';
import { API } from '../api/endpoints';
import { MOCK_QUESTION_COUNTS } from '../utils/constants';
import SEOHead from '../components/common/SEOHead';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import { getGradeColor } from '../utils/helpers';
import api from '../api/axios';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { Eyebrow, Reveal, Aura, ScoreRing, NumberTicker, PageHeader } from '@/components/studio';
import { Progress } from '@/components/shadcn/progress';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/shadcn/accordion';

// ─── Question Voice Hook (Hybrid Gemini TTS + Web Speech API fallback) ────────
const useQuestionSpeech = ({ getToken }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
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

  const speakWithBrowserSpeech = useCallback((text, onEnd) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSpeaking(false);
      onEnd?.();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const cleanText = (text || '')
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
      utterance.pitch = 1.03;

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
      stopSpeaking();
      const currentCallId = ++callIdRef.current;

      try {
        const token = await getToken();
        const geminiKey = localStorage.getItem('custom_gemini_key');
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        if (geminiKey) headers['x-gemini-api-key'] = geminiKey;

        const controller = new AbortController();
        abortControllerRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), 3500);

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
          throw new Error('TTS response was non-audio or empty');
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
      } catch (e) {
        if (callIdRef.current !== currentCallId) return;
        speakWithBrowserSpeech(text, onEnd);
      }
    },
    [getToken, stopSpeaking, speakWithBrowserSpeech]
  );

  return { speak, stopSpeaking, isSpeaking };
};

// ─── Voice recorder hook (ElevenLabs Scribe + Gemini + Browser Web Speech Fallback) ─
const useVoiceRecorder = ({ onTranscript, getToken }) => {
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const browserTranscriptRef = useRef('');
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);

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
        } catch (e) { /* ignore */ }
      }

      // Pick best supported format
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
        // Release mic tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const fallbackText = (browserTranscriptRef.current || '').trim();

        const blob = new Blob(chunksRef.current, { type: cleanType });
        if (!blob || blob.size < 50) {
          if (fallbackText) {
            onTranscriptRef.current?.(fallbackText);
            setIsTranscribing(false);
            return;
          }
          toast('No audible speech detected. Please speak louder into your microphone or type your answer below.', {
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
            toast('No audible speech detected. Please speak louder into your microphone or type your answer below.', {
              icon: '🎙️',
              duration: 4000,
            });
          }
        } catch (err) {
          console.error('Transcription error:', err);
          if (fallbackText) {
            onTranscriptRef.current?.(fallbackText);
          } else {
            toast.error(
              err.response?.data?.error || 'Failed to transcribe audio. Please speak louder or type your answer below.'
            );
          }
        } finally {
          setIsTranscribing(false);
        }
      };

      // Collect data in 250ms timeslices for reliable buffer capture
      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser.');
      } else {
        setError(`Could not start recording: ${err.message}`);
      }
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
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return { isRecording, isTranscribing, error, toggleRecording, startRecording, stopRecording };
};

const useDeepgramRecorder = useVoiceRecorder;

// ─── Role Presets for Quick Launch ──────────────────────────────────────────
const MOCK_ROLE_PRESETS = [
  'Frontend Developer (React)',
  'Full Stack Engineer (MERN)',
  'Backend Engineer (Node.js)',
  'System Design & Architecture',
  'Data Structures & Algorithms',
  'Python / AI Engineer',
];

// ─── Answer textarea with voice indicator (light studio styled) ───────────────
const AnswerInput = ({ text, setText, isRecording, isTranscribing }) => (
  <div className="w-full relative">
    <textarea
      id="answer"
      rows={6}
      placeholder={
        isRecording
          ? '🎙️ Listening... Speak clearly, then click "Stop Recording" when ready.'
          : isTranscribing
          ? '⏳ Transcribing your voice response with AI...'
          : 'Type your detailed response here, or click "Record Voice Answer" below to speak...'
      }
      value={text}
      onChange={(e) => setText(e.target.value)}
      disabled={isTranscribing}
      className={`w-full px-5 pt-4 pb-10 rounded-[20px] border bg-bg-surface text-text-primary placeholder:text-text-muted resize-none transition-all duration-300 outline-none text-[15px] sm:text-base leading-relaxed shadow-xs ${
        isRecording
          ? 'border-[#5DAA3A]/40 ring-4 ring-[#5DAA3A]/12'
          : isTranscribing
          ? 'border-warning/40 ring-4 ring-warning/10 opacity-75'
          : 'border-border-subtle focus:border-[#1D9E4B]/60 focus:ring-4 focus:ring-[#1D9E4B]/12'
      }`}
    />

    <span className="absolute bottom-3.5 left-5 eyebrow tabular-nums pointer-events-none">
      {text.trim().length} chars
    </span>

    {isRecording && (
      <div className="absolute top-3 right-3 flex items-center gap-2 bg-mint text-[#2F6B12] dark:text-[#A8E07E] px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider pointer-events-none">
        <span className="relative flex w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-[#5DAA3A] animate-ping opacity-60" />
          <span className="relative w-2 h-2 rounded-full bg-[#5DAA3A]" />
        </span>
        Recording Live
      </div>
    )}

    {isTranscribing && (
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-lilac text-[#1D6FB8] dark:text-[#8EC1FF] px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider pointer-events-none">
        <FiLoader className="animate-spin" />
        Transcribing…
      </div>
    )}
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const MockInterview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken } = useAuth();

  const [jobRole, setJobRole] = useState(location.state?.jobRole || '');
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [activeInterview, setActiveInterview] = useState(null);

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [finalResults, setFinalResults] = useState(null);

  // Append transcript to the existing typed text
  const handleTranscript = useCallback((transcript) => {
    setCurrentAnswer((prev) =>
      prev ? `${prev.trimEnd()} ${transcript}` : transcript
    );
  }, []);

  const { isRecording, isTranscribing, error: recorderError, toggleRecording } =
    useVoiceRecorder({ onTranscript: handleTranscript, getToken });

  const { speak: speakQuestion, stopSpeaking: stopSpeakingQuestion, isSpeaking: isQuestionSpeaking } =
    useQuestionSpeech({ getToken });

  useEffect(() => {
    return () => {
      stopSpeakingQuestion();
    };
  }, [stopSpeakingQuestion]);

  useEffect(() => {
    stopSpeakingQuestion();
  }, [currentQIndex, stopSpeakingQuestion]);

  // ── Fetch past interviews ─────────────────────────────────────────────────
  const { data: pastInterviews, isLoading: isPastLoading } = useApiQuery(
    'mockInterviews',
    API.MOCK.LIST
  );

  // ── Start interview ───────────────────────────────────────────────────────
  const startMutation = useApiMutation(API.MOCK.START, 'post', {
    onSuccess: (data) => {
      setActiveInterview(data.data);
      setCurrentQIndex(0);
      setCurrentAnswer('');
      setFinalResults(null);
    },
  });

  const handleStart = (e) => {
    e.preventDefault();
    if (!jobRole) return;
    startMutation.mutate({ jobRole, totalQuestions: Number(totalQuestions) });
  };

  // ── Submit answer ─────────────────────────────────────────────────────────
  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim() || currentAnswer.trim().length < 10) return;
    if (isRecording) toggleRecording();
    stopSpeakingQuestion();

    setIsEvaluating(true);
    try {
      const token = await getToken();
      const { data } = await api.post(
        API.MOCK.ANSWER(activeInterview._id),
        { questionIndex: currentQIndex, userAnswer: currentAnswer },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedInterview = {
        ...activeInterview,
        responses: [
          ...(activeInterview.responses || []),
          {
            questionIndex: currentQIndex,
            userAnswer: currentAnswer,
            aiEvaluation: data.data,
          },
        ],
      };
      setActiveInterview(updatedInterview);

      if (currentQIndex < activeInterview.questions.length - 1) {
        setCurrentQIndex((prev) => prev + 1);
        setCurrentAnswer('');
      } else {
        await handleComplete(updatedInterview);
      }
    } catch (err) {
      console.error('Submit answer error:', err);
      toast.error(err.response?.data?.error || 'Failed to evaluate answer. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // ── Complete interview ────────────────────────────────────────────────────
  const handleComplete = async (interviewData) => {
    try {
      const token = await getToken();
      const { data } = await api.post(
        API.MOCK.COMPLETE((interviewData || activeInterview)._id),
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFinalResults(data.data);
    } catch (err) {
      console.error('Complete interview error:', err);
      toast.error('Failed to generate final results. Please try again.');
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 7: RESULTS SCORECARD REPORT
  // ══════════════════════════════════════════════════════════════════════════
  if (finalResults) {
    const avgScore = Math.round(finalResults.overallFeedback?.averageScore || 0);
    const verdict =
      avgScore >= 80
        ? { label: 'READY FOR ONSITE', variant: 'success' }
        : avgScore >= 60
        ? { label: 'SOLID CONTENDER', variant: 'primary' }
        : { label: 'NEEDS MORE REPS', variant: 'warning' };
    const ringColor = avgScore >= 80 ? '#1F8A4C' : avgScore >= 60 ? '#1D9E4B' : '#C26A06';

    const PILLARS = [
      { label: 'Technical Accuracy', key: 'technicalAccuracy', bar: '[&>div]:bg-[#1D9E4B]' },
      { label: 'Communication Clarity', key: 'communicationClarity', bar: '[&>div]:bg-[#2496ED]' },
      { label: 'Delivery Confidence', key: 'confidenceScore', bar: '[&>div]:bg-success' },
    ];

    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <SEOHead title={`Mock Interview Report: ${finalResults.jobRole}`} />

        {/* Top Action Bar */}
        <PageHeader
          eyebrow={`Mock Interview Report · ${finalResults.questions?.length || 0} Questions Evaluated`}
          title={finalResults.jobRole}
          className="pb-2"
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={FiRotateCcw}
                onClick={() => {
                  setFinalResults(null);
                  setActiveInterview(null);
                  setCurrentQIndex(0);
                  setCurrentAnswer('');
                }}
              >
                New Session
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </>
          }
        />

        {/* Hero Scorecard Banner */}
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] bg-bg-surface border border-border-subtle shadow-md p-6 sm:p-8 lg:p-10">
            <Aura intensity={0.5} />
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-4 flex flex-col items-center text-center gap-4">
                <Eyebrow dot>Overall score</Eyebrow>
                <ScoreRing value={avgScore} size={168} stroke={10} color={ringColor}>
                  <span className="font-display font-normal tracking-[-0.05em] text-6xl text-text-primary leading-none tabular-nums">
                    <NumberTicker value={avgScore} />
                  </span>
                  <span className="font-mono text-xs text-text-muted mt-1">/100</span>
                </ScoreRing>
                <Badge variant={verdict.variant} className="font-mono uppercase tracking-wider">
                  <FiAward className="w-3.5 h-3.5" />
                  {verdict.label}
                </Badge>
              </div>

              <div className="lg:col-span-8 glass rounded-[24px] p-6 sm:p-7 space-y-3">
                <h3 className="font-display font-normal tracking-[-0.03em] text-2xl text-text-primary">
                  Overall <span className="serif italic text-[#1D9E4B]">summary</span>
                </h3>
                <p className="text-[15px] sm:text-base text-text-secondary leading-relaxed text-pretty">
                  {finalResults.overallFeedback?.recommendations ||
                    'Review each question below to compare your responses against technical accuracy, communication clarity, and delivery confidence.'}
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Strengths & Growth Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Reveal delay={0.05}>
            <div className="h-full rounded-[28px] bg-mint border border-[#5DAA3A]/15 p-6 sm:p-7">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-9 h-9 rounded-full bg-bg-surface/80 text-success flex items-center justify-center shadow-xs">
                  <FiCheckCircle className="w-4 h-4" />
                </span>
                <h3 className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary">Key Strengths</h3>
              </div>
              <ul className="space-y-3">
                {finalResults.overallFeedback?.strengths?.length > 0 ? (
                  finalResults.overallFeedback.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-text-secondary leading-relaxed">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-text-muted">Completed all interview questions.</li>
                )}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="h-full rounded-[28px] bg-peach border border-[#1D9E4B]/15 p-6 sm:p-7">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-9 h-9 rounded-full bg-bg-surface/80 text-[#1D9E4B] flex items-center justify-center shadow-xs">
                  <FiTrendingUp className="w-4 h-4" />
                </span>
                <h3 className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary">Areas to Improve</h3>
              </div>
              <ul className="space-y-3">
                {finalResults.overallFeedback?.weaknesses?.length > 0 ? (
                  finalResults.overallFeedback.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-text-secondary leading-relaxed">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#1D9E4B] flex-shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-text-muted">Continue refining depth of real-world examples.</li>
                )}
              </ul>
            </div>
          </Reveal>
        </div>

        {/* Question-by-Question Rubric Breakdown */}
        <Reveal delay={0.05}>
          <div className="space-y-4 pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display font-normal tracking-[-0.03em] text-2xl sm:text-[28px] text-text-primary">
                Question-by-Question <span className="serif italic text-[#1D9E4B]">Rubric Breakdown</span>
              </h2>
              <span className="eyebrow">3-Pillar Scoring</span>
            </div>

            <Accordion type="multiple" defaultValue={['0']} className="space-y-3">
              {finalResults.questions?.map((q, i) => {
                const response = finalResults.responses?.find((r) => r.questionIndex === i);
                if (!response) return null;
                return (
                  <AccordionItem
                    key={i}
                    value={String(i)}
                    className="rounded-[24px] border border-border-subtle bg-bg-surface shadow-xs px-5 sm:px-7 last:border-b"
                  >
                    <AccordionTrigger className="py-5 hover:no-underline hover:text-text-primary">
                      <span className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                        <span className="px-2.5 py-1 rounded-full bg-peach text-[#167A3A] font-mono text-xs font-medium flex-shrink-0 mt-0.5">
                          Q{String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1 space-y-2">
                          <span className="block font-display font-normal tracking-[-0.02em] text-base sm:text-lg text-text-primary leading-snug break-words">
                            {q.question}
                          </span>
                          {q.category && <Badge variant="secondary">{q.category}</Badge>}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 space-y-4">
                      {/* Candidate Response */}
                      <div className="p-5 rounded-[20px] bg-bg-elevated">
                        <span className="eyebrow block mb-2.5">
                          Your Recorded / Written Response
                        </span>
                        <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap break-words">
                          "{response.userAnswer}"
                        </p>
                      </div>

                      {/* 3 Rubric Pillars */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {PILLARS.map(({ label, key, bar }) => {
                          const val = Number(response.aiEvaluation?.[key] ?? 0);
                          return (
                            <div
                              key={key}
                              className="p-4 rounded-[18px] bg-bg-surface border border-border-subtle"
                            >
                              <div className="flex items-baseline justify-between mb-3 gap-2">
                                <span className="text-xs text-text-secondary">{label}</span>
                                <span className="font-display font-normal tracking-[-0.03em] text-lg text-text-primary tabular-nums">
                                  {val}<span className="text-xs text-text-muted">/10</span>
                                </span>
                              </div>
                              <Progress
                                value={Math.min(100, val * 10)}
                                className={`h-1.5 bg-bg-elevated ${bar}`}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* AI Feedback */}
                      <div className="p-5 rounded-[20px] bg-lilac">
                        <span className="eyebrow text-[#1D6FB8] dark:text-[#8EC1FF] flex items-center gap-2 mb-2.5">
                          <FiCpu className="w-3.5 h-3.5" /> AI Evaluator Notes
                        </span>
                        <p className="text-sm text-text-primary leading-relaxed">
                          {response.aiEvaluation?.feedback}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </Reveal>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 6: ACTIVE STRUCTURED INTERVIEW ARENA (light studio focus room)
  // ══════════════════════════════════════════════════════════════════════════
  if (activeInterview) {
    const currentQ = activeInterview.questions[currentQIndex];
    const isLastQuestion = currentQIndex === activeInterview.questions.length - 1;
    const canSubmit = currentAnswer.trim().length >= 10 && !isEvaluating && !isTranscribing;
    const orbState = isEvaluating
      ? 'evaluating'
      : isQuestionSpeaking
      ? 'speaking'
      : isRecording
      ? 'listening'
      : isTranscribing
      ? 'thinking'
      : 'idle';
    const progressPct = ((currentQIndex + 1) / activeInterview.questions.length) * 100;

    return (
      <div className="rounded-[32px] bg-bg-surface border border-border-subtle shadow-sm p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-7.5rem)] flex flex-col justify-between">
        <SEOHead title={`Interview Arena: ${activeInterview.jobRole}`} />

        {/* Arena Top Telemetry Bar */}
        <div className="pb-6 border-b border-border-subtle">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-peach text-[#167A3A] font-mono text-[11px] font-medium tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E4B] animate-pulse" />
                STRUCTURED ARENA
              </span>
              <h2 className="font-display font-normal tracking-[-0.03em] text-lg sm:text-xl text-text-primary break-words">
                {activeInterview.jobRole}
              </h2>
            </div>

            <span className="font-mono text-xs text-text-secondary bg-bg-elevated px-3.5 py-1.5 rounded-full tabular-nums">
              PROMPT {String(currentQIndex + 1).padStart(2, '0')}
              <span className="text-text-muted"> / </span>
              {String(activeInterview.questions.length).padStart(2, '0')}
            </span>
          </div>

          {/* Progress Bar */}
          <Progress value={progressPct} className="h-1.5 bg-bg-elevated [&>div]:duration-700 [&>div]:ease-[cubic-bezier(0.22,1,0.36,1)]" />
        </div>

        {/* Arena Center Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 my-6 flex-1">
          {/* Left Column: AI Evaluator Pod */}
          <div className="lg:col-span-4 relative overflow-hidden rounded-[28px] border border-border-subtle bg-bg-canvas p-6 flex flex-col items-center justify-between text-center">
            <Aura intensity={0.7} />
            <div className="relative w-full flex items-center justify-between">
              <span className="eyebrow">Evalix AI panel</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass font-mono text-[10px] uppercase tracking-wider text-text-primary">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    orbState === 'listening'
                      ? 'bg-[#5DAA3A] animate-pulse'
                      : orbState === 'speaking'
                      ? 'bg-[#1D9E4B] animate-pulse'
                      : orbState === 'idle'
                      ? 'bg-text-muted'
                      : 'bg-[#2496ED] animate-pulse'
                  }`}
                />
                {orbState}
              </span>
            </div>

            <div className="relative my-8 flex flex-col items-center">
              <EvalixOrb size="lg" state={orbState} />
              <p className="mt-6 font-display font-normal tracking-[-0.02em] text-lg text-text-primary">
                {isEvaluating
                  ? 'Scoring Technical & Delivery Rubric...'
                  : isQuestionSpeaking
                  ? 'Reading Prompt Aloud...'
                  : isRecording
                  ? 'Listening to Your Answer...'
                  : isTranscribing
                  ? 'Converting Speech to Text...'
                  : 'Ready for Your Response'}
              </p>
              <p className="text-sm text-text-secondary mt-1.5 max-w-xs leading-relaxed">
                Speak naturally using the voice recorder or compose a structured written response.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                isQuestionSpeaking
                  ? stopSpeakingQuestion()
                  : speakQuestion(currentQ.question)
              }
              className="relative w-full h-11 px-4 rounded-full glass shadow-xs hover:shadow-sm text-[13px] font-medium tracking-[-0.01em] text-text-primary flex items-center justify-center gap-2 transition-all cursor-pointer hover:-translate-y-0.5"
            >
              {isQuestionSpeaking ? (
                <>
                  <FiVolumeX className="w-4 h-4 text-[#1D9E4B]" />
                  <span>Stop Audio Playback</span>
                </>
              ) : (
                <>
                  <FiVolume2 className="w-4 h-4 text-[#2496ED]" />
                  <span>Listen to Question Audio</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: Active Question & Response Editor */}
          <div className="lg:col-span-8 rounded-[28px] bg-bg-surface border border-border-subtle shadow-xs p-5 sm:p-8 flex flex-col justify-between">
            {/* Active Prompt */}
            <div className="mb-7">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <Badge variant="secondary">
                  {currentQ.category || 'Technical & Behavioral'}
                </Badge>
                <span className="eyebrow">
                  Min. 10 characters required
                </span>
              </div>
              <h3
                key={`mq-${currentQIndex}`}
                className="font-display font-normal tracking-[-0.035em] text-[22px] sm:text-[28px] md:text-[32px] text-text-primary leading-[1.15] text-pretty break-words animate-fade-in"
              >
                {currentQ.question}
              </h3>
            </div>

            {/* Answer Editor or Evaluating State */}
            <div className="mt-auto">
              {isEvaluating ? (
                <div className="relative overflow-hidden flex flex-col items-center justify-center p-10 bg-lilac rounded-[24px] text-center">
                  <Loader size="md" />
                  <p className="mt-5 text-text-primary font-display font-normal tracking-[-0.02em] text-lg">
                    Evaluating your response against hiring rubrics...
                  </p>
                  <p className="text-sm text-text-secondary mt-1.5">
                    Scoring technical accuracy, communication clarity, and confidence.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnswerInput
                    text={currentAnswer}
                    setText={setCurrentAnswer}
                    isRecording={isRecording}
                    isTranscribing={isTranscribing}
                  />

                  {recorderError && (
                    <div className="flex items-start gap-2.5 text-sm text-danger bg-danger-bg p-4 rounded-[16px]">
                      <FiAlertCircle className="mt-0.5 flex-shrink-0" />
                      <span>{recorderError}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:flex-wrap justify-between sm:items-center gap-3 pt-2">
                    <Button
                      variant={isRecording ? 'danger' : 'secondary'}
                      onClick={toggleRecording}
                      icon={isRecording ? FiStopCircle : FiMic}
                      disabled={isTranscribing || isEvaluating}
                    >
                      {isRecording ? 'Stop Recording' : 'Record Voice Answer'}
                    </Button>

                    <Button
                      variant="primary"
                      onClick={handleSubmitAnswer}
                      disabled={!canSubmit}
                      icon={FiArrowRight}
                    >
                      {isLastQuestion ? 'Complete & View Scorecard' : 'Submit & Next Prompt'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 5: INTERVIEW CONFIGURATION & PAST ARCHIVE
  // ══════════════════════════════════════════════════════════════════════════
  if (startMutation.isPending) {
    return (
      <div className="relative overflow-hidden rounded-[32px] bg-bg-surface border border-border-subtle shadow-sm p-8 sm:p-10 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] text-center">
        <SEOHead title="Setting up Mock Interview..." />
        <Aura intensity={0.6} />
        <div className="relative flex flex-col items-center">
          <EvalixOrb size="lg" state="thinking" />
          <div className="w-40 h-40 my-2">
            <Lottie animationData={interviewLoader} loop={true} />
          </div>
          <Eyebrow dot>Building your session</Eyebrow>
          <h2 className="heading-page text-text-primary mt-4 max-w-2xl text-balance break-words">
            Preparing {totalQuestions} Questions for{' '}
            <span className="serif italic text-[#1D9E4B]">{jobRole}</span>...
          </h2>
          <p className="text-[15px] text-text-secondary mt-4 max-w-md leading-relaxed">
            Generating role-specific technical and behavioral questions with 3-pillar scoring rubrics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <SEOHead title="Structured Mock Interview — Evalix" />

      {/* Header */}
      <PageHeader
        eyebrow="Mock interview"
        title="Structured Mock"
        accent="Interview"
        className="pb-4"
        description={
          <>
            Practice <strong className="text-text-primary font-medium">3, 5, or 8 role-specific questions</strong> at your own pace. Speak or type responses and get scored on <strong className="text-text-primary font-medium">Technical Accuracy, Clarity, and Confidence</strong>.
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* Left: Configuration Card (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <Reveal>
            <Card padding="p-6 sm:p-7" className="rounded-[28px]">
              <form onSubmit={handleStart} className="space-y-7">
                <div>
                  <Input
                    id="jobRole"
                    label="1. Target Role or Track"
                    placeholder="e.g., Full Stack Engineer (React / Node.js)"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    required
                  />
                  <div className="mt-4">
                    <span className="eyebrow block mb-2.5">
                      Quick role presets
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {MOCK_ROLE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setJobRole(preset)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-300 cursor-pointer ${
                            jobRole === preset
                              ? 'bg-peach text-[#167A3A] dark:text-[#6FD394] border-[#1D9E4B]/30 font-medium'
                              : 'bg-bg-surface border-border-subtle text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <label className="text-xs font-mono uppercase tracking-wider font-medium text-text-secondary">
                    2. Number of Questions <span className="text-[#1D9E4B]">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-bg-elevated">
                    {MOCK_QUESTION_COUNTS.map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setTotalQuestions(opt)}
                        aria-pressed={totalQuestions === opt}
                        className={`cursor-pointer text-center h-10 rounded-full transition-all duration-300 font-display font-normal text-[13px] sm:text-sm tracking-[-0.01em] whitespace-nowrap ${
                          totalQuestions === opt
                            ? 'bg-bg-surface text-text-primary shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {opt} Questions
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  fullWidth
                  loading={startMutation.isPending}
                  disabled={!jobRole}
                  icon={FiPlay}
                  size="lg"
                  variant="primary"
                >
                  Start Mock Interview
                </Button>
              </form>
            </Card>
          </Reveal>

          {/* Briefing Card */}
          <Reveal delay={0.08}>
            <div className="rounded-[28px] bg-lilac border border-[#2496ED]/15 p-6 sm:p-7">
              <Eyebrow className="text-[#1D6FB8] dark:text-[#8EC1FF]">3-Pillar Rubric (0–10 each)</Eyebrow>
              <h4 className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary mt-3 mb-5">
                How scoring <span className="serif italic text-[#2496ED]">works</span>
              </h4>
              <ul className="space-y-3.5 text-sm text-text-secondary">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-bg-surface text-[#1D9E4B] font-mono text-[11px] flex items-center justify-center shrink-0 shadow-xs">1</span>
                  <span className="leading-relaxed"><strong className="text-text-primary font-medium">Technical Accuracy:</strong> Depth and correctness of your engineering explanation.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-bg-surface text-[#2496ED] font-mono text-[11px] flex items-center justify-center shrink-0 shadow-xs">2</span>
                  <span className="leading-relaxed"><strong className="text-text-primary font-medium">Communication Clarity:</strong> Logical structure and conciseness.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-bg-surface text-success font-mono text-[11px] flex items-center justify-center shrink-0 shadow-xs">3</span>
                  <span className="leading-relaxed"><strong className="text-text-primary font-medium">Delivery Confidence:</strong> Directness and use of concrete examples.</span>
                </li>
              </ul>
            </div>
          </Reveal>
        </div>

        {/* Right: Past Interviews Archive (7 cols) */}
        <div className="lg:col-span-7">
          <Reveal delay={0.05}>
            <Card padding="p-6 sm:p-7" className="rounded-[28px] min-h-[480px]">
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between gap-3 pb-5 mb-5 border-b border-border-subtle">
                  <div>
                    <h3 className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary">
                      Past mock <span className="serif italic text-[#1D9E4B]">sessions</span>
                    </h3>
                    <p className="text-sm text-text-muted mt-1">
                      Click any completed session to inspect its full scorecard
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-bg-elevated font-mono text-xs text-text-secondary shrink-0 tabular-nums">
                    {pastInterviews?.data?.length || 0} Total
                  </span>
                </div>

                {isPastLoading ? (
                  <div className="flex-1 flex justify-center items-center py-16">
                    <Loader />
                  </div>
                ) : pastInterviews?.data?.length > 0 ? (
                  <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[520px] pr-1 -mr-1">
                    {pastInterviews.data.map((interview) => {
                      const score = Math.round(interview.overallFeedback?.averageScore || 0);
                      const isCompleted = interview.status === 'completed';
                      return (
                        <div
                          key={interview._id}
                          onClick={() => {
                            if (isCompleted) setFinalResults(interview);
                          }}
                          className={`group p-4 rounded-[20px] border border-border-subtle bg-bg-surface transition-all duration-300 flex items-center justify-between gap-3 ${
                            isCompleted
                              ? 'hover:bg-surface-hover hover:shadow-sm hover:-translate-y-0.5 cursor-pointer'
                              : 'opacity-75'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {isCompleted ? (
                              <ScoreRing value={score} size={44} stroke={4} color="#1D9E4B" className="shrink-0">
                                <span className="font-mono text-[11px] text-text-primary tabular-nums">{score}</span>
                              </ScoreRing>
                            ) : (
                              <span className="w-11 h-11 rounded-full bg-warning-bg text-warning flex items-center justify-center shrink-0">
                                <FiClock className="w-4 h-4" />
                              </span>
                            )}
                            <div className="min-w-0">
                              <h4 className="font-display font-normal tracking-[-0.02em] text-sm sm:text-base text-text-primary truncate">
                                {interview.jobRole}
                              </h4>
                              <p className="text-xs font-mono text-text-muted mt-1">
                                {new Date(interview.createdAt).toLocaleDateString()} •{' '}
                                <span className="text-text-secondary">{interview.questions?.length || 0} Questions</span>
                                {isCompleted ? <span className="hidden sm:inline">{` • Score: ${score}%`}</span> : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            {isCompleted ? (
                              <>
                                <Badge variant="success" className="hidden sm:inline-flex">{score}% Score</Badge>
                                <span className="w-8 h-8 rounded-full bg-bg-elevated text-text-secondary group-hover:bg-[#1D9E4B] group-hover:text-white flex items-center justify-center transition-colors" aria-label="View Report">
                                  <FiArrowRight className="w-3.5 h-3.5" />
                                </span>
                              </>
                            ) : (
                              <Badge variant="warning">Incomplete</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-center items-center text-center py-12 rounded-[24px] bg-bg-canvas">
                    <EvalixOrb size="md" state="idle" />
                    <p className="font-display font-normal tracking-[-0.02em] text-lg text-text-primary mt-5">
                      No mock sessions yet
                    </p>
                    <p className="text-sm text-text-secondary mt-1.5 max-w-xs">
                      Select a target role on the left to start your first mock interview.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
};

export default MockInterview;
