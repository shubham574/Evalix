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

// ─── Answer textarea with voice indicator (Arena dark styled) ─────────────────
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
      className={`w-full px-4 py-3.5 rounded-[14px] border-2 bg-[#141414] text-[#F8F5EF] placeholder-[#F8F5EF]/35 resize-none transition-all duration-200 outline-none text-sm sm:text-base leading-relaxed ${
        isRecording
          ? 'border-[#C7F36B] ring-2 ring-[#C7F36B]/20'
          : isTranscribing
          ? 'border-[#F59E0B] ring-2 ring-[#F59E0B]/20 opacity-75'
          : 'border-[#2E2E2E] focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20'
      }`}
    />

    {isRecording && (
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[#C7F36B]/15 border border-[#C7F36B]/40 text-[#C7F36B] px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider animate-pulse pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-[#C7F36B] inline-block" />
        Recording Live
      </div>
    )}

    {isTranscribing && (
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[#8174FF]/15 border border-[#8174FF]/40 text-[#8174FF] px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider pointer-events-none">
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
        ? { label: 'READY FOR ONSITE', bg: 'bg-[#C7F36B]', text: 'text-[#151515]' }
        : avgScore >= 60
        ? { label: 'SOLID CONTENDER', bg: 'bg-[#FF6B35]', text: 'text-white' }
        : { label: 'NEEDS MORE REPS', bg: 'bg-[#F59E0B]', text: 'text-[#151515]' };

    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <SEOHead title={`Mock Interview Report: ${finalResults.jobRole}`} />

        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35] font-mono text-[11px] font-semibold uppercase tracking-widest">
                Mock Interview Report
              </span>
              <span className="text-xs font-mono text-text-muted">
                {finalResults.questions?.length || 0} Questions Evaluated
              </span>
            </div>
            <h1 className="heading-page text-text-primary">{finalResults.jobRole}</h1>
          </div>
          <div className="flex items-center gap-3">
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
          </div>
        </div>

        {/* Hero Scorecard Banner */}
        <div className="rounded-[24px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-4 flex flex-col items-center lg:items-start text-center lg:text-left border-b lg:border-b-0 lg:border-r border-[#2E2E2E] pb-6 lg:pb-0 lg:pr-6">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#F8F5EF]/60 mb-2">
                Overall Score
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className="font-editorial text-6xl sm:text-7xl leading-none"
                  style={{
                    color: avgScore >= 80 ? '#C7F36B' : avgScore >= 60 ? '#FF6B35' : '#EF4444',
                  }}
                >
                  {avgScore}
                </span>
                <span className="font-mono text-xl text-[#F8F5EF]/50">/100</span>
              </div>
              <span
                className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${verdict.bg} ${verdict.text}`}
              >
                {verdict.label}
              </span>
            </div>

            <div className="lg:col-span-8 space-y-2">
              <h3 className="font-display font-bold text-lg text-[#F8F5EF]">
                Overall Summary
              </h3>
              <p className="text-sm sm:text-base text-[#F8F5EF]/90 leading-relaxed">
                {finalResults.overallFeedback?.recommendations ||
                  'Review each question below to compare your responses against technical accuracy, communication clarity, and delivery confidence.'}
              </p>
            </div>
          </div>
        </div>

        {/* Strengths & Growth Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 border border-border-subtle">
            <h3 className="heading-card text-text-primary mb-4">Key Strengths</h3>
            <ul className="space-y-2.5">
              {finalResults.overallFeedback?.strengths?.length > 0 ? (
                finalResults.overallFeedback.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <span className="text-emerald-600 dark:text-[#C7F36B] font-mono font-bold flex-shrink-0">
                      •
                    </span>
                    <span>{s}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-text-muted">Completed all interview questions.</li>
              )}
            </ul>
          </Card>

          <Card className="p-6 border border-border-subtle">
            <h3 className="heading-card text-text-primary mb-4">Areas to Improve</h3>
            <ul className="space-y-2.5">
              {finalResults.overallFeedback?.weaknesses?.length > 0 ? (
                finalResults.overallFeedback.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <span className="text-[#FF6B35] font-mono font-bold flex-shrink-0">
                      •
                    </span>
                    <span>{w}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-text-muted">Continue refining depth of real-world examples.</li>
              )}
            </ul>
          </Card>
        </div>

        {/* Question-by-Question Rubric Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="heading-card text-text-primary">Question-by-Question Rubric Breakdown</h2>
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
              3-Pillar Scoring
            </span>
          </div>

          {finalResults.questions?.map((q, i) => {
            const response = finalResults.responses?.find((r) => r.questionIndex === i);
            if (!response) return null;
            return (
              <Card key={i} className="p-6 border-2 border-border-subtle space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-border-subtle">
                  <div className="flex items-start gap-3">
                    <span className="px-2.5 py-1 rounded-[8px] bg-[#151515] text-[#F8F5EF] font-mono text-xs font-bold flex-shrink-0">
                      Q{String(i + 1).padStart(2, '0')}
                    </span>
                    <h4 className="font-display font-bold text-base sm:text-lg text-text-primary leading-snug">
                      {q.question}
                    </h4>
                  </div>
                  {q.category && <Badge variant="primary">{q.category}</Badge>}
                </div>

                {/* Candidate Response */}
                <div className="p-4 rounded-[14px] bg-bg-canvas border border-border-subtle">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-text-muted block mb-1.5">
                    Your Recorded / Written Response
                  </span>
                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                    "{response.userAnswer}"
                  </p>
                </div>

                {/* 3 Rubric Pillars */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Technical Accuracy', key: 'technicalAccuracy', accent: '#FF6B35' },
                    { label: 'Communication Clarity', key: 'communicationClarity', accent: '#8174FF' },
                    { label: 'Delivery Confidence', key: 'confidenceScore', accent: '#10B981' },
                  ].map(({ label, key, accent }) => {
                    const val = Number(response.aiEvaluation?.[key] ?? 0);
                    return (
                      <div
                        key={key}
                        className="p-3.5 rounded-[12px] bg-bg-canvas border border-border-subtle"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono text-text-secondary">{label}</span>
                          <span className="font-mono font-bold text-sm text-text-primary">
                            {val}/10
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-border-subtle overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, val * 10)}%`, backgroundColor: accent }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AI Feedback */}
                <div className="p-4 rounded-[14px] bg-[#8174FF]/10 border border-[#8174FF]/25">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-[#8174FF] font-semibold block mb-1">
                    AI Evaluator Notes
                  </span>
                  <p className="text-sm text-text-primary leading-relaxed">
                    {response.aiEvaluation?.feedback}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 6: ACTIVE STRUCTURED INTERVIEW ARENA (Dark High-Contrast Focus)
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

    return (
      <div className="theme-interview rounded-[24px] bg-[#151515] text-[#F8F5EF] border-2 border-[#2E2E2E] p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-7.5rem)] flex flex-col justify-between shadow-xl">
        <SEOHead title={`Interview Arena: ${activeInterview.jobRole}`} />

        {/* Arena Top Telemetry Bar */}
        <div className="pb-5 border-b border-[#2E2E2E]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B35]/15 border border-[#FF6B35]/40 text-[#FF6B35] font-mono text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#FF6B35] animate-pulse" />
                STRUCTURED ARENA
              </span>
              <h2 className="font-display font-bold text-lg sm:text-xl text-[#F8F5EF]">
                {activeInterview.jobRole}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-[#F8F5EF]/70 bg-[#1F1F1F] px-3 py-1.5 rounded-[10px] border border-[#2E2E2E]">
                PROMPT {String(currentQIndex + 1).padStart(2, '0')} /{' '}
                {String(activeInterview.questions.length).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#1F1F1F] border border-[#2E2E2E] rounded-full h-2 overflow-hidden">
            <motion.div
              className="bg-[#C7F36B] h-full rounded-full"
              initial={{ width: 0 }}
              animate={{
                width: `${((currentQIndex + 1) / activeInterview.questions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Arena Center Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 flex-1">
          {/* Left Column: AI Evaluator Pod */}
          <div className="lg:col-span-4 rounded-[20px] bg-[#1F1F1F] border border-[#2E2E2E] p-6 flex flex-col items-center justify-between text-center">
            <div className="w-full flex items-center justify-between text-xs font-mono text-[#F8F5EF]/60">
              <span>EVALIX AI PANEL</span>
              <span className=" uppercase text-[#C7F36B]">{orbState}</span>
            </div>

            <div className="my-6 flex flex-col items-center">
              <EvalixOrb size="lg" state={orbState} />
              <p className="mt-4 font-display font-bold text-base text-[#F8F5EF]">
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
              <p className="text-xs text-[#F8F5EF]/55 mt-1 max-w-xs">
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
              className="w-full py-2.5 px-4 rounded-[12px] bg-[#282828] hover:bg-[#323232] border border-[#3A3A3A] text-xs font-mono uppercase tracking-wider text-[#F8F5EF] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isQuestionSpeaking ? (
                <>
                  <FiVolumeX className="w-4 h-4 text-[#FF6B35]" />
                  <span>Stop Audio Playback</span>
                </>
              ) : (
                <>
                  <FiVolume2 className="w-4 h-4 text-[#C7F36B]" />
                  <span>Listen to Question Audio</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: Active Question & Response Editor */}
          <div className="lg:col-span-8 rounded-[20px] bg-[#1F1F1F] border border-[#2E2E2E] p-6 sm:p-8 flex flex-col justify-between">
            {/* Active Prompt */}
            <div className="mb-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-3 py-1 rounded-full bg-[#8174FF]/15 border border-[#8174FF]/30 text-[#8174FF] font-mono text-xs font-semibold">
                  {currentQ.category || 'Technical & Behavioral'}
                </span>
                <span className="text-xs font-mono text-[#F8F5EF]/45">
                  Min. 10 characters required
                </span>
              </div>
              <h3 className="font-display font-bold text-xl sm:text-2xl md:text-3xl text-[#F8F5EF] leading-snug">
                {currentQ.question}
              </h3>
            </div>

            {/* Answer Editor or Evaluating State */}
            <div className="mt-auto">
              {isEvaluating ? (
                <div className="flex flex-col items-center justify-center p-10 bg-[#141414] rounded-[16px] border border-[#2E2E2E]">
                  <Loader size="md" />
                  <p className="mt-4 text-[#F8F5EF] font-display font-bold">
                    Evaluating your response against hiring rubrics...
                  </p>
                  <p className="text-xs text-[#F8F5EF]/60 mt-1">
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
                    <div className="flex items-start gap-2 text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 p-3 rounded-[10px]">
                      <FiAlertCircle className="mt-0.5 flex-shrink-0" />
                      <span>{recorderError}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
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
      <div className="rounded-[24px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-10 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] text-center">
        <SEOHead title="Setting up Mock Interview..." />
        <EvalixOrb size="lg" state="thinking" />
        <div className="w-40 h-40 my-2">
          <Lottie animationData={interviewLoader} loop={true} />
        </div>
        <h2 className="heading-section text-[#F8F5EF]">
          Preparing {totalQuestions} Questions for {jobRole}...
        </h2>
        <p className="text-sm text-[#F8F5EF]/65 mt-2 max-w-md">
          Generating role-specific technical and behavioral questions with 3-pillar scoring rubrics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <SEOHead title="Structured Mock Interview — Evalix" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <h1 className="heading-page text-text-primary">Structured Mock Interview</h1>
          <p className="text-sm sm:text-base text-text-secondary mt-1">
            Practice <strong className="text-text-primary font-semibold">3, 5, or 8 role-specific questions</strong> at your own pace. Speak or type responses and get scored on <strong className="text-text-primary font-semibold">Technical Accuracy, Clarity, and Confidence</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Configuration Card (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6 border border-border-subtle">
            <form onSubmit={handleStart} className="space-y-5">
              <div>
                <Input
                  id="jobRole"
                  label="1. Target Role or Track"
                  placeholder="e.g., Full Stack Engineer (React / Node.js)"
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  required
                />
                <div className="mt-2.5">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted block mb-1.5">
                    Quick Role Presets:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {MOCK_ROLE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setJobRole(preset)}
                        className={`text-xs px-2.5 py-1 rounded-[8px] border transition-all cursor-pointer ${
                          jobRole === preset
                            ? 'bg-[#151515] text-[#F8F5EF] border-[#151515] dark:bg-[#FF6B35] dark:border-[#FF6B35] font-medium'
                            : 'bg-bg-canvas border-border-subtle text-text-secondary hover:border-text-primary'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-mono uppercase tracking-wider font-semibold text-text-secondary">
                  2. Number of Questions <span className="text-[#FF6B35]">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {MOCK_QUESTION_COUNTS.map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setTotalQuestions(opt)}
                      className={`cursor-pointer text-center py-3 rounded-[12px] border transition-all font-display font-bold ${
                        totalQuestions === opt
                          ? 'border-[#151515] bg-[#FF6B35] text-white'
                          : 'border-border-subtle bg-bg-canvas text-text-secondary hover:border-text-primary'
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

          {/* Briefing Card */}
          <div className="rounded-[20px] bg-[#151515] text-[#F8F5EF] p-6 border border-[#2E2E2E]">
            <h4 className="font-display font-bold text-base text-[#F8F5EF] mb-1">
              How Scoring Works
            </h4>
            <p className="text-xs font-mono text-[#C7F36B] mb-4">3-Pillar Rubric (0–10 each)</p>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#F8F5EF]/80">
              <li className="flex items-start gap-2">
                <span className="text-[#FF6B35] font-mono font-bold">1.</span>
                <span><strong className="text-white">Technical Accuracy:</strong> Depth and correctness of your engineering explanation.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#C7F36B] font-mono font-bold">2.</span>
                <span><strong className="text-white">Communication Clarity:</strong> Logical structure and conciseness.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#8174FF] font-mono font-bold">3.</span>
                <span><strong className="text-white">Delivery Confidence:</strong> Directness and use of concrete examples.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right: Past Interviews Archive (7 cols) */}
        <div className="lg:col-span-7">
          <Card className="p-6 border border-border-subtle min-h-[480px] flex flex-col">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-border-subtle">
              <div>
                <h3 className="heading-card text-text-primary">Past Mock Sessions</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Click any completed session to inspect its full scorecard
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-bg-canvas border border-border-subtle font-mono text-xs text-text-secondary">
                {pastInterviews?.data?.length || 0} Total
              </span>
            </div>

            {isPastLoading ? (
              <div className="flex-1 flex justify-center items-center py-16">
                <Loader />
              </div>
            ) : pastInterviews?.data?.length > 0 ? (
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[520px] pr-1">
                {pastInterviews.data.map((interview) => {
                  const score = Math.round(interview.overallFeedback?.averageScore || 0);
                  const isCompleted = interview.status === 'completed';
                  return (
                    <div
                      key={interview._id}
                      onClick={() => {
                        if (isCompleted) setFinalResults(interview);
                      }}
                      className={`p-4 rounded-[14px] border border-border-subtle bg-bg-canvas transition-all flex flex-wrap justify-between items-center gap-3 ${
                        isCompleted
                          ? 'hover:border-[#151515] dark:hover:border-[#FF6B35] cursor-pointer'
                          : 'opacity-80'
                      }`}
                    >
                      <div>
                        <h4 className="font-display font-bold text-sm sm:text-base text-text-primary">
                          {interview.jobRole}
                        </h4>
                        <p className="text-xs font-mono text-text-muted mt-0.5">
                          {new Date(interview.createdAt).toLocaleDateString()} •{' '}
                          <strong className="text-text-primary">{interview.questions?.length || 0} Questions</strong>
                          {isCompleted ? ` • Score: ${score}%` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {isCompleted ? (
                          <>
                            <Badge variant="success">{score}% Score</Badge>
                            <span className="text-xs font-mono text-[#FF6B35] font-semibold hidden sm:inline">
                              View Report →
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
              <div className="flex-1 flex flex-col justify-center items-center text-center py-12">
                <EvalixOrb size="md" state="idle" />
                <p className="font-display font-bold text-base text-text-primary mt-4">
                  No mock sessions yet
                </p>
                <p className="text-xs text-text-secondary mt-1 max-w-xs">
                  Select a target role on the left to start your first mock interview.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MockInterview;
