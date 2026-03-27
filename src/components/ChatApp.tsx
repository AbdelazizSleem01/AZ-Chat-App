'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Theme } from 'emoji-picker-react';
import { User, Message, Call } from '@/types';
import UserList from './UserList';
import ChatWindow from './ChatWindow';
import CallModal from './CallModal';
import { getSocket } from '@/lib/socket';
import {
   FiMessageCircle,
   FiLogOut,
   FiWifi,
   FiLoader,
   FiPhone,
   FiSettings,
   FiCheck,
   FiChevronLeft,
   FiMoon,
   FiSun,
   FiBell,
   FiBellOff,
   FiSearch,
   FiGlobe,
   FiFacebook,
   FiInstagram,
   FiTwitter,
   FiLinkedin,
   FiGithub,
   FiYoutube,
   FiLink,
   FiMail,
   FiSlack,
   FiTwitch,
   FiZap,
   FiSend,
   FiUpload,
   FiX,
   FiUserPlus,
   FiCheckCircle,
   FiPlus,
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

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface CurrentUser {
   id: string;
   username: string;
   email: string;
   avatar?: string;
   statusMessage?: string;
}

interface ChatLockState {
   isLocked: boolean;
   hasPasscode: boolean;
   updatedAt?: number;
}

type NotificationCenterItem = {
   id: string;
   category: 'messages' | 'social';
   title: string;
   body: string;
   timestamp: string | Date;
   actorId?: string;
   actorName?: string;
   actorAvatar?: string;
   messageId?: string;
   meta?: { peerId?: string; taskId?: string; messageId?: string; storyId?: string; emoji?: string };
   rawType?: string;
};

type ChatLabel = {
   id: string;
   name: string;
   color: string;
};

type StoryItem = {
   _id: string;
   userId: string;
   text?: string;
   mediaUrl?: string;
   style?: {
      background?: string;
      textColor?: string;
      fontFamily?: string;
   };
   reactions?: Array<{
      emoji: string;
      userId: string;
      username: string;
   }>;
   createdAt: string;
   expiresAt: string;
   viewedBy?: string[];
};

type StoryGroup = {
   userId: string;
   user?: User;
   hasUnseen: boolean;
   stories: StoryItem[];
};

export default function ChatApp() {
   const [mounted, setMounted] = useState(false);
   const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
   const [selectedUser, setSelectedUser] = useState<User | null>(null);
   const [users, setUsers] = useState<User[]>([]);
   const [messages, setMessages] = useState<Message[]>([]);
   const [activeCall, setActiveCall] = useState<Call | null>(null);
   const [isInCall, setIsInCall] = useState(false);
   const [incomingCall, setIncomingCall] = useState<Call | null>(null);
   const [showSettings, setShowSettings] = useState(false);
   const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
   const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
   const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
   const [soundEnabled, setSoundEnabled] = useState(true);
   const [toast, setToast] = useState<{ userId: string; username: string; count: number; type: 'new' | 'edited'; messageId?: string } | null>(null);
   const lastUnreadCountsRef = useRef<Record<string, number>>({});
   const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const lastNotifiedRef = useRef<Record<string, { messageId: string; editedAt?: string }>>({});
   const draftSaveTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
   const [, setTypingUsers] = useState<Set<string>>(new Set());
   const [isDarkMode, setIsDarkMode] = useState(true);
   const [notifications, setNotifications] = useState(true);
   const [showSidebar, setShowSidebar] = useState(true);
   const [drafts, setDrafts] = useState<Record<string, string>>({});
   const [pinnedMessages, setPinnedMessages] = useState<Record<string, string[]>>({});
   const [pinnedPreviews, setPinnedPreviews] = useState<Record<string, { messageId: string; content: string }[]>>({});
   const [hiddenMessageIds, setHiddenMessageIds] = useState<string[]>([]);
   const [starredMessageIds, setStarredMessageIds] = useState<string[]>([]);
   const [mutedChats, setMutedChats] = useState<Record<string, boolean>>({});
   const [chatLocks, setChatLocks] = useState<Record<string, ChatLockState>>({});
   const [slowModeUntil, setSlowModeUntil] = useState<Record<string, number>>({});
   const [chatThemes, setChatThemes] = useState<Record<string, string>>({});
   const [chatBackgrounds, setChatBackgrounds] = useState<Record<string, string>>({});
   const [profileTitle, setProfileTitle] = useState('');
   const [profileStatusMessage, setProfileStatusMessage] = useState('');
   const [profileBio, setProfileBio] = useState('');
   const [profilePhones, setProfilePhones] = useState<string>('');
   const [profileSocials, setProfileSocials] = useState<Array<{ label: string; url: string; icon?: string }>>([]);
   const [newSocialLabel, setNewSocialLabel] = useState('');
   const [newSocialUrl, setNewSocialUrl] = useState('');
   const [newSocialIcon, setNewSocialIcon] = useState('globe');
   const [editingSocialIndex, setEditingSocialIndex] = useState<number | null>(null);
   const [editingSocialLabel, setEditingSocialLabel] = useState('');
   const [editingSocialUrl, setEditingSocialUrl] = useState('');
   const [editingSocialIcon, setEditingSocialIcon] = useState('globe');
   const dragIndexRef = useRef<number | null>(null);
   const [bioVisibility, setBioVisibility] = useState<'public' | 'followers' | 'private' | 'custom'>('public');
   const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
   const [followRequests, setFollowRequests] = useState<string[]>([]);
   const [followersIds, setFollowersIds] = useState<string[]>([]);
   const [followingIds, setFollowingIds] = useState<string[]>([]);
   const [followTab, setFollowTab] = useState<'followers' | 'following'>('followers');
   const [followToast, setFollowToast] = useState<{ type: 'follow_request' | 'follow_accepted'; actorId: string } | null>(null);
   const lastFollowNotificationRef = useRef<string | null>(null);
   const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
   const [followNotifications, setFollowNotifications] = useState<Array<{
      _id: string;
      type: 'follow_request' | 'follow_accepted' | 'task_assigned' | 'story_reaction';
      actorId: string;
      createdAt?: string;
      meta?: { kind?: string; taskId?: string; peerId?: string; messageId?: string; content?: string; storyId?: string; emoji?: string } | null;
   }>>([]);
   const [messageNotifications, setMessageNotifications] = useState<Array<{ senderId: string; message: Message }>>([]);
   const [notificationsLoading, setNotificationsLoading] = useState(false);
   const notificationsRef = useRef<HTMLDivElement | null>(null);
   const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
   const [notificationsTab, setNotificationsTab] = useState<'all' | 'messages' | 'social'>('all');
   const [notificationsMenuPos, setNotificationsMenuPos] = useState<{ top: number; left: number } | null>(null);
   const [openTasksPanelSignal, setOpenTasksPanelSignal] = useState(0);
   const [showGlobalSearch, setShowGlobalSearch] = useState(false);
   const [globalSearchQuery, setGlobalSearchQuery] = useState('');
   const [globalSearchFilter, setGlobalSearchFilter] = useState<'all' | 'messages' | 'files' | 'images'>('all');
   const [globalSearchResults, setGlobalSearchResults] = useState<Array<{ message: Message; otherUser: User }>>([]);
   const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
   const [jumpToMessageId, setJumpToMessageId] = useState<string | null>(null);
   const [isDragging, setIsDragging] = useState(false);
   const [selectedUserActivity, setSelectedUserActivity] = useState<string | null>(null);
   const [labels, setLabels] = useState<ChatLabel[]>([]);
   const [userLabels, setUserLabels] = useState<Record<string, string[]>>({});
   const [selectedLabel, setSelectedLabel] = useState<string>('all');
   const [showLabelsModal, setShowLabelsModal] = useState(false);
   const [newLabelName, setNewLabelName] = useState('');
   const [newLabelColor, setNewLabelColor] = useState('#6366f1');
   const [labelsLoaded, setLabelsLoaded] = useState(false);
   const [stories, setStories] = useState<StoryGroup[]>([]);
   const [showStoryModal, setShowStoryModal] = useState(false);
   const [storyText, setStoryText] = useState('');
   const [storyFile, setStoryFile] = useState<File | null>(null);
   const [storyPreview, setStoryPreview] = useState<string | null>(null);
   const [storyUploading, setStoryUploading] = useState(false);
   const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null);
   const [activeStoryIndex, setActiveStoryIndex] = useState(0);
   const [showStoryViewer, setShowStoryViewer] = useState(false);
   const [storyBackground, setStoryBackground] = useState('linear-gradient(135deg, #4f46e5, #7c3aed)');
   const [storyTextColor, setStoryTextColor] = useState('#ffffff');
   const [showStoryEmojiPicker, setShowStoryEmojiPicker] = useState(false);
   const [showStoryReactionPicker, setShowStoryReactionPicker] = useState(false);

   const selectedUserId = selectedUser?._id;
   const incomingCaller = incomingCall
      ? users.find(u => u._id === incomingCall.callerId) || null
      : null;
   const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
   const notificationCount = totalUnread + followNotifications.length;
   const filteredUsers = users
      .filter(u => u._id !== currentUser?.id)
      .filter(u => {
         if (selectedLabel === 'all') return true;
         const labelsForUser = userLabels[u._id || ''] || [];
         return labelsForUser.includes(selectedLabel);
      });
   const myStoryGroup = stories.find(group => group.userId === currentUser?.id);
   const otherStoryGroups = stories.filter(group => group.userId !== currentUser?.id);

   const playNotificationSound = useCallback(() => {
      if (!soundEnabled) return;
      try {
         const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
         if (!AudioContextClass) return;
         const ctx = new AudioContextClass();
         const oscillator = ctx.createOscillator();
         const gain = ctx.createGain();
         oscillator.type = 'sine';
         oscillator.frequency.setValueAtTime(880, ctx.currentTime);
         gain.gain.setValueAtTime(0.0001, ctx.currentTime);
         gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.02);
         gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
         oscillator.connect(gain);
         gain.connect(ctx.destination);
         oscillator.start();
         oscillator.stop(ctx.currentTime + 0.25);
         oscillator.onended = () => ctx.close();
      } catch (error) {
         console.error('Notification sound error:', error);
      }
   }, [soundEnabled]);

   const updateOnlineStatus = useCallback(async (isOnline: boolean) => {
      if (!currentUser) return;
      try {
         await fetch('/api/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
            body: JSON.stringify({ isOnline })
         });
      } catch (error) {
         console.error('Error updating online status:', error);
      }
   }, [currentUser]);

   const fetchStories = useCallback(async () => {
      if (!currentUser) return;
      try {
         const response = await fetch('/api/stories', { headers: { 'x-user-id': currentUser.id } });
         if (!response.ok) return;
         const data = await response.json();
         if (Array.isArray(data?.stories)) {
            setStories(data.stories);
         }
      } catch (error) {
         console.error('Fetch stories error:', error);
      }
   }, [currentUser]);

   const openStoryViewer = useCallback((group: StoryGroup, startIndex = 0) => {
      setActiveStoryGroup(group);
      setActiveStoryIndex(startIndex);
      setShowStoryViewer(true);
   }, []);

   const markStoryViewed = useCallback(async (storyId: string) => {
      if (!currentUser) return;
      try {
         await fetch(`/api/stories/${storyId}`, {
            method: 'PATCH',
            headers: { 'x-user-id': currentUser.id }
         });
         setStories(prev => prev.map(group => ({
            ...group,
            hasUnseen: group.stories.some(story =>
               story._id === storyId
                  ? false
                  : !(story.viewedBy || []).includes(currentUser.id)
            ),
            stories: group.stories.map(story => {
               if (story._id !== storyId) return story;
               const nextViewed = new Set(story.viewedBy || []);
               nextViewed.add(currentUser.id);
               return { ...story, viewedBy: Array.from(nextViewed) };
            })
         })));
      } catch (error) {
         console.error('Mark story viewed error:', error);
      }
   }, [currentUser]);

   const fetchUsers = useCallback(async (userId: string) => {
      try {
         const response = await fetch('/api/users', { headers: { 'x-user-id': userId } });
         const data = await response.json();
         setUsers(data.users);
      } catch (error) {
         console.error('Error fetching users:', error);
      }
   }, []);

   useEffect(() => {
      setMounted(true);
      const storedUser = localStorage.getItem('currentUser');
      const storedSound = localStorage.getItem('soundEnabled');
      const storedTheme = localStorage.getItem('theme');
      if (storedUser) {
         try {
            const parsedUser = JSON.parse(storedUser) as CurrentUser;
            const normalizedId =
               typeof parsedUser?.id === 'string'
                  ? parsedUser.id
                  : String((parsedUser as unknown as { id?: { $oid?: string } })?.id?.$oid ?? (parsedUser as unknown as { id?: unknown })?.id ?? '');
            if (normalizedId) {
               const normalizedUser: CurrentUser = {
                  ...parsedUser,
                  id: normalizedId
               };
               setCurrentUser(normalizedUser);
               localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
            }
         } catch (error) {
            console.error('Error parsing current user:', error);
         }
      }
      if (storedSound !== null) {
         setSoundEnabled(storedSound === 'true');
      }
      if (storedTheme) {
         setIsDarkMode(storedTheme === 'dark');
      }
   }, []);

   useEffect(() => {
      localStorage.setItem('soundEnabled', String(soundEnabled));
   }, [soundEnabled]);

   useEffect(() => {
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
   }, [isDarkMode]);

   useEffect(() => {
      if (!currentUser) return;
      const storedPinned = localStorage.getItem(`pinned:${currentUser.id}`);
      const storedPinnedPreview = localStorage.getItem(`pinnedPreview:${currentUser.id}`);
      const storedMuted = localStorage.getItem(`muted:${currentUser.id}`);
      const storedThemes = localStorage.getItem(`chatThemes:${currentUser.id}`);
      const storedBackgrounds = localStorage.getItem(`chatBackgrounds:${currentUser.id}`);
      const storedHidden = localStorage.getItem(`hidden:${currentUser.id}`);
      const storedStarred = localStorage.getItem(`starred:${currentUser.id}`);
      if (storedPinned) {
         try {
            setPinnedMessages(JSON.parse(storedPinned));
         } catch (error) {
            console.error('Error parsing pinned messages:', error);
         }
      }
      if (storedPinnedPreview) {
         try {
            setPinnedPreviews(JSON.parse(storedPinnedPreview));
         } catch (error) {
            console.error('Error parsing pinned previews:', error);
         }
      }
      if (storedMuted) {
         try {
            setMutedChats(JSON.parse(storedMuted));
         } catch (error) {
            console.error('Error parsing muted chats:', error);
         }
      }
      if (storedThemes) {
         try {
            setChatThemes(JSON.parse(storedThemes));
         } catch (error) {
            console.error('Error parsing chat themes:', error);
         }
      }
      if (storedBackgrounds) {
         try {
            setChatBackgrounds(JSON.parse(storedBackgrounds));
         } catch (error) {
            console.error('Error parsing chat backgrounds:', error);
         }
      }
      if (storedHidden) {
         try {
            setHiddenMessageIds(JSON.parse(storedHidden));
         } catch (error) {
            console.error('Error parsing hidden messages:', error);
         }
      }
      if (storedStarred) {
         try {
            setStarredMessageIds(JSON.parse(storedStarred));
         } catch (error) {
            console.error('Error parsing starred messages:', error);
         }
      }
   }, [currentUser]);

   useEffect(() => {
      if (!currentUser) return;
      const fetchDrafts = async () => {
         try {
            const response = await fetch('/api/drafts', {
               headers: { 'x-user-id': currentUser.id },
               cache: 'no-store'
            });
            const data = await response.json();
            const nextDrafts: Record<string, string> = {};
            if (Array.isArray(data.drafts)) {
               data.drafts.forEach((draft: { peerId: string; content: string }) => {
                  if (draft?.peerId) nextDrafts[draft.peerId] = draft.content || '';
               });
            }
            setDrafts(nextDrafts);
         } catch (error) {
            console.error('Error fetching drafts:', error);
         }
      };

      fetchDrafts();
      return () => {
         Object.values(draftSaveTimersRef.current).forEach(timer => clearTimeout(timer));
         draftSaveTimersRef.current = {};
      };
   }, [currentUser]);

   useEffect(() => {
      if (!currentUser) return;
      const fetchChatLocks = async () => {
         try {
            const response = await fetch('/api/users/chat-locks', {
               headers: { 'x-user-id': currentUser.id },
               cache: 'no-store'
            });
            const data = await response.json();
            if (response.ok && data?.locks && typeof data.locks === 'object') {
               setChatLocks(data.locks);
            } else {
               setChatLocks({});
            }
         } catch (error) {
            console.error('Error fetching chat locks:', error);
            setChatLocks({});
         }
      };
      fetchChatLocks();
   }, [currentUser]);

   useEffect(() => {
      if (!currentUser) return;
      const loadProfile = async () => {
         try {
            const response = await fetch(`/api/users/profile?userId=${currentUser.id}`, {
               headers: { 'x-user-id': currentUser.id },
               cache: 'no-store'
            });
            const data = await response.json();
            if (data?.profile) {
               setProfileTitle(data.profile.title || '');
               setProfileStatusMessage(data.profile.statusMessage || '');
               setProfileBio(data.profile.bio || '');
               setProfilePhones((data.profile.phones || []).join(', '));
               setProfileSocials(Array.isArray(data.profile.socials) ? data.profile.socials : []);
            }
            if (data?.visibility) {
               setBioVisibility(data.visibility);
            }
            if (Array.isArray(data?.allowedUserIds)) {
               setAllowedUserIds(data.allowedUserIds);
            }
            if (Array.isArray(data?.followRequests)) {
               setFollowRequests(data.followRequests);
            }
            if (Array.isArray(data?.followers)) {
               setFollowersIds(data.followers);
            }
            if (Array.isArray(data?.following)) {
               setFollowingIds(data.following);
            }
         } catch (error) {
            console.error('Load profile error:', error);
         }
      };
      loadProfile();
   }, [currentUser]);

   useEffect(() => {
      if (!currentUser) return;
      const poll = async () => {
         try {
            const response = await fetch('/api/notifications', {
               headers: { 'x-user-id': currentUser.id },
               cache: 'no-store'
            });
            const data = await response.json();
            const items = Array.isArray(data?.items) ? data.items : [];
            setFollowNotifications(items);
            if (items.length === 0) return;

            const latest = items[0];
            if (latest?._id && lastFollowNotificationRef.current !== latest._id) {
               lastFollowNotificationRef.current = latest._id;
               if (latest.type === 'follow_request' || latest.type === 'follow_accepted') {
                  setFollowToast({ type: latest.type, actorId: String(latest.actorId) });
               }
               if (latest.type === 'follow_request') {
                  setFollowRequests(prev => (prev.includes(String(latest.actorId)) ? prev : [...prev, String(latest.actorId)]));
               }
               if (latest.type === 'follow_accepted') {
                  setFollowingIds(prev => (prev.includes(String(latest.actorId)) ? prev : [...prev, String(latest.actorId)]));
               }
               if (notifications) {
                  playNotificationSound();
               }
            }
         } catch (error) {
            console.error('Follow notifications error:', error);
         }
      };
      poll();
      const interval = setInterval(poll, 20000);
      return () => clearInterval(interval);
   }, [currentUser, notifications, playNotificationSound]);

   useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
         if (!notificationsRef.current) return;
         const target = e.target as Node | null;
         if (target && !notificationsRef.current.contains(target)) {
            setShowNotificationsDropdown(false);
            setNotificationsMenuPos(null);
         }
      };
      if (showNotificationsDropdown) {
         document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, [showNotificationsDropdown]);

   useEffect(() => {
      if (!showNotificationsDropdown) return;

      const updatePosition = () => {
         const rect = notificationButtonRef.current?.getBoundingClientRect();
         if (!rect) return;

         const menuWidth = window.innerWidth < 640 ? 320 : 420;
         const viewportPadding = 16;
         let left = rect.right - menuWidth;
         if (left < viewportPadding) left = viewportPadding;
         if (left + menuWidth > window.innerWidth - viewportPadding) {
            left = window.innerWidth - menuWidth - viewportPadding;
         }

         const top = rect.bottom + 12;
         setNotificationsMenuPos({ top, left });
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
         window.removeEventListener('resize', updatePosition);
         window.removeEventListener('scroll', updatePosition, true);
      };
   }, [showNotificationsDropdown]);

   const loadNotifications = useCallback(async () => {
      if (!currentUser) return;
      try {
         setNotificationsLoading(true);
         const [followRes, messageRes] = await Promise.all([
            fetch('/api/notifications', { headers: { 'x-user-id': currentUser.id }, cache: 'no-store' }),
            fetch('/api/messages/notifications', { headers: { 'x-user-id': currentUser.id }, cache: 'no-store' })
         ]);
         const followData = await followRes.json();
         const messageData = await messageRes.json();
         const items = Array.isArray(followData?.items) ? followData.items : [];
         setFollowNotifications(items);
         setMessageNotifications(
            Array.isArray(messageData?.items)
               ? messageData.items.map((item: { senderId: string; message: Message }) => ({
                  ...item,
                  senderId: String(item.senderId)
               }))
               : []
         );
      } catch (error) {
         console.error('Load notifications error:', error);
      } finally {
         setNotificationsLoading(false);
      }
   }, [currentUser]);

   const markAllNotificationsRead = useCallback(async () => {
      if (!currentUser) return;
      try {
         await Promise.all([
            followNotifications.length > 0
               ? fetch('/api/notifications', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
                  body: JSON.stringify({ ids: followNotifications.map(n => n._id) })
               })
               : Promise.resolve(),
            messageNotifications.length > 0
               ? fetch('/api/messages/mark-read', {
                  method: 'PATCH',
                  headers: { 'x-user-id': currentUser?.id || '' }
               })
               : Promise.resolve()
         ]);
         setFollowNotifications([]);
         setMessageNotifications([]);
         setUnreadCounts(prev => Object.fromEntries(Object.keys(prev).map(key => [key, 0])));
         setShowNotificationsDropdown(false);
      } catch (error) {
         console.error('Mark all notifications read error:', error);
      }
   }, [currentUser, followNotifications, messageNotifications]);

   const toggleUserLabel = useCallback((userId: string, labelId: string) => {
      setUserLabels(prev => {
         const existing = prev[userId] || [];
         const next = existing.includes(labelId)
            ? existing.filter(id => id !== labelId)
            : [...existing, labelId];
         return { ...prev, [userId]: next };
      });
   }, []);

   const addLabel = useCallback(() => {
      const name = newLabelName.trim();
      if (!name) return;
      const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`;
      setLabels(prev => [...prev, { id, name, color: newLabelColor }]);
      setNewLabelName('');
   }, [newLabelName, newLabelColor]);

   const removeLabel = useCallback((labelId: string) => {
      setLabels(prev => prev.filter(l => l.id !== labelId));
      setUserLabels(prev => {
         const next: Record<string, string[]> = {};
         Object.entries(prev).forEach(([userId, ids]) => {
            next[userId] = ids.filter(id => id !== labelId);
         });
         return next;
      });
      if (selectedLabel === labelId) setSelectedLabel('all');
   }, [selectedLabel]);

   const formatNotificationTime = useCallback((timestamp?: string | Date) => {
      if (!timestamp) return 'Just now';
      const date = new Date(timestamp);
      const diffMs = Date.now() - date.getTime();
      const diffMin = Math.max(0, Math.floor(diffMs / 60000));
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
   }, []);

   const notificationItems: NotificationCenterItem[] = [
      ...followNotifications.map((n) => {
         const actor = users.find(u => u._id === n.actorId);
         const kind = n.meta?.kind;
         return {
            id: `social-${n._id}`,
            category: 'social' as const,
            title: actor?.username || 'Unknown user',
            body: n.type === 'follow_request'
               ? (kind === 'followed' ? 'Started following you' : 'Sent you a follow request')
               : n.type === 'follow_accepted'
                  ? 'Accepted your follow request'
                  : n.type === 'story_reaction'
                     ? `Reacted to your status ${n.meta?.emoji || ''}`.trim()
                     : (n.meta?.content ? `Assigned you a task: ${n.meta.content}` : 'Assigned you a task'),
            timestamp: n.createdAt || new Date(),
            actorId: n.actorId,
            actorName: actor?.username || 'Unknown user',
            actorAvatar: actor?.avatar,
            messageId: n.meta?.messageId,
            meta: n.meta || undefined,
            rawType: n.type
         };
      }),
      ...messageNotifications.map((item) => {
         const actor = users.find(u => u._id === item.senderId);
         return {
            id: `message-${item.senderId}-${item.message._id || item.message.timestamp}`,
            category: 'messages' as const,
            title: actor?.username || 'Unknown user',
            body:
               item.message.type === 'file' || item.message.type === 'image' || item.message.type === 'video-note'
                  ? (item.message.fileName || 'Sent an attachment')
                  : (item.message.content || 'New message'),
            timestamp: item.message.timestamp,
            actorId: item.senderId,
            actorName: actor?.username || 'Unknown user',
            actorAvatar: actor?.avatar,
            messageId: item.message._id,
            rawType: item.message.type
         };
      })
   ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

   const visibleNotificationItems = notificationItems.filter((item) => {
      if (notificationsTab === 'all') return true;
      return item.category === notificationsTab;
   });

   const socialIconOptions = [
      { value: 'globe', label: 'Website', icon: FiGlobe },
      { value: 'link', label: 'Link', icon: FiLink },
      { value: 'facebook', label: 'Facebook', icon: FiFacebook },
      { value: 'instagram', label: 'Instagram', icon: FiInstagram },
      { value: 'twitter', label: 'Twitter', icon: FiTwitter },
      { value: 'linkedin', label: 'LinkedIn', icon: FiLinkedin },
      { value: 'github', label: 'GitHub', icon: FiGithub },
      { value: 'youtube', label: 'YouTube', icon: FiYoutube },
      { value: 'mail', label: 'Email', icon: FiMail },
      { value: 'phone', label: 'Phone', icon: FiPhone },
      { value: 'slack', label: 'Slack', icon: FiSlack },
      { value: 'twitch', label: 'Twitch', icon: FiTwitch },
      { value: 'zap', label: 'Linktree', icon: FiZap },
      { value: 'send', label: 'Telegram', icon: FiSend },
      { value: 'message', label: 'Messenger', icon: FiMessageCircle },
      { value: 'tiktok', label: 'TikTok', icon: SiTiktok },
      { value: 'whatsapp', label: 'WhatsApp', icon: SiWhatsapp },
      { value: 'snapchat', label: 'Snapchat', icon: SiSnapchat },
      { value: 'discord', label: 'Discord', icon: SiDiscord },
      { value: 'pinterest', label: 'Pinterest', icon: SiPinterest },
      { value: 'reddit', label: 'Reddit', icon: SiReddit },
      { value: 'behance', label: 'Behance', icon: SiBehance },
      { value: 'dribbble', label: 'Dribbble', icon: SiDribbble },
      { value: 'medium', label: 'Medium', icon: SiMedium },
      { value: 'stackoverflow', label: 'Stack Overflow', icon: SiStackoverflow },
      { value: 'telegram', label: 'Telegram', icon: SiTelegram }
   ];

   const getSocialIconByValue = (value?: string) => {
      const found = socialIconOptions.find(opt => opt.value === value);
      return found?.icon || FiGlobe;
   };

   useEffect(() => {
      if (!currentUser) return;
      localStorage.setItem(`pinned:${currentUser.id}`, JSON.stringify(pinnedMessages));
   }, [pinnedMessages, currentUser]);

   useEffect(() => {
      if (!currentUser) return;
      localStorage.setItem(`pinnedPreview:${currentUser.id}`, JSON.stringify(pinnedPreviews));
   }, [pinnedPreviews, currentUser]);

   useEffect(() => {
      if (!currentUser) return;
      const loadLabels = async () => {
         try {
            const response = await fetch('/api/labels', {
               headers: { 'x-user-id': currentUser.id }
            });
            if (!response.ok) return;
            const data = await response.json();
            if (Array.isArray(data?.labels) && data.labels.length > 0) {
               setLabels(data.labels);
            } else {
               setLabels([
                  { id: 'work', name: 'Work', color: '#22c55e' },
                  { id: 'friends', name: 'Friends', color: '#60a5fa' },
                  { id: 'urgent', name: 'Urgent', color: '#f97316' }
               ]);
            }
            if (data?.userLabels && typeof data.userLabels === 'object') {
               setUserLabels(data.userLabels);
            }
         } catch (error) {
            console.error('Load labels error:', error);
         } finally {
            setLabelsLoaded(true);
         }
      };
      loadLabels();
   }, [currentUser]);

   useEffect(() => {
      if (!currentUser) return;
      fetchStories();
      const interval = window.setInterval(fetchStories, 30000);
      return () => window.clearInterval(interval);
   }, [currentUser, fetchStories]);

   useEffect(() => {
      if (!currentUser || !labelsLoaded) return;
      const save = async () => {
         try {
            await fetch('/api/labels', {
               method: 'PUT',
               headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
               body: JSON.stringify({ labels, userLabels })
            });
         } catch (error) {
            console.error('Save labels error:', error);
         }
      };
      save();
   }, [labels, userLabels, currentUser, labelsLoaded]);

   useEffect(() => {
      if (!currentUser) return;
      localStorage.setItem(`muted:${currentUser.id}`, JSON.stringify(mutedChats));
   }, [mutedChats, currentUser]);

   useEffect(() => {
      if (!currentUser) return;
      localStorage.setItem(`chatThemes:${currentUser.id}`, JSON.stringify(chatThemes));
   }, [chatThemes, currentUser]);

   useEffect(() => {
      if (!currentUser) return;
      localStorage.setItem(`chatBackgrounds:${currentUser.id}`, JSON.stringify(chatBackgrounds));
   }, [chatBackgrounds, currentUser]);

   useEffect(() => {
      if (!currentUser) return;
      localStorage.setItem(`hidden:${currentUser.id}`, JSON.stringify(hiddenMessageIds));
   }, [hiddenMessageIds, currentUser]);

   useEffect(() => {
      if (!currentUser) return;
      localStorage.setItem(`starred:${currentUser.id}`, JSON.stringify(starredMessageIds));
   }, [starredMessageIds, currentUser]);

   useEffect(() => {
      if (!currentUser) return;
      fetchUsers(currentUser.id);
      updateOnlineStatus(true);

      const socket = getSocket();
      socket.emit('register', currentUser.id);

      const heartbeat = window.setInterval(() => {
         updateOnlineStatus(true);
      }, 45000);

      socket.on('message', (message: Message) => {
         if (selectedUserId && (message.senderId === selectedUserId || message.receiverId === selectedUserId)) {
            setMessages(prev => {
               if (prev.some(m => m._id === message._id)) return prev;
               return [...prev, message];
            });
         } else {
            setUnreadCounts(prev => ({
               ...prev,
               [message.senderId]: (prev[message.senderId] || 0) + 1
            }));
            playNotificationSound();
         }
      });

      socket.on('typing', ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
         if (userId === selectedUserId) {
            setTypingUsers(prev => {
               const next = new Set(prev);
               if (isTyping) next.add(userId);
               else next.delete(userId);
               return next;
            });
         }
      });

      return () => {
         socket.off('message');
         socket.off('typing');
         window.clearInterval(heartbeat);
      };
   }, [currentUser, fetchUsers, updateOnlineStatus, selectedUserId, playNotificationSound]);

   useEffect(() => {
      if (!showSettings) return;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
         document.body.style.overflow = originalOverflow;
      };
   }, [showSettings]);

   useEffect(() => {
      if (!showStoryViewer || !activeStoryGroup) return;
      const story = activeStoryGroup.stories[activeStoryIndex];
      if (story?._id) {
         markStoryViewed(story._id);
      }
   }, [showStoryViewer, activeStoryGroup, activeStoryIndex, markStoryViewed]);

   useEffect(() => {
      if (!showStoryViewer) {
         setShowStoryReactionPicker(false);
         return;
      }
      setShowStoryReactionPicker(false);
   }, [showStoryViewer, activeStoryIndex]);

   useEffect(() => {
      if (!showStoryViewer || !activeStoryGroup) return;
      const updatedGroup = stories.find(group => group.userId === activeStoryGroup.userId);
      if (!updatedGroup) return;
      if (updatedGroup === activeStoryGroup) return;
      const nextIndex = Math.min(activeStoryIndex, Math.max(0, updatedGroup.stories.length - 1));
      setActiveStoryGroup(updatedGroup);
      setActiveStoryIndex(nextIndex);
   }, [stories, showStoryViewer, activeStoryGroup, activeStoryIndex]);

   useEffect(() => {
      if (!currentUser) return;

      const fetchSummary = async () => {
         try {
            const response = await fetch('/api/messages/summary', {
               headers: { 'x-user-id': currentUser.id },
               cache: 'no-store'
            });
            const data = await response.json();
            const counts = data.counts || {};
            const items = Array.isArray(data.items) ? data.items : [];
            const previousCounts = lastUnreadCountsRef.current;
            setUnreadCounts(counts);

            const previousNotified = lastNotifiedRef.current;
            const changed = items.find((item: { message: Message; senderId: string }) => {
               const prev = previousNotified[item.senderId];
               if (!prev) return true;
               if (prev.messageId !== String(item.message._id)) return true;
               if (item.message.editedAt && prev.editedAt !== String(item.message.editedAt)) return true;
               return false;
            });

            const changedUsers = Object.keys(counts).filter(userId => {
               const prev = previousCounts[userId] || 0;
               const next = counts[userId] || 0;
               return next > prev && userId !== selectedUserId && !mutedChats[userId];
            });

            if (changed && changed.senderId !== selectedUserId && !mutedChats[changed.senderId]) {
               const user = users.find(u => u._id === changed.senderId);
               const isEdited = Boolean(changed.message.editedAt);
               setToast({
                  userId: changed.senderId,
                  username: user?.username || 'Someone',
                  count: counts[changed.senderId] || 1,
                  type: isEdited ? 'edited' : 'new',
                  messageId: changed.message._id
               });
               playNotificationSound();
               if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
               toastTimeoutRef.current = setTimeout(() => setToast(null), 5000);
            } else if (changedUsers.length > 0) {
               const userId = changedUsers[0];
               const user = users.find(u => u._id === userId);
               setToast({
                  userId,
                  username: user?.username || 'Someone',
                  count: counts[userId],
                  type: 'new'
               });
               playNotificationSound();
               if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
               toastTimeoutRef.current = setTimeout(() => setToast(null), 5000);
            }

            lastUnreadCountsRef.current = counts;
            const nextMap: Record<string, { messageId: string; editedAt?: string }> = {};
            items.forEach((item: { message: Message; senderId: string }) => {
               nextMap[item.senderId] = {
                  messageId: String(item.message._id),
                  editedAt: item.message.editedAt ? String(item.message.editedAt) : undefined
               };
            });
            lastNotifiedRef.current = nextMap;
         } catch (error) {
            console.error('Error fetching summary:', error);
         }
      };

      fetchSummary();
      const interval = setInterval(() => {
         if (document.visibilityState === 'visible') {
            fetchSummary();
         }
      }, 6000);
      const onVisibility = () => {
         if (document.visibilityState === 'visible') {
            fetchSummary();
         }
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
         clearInterval(interval);
         document.removeEventListener('visibilitychange', onVisibility);
      };
   }, [currentUser, selectedUserId, users, playNotificationSound, mutedChats]);

   useEffect(() => {
      if (!currentUser) return;
      setUsers(prev =>
         prev.map(user =>
            user._id === currentUser.id
               ? { ...user, avatar: currentUser.avatar }
               : user
         )
      );
   }, [currentUser]);

   const fetchMessages = useCallback(async (otherUserId: string) => {
      if (!currentUser) return;
      try {
         const response = await fetch(`/api/messages?otherUserId=${otherUserId}`, {
            headers: { 'x-user-id': currentUser.id }
         });
         const data = await response.json();
         setMessages(data.messages);
      } catch (error) {
         console.error('Error fetching messages:', error);
      }
   }, [currentUser]);

   const fetchIncomingCalls = useCallback(async () => {
      if (!currentUser) return;
      try {
         const response = await fetch('/api/calls', { headers: { 'x-user-id': currentUser.id } });
         const data = await response.json();
         const incomingCalls = data.calls.filter(
            (call: Call) => call.receiverId === currentUser.id && call.status === 'initiated'
         );
         if (incomingCalls.length > 0 && !activeCall && !incomingCall) {
            setIncomingCall(incomingCalls[0]);
         }
      } catch (error) {
         console.error('Error fetching calls:', error);
      }
   }, [currentUser, activeCall, incomingCall]);

   const sendMessage = useCallback(async (
      content: string,
      type: 'text' | 'image' | 'audio' | 'file' | 'video-note' = 'text',
      meta?: { fileUrl?: string; fileName?: string; fileSize?: number; files?: Array<{ url: string; name: string; size?: number; type?: string }>; transcript?: string; expiresInSeconds?: number }
   ) => {
      if (!currentUser || !selectedUserId) return;
      try {
         const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'x-user-id': currentUser?.id || ''
            },
            body: JSON.stringify({
               receiverId: selectedUserId,
               content,
               type,
               fileUrl: meta?.fileUrl,
               fileName: meta?.fileName,
               fileSize: meta?.fileSize,
               files: meta?.files,
               transcript: meta?.transcript,
               expiresInSeconds: meta?.expiresInSeconds
            })
         });
         if (response.status === 429) {
            const data = await response.json();
            const retryAfter = Number(data?.retryAfter) || 3;
            setSlowModeUntil(prev => ({
               ...prev,
               [selectedUserId]: Date.now() + retryAfter * 1000
            }));
            return;
         }
         if (!response.ok) {
            throw new Error('Failed to send message');
         }
         const data = await response.json();
         setMessages(prev => [...prev, data.message]);

         // Real-time delivery via socket
         const socket = getSocket();
         socket.emit('message', {
            receiverId: selectedUserId,
            message: data.message
         });
      } catch (error) {
         console.error('Error sending message:', error);
      }
   }, [currentUser, selectedUserId]);

   const forwardMessage = useCallback(async (message: Message, targetUserId: string) => {
      if (!currentUser || !targetUserId) return;
      try {
         await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
            body: JSON.stringify({
               receiverId: targetUserId,
               content: message.content,
               type: message.type,
               fileUrl: message.fileUrl,
               fileName: message.fileName,
               fileSize: message.fileSize,
               transcript: message.transcript,
               forwardedFrom: {
                  userId: message.senderId,
                  username: users.find(u => u._id === message.senderId)?.username || 'Unknown'
               }
            })
         });
      } catch (error) {
         console.error('Error forwarding message:', error);
      }
   }, [currentUser, users]);

   const replyMessage = useCallback(async (
      messageId: string,
      content: string,
      senderUsername: string,
      replyContent: string
   ) => {
      if (!currentUser || !selectedUserId) return;
      try {
         const response = await fetch('/api/messages/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
            body: JSON.stringify({
               senderId: currentUser.id,
               receiverId: selectedUserId,
               content,
               type: 'text',
               replyTo: {
                  messageId,
                  content: replyContent.substring(0, 50),
                  senderUsername
               }
            })
         });
         const data = await response.json();
         setMessages(prev => [...prev, data.message]);
      } catch (error) {
         console.error('Error sending reply:', error);
      }
   }, [currentUser, selectedUserId]);

   const deleteMessage = useCallback(async (messageId: string) => {
      if (!currentUser) return;
      try {
         await fetch(`/api/messages/${messageId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
            body: JSON.stringify({ userId: currentUser.id })
         });
         setMessages(prev => prev.map(msg =>
            msg._id === messageId ? { ...msg, isDeleted: true } : msg
         ));
      } catch (error) {
         console.error('Error deleting message:', error);
      }
   }, [currentUser]);

   const addReaction = useCallback(async (messageId: string, emoji: string) => {
      if (!currentUser) return;
      try {
         const response = await fetch(`/api/messages/${messageId}/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
            body: JSON.stringify({ emoji, userId: currentUser.id, username: currentUser.username })
         });
         const data = await response.json();
         setMessages(prev => prev.map(msg =>
            msg._id === messageId ? { ...msg, reactions: data.reactions } : msg
         ));
      } catch (error) {
         console.error('Error adding reaction:', error);
      }
   }, [currentUser]);

   const initiateCall = useCallback(async (type: 'audio' | 'video') => {
      if (!currentUser || !selectedUserId) return;
      try {
         const response = await fetch('/api/calls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
            body: JSON.stringify({ receiverId: selectedUserId, type })
         });
         const data = await response.json();
         setActiveCall(data.call);
         setIsInCall(true);
      } catch (error) {
         console.error('Error initiating call:', error);
      }
   }, [currentUser, selectedUserId]);

   const handleCallEnd = useCallback(() => {
      setActiveCall(null);
      setIsInCall(false);
   }, []);

   const handleAcceptIncomingCall = useCallback(() => {
      if (!incomingCall) return;
      setActiveCall(incomingCall);
      setIncomingCall(null);
      setIsInCall(true);
      if (incomingCaller) {
         setSelectedUser(incomingCaller);
      }
   }, [incomingCall, incomingCaller]);

   const handleDeclineIncomingCall = useCallback(async () => {
      if (!incomingCall || !currentUser) return;
      try {
         await fetch(`/api/calls/${incomingCall._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
            body: JSON.stringify({ status: 'rejected' })
         });
      } catch (error) {
         console.error('Error rejecting call:', error);
      } finally {
         setIncomingCall(null);
      }
   }, [incomingCall, currentUser]);

   const handleMarkAllRead = useCallback(async () => {
      if (!currentUser) return;
      try {
         await fetch('/api/messages/mark-read', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' }
         });
         setUnreadCounts({});
      } catch (error) {
         console.error('Error marking all read:', error);
      }
   }, [currentUser]);

   const editMessage = useCallback(async (messageId: string, content: string) => {
      if (!currentUser) return;
      try {
         await fetch(`/api/messages/${messageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
            body: JSON.stringify({ userId: currentUser.id, content })
         });
         const now = new Date();
         setMessages(prev =>
            prev.map(msg => {
               if (msg._id !== messageId) return msg;
               const previous = msg.content;
               if (previous === content) return msg;
               const history = msg.editHistory ? [...msg.editHistory] : [];
               history.push({ content: previous, editedAt: now });
               return { ...msg, content, editedAt: now, editHistory: history, isRead: false, status: 'sent', readAt: undefined };
            })
         );
      } catch (error) {
         console.error('Error editing message:', error);
      }
   }, [currentUser]);

   const saveDraft = useCallback(async (peerId: string, value: string) => {
      if (!currentUser) return;
      try {
         await fetch('/api/drafts', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
            body: JSON.stringify({ peerId, content: value })
         });
      } catch (error) {
         console.error('Error saving draft:', error);
      }
   }, [currentUser]);

   const handleDraftChange = useCallback((value: string) => {
      if (!selectedUserId) return;
      setDrafts(prev => ({ ...prev, [selectedUserId]: value }));
      if (draftSaveTimersRef.current[selectedUserId]) {
         clearTimeout(draftSaveTimersRef.current[selectedUserId]);
      }
      draftSaveTimersRef.current[selectedUserId] = setTimeout(() => {
         saveDraft(selectedUserId, value);
      }, 500);
   }, [selectedUserId, saveDraft]);

   const handleDeleteForMe = useCallback((messageId: string) => {
      setHiddenMessageIds(prev => (
         prev.includes(messageId) ? prev : [...prev, messageId]
      ));
   }, []);

   const toggleStarMessage = useCallback((messageId: string) => {
      setStarredMessageIds(prev => (
         prev.includes(messageId) ? prev.filter(id => id !== messageId) : [...prev, messageId]
      ));
   }, []);

   const togglePinMessage = useCallback((messageId: string) => {
      if (!selectedUserId) return;
      setPinnedMessages(prev => {
         const existing = prev[selectedUserId] || [];
         const next = existing.includes(messageId)
            ? existing.filter(id => id !== messageId)
            : [messageId, ...existing].slice(0, 5);
         return { ...prev, [selectedUserId]: next };
      });
      setPinnedPreviews(prev => {
         const current = prev[selectedUserId] || [];
         const already = current.some(p => p.messageId === messageId);
         if (already) {
            return { ...prev, [selectedUserId]: current.filter(p => p.messageId !== messageId) };
         }
         const msg = messages.find(m => m._id === messageId);
         if (!msg) return prev;
         let content = typeof msg.content === 'string' ? msg.content : '';
         if (msg.fileUrl) {
            content = `[file] ${msg.fileName || msg.fileUrl}`;
         }
         if (Array.isArray(msg.files) && msg.files.length > 0) {
            content = `[attachments] ${msg.files.map(f => f.name || f.url).join(', ')}`;
         }
         const nextPreview = [{ messageId, content }, ...current].slice(0, 3);
         return { ...prev, [selectedUserId]: nextPreview };
      });
   }, [selectedUserId, messages]);

   const toggleMuteChat = useCallback((userId: string) => {
      setMutedChats(prev => ({ ...prev, [userId]: !prev[userId] }));
   }, []);

   const runChatLockAction = useCallback(async (
      payload: {
         action: 'set' | 'lock' | 'unlock' | 'change' | 'remove';
         peerId: string;
         passcode?: string;
         currentPasscode?: string;
         newPasscode?: string;
         lock?: boolean;
      }
   ): Promise<{ ok: boolean; error?: string }> => {
      if (!currentUser) return { ok: false, error: 'Unauthorized' };
      try {
         const response = await fetch('/api/users/chat-locks', {
            method: 'PATCH',
            headers: {
               'Content-Type': 'application/json',
               'x-user-id': currentUser.id
            },
            body: JSON.stringify(payload)
         });
         const data = await response.json();
         if (!response.ok) {
            return { ok: false, error: data?.error || 'Lock action failed' };
         }
         if (data?.locks && typeof data.locks === 'object') {
            setChatLocks(data.locks);
         } else if (payload.peerId && data?.chatLock) {
            setChatLocks(prev => ({ ...prev, [payload.peerId]: data.chatLock }));
         }
         return { ok: true };
      } catch (error) {
         console.error('Chat lock action error:', error);
         return { ok: false, error: 'Network error' };
      }
   }, [currentUser]);

   const setChatTheme = useCallback((userId: string, themeClass: string) => {
      setChatThemes(prev => ({ ...prev, [userId]: themeClass }));
   }, []);

   const setChatBackground = useCallback((userId: string, url: string) => {
      setChatBackgrounds(prev => ({ ...prev, [userId]: url }));
   }, []);

   const saveProfile = useCallback(async () => {
      if (!currentUser) return;
      try {
         await fetch('/api/users/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
            body: JSON.stringify({
               title: profileTitle,
               statusMessage: profileStatusMessage,
               bio: profileBio,
               phones: profilePhones.split(',').map(p => p.trim()).filter(Boolean),
               socials: profileSocials,
               bioVisibility,
               allowedUserIds
            })
         });
      } catch (error) {
         console.error('Save profile error:', error);
      }
   }, [currentUser, profileTitle, profileStatusMessage, profileBio, profilePhones, profileSocials, bioVisibility, allowedUserIds]);

   const respondFollowRequest = useCallback(async (requesterId: string, action: 'accept' | 'decline') => {
      if (!currentUser) return;
      try {
         await fetch('/api/users/follow/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
            body: JSON.stringify({ requesterId, action })
         });
         setFollowRequests(prev => prev.filter(id => id !== requesterId));
         if (action === 'accept') {
            setFollowersIds(prev => (prev.includes(requesterId) ? prev : [...prev, requesterId]));
         }
         if (action === 'accept' && bioVisibility === 'custom') {
            setAllowedUserIds(prev => (prev.includes(requesterId) ? prev : [...prev, requesterId]));
         }
      } catch (error) {
         console.error('Respond follow error:', error);
      }
   }, [currentUser, bioVisibility]);

   const handleSelectUser = useCallback((user: User) => {
      setSelectedUser(user);
      setJumpToMessageId(null);
      if (user._id) {
         setUnreadCounts(prev => ({ ...prev, [user._id as string]: 0 }));
      }
   }, []);

   const handleOpenSearchResult = useCallback((result: { message: Message; otherUser: User }) => {
      if (!currentUser) return;
      handleSelectUser(result.otherUser);
      setShowGlobalSearch(false);
      setJumpToMessageId(result.message._id ?? null);
   }, [currentUser, handleSelectUser]);

   const handleOpenToast = useCallback(() => {
      if (!toast) return;
      const user = users.find(u => u._id === toast.userId);
      if (user) {
         handleSelectUser(user);
         setJumpToMessageId(toast.messageId ?? null);
      }
      setToast(null);
   }, [toast, users, handleSelectUser]);

   const handleCloseChat = useCallback(() => {
      setSelectedUser(null);
      setMessages([]);
   }, []);

   const updateAvatar = useCallback(async (file?: File) => {
      if (!currentUser || !file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
         setIsUploadingAvatar(true);
         const response = await fetch('/api/upload', { method: 'POST', body: formData });
         const data = await response.json();
         if (data.success) {
            await fetch('/api/users/avatar', {
               method: 'PATCH',
               headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
               body: JSON.stringify({ avatar: data.fileUrl })
            });
            setCurrentUser(prev => {
               if (!prev) return prev;
               const updated = { ...prev, avatar: data.fileUrl };
               localStorage.setItem('currentUser', JSON.stringify(updated));
               return updated;
            });
            setUsers(prev => prev.map(user =>
               user._id === currentUser.id ? { ...user, avatar: data.fileUrl } : user
            ));
         }
      } catch (error) {
         console.error('Error updating avatar:', error);
      } finally {
         setIsUploadingAvatar(false);
      }
   }, [currentUser]);

   const handleCreateStory = useCallback(async () => {
      if (!currentUser) return;
      if (!storyText.trim() && !storyFile) return;
      setStoryUploading(true);
      try {
         let mediaUrl = '';
         if (storyFile) {
            const formData = new FormData();
            formData.append('file', storyFile);
            const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData });
            const uploadData = await uploadResponse.json();
            if (uploadData?.success) {
               mediaUrl = uploadData.fileUrl;
            }
         }
         const response = await fetch('/api/stories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
            body: JSON.stringify({
               text: storyText.trim(),
               mediaUrl,
               style: { background: storyBackground, textColor: storyTextColor }
            })
         });
         if (!response.ok) return;
         setStoryText('');
         setStoryFile(null);
         if (storyPreview) URL.revokeObjectURL(storyPreview);
         setStoryPreview(null);
         setStoryBackground('linear-gradient(135deg, #4f46e5, #7c3aed)');
         setStoryTextColor('#ffffff');
         setShowStoryEmojiPicker(false);
         setShowStoryModal(false);
         fetchStories();
      } catch (error) {
         console.error('Create story error:', error);
      } finally {
         setStoryUploading(false);
      }
   }, [currentUser, storyText, storyFile, storyPreview, storyBackground, storyTextColor, fetchStories]);

   const handleDeleteStory = useCallback(async (storyId: string) => {
      if (!currentUser || !storyId) return;
      const confirmDelete = window.confirm('Delete this story?');
      if (!confirmDelete) return;
      try {
         const response = await fetch(`/api/stories/${storyId}`, {
            method: 'DELETE',
            headers: { 'x-user-id': currentUser.id }
         });
         if (!response.ok && response.status !== 404) {
            return;
         }
         fetchStories();
      } catch (error) {
         console.error('Delete story error:', error);
      }
   }, [currentUser, fetchStories]);

   const handleStoryReaction = useCallback(async (storyId: string, emoji: string) => {
      if (!currentUser || !storyId || !emoji) return;
      try {
         const response = await fetch(`/api/stories/${storyId}/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
            body: JSON.stringify({ emoji })
         });
         if (!response.ok) return;
         setStories(prev => prev.map(group => ({
            ...group,
            stories: group.stories.map(story => {
               if (story._id !== storyId) return story;
               const existing = (story.reactions || []).filter(r => r.userId !== currentUser.id);
               return { ...story, reactions: [...existing, { emoji, userId: currentUser.id, username: currentUser.username }] };
            })
         })));
         setActiveStoryGroup(prev => {
            if (!prev) return prev;
            return {
               ...prev,
               stories: prev.stories.map(story => {
                  if (story._id !== storyId) return story;
                  const existing = (story.reactions || []).filter(r => r.userId !== currentUser.id);
                  return { ...story, reactions: [...existing, { emoji, userId: currentUser.id, username: currentUser.username }] };
               })
            };
         });
      } catch (error) {
         console.error('Story reaction error:', error);
      } finally {
         setShowStoryReactionPicker(false);
      }
   }, [currentUser]);

   const handleLogout = useCallback(() => {
      updateOnlineStatus(false);
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      window.location.href = '/';
   }, [updateOnlineStatus]);

   useEffect(() => {
      if (!currentUser) return;
      let idleTimeout: NodeJS.Timeout;
      const resetIdleTimer = () => {
         clearTimeout(idleTimeout);
         idleTimeout = setTimeout(() => {
            updateOnlineStatus(false);
            window.location.reload();
         }, 300000);
      };
      window.addEventListener('mousemove', resetIdleTimer);
      window.addEventListener('keypress', resetIdleTimer);
      window.addEventListener('click', resetIdleTimer);
      window.addEventListener('scroll', resetIdleTimer);
      resetIdleTimer();
      return () => {
         clearTimeout(idleTimeout);
         window.removeEventListener('mousemove', resetIdleTimer);
         window.removeEventListener('keypress', resetIdleTimer);
         window.removeEventListener('click', resetIdleTimer);
         window.removeEventListener('scroll', resetIdleTimer);
      };
   }, [currentUser, updateOnlineStatus]);

   useEffect(() => {
      if (!selectedUserId) return;

      const checkTypingStatus = async () => {
         try {
            const response = await fetch(`/api/users/typing?userId=${selectedUserId}`);
            const data = await response.json();
            setTypingUsers((prev: Set<string>) => {
               const next = new Set(prev);
               if (data.isTyping) {
                  next.add(selectedUserId);
               } else {
                  next.delete(selectedUserId);
               }
               return next;
            });
            setSelectedUserActivity(typeof data?.activity === 'string' ? data.activity : null);
         } catch (error) {
            console.error('Error fetching typing status:', error);
         }
      };

      const typingInterval = setInterval(checkTypingStatus, 2000);
      return () => clearInterval(typingInterval);
   }, [selectedUserId]);

   useEffect(() => {
      if (!selectedUserId) return;

      const poll = async () => {
         await fetchMessages(selectedUserId);
      };

      const pollingInterval = setInterval(poll, 1000);
      return () => clearInterval(pollingInterval);
   }, [selectedUserId, fetchMessages]);

   useEffect(() => {
      const interval = setInterval(() => {
         setMessages(prev => {
            const now = Date.now();
            const next = prev.filter(m => {
               if (!m.expiresAt) return true;
               return new Date(m.expiresAt).getTime() > now;
            });
            return next;
         });
      }, 1000);
      return () => clearInterval(interval);
   }, []);

   useEffect(() => {
      if (!currentUser) return;
      let interval: NodeJS.Timeout;
      const start = (ms: number) => {
        if (interval) clearInterval(interval);
        interval = setInterval(fetchIncomingCalls, ms);
      };
      const handleVisibility = () => {
        start(document.visibilityState === 'visible' ? 3000 : 15000);
        if (document.visibilityState === 'visible') fetchIncomingCalls();
      };
      handleVisibility();
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        if (interval) clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
   }, [currentUser, fetchIncomingCalls]);

   useEffect(() => {
      if (!currentUser) return;
      const run = async () => {
         try {
            await fetch('/api/messages/schedule/dispatch', {
               method: 'POST',
               headers: { 'x-user-id': currentUser.id }
            });
         } catch (error) {
            console.error('Dispatch scheduled messages error:', error);
         }
      };
      run();
      const interval = setInterval(run, 20000);
      return () => clearInterval(interval);
   }, [currentUser]);

   useEffect(() => {
      if (!currentUser || !showGlobalSearch) return;
      const query = globalSearchQuery.trim();
      if (query.length < 2) {
         setGlobalSearchResults([]);
         return;
      }
      const controller = new AbortController();
      const run = async () => {
         try {
            setGlobalSearchLoading(true);
            const response = await fetch(`/api/messages/search?q=${encodeURIComponent(query)}&filter=${globalSearchFilter}`, {
               headers: { 'x-user-id': currentUser.id },
               signal: controller.signal
            });
            const data = await response.json();
            setGlobalSearchResults(data.results || []);
         } catch (error) {
            if ((error as { name?: string }).name !== 'AbortError') {
               console.error('Global search error:', error);
            }
         } finally {
            setGlobalSearchLoading(false);
         }
      };
      run();
      return () => controller.abort();
   }, [currentUser, globalSearchQuery, globalSearchFilter, showGlobalSearch]);

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

   const handleDrop = useCallback(async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

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
            sendMessage(file.name, isImage ? 'image' : 'file', {
               fileUrl: data.fileUrl,
               fileName: data.filename ?? file.name,
               fileSize: data.fileSize ?? file.size
            });
         }
      } catch (error) {
         console.error('Error uploading file:', error);
      }
   }, [sendMessage]);


   if (!mounted) {
      return (
         <div className="flex items-center justify-center h-screen bg-linear-to-br from-gray-950 via-gray-900 to-gray-950">
            <div className="flex flex-col items-center gap-4 animate-pulse">
               <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <FiMessageCircle className="text-white text-2xl" />
               </div>
               <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <FiLoader className="animate-spin" />
                  <span>Loading your conversations...</span>
               </div>
            </div>
         </div>
      );
   }

   return (
      <div
         className={`flex h-screen ${isDarkMode ? 'bg-linear-to-br from-gray-950 via-gray-900 to-gray-950 text-white' : 'bg-linear-to-br from-gray-50 to-white text-gray-900'} overflow-hidden transition-all duration-500`}
         onDragEnter={handleDragEnter}
         onDragLeave={handleDragLeave}
         onDragOver={handleDragOver}
         onDrop={handleDrop}
      >
         {/* Drag & drop overlay */}
         {isDragging && (
            <div className="absolute inset-0 bg-indigo-600/20 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn">
               <div className="bg-gray-900/90 rounded-2xl p-8 border-2 border-dashed border-indigo-500 shadow-2xl transform scale-110 animate-pulse">
                  <FiUpload className="text-indigo-400 text-4xl mx-auto mb-3" />
                  <p className="text-white text-lg font-medium">Drop file to upload</p>
               </div>
            </div>
         )}

         {/* Sidebar */}
         <aside className={`
        ${showSidebar ? 'translate-x-0 w-80 opacity-100 pointer-events-auto' : '-translate-x-full w-0 opacity-0 pointer-events-none'}
        shrink-0 flex flex-col ${isDarkMode ? 'bg-gray-900/95 border-gray-800/50' : 'bg-white/90 border-gray-200/70'} backdrop-blur-xl border-r
        transition-all duration-300 ease-in-out
        fixed lg:relative z-40 h-full
      `}>
            {/* Sidebar edge toggle */}
            <button
               onClick={() => setShowSidebar(!showSidebar)}
               className={`absolute top-8 -right-3 z-50 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/30 hover:scale-110 transition-transform duration-200 ${showSidebar ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
               title="Hide sidebar"
            >
               <FiChevronLeft className="text-white text-sm" />
            </button>
            {/* Header with glass effect */}
            <div className={`px-5 py-5 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-800/50 bg-linear-to-r from-gray-900 to-gray-800/50' : 'border-gray-200/70 bg-linear-to-r from-white to-slate-50'}`}>
               <div className="flex items-center gap-3">
                  <div className=" rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse-slow">
                     <Image src="/logo.png" alt="Logo" width={34} height={34} className="object-contain " />
                  </div>
                  <div className="flex items-center gap-2">
                     <span className={`font-bold tracking-tight text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>AZ Chat</span>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <button
                     onClick={() => setShowGlobalSearch(true)}
                     title="Search all chats"
                     className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 ${isDarkMode
                        ? 'bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white'
                        : 'bg-white/90 hover:bg-slate-100 text-gray-600 hover:text-gray-900 border border-gray-200/70'
                        }`}
                  >
                     <FiSearch className="text-lg" />
                  </button>

                  <div className="relative" ref={notificationsRef}>
                     <button
                        ref={notificationButtonRef}
                        onClick={() => {
                           const next = !showNotificationsDropdown;
                           setShowNotificationsDropdown(next);
                           if (next) {
                              loadNotifications();
                           } else {
                              setNotificationsMenuPos(null);
                           }
                        }}
                        title="Notifications"
                        className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 ${isDarkMode
                           ? 'bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white'
                           : 'bg-white/90 hover:bg-slate-100 text-gray-600 hover:text-gray-900 border border-gray-200/70'
                           }`}
                     >
                        <FiBell className="text-lg" />
                        {notificationCount > 0 && (
                           <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center border-2 border-gray-900 animate-pulse">
                              {notificationCount > 99 ? '99+' : notificationCount}
                           </span>
                        )}
                     </button>

                     {showNotificationsDropdown && (
                        <div
                           className={`fixed w-87.5 sm:w-105 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-hidden z-100 rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                           style={{
                              top: notificationsMenuPos?.top ?? 80,
                              left: notificationsMenuPos?.left ?? 16
                           }}
                        >
                           <div className="sticky top-0 z-10 border-b border-gray-800/60 bg-inherit backdrop-blur-md">
                              <div className="flex items-center justify-between px-4 py-3">
                                 <div>
                                    <p className="text-sm font-semibold">Notification Center</p>
                                    <p className={`text-[11px] ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                       {notificationCount > 0 ? `${notificationCount} unread updates` : 'All caught up'}
                                    </p>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    {notificationItems.length > 0 && (
                                       <button
                                          onClick={markAllNotificationsRead}
                                          className="text-[11px] px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
                                       >
                                          Mark all
                                       </button>
                                    )}
                                    <button
                                       onClick={() => {
                                          setShowNotificationsDropdown(false);
                                          setNotificationsMenuPos(null);
                                       }}
                                       className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800"
                                    >
                                       <FiX className="text-sm" />
                                    </button>
                                 </div>
                              </div>
                              <div className="px-4 pb-3 flex items-center gap-2">
                                 {([
                                    { key: 'all', label: 'All' },
                                    { key: 'messages', label: 'Messages' },
                                    { key: 'social', label: 'Social' }
                                 ] as const).map((tab) => (
                                    <button
                                       key={tab.key}
                                       onClick={() => setNotificationsTab(tab.key)}
                                       className={`px-3 py-1.5 rounded-full text-xs border transition-all ${notificationsTab === tab.key
                                          ? 'bg-indigo-600 text-white border-indigo-500'
                                          : isDarkMode
                                             ? 'bg-gray-800/80 text-gray-300 border-gray-700/60 hover:bg-gray-700'
                                             : 'bg-slate-100 text-gray-700 border-gray-200 hover:bg-slate-200'
                                          }`}
                                    >
                                       {tab.label}
                                    </button>
                                 ))}
                              </div>
                           </div>

                           <div className="p-3 space-y-2 overflow-y-auto max-h-[calc(70vh-92px)]">
                              {notificationsLoading && (
                                 <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading...</div>
                              )}

                              {!notificationsLoading && visibleNotificationItems.map((item) => (
                                 <button
                                    key={item.id}
                                    onClick={async () => {
                                       if (item.category === 'messages') {
                                          const user = users.find(u => u._id === item.actorId);
                                          if (user) {
                                             handleSelectUser(user);
                                             setJumpToMessageId(item.messageId ?? null);
                                          }
                                       } else if (item.rawType === 'follow_request') {
                                          setShowSettings(true);
                                       } else if (item.rawType === 'task_assigned') {
                                          const targetId = item.meta?.peerId || item.actorId;
                                          const user = users.find(u => u._id === targetId);
                                          if (user) {
                                             handleSelectUser(user);
                                             setJumpToMessageId(item.messageId ?? item.meta?.messageId ?? null);
                                             setOpenTasksPanelSignal((prev) => prev + 1);
                                          }
                                       } else if (item.rawType === 'story_reaction') {
                                          const storyId = item.meta?.storyId;
                                          const mine = stories.find(group => group.userId === currentUser?.id);
                                          if (storyId && mine) {
                                             const index = mine.stories.findIndex(s => s._id === storyId);
                                             if (index >= 0) {
                                                openStoryViewer(mine, index);
                                             } else {
                                                fetchStories();
                                                setTimeout(() => {
                                                   const refreshed = stories.find(group => group.userId === currentUser?.id);
                                                   if (!refreshed) return;
                                                   const refreshedIndex = refreshed.stories.findIndex(s => s._id === storyId);
                                                   if (refreshedIndex >= 0) openStoryViewer(refreshed, refreshedIndex);
                                                }, 400);
                                             }
                                          }
                                       }
                                       if (item.category === 'social' && currentUser && item.id.startsWith('social-')) {
                                          const rawId = item.id.replace('social-', '');
                                          await fetch('/api/notifications', {
                                             method: 'PATCH',
                                             headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
                                             body: JSON.stringify({ ids: [rawId] })
                                          });
                                          setFollowNotifications(prev => prev.filter(n => n._id !== rawId));
                                       }
                                       setShowNotificationsDropdown(false);
                                    }}
                                    className={`w-full text-left p-3 rounded-2xl border transition-all duration-200 hover:scale-[1.01] ${isDarkMode ? 'bg-gray-800/70 border-gray-700/60 hover:bg-gray-700/70' : 'bg-slate-50 border-gray-200 hover:bg-slate-100'
                                       }`}
                                 >
                                    <div className="flex items-start gap-3">
                                       <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center overflow-hidden ring-2 ring-indigo-500/20 shrink-0">
                                          {item.actorAvatar ? (
                                             <Image src={item.actorAvatar} alt={item.actorName || 'User'} width={40} height={40} className="w-full h-full object-cover" />
                                          ) : item.category === 'social' ? (
                                             item.rawType === 'follow_accepted' ? <FiCheckCircle className="text-sm" /> : <FiUserPlus className="text-sm" />
                                          ) : (
                                             (item.actorName || 'U').charAt(0).toUpperCase()
                                          )}
                                       </div>
                                       <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-2">
                                             <p className="text-sm font-medium truncate">{item.title}</p>
                                             <span className={`text-[10px] shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                                {formatNotificationTime(item.timestamp)}
                                             </span>
                                          </div>
                                          <p className={`text-xs mt-1 wrap-break-word ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                             {item.body}
                                          </p>
                                          <div className="mt-2 flex items-center gap-2">
                                             <span className={`text-[10px] px-2 py-1 rounded-full ${item.category === 'messages'
                                                ? (isDarkMode ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border border-cyan-200')
                                                : (isDarkMode ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')
                                                }`}>
                                                {item.category === 'messages' ? 'Message' : 'Social'}
                                             </span>
                                          </div>
                                       </div>
                                    </div>
                                 </button>
                              ))}

                              {!notificationsLoading && visibleNotificationItems.length === 0 && (
                                 <div className={`text-xs rounded-xl border p-4 text-center ${isDarkMode ? 'text-gray-500 border-gray-800/60 bg-gray-900/40' : 'text-gray-600 border-gray-200 bg-slate-50'}`}>
                                    No notifications in this tab.
                                 </div>
                              )}
                           </div>
                        </div>
                     )}
                  </div>
                  <button
                     onClick={() => setShowSettings(true)}
                     className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 ${isDarkMode
                        ? 'bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white'
                        : 'bg-white/90 hover:bg-slate-100 text-gray-600 hover:text-gray-900 border border-gray-200/70'
                        }`}
                  >
                     <FiSettings className="text-lg" />
                  </button>
               </div>
            </div>

            {/* Current user with glass effect */}
            <div className={`px-5 py-4 border-b flex items-center justify-between backdrop-blur-sm ${isDarkMode ? 'border-gray-800/50 bg-gray-800/30' : 'border-gray-200/70 bg-white/60'}`}>
               <div className="flex items-center gap-3 min-w-0 group">
                  <div className="relative shrink-0">
                     <div className="w-11 h-11 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold overflow-hidden ring-2 ring-indigo-500/30 group-hover:ring-indigo-400 transition-all duration-300">
                        {currentUser?.avatar ? (
                           <Image
                              src={currentUser.avatar}
                              alt={currentUser.username ?? 'User'}
                              width={44}
                              height={44}
                              className="w-full h-full object-cover"
                           />
                        ) : (
                           currentUser?.username?.charAt(0).toUpperCase() ?? 'U'
                        )}
                     </div>
                     <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-gray-900 rounded-full animate-pulse" />
                  </div>
                  <div className="min-w-0">
                     <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{currentUser?.username ?? 'User'}</p>
                     <p className={`text-xs truncate flex items-center gap-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                        <FiCheck className="text-emerald-400 text-xs" />
                        Online
                     </p>
                     {profileStatusMessage && (
                        <p className={`text-[11px] truncate ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
                           {profileStatusMessage}
                        </p>
                     )}
                  </div>
               </div>
               <button
                  onClick={handleLogout}
                  className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 hover:scale-110"
               >
                  <FiLogOut className="text-lg" />
               </button>
            </div>

            {/* Stories / Status */}
            <div className={`px-5 py-3 border-b ${isDarkMode ? 'border-gray-800/50 bg-gray-900/30' : 'border-gray-200/70 bg-white/60'}`}>
               <div className="flex items-center justify-between">
                  <p className={`text-xs font-semibold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>Status</p>
                  <button
                     onClick={() => setShowStoryModal(true)}
                     className="text-[11px] px-2 py-1 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 flex items-center gap-1"
                  >
                     <FiPlus className="text-xs" />
                     Add
                  </button>
               </div>
               <div className="mt-3 flex items-center gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent pb-2">
                  <button
                     onClick={() => {
                        if (myStoryGroup) {
                           openStoryViewer(myStoryGroup, 0);
                        } else {
                           setShowStoryModal(true);
                        }
                     }}
                     className="flex flex-col items-center gap-1 shrink-0"
                  >
                     <div className={`w-12 h-12 rounded-full p-0.5 ${myStoryGroup ? 'bg-linear-to-br from-indigo-500 to-purple-600' : 'bg-gray-700/60'}`}>
                        <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden">
                           {currentUser?.avatar ? (
                              <Image src={currentUser.avatar} alt={currentUser.username ?? 'You'} width={48} height={48} className="w-full h-full object-cover" />
                           ) : (
                              <span className="text-sm font-semibold text-white">{currentUser?.username?.charAt(0).toUpperCase() ?? 'U'}</span>
                           )}
                        </div>
                     </div>
                     <span className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>My status</span>
                  </button>
                  {otherStoryGroups.map(group => (
                     <button
                        key={`story-${group.userId}`}
                        onClick={() => openStoryViewer(group, 0)}
                        className="flex flex-col items-center gap-1 shrink-0"
                     >
                        <div className={`w-12 h-12 rounded-full p-0.5 ${group.hasUnseen ? 'bg-linear-to-br from-emerald-400 to-indigo-500' : 'bg-gray-700/60'}`}>
                           <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden">
                              {group.user?.avatar ? (
                                 <Image src={group.user.avatar} alt={group.user.username ?? 'User'} width={48} height={48} className="w-full h-full object-cover" />
                              ) : (
                                 <span className="text-sm font-semibold text-white">{group.user?.username?.charAt(0).toUpperCase() ?? 'U'}</span>
                              )}
                           </div>
                        </div>
                        <span className={`text-[10px] max-w-14 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                           {group.user?.username ?? 'User'}
                        </span>
                     </button>
                  ))}
                  {otherStoryGroups.length === 0 && !myStoryGroup && (
                     <div className={`text-[11px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>No stories yet.</div>
                  )}
               </div>
            </div>

            {/* User list with animations */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
               <div className="px-5 pt-5 pb-2">
                  <p className={`text-xs font-semibold uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                     <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                     Contacts · {users.filter(u => u._id !== currentUser?.id).length}
                  </p>
               </div>
               <div className="px-5 pt-3">
                  <div className="flex items-center justify-between">
                     <p className={`text-xs font-semibold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>Folders</p>
                     <button
                        onClick={() => setShowLabelsModal(true)}
                        className="text-[11px] text-indigo-300 hover:text-indigo-200"
                     >
                        Manage
                     </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                     <button
                        onClick={() => setSelectedLabel('all')}
                        className={`px-3 py-1 rounded-full text-[11px] border ${selectedLabel === 'all'
                           ? 'bg-indigo-600 text-white border-indigo-500'
                           : isDarkMode ? 'bg-gray-800/70 text-gray-300 border-gray-700/60' : 'bg-white text-gray-700 border-gray-200'
                           }`}
                     >
                        All
                     </button>
                     {labels.map(label => {
                        const count = Object.values(userLabels).filter(ids => ids.includes(label.id)).length;
                        return (
                           <button
                              key={label.id}
                              onClick={() => setSelectedLabel(label.id)}
                              className={`px-3 py-1 rounded-full text-[11px] border ${selectedLabel === label.id ? 'text-white' : 'text-gray-300'}`}
                              style={{
                                 borderColor: label.color,
                                 background: selectedLabel === label.id ? label.color : 'transparent'
                              }}
                           >
                              {label.name} {count > 0 ? `(${count})` : ''}
                           </button>
                        );
                     })}
                  </div>
               </div>

               <div className="px-3">
                  <UserList
                     users={filteredUsers}
                     selectedUser={selectedUser}
                     onSelectUser={(user) => {
                        handleSelectUser(user);
                        setShowSidebar(false);
                     }}
                     unreadCounts={unreadCounts}
                     pinnedPreviews={pinnedPreviews}
                     mutedChats={mutedChats}
                     lockedChats={Object.fromEntries(
                        Object.entries(chatLocks).map(([id, state]) => [id, Boolean(state?.isLocked)])
                     )}
                     labels={labels}
                     userLabels={userLabels}
                     onToggleUserLabel={toggleUserLabel}
                     onMarkAllRead={handleMarkAllRead}
                     isDarkMode={isDarkMode}
                  />
               </div>
            </div>
         </aside>

         {/* Main content with animations */}
         <main className="flex-1 flex flex-col min-w-0 relative">
            {!showSidebar && (
               <button
                  onClick={() => setShowSidebar(true)}
                  className="absolute top-7 left-3 z-50 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/30 hover:scale-110 transition-transform duration-200"
                  title="Show sidebar"
               >
                  <FiChevronLeft className="text-white text-sm rotate-180" />
               </button>
            )}
            {/* Background gradient effect */}
            <div className={`absolute inset-0 ${isDarkMode ? 'bg-linear-to-br from-indigo-600/5 via-transparent to-purple-600/5' : 'bg-linear-to-br from-indigo-200/40 via-white to-purple-200/30'} pointer-events-none`} />

            {selectedUser && currentUser ? (
               <div className="relative z-10 h-full animate-fadeIn">
                  <ChatWindow
                     currentUser={currentUser}
                     selectedUser={selectedUser}
                     users={users}
                     messages={messages.filter(m => !hiddenMessageIds.includes(String(m._id)))}
                     starredMessageIds={starredMessageIds}
                     onToggleStar={toggleStarMessage}
                     draft={selectedUserId ? drafts[selectedUserId] : ''}
                     onDraftChange={handleDraftChange}
                     pinnedMessageIds={selectedUserId ? pinnedMessages[selectedUserId] || [] : []}
                     onTogglePin={togglePinMessage}
                     isMuted={selectedUserId ? Boolean(mutedChats[selectedUserId]) : false}
                     onToggleMute={selectedUserId ? () => toggleMuteChat(selectedUserId) : undefined}
                     slowModeUntil={selectedUserId ? slowModeUntil[selectedUserId] : undefined}
                     chatAccent={selectedUserId ? chatThemes[selectedUserId] : undefined}
                     onSetChatTheme={selectedUserId ? (theme) => setChatTheme(selectedUserId, theme) : undefined}
                     chatBackground={selectedUserId ? chatBackgrounds[selectedUserId] : undefined}
                     onSetChatBackground={selectedUserId ? (url) => setChatBackground(selectedUserId, url) : undefined}
                     jumpToMessageId={jumpToMessageId}
                     isDarkMode={isDarkMode}
                     onSendMessage={sendMessage}
                     onForwardMessage={forwardMessage}
                     onInitiateCall={initiateCall}
                     onClose={handleCloseChat}
                     onDeleteMessage={deleteMessage}
                     onDeleteForMe={handleDeleteForMe}
                     onAddReaction={addReaction}
                     onReplyMessage={replyMessage}
                     onEditMessage={editMessage}
                     chatLock={selectedUserId ? chatLocks[selectedUserId] : undefined}
                     onLockSetPasscode={selectedUserId ? async (passcode) => runChatLockAction({ action: 'set', peerId: selectedUserId, passcode }) : undefined}
                     onLockToggle={selectedUserId ? async (lock) => runChatLockAction({ action: 'lock', peerId: selectedUserId, lock }) : undefined}
                     onLockUnlock={selectedUserId ? async (passcode) => runChatLockAction({ action: 'unlock', peerId: selectedUserId, passcode }) : undefined}
                     onLockChangePasscode={selectedUserId ? async (currentPasscode, newPasscode) => runChatLockAction({ action: 'change', peerId: selectedUserId, currentPasscode, newPasscode }) : undefined}
                     onLockRemovePasscode={selectedUserId ? async (currentPasscode) => runChatLockAction({ action: 'remove', peerId: selectedUserId, currentPasscode }) : undefined}
                     openTasksPanelSignal={openTasksPanelSignal}
                     presenceText={
                        selectedUserActivity
                           ? (selectedUserActivity === 'typing'
                              ? 'typing...'
                              : selectedUserActivity === 'recording'
                                 ? 'recording...'
                                 : selectedUserActivity === 'editing'
                                    ? 'editing...'
                                    : selectedUserActivity === 'in_call'
                                       ? 'in call'
                                       : selectedUserActivity === 'away'
                                          ? 'away'
                                          : selectedUserActivity)
                           : undefined
                     }
                     isInCall={isInCall}
                  />
               </div>
            ) : (
               <div className="flex-1 flex flex-col items-center justify-center gap-6 select-none relative z-10">
                  {/* Animated background circles */}
                  <div className={`absolute w-96 h-96 ${isDarkMode ? 'bg-indigo-600 opacity-10' : 'bg-indigo-300/40'} rounded-full blur-[120px] animate-pulse-slow pointer-events-none`} />
                  <div className={`absolute w-80 h-80 ${isDarkMode ? 'bg-purple-600 opacity-10' : 'bg-purple-300/40'} rounded-full blur-[120px] animate-pulse-slow animation-delay-2000 pointer-events-none`} />

                  {/* Animated icon */}
                  <div className="w-24 h-24 rounded-3xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 animate-float">
                     <FiMessageCircle className="text-white text-4xl" />
                  </div>

                  {/* Text with fade-in animation */}
                  <div className="text-center space-y-2 animate-fadeInUp">
                     <h2 className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent`}>
                        No conversation selected
                     </h2>
                     <p className={`${isDarkMode ? 'text-gray-500' : 'text-gray-600'} text-sm`}>
                        Pick a contact from the sidebar to start chatting
                     </p>
                  </div>

                  {/* Decorative elements */}
                  <div className="flex gap-2 mt-4">
                     {[1, 2, 3].map((i) => (
                        <div
                           key={i}
                           className="w-2 h-2 rounded-full bg-indigo-500/30 animate-pulse"
                           style={{ animationDelay: `${i * 200}ms` }}
                        />
                     ))}
                  </div>
               </div>
            )}
         </main>

         {/* Call modal with animation */}
         {activeCall && currentUser && (
            <div className="animate-scaleIn">
               <CallModal
                  call={activeCall}
                  currentUser={currentUser}
                  selectedUser={selectedUser}
                  isInCall={isInCall}
                  onCallEnd={handleCallEnd}
               />
            </div>
         )}

         {/* Incoming call notification */}
         {incomingCall && !activeCall && (
            <div className="fixed top-4 right-4 z-60 bg-gray-900/90 border border-indigo-500/30 text-white rounded-2xl shadow-2xl px-4 py-3 w-72 backdrop-blur-md animate-slideIn">
               <p className="text-xs text-indigo-300">Incoming {incomingCall.type} call</p>
               <p className="text-sm font-semibold mt-1 truncate">
                  {incomingCaller?.username || 'Unknown caller'}
               </p>
               <div className="flex items-center gap-2 mt-3">
                  <button
                     onClick={handleDeclineIncomingCall}
                     className="flex-1 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-all hover:scale-105"
                  >
                     Decline
                  </button>
                  <button
                     onClick={handleAcceptIncomingCall}
                     className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm transition-all hover:scale-105"
                  >
                     Accept
                  </button>
               </div>
            </div>
         )}

         {/* New message toast */}
         {toast && (
            <button
               onClick={handleOpenToast}
               className="fixed bottom-4 right-4 z-60 bg-gray-900/90 border border-indigo-500/30 text-white rounded-2xl shadow-2xl px-4 py-3 w-72 backdrop-blur-md text-left hover:bg-gray-900 animate-slideIn"
            >
               <p className="text-xs text-indigo-300">
                  {toast.type === 'edited' ? 'Message edited' : 'New message'}
               </p>
               <p className="text-sm font-semibold mt-1 truncate">{toast.username}</p>
               <p className="text-xs text-gray-400 mt-1">
                  {toast.type === 'edited' ? 'Tap to view edit' : `${toast.count} unread`}
               </p>
            </button>
         )}

         {/* Follow notification toast */}
         {followToast && (
            <button
               onClick={() => {
                  setShowSettings(true);
                  setFollowToast(null);
               }}
               className="fixed bottom-4 right-80 z-60 bg-gray-900/90 border border-emerald-500/30 text-white rounded-2xl shadow-2xl px-4 py-3 w-72 backdrop-blur-md text-left hover:bg-gray-900 animate-slideIn"
            >
               <p className="text-xs text-emerald-300">
                  {followToast.type === 'follow_request' ? 'New follow request' : 'Follow accepted'}
               </p>
               <p className="text-sm font-semibold mt-1 truncate">
                  {users.find(u => u._id === followToast.actorId)?.username || 'Unknown'}
               </p>
               <p className="text-xs text-gray-400 mt-1">
                  Tap to view in settings
               </p>
            </button>
         )}

         {/* Global search */}
         {showGlobalSearch && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-6 animate-fadeIn">
               <div className={`w-full max-w-2xl rounded-3xl p-6 shadow-2xl border animate-slideUp ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                  <div className="flex items-center justify-between gap-3 mb-4">
                     <div className="flex-1">
                        <input
                           value={globalSearchQuery}
                           onChange={(e) => setGlobalSearchQuery(e.target.value)}
                           placeholder="Search across all chats..."
                           className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-gray-800/80 text-white placeholder-gray-500' : 'bg-slate-100 text-gray-900 placeholder-gray-500'}`}
                        />
                     </div>
                     <button
                        onClick={() => setShowGlobalSearch(false)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 ${isDarkMode ? 'bg-gray-800/80 text-gray-300 hover:bg-gray-700' : 'bg-slate-100 text-gray-600 hover:bg-slate-200'}`}
                     >
                        <FiX className="text-xl" />
                     </button>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                     {(['all', 'messages', 'files', 'images'] as const).map(filter => (
                        <button
                           key={filter}
                           onClick={() => setGlobalSearchFilter(filter)}
                           className={`px-3 py-1.5 rounded-full text-xs border transition-all hover:scale-105 ${globalSearchFilter === filter
                              ? 'bg-indigo-600 text-white border-indigo-500'
                              : isDarkMode
                                 ? 'bg-gray-800/80 text-gray-300 border-gray-700/60 hover:bg-gray-700'
                                 : 'bg-slate-100 text-gray-700 border-gray-200 hover:bg-slate-200'
                              }`}
                        >
                           {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                     ))}
                  </div>

                  <div className={`max-h-[60vh] overflow-y-auto space-y-2 pr-1 ${isDarkMode ? 'scrollbar-thin' : 'scrollbar-thin'}`}>
                     {globalSearchLoading && (
                        <div className={`text-sm flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                           <FiLoader className="animate-spin" />
                           Searching...
                        </div>
                     )}
                     {!globalSearchLoading && globalSearchQuery.trim().length < 2 && (
                        <div className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                           Type at least 2 characters to search.
                        </div>
                     )}
                     {!globalSearchLoading && globalSearchQuery.trim().length >= 2 && globalSearchResults.length === 0 && (
                        <div className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                           No results found.
                        </div>
                     )}
                     {globalSearchResults.map(({ message, otherUser }) => (
                        <button
                           key={`${message._id}-${otherUser._id}`}
                           onClick={() => handleOpenSearchResult({ message, otherUser })}
                           className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.02] ${isDarkMode ? 'bg-gray-800/70 border-gray-700/60 hover:bg-gray-700/70' : 'bg-white border-gray-200 hover:bg-slate-50'}`}
                        >
                           <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                 <div className="w-9 h-9 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center overflow-hidden ring-2 ring-indigo-500/30">
                                    {otherUser.avatar ? (
                                       <Image src={otherUser.avatar} alt={otherUser.username} width={36} height={36} className="w-full h-full object-cover" />
                                    ) : (
                                       otherUser.username.charAt(0).toUpperCase()
                                    )}
                                 </div>
                                 <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{otherUser.username}</p>
                                    <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                       {message.type === 'file' || message.type === 'image'
                                          ? (message.fileName || 'Attachment')
                                          : message.type === 'audio'
                                             ? (message.transcript || message.fileName || 'Voice note')
                                             : message.content}
                                    </p>
                                 </div>
                              </div>
                              <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                 {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                           </div>
                        </button>
                     ))}
                  </div>
               </div>
            </div>
         )}

         {showLabelsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-6 animate-fadeIn">
               <div className={`w-full max-w-sm rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
                     <p className="text-sm font-semibold">Manage folders</p>
                     <button
                        onClick={() => setShowLabelsModal(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                     >
                        <FiX className="text-sm" />
                     </button>
                  </div>
                  <div className="p-4 space-y-3">
                     <div className="flex items-center gap-2">
                        <input
                           value={newLabelName}
                           onChange={(e) => setNewLabelName(e.target.value)}
                           placeholder="Label name"
                           className={`flex-1 px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-800/80 text-white placeholder-gray-500' : 'bg-slate-100 text-gray-900 placeholder-gray-500'}`}
                        />
                        <input
                           type="color"
                           value={newLabelColor}
                           onChange={(e) => setNewLabelColor(e.target.value)}
                           className="w-10 h-10 p-0 border-none bg-transparent"
                        />
                        <button
                           onClick={addLabel}
                           className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
                        >
                           Add
                        </button>
                     </div>
                     <div className="space-y-2 max-h-60 overflow-y-auto">
                        {labels.length === 0 && (
                           <div className="text-xs text-gray-400">No folders yet.</div>
                        )}
                        {labels.map(label => (
                           <div key={label.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-800/70 border-gray-700/60' : 'bg-slate-50 border-gray-200'}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                 <span className="w-3 h-3 rounded-full" style={{ background: label.color }} />
                                 <span className="text-sm truncate">{label.name}</span>
                              </div>
                              <button
                                 onClick={() => removeLabel(label.id)}
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

         {/* Settings modal with glass effect and animations */}
         {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn px-4 py-6">
               <div className={`settings-scroll backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border shadow-2xl animate-slideUp max-h-[85vh] overflow-y-auto ${isDarkMode ? 'bg-gray-900/95 border-gray-800/50 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                  <div className="flex items-center justify-between mb-8">
                     <h3 className="text-2xl font-bold bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        Settings
                     </h3>
                     <button
                        onClick={() => setShowSettings(false)}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 text-2xl ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-slate-100'}`}
                     >
                        <FiX />
                     </button>
                  </div>

                  <div className="space-y-6">
                     {/* Profile section */}
                     <div className="space-y-3">
                        <p className={`text-xs font-semibold uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                           <span className="w-1 h-1 rounded-full bg-indigo-500" />
                           Profile
                        </p>
                        <div className={`backdrop-blur-sm rounded-2xl p-5 space-y-4 border ${isDarkMode ? 'bg-gray-800/50 border-gray-700/50' : 'bg-slate-50 border-gray-200/70'}`}>
                           <div className="flex items-center gap-4">
                              <div className="relative group">
                                 <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold overflow-hidden ring-2 ring-indigo-500/30 group-hover:ring-indigo-400 transition-all duration-300">
                                    {avatarPreview || currentUser?.avatar ? (
                                       <Image
                                          src={avatarPreview || currentUser?.avatar || ''}
                                          alt={currentUser?.username ?? 'User'}
                                          width={64}
                                          height={64}
                                          className="w-full h-full object-cover"
                                       />
                                    ) : (
                                       currentUser?.username?.charAt(0).toUpperCase() ?? 'U'
                                    )}
                                 </div>
                                 <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-gray-900 rounded-full animate-pulse" />
                              </div>
                              <div className="flex-1">
                                 <p className={`font-medium text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{currentUser?.username}</p>
                                 <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{currentUser?.email}</p>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Avatar upload */}
                     <div className="space-y-3">
                        <p className={`text-xs font-semibold uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                           <span className="w-1 h-1 rounded-full bg-indigo-500" />
                           Profile Picture
                        </p>
                        <div className={`backdrop-blur-sm rounded-2xl p-5 border ${isDarkMode ? 'bg-gray-800/50 border-gray-700/50' : 'bg-slate-50 border-gray-200/70'}`}>
                           <div className="flex items-center gap-4">
                              <div className="relative">
                                 <div className={`w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-indigo-500/30 ${isDarkMode ? 'bg-gray-700/50' : 'bg-slate-100'}`}>
                                    {avatarPreview || currentUser?.avatar ? (
                                       <Image
                                          src={avatarPreview || currentUser?.avatar || ''}
                                          alt={currentUser?.username ?? 'User'}
                                          width={80}
                                          height={80}
                                          className="w-full h-full object-cover"
                                       />
                                    ) : (
                                       <span className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>No Image</span>
                                    )}
                                 </div>
                                 {isUploadingAvatar && (
                                    <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                                       <FiLoader className="text-white text-xl animate-spin" />
                                    </div>
                                 )}
                              </div>
                              <div className="flex-1">
                                 <label className="relative">
                                    <input
                                       type="file"
                                       accept="image/*"
                                       onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                                          const url = URL.createObjectURL(file);
                                          setAvatarPreview(url);
                                          updateAvatar(file);
                                       }}
                                       className="hidden"
                                    />
                                    <div className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl transition-all duration-200 cursor-pointer text-center hover:scale-105">
                                       Choose Image
                                    </div>
                                 </label>
                                 <p className={`mt-2 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                                    PNG, JPG, WEBP up to 5MB
                                 </p>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Bio section */}
                     <div className="space-y-3">
                        <p className={`text-xs font-semibold uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                           <span className="w-1 h-1 rounded-full bg-indigo-500" />
                           Bio
                        </p>
                        <div className={`backdrop-blur-sm rounded-2xl p-5 border space-y-3 ${isDarkMode ? 'bg-gray-800/50 border-gray-700/50' : 'bg-slate-50 border-gray-200/70'}`}>
                           <input
                              value={profileTitle}
                              onChange={(e) => setProfileTitle(e.target.value)}
                              placeholder="Title (e.g. Product Designer)"
                              className={`w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                           />
                           <input
                              value={profileStatusMessage}
                              onChange={(e) => setProfileStatusMessage(e.target.value)}
                              placeholder="Status message (e.g. Available / Busy)"
                              className={`w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                           />
                           <textarea
                              value={profileBio}
                              onChange={(e) => setProfileBio(e.target.value)}
                              placeholder="Write your bio..."
                              rows={4}
                              className={`w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                           />
                           <input
                              value={profilePhones}
                              onChange={(e) => setProfilePhones(e.target.value)}
                              placeholder="Phones (comma separated)"
                              className={`w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                           />
                           <div className="space-y-2">
                              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_1fr_auto] gap-2 items-stretch min-w-0">
                                 <select
                                    value={newSocialIcon}
                                    onChange={(e) => setNewSocialIcon(e.target.value)}
                                    className={`min-w-0 w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                 >
                                    {socialIconOptions.map((opt) => (
                                       <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                 </select>
                                 <input
                                    value={newSocialLabel}
                                    onChange={(e) => setNewSocialLabel(e.target.value)}
                                    placeholder="Social label"
                                    className={`min-w-0 w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                 />
                                 <input
                                    value={newSocialUrl}
                                    onChange={(e) => setNewSocialUrl(e.target.value)}
                                    placeholder="URL"
                                    className={`min-w-0 w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                 />
                                 <button
                                    onClick={() => {
                                       if (!newSocialLabel.trim() || !newSocialUrl.trim()) return;
                                       setProfileSocials(prev => [...prev, { label: newSocialLabel.trim(), url: newSocialUrl.trim(), icon: newSocialIcon }]);
                                       setNewSocialLabel('');
                                       setNewSocialUrl('');
                                    }}
                                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm w-full md:w-auto transition-all hover:scale-105"
                                 >
                                    Add
                                 </button>
                              </div>
                              {profileSocials.length > 0 && (
                                 <div className="space-y-1">
                                    {profileSocials.map((s, idx) => (
                                       <div
                                          key={`${s.label}-${idx}`}
                                          className={`rounded-lg transition-all ${isDarkMode ? 'bg-gray-800/70' : 'bg-white border border-gray-200'}`}
                                          draggable
                                          onDragStart={() => { dragIndexRef.current = idx; }}
                                          onDragOver={(e) => { e.preventDefault(); }}
                                          onDrop={() => {
                                             const from = dragIndexRef.current;
                                             if (from === null || from === idx) return;
                                             setProfileSocials(prev => {
                                                const next = [...prev];
                                                const [moved] = next.splice(from, 1);
                                                next.splice(idx, 0, moved);
                                                return next;
                                             });
                                             dragIndexRef.current = null;
                                          }}
                                       >
                                          {editingSocialIndex === idx ? (
                                             <div className="p-3 space-y-2">
                                                <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_1fr] gap-2">
                                                   <select
                                                      value={editingSocialIcon}
                                                      onChange={(e) => setEditingSocialIcon(e.target.value)}
                                                      className={`min-w-0 w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                                   >
                                                      {socialIconOptions.map((opt) => (
                                                         <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                      ))}
                                                   </select>
                                                   <input
                                                      value={editingSocialLabel}
                                                      onChange={(e) => setEditingSocialLabel(e.target.value)}
                                                      placeholder="Platform name"
                                                      className={`min-w-0 w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                                   />
                                                   <input
                                                      value={editingSocialUrl}
                                                      onChange={(e) => setEditingSocialUrl(e.target.value)}
                                                      placeholder="URL"
                                                      className={`min-w-0 w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                                   />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                   <button
                                                      onClick={() => {
                                                         if (!editingSocialLabel.trim() || !editingSocialUrl.trim()) return;
                                                         setProfileSocials(prev => prev.map((item, i) => i === idx ? {
                                                            ...item,
                                                            label: editingSocialLabel.trim(),
                                                            url: editingSocialUrl.trim(),
                                                            icon: editingSocialIcon
                                                         } : item));
                                                         setEditingSocialIndex(null);
                                                      }}
                                                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition-all hover:scale-105"
                                                   >
                                                      Save
                                                   </button>
                                                   <button
                                                      onClick={() => setEditingSocialIndex(null)}
                                                      className="px-3 py-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-700 text-white text-xs transition-all hover:scale-105"
                                                   >
                                                      Cancel
                                                   </button>
                                                </div>
                                             </div>
                                          ) : (
                                             <div className="flex items-center justify-between gap-3 px-3 py-2">
                                                <div className="flex items-center gap-2 text-sm">
                                                   <span className="w-7 h-7 rounded-lg bg-gray-900/50 flex items-center justify-center">
                                                      {(() => {
                                                         const Icon = getSocialIconByValue(s.icon);
                                                         return <Icon className="text-sm" />;
                                                      })()}
                                                   </span>
                                                   <span className="break-all">{s.label}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                   <button
                                                      onClick={() => {
                                                         setEditingSocialIndex(idx);
                                                         setEditingSocialLabel(s.label);
                                                         setEditingSocialUrl(s.url);
                                                         setEditingSocialIcon(s.icon || 'globe');
                                                      }}
                                                      className="text-xs text-indigo-300 hover:text-indigo-200 transition-all hover:scale-110"
                                                   >
                                                      Edit
                                                   </button>
                                                   <button
                                                      onClick={() => setProfileSocials(prev => prev.filter((_, i) => i !== idx))}
                                                      className="text-xs text-rose-400 hover:text-rose-300 transition-all hover:scale-110"
                                                   >
                                                      Remove
                                                   </button>
                                                </div>
                                             </div>
                                          )}
                                       </div>
                                    ))}
                                 </div>
                              )}
                           </div>
                           <div className="space-y-2">
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Visibility</label>
                              <select
                                 value={bioVisibility}
                                 onChange={(e) => setBioVisibility(e.target.value as typeof bioVisibility)}
                                 className={`w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                              >
                                 <option value="public">Public</option>
                                 <option value="followers">Followers</option>
                                 <option value="custom">Custom</option>
                                 <option value="private">Private</option>
                              </select>
                           </div>
                           {bioVisibility === 'custom' && (
                              <div className="space-y-2">
                                 <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Allowed users</div>
                                 <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {users.filter(u => u._id !== currentUser?.id).map((u) => (
                                       <label key={u._id} className="flex items-center gap-2 text-sm">
                                          <input
                                             type="checkbox"
                                             checked={allowedUserIds.includes(u._id as string)}
                                             onChange={(e) => {
                                                const id = u._id as string;
                                                setAllowedUserIds(prev => e.target.checked ? [...prev, id] : prev.filter(x => x !== id));
                                             }}
                                             className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500"
                                          />
                                          <span>{u.username}</span>
                                       </label>
                                    ))}
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>

                     {/* Follow requests */}
                     {followRequests.length > 0 && (
                        <div className="space-y-3">
                           <p className={`text-xs font-semibold uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                              <span className="w-1 h-1 rounded-full bg-indigo-500" />
                              Follow Requests
                           </p>
                           <div className="space-y-2">
                              {followRequests.map((id) => {
                                 const user = users.find(u => u._id === id);
                                 return (
                                    <div key={id} className={`flex items-center justify-between p-3 rounded-xl border ${isDarkMode ? 'bg-gray-800/50 border-gray-700/50' : 'bg-slate-50 border-gray-200/70'}`}>
                                       <div className="text-sm">{user?.username || id}</div>
                                       <div className="flex gap-2">
                                          <button
                                             onClick={() => respondFollowRequest(id, 'accept')}
                                             className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs transition-all hover:scale-105"
                                          >
                                             Accept
                                          </button>
                                          <button
                                             onClick={() => respondFollowRequest(id, 'decline')}
                                             className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs transition-all hover:scale-105"
                                          >
                                             Decline
                                          </button>
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>
                     )}

                     {/* Followers / Following */}
                     {(followersIds.length > 0 || followingIds.length > 0) && (
                        <div className="space-y-3">
                           <p className={`text-xs font-semibold uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                              <span className="w-1 h-1 rounded-full bg-indigo-500" />
                              Connections
                           </p>
                           <div className="flex items-center gap-2">
                              {(['followers', 'following'] as const).map(tab => (
                                 <button
                                    key={tab}
                                    onClick={() => setFollowTab(tab)}
                                    className={`px-3 py-1.5 rounded-full text-xs border transition-all ${followTab === tab
                                       ? 'bg-indigo-600 text-white border-indigo-500'
                                       : isDarkMode
                                          ? 'bg-gray-800/80 text-gray-300 border-gray-700/60 hover:bg-gray-700'
                                          : 'bg-slate-100 text-gray-700 border-gray-200 hover:bg-slate-200'
                                       }`}
                                 >
                                    {tab === 'followers' ? `Followers (${followersIds.length})` : `Following (${followingIds.length})`}
                                 </button>
                              ))}
                           </div>
                           <div className="space-y-2 max-h-48 overflow-y-auto">
                              {(followTab === 'followers' ? followersIds : followingIds).map((id) => {
                                 const user = users.find(u => u._id === id);
                                 return (
                                    <div key={id} className={`flex items-center gap-3 p-3 rounded-xl border ${isDarkMode ? 'bg-gray-800/50 border-gray-700/50' : 'bg-slate-50 border-gray-200/70'}`}>
                                       <div className="w-9 h-9 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center overflow-hidden">
                                          {user?.avatar ? (
                                             <Image src={user.avatar} alt={user.username} width={36} height={36} className="w-full h-full object-cover" />
                                          ) : (
                                             (user?.username || 'U').charAt(0).toUpperCase()
                                          )}
                                       </div>
                                       <div className="min-w-0">
                                          <p className="text-sm font-medium truncate">{user?.username || id}</p>
                                          {user?.email && <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{user.email}</p>}
                                       </div>
                                    </div>
                                 );
                              })}
                              {(followTab === 'followers' ? followersIds : followingIds).length === 0 && (
                                 <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>No users yet.</div>
                              )}
                           </div>
                        </div>
                     )}

                     {/* Preferences */}
                     <div className="space-y-3">
                        <p className={`text-xs font-semibold uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                           <span className="w-1 h-1 rounded-full bg-indigo-500" />
                           Preferences
                        </p>
                        <div className="space-y-2">
                           <button
                              onClick={() => setIsDarkMode(!isDarkMode)}
                              className={`w-full flex items-center justify-between p-4 backdrop-blur-sm rounded-xl border transition-all duration-200 group hover:scale-[1.02] ${isDarkMode ? 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50' : 'bg-slate-50 border-gray-200/70 hover:bg-slate-100'}`}
                           >
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm group-hover:scale-110 transition-transform duration-200">
                                    {isDarkMode ? <FiMoon className="text-lg" /> : <FiSun className="text-lg" />}
                                 </div>
                                 <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Dark Mode</span>
                              </div>
                              <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${isDarkMode ? 'bg-indigo-600' : 'bg-gray-600'}`}>
                                 <div className={`mt-0.5 w-5 h-5 rounded-full bg-white transform transition-transform duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                              </div>
                           </button>

                           <button
                              onClick={() => setNotifications(!notifications)}
                              className={`w-full flex items-center justify-between p-4 backdrop-blur-sm rounded-xl border transition-all duration-200 group hover:scale-[1.02] ${isDarkMode ? 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50' : 'bg-slate-50 border-gray-200/70 hover:bg-slate-100'}`}
                           >
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm group-hover:scale-110 transition-transform duration-200">
                                    {notifications ? <FiBell className="text-lg" /> : <FiBellOff className="text-lg" />}
                                 </div>
                                 <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Notifications</span>
                              </div>
                              <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${notifications ? 'bg-indigo-600' : 'bg-gray-600'}`}>
                                 <div className={`mt-0.5 w-5 h-5 rounded-full bg-white transform transition-transform duration-300 ${notifications ? 'translate-x-6' : 'translate-x-1'}`} />
                              </div>
                           </button>
                        </div>
                     </div>

                     {/* Notification types */}
                     <div className="space-y-2">
                        {[
                           { icon: <FiWifi className="text-lg" />, label: 'Messages', sub: 'New messages and replies' },
                           { icon: <FiPhone className="text-lg" />, label: 'Calls', sub: 'Incoming voice and video calls' },
                        ].map((item, index) => (
                           <div
                              key={item.label}
                              className={`flex items-center gap-4 p-4 backdrop-blur-sm rounded-xl border animate-slideIn ${isDarkMode ? 'bg-gray-800/50 border-gray-700/50' : 'bg-slate-50 border-gray-200/70'}`}
                              style={{ animationDelay: `${index * 100}ms` }}
                           >
                              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm">
                                 {item.icon}
                              </div>
                              <div>
                                 <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.label}</p>
                                 <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{item.sub}</p>
                              </div>
                           </div>
                        ))}
                     </div>

                     <button
                        onClick={async () => {
                           await saveProfile();
                           setShowSettings(false);
                        }}
                        className="w-full py-3.5 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all duration-200 text-sm shadow-lg shadow-indigo-600/30 hover:scale-105"
                     >
                        Save Changes
                     </button>
                  </div>
               </div>
            </div>
         )}

         {showStoryModal && (
            <div
               className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300 animate-in fade-in"
               onClick={() => setShowStoryModal(false)}
            >
               <div
                  className={`w-full max-w-md rounded-2xl shadow-2xl transform transition-all duration-300 animate-in zoom-in-95 slide-in-from-bottom-4 max-h-[85vh] overflow-hidden ${isDarkMode
                     ? 'bg-linear-to-b from-gray-900/95 to-gray-900/98 border border-gray-800/50 text-white backdrop-blur-sm'
                     : 'bg-white border border-gray-200 text-gray-900'
                     }`}
                  onClick={(e) => e.stopPropagation()}
               >
                  {/* Header */}
                  <div className={`flex items-center justify-between px-5 py-4 border-b ${isDarkMode ? 'border-gray-800/50' : 'border-gray-100'
                     }`}>
                     <p className="text-base font-semibold bg-linear-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                        Add Status
                     </p>
                     <button
                        onClick={() => setShowStoryModal(false)}
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${isDarkMode
                           ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                           : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                           }`}
                     >
                        <FiX className="text-lg" />
                     </button>
                  </div>

                  {/* Content */}
                  <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                     {/* Textarea */}
                     <textarea
                        value={storyText}
                        onChange={(e) => setStoryText(e.target.value)}
                        placeholder="What's on your mind? ✨"
                        rows={3}
                        className={`w-full rounded-xl px-4 py-3 text-sm transition-all duration-200 resize-none focus:outline-none ${isDarkMode
                           ? 'bg-gray-800/80 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/50 border border-gray-700'
                           : 'bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/50 border border-gray-200'
                           }`}
                     />

                     {/* Background Section */}
                     <div className="space-y-2">
                        <div className="flex items-center gap-2">
                           <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                           <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Background</p>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                           {[
                              'linear-gradient(135deg, #4f46e5, #7c3aed)',
                              'linear-gradient(135deg, #0ea5e9, #22c55e)',
                              'linear-gradient(135deg, #f97316, #ef4444)',
                              'linear-gradient(135deg, #0f172a, #1f2937)',
                              'linear-gradient(135deg, #ec4899, #8b5cf6)',
                              'linear-gradient(135deg, #f59e0b, #eab308)',
                              '#0b1120',
                              '#111827',
                              '#ffffff',
                              '#fef9c3'
                           ].map((bg) => (
                              <button
                                 key={bg}
                                 onClick={() => setStoryBackground(bg)}
                                 className={`w-10 h-10 rounded-xl transition-all duration-200 transform hover:scale-110 ${storyBackground === bg
                                    ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-900'
                                    : 'hover:ring-1 hover:ring-gray-600'
                                    }`}
                                 style={{ background: bg }}
                                 title={bg.includes('gradient') ? 'Gradient' : bg}
                              />
                           ))}
                           <label className="w-10 h-10 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center cursor-pointer transition-all hover:border-indigo-500 hover:bg-gray-800/50">
                              <span className="text-xl text-gray-400">+</span>
                              <input
                                 type="color"
                                 value={storyBackground.startsWith('#') ? storyBackground : '#4f46e5'}
                                 onChange={(e) => setStoryBackground(e.target.value)}
                                 className="hidden"
                              />
                           </label>
                        </div>
                     </div>

                     {/* Text Color Section */}
                     <div className="space-y-2">
                        <div className="flex items-center gap-2">
                           <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                           <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Text Color</p>
                        </div>
                        <div className="flex items-center gap-3">
                           <input
                              type="color"
                              value={storyTextColor}
                              onChange={(e) => setStoryTextColor(e.target.value)}
                              className="h-10 w-14 rounded-xl border border-gray-700 bg-transparent cursor-pointer"
                           />
                           <div className="flex flex-wrap gap-2">
                              {['#ffffff', '#0f172a', '#fbbf24', '#22c55e', '#38bdf8', '#f43f5e'].map((color) => (
                                 <button
                                    key={color}
                                    onClick={() => setStoryTextColor(color)}
                                    className={`w-8 h-8 rounded-lg transition-all duration-200 transform hover:scale-110 ${storyTextColor === color ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-900' : ''
                                       }`}
                                    style={{ background: color }}
                                 />
                              ))}
                           </div>
                        </div>
                     </div>

                     {/* Emoji Picker */}
                     <div className="relative">
                        <button
                           onClick={() => setShowStoryEmojiPicker((prev) => !prev)}
                           className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center text-xl ${isDarkMode
                              ? 'bg-gray-800/70 hover:bg-gray-700'
                              : 'bg-gray-100 hover:bg-gray-200'
                              }`}
                           title="Add emoji"
                        >
                           🙂
                        </button>
                        {showStoryEmojiPicker && (
                           <div className="absolute z-50 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                              <EmojiPicker
                                 theme={isDarkMode ? Theme.DARK : Theme.LIGHT}
                                 onEmojiClick={(emojiData: { emoji: string }) => {
                                    setStoryText((prev) => `${prev}${emojiData.emoji}`);
                                 }}
                                 width={320}
                                 height={360}
                              />
                           </div>
                        )}
                     </div>

                     {/* Preview Section */}
                     <div className="space-y-2">
                        <div className="flex items-center gap-2">
                           <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                           <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Preview</p>
                        </div>
                        <div className="rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl">
                           <div
                              className="h-36 w-full flex items-center justify-center text-center px-4 text-base font-semibold transition-all duration-300"
                              style={{
                                 background: storyBackground,
                                 color: storyTextColor,
                                 fontFamily: 'Poppins, system-ui, sans-serif',
                                 textShadow: storyTextColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none'
                              }}
                           >
                              {storyText || '✨ Your status preview ✨'}
                           </div>
                        </div>
                     </div>

                     {/* Image Upload */}
                     <div className="space-y-2">
                        <div className="flex items-center gap-2">
                           <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                           <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Optional Image</p>
                        </div>
                        <label className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer group ${isDarkMode
                           ? 'border border-gray-700/60 bg-gray-800/30 hover:bg-gray-800/60'
                           : 'border border-gray-200 bg-gray-50 hover:bg-gray-100'
                           }`}>
                           <div className="w-10 h-10 rounded-lg bg-linear-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                              <FiUpload className="text-base" />
                           </div>
                           <div className="flex-1 text-sm truncate">
                              <span className={storyFile ? 'text-indigo-400 font-medium' : 'text-gray-500'}>
                                 {storyFile ? storyFile.name : 'Click to choose an image'}
                              </span>
                           </div>
                           <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                 const file = e.target.files?.[0];
                                 if (!file) return;
                                 if (storyPreview) URL.revokeObjectURL(storyPreview);
                                 const url = URL.createObjectURL(file);
                                 setStoryFile(file);
                                 setStoryPreview(url);
                              }}
                              className="hidden"
                           />
                        </label>
                        {storyPreview && (
                           <div className="mt-2 rounded-xl overflow-hidden border border-gray-700/60 bg-gray-900/60 transition-all duration-300 hover:scale-[1.02]">
                              <Image
                                 src={storyPreview}
                                 alt="Story preview"
                                 width={480}
                                 height={320}
                                 className="w-full h-44 object-contain"
                              />
                              <button
                                 onClick={() => {
                                    if (storyPreview) URL.revokeObjectURL(storyPreview);
                                    setStoryFile(null);
                                    setStoryPreview(null);
                                 }}
                                 className="absolute top-2 right-2 bg-black/70 rounded-full p-1.5 hover:bg-red-500 transition-colors"
                              >
                                 <FiX className="text-white text-xs" />
                              </button>
                           </div>
                        )}
                     </div>

                     {/* Submit Button */}
                     <button
                        onClick={handleCreateStory}
                        disabled={storyUploading || (!storyText.trim() && !storyFile)}
                        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 transform active:scale-[0.98] ${storyUploading || (!storyText.trim() && !storyFile)
                           ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                           : 'bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg hover:shadow-xl'
                           }`}
                     >
                        {storyUploading ? (
                           <span className="flex items-center justify-center gap-2">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Publishing...
                           </span>
                        ) : (
                           '✨ Post Status ✨'
                        )}
                     </button>
                  </div>
               </div>
            </div>
         )}

         {showStoryViewer && activeStoryGroup && (
            <div className="fixed inset-0 z-70 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowStoryViewer(false)}>
               <div
                  className={`w-full max-w-xl rounded-2xl border shadow-2xl max-h-[85vh] overflow-hidden ${isDarkMode ? 'bg-gray-900/95 border-gray-800/60 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                  onClick={(e) => e.stopPropagation()}
               >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
                     <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center overflow-hidden">
                           {activeStoryGroup.user?.avatar ? (
                              <Image src={activeStoryGroup.user.avatar} alt={activeStoryGroup.user.username ?? 'User'} width={36} height={36} className="w-full h-full object-cover" />
                           ) : (
                              (activeStoryGroup.user?.username || 'U').charAt(0).toUpperCase()
                           )}
                        </div>
                        <div className="min-w-0">
                           <p className="text-sm font-semibold truncate">{activeStoryGroup.user?.username || 'Status'}</p>
                           <p className="text-[11px] text-gray-400">
                              {activeStoryGroup.stories[activeStoryIndex]?.createdAt
                                 ? new Date(activeStoryGroup.stories[activeStoryIndex].createdAt).toLocaleString()
                                 : ''}
                           </p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        {activeStoryGroup.userId === currentUser?.id && activeStoryGroup.stories[activeStoryIndex]?._id && (
                           <button
                              onClick={() => handleDeleteStory(activeStoryGroup.stories[activeStoryIndex]._id)}
                              className="text-xs text-rose-400 hover:text-rose-300"
                           >
                              Delete
                           </button>
                        )}
                        <button
                           onClick={() => setShowStoryViewer(false)}
                           className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                        >
                           <FiX className="text-sm" />
                        </button>
                     </div>
                  </div>
                  <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                     {activeStoryGroup.stories[activeStoryIndex]?.mediaUrl ? (
                        <div className="rounded-xl overflow-hidden border border-gray-700/60 bg-gray-900/60">
                           <Image
                              src={activeStoryGroup.stories[activeStoryIndex].mediaUrl as string}
                              alt="Story"
                              width={800}
                              height={600}
                              className="w-full h-auto max-h-[60vh] object-contain"
                           />
                        </div>
                     ) : (
                        <div className="rounded-xl overflow-hidden border border-gray-700/60">
                           <div
                              className="h-80 w-full flex items-center justify-center text-center px-6 text-lg font-semibold"
                              style={{
                                 background: activeStoryGroup.stories[activeStoryIndex]?.style?.background || 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                 color: activeStoryGroup.stories[activeStoryIndex]?.style?.textColor || '#ffffff',
                                 fontFamily: 'Poppins, sans-serif'
                              }}
                           >
                              {activeStoryGroup.stories[activeStoryIndex]?.text || 'Status'}
                           </div>
                        </div>
                     )}
                     {activeStoryGroup.stories[activeStoryIndex]?.text && (
                        <div className="text-sm text-gray-200 whitespace-pre-wrap">
                           {activeStoryGroup.stories[activeStoryIndex].text}
                        </div>
                     )}
                     {(() => {
                        const reactions = activeStoryGroup.stories[activeStoryIndex]?.reactions || [];
                        const summary = reactions.reduce<Record<string, number>>((acc, r) => {
                           acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                           return acc;
                        }, {});
                        const myReaction = reactions.find(r => r.userId === currentUser?.id)?.emoji;
                        return (
                           <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                 <div className="flex flex-wrap gap-2">
                                    {Object.entries(summary).map(([emoji, count]) => (
                                       <button
                                          key={`story-react-${emoji}`}
                                          onClick={() => handleStoryReaction(activeStoryGroup.stories[activeStoryIndex]._id, emoji)}
                                          className={`px-2 py-1 rounded-full text-xs border ${myReaction === emoji ? 'border-indigo-400 bg-indigo-500/20 text-white' : 'border-gray-700/60 text-gray-200'}`}
                                       >
                                          {emoji} {count}
                                       </button>
                                    ))}
                                    {Object.keys(summary).length === 0 && (
                                       <span className="text-xs text-gray-500">No reactions yet.</span>
                                    )}
                                 </div>
                                 <div className="relative">
                                    <button
                                       onClick={() => setShowStoryReactionPicker((prev) => !prev)}
                                       className="w-9 h-9 rounded-xl bg-gray-800/70 hover:bg-gray-700 flex items-center justify-center text-lg"
                                       title="React"
                                    >
                                       🙂
                                    </button>
                                    {showStoryReactionPicker && (
                                       <div className="absolute right-0 z-50 mt-2">
                                          <EmojiPicker
                                             theme={isDarkMode ? Theme.DARK : Theme.LIGHT}
                                             onEmojiClick={(emojiData: { emoji: string }) => {
                                                handleStoryReaction(activeStoryGroup.stories[activeStoryIndex]._id, emojiData.emoji);
                                             }}
                                             width={320}
                                             height={360}
                                          />
                                       </div>
                                    )}
                                 </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                 {['❤️', '😂', '🔥', '👏', '😍', '😮'].map((emoji) => (
                                    <button
                                       key={`quick-${emoji}`}
                                       onClick={() => handleStoryReaction(activeStoryGroup.stories[activeStoryIndex]._id, emoji)}
                                       className={`w-9 h-9 rounded-full border ${myReaction === emoji ? 'border-indigo-400 bg-indigo-500/20' : 'border-gray-700/60'} flex items-center justify-center text-lg`}
                                    >
                                       {emoji}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        );
                     })()}
                     {activeStoryGroup.userId === currentUser?.id && (
                        <div className="mt-2 rounded-xl border border-gray-800/60 bg-gray-900/60 p-3">
                           <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-400 uppercase tracking-widest">Views</p>
                              <span className="text-xs text-gray-300">
                                 {(activeStoryGroup.stories[activeStoryIndex]?.viewedBy || []).filter(id => id !== currentUser?.id).length}
                              </span>
                           </div>
                           <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                              {(activeStoryGroup.stories[activeStoryIndex]?.viewedBy || [])
                                 .filter(id => id !== currentUser?.id)
                                 .map((id) => {
                                    const viewer = users.find(u => u._id === id);
                                    const viewerReaction = (activeStoryGroup.stories[activeStoryIndex]?.reactions || [])
                                       .find(r => r.userId === id)?.emoji;
                                    return (
                                       <div key={`viewer-${id}`} className="flex items-center gap-2 text-xs text-gray-300">
                                          <div className="w-6 h-6 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white text-[10px] font-bold flex items-center justify-center overflow-hidden">
                                             {viewer?.avatar ? (
                                                <Image src={viewer.avatar} alt={viewer.username} width={24} height={24} className="w-full h-full object-cover" />
                                             ) : (
                                                (viewer?.username || 'U').charAt(0).toUpperCase()
                                             )}
                                          </div>
                                          <span className="truncate">{viewer?.username || id}</span>
                                          {viewerReaction && (
                                             <span className="ml-auto text-sm">{viewerReaction}</span>
                                          )}
                                       </div>
                                    );
                                 })}
                              {(activeStoryGroup.stories[activeStoryIndex]?.viewedBy || []).filter(id => id !== currentUser?.id).length === 0 && (
                                 <div className="text-xs text-gray-500">No views yet.</div>
                              )}
                           </div>
                        </div>
                     )}
                     <div className="flex items-center justify-between">
                        <button
                           onClick={() => setActiveStoryIndex((prev) => Math.max(prev - 1, 0))}
                           disabled={activeStoryIndex === 0}
                           className={`px-3 py-1.5 rounded-lg text-xs ${activeStoryIndex === 0 ? 'bg-gray-700 text-gray-400' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                        >
                           Prev
                        </button>
                        <div className="text-[11px] text-gray-400">
                           {activeStoryIndex + 1} / {activeStoryGroup.stories.length}
                        </div>
                        <button
                           onClick={() => setActiveStoryIndex((prev) => Math.min(prev + 1, activeStoryGroup.stories.length - 1))}
                           disabled={activeStoryIndex >= activeStoryGroup.stories.length - 1}
                           className={`px-3 py-1.5 rounded-lg text-xs ${activeStoryIndex >= activeStoryGroup.stories.length - 1 ? 'bg-gray-700 text-gray-400' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                        >
                           Next
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
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
          animation: fadeIn 0.5s ease-out;
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out forwards;
          opacity: 0;
        }
        
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .settings-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .settings-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .settings-scroll::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.6);
          border-radius: 999px;
        }

        .settings-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.8);
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
      `}</style>
      </div>
   );
}
