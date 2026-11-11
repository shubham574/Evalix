import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  FiVideo, FiMic, FiStopCircle, FiCheckCircle,
  FiPlay, FiArrowRight, FiAlertCircle, FiLoader,
  FiVolume2, FiVolumeX,
} from 'react-icons/fi';
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

// ─── Answer textarea with voice indicator ─────────────────────────────────────
const AnswerInput = ({ text, setText, isRecording, isTranscribing }) => (
  <div className="w-full relative">
    <textarea
      id="answer"
      rows={6}
      placeholder={
        isRecording
          ? '🎙️ Recording... speak clearly, then click Stop Recording'
          : isTranscribing
          ? '⏳ Transcribing your speech...'
          : 'Type your answer here, or click "Record Answer" to use your voice...'
      }
      value={text}
      onChange={(e) => setText(e.target.value)}
      disabled={isTranscribing}
      className={`w-full px-4 py-3 rounded-xl border-2 bg-bg-surface text-text-primary placeholder-text-secondary resize-none transition-all duration-200 outline-none text-base leading-relaxed ${
        isRecording
          ? 'border-danger ring-2 ring-danger/20'
          : isTranscribing
          ? 'border-warning ring-2 ring-warning/20 opacity-70'
          : 'border-border-subtle focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20'
      }`}
    />

    {isRecording && (
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-danger/10 text-danger px-2 py-1 rounded-lg text-xs font-medium animate-pulse pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-danger inline-block" />
        Recording
      </div>
    )}

    {isTranscribing && (
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-warning/10 text-warning px-2 py-1 rounded-lg text-xs font-medium pointer-events-none">
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

  // ── Results screen ────────────────────────────────────────────────────────
  if (finalResults) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <SEOHead title={`Mock Interview Results: ${finalResults.jobRole}`} />

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-text-primary">Mock Interview Results</h1>
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 flex flex-col items-center justify-center p-8 text-center border-t-4 border-t-accent-primary bg-bg-surface border-border-subtle shadow-md shadow-accent-primary/5">
            <h3 className="text-lg font-medium text-text-secondary mb-4">Overall Performance</h3>
            <div
              className="w-32 h-32 rounded-full border-8 flex items-center justify-center mb-4"
              style={{
                borderColor:
                  finalResults.overallFeedback?.averageScore >= 80
                    ? '#10b981'
                    : finalResults.overallFeedback?.averageScore >= 60
                    ? '#f59e0b'
                    : '#ef4444',
              }}
            >
              <span className="text-4xl font-bold text-text-primary">
                {finalResults.overallFeedback?.averageScore}%
              </span>
            </div>
            <p className="text-text-primary font-medium">
              {finalResults.overallFeedback?.averageScore >= 80
                ? 'Outstanding!'
                : finalResults.overallFeedback?.averageScore >= 60
                ? 'Good effort!'
                : 'Keep practicing!'}
            </p>
          </Card>

          <Card className="col-span-2 p-6 bg-bg-surface border-border-subtle shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-bold text-success mb-3 flex items-center">
                  <span className="text-2xl mr-2">🌟</span> Key Strengths
                </h3>
                <ul className="space-y-2">
                  {finalResults.overallFeedback?.strengths?.map((s, i) => (
                    <li key={i} className="flex items-start text-sm text-text-secondary">
                      <FiCheckCircle className="text-success mt-1 mr-2 flex-shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-warning mb-3 flex items-center">
                  <span className="text-2xl mr-2">📈</span> Areas for Improvement
                </h3>
                <ul className="space-y-2">
                  {finalResults.overallFeedback?.weaknesses?.map((w, i) => (
                    <li key={i} className="flex items-start text-sm text-text-secondary">
                      <div className="w-1.5 h-1.5 rounded-full bg-warning mt-2 mr-2 flex-shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 bg-accent-primary/10 border-accent-glow/30 shadow-md">
          <h3 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
            <span className="text-xl">🤖</span> AI Recommendations
          </h3>
          <p className="text-text-secondary leading-relaxed">{finalResults.overallFeedback?.recommendations}</p>
        </Card>

        <h3 className="text-2xl font-bold text-text-primary mt-10 mb-4">Detailed Question Review</h3>
        <div className="space-y-6 pb-10">
          {finalResults.questions?.map((q, i) => {
            const response = finalResults.responses?.find((r) => r.questionIndex === i);
            if (!response) return null;
            return (
              <Card key={i} className="p-6 bg-bg-surface border-border-subtle shadow-sm">
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-border-subtle">
                  <h4 className="text-lg font-medium text-text-primary">
                    <span className="text-accent-primary font-bold mr-2">Q{i + 1}.</span>
                    {q.question}
                  </h4>
                </div>

                <div className="bg-bg-canvas p-4 rounded-xl border border-border-subtle mb-5">
                  <span className="text-xs uppercase font-bold text-text-secondary mb-2 block tracking-wider">Your Answer:</span>
                  <p className="text-text-primary italic">"{response.userAnswer}"</p>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    { label: 'Technical', key: 'technicalAccuracy' },
                    { label: 'Communication', key: 'communicationClarity' },
                    { label: 'Confidence', key: 'confidenceScore' },
                  ].map(({ label, key }) => (
                    <div key={key} className="bg-bg-canvas p-3 rounded-xl text-center border border-border-subtle">
                      <span className="text-xs text-text-secondary uppercase tracking-wider block mb-1">{label}</span>
                      <span className={`font-bold text-sm ${getGradeColor((response.aiEvaluation?.[key] || 0) * 10)}`}>
                        {response.aiEvaluation?.[key] ?? '–'}/10
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-accent-primary/10 p-5 rounded-xl border border-accent-primary/20">
                  <span className="text-xs uppercase font-bold text-accent-primary mb-2 block tracking-wider">AI Feedback:</span>
                  <p className="text-sm text-text-primary leading-relaxed">{response.aiEvaluation?.feedback}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Active interview screen ───────────────────────────────────────────────
  if (activeInterview) {
    const currentQ = activeInterview.questions[currentQIndex];
    const isLastQuestion = currentQIndex === activeInterview.questions.length - 1;
    const canSubmit = currentAnswer.trim().length >= 10 && !isEvaluating && !isTranscribing;

    return (
      <div className="max-w-4xl mx-auto w-full min-h-[calc(100vh-8rem)] flex flex-col">
        <SEOHead title={`Interview: ${activeInterview.jobRole}`} />

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold text-text-primary">{activeInterview.jobRole} Interview</h2>
            <span className="text-sm font-medium text-text-secondary">
              Question {currentQIndex + 1} of {activeInterview.questions.length}
            </span>
          </div>
          <div className="w-full bg-bg-surface border border-border-subtle rounded-full h-2">
            <motion.div
              className="bg-accent-primary h-2 rounded-full shadow-[0_0_10px_var(--color-accent-primary)]"
              initial={{ width: 0 }}
              animate={{ width: `${(currentQIndex / activeInterview.questions.length) * 100}%` }}
            />
          </div>
        </div>

        <Card className="flex-1 flex flex-col mb-6" padding="p-0">
          <div className="flex-1 flex flex-col p-6 md:p-10">
            {/* Question */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="secondary">
                  {currentQ.category}
                </Badge>
                <button
                  type="button"
                  onClick={() => (isQuestionSpeaking ? stopSpeakingQuestion() : speakQuestion(currentQ.question))}
                  className="flex items-center gap-1.5 text-xs text-accent-primary hover:text-accent-glow font-medium bg-accent-primary/10 hover:bg-accent-primary/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  title={isQuestionSpeaking ? 'Stop speaking question' : 'Listen to question'}
                >
                  {isQuestionSpeaking ? <FiVolumeX className="w-4 h-4" /> : <FiVolume2 className="w-4 h-4" />}
                  <span>{isQuestionSpeaking ? 'Stop Voice' : 'Listen to Question'}</span>
                </button>
              </div>
              <h3 className="text-2xl md:text-3xl font-medium text-text-primary leading-tight">
                {currentQ.question}
              </h3>
            </div>

            {/* Answer area */}
            <div className="flex-1 flex flex-col justify-end">
              {isEvaluating ? (
                <div className="flex flex-col items-center justify-center p-10 bg-bg-surface rounded-xl border border-border-subtle">
                  <Loader size="md" />
                  <p className="mt-4 text-text-primary font-medium">AI is evaluating your response...</p>
                  <p className="text-sm text-text-secondary mt-1">Analysing technical accuracy and communication.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnswerInput
                    text={currentAnswer}
                    setText={setCurrentAnswer}
                    isRecording={isRecording}
                    isTranscribing={isTranscribing}
                  />

                  {/* Recorder error */}
                  {recorderError && (
                    <div className="flex items-start gap-2 text-sm text-error bg-error/5 border border-error/20 p-3 rounded-lg">
                      <FiAlertCircle className="mt-0.5 flex-shrink-0" />
                      <span>{recorderError}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2">
                    <Button
                      variant={isRecording ? 'danger' : 'secondary'}
                      onClick={toggleRecording}
                      icon={isRecording ? FiStopCircle : FiMic}
                      disabled={isTranscribing || isEvaluating}
                    >
                      {isRecording ? 'Stop Recording' : 'Record Answer'}
                    </Button>

                    <Button
                      variant="primary"
                      onClick={handleSubmitAnswer}
                      disabled={!canSubmit}
                      icon={FiArrowRight}
                    >
                      {isLastQuestion ? 'Finish Interview' : 'Submit & Next'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (startMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
        <SEOHead title="Setting up Interview..." />
        <div className="w-64 h-64 mb-4">
          <Lottie animationData={interviewLoader} loop={true} />
        </div>
        <h2 className="text-xl font-bold text-text-primary animate-pulse">Preparing your interview...</h2>
        <p className="text-text-secondary mt-2">Our AI is generating contextual questions for your role.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-8rem)]">
      <SEOHead title="Mock Interview" />

      {/* Left – form */}
      <div className="w-full lg:w-1/3 flex flex-col space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Mock Interview</h1>
          <p className="text-text-secondary mt-1">
            Practice with an AI interviewer. Speak or type your answers and get instant AI feedback.
          </p>
        </div>

        <Card>
          <form onSubmit={handleStart} className="space-y-5">
            <Input
              id="jobRole"
              label="Target Role"
              placeholder="e.g., Full Stack Engineer"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              required
            />

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

            <Button
              type="submit"
              fullWidth
              loading={startMutation.isPending}
              disabled={!jobRole}
              icon={FiPlay}
              className="mt-4"
              variant="primary"
            >
              Start Interview
            </Button>
          </form>
        </Card>

        <Card className="bg-bg-surface border-border-subtle shadow-lg shadow-accent-primary/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent-primary/10 via-transparent to-transparent pointer-events-none blur-3xl" />
          <h4 className="font-bold text-text-primary mb-3 flex items-center relative z-10">
            <FiVideo className="mr-2 text-accent-primary" /> How it works
          </h4>
          <ul className="space-y-3 text-sm text-text-secondary relative z-10">
            <li className="flex items-start"><span className="text-accent-primary mr-2">•</span> AI generates contextual questions for your role</li>
            <li className="flex items-start"><span className="text-accent-primary mr-2">•</span> Click <strong>Record Answer</strong> and speak naturally</li>
            <li className="flex items-start"><span className="text-accent-primary mr-2">•</span> Gemini AI transcribes your speech</li>
            <li className="flex items-start"><span className="text-accent-primary mr-2">•</span> Gemini AI evaluates your technical accuracy &amp; confidence</li>
            <li className="flex items-start"><span className="text-accent-primary mr-2">•</span> Get a full report with strengths &amp; improvements</li>
          </ul>
        </Card>
      </div>

      {/* Right – past interviews */}
      <div className="w-full lg:w-2/3 flex flex-col">
        {startMutation.isPending ? (
          <Card className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
            <Loader size="lg" />
            <h3 className="text-xl font-bold mt-6 text-text-primary">Preparing your interview...</h3>
            <p className="text-text-secondary mt-2 text-center max-w-md">
              The AI is reviewing the role requirements and preparing customised questions. Get ready!
            </p>
          </Card>
        ) : (
          <Card className="flex-1 flex flex-col min-h-[500px]">
            <h3 className="text-xl font-bold text-text-primary mb-6 border-b border-border pb-4">
              Past Interviews
            </h3>

            {isPastLoading ? (
              <div className="flex-1 flex justify-center items-center">
                <Loader />
              </div>
            ) : pastInterviews?.data?.length > 0 ? (
              <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-thin">
                {pastInterviews.data.map((interview) => (
                  <div
                    key={interview._id}
                    className="p-4 rounded-xl border border-border-subtle bg-bg-surface hover:border-accent-primary/30 transition-all flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-text-primary">{interview.jobRole}</h4>
                      <p className="text-sm text-text-secondary mt-1">
                        {new Date(interview.createdAt).toLocaleDateString()} •{' '}
                        {interview.questions?.length} Questions
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {interview.status === 'completed' ? (
                        <>
                          <div className="text-right hidden sm:block">
                            <span className="text-xs text-text-secondary block">Score</span>
                            <span className={`font-bold ${getGradeColor(interview.overallFeedback?.averageScore || 0)}`}>
                              {interview.overallFeedback?.averageScore || 0}%
                            </span>
                          </div>
                          <Badge variant="success">Completed</Badge>
                        </>
                      ) : (
                        <Badge variant="warning">Incomplete</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center text-text-muted">
                <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mb-4">
                  <FiMic className="w-8 h-8 opacity-50" />
                </div>
                <p>No past interviews found.</p>
                <p className="text-sm mt-2">Start a new mock interview to practice.</p>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default MockInterview;
