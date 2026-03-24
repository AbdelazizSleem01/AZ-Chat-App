'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactPlayer from 'react-player';
import { FiPlay, FiExternalLink, FiVideo, FiX } from 'react-icons/fi';

const formatMediaTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// --- Link Preview Component ---
export const LinkPreview = ({ url, isDarkMode }: { url: string; isDarkMode: boolean }) => {
  const isDirectVideo = useMemo(() => {
    const lower = (url || '').toLowerCase();
    return ['.mp4', '.webm', '.ogg', '.mov', '.m4v'].some((ext) => lower.includes(ext));
  }, [url]);

  const embedInfo = useMemo(() => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        const id = parsed.pathname.slice(1);
        if (!id) return null;
        return {
          provider: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${id}`,
          thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`
        };
      }
      if (host === 'youtube.com' || host === 'm.youtube.com') {
        const id = parsed.searchParams.get('v') || '';
        if (!id) return null;
        return {
          provider: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${id}`,
          thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`
        };
      }
      if (host === 'vimeo.com') {
        const id = parsed.pathname.split('/').filter(Boolean)[0];
        if (!id) return null;
        return {
          provider: 'vimeo',
          embedUrl: `https://player.vimeo.com/video/${id}`,
          thumbnailUrl: ''
        };
      }
      if (host === 'instagram.com' || host === 'instagr.am') {
        const cleanedPath = parsed.pathname.replace(/\/+$/, '');
        const parts = cleanedPath.split('/').filter(Boolean);
        if (parts.length < 2) return null;
        const type = parts[0];
        const id = parts[1];
        if (!id) return null;
        if (type === 'reel' || type === 'reels') {
          return {
            provider: 'instagram',
            embedUrl: `https://www.instagram.com/reel/${id}/embed`,
            thumbnailUrl: ''
          };
        }
        return {
          provider: 'instagram',
          embedUrl: `https://www.instagram.com/p/${id}/embed`,
          thumbnailUrl: ''
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [url]);

  const canPlayUrl = useMemo(() => {
    const playerWithCanPlay = ReactPlayer as typeof ReactPlayer & {
      canPlay?: (targetUrl: string) => boolean;
    };
    return url ? (playerWithCanPlay.canPlay?.(url) || false) : false;
  }, [url]);

  const isVideo = canPlayUrl || isDirectVideo || embedInfo?.provider === 'instagram';


  if (isVideo) {
    return (
      <div className={`mt-2 rounded-xl overflow-hidden border ${isDarkMode ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-gray-50'}`}>
        <div className="aspect-video relative">
          {embedInfo?.provider === 'instagram' ? (
            <div className={`w-full h-full flex items-center justify-center text-xs ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors inline-flex items-center gap-2"
              >
                <FiExternalLink />
                Open Instagram
              </a>
            </div>
          ) : embedInfo?.embedUrl ? (
            <iframe
              src={embedInfo.embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video preview"
            />
          ) : isDirectVideo ? (
            <video
              src={url}
              controls
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            (() => {
              const Player = ReactPlayer as typeof ReactPlayer;
              return (
                <Player
                  src={url}
                  width="100%"
                  height="100%"
                  controls
                  playing
                  style={{ borderRadius: '12px' }}
                />
              );
            })()
          )}
          <div className="absolute top-2 left-2 truncate max-w-[80%] text-[10px] text-white/80 font-medium drop-shadow-md">
            {url}
          </div>
        </div>
      </div>
    );
  }

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`mt-2 flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${isDarkMode ? 'bg-gray-800/40 border-gray-700 hover:bg-gray-700/60' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
    >
      <div className="flex items-center gap-2 truncate">
        <FiExternalLink className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
        <span className="truncate">{url}</span>
      </div>
    </a>
  );
};

// --- Tele-message (Circular Video Note) Component ---
export const VideoNotePlayer = ({ src, isMe, isDarkMode }: { src: string; isMe: boolean; isDarkMode: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const safeSrc = typeof src === 'string' ? src.trim() : '';

  const togglePlay = () => {
    if (!safeSrc || hasError) return;
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsPlaying(false);
          setHasError(true);
        });
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  if (!safeSrc || hasError) {
    return (
      <div className="relative group p-1">
        <div className={`w-40 h-40 rounded-full overflow-hidden border-4 shadow-xl relative flex items-center justify-center text-center px-4 ${isMe ? 'border-indigo-500/50 bg-indigo-950/20 text-indigo-100' : (isDarkMode ? 'border-gray-700 bg-gray-900 text-gray-300' : 'border-gray-200 bg-gray-100 text-gray-600')}`}>
          <div>
            <FiVideo className="mx-auto mb-2 text-lg opacity-80" />
            <div className="text-[11px] leading-4">Video note unavailable</div>
          </div>
        </div>
        <div className="mt-2 flex justify-center">
          <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
            Video Note
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group p-1">
      <div className={`w-40 h-40 rounded-full overflow-hidden border-4 shadow-xl cursor-pointer relative ${isMe ? 'border-indigo-500/50' : (isDarkMode ? 'border-gray-700' : 'border-gray-200')}`}
           onClick={togglePlay}>
        <video 
          ref={videoRef}
          src={safeSrc}
          className="w-full h-full object-cover" 
          playsInline
          preload="metadata"
          loop
          onEnded={() => setIsPlaying(false)}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
            }
          }}
          onError={() => {
            setHasError(true);
            setIsPlaying(false);
          }}
        />
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-all">
            <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white border border-white/40">
              <FiPlay size={20} fill="currentColor" />
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-center">
         <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-2 ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
            <span>Video Note</span>
            <span className="opacity-70">{formatMediaTime(duration)}</span>
         </div>
      </div>
    </div>
  );
};

// --- Video Recorder for Tele-messages ---
export const VideoNoteRecorder = ({ 
  onComplete, 
  onClose, 
  isDarkMode 
}: { 
  onComplete: (blob: Blob) => void;
  onClose: () => void;
  isDarkMode: boolean;
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480, facingMode: 'user' }, audio: true })
      .then(s => {
        setStream(s);
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(err => {
        console.error("Camera access denied", err);
        onClose();
      });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [onClose]);

  const startRecording = () => {
    if (!stream) return;
    recordedChunksRef.current = [];
    setRecordingSeconds(0);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };
    recorder.onstop = () => {
        // This will be called when we call stopRecording
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      if (blob.size > 0) {
        onComplete(blob);
      } else {
        console.error('Video note recording is empty');
      }
    };
    
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl p-4">
      <div className="relative flex flex-col items-center p-8 rounded-4xl shadow-2xl max-w-sm w-full transition-all transform scale-100 bg-gray-950 border border-white/10 dark:bg-gray-950 dark:border-white/10">
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-red-500 transition-all hover:rotate-90">
          <FiX size={28} />
        </button>
        <h3 className={`text-2xl font-black mb-8 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
           Video Message
        </h3>
        
        <div className="w-56 h-56 rounded-full overflow-hidden border-4 border-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.3)] bg-gray-900 relative mb-10 ring-4 ring-indigo-500/20">
           <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
           {isRecording && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full animate-pulse flex items-center gap-2 shadow-lg">
                <span className="w-2 h-2 bg-white rounded-full" /> {formatMediaTime(recordingSeconds)}
              </div>
           )}
        </div>

        <div className="w-full">
          {!isRecording ? (
            <button 
              onClick={startRecording}
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3 text-lg"
            >
              <FiVideo size={22} /> Start Recording
            </button>
          ) : (
            <button 
              onClick={stopRecording}
              className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3 text-lg"
            >
              Stop & Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
