'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User, Message, MessageReaction } from '@/types';
import {
  FiPhone,
  FiVideo,
  FiSend,
  FiSmile,
  FiX,
  FiMoreVertical,
  FiTrash2,
  FiUpload,
  FiCornerUpLeft,
  FiMessageSquare,
  FiDownload,
  FiPhoneCall,
  FiPhoneMissed,
  FiClock,
  FiCheck,
  FiCheckCircle,
  FiEdit2,
  FiMic,
  FiStopCircle,
  FiStar,
  FiPause,
  FiPlay,
  FiVolume2,
  FiVolumeX,
  FiSearch,
  FiImage,
  FiBookmark,
  FiChevronLeft,
  FiChevronRight,
  FiBell,
  FiBellOff,
  FiGlobe,
  FiLink,
  FiFacebook,
  FiInstagram,
  FiTwitter,
  FiLinkedin,
  FiGithub,
  FiYoutube,
  FiZap
} from 'react-icons/fi';
import {
  SiTiktok,
  SiWhatsapp,
  SiSnapchat,
  SiDiscord,
  SiPinterest,
  SiReddit,
  SiBehance,
  SiDribbble,
  SiMedium,
  SiStackoverflow,
  SiTelegram
} from 'react-icons/si';

type ChatTask = {
  id: string;
  content: string;
  status: 'pending' | 'done';
  assigneeId: string;
  creatorId?: string;
  deadline?: number;
  messageId?: string;
  createdAt?: number;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: Array<{ isFinal: boolean; 0: { transcript: string }; length: number }>;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Theme } from 'emoji-picker-react';
import { LinkPreview, VideoNotePlayer, VideoNoteRecorder } from './common/RichMedia';
import { CollaborationTools } from './CollaborationTools';
import { FiLock, FiUnlock, FiPlayCircle } from 'react-icons/fi';
import { getSocket } from '@/lib/socket';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

type PhraseEntry = {
  text: string;
  count: number;
  lastUsed: number;
};

function extractCandidatePhrases(text: string): string[] {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) return [];

  const unique = new Map<string, string>();
  const addCandidate = (value: string) => {
    const candidate = value.trim();
    if (candidate.length < 2) return;
    const key = candidate.toLocaleLowerCase();
    if (!unique.has(key)) unique.set(key, candidate);
  };

  addCandidate(normalized);

  normalized.split(' ').forEach((part) => {
    const cleaned = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    addCandidate(cleaned);
  });

  return Array.from(unique.values());
}

function buildChatId(a: string, b: string) {
  return [String(a || ''), String(b || '')].sort().join('__');
}

function AudioPlayer({
  src,
  label,
  isMe,
  isDarkMode,
  onDownload
}: {
  src: string;
  label: string;
  isMe: boolean;
  isDarkMode: boolean;
  onDownload: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  const changeSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = currentIndex === rates.length - 1 ? 0 : currentIndex + 1;
    const nextRate = rates[nextIndex];
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const value = Number(e.target.value);
    audio.currentTime = value;
    setCurrentTime(value);
  };

  return (
    <div className={`rounded-2xl p-3.5 border min-w-70 ${isMe ? 'bg-white/10 border-white/20' : (isDarkMode ? 'bg-gray-900/70 border-gray-700/60' : 'bg-white/90 border-gray-200')}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center ${isMe ? 'bg-white/15 text-white' : (isDarkMode ? 'bg-gray-800/80 text-white' : 'bg-slate-100 text-gray-900')}`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <FiPause className="text-sm" /> : <FiPlay className="text-sm" />}
        </button>
        <div className={`text-[10px] ${isMe ? 'text-indigo-100/80' : (isDarkMode ? 'text-gray-400' : 'text-gray-600')}`}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={changeSpeed}
            className={`px-2.5 h-7 rounded-full text-[10px] ${isMe ? 'bg-white/15 text-white' : (isDarkMode ? 'bg-gray-800/70 text-gray-300' : 'bg-slate-100 text-gray-700')}`}
            title="Change speed (cycles)"
          >
            {playbackRate}x
          </button>
        </div>
        <button
          onClick={toggleMute}
          className={`w-8 h-8 rounded-full flex items-center justify-center ${isMe ? 'bg-white/15 text-white' : (isDarkMode ? 'bg-gray-800/80 text-white' : 'bg-slate-100 text-gray-900')}`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <FiVolumeX className="text-xs" /> : <FiVolume2 className="text-xs" />}
        </button>
      </div>
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={onSeek}
          className="w-full voice-range"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className={`text-[10px] truncate flex-1 ${isMe ? 'text-indigo-200/90' : (isDarkMode ? 'text-gray-300' : 'text-gray-600')}`}>
          {label}
        </div>
        <button
          onClick={onDownload}
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-all duration-200 hover:scale-105 ${isMe ? 'text-white/90 bg-black/30 hover:bg-black/50' : (isDarkMode ? 'text-gray-200 bg-gray-800/70 hover:bg-gray-700/70' : 'text-gray-700 bg-slate-100 hover:bg-slate-200')}`}
          title="Download"
        >
          <FiDownload className="text-xs" />
          Download
        </button>
      </div>
    </div>
  );
}

interface ChatWindowProps {
  currentUser: { id: string; username: string; email: string };
  selectedUser: User;
  users?: User[];
  messages: Message[];
  draft?: string;
  onDraftChange?: (value: string) => void;
  pinnedMessageIds?: string[];
  onTogglePin?: (messageId: string) => void;
  starredMessageIds?: string[];
  onToggleStar?: (messageId: string) => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  slowModeUntil?: number;
  chatAccent?: string;
  onSetChatTheme?: (themeClass: string) => void;
  chatBackground?: string;
  onSetChatBackground?: (url: string) => void;
  jumpToMessageId?: string | null;
  isDarkMode?: boolean;
  onSendMessage: (
    content: string,
    type?: 'text' | 'image' | 'audio' | 'file' | 'video-note',
    meta?: { fileUrl?: string; fileName?: string; fileSize?: number; files?: Array<{ url: string; name: string; size?: number; type?: string }>; transcript?: string; expiresInSeconds?: number }
  ) => void;
  onForwardMessage?: (message: Message, targetUserId: string) => void;
  onInitiateCall: (type: 'audio' | 'video') => void;
  onClose?: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onDeleteForMe?: (messageId: string) => void;
  onAddReaction?: (messageId: string, emoji: string) => void;
  onReplyMessage?: (
    messageId: string,
    content: string,
    senderUsername: string,
    replyContent: string
  ) => void;
  onEditMessage?: (messageId: string, content: string) => void;
  chatLock?: { isLocked: boolean; hasPasscode: boolean; updatedAt?: number };
  onLockSetPasscode?: (passcode: string) => Promise<{ ok: boolean; error?: string }>;
  onLockToggle?: (lock: boolean) => Promise<{ ok: boolean; error?: string }>;
  onLockUnlock?: (passcode: string) => Promise<{ ok: boolean; error?: string }>;
  onLockChangePasscode?: (currentPasscode: string, newPasscode: string) => Promise<{ ok: boolean; error?: string }>;
  onLockRemovePasscode?: (currentPasscode: string) => Promise<{ ok: boolean; error?: string }>;
  openTasksPanelSignal?: number;
  presenceText?: string;
  isInCall?: boolean;
}

export default function ChatWindow({
  currentUser,
  selectedUser,
  users = [],
  messages,
  draft,
  onDraftChange,
  pinnedMessageIds = [],
  starredMessageIds = [],
  onToggleStar,
  isMuted = false,
  onToggleMute,
  slowModeUntil,
  chatAccent,
  onSetChatTheme,
  chatBackground,
  onSetChatBackground,
  onTogglePin,
  jumpToMessageId,
  isDarkMode = true,
  onSendMessage,
  onForwardMessage,
  onInitiateCall,
  onClose,
  onDeleteMessage,
  onDeleteForMe,
  onAddReaction,
  onReplyMessage,
  onEditMessage,
  chatLock,
  onLockSetPasscode,
  onLockToggle,
  onLockUnlock,
  onLockChangePasscode,
  onLockRemovePasscode,
  openTasksPanelSignal,
  presenceText,
  isInCall = false,
}: ChatWindowProps) {
  const draftValue = draft ?? '';
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [messageMenu, setMessageMenu] = useState<string | null>(null);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<'all' | 'messages' | 'images' | 'files' | 'links'>('all');
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<Array<{ url: string; name: string; size?: number; type?: string }>>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [headerMenuPos, setHeaderMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [messageMenuPos, setMessageMenuPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [forwardQuery, setForwardQuery] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleAmount, setScheduleAmount] = useState('');
  const [scheduleUnit, setScheduleUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [showPinnedBar, setShowPinnedBar] = useState(true);
  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordTranscript, setRecordTranscript] = useState('');
  const [recordInterim, setRecordInterim] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recordLang, setRecordLang] = useState('auto');
  const [recordError, setRecordError] = useState('');
  const [ephemeralDuration, setEphemeralDuration] = useState<number | null>(null);
  const [showEphemeralModal, setShowEphemeralModal] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const lastPresenceRef = useRef<string>('');
  const presenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [translatingMessageId, setTranslatingMessageId] = useState<string | null>(null);
  const [reactionModalMessage, setReactionModalMessage] = useState<Message | null>(null);
  const [slowModeRemaining, setSlowModeRemaining] = useState(0);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [translateMessage, setTranslateMessage] = useState<Message | null>(null);
  const [translateSource, setTranslateSource] = useState('auto');
  const [translateTarget, setTranslateTarget] = useState('ar');
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<Message | null>(null);
  const [reminders, setReminders] = useState<Array<{ id: string; messageId: string; content: string; remindAt: number }>>([]);
  const [reminderToast, setReminderToast] = useState<{ content: string; messageId: string } | null>(null);
  const [showRemindersPanel, setShowRemindersPanel] = useState(false);
  const [reminderAmount, setReminderAmount] = useState('');
  const [reminderUnit, setReminderUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [tasks, setTasks] = useState<ChatTask[]>([]);
  const [showTasksPanel, setShowTasksPanel] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskMessage, setTaskMessage] = useState<Message | null>(null);
  const [taskContent, setTaskContent] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [editingTask, setEditingTask] = useState<ChatTask | null>(null);
  const [taskBusy, setTaskBusy] = useState(false);
  const [actionToast, setActionToast] = useState<{ content: string } | null>(null);
  const reminderTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [newQuickReply, setNewQuickReply] = useState('');
  const [fileSnippets, setFileSnippets] = useState<Record<string, string>>({});
  const [showThreadPanel, setShowThreadPanel] = useState(false);
  const [threadRoot, setThreadRoot] = useState<Message | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState<Message | null>(null);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [editHistoryMessage, setEditHistoryMessage] = useState<Message | null>(null);
  const [backgroundInput, setBackgroundInput] = useState('');
  const backgroundFileRef = useRef<HTMLInputElement>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState<{ title: string; statusMessage?: string; bio: string; phones: string[]; socials: Array<{ label: string; url: string; icon?: string }> } | null>(null);
  const [profileAllowed, setProfileAllowed] = useState(false);
  const [profileRequested, setProfileRequested] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'followers' | 'private' | 'custom'>('public');
  const [profileIsFollower, setProfileIsFollower] = useState(false);
  const [profileIsSelf, setProfileIsSelf] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const isLocked = Boolean(chatLock?.isLocked);
  const hasLockPasscode = Boolean(chatLock?.hasPasscode);
  const [showPasscodeInput, setShowPasscodeInput] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [showLockManageModal, setShowLockManageModal] = useState(false);
  const [lockModalMode, setLockModalMode] = useState<'set' | 'change' | 'delete'>('set');
  const [lockModalError, setLockModalError] = useState('');
  const [lockCurrentPasscode, setLockCurrentPasscode] = useState('');
  const [lockNewPasscode, setLockNewPasscode] = useState('');
  const [lockConfirmPasscode, setLockConfirmPasscode] = useState('');
  const [showCollaborationTools, setShowCollaborationTools] = useState(false);
  const [collabOwnerId, setCollabOwnerId] = useState<string | null>(null);
  const [phraseHistory, setPhraseHistory] = useState<PhraseEntry[]>([]);
  const normalizedCurrentUserId = String(currentUser.id || '');
  const normalizedSelectedUserId = String(selectedUser._id || '');
  const collaborationChatId = useMemo(
    () => buildChatId(normalizedCurrentUserId, normalizedSelectedUserId),
    [normalizedCurrentUserId, normalizedSelectedUserId]
  );
  const phraseStorageKey = 'phrase-history:' + currentUser.id;

  const rememberTypedText = useCallback((text: string) => {
    const candidates = extractCandidatePhrases(text);
    if (candidates.length === 0) return;
    const now = Date.now();

    setPhraseHistory((prev) => {
      const map = new Map(prev.map((item) => [item.text.toLocaleLowerCase(), item]));
      candidates.forEach((candidate) => {
        const key = candidate.toLocaleLowerCase();
        const existing = map.get(key);
        if (existing) {
          map.set(key, {
            ...existing,
            count: existing.count + 1,
            lastUsed: now
          });
        } else {
          map.set(key, {
            text: candidate,
            count: 1,
            lastUsed: now
          });
        }
      });
      return Array.from(map.values());
    });
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(phraseStorageKey);
      if (!raw) {
        setPhraseHistory([]);
        return;
      }

      const parsed = JSON.parse(raw) as PhraseEntry[];
      if (!Array.isArray(parsed)) {
        setPhraseHistory([]);
        return;
      }

      const safeEntries = parsed
        .filter((item) =>
          item &&
          typeof item.text === 'string' &&
          typeof item.count === 'number' &&
          typeof item.lastUsed === 'number'
        )
        .map((item) => ({
          text: item.text.trim(),
          count: Math.max(1, Math.floor(item.count)),
          lastUsed: item.lastUsed
        }))
        .filter((item) => item.text.length >= 2);

      setPhraseHistory(safeEntries);
    } catch {
      setPhraseHistory([]);
    }
  }, [phraseStorageKey]);

  useEffect(() => {
    localStorage.setItem(phraseStorageKey, JSON.stringify(phraseHistory));
  }, [phraseHistory, phraseStorageKey]);

  useEffect(() => {
    const collected = new Map<string, PhraseEntry>();

    messages.forEach((msg) => {
      if (msg.senderId !== currentUser.id || msg.type !== 'text') return;
      const candidates = extractCandidatePhrases(msg.content);
      const msgTime = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now();

      candidates.forEach((candidate) => {
        const key = candidate.toLocaleLowerCase();
        const existing = collected.get(key);
        if (existing) {
          collected.set(key, {
            ...existing,
            count: existing.count + 1,
            lastUsed: Math.max(existing.lastUsed, msgTime)
          });
        } else {
          collected.set(key, {
            text: candidate,
            count: 1,
            lastUsed: msgTime
          });
        }
      });
    });

    if (collected.size === 0) return;

    setPhraseHistory((prev) => {
      const merged = new Map(prev.map((item) => [item.text.toLocaleLowerCase(), item]));
      collected.forEach((item, key) => {
        const existing = merged.get(key);
        if (existing) {
          merged.set(key, {
            ...existing,
            count: Math.max(existing.count, item.count),
            lastUsed: Math.max(existing.lastUsed, item.lastUsed)
          });
        } else {
          merged.set(key, item);
        }
      });
      return Array.from(merged.values());
    });
  }, [messages, currentUser.id]);

  const prefixSuggestions = useMemo(() => {
    if (!draftValue.trim()) return [];
    const prefix = draftValue.trimStart().toLocaleLowerCase();

    return phraseHistory
      .filter((item) => {
        const lower = item.text.toLocaleLowerCase();
        return lower.startsWith(prefix) && lower !== prefix;
      })
      .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed || a.text.length - b.text.length)
      .slice(0, 5)
      .map((item) => item.text);
  }, [draftValue, phraseHistory]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const headerMenuButtonRef = useRef<HTMLButtonElement>(null);
  const messageMenuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const cancelRecordingRef = useRef(false);
  const galleryTouchStartX = useRef<number | null>(null);



  const unlockChat = useCallback(async (pass: string) => {
    if (!onLockUnlock) return;
    setLockBusy(true);
    const result = await onLockUnlock(pass.trim());
    setLockBusy(false);
    if (result.ok) {
      setShowPasscodeInput(false);
      setPasscodeInput('');
      setPasscodeError(false);
      setActionToast({ content: 'تم فتح الشات بنجاح' });
    } else {
      setPasscodeError(true);
    }
  }, [onLockUnlock]);


  useEffect(() => {
    if (draftValue.length === 0) {
      const clearTimeoutId = setTimeout(() => {
        setShowTypingIndicator(false);
      }, 0);
      return () => clearTimeout(clearTimeoutId);
    }

    const showTimeout = setTimeout(() => {
      setShowTypingIndicator(true);
    }, 100);

    const hideTimeout = setTimeout(() => {
      setShowTypingIndicator(false);
    }, 3000);

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, [draftValue]);

  useEffect(() => {
    const prevLen = prevMessagesLengthRef.current;
    const nextLen = messages.length;
    prevMessagesLengthRef.current = nextLen;

    if (!isAtBottomRef.current && nextLen > prevLen) {
      setNewMessagesCount(count => count + (nextLen - prevLen));
      return;
    }

    if (isAtBottomRef.current) {
      setNewMessagesCount(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 60;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom <= threshold;
    if (isAtBottomRef.current) {
      setNewMessagesCount(0);
    }
  };

  const handleJumpToLatest = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMessagesCount(0);
    isAtBottomRef.current = true;
  };

  const visibleMessages = showStarredOnly
    ? messages.filter(m => m._id && starredMessageIds.includes(m._id))
    : messages;
  const nowMs = nowTick;
  const effectiveMessages = visibleMessages.filter(m => !m.expiresAt || new Date(m.expiresAt).getTime() > nowMs);

  const isImageFile = useCallback((fileName?: string, fileUrl?: string, type?: string) => {
    if (type === 'image') return true;
    const target = (fileName || fileUrl || '').toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(target);
  }, []);

  const searchMatches = searchQuery.trim().length > 0
    ? effectiveMessages.filter(m => {
      const content = typeof m.content === 'string' ? m.content : '';
      const transcript = typeof m.transcript === 'string' ? m.transcript : '';
      const matchText = `${content} ${transcript}`.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchText) return false;

      const hasFiles = Boolean(m.fileUrl) || (Array.isArray(m.files) && m.files.length > 0);
      const hasImage =
        isImageFile(m.fileName, m.fileUrl, m.type) ||
        (Array.isArray(m.files) && m.files.some(f => isImageFile(f.name, f.url, f.type)));
      const hasLink = /(https?:\/\/|www\.)\S+/i.test(content);

      switch (searchFilter) {
        case 'images':
          return hasImage;
        case 'files':
          return hasFiles;
        case 'links':
          return hasLink;
        case 'messages':
          return true;
        default:
          return true;
      }
    })
    : [];

  const imageMessages = effectiveMessages.filter(m => {
    const url = m.fileUrl || (typeof m.content === 'string' ? m.content : '');
    const isImageType = m.type === 'image';
    const looksLikeImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url);
    return isImageType || looksLikeImage;
  });

  const scrollToSearchResult = (index: number) => {
    const msg = searchMatches[index];
    if (!msg?._id) return;
    const el = messageRefs.current[msg._id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-indigo-400/60');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-indigo-400/60');
      }, 1200);
    }
  };

  const scrollToMessageId = useCallback((messageId: string) => {
    const el = messageRefs.current[messageId];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-indigo-400/60');
    setTimeout(() => {
      el.classList.remove('ring-2', 'ring-indigo-400/60');
    }, 1200);
  }, []);

  useEffect(() => {
    if (jumpToMessageId) {
      scrollToMessageId(jumpToMessageId);
    }
  }, [jumpToMessageId, scrollToMessageId, messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = Boolean(
      (window as typeof window & {
        SpeechRecognition?: new () => unknown;
        webkitSpeechRecognition?: new () => unknown;
      }).SpeechRecognition ||
      (window as typeof window & {
        SpeechRecognition?: new () => unknown;
        webkitSpeechRecognition?: new () => unknown;
      }).webkitSpeechRecognition
    );
    setSpeechSupported(supported);
    setRecordLang(navigator.language?.startsWith('ar') ? 'ar-EG' : (navigator.language || 'en-US'));
  }, []);

  useEffect(() => {
    if (!openTasksPanelSignal) return;
    setShowTasksPanel(true);
  }, [openTasksPanelSignal]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const sendPresence = useCallback((activity: string | null, isTyping: boolean) => {
    const nextKey = `${activity ?? ''}:${isTyping ? '1' : '0'}`;
    if (lastPresenceRef.current === nextKey) return;
    lastPresenceRef.current = nextKey;
    if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    presenceTimerRef.current = setTimeout(() => {
      fetch('/api/users/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          isTyping,
          activity
        })
      }).catch(() => undefined);
    }, 250);
  }, [currentUser.id]);

  useEffect(() => {
    const activity =
      isInCall
        ? 'in_call'
        : recordState !== 'idle'
          ? 'recording'
          : editingMessageId
            ? 'editing'
            : draftValue.trim().length > 0
              ? 'typing'
              : null;
    sendPresence(activity, activity === 'typing');
  }, [isInCall, recordState, editingMessageId, draftValue, sendPresence]);

  useEffect(() => {
    if (recordState !== 'recording' || !speechRecognitionRef.current) return;
    try {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current.start();
    } catch {
      // ignore
    }
  }, [recordLang, recordState]);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const response = await fetch(`/api/tasks?peerId=${selectedUser._id}`, {
          headers: { 'x-user-id': currentUser.id }
        });
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data?.tasks)) {
          setTasks(data.tasks);
        }
      } catch (error) {
        console.error('Load tasks error:', error);
      }
    };
    if (currentUser?.id && selectedUser?._id) {
      loadTasks();
    }
  }, [currentUser?.id, selectedUser?._id]);

  useEffect(() => {
    if (!showGallery) return;
    const onKey = (e: KeyboardEvent) => {
      if (imageMessages.length === 0) return;
      if (e.key === 'ArrowLeft') {
        setGalleryIndex(i => (i - 1 + imageMessages.length) % imageMessages.length);
      }
      if (e.key === 'ArrowRight') {
        setGalleryIndex(i => (i + 1) % imageMessages.length);
      }
      if (e.key === 'Escape') {
        setShowGallery(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showGallery, imageMessages.length]);

  useEffect(() => {
    const loadReminders = async () => {
      try {
        const response = await fetch('/api/reminders', {
          headers: { 'x-user-id': currentUser.id }
        });
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data?.reminders)) {
          setReminders(data.reminders);
        }
      } catch (error) {
        console.error('Load reminders error:', error);
      }
    };
    if (currentUser?.id) {
      loadReminders();
    }
  }, [currentUser?.id]);

  useEffect(() => {
    Object.values(reminderTimersRef.current).forEach(t => clearTimeout(t));
    reminderTimersRef.current = {};
    const now = Date.now();
    reminders.forEach(reminder => {
      const delay = Math.max(0, reminder.remindAt - now);
      reminderTimersRef.current[reminder.id] = setTimeout(() => {
        setReminderToast({ content: reminder.content, messageId: reminder.messageId });
        removeReminder(reminder.id);
      }, delay);
    });
    return () => {
      Object.values(reminderTimersRef.current).forEach(t => clearTimeout(t));
    };
  }, [reminders]);

  useEffect(() => {
    if (!actionToast) return;
    const timer = setTimeout(() => setActionToast(null), 2500);
    return () => clearTimeout(timer);
  }, [actionToast]);

  useEffect(() => {
    const key = `quickReplies:${currentUser.id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed)) setQuickReplies(parsed);
      } catch {
        // ignore
      }
    }
  }, [currentUser.id]);

  useEffect(() => {
    const key = `quickReplies:${currentUser.id}`;
    localStorage.setItem(key, JSON.stringify(quickReplies));
  }, [quickReplies, currentUser.id]);

  useEffect(() => {
    const textFileUrls = new Set<string>();
    messages.forEach(m => {
      if (m.fileUrl && /\.(txt|md|csv|json)$/i.test(m.fileUrl)) textFileUrls.add(m.fileUrl);
      if (Array.isArray(m.files)) {
        m.files.forEach(f => {
          if (f.url && /\.(txt|md|csv|json)$/i.test(f.url)) textFileUrls.add(f.url);
        });
      }
    });
    textFileUrls.forEach((url) => {
      if (fileSnippets[url]) return;
      fetch(url)
        .then(res => res.text())
        .then(text => {
          const snippet = text.slice(0, 180).trim();
          setFileSnippets(prev => ({ ...prev, [url]: snippet || 'No preview available.' }));
        })
        .catch(() => {
          setFileSnippets(prev => ({ ...prev, [url]: 'No preview available.' }));
        });
    });
  }, [messages, fileSnippets]);

  useEffect(() => {
    if (!slowModeUntil) {
      setSlowModeRemaining(0);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((slowModeUntil - Date.now()) / 1000));
      setSlowModeRemaining(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [slowModeUntil]);

  useEffect(() => {
    setShowPasscodeInput(false);
    setPasscodeInput('');
    setPasscodeError(false);
    setShowLockManageModal(false);
    setLockModalError('');
    setLockCurrentPasscode('');
    setLockNewPasscode('');
    setLockConfirmPasscode('');
    setShowCollaborationTools(false);
  }, [selectedUser._id]);

  const openLockManageModal = useCallback((mode: 'set' | 'change' | 'delete') => {
    setLockModalMode(mode);
    setLockModalError('');
    setLockCurrentPasscode('');
    setLockNewPasscode('');
    setLockConfirmPasscode('');
    setShowLockManageModal(true);
  }, []);

  const closeLockManageModal = useCallback(() => {
    if (lockBusy) return;
    setShowLockManageModal(false);
    setLockModalError('');
    setLockCurrentPasscode('');
    setLockNewPasscode('');
    setLockConfirmPasscode('');
  }, [lockBusy]);

  const submitLockManageModal = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockBusy) return;

    if (lockModalMode === 'set') {
      if (!onLockSetPasscode) return;
      const next = lockNewPasscode.trim();
      const confirm = lockConfirmPasscode.trim();
      if (next.length < 4) {
        setLockModalError('Passcode must be at least 4 characters.');
        return;
      }
      if (next !== confirm) {
        setLockModalError('Passcodes do not match.');
        return;
      }
      setLockBusy(true);
      const result = await onLockSetPasscode(next);
      setLockBusy(false);
      if (!result.ok) {
        setLockModalError(result.error || 'Failed to set passcode.');
        return;
      }
      setActionToast({ content: 'تم تعيين باسورد الشات بنجاح' });
      closeLockManageModal();
      return;
    }

    if (lockModalMode === 'change') {
      if (!onLockChangePasscode) return;
      const current = lockCurrentPasscode.trim();
      const next = lockNewPasscode.trim();
      const confirm = lockConfirmPasscode.trim();
      if (!current) {
        setLockModalError('Current passcode is required.');
        return;
      }
      if (next.length < 4) {
        setLockModalError('New passcode must be at least 4 characters.');
        return;
      }
      if (next !== confirm) {
        setLockModalError('Passcodes do not match.');
        return;
      }
      setLockBusy(true);
      const result = await onLockChangePasscode(current, next);
      setLockBusy(false);
      if (!result.ok) {
        setLockModalError(result.error || 'Failed to change passcode.');
        return;
      }
      setActionToast({ content: 'تم تغيير باسورد الشات بنجاح' });
      closeLockManageModal();
      return;
    }

    if (!onLockRemovePasscode) return;
    const current = lockCurrentPasscode.trim();
    if (!current) {
      setLockModalError('Current passcode is required.');
      return;
    }
    setLockBusy(true);
    const result = await onLockRemovePasscode(current);
    setLockBusy(false);
    if (!result.ok) {
      setLockModalError(result.error || 'Failed to delete passcode.');
      return;
    }
    setActionToast({ content: 'تم حذف باسورد الشات بنجاح' });
    setShowPasscodeInput(false);
    setPasscodeInput('');
    setPasscodeError(false);
    closeLockManageModal();
  }, [
    closeLockManageModal,
    lockBusy,
    lockConfirmPasscode,
    lockCurrentPasscode,
    lockModalMode,
    lockNewPasscode,
    onLockChangePasscode,
    onLockRemovePasscode,
    onLockSetPasscode
  ]);

  const toggleLock = useCallback(async () => {
    if (lockBusy) return;

    if (!hasLockPasscode) {
      openLockManageModal('set');
      return;
    }

    if (isLocked) {
      setShowPasscodeInput(true);
      setPasscodeInput('');
      setPasscodeError(false);
      return;
    }

    if (!onLockToggle) return;
    setLockBusy(true);
    const result = await onLockToggle(true);
    setLockBusy(false);
    if (result.ok) {
      setActionToast({ content: 'تم اغلاق الشات بنجاح' });
    }
  }, [hasLockPasscode, isLocked, lockBusy, onLockToggle, openLockManageModal]);

  const openCollaborationTools = useCallback(() => {
    if (!normalizedSelectedUserId) return;
    setShowCollaborationTools(true);
    setCollabOwnerId(normalizedCurrentUserId);
    const socket = getSocket();
    socket.emit('collab-open', {
      chatId: collaborationChatId,
      receiverId: normalizedSelectedUserId,
      senderId: normalizedCurrentUserId
    });
  }, [collaborationChatId, normalizedCurrentUserId, normalizedSelectedUserId]);

  const closeCollaborationTools = useCallback(() => {
    if (!normalizedSelectedUserId) return;
    setShowCollaborationTools(false);
    setCollabOwnerId(null);
    if (collabOwnerId && collabOwnerId !== normalizedCurrentUserId) {
      return;
    }
    const socket = getSocket();
    socket.emit('collab-close', {
      chatId: collaborationChatId,
      receiverId: normalizedSelectedUserId,
      senderId: normalizedCurrentUserId
    });
  }, [collaborationChatId, collabOwnerId, normalizedCurrentUserId, normalizedSelectedUserId]);

  useEffect(() => {
    const socket = getSocket();

    const handleCollabOpen = (payload: { chatId?: string; senderId?: string }) => {
      if (!payload?.chatId || payload.chatId !== collaborationChatId) return;
      if (String(payload.senderId || '') === normalizedCurrentUserId) return;
      if (collabOwnerId && String(payload.senderId || '') !== collabOwnerId) return;
      setShowCollaborationTools(true);
      setCollabOwnerId(String(payload.senderId || ''));
      setActionToast({ content: 'تم فتح مساحة التعاون من الطرف الآخر' });
    };

    const handleCollabClose = (payload: { chatId?: string; senderId?: string }) => {
      if (!payload?.chatId || payload.chatId !== collaborationChatId) return;
      if (String(payload.senderId || '') === normalizedCurrentUserId) return;
      setShowCollaborationTools(false);
      setCollabOwnerId(null);
      setActionToast({ content: 'تم اغلاق مساحة التعاون من الطرف الآخر' });
    };

    socket.on('collab-open', handleCollabOpen);
    socket.on('collab-close', handleCollabClose);
    return () => {
      socket.off('collab-open', handleCollabOpen);
      socket.off('collab-close', handleCollabClose);
    };
  }, [collabOwnerId, collaborationChatId, normalizedCurrentUserId]);

  const openImageLightbox = (images: Array<{ url: string; name: string; size?: number; type?: string }>, startIndex: number) => {
    if (images.length === 0) return;
    const safeIndex = Math.min(Math.max(startIndex, 0), images.length - 1);
    setLightboxImages(images);
    setLightboxIndex(safeIndex);
    setShowImageLightbox(true);
  };

  const accentOptions = [
    { id: 'indigo', label: 'Indigo', className: 'bg-linear-to-r from-indigo-600 to-purple-600 text-white' },
    { id: 'emerald', label: 'Emerald', className: 'bg-linear-to-r from-emerald-500 to-teal-500 text-white' },
    { id: 'rose', label: 'Rose', className: 'bg-linear-to-r from-rose-500 to-pink-500 text-white' },
    { id: 'amber', label: 'Amber', className: 'bg-linear-to-r from-amber-500 to-orange-500 text-white' },
    { id: 'sky', label: 'Sky', className: 'bg-linear-to-r from-sky-500 to-cyan-500 text-white' },
  ];
  const selectedAccent = accentOptions.find(opt => opt.className === chatAccent) || accentOptions[0];
  const accentClasses: Record<string, { softBg: string; border: string; text: string; ring: string }> = {
    indigo: { softBg: 'bg-indigo-500/15', border: 'border-indigo-400/40', text: 'text-indigo-200', ring: 'focus:ring-indigo-500/50' },
    emerald: { softBg: 'bg-emerald-500/15', border: 'border-emerald-400/40', text: 'text-emerald-200', ring: 'focus:ring-emerald-500/50' },
    rose: { softBg: 'bg-rose-500/15', border: 'border-rose-400/40', text: 'text-rose-200', ring: 'focus:ring-rose-500/50' },
    amber: { softBg: 'bg-amber-500/15', border: 'border-amber-400/40', text: 'text-amber-200', ring: 'focus:ring-amber-500/50' },
    sky: { softBg: 'bg-sky-500/15', border: 'border-sky-400/40', text: 'text-sky-200', ring: 'focus:ring-sky-500/50' }
  };
  const accentStyle = accentClasses[selectedAccent.id] || accentClasses.indigo;
  const outgoingBubbleClass = selectedAccent.className;

  const urlRegex = /(https?:\/\/[^\s\n\r]+)/g;
  const extractUrls = (text: string) => (text || "").replace(/[\n\r\t]/g, "").match(urlRegex) || [];

  const theme = {
    root: isDarkMode
      ? 'bg-linear-to-br from-gray-950 via-gray-900 to-gray-950'
      : 'bg-linear-to-br from-slate-50 via-white to-slate-100',
    header: isDarkMode ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/70',
    headerText: isDarkMode ? 'text-white' : 'text-gray-900',
    headerSub: isDarkMode ? 'text-gray-500' : 'text-gray-600',
    searchBar: isDarkMode ? 'bg-gray-900/70 border-gray-800/60' : 'bg-white/70 border-gray-200/70',
    searchInput: isDarkMode ? 'bg-gray-800/80 text-white placeholder-gray-500' : 'bg-slate-100 text-gray-900 placeholder-gray-500',
    incomingBubble: isDarkMode
      ? 'bg-gray-800/80 backdrop-blur-sm text-gray-100 border border-gray-700/50'
      : 'bg-white/90 backdrop-blur-sm text-gray-900 border border-gray-200/80',
    inputWrap: isDarkMode ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/90 border-gray-200/70',
    inputField: isDarkMode
      ? `bg-gray-800/80 text-white placeholder-gray-500 border border-gray-700/50 ${accentStyle.border} ${accentStyle.ring}`
      : `bg-slate-100 text-gray-900 placeholder-gray-500 border border-gray-200/80 ${accentStyle.border} ${accentStyle.ring}`,
    actionButton: isDarkMode
      ? 'bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white'
      : 'bg-white/90 hover:bg-slate-100 text-gray-600 hover:text-gray-900 border border-gray-200/70',
  };

  const handleTranslateMessage = async (message: Message, source?: string, target?: string) => {
    if (!message._id || typeof message.content !== 'string') return;
    const messageId = message._id;
    if (translatedMessages[messageId]) {
      setTranslatedMessages(prev => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      return;
    }
    try {
      setTranslatingMessageId(messageId);
      const src = source || translateSource;
      const tgt = target || translateTarget;
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message.content, target: tgt, source: src })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setTranslatedMessages(prev => ({ ...prev, [messageId]: 'Translation failed.' }));
        return;
      }
      if (typeof data?.translatedText === 'string') {
        const text = data.translatedText.trim().length > 0 ? data.translatedText : 'Translation failed.';
        setTranslatedMessages(prev => ({ ...prev, [messageId]: text }));
        return;
      }
      setTranslatedMessages(prev => ({ ...prev, [messageId]: 'Translation failed.' }));
    } catch (error) {
      console.error('Translate error:', error);
      setTranslatedMessages(prev => ({ ...prev, [messageId]: 'Translation failed.' }));
    } finally {
      setTranslatingMessageId(null);
    }
  };

  const scheduleReminder = async (message: Message, minutes: number) => {
    if (!message._id) return;
    const remindAt = Date.now() + minutes * 60 * 1000;
    const content = typeof message.content === 'string' ? message.content : 'Message';
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({
          messageId: message._id,
          content,
          remindAt
        })
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.reminder) {
        setReminders(prev => [...prev, data.reminder]);
      }
    } catch (error) {
      console.error('Create reminder error:', error);
    }
  };

  const removeReminder = async (reminderId: string) => {
    setReminders(prev => prev.filter(r => r.id !== reminderId));
    try {
      await fetch(`/api/reminders/${reminderId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': currentUser.id }
      });
    } catch (error) {
      console.error('Remove reminder error:', error);
    }
  };

  const openTaskModal = (message?: Message | null, task?: ChatTask | null) => {
    if (task) {
      setEditingTask(task);
      setTaskMessage(null);
      setTaskContent(task.content);
      setTaskAssignee(task.assigneeId || currentUser.id);
      setTaskDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '');
    } else {
      const content =
        message?.type === 'file'
          ? (message.fileName || 'File')
          : (typeof message?.content === 'string' ? message.content : '');
      setEditingTask(null);
      setTaskMessage(message || null);
      setTaskContent(content);
      setTaskAssignee(currentUser.id);
      setTaskDeadline('');
    }
    setShowTaskModal(true);
  };

  const submitTask = async () => {
    if (!taskContent.trim()) return;
    setTaskBusy(true);
    try {
      const payload = {
        peerId: selectedUser._id,
        content: taskContent.trim(),
        assigneeId: taskAssignee || currentUser.id,
        deadline: taskDeadline ? new Date(taskDeadline).getTime() : undefined,
        messageId: taskMessage?._id
      };
      if (editingTask) {
        const response = await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.task) {
            setTasks(prev => prev.map(t => (t.id === editingTask.id ? data.task : t)));
          }
        }
      } else {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.task) {
            setTasks(prev => [data.task, ...prev]);
          }
        }
      }
      setShowTaskModal(false);
      setTaskMessage(null);
      setTaskContent('');
      setTaskDeadline('');
      setEditingTask(null);
    } catch (error) {
      console.error('Task save error:', error);
    } finally {
      setTaskBusy(false);
    }
  };

  const toggleTaskStatus = async (task: ChatTask) => {
    try {
      const nextStatus = task.status === 'done' ? 'pending' : 'done';
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ status: nextStatus })
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.task) {
          setTasks(prev => prev.map(t => (t.id === task.id ? data.task : t)));
        }
      }
    } catch (error) {
      console.error('Toggle task error:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': currentUser.id }
      });
    } catch (error) {
      console.error('Delete task error:', error);
    }
  };

  const formatReminderTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openThread = (message: Message) => {
    setThreadRoot(message);
    setShowThreadPanel(true);
  };

  const uploadBackground = async (file?: File) => {
    if (!file || !onSetChatBackground) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (data.success && data.fileUrl) {
        onSetChatBackground(data.fileUrl);
        setBackgroundInput('');
      }
    } catch (error) {
      console.error('Background upload error:', error);
    }
  };

  const openProfile = async () => {
    try {
      const response = await fetch(`/api/users/profile?userId=${selectedUser._id}`, {
        headers: { 'x-user-id': currentUser.id },
        cache: 'no-store'
      });
      const data = await response.json();
      setProfileAllowed(Boolean(data?.allowed));
      setProfileRequested(Boolean(data?.requested));
      setProfileVisibility((data?.visibility as typeof profileVisibility) || 'public');
      setProfileData(data?.profile || null);
      setProfileIsFollower(Boolean(data?.isFollower));
      setProfileIsSelf(Boolean(data?.isSelf));
      setShowProfileModal(true);
    } catch (error) {
      console.error('Load profile error:', error);
    }
  };

  const requestProfileAccess = async () => {
    try {
      await fetch('/api/users/follow/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ targetUserId: selectedUser._id })
      });
      setProfileRequested(true);
    } catch (error) {
      console.error('Request access error:', error);
    }
  };

  const cancelProfileRequest = async () => {
    try {
      await fetch('/api/users/follow/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ targetUserId: selectedUser._id })
      });
      setProfileRequested(false);
    } catch (error) {
      console.error('Cancel request error:', error);
    }
  };

  const toggleProfileFollow = async () => {
    try {
      await fetch('/api/users/follow/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ targetUserId: selectedUser._id, action: profileIsFollower ? 'unfollow' : 'follow' })
      });
      setProfileIsFollower(prev => !prev);
    } catch (error) {
      console.error('Toggle follow error:', error);
    }
  };

  const formatSocialUrl = (url: string) => {
    if (!url) return '#';
    return /^(https?:)?\/\//i.test(url) ? url : `https://${url}`;
  };

  const getSocialIcon = (icon?: string) => {
    switch ((icon || '').toLowerCase()) {
      case 'facebook':
        return FiFacebook;
      case 'instagram':
        return FiInstagram;
      case 'twitter':
        return FiTwitter;
      case 'linkedin':
        return FiLinkedin;
      case 'github':
        return FiGithub;
      case 'youtube':
        return FiYoutube;
      case 'link':
        return FiLink;
      case 'tiktok':
        return SiTiktok;
      case 'whatsapp':
        return SiWhatsapp;
      case 'snapchat':
        return SiSnapchat;
      case 'discord':
        return SiDiscord;
      case 'pinterest':
        return SiPinterest;
      case 'reddit':
        return SiReddit;
      case 'behance':
        return SiBehance;
      case 'dribbble':
        return SiDribbble;
      case 'medium':
        return SiMedium;
      case 'stackoverflow':
        return SiStackoverflow;
      case 'telegram':
      case 'send':
        return SiTelegram;
      default:
        return FiGlobe;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element | null;

      if (emojiPickerRef.current && target && !emojiPickerRef.current.contains(target)) {
        setShowEmojiPicker(false);
      }

      if (!target) return;
      if (!target.closest('[data-header-menu]')) {
        setShowHeaderMenu(false);
      }
      if (target.closest('[data-menu]') || target.closest('[data-reaction]')) {
        return;
      }
      setShowReactions(null);
      setMessageMenu(null);
      setMessageMenuPos(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (slowModeRemaining > 0) return;
    if (draftValue.trim()) {
      const nextContent = draftValue.trim();
      if (editingMessageId) {
        onEditMessage?.(editingMessageId, nextContent);
        setEditingMessageId(null);
      } else if (replyingTo) {
        onReplyMessage?.(
          replyingTo._id!,
          nextContent,
          replyingTo.senderId === currentUser.id ? 'You' : selectedUser.username,
          replyingTo.content
        );
        setReplyingTo(null);
      } else {
        onSendMessage(nextContent, 'text', { expiresInSeconds: getEphemeralSeconds() });
      }
      rememberTypedText(nextContent);
      onDraftChange?.('');
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    }
  };

  const handleEmojiClick = (emojiData: { emoji: string }) => {
    const next = `${draftValue}${emojiData.emoji}`;
    onDraftChange?.(next);
    inputRef.current?.focus();
  };

  const getEphemeralSeconds = useCallback(() => {
    if (!ephemeralDuration) return undefined;
    return ephemeralDuration;
  }, [ephemeralDuration]);

  const applySuggestion = (suggestion: string) => {
    onDraftChange?.(suggestion);
    inputRef.current?.focus();
  };

  const handleAddReaction = useCallback((messageId: string, emoji: string) => {
    onAddReaction?.(messageId, emoji);
    setShowReactions(null);
  }, [onAddReaction]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    onDeleteMessage?.(messageId);
    setMessageMenu(null);
  }, [onDeleteMessage]);

  const handleEditClick = (message: Message) => {
    if (!message._id) return;
    setEditingMessageId(message._id);
    onDraftChange?.(message.content);
    setShowReactions(null);
    setMessageMenu(null);
    inputRef.current?.focus();
  };

  const isEditable = useCallback(() => true, []);

  const handleReplyClick = (message: Message) => {
    setReplyingTo(message);
    setShowReactions(null);
    setMessageMenu(null);
    inputRef.current?.focus();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg'
      ];
      const mimeType = preferredTypes.find(type => MediaRecorder.isTypeSupported(type));
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;
      setRecordTranscript('');
      setRecordInterim('');
      setRecordError('');

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.stop();
          } catch {
            // ignore
          }
        }
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        if (cancelRecordingRef.current) {
          stream.getTracks().forEach(track => track.stop());
          audioChunksRef.current = [];
          setRecordSeconds(0);
          setRecordState('idle');
          setRecordTranscript('');
          setRecordInterim('');
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        if (!blob.size) {
          setActionToast({ content: 'Voice note is empty. Please check microphone permission.' });
          stream.getTracks().forEach(track => track.stop());
          setRecordSeconds(0);
          setRecordState('idle');
          setRecordTranscript('');
          setRecordInterim('');
          return;
        }
        const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
        await uploadAndSendFile(file, { transcript: recordTranscript.trim() || undefined });
        stream.getTracks().forEach(track => track.stop());
        setRecordSeconds(0);
        setRecordState('idle');
        setRecordTranscript('');
        setRecordInterim('');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setRecordState('recording');
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);

      const SpeechRecognitionCtor = (window as typeof window & {
        SpeechRecognition?: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      }).SpeechRecognition ||
        (window as typeof window & {
          SpeechRecognition?: new () => SpeechRecognitionInstance;
          webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
        }).webkitSpeechRecognition;

      if (!window.isSecureContext) {
        setRecordError('Live transcription requires HTTPS or localhost.');
      } else if (SpeechRecognitionCtor) {
        const recognition = new SpeechRecognitionCtor();
        const lang = recordLang === 'auto' ? (navigator.language || 'en-US') : recordLang;
        recognition.lang = lang;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          let finalText = '';
          let interimText = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            const transcript = result[0]?.transcript || '';
            if (result.isFinal) {
              finalText += `${transcript} `;
            } else {
              interimText += transcript;
            }
          }
          if (finalText.trim()) {
            setRecordTranscript(prev => `${prev} ${finalText}`.trim());
          }
          setRecordInterim(interimText.trim());
        };
        recognition.onerror = () => {
          setRecordInterim('');
          setRecordError('Live transcription unavailable. Try another language.');
        };
        recognition.onend = () => {
          if (mediaRecorderRef.current?.state === 'recording') {
            try {
              recognition.start();
            } catch {
              // ignore
            }
          } else {
            setRecordInterim('');
          }
        };
        speechRecognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          // ignore
        }
      } else {
        setRecordError('Speech recognition not supported in this browser.');
      }
    } catch (error) {
      console.error('Microphone access error:', error);
      alert('Microphone not available. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const pauseRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.pause();
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      setRecordState('paused');
    }
  };

  const resumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'paused') {
      recorder.resume();
      setRecordState('recording');
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.start();
        } catch {
          // ignore
        }
      }
    }
  };

  const cancelRecording = () => {
    cancelRecordingRef.current = true;
    stopRecording();
  };

  const scheduleMessageAt = async (scheduledAt: number) => {
    if (!draftValue.trim()) return;
    const content = draftValue.trim();
    try {
      await fetch('/api/messages/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({
          receiverId: selectedUser._id,
          content,
          type: 'text',
          scheduledAt
        })
      });
      onDraftChange?.('');
      setShowScheduleModal(false);
    } catch (error) {
      console.error('Schedule message error:', error);
    }
  };

  const scheduleMessage = async (minutes: number) => {
    const scheduledAt = Date.now() + minutes * 60 * 1000;
    await scheduleMessageAt(scheduledAt);
  };

  const uploadAndSendFile = async (file: File, options?: { transcript?: string }) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (data.success) {
        const isImage = file.type.startsWith('image/');
        const isAudio = file.type.startsWith('audio/');
        onSendMessage(file.name, isImage ? 'image' : isAudio ? 'audio' : 'file', {
          fileUrl: data.fileUrl,
          fileName: data.filename ?? file.name,
          fileSize: data.fileSize ?? file.size,
          transcript: isAudio ? options?.transcript : undefined,
          expiresInSeconds: getEphemeralSeconds()
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const uploadAndSendFilesGroup = async (files: File[]) => {
    const results: Array<{ url: string; name: string; size?: number; type?: string }> = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (data.success) {
          results.push({
            url: data.fileUrl,
            name: data.filename ?? file.name,
            size: data.fileSize ?? file.size,
            type: file.type
          });
        }
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
    if (results.length > 0) {
      onSendMessage(`[${results.length} attachments]`, 'file', {
        files: results,
        expiresInSeconds: getEphemeralSeconds()
      });
      return results;
    }
    return [];
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (files.length === 1) {
      await uploadAndSendFile(files[0]);
    } else {
      await uploadAndSendFilesGroup(files);
    }
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) return;
    if (files.length === 1) {
      await uploadAndSendFile(files[0]);
    } else {
      await uploadAndSendFilesGroup(files);
    }
  };

  const formatFileSize = useCallback((size?: number) => {
    if (!size || size <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }, []);

  const getDisplayFileName = useCallback((name?: string) => {
    if (!name) return 'file';
    const cleaned = name.replace(/^\d+-/, '').replace(/_+/g, ' ').trim();
    return cleaned || name;
  }, []);

  const parseCallLog = useCallback((content?: string) => {
    if (!content) return null;
    if (!content.includes('📞')) return null;

    const lower = content.toLowerCase();
    const isVideo = lower.includes('video');
    const durationMatch = content.match(/•\s*(\d{2}:\d{2})/);
    const duration = durationMatch?.[1];

    if (lower.includes('missed')) {
      return { type: isVideo ? 'missed_video' : 'missed_voice', duration };
    }
    if (lower.includes('declined')) {
      return { type: isVideo ? 'declined_video' : 'declined_voice', duration };
    }
    if (lower.includes('call')) {
      return { type: isVideo ? 'completed_video' : 'completed_voice', duration };
    }
    return null;
  }, []);

  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'ig');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part)
        ? <mark key={index} className="bg-amber-300/40 text-amber-900 rounded px-0.5">{part}</mark>
        : <span key={index}>{part}</span>
    );
  };

  const formatCountdown = (expiresAt?: Date | string | number) => {
    if (!expiresAt) return '';
    const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - nowMs) / 1000));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getMessageStatus = useCallback((message: Message) => {
    if (message.isDeleted) return null;
    switch (message.status) {
      case 'read':
        return (
          <div className="flex items-center gap-0.5" title={message.readAt ? `Read ${new Date(message.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Read'}>
            <FiCheckCircle className="text-indigo-400 text-xs" />
            <FiCheckCircle className="text-indigo-400 text-xs -ml-1" />
          </div>
        );
      case 'delivered':
        return (
          <div className="flex items-center gap-0.5">
            <FiCheck className="text-gray-400 text-xs" />
            <FiCheck className="text-gray-400 text-xs -ml-1" />
          </div>
        );
      default:
        return <FiCheck className="text-gray-500 text-xs" />;
    }
  }, []);

  const getReactionsDisplay = useCallback((reactions: MessageReaction[] = [], messageId?: string) => {
    const grouped = reactions.reduce((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      <button
        type="button"
        onClick={() => {
          if (!messageId) return;
          const msg = messages.find(m => m._id === messageId);
          if (msg) setReactionModalMessage(msg);
        }}
        className="flex gap-1 mt-1 animate-fadeIn"
        title="View reactions"
      >
        {Object.entries(grouped).map(([emoji, count]) => (
          <span
            key={emoji}
            className={`text-xs backdrop-blur-sm px-2 py-0.5 rounded-full border shadow-lg hover:scale-110 transition-transform duration-200 cursor-default ${accentStyle.softBg} ${accentStyle.border} ${accentStyle.text}`}
            title={`${count} ${count === 1 ? 'reaction' : 'reactions'}`}
          >
            {emoji} {count}
          </span>
        ))}
      </button>
    );
  }, [messages]);

  const groupedMessages = effectiveMessages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const date = new Date(msg.timestamp).toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric'
    });
    const last = acc[acc.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      acc.push({ date, msgs: [msg] });
    }
    return acc;
  }, []);

  const commonReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  const pinnedMessages = pinnedMessageIds
    .map((id) => messages.find(msg => msg._id === id))
    .filter((msg): msg is Message => Boolean(msg));

  const reactionSummary = messages.reduce<Record<string, number>>((acc, msg) => {
    msg.reactions?.forEach((reaction) => {
      acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
    });
    return acc;
  }, {});

  const topReactions = Object.entries(reactionSummary)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const buildExportLines = () => {
    return messages.map((m) => {
      const time = new Date(m.timestamp).toLocaleString();
      const sender = m.senderId === currentUser.id ? currentUser.username : selectedUser.username;
      let body = typeof m.content === 'string' ? m.content : '';
      if (m.fileUrl) {
        body = `[file] ${m.fileName || m.fileUrl}`;
      }
      if (Array.isArray(m.files) && m.files.length > 0) {
        body = `[attachments] ${m.files.map(f => f.name || f.url).join(', ')}`;
      }
      if (m.isDeleted) {
        body = '[deleted]';
      }
      return `[${time}] ${sender}: ${body}`;
    });
  };

  const exportChatTxt = () => {
    const lines = buildExportLines().join('\n');
    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-${selectedUser.username}-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportChatPdf = () => {
    const escapeHtml = (text: string) =>
      text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = buildExportLines().map(line => `<div>${escapeHtml(line)}</div>`).join('');
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Chat Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; background: #0b0f1a; color: #e5e7eb; }
            h1 { font-size: 18px; margin-bottom: 16px; }
            .line { margin: 4px 0; font-size: 12px; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>Chat with ${escapeHtml(selectedUser.username)}</h1>
          ${lines.replace(/<div>/g, '<div class="line">')}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div
      className={`flex flex-col h-full ${theme.root} relative`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {chatBackground && (
        <div
          className="absolute inset-0 bg-center bg-cover opacity-25 pointer-events-none"
          style={{ backgroundImage: `url(${chatBackground})` }}
        />
      )}
      {/* Drag & drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-indigo-600/20 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn">
          <div className="bg-gray-900/90 rounded-2xl p-8 border-2 border-dashed border-indigo-500 shadow-2xl transform scale-110 animate-pulse">
            <FiUpload className="text-indigo-400 text-4xl mx-auto mb-3" />
            <p className="text-white text-lg font-medium">Drop file to upload</p>
          </div>
        </div>
      )}

      {/* Header with glass effect */}
      <div className={`shrink-0 px-5 py-4 pl-12 ${theme.header} backdrop-blur-xl border-b flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="w-11 h-11 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden ring-2 ring-indigo-500/30 group-hover:ring-indigo-400 transition-all duration-300">
              {selectedUser.avatar ? (
                <Image
                  src={selectedUser.avatar}
                  alt={selectedUser.username}
                  width={44}
                  height={44}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                selectedUser.username.charAt(0).toUpperCase()
              )}
            </div>
            {selectedUser.isOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-gray-900 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <p className={`font-semibold ${theme.headerText} text-base leading-tight`}>
              {selectedUser.username}
            </p>
            <div className="flex items-center gap-1">
              <span className={`text-xs ${selectedUser.isOnline ? 'text-emerald-400' : theme.headerSub}`}>
                {selectedUser.isOnline ? 'Online' : 'Offline'}
              </span>
              {presenceText && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="text-xs text-indigo-400 animate-pulse">{presenceText}</span>
                </>
              )}
            </div>
            {selectedUser.statusMessage && (
              <div className="text-[11px] text-indigo-300 truncate max-w-55">
                {selectedUser.statusMessage}
              </div>
            )}

          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLock}
            title={!hasLockPasscode ? 'Set chat passcode' : (isLocked ? 'Unlock conversation' : 'Lock conversation')}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 ${isLocked ? 'bg-indigo-500/10 text-indigo-400' : theme.actionButton}`}
          >
            {isLocked ? <FiLock size={18} /> : <FiUnlock size={18} />}
          </button>
          <button
            onClick={() => setShowStarredOnly(v => !v)}
            title={showStarredOnly ? 'Show all messages' : 'Show starred messages'}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 ${showStarredOnly ? 'bg-amber-500/20 text-amber-300' : theme.actionButton}`}
          >
            <FiStar className="text-base" />
          </button>
          <button
            onClick={openCollaborationTools}
            title="Collaboration Suite (Whiteboard & Code)"
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 ${isDarkMode ? 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200'}`}
          >
            <FiZap className="text-base" />
          </button>
          <button
            onClick={() => setShowSearch(v => !v)}
            title="Search"
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 ${theme.actionButton}`}
          >
            <FiSearch className="text-base" />
          </button>
          <div className="relative" data-header-menu>
            <button
              ref={headerMenuButtonRef}
              onClick={() => {
                const rect = headerMenuButtonRef.current?.getBoundingClientRect();
                if (rect) {
                  setHeaderMenuPos({ top: rect.bottom + 8, left: rect.right - 176 });
                }
                setShowHeaderMenu(v => !v);
              }}
              title="Actions"
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 ${theme.actionButton}`}
            >
              <FiMoreVertical className="text-base" />
            </button>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              title="Close Chat"
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 ${isDarkMode ? 'bg-gray-800/80 text-gray-400 hover:bg-red-600/20 hover:text-red-400' : 'bg-white/90 text-gray-500 hover:bg-red-50 hover:text-red-500 border border-gray-200/70'}`}
            >
              <FiX className="text-base" />
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className={`shrink-0 px-5 py-3 ${theme.searchBar} border-b backdrop-blur-sm`}>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveSearchIndex(0);
              }}
              placeholder="Search in chat..."
              className={`flex-1 ${theme.searchInput} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
            />
            <span className="text-xs text-gray-400 min-w-15 text-right">
              {searchMatches.length > 0 ? `${activeSearchIndex + 1}/${searchMatches.length}` : '0/0'}
            </span>
            <button
              onClick={() => {
                if (searchMatches.length === 0) return;
                const next = (activeSearchIndex - 1 + searchMatches.length) % searchMatches.length;
                setActiveSearchIndex(next);
                scrollToSearchResult(next);
              }}
              className="px-2 py-2 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs"
              title="Previous"
            >
              Prev
            </button>
            <button
              onClick={() => {
                if (searchMatches.length === 0) return;
                const next = (activeSearchIndex + 1) % searchMatches.length;
                setActiveSearchIndex(next);
                scrollToSearchResult(next);
              }}
              className="px-2 py-2 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs"
              title="Next"
            >
              Next
            </button>
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="px-2 py-2 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs"
              title="Close"
            >
              Close
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {[
              { id: 'all', label: 'All' },
              { id: 'messages', label: 'Messages' },
              { id: 'images', label: 'Images' },
              { id: 'files', label: 'Files' },
              { id: 'links', label: 'Links' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSearchFilter(item.id as typeof searchFilter);
                  setActiveSearchIndex(0);
                }}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${searchFilter === item.id
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40'
                  : 'bg-gray-800/60 text-gray-300 border-gray-700/60 hover:border-gray-500/60'
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showLockManageModal && (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeLockManageModal}>
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm font-semibold">
                {lockModalMode === 'set' ? 'Set chat passcode' : lockModalMode === 'change' ? 'Change passcode' : 'Delete passcode'}
              </p>
              <button
                onClick={closeLockManageModal}
                disabled={lockBusy}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <form className="p-4 space-y-3" onSubmit={submitLockManageModal}>
              {lockModalMode !== 'set' && (
                <input
                  type="password"
                  value={lockCurrentPasscode}
                  onChange={(e) => {
                    setLockCurrentPasscode(e.target.value);
                    if (lockModalError) setLockModalError('');
                  }}
                  placeholder="Current passcode"
                  autoFocus
                  className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-gray-800/80 text-white border border-gray-700/60' : 'bg-slate-50 text-gray-900 border border-gray-200'}`}
                />
              )}
              {lockModalMode === 'set' && (
                <input
                  type="password"
                  value={lockNewPasscode}
                  onChange={(e) => {
                    setLockNewPasscode(e.target.value);
                    if (lockModalError) setLockModalError('');
                  }}
                  placeholder="Passcode (min 4 chars)"
                  autoFocus
                  className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-gray-800/80 text-white border border-gray-700/60' : 'bg-slate-50 text-gray-900 border border-gray-200'}`}
                />
              )}
              {lockModalMode !== 'delete' && (
                <>
                  {lockModalMode === 'change' && (
                    <input
                      type="password"
                      value={lockNewPasscode}
                      onChange={(e) => {
                        setLockNewPasscode(e.target.value);
                        if (lockModalError) setLockModalError('');
                      }}
                      placeholder="New passcode (min 4 chars)"
                      className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-gray-800/80 text-white border border-gray-700/60' : 'bg-slate-50 text-gray-900 border border-gray-200'}`}
                    />
                  )}
                  <input
                    type="password"
                    value={lockConfirmPasscode}
                    onChange={(e) => {
                      setLockConfirmPasscode(e.target.value);
                      if (lockModalError) setLockModalError('');
                    }}
                    placeholder={lockModalMode === 'set' ? 'Confirm passcode' : 'Confirm new passcode'}
                    className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-gray-800/80 text-white border border-gray-700/60' : 'bg-slate-50 text-gray-900 border border-gray-200'}`}
                  />
                </>
              )}
              {lockModalMode === 'delete' && (
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Enter current passcode to remove chat protection.
                </p>
              )}
              {lockModalError && (
                <div className="text-xs text-rose-400">{lockModalError}</div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={lockBusy}
                  className="flex-1 rounded-lg px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors disabled:opacity-60"
                >
                  {lockBusy ? 'Please wait...' : lockModalMode === 'set' ? 'Set passcode' : lockModalMode === 'change' ? 'Change passcode' : 'Delete passcode'}
                </button>
                <button
                  type="button"
                  onClick={closeLockManageModal}
                  disabled={lockBusy}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm transition-colors disabled:opacity-60 ${isDarkMode ? 'bg-gray-800/80 text-gray-200 hover:bg-gray-700/80' : 'bg-slate-100 text-gray-700 hover:bg-slate-200'}`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="absolute inset-x-0 bottom-0 top-19 z-70 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-5 ${isDarkMode ? 'bg-gray-900/95 border-gray-800/70 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
            <div className="flex items-center justify-center mb-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>
                <FiLock className="text-xl" />
              </div>
            </div>
            <h3 className="text-sm font-semibold text-center">Conversation is locked</h3>
            <p className={`text-xs text-center mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Enter passcode to view and send messages.
            </p>

            {!showPasscodeInput ? (
              <button
                type="button"
                onClick={() => {
                  setShowPasscodeInput(true);
                  setPasscodeInput('');
                  setPasscodeError(false);
                }}
                className="w-full mt-4 rounded-lg px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors disabled:opacity-60"
                disabled={lockBusy}
              >
                {lockBusy ? 'Please wait...' : 'Unlock chat'}
              </button>
            ) : (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  unlockChat(passcodeInput);
                }}
              >
                <input
                  type="password"
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value);
                    if (passcodeError) setPasscodeError(false);
                  }}
                  placeholder="Enter passcode"
                  autoFocus
                  className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-gray-800/80 text-white border border-gray-700/60' : 'bg-slate-50 text-gray-900 border border-gray-200'}`}
                />
                {passcodeError && (
                  <div className="text-xs text-rose-400">Wrong passcode. Try again.</div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-lg px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors"
                    disabled={!passcodeInput.trim() || lockBusy}
                  >
                    {lockBusy ? 'Unlocking...' : 'Unlock'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasscodeInput(false);
                      setPasscodeInput('');
                      setPasscodeError(false);
                    }}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm transition-colors ${isDarkMode ? 'bg-gray-800/80 text-gray-200 hover:bg-gray-700/80' : 'bg-slate-100 text-gray-700 hover:bg-slate-200'}`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showHeaderMenu && headerMenuPos && createPortal(
        <div
          className="fixed pointer-events-auto"
          style={{ top: headerMenuPos.top, left: headerMenuPos.left, zIndex: 2147483647 }}
          data-header-menu
        >
          <div className={`w-44 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}>
            {imageMessages.length > 0 && (
              <button
                onClick={() => {
                  setGalleryIndex(0);
                  setShowGallery(true);
                  setShowHeaderMenu(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
              >
                <FiImage className="text-sm" /> Gallery
              </button>
            )}
            <button
              onClick={() => {
                openProfile();
                setShowHeaderMenu(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
            >
              <FiMessageSquare className="text-sm" /> Profile
            </button>
            <button
              onClick={() => {
                window.open(`/profile/${selectedUser._id}`, '_blank');
                setShowHeaderMenu(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
            >
              <FiMessageSquare className="text-sm" /> View full profile
            </button>
            <button
              onClick={() => {
                exportChatTxt();
                setShowHeaderMenu(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
            >
              <FiDownload className="text-sm" /> Export TXT
            </button>
            <button
              onClick={() => {
                exportChatPdf();
                setShowHeaderMenu(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
            >
              <FiDownload className="text-sm" /> Export PDF
            </button>
            {onSetChatTheme && (
              <button
                onClick={() => {
                  setShowThemeModal(true);
                  setShowHeaderMenu(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
              >
                <FiStar className="text-sm" /> Chat theme
              </button>
            )}
            <button
              onClick={() => {
                setShowRemindersPanel(true);
                setShowHeaderMenu(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
            >
              <FiClock className="text-sm" /> Reminders
            </button>
            <button
              onClick={() => {
                setShowTasksPanel(true);
                setShowHeaderMenu(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
            >
              <FiCheckCircle className="text-sm" /> Tasks
            </button>
            <button
              onClick={() => {
                setShowEphemeralModal(true);
                setShowHeaderMenu(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
            >
              <FiClock className="text-sm" /> Ephemeral timer
            </button>
            {onToggleMute && (
              <button
                onClick={() => {
                  onToggleMute();
                  setShowHeaderMenu(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
              >
                {isMuted ? <FiBell className="text-sm" /> : <FiBellOff className="text-sm" />} {isMuted ? 'Unmute chat' : 'Mute chat'}
              </button>
            )}
            {hasLockPasscode && (
              <>
                {!isLocked && onLockToggle && (
                  <button
                    onClick={async () => {
                      const result = await onLockToggle(true);
                      if (result.ok) {
                        setActionToast({ content: 'تم اغلاق الشات بنجاح' });
                      }
                      setShowHeaderMenu(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
                  >
                    <FiLock className="text-sm" /> Lock chat now
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowHeaderMenu(false);
                    openLockManageModal('change');
                  }}
                  className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
                >
                  <FiUnlock className="text-sm" /> Change passcode
                </button>
                <button
                  onClick={() => {
                    setShowHeaderMenu(false);
                    openLockManageModal('delete');
                  }}
                  className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-red-300' : 'hover:bg-slate-100 text-red-600'}`}
                >
                  <FiTrash2 className="text-sm" /> Delete passcode
                </button>
              </>
            )}
            <button
              onClick={() => {
                onInitiateCall('audio');
                setShowHeaderMenu(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
            >
              <FiPhone className="text-sm" /> Voice Call
            </button>
            <button
              onClick={() => {
                onInitiateCall('video');
                setShowHeaderMenu(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70 text-gray-200' : 'hover:bg-slate-100 text-gray-700'}`}
            >
              <FiVideo className="text-sm" /> Video Call
            </button>
          </div>
        </div>,
        document.body
      )}

      {messageMenu && messageMenuPos && createPortal(
        <div
          className="fixed pointer-events-auto"
          style={{ top: messageMenuPos.top, left: messageMenuPos.left, zIndex: 2147483647 }}
          data-menu
        >
          <div
            style={{ maxHeight: messageMenuPos.maxHeight }}
            className={`w-44 overflow-y-auto scrollbar-thin backdrop-blur-xl rounded-xl shadow-2xl border py-1 animate-scaleIn ${isDarkMode ? 'bg-gray-800/95 border-gray-700/50 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}
          >
            {(() => {
              const activeMessage = messages.find(m => m._id === messageMenu);
              if (!activeMessage) return null;
              const isMe = activeMessage.senderId === currentUser.id;
              const isPinned = Boolean(activeMessage._id && pinnedMessageIds.includes(activeMessage._id));
              const canEdit = isMe && Boolean(onEditMessage);
              const canEditNow = canEdit && isEditable();
              const hasTranslation = Boolean(activeMessage._id && translatedMessages[activeMessage._id]);
              const canTranslate = typeof activeMessage.content === 'string' && activeMessage.content.trim().length > 0;
              return (
                <>
                  <button
                    onClick={() => {
                      handleReplyClick(activeMessage);
                      setMessageMenu(null);
                      setMessageMenuPos(null);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-all duration-200 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700/80 hover:text-white' : 'text-gray-700 hover:bg-slate-100 hover:text-gray-900'}`}
                  >
                    <FiMessageSquare className="text-xs" /> Reply
                  </button>
                  {onForwardMessage && (
                    <button
                      onClick={() => {
                        setForwardMessage(activeMessage);
                        setForwardQuery('');
                        setShowForwardModal(true);
                        setMessageMenu(null);
                        setMessageMenuPos(null);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-all duration-200 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700/80 hover:text-white' : 'text-gray-700 hover:bg-slate-100 hover:text-gray-900'}`}
                    >
                      <FiCornerUpLeft className="text-xs" /> Forward
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowReactions(activeMessage._id!);
                      setMessageMenu(null);
                      setMessageMenuPos(null);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-all duration-200 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700/80 hover:text-white' : 'text-gray-700 hover:bg-slate-100 hover:text-gray-900'}`}
                  >
                    <FiSmile className="text-xs" /> React
                  </button>
                  <button
                    onClick={() => {
                      openThread(activeMessage);
                      setMessageMenu(null);
                      setMessageMenuPos(null);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-all duration-200 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700/80 hover:text-white' : 'text-gray-700 hover:bg-slate-100 hover:text-gray-900'}`}
                  >
                    <FiMessageSquare className="text-xs" /> Thread
                  </button>
                  <button
                    onClick={() => {
                      setTranslateMessage(activeMessage);
                      setShowTranslateModal(true);
                      setMessageMenu(null);
                      setMessageMenuPos(null);
                    }}
                    disabled={!canTranslate || translatingMessageId === activeMessage._id}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-all duration-200 ${!canTranslate
                      ? 'text-gray-500 cursor-not-allowed opacity-60'
                      : isDarkMode
                        ? 'text-gray-300 hover:bg-gray-700/80 hover:text-white'
                        : 'text-gray-700 hover:bg-slate-100 hover:text-gray-900'
                      }`}
                  >
                    <FiMessageSquare className="text-xs" /> {hasTranslation ? 'Show original' : (translatingMessageId === activeMessage._id ? 'Translating...' : 'Translate')}
                  </button>
                  <button
                    onClick={() => {
                      setReminderMessage(activeMessage);
                      setShowReminderModal(true);
                      setMessageMenu(null);
                      setMessageMenuPos(null);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-all duration-200 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700/80 hover:text-white' : 'text-gray-700 hover:bg-slate-100 hover:text-gray-900'}`}
                  >
                    <FiClock className="text-xs" /> Remind me
                  </button>
                  <button
                    onClick={() => {
                      openTaskModal(activeMessage, null);
                      setMessageMenu(null);
                      setMessageMenuPos(null);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-all duration-200 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700/80 hover:text-white' : 'text-gray-700 hover:bg-slate-100 hover:text-gray-900'}`}
                  >
                    <FiCheckCircle className="text-xs" /> Add task
                  </button>
                  {activeMessage._id && onTogglePin && (
                    <button
                      onClick={() => {
                        onTogglePin(activeMessage._id!);
                        setMessageMenu(null);
                        setMessageMenuPos(null);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-all duration-200 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700/80 hover:text-white' : 'text-gray-700 hover:bg-slate-100 hover:text-gray-900'}`}
                    >
                      <FiBookmark className="text-xs" /> {isPinned ? 'Unpin' : 'Pin'}
                    </button>
                  )}
                  {activeMessage._id && onToggleStar && (
                    <button
                      onClick={() => {
                        onToggleStar(activeMessage._id!);
                        setMessageMenu(null);
                        setMessageMenuPos(null);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-all duration-200 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700/80 hover:text-white' : 'text-gray-700 hover:bg-slate-100 hover:text-gray-900'}`}
                    >
                      <FiStar className="text-xs" /> {starredMessageIds.includes(activeMessage._id!) ? 'Unstar' : 'Star'}
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => {
                        if (canEditNow) {
                          handleEditClick(activeMessage);
                          setMessageMenu(null);
                          setMessageMenuPos(null);
                        }
                      }}
                      disabled={!canEditNow}
                      title={canEditNow ? 'Edit message' : 'Edit message'}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-all duration-200 ${canEditNow
                        ? (isDarkMode ? 'text-gray-300 hover:bg-gray-700/80 hover:text-white' : 'text-gray-700 hover:bg-slate-100 hover:text-gray-900')
                        : 'text-gray-500 cursor-not-allowed opacity-60'
                        }`}
                    >
                      <FiEdit2 className="text-xs" /> Edit
                    </button>
                  )}
                  {isMe && (
                    <button
                      onClick={() => {
                        setReceiptMessage(activeMessage);
                        setShowReceiptModal(true);
                        setMessageMenu(null);
                        setMessageMenuPos(null);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-all duration-200 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700/80 hover:text-white' : 'text-gray-700 hover:bg-slate-100 hover:text-gray-900'}`}
                    >
                      <FiCheckCircle className="text-xs" /> Read receipt
                    </button>
                  )}
                  {activeMessage.editHistory && activeMessage.editHistory.length > 0 && (
                    <button
                      onClick={() => {
                        setEditHistoryMessage(activeMessage);
                        setShowEditHistory(true);
                        setMessageMenu(null);
                        setMessageMenuPos(null);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-all duration-200 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700/80 hover:text-white' : 'text-gray-700 hover:bg-slate-100 hover:text-gray-900'}`}
                    >
                      <FiEdit2 className="text-xs" /> Edit history
                    </button>
                  )}
                  {(onDeleteMessage || onDeleteForMe) && (
                    <button
                      onClick={() => {
                        if (activeMessage.senderId === currentUser.id) {
                          handleDeleteMessage(activeMessage._id!);
                        } else {
                          onDeleteForMe?.(activeMessage._id!);
                        }
                        setMessageMenu(null);
                        setMessageMenuPos(null);
                      }}
                      className={`w-full px-4 py-2.5 whitespace-nowrap text-left text-sm flex items-center gap-2 transition-all duration-200 ${isDarkMode ? 'text-red-400 hover:bg-red-600/20 hover:text-red-500' : 'text-red-500 hover:bg-red-50 hover:text-red-600'}`}
                    >
                      <FiTrash2 className="text-xs" /> {activeMessage.senderId === currentUser.id ? 'Delete for everyone' : 'Delete for me'}
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {showForwardModal && forwardMessage && (
        <div className="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Forward message</h3>
              <button
                onClick={() => setShowForwardModal(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-gray-800/80 text-gray-300' : 'bg-slate-100 text-gray-600'}`}
              >
                ×
              </button>
            </div>
            <input
              value={forwardQuery}
              onChange={(e) => setForwardQuery(e.target.value)}
              placeholder="Search users..."
              className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-gray-800/80 text-white placeholder-gray-500' : 'bg-slate-100 text-gray-900 placeholder-gray-500'}`}
            />
            <div className="mt-3 max-h-64 overflow-y-auto space-y-1">
              {users
                .filter(u => u._id !== currentUser.id)
                .filter(u => u.username.toLowerCase().includes(forwardQuery.toLowerCase()))
                .map((user) => (
                  <button
                    key={user._id}
                    onClick={() => {
                      onForwardMessage?.(forwardMessage, user._id as string);
                      setShowForwardModal(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${isDarkMode ? 'hover:bg-gray-800/70' : 'hover:bg-slate-100'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{user.username}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {showScheduleModal && (
        <div className="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-5 border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Schedule message</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-gray-800/80 text-gray-300' : 'bg-slate-100 text-gray-600'}`}
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '5 min', minutes: 5 },
                  { label: '10 min', minutes: 10 },
                  { label: '15 min', minutes: 15 },
                  { label: '30 min', minutes: 30 },
                  { label: '1 hour', minutes: 60 },
                  { label: '2 hours', minutes: 120 },
                  { label: '6 hours', minutes: 360 },
                  { label: 'Tomorrow', minutes: 24 * 60 },
                  { label: '2 days', minutes: 2 * 24 * 60 },
                  { label: '1 week', minutes: 7 * 24 * 60 }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => scheduleMessage(preset.minutes)}
                    className={`px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-800/80 hover:bg-gray-700 text-gray-200' : 'bg-slate-100 hover:bg-slate-200 text-gray-800'}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-gray-800/60 bg-gray-900/60' : 'border-gray-200 bg-white'}`}>
                <p className="text-xs text-gray-400 mb-2">Custom time</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={scheduleAmount}
                    onChange={(e) => setScheduleAmount(e.target.value)}
                    placeholder="Amount"
                    className={`flex-1 px-3 py-2 rounded-lg text-sm outline-none ${isDarkMode ? 'bg-gray-800/70 text-white placeholder-gray-500 border border-gray-700/60' : 'bg-slate-100 text-gray-900 placeholder-gray-500 border border-gray-200'}`}
                  />
                  <select
                    value={scheduleUnit}
                    onChange={(e) => setScheduleUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                    className={`px-3 py-2 rounded-lg text-sm outline-none ${isDarkMode ? 'bg-gray-800/70 text-white border border-gray-700/60' : 'bg-slate-100 text-gray-900 border border-gray-200'}`}
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                  <button
                    onClick={() => {
                      const amount = Number(scheduleAmount);
                      if (!amount || amount <= 0) return;
                      const multiplier = scheduleUnit === 'minutes' ? 1 : scheduleUnit === 'hours' ? 60 : 1440;
                      scheduleMessage(amount * multiplier);
                      setScheduleAmount('');
                    }}
                    className="px-3 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    Set
                  </button>
                </div>
              </div>

              <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-gray-800/60 bg-gray-900/60' : 'border-gray-200 bg-white'}`}>
                <p className="text-xs text-gray-400 mb-2">Pick exact date & time</p>
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm outline-none ${isDarkMode ? 'bg-gray-800/70 text-white border border-gray-700/60' : 'bg-slate-100 text-gray-900 border border-gray-200'}`}
                  />
                  <button
                    onClick={() => {
                      if (!scheduleDateTime) return;
                      const timestamp = new Date(scheduleDateTime).getTime();
                      if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return;
                      scheduleMessageAt(timestamp);
                      setScheduleDateTime('');
                    }}
                    className="px-3 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {pinnedMessages.length > 0 && showPinnedBar && (
        <div className={`shrink-0 px-5 py-2 border-b ${isDarkMode ? 'border-gray-800/60 bg-gray-900/50' : 'border-gray-200/70 bg-white/70'} backdrop-blur-sm`}>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
            <span className={`text-[11px] uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
              Pinned
            </span>
            {pinnedMessages.slice(0, 3).map((msg) => (
              <div
                key={msg._id}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${isDarkMode ? 'bg-gray-800/70 text-gray-200 border-gray-700/60' : 'bg-slate-100 text-gray-800 border-gray-200'}`}
              >
                <button
                  onClick={() => msg._id && scrollToMessageId(msg._id)}
                  className="truncate max-w-40"
                  title={msg.content}
                >
                  {msg.type === 'file' ? (msg.fileName || 'File') : msg.content.slice(0, 30)}
                </button>
                {msg._id && onTogglePin && (
                  <button
                    onClick={() => onTogglePin(msg._id!)}
                    className="text-[10px] text-rose-400 hover:text-rose-300"
                    title="Remove pin"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setShowPinnedBar(false)}
              className={`ml-auto px-2 py-1 rounded-full text-[10px] border ${isDarkMode ? 'text-gray-400 border-gray-700/60' : 'text-gray-600 border-gray-200'}`}
            >
              Hide
            </button>
          </div>
        </div>
      )}

      {pinnedMessages.length > 0 && !showPinnedBar && (
        <div className={`shrink-0 px-5 py-2 border-b ${isDarkMode ? 'border-gray-800/60 bg-gray-900/50' : 'border-gray-200/70 bg-white/70'} backdrop-blur-sm`}>
          <button
            onClick={() => setShowPinnedBar(true)}
            className={`text-[11px] uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}
          >
            Show pinned ({pinnedMessages.length})
          </button>
        </div>
      )}

      {/* Messages area with custom scrollbar */}
      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 select-none animate-fadeIn">
            <div className={`w-20 h-20 rounded-3xl bg-linear-to-br from-indigo-500/20 to-purple-600/20 border flex items-center justify-center text-4xl animate-float ${isDarkMode ? 'border-gray-800/50' : 'border-gray-200/70'}`}>
              Hi
            </div>
            <p className={`${isDarkMode ? 'text-gray-500' : 'text-gray-600'} text-sm`}>
              Say hello to{' '}
              <span className={`font-medium bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {selectedUser.username}
              </span>
            </p>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500/50 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          </div>
        ) : (
          groupedMessages.map(({ date, msgs }, groupIndex) => (
            <div key={date} className="animate-fadeIn" style={{ animationDelay: `${groupIndex * 50}ms` }}>
              {/* Date divider */}
              <div className="flex items-center gap-3 my-6">
                <div className={`flex-1 h-px bg-linear-to-r from-transparent ${isDarkMode ? 'via-gray-800' : 'via-gray-200'} to-transparent`} />
                <span className={`text-xs shrink-0 px-3 py-1 backdrop-blur-sm rounded-full border ${isDarkMode ? 'text-gray-500 bg-gray-900/50 border-gray-800/50' : 'text-gray-600 bg-white/70 border-gray-200/70'}`}>
                  {date}
                </span>
                <div className={`flex-1 h-px bg-linear-to-r from-transparent ${isDarkMode ? 'via-gray-800' : 'via-gray-200'} to-transparent`} />
              </div>

              <div className="space-y-2">
                {msgs.map((message, idx) => {
                  const isMe = message.senderId === currentUser.id;
                  const isLast =
                    idx === msgs.length - 1 ||
                    msgs[idx + 1]?.senderId !== message.senderId;

                  if (message.isDeleted) {
                    return (
                      <div
                        key={message._id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-slideIn`}
                      >
                        <div className={`text-xs italic px-4 py-2 backdrop-blur-sm rounded-xl border ${isDarkMode ? 'text-gray-600 bg-gray-800/30 border-gray-800/50' : 'text-gray-500 bg-white/70 border-gray-200/70'}`}>
                          This message was deleted
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={message._id}
                      ref={(el) => {
                        if (message._id) messageRefs.current[message._id] = el;
                      }}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} relative group animate-slideIn`}
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      {/* Quick reactions bar */}
                      <div
                        className={`absolute ${isMe ? 'right-4' : 'left-7'} -top-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                      >
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full border shadow-lg ${accentStyle.softBg} ${accentStyle.border}`}>
                          {commonReactions.slice(0, 4).map((emoji) => (
                            <button
                              key={`${message._id}-quick-${emoji}`}
                              onClick={() => handleAddReaction(message._id!, emoji)}
                              className="w-7 h-7 text-sm rounded-full hover:bg-gray-700/20 transition"
                              title={emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              setShowReactions(message._id!);
                              setMessageMenu(null);
                            }}
                            className="w-7 h-7 text-[10px] rounded-full hover:bg-gray-700/20 transition text-gray-400"
                            title="More"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {/* Reply preview */}
                      {message.replyTo && (
                        <div className={`absolute -top-5 ${isMe ? 'right-0' : 'left-0'} text-[10px] backdrop-blur-sm px-2 py-0.5 rounded-full border ${isDarkMode ? 'text-gray-500 bg-gray-800/50 border-gray-700/50' : 'text-gray-600 bg-white/80 border-gray-200/70'}`}>
                          <span className="font-medium text-indigo-400">↩</span> {message.replyTo.senderUsername}: {message.replyTo.content.substring(0, 20)}...
                        </div>
                      )}

                      {/* Avatar placeholder for spacing on other's side */}
                      {!isMe && (
                        <div className="w-8 shrink-0 mr-2 self-end">
                          {isLast && (
                            <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden ring-2 ring-indigo-500/30 transform transition-transform hover:scale-110">
                              {selectedUser.avatar ? (
                                <Image
                                  src={selectedUser.avatar}
                                  alt={selectedUser.username}
                                  width={32}
                                  height={32}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                selectedUser.username.charAt(0).toUpperCase()
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="relative max-w-[70%]">
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-lg ${isMe
                            ? `${outgoingBubbleClass} rounded-br-none`
                            : `${theme.incomingBubble} rounded-bl-none`
                            }`}
                        >
                          {message.forwardedFrom && (
                            <div className={`text-[10px] mb-1 ${isMe ? 'text-white/70' : 'text-gray-500'} flex items-center gap-1`}>
                              <FiCornerUpLeft className="text-[10px]" />
                              Forwarded from {message.forwardedFrom.username}
                            </div>
                          )}
                          {message.expiresAt && (
                            <div className={`text-[10px] mb-1 ${isMe ? 'text-white/70' : 'text-gray-500'}`}>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 bg-black/20">
                                <FiClock className="text-[10px]" />
                                {formatCountdown(message.expiresAt)}
                              </span>
                            </div>
                          )}
                          {(() => {
                            const fileUrl =
                              message.fileUrl ||
                              (typeof message.content === 'string' && message.content.startsWith('/uploads/')
                                ? message.content
                                : undefined);
                            const rawName =
                              message.fileName ||
                              (typeof message.content === 'string' && !message.content.startsWith('/uploads/')
                                ? message.content
                                : undefined) ||
                              (fileUrl ? decodeURIComponent(fileUrl.split('/').pop() || 'file') : undefined);
                            const displayName = getDisplayFileName(rawName);
                            const fileSize = formatFileSize(message.fileSize);
                            const isImage = isImageFile(rawName, fileUrl, message.type);
                            const isAudio = message.type === 'audio' || /\.(mp3|wav|ogg|webm|m4a)$/i.test(rawName || '');
                            const extension = (displayName.split('.').pop() || '').toUpperCase();
                            const callLog = message.type === 'text' ? parseCallLog(message.content) : null;

                            if (callLog) {
                              const baseClass = isMe
                                ? 'bg-indigo-500/20 border-indigo-400/30'
                                : 'bg-gray-800/60 border-gray-700';
                              const iconClass = isMe ? 'bg-indigo-500/30' : 'bg-gray-700/60';
                              const title =
                                callLog.type.startsWith('missed')
                                  ? 'Missed call'
                                  : callLog.type.startsWith('declined')
                                    ? 'Call declined'
                                    : 'Call ended';
                              const subtitle =
                                callLog.type.includes('video') ? 'Video call' : 'Voice call';
                              const statusPill =
                                callLog.type.startsWith('missed') ? 'Missed' :
                                  callLog.type.startsWith('declined') ? 'Declined' : 'Completed';
                              const statusClass =
                                callLog.type.startsWith('missed') ? 'bg-amber-500/15 text-amber-300 border-amber-400/30' :
                                  callLog.type.startsWith('declined') ? 'bg-rose-500/15 text-rose-300 border-rose-400/30' :
                                    'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';

                              return (
                                <div className={`border ${baseClass} rounded-xl px-4 py-3 min-w-60 backdrop-blur-sm`}>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconClass}`}>
                                      {callLog.type.startsWith('missed') ? (
                                        <FiPhoneMissed className="text-base" />
                                      ) : (
                                        <FiPhoneCall className="text-base" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold">{title}</div>
                                      <div className="text-xs text-white/70">{subtitle}</div>
                                    </div>
                                    <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${statusClass}`}>
                                      {statusPill}
                                    </span>
                                  </div>
                                  {callLog.duration && (
                                    <div className="mt-2 flex items-center gap-1 text-[11px] text-white/70">
                                      <FiClock className="text-xs" />
                                      Duration {callLog.duration}
                                    </div>
                                  )}
                                  <div className="mt-3">
                                    <button
                                      onClick={() => onInitiateCall(callLog.type.includes('video') ? 'video' : 'audio')}
                                      className="w-full text-xs px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors"
                                    >
                                      Call back
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            if (Array.isArray(message.files) && message.files.length > 0) {
                              const imageFiles = message.files.filter(f => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.name || f.url));
                              const otherFiles = message.files.filter(f => !/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.name || f.url));
                              const previewImages = imageFiles.slice(0, 4);
                              const extraCount = imageFiles.length - previewImages.length;
                              return (
                                <div className="space-y-3">
                                  {imageFiles.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2">
                                      {previewImages.map((f, index) => {
                                        const isLast = index === previewImages.length - 1 && extraCount > 0;
                                        return (
                                          <button
                                            key={f.url}
                                            className="relative block overflow-hidden rounded-xl border border-white/10 group"
                                            type="button"
                                            onClick={() => openImageLightbox(imageFiles, index)}
                                          >
                                            <Image
                                              src={f.url}
                                              alt={f.name}
                                              width={260}
                                              height={200}
                                              className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                            {isLast && (
                                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-semibold">
                                                +{extraCount}
                                              </div>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {otherFiles.length > 0 && (
                                    <div className="space-y-2">
                                      {otherFiles.map((f) => (
                                        <div key={f.url} className="flex items-center justify-between gap-2 bg-black/30 rounded-xl px-3 py-2 border border-white/10">
                                          <div className="min-w-0">
                                            <div className="text-sm text-white truncate">{f.name}</div>
                                            {f.size ? <div className="text-[10px] text-indigo-200/80">{formatFileSize(f.size)}</div> : null}
                                            {f.url && /\.(txt|md|csv|json)$/i.test(f.url) && fileSnippets[f.url] && (
                                              <div className="mt-1 text-[10px] text-indigo-100/80 bg-black/20 rounded-lg p-2 border border-white/10 whitespace-pre-wrap">
                                                {fileSnippets[f.url]}
                                              </div>
                                            )}
                                          </div>
                                          <a
                                            href={f.url}
                                            download
                                            className="inline-flex items-center gap-1 text-[10px] text-white/90 hover:text-white bg-black/30 hover:bg-black/50 px-2 py-1 rounded-md transition-all duration-200 hover:scale-105"
                                            title="Download"
                                          >
                                            <FiDownload className="text-xs" />
                                            Download
                                          </a>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            if (message.type === 'video-note') {
                              const videoSrc =
                                fileUrl ||
                                (typeof message.content === 'string' && /^(\/|https?:\/\/)/i.test(message.content)
                                  ? message.content
                                  : '');
                              return <VideoNotePlayer src={videoSrc} isMe={isMe} isDarkMode={isDarkMode} />;
                            }

                            if (fileUrl && isAudio) {
                              return (
                                <div className="space-y-2">
                                  <AudioPlayer
                                    src={fileUrl}
                                    label={displayName}
                                    isMe={isMe}
                                    isDarkMode={isDarkMode}
                                    onDownload={() => {
                                      const link = document.createElement('a');
                                      link.href = fileUrl;
                                      link.download = displayName;
                                      link.click();
                                    }}
                                  />
                                  {message.transcript && (
                                    <div className={`text-[11px] rounded-lg px-3 py-2 border ${isMe ? 'bg-white/10 border-white/10 text-white/90' : isDarkMode ? 'bg-gray-800/60 border-gray-700/60 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
                                      <span className="font-semibold mr-1">Transcript:</span>
                                      {highlightText(message.transcript)}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            if (fileUrl && isImage) {
                              return (
                                <div className="space-y-2">
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block overflow-hidden rounded-lg group/image"
                                  >
                                    <Image
                                      src={fileUrl}
                                      alt={displayName}
                                      width={360}
                                      height={240}
                                      className="rounded-lg w-full h-auto object-cover transition-transform duration-300 group-hover/image:scale-105"
                                    />
                                  </a>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-[10px] text-indigo-200/90 truncate flex-1">{displayName}</div>
                                    <a
                                      href={fileUrl}
                                      download
                                      className="inline-flex items-center gap-1 text-[10px] text-white/90 hover:text-white bg-black/30 hover:bg-black/50 px-2 py-1 rounded-md transition-all duration-200 hover:scale-105"
                                      title="Download"
                                    >
                                      <FiDownload className="text-xs" />
                                      Download
                                    </a>
                                  </div>
                                </div>
                              );
                            }

                            if (fileUrl && (message.type === 'file' || !isImage)) {
                              const isPdf = extension === 'PDF';
                              const isText = /\.(txt|md|csv|json)$/i.test(fileUrl || displayName);
                              return (
                                <div className="bg-black/30 rounded-lg px-3 py-2">
                                  {isPdf ? (
                                    <a
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block"
                                    >
                                      <div className="w-full max-w-sm h-44 rounded-lg overflow-hidden bg-black/40 border border-gray-700/50">
                                        <object
                                          data={`${fileUrl}#page=1&view=fit`}
                                          type="application/pdf"
                                          className="w-full h-full"
                                        >
                                          <div className="w-full h-full flex items-center justify-center text-xs text-white/80">
                                            PDF
                                          </div>
                                        </object>
                                      </div>
                                    </a>
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-linear-to-br from-indigo-500/30 to-purple-600/30 flex items-center justify-center text-xs font-semibold text-white/90 group-hover/file:scale-110 transition-transform duration-200">
                                      {extension || '??'}
                                    </div>
                                  )}
                                  {isText && fileSnippets[fileUrl] && (
                                    <div className="mt-2 text-[11px] text-indigo-100/80 bg-black/20 rounded-lg p-2 border border-white/10 whitespace-pre-wrap">
                                      {fileSnippets[fileUrl]}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-3 mt-2">
                                    <a
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-3 min-w-0 flex-1 hover:text-indigo-100 transition-colors"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="text-sm text-white truncate">{displayName}</div>
                                        {fileSize && <div className="text-[10px] text-indigo-200/80">{fileSize}</div>}
                                      </div>
                                    </a>
                                    <a
                                      href={fileUrl}
                                      download
                                      className="ml-auto inline-flex items-center gap-1 text-[10px] text-white/90 hover:text-white bg-black/30 hover:bg-black/50 px-2 py-1 rounded-md transition-all duration-200 hover:scale-105"
                                      title="Download"
                                    >
                                      <FiDownload className="text-xs" />
                                    </a>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="flex flex-col gap-2">
                                <p className="wrap-break-word">{highlightText(message.content)}</p>
                                {extractUrls(message.content).length > 0 && extractUrls(message.content)[0] && (
                                  <LinkPreview url={extractUrls(message.content)[0]!} isDarkMode={isDarkMode} />
                                )}
                              </div>
                            );
                          })()}

                          {message._id && translatedMessages[message._id] && (
                            <div className={`mt-2 text-[12px] rounded-lg px-3 py-2 border ${accentStyle.softBg} ${accentStyle.border} ${isMe ? 'text-white/90' : (isDarkMode ? 'text-gray-200' : 'text-gray-800')}`}>
                              <span className="opacity-70">Translation:</span> {translatedMessages[message._id]}
                            </div>
                          )}

                          {/* Reactions display */}
                          {message.reactions && message.reactions.length > 0 && (
                            <div className="mt-1">
                              {getReactionsDisplay(message.reactions, message._id)}
                            </div>
                          )}

                          <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <span className={`text-[9px] ${isMe ? 'text-indigo-300' : 'text-gray-500'}`}>
                              {new Date(message.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {message.editedAt && (
                              <span
                                className={`text-[9px] ${isMe ? 'text-indigo-300/70' : 'text-gray-500/70'}`}
                                title={
                                  message.editHistory?.length
                                    ? `Previous: "${message.editHistory[message.editHistory.length - 1].content}" • ${new Date(message.editHistory[message.editHistory.length - 1].editedAt).toLocaleString()}`
                                    : `Edited ${new Date(message.editedAt).toLocaleString()}`
                                }
                              >
                                (edited)
                              </span>
                            )}
                            {isMe && getMessageStatus(message)}
                            {isMe && message.status === 'read' && message.readAt && (
                              <span className={`text-[9px] ${isMe ? 'text-indigo-300/70' : 'text-gray-500/70'}`}>
                                Seen {new Date(message.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Message actions button */}
                        <div
                          className={`message-menu absolute -top-2 right-0 transition-opacity duration-200 ${messageMenu === message._id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          style={{ zIndex: 2147483647 }}
                          data-menu
                        >
                          <button
                            ref={(el) => {
                              if (message._id) messageMenuButtonRefs.current[message._id] = el;
                            }}
                            onClick={() => {
                              const nextOpen = messageMenu !== message._id;
                              if (nextOpen && message._id) {
                                const rect = messageMenuButtonRefs.current[message._id]?.getBoundingClientRect();
                                if (rect) {
                                  const menuWidth = 176;
                                  const gap = 8;
                                  const viewportPadding = 8;
                                  const maxMenuHeightCap = Math.floor(window.innerHeight * 0.72);
                                  const minMenuHeight = 180;
                                  const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - gap - viewportPadding);
                                  const spaceAbove = Math.max(0, rect.top - gap - viewportPadding);
                                  const shouldOpenUp = spaceBelow < 320 && spaceAbove > spaceBelow;
                                  const preferredSpace = shouldOpenUp ? spaceAbove : spaceBelow;
                                  const dynamicMaxHeight = Math.max(minMenuHeight, Math.min(maxMenuHeightCap, preferredSpace));
                                  let left = rect.right - menuWidth;
                                  let top = shouldOpenUp
                                    ? rect.top - dynamicMaxHeight - gap
                                    : rect.bottom + gap;

                                  if (left < 8) left = 8;
                                  if (left + menuWidth > window.innerWidth - 8) {
                                    left = window.innerWidth - menuWidth - 8;
                                  }
                                  if (top < 8) top = 8;
                                  if (top + dynamicMaxHeight > window.innerHeight - 8) {
                                    top = window.innerHeight - dynamicMaxHeight - 8;
                                  }
                                  setMessageMenuPos({ top, left, maxHeight: dynamicMaxHeight });
                                }
                              } else {
                                setMessageMenuPos(null);
                              }
                              setMessageMenu(nextOpen ? message._id! : null);
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-800/80 backdrop-blur-sm hover:bg-gray-700 text-gray-400 hover:text-white transition-all duration-200 hover:scale-110 border border-gray-700/50"
                          >
                            <FiMoreVertical className="text-xs" />
                          </button>
                        </div>

                        {/* Reaction picker */}
                        {showReactions === message._id && (
                          <div
                            className={`reaction-picker absolute bottom-full right-0 mb-2 backdrop-blur-xl rounded-xl shadow-2xl border p-2 animate-slideUp ${accentStyle.softBg} ${accentStyle.border}`}
                            style={{ zIndex: 2147483647 }}
                            data-reaction
                          >
                            <div className="flex gap-1">
                              {commonReactions.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleAddReaction(message._id!, emoji)}
                                  className="w-9 h-9 text-xl hover:bg-gray-700/80 rounded-lg transition-all duration-200 hover:scale-125 flex items-center justify-center"
                                  title={emoji}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      {newMessagesCount > 0 && (
        <button
          onClick={handleJumpToLatest}
          className="absolute bottom-24 right-6 z-40 px-3.5 py-2 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs shadow-lg shadow-indigo-600/30 backdrop-blur-md transition-all"
          title="Jump to latest"
        >
          {newMessagesCount} new message{newMessagesCount > 1 ? 's' : ''} · Jump
        </button>
      )}

      {/* Image gallery modal */}
      {showGallery && (
        <div className="fixed inset-0 z-80 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900/95 border border-gray-800/60 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm text-white font-medium">Gallery</p>
              <button
                onClick={() => setShowGallery(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="flex-1 p-4 flex flex-col gap-4">
              {imageMessages.length === 0 ? (
                <div className="text-sm text-gray-400">No images yet.</div>
              ) : (
                <>
                  <div className="relative flex-1 min-h-[50vh] bg-black/60 rounded-xl border border-gray-800/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setGalleryIndex((i) => (i - 1 + imageMessages.length) % imageMessages.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-20"
                      title="Previous"
                    >
                      <FiChevronLeft />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryIndex((i) => (i + 1) % imageMessages.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-20"
                      title="Next"
                    >
                      <FiChevronRight />
                    </button>
                    <div
                      className="absolute inset-0 z-0"
                      onTouchStart={(e) => {
                        galleryTouchStartX.current = e.touches[0]?.clientX ?? null;
                      }}
                      onTouchEnd={(e) => {
                        const startX = galleryTouchStartX.current;
                        const endX = e.changedTouches[0]?.clientX ?? null;
                        if (startX === null || endX === null) return;
                        const delta = endX - startX;
                        if (Math.abs(delta) < 40) return;
                        if (delta > 0) {
                          setGalleryIndex(i => (i - 1 + imageMessages.length) % imageMessages.length);
                        } else {
                          setGalleryIndex(i => (i + 1) % imageMessages.length);
                        }
                      }}
                    >
                      <Image
                        src={imageMessages[galleryIndex].fileUrl || String(imageMessages[galleryIndex].content)}
                        alt={String(imageMessages[galleryIndex].fileName || imageMessages[galleryIndex].content || 'image')}
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>
                      {galleryIndex + 1} / {imageMessages.length}
                    </span>
                    <button
                      onClick={() => {
                        const url = imageMessages[galleryIndex].fileUrl || String(imageMessages[galleryIndex].content);
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="text-indigo-300 hover:text-indigo-200"
                    >
                      Open original
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {imageMessages.map((m, idx) => {
                      const url = m.fileUrl || (typeof m.content === 'string' ? m.content : '');
                      return (
                        <button
                          key={`${m._id ?? idx}`}
                          onClick={() => setGalleryIndex(idx)}
                          className={`w-16 h-16 rounded-lg overflow-hidden border ${idx === galleryIndex ? 'border-indigo-400/60' : 'border-gray-700/60'} shrink-0`}
                        >
                          <Image
                            src={url}
                            alt="thumb"
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message image lightbox */}
      {showImageLightbox && lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 z-90 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowImageLightbox(false)}
        >
          <div
            className="relative w-full max-w-5xl max-h-[85vh] bg-gray-900/95 border border-gray-800/60 rounded-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">
                  {lightboxImages[lightboxIndex]?.name || 'Image'}
                </p>
                <p className="text-[10px] text-gray-400">
                  {lightboxIndex + 1} / {lightboxImages.length}
                </p>
              </div>
              <button
                onClick={() => setShowImageLightbox(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="relative flex-1 flex items-center justify-center bg-black/60">
              <button
                type="button"
                onClick={() => setLightboxIndex((i) => (i - 1 + lightboxImages.length) % lightboxImages.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                title="Previous"
              >
                <FiChevronLeft />
              </button>
              <div className="relative w-full h-[70vh]">
                <Image
                  src={lightboxImages[lightboxIndex].url}
                  alt={lightboxImages[lightboxIndex].name}
                  fill
                  className="object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setLightboxIndex((i) => (i + 1) % lightboxImages.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                title="Next"
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reaction stats modal */}
      {reactionModalMessage && (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setReactionModalMessage(null)}>
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm font-semibold">Reactions</p>
              <button
                onClick={() => setReactionModalMessage(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {reactionModalMessage.reactions?.length ? (
                Object.entries(
                  reactionModalMessage.reactions.reduce<Record<string, MessageReaction[]>>((acc, r) => {
                    acc[r.emoji] = acc[r.emoji] || [];
                    acc[r.emoji].push(r);
                    return acc;
                  }, {})
                ).map(([emoji, users]) => (
                  <div key={emoji} className={`rounded-xl border p-3 ${isDarkMode ? 'bg-gray-800/70 border-gray-700/60' : 'bg-slate-50 border-gray-200'}`}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="text-lg">{emoji}</span>
                      <span>{users.length}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {users.map((u, idx) => (
                        <span
                          key={`${u.userId}-${idx}`}
                          className={`px-2 py-1 rounded-full text-[11px] ${isDarkMode ? 'bg-gray-900/70 text-gray-200' : 'bg-white text-gray-700 border border-gray-200'}`}
                        >
                          {u.username}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No reactions yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {reminderToast && (
        <div className="fixed bottom-6 right-6 z-95">
          <div className={`px-4 py-3 rounded-xl shadow-2xl border ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
            <div className="text-xs text-gray-400 mb-1">Reminder</div>
            <div className="text-sm">{reminderToast.content}</div>
            <div className="mt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  scrollToMessageId(reminderToast.messageId);
                  setReminderToast(null);
                }}
                className="text-xs text-indigo-300 hover:text-indigo-200"
              >
                Open
              </button>
              <button
                onClick={() => setReminderToast(null)}
                className="text-xs text-indigo-300 hover:text-indigo-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {actionToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-95">
          <div className={`px-4 py-2.5 rounded-xl shadow-2xl border ${isDarkMode ? 'bg-emerald-900/95 border-emerald-700/60 text-emerald-100' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            <div className="text-sm">{actionToast.content}</div>
          </div>
        </div>
      )}

      {/* Translate modal */}
      {showTranslateModal && translateMessage && (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowTranslateModal(false)}>
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm font-semibold">Translate message</p>
              <button
                onClick={() => setShowTranslateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <label className="text-xs text-gray-400">From</label>
              <select
                value={translateSource}
                onChange={(e) => setTranslateSource(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-slate-100 text-gray-900'}`}
              >
                <option value="auto">Auto detect</option>
                <option value="ar">Arabic</option>
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="es">Spanish</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="tr">Turkish</option>
                <option value="ru">Russian</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
              </select>
              <label className="text-xs text-gray-400">To</label>
              <select
                value={translateTarget}
                onChange={(e) => setTranslateTarget(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-slate-100 text-gray-900'}`}
              >
                <option value="ar">Arabic</option>
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="es">Spanish</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="tr">Turkish</option>
                <option value="ru">Russian</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
              </select>
              <button
                onClick={() => {
                  handleTranslateMessage(translateMessage, translateSource, translateTarget);
                  setShowTranslateModal(false);
                }}
                className="w-full mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
              >
                Translate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminder modal */}
      {showReminderModal && reminderMessage && (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowReminderModal(false)}>
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm font-semibold">Remind me</p>
              <button
                onClick={() => setShowReminderModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '5 min', minutes: 5 },
                  { label: '10 min', minutes: 10 },
                  { label: '15 min', minutes: 15 },
                  { label: '30 min', minutes: 30 },
                  { label: '1 hour', minutes: 60 },
                  { label: '2 hours', minutes: 120 },
                  { label: '6 hours', minutes: 360 },
                  { label: 'Tomorrow', minutes: 24 * 60 },
                  { label: '2 days', minutes: 2 * 24 * 60 },
                  { label: '1 week', minutes: 7 * 24 * 60 }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      scheduleReminder(reminderMessage, preset.minutes);
                      setShowReminderModal(false);
                    }}
                    className={`px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-800/80 hover:bg-gray-700 text-gray-200' : 'bg-slate-100 hover:bg-slate-200 text-gray-800'}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-gray-800/60 bg-gray-900/60' : 'border-gray-200 bg-white'}`}>
                <p className="text-xs text-gray-400 mb-2">Custom time</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={reminderAmount}
                    onChange={(e) => setReminderAmount(e.target.value)}
                    placeholder="Amount"
                    className={`flex-1 px-3 py-2 rounded-lg text-sm outline-none ${isDarkMode ? 'bg-gray-800/70 text-white placeholder-gray-500 border border-gray-700/60' : 'bg-slate-100 text-gray-900 placeholder-gray-500 border border-gray-200'}`}
                  />
                  <select
                    value={reminderUnit}
                    onChange={(e) => setReminderUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                    className={`px-3 py-2 rounded-lg text-sm outline-none ${isDarkMode ? 'bg-gray-800/70 text-white border border-gray-700/60' : 'bg-slate-100 text-gray-900 border border-gray-200'}`}
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                  <button
                    onClick={() => {
                      const amount = Number(reminderAmount);
                      if (!amount || amount <= 0) return;
                      const multiplier = reminderUnit === 'minutes' ? 1 : reminderUnit === 'hours' ? 60 : 1440;
                      scheduleReminder(reminderMessage, amount * multiplier);
                      setReminderAmount('');
                      setShowReminderModal(false);
                    }}
                    className={`px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick replies modal */}
      {showQuickReplies && (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowQuickReplies(false)}>
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm font-semibold">Quick replies</p>
              <button
                onClick={() => setShowQuickReplies(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  value={newQuickReply}
                  onChange={(e) => setNewQuickReply(e.target.value)}
                  placeholder="Add quick reply..."
                  className={`flex-1 px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-slate-100 text-gray-900'}`}
                />
                <button
                  onClick={() => {
                    const text = newQuickReply.trim();
                    if (!text) return;
                    setQuickReplies(prev => [text, ...prev].slice(0, 12));
                    setNewQuickReply('');
                  }}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {quickReplies.length === 0 && (
                  <div className="text-xs text-gray-400">No quick replies yet.</div>
                )}
                {quickReplies.map((reply, idx) => (
                  <div key={`${reply}-${idx}`} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-gray-800/70' : 'bg-slate-100'}`}>
                    <button
                      onClick={() => {
                        onDraftChange?.(reply);
                        setShowQuickReplies(false);
                        inputRef.current?.focus();
                      }}
                      className="text-left text-sm flex-1"
                    >
                      {reply}
                    </button>
                    <button
                      onClick={() => {
                        setQuickReplies(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Theme modal */}
      {showThemeModal && onSetChatTheme && (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowThemeModal(false)}>
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm font-semibold">Chat theme</p>
              <button
                onClick={() => setShowThemeModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {accentOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    onSetChatTheme(opt.className);
                    setShowThemeModal(false);
                  }}
                  className={`h-12 rounded-xl text-xs font-semibold ${opt.className}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {onSetChatBackground && (
              <div className="px-4 pb-4 space-y-2">
                <div className="text-xs text-gray-400">Custom background</div>
                <div className="flex gap-2">
                  <input
                    value={backgroundInput}
                    onChange={(e) => setBackgroundInput(e.target.value)}
                    placeholder="Paste image URL..."
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-slate-100 text-gray-900'}`}
                  />
                  <button
                    onClick={() => {
                      if (backgroundInput.trim()) {
                        onSetChatBackground(backgroundInput.trim());
                        setBackgroundInput('');
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
                  >
                    Apply
                  </button>
                </div>
                <input
                  ref={backgroundFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    uploadBackground(file);
                    e.target.value = '';
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => backgroundFileRef.current?.click()}
                    className={`px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-800/80 hover:bg-gray-700 text-gray-200' : 'bg-slate-100 hover:bg-slate-200 text-gray-800'}`}
                  >
                    Upload image
                  </button>
                  <button
                    onClick={() => onSetChatBackground('')}
                    className="px-3 py-2 rounded-lg text-sm text-rose-400 hover:text-rose-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowProfileModal(false)}>
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm font-semibold">{selectedUser.username} Profile</p>
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {profileAllowed && profileData ? (
                <>
                  {profileData.title && (
                    <div className="text-sm font-semibold">{profileData.title}</div>
                  )}
                  {profileData.statusMessage && (
                    <div className="text-xs text-indigo-300">{profileData.statusMessage}</div>
                  )}
                  {profileData.bio && (
                    <div className="text-sm text-gray-300 whitespace-pre-wrap">{profileData.bio}</div>
                  )}
                  {profileData.phones?.length > 0 && (
                    <div className="text-xs text-gray-400">
                      Phones: {profileData.phones.join(', ')}
                    </div>
                  )}
                  {profileData.socials?.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-widest text-gray-500">Links</div>
                      <div className="space-y-1">
                        {profileData.socials.map((s, idx) => {
                          const Icon = getSocialIcon(s.icon);
                          return (
                            <a
                              key={`${s.url}-${idx}`}
                              href={formatSocialUrl(s.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-2"
                            >
                              <span className="w-6 h-6 rounded-lg bg-gray-800/70 flex items-center justify-center">
                                <Icon className="text-sm" />
                              </span>
                              <span className="font-medium">{s.label || 'Link'}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {!profileIsSelf && profileVisibility === 'public' && (
                    <button
                      onClick={toggleProfileFollow}
                      className={`w-full px-4 py-2 rounded-lg text-sm transition-all ${profileIsFollower
                        ? 'bg-gray-800/80 text-gray-200 border border-gray-700/60'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                    >
                      {profileIsFollower ? 'Following' : 'Follow'}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-400">
                  {profileVisibility === 'private' ? 'This profile is private. Request access to view.' : 'Profile is limited to approved followers.'}
                </div>
              )}
              {!profileAllowed && profileVisibility !== 'public' && (
                <button
                  onClick={profileRequested ? cancelProfileRequest : requestProfileAccess}
                  className={`w-full px-4 py-2 rounded-lg text-sm ${profileRequested
                    ? 'bg-gray-800/80 text-gray-200 border border-gray-700/60'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                >
                  {profileRequested ? 'Cancel request' : 'Request access'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thread panel */}
      {showThreadPanel && threadRoot && (
        <div className="fixed inset-0 z-85">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowThreadPanel(false)} />
          <div className={`absolute right-0 top-0 h-full w-full max-w-sm border-l shadow-2xl ${isDarkMode ? 'bg-gray-950/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm font-semibold">Thread</p>
              <button
                onClick={() => setShowThreadPanel(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-56px)]">
              <div className={`rounded-xl p-3 border ${isDarkMode ? 'bg-gray-900/70 border-gray-800/60' : 'bg-slate-50 border-gray-200'}`}>
                <div className="text-xs text-gray-400 mb-1">Root message</div>
                <div className="text-sm">{threadRoot.content}</div>
              </div>
              {messages.filter(m => m.replyTo?.messageId === threadRoot._id).map((m) => (
                <div key={m._id} className={`rounded-xl p-3 border ${isDarkMode ? 'bg-gray-900/70 border-gray-800/60' : 'bg-slate-50 border-gray-200'}`}>
                  <div className="text-xs text-gray-400 mb-1">
                    {m.senderId === currentUser.id ? 'You' : selectedUser.username}
                  </div>
                  <div className="text-sm">{m.content}</div>
                </div>
              ))}
              {messages.filter(m => m.replyTo?.messageId === threadRoot._id).length === 0 && (
                <div className="text-xs text-gray-400">No replies yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRemindersPanel && (
        <div className="fixed inset-0 z-90">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRemindersPanel(false)} />
          <div className={`absolute right-0 top-0 h-full w-full max-w-sm border-l shadow-2xl ${isDarkMode ? 'bg-gray-950/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <div>
                <p className="text-sm font-semibold">Reminders</p>
                <p className="text-[11px] text-gray-400">{reminders.length} scheduled</p>
              </div>
              <button
                onClick={() => setShowRemindersPanel(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-56px)]">
              {reminders.length === 0 ? (
                <div className={`rounded-xl p-4 border text-sm ${isDarkMode ? 'bg-gray-900/70 border-gray-800/60 text-gray-400' : 'bg-slate-50 border-gray-200 text-gray-600'}`}>
                  No reminders yet. Use the message menu to create one.
                </div>
              ) : (
                reminders
                  .slice()
                  .sort((a, b) => a.remindAt - b.remindAt)
                  .map((reminder) => (
                    <div key={reminder.id} className={`rounded-xl p-3 border ${isDarkMode ? 'bg-gray-900/70 border-gray-800/60' : 'bg-slate-50 border-gray-200'}`}>
                      <div className="text-sm line-clamp-2">{reminder.content}</div>
                      <div className="text-[11px] text-gray-400 mt-2">
                        {formatReminderTime(reminder.remindAt)}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => {
                            scrollToMessageId(reminder.messageId);
                            setShowRemindersPanel(false);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => removeReminder(reminder.id)}
                          className="px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowTaskModal(false)}>
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm font-semibold">{editingTask ? 'Edit task' : 'New task'}</p>
              <button
                onClick={() => setShowTaskModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-400">Task</label>
                <textarea
                  value={taskContent}
                  onChange={(e) => setTaskContent(e.target.value)}
                  rows={3}
                  placeholder="What needs to be done?"
                  className={`mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-gray-800/80 text-white placeholder-gray-500 border border-gray-700/60' : 'bg-slate-100 text-gray-900 placeholder-gray-500 border border-gray-200'}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">Assignee</label>
                  <select
                    value={taskAssignee || currentUser.id}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className={`mt-1 w-full rounded-lg px-3 py-2 text-sm ${isDarkMode ? 'bg-gray-800/80 text-white border border-gray-700/60' : 'bg-slate-100 text-gray-900 border border-gray-200'}`}
                  >
                    <option value={currentUser.id}>You</option>
                    <option value={selectedUser._id}>{selectedUser.username}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Deadline</label>
                  <input
                    type="datetime-local"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    className={`mt-1 w-full rounded-lg px-3 py-2 text-sm ${isDarkMode ? 'bg-gray-800/80 text-white border border-gray-700/60' : 'bg-slate-100 text-gray-900 border border-gray-200'}`}
                  />
                </div>
              </div>
              {taskMessage && (
                <div className={`rounded-lg px-3 py-2 text-xs ${isDarkMode ? 'bg-gray-800/70 text-gray-300' : 'bg-slate-100 text-gray-600'}`}>
                  Linked to message
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={submitTask}
                  disabled={taskBusy || !taskContent.trim()}
                  className="flex-1 rounded-lg px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors disabled:opacity-60"
                >
                  {taskBusy ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowTaskModal(false)}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm transition-colors ${isDarkMode ? 'bg-gray-800/80 text-gray-200 hover:bg-gray-700/80' : 'bg-slate-100 text-gray-700 hover:bg-slate-200'}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ephemeral timer modal */}
      {showEphemeralModal && (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowEphemeralModal(false)}>
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm font-semibold">Ephemeral timer</p>
              <button
                onClick={() => setShowEphemeralModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '10 sec', value: 10 },
                  { label: '30 sec', value: 30 },
                  { label: '1 min', value: 60 },
                  { label: '5 min', value: 300 },
                  { label: '15 min', value: 900 },
                  { label: '1 hour', value: 3600 }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setEphemeralDuration(opt.value);
                      setShowEphemeralModal(false);
                    }}
                    className={`px-3 py-2 rounded-lg text-sm ${ephemeralDuration === opt.value ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-gray-800/80 text-gray-200 hover:bg-gray-700' : 'bg-slate-100 text-gray-800 hover:bg-slate-200'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setEphemeralDuration(null);
                  setShowEphemeralModal(false);
                }}
                className={`w-full px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-800/80 text-gray-200 hover:bg-gray-700' : 'bg-slate-100 text-gray-800 hover:bg-slate-200'}`}
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {showTasksPanel && (
        <div className="fixed inset-0 z-90">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowTasksPanel(false)} />
          <div className={`absolute right-0 top-0 h-full w-full max-w-sm border-l shadow-2xl ${isDarkMode ? 'bg-gray-950/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <div>
                <p className="text-sm font-semibold">Tasks</p>
                <p className="text-[11px] text-gray-400">{tasks.length} total</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openTaskModal(null, null)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                >
                  New
                </button>
                <button
                  onClick={() => setShowTasksPanel(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  <FiX className="text-sm" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-56px)]">
              {tasks.length === 0 ? (
                <div className={`rounded-xl p-4 border text-sm ${isDarkMode ? 'bg-gray-900/70 border-gray-800/60 text-gray-400' : 'bg-slate-50 border-gray-200 text-gray-600'}`}>
                  No tasks yet. Add one from any message.
                </div>
              ) : (
                tasks
                  .slice()
                  .sort((a, b) => {
                    if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
                    const ad = a.deadline ?? Number.MAX_SAFE_INTEGER;
                    const bd = b.deadline ?? Number.MAX_SAFE_INTEGER;
                    return ad - bd;
                  })
                  .map((task) => {
                    const isMine = task.assigneeId === currentUser.id;
                    return (
                      <div key={task.id} className={`rounded-xl p-3 border ${isDarkMode ? 'bg-gray-900/70 border-gray-800/60' : 'bg-slate-50 border-gray-200'}`}>
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => toggleTaskStatus(task)}
                            className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center border ${task.status === 'done'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/40'
                              : isDarkMode ? 'border-gray-700 text-gray-400' : 'border-gray-300 text-gray-500'}`}
                            title={task.status === 'done' ? 'Mark pending' : 'Mark done'}
                          >
                            <FiCheck className="text-xs" />
                          </button>
                          <div className="flex-1">
                            <div className={`text-sm ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                              {task.content}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-1">
                              Assignee: {isMine ? 'You' : selectedUser.username}
                            </div>
                            {task.deadline && (
                              <div className="text-[11px] text-gray-400">
                                Due: {formatReminderTime(task.deadline)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {task.messageId && (
                            <button
                              onClick={() => {
                                scrollToMessageId(task.messageId!);
                                setShowTasksPanel(false);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                            >
                              Open
                            </button>
                          )}
                          <button
                            onClick={() => openTaskModal(null, task)}
                            className="px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Read receipt modal */}
      {showReceiptModal && receiptMessage && (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowReceiptModal(false)}>
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm font-semibold">Read receipt</p>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className="font-semibold">{receiptMessage.status || 'sent'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Sent at</span>
                <span>{new Date(receiptMessage.timestamp).toLocaleString()}</span>
              </div>
              {receiptMessage.readAt && (
                <div className="flex items-center justify-between">
                  <span>Read at</span>
                  <span>{new Date(receiptMessage.readAt).toLocaleString()}</span>
                </div>
              )}
              {!receiptMessage.readAt && (
                <div className="text-xs text-gray-400">Not read yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit history modal */}
      {showEditHistory && editHistoryMessage && (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowEditHistory(false)}>
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <p className="text-sm font-semibold">Edit history</p>
              <button
                onClick={() => setShowEditHistory(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FiX className="text-sm" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {editHistoryMessage.editHistory?.map((h, idx) => (
                <div key={`${h.editedAt}-${idx}`} className={`rounded-xl border p-3 ${isDarkMode ? 'bg-gray-800/70 border-gray-700/60' : 'bg-slate-50 border-gray-200'}`}>
                  <div className="text-xs text-gray-400 mb-1">{new Date(h.editedAt).toLocaleString()}</div>
                  <div className="text-sm whitespace-pre-wrap">{h.content}</div>
                </div>
              ))}
              {(!editHistoryMessage.editHistory || editHistoryMessage.editHistory.length === 0) && (
                <div className="text-xs text-gray-400">No edits recorded.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Input area with glass effect */}
      <div className={`shrink-0 px-4 py-4 ${theme.inputWrap} backdrop-blur-xl border-t relative`}>
        {/* Reply preview */}
        {replyingTo && (
          <div className="absolute top-0 left-0 right-0 transform -translate-y-full px-4 py-2 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700/50 flex items-center justify-between animate-slideDown">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-linear-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                {replyingTo.senderId === currentUser.id ? 'Y' : selectedUser.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-gray-400">
                Replying to: <span className="text-gray-300">{replyingTo.content.substring(0, 30)}...</span>
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-gray-400 hover:text-white transition-colors hover:scale-110"
            >
              <FiX className="text-sm" />
            </button>
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-20 left-4 z-50 shadow-2xl rounded-xl overflow-hidden animate-slideUp"
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={Theme.DARK}
              height={380}
              width={320}
              searchDisabled={false}
              skinTonesDisabled
              previewConfig={{ showPreview: false }}
            />
          </div>
        )}

        {/* Typing-based suggestions from user history */}
        {recordState === 'idle' && prefixSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 animate-slideIn px-4">
            {prefixSuggestions.map((reply, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applySuggestion(reply)}
                className={`text-[11px] px-3 py-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 shadow-sm ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20' : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100'}`}
              >
                {reply}
              </button>
            ))}
          </div>
        )}


        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* File upload */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
            multiple
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload file"
            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-lg ${theme.actionButton}`}
          >
            <FiUpload className="text-base" />
          </button>
          <button
            onClick={() => setShowVideoRecorder(true)}
            type="button"
            title="Video message"
            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-lg ${theme.actionButton}`}
          >
            <FiPlayCircle className="text-base text-indigo-400" />
          </button>

          <button
            type="button"
            onClick={recordState === 'idle' ? startRecording : stopRecording}
            title={recordState === 'idle' ? 'Record voice note' : 'Stop and send'}
            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-lg ${recordState !== 'idle'
              ? 'bg-rose-600/90 text-white'
              : theme.actionButton
              }`}
          >
            {recordState === 'idle' ? <FiMic className="text-base" /> : <FiStopCircle className="text-base" />}
          </button>

          {/* Emoji toggle */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(v => !v)}
            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 ${showEmojiPicker
              ? 'bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            title="Emoji"
          >
            <FiSmile className="text-base" />
          </button>

          {/* Text input */}
          {recordState !== 'idle' ? (
            <div className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border ${isDarkMode ? 'bg-gray-800/70 border-gray-700/60' : 'bg-slate-100 border-gray-200'}`}>
              <div className="flex items-end gap-1 h-5">
                {[...Array(12)].map((_, i) => (
                  <span
                    key={i}
                    className={`w-1 rounded-full ${recordState === 'paused' ? 'bg-gray-500/60' : 'bg-emerald-400/80 animate-pulse'}`}
                    style={{ height: `${6 + (i % 5) * 4}px`, animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </div>
              <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {Math.floor(recordSeconds / 60).toString().padStart(2, '0')}:{(recordSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={draftValue}
              onKeyDown={(e) => {
                if (e.key === 'Tab' && prefixSuggestions.length > 0) {
                  e.preventDefault();
                  applySuggestion(prefixSuggestions[0]);
                }
              }}
              onChange={(e) => {
                onDraftChange?.(e.target.value);
              }}
              placeholder={replyingTo ? "Write a reply..." : "Type a message..."}
              className={`flex-1 backdrop-blur-sm rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${theme.inputField}`}
            />
          )}

          {recordState !== 'idle' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                title="Delete recording"
                className={`w-10 h-10 flex items-center justify-center rounded-xl ${theme.actionButton}`}
              >
                <FiTrash2 className="text-base" />
              </button>
              {recordState === 'recording' ? (
                <button
                  type="button"
                  onClick={pauseRecording}
                  title="Pause"
                  className={`w-10 h-10 flex items-center justify-center rounded-xl ${theme.actionButton}`}
                >
                  <FiPause className="text-base" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resumeRecording}
                  title="Resume"
                  className={`w-10 h-10 flex items-center justify-center rounded-xl ${theme.actionButton}`}
                >
                  <FiPlay className="text-base" />
                </button>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                title="Schedule message"
                className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 ${theme.actionButton}`}
                disabled={!draftValue.trim()}
              >
                <FiClock className="text-base" />
              </button>
              <button
                type="button"
                onClick={() => setShowEphemeralModal(true)}
                title="Ephemeral timer"
                className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 ${ephemeralDuration ? 'bg-indigo-600 text-white' : theme.actionButton}`}
              >
                <FiClock className="text-base" />
              </button>
              <button
                type="button"
                onClick={() => setShowQuickReplies(true)}
                title="Quick replies"
                className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 ${theme.actionButton}`}
              >
                <FiMessageSquare className="text-base" />
              </button>
            </>
          )}

          {/* Send button */}
          <button
            type="submit"
            disabled={!draftValue.trim() || slowModeRemaining > 0}
            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg ${outgoingBubbleClass}`}
          >
            {replyingTo ? <FiCornerUpLeft className="text-sm" /> : <FiSend className="text-sm" />}
          </button>
        </form>

        {recordState !== 'idle' && (speechSupported || recordError) && (
          <div className={`mt-2 px-4 py-3 rounded-xl border text-xs ${isDarkMode ? 'bg-gray-900/70 border-gray-800/60 text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}>
            <div className="text-[10px] text-gray-400 mb-1">Live transcription</div>
            <div className="wrap-break-word">
              {recordError
                ? <span className="text-rose-400">{recordError}</span>
                : (recordTranscript || recordInterim
                  ? (
                    <>
                      <span>{recordTranscript}</span>
                      {recordInterim && <span className="opacity-70"> {recordInterim}</span>}
                    </>
                  )
                  : 'Listening...')}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-gray-400">Language</span>
              <select
                value={recordLang}
                onChange={(e) => setRecordLang(e.target.value)}
                className={`text-[10px] rounded-md px-2 py-1 ${isDarkMode ? 'bg-gray-800/70 text-gray-200 border border-gray-700/60' : 'bg-slate-100 text-gray-700 border border-gray-200'}`}
              >
                <option value="auto">Auto</option>
                <option value="ar-EG">Arabic</option>
                <option value="en-US">English</option>
                <option value="fr-FR">French</option>
                <option value="es-ES">Spanish</option>
              </select>
            </div>
          </div>
        )}
        {slowModeRemaining > 0 && (
          <div className="mt-2 text-xs text-amber-300">
            Slow mode: wait {slowModeRemaining}s before sending another message.
          </div>
        )}
      </div>

      {showVideoRecorder && (
        <VideoNoteRecorder
          isDarkMode={isDarkMode}
          onClose={() => setShowVideoRecorder(false)}
          onComplete={async (blob: Blob) => {
            setShowVideoRecorder(false);
            const file = new File([blob], `video-note-${Date.now()}.webm`, { type: 'video/webm' });
            const formData = new FormData();
            formData.append('file', file);
            try {
              const res = await fetch('/api/upload', { method: 'POST', body: formData });
              const data = await res.json();
              if (data.success && data.fileUrl) {
                onSendMessage('', 'video-note', { fileUrl: data.fileUrl, fileName: file.name, fileSize: file.size, expiresInSeconds: getEphemeralSeconds() });
              }
            } catch (err) {
              console.error("Video note upload failed", err);
            }
          }}
        />
      )}

      {showCollaborationTools && (
        <CollaborationTools
          currentUser={{ id: currentUser.id, username: currentUser.username }}
          receiverId={selectedUser._id!}
          isDarkMode={isDarkMode}
          onClose={closeCollaborationTools}
        />
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out forwards;
          opacity: 0;
        }
        
        .animate-slideUp {
          animation: slideUp 0.2s ease-out;
        }
        
        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }
        
        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: rgba(99, 102, 241, 0.55) transparent;
        }

        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.08);
          border-radius: 999px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(99, 102, 241, 0.7), rgba(79, 70, 229, 0.45));
          border-radius: 999px;
          border: 1px solid rgba(30, 41, 59, 0.35);
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(129, 140, 248, 0.9), rgba(99, 102, 241, 0.65));
        }

        .voice-range {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, #7c3aed, #6366f1);
          outline: none;
        }

        .voice-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid #8b5cf6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
        }

        .voice-range::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid #8b5cf6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}


