'use client';

import { useState } from 'react';
import Image from 'next/image';
import { User } from '@/types';
import { FiSearch, FiLock, FiTag, FiCheck } from 'react-icons/fi';

interface UserListProps {
  users: User[];
  selectedUser: User | null;
  onSelectUser: (user: User) => void;
  unreadCounts?: Record<string, number>;
  pinnedPreviews?: Record<string, { messageId: string; content: string }[]>;
  mutedChats?: Record<string, boolean>;
  lockedChats?: Record<string, boolean>;
  labels?: Array<{ id: string; name: string; color: string }>;
  userLabels?: Record<string, string[]>;
  onToggleUserLabel?: (userId: string, labelId: string) => void;
  onMarkAllRead?: () => void;
  isDarkMode?: boolean;
}

export default function UserList({
  users,
  selectedUser,
  onSelectUser,
  unreadCounts = {},
  pinnedPreviews = {},
  mutedChats = {},
  lockedChats = {},
  labels = [],
  userLabels = {},
  onToggleUserLabel,
  onMarkAllRead,
  isDarkMode = true
}: UserListProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [labelMenuUserId, setLabelMenuUserId] = useState<string | null>(null);
  
  // Theme configuration
  const theme = {
    text: {
      primary: isDarkMode ? 'text-white' : 'text-gray-900',
      secondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
      muted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
      accent: isDarkMode ? 'text-indigo-300' : 'text-indigo-600'
    },
    bg: {
      input: isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-900',
      hover: isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100',
      active: isDarkMode ? 'bg-gray-700/70' : 'bg-gray-100',
      card: isDarkMode ? 'bg-gray-800/50' : 'bg-white'
    },
    border: {
      default: isDarkMode ? 'border-gray-700' : 'border-gray-200',
      divider: isDarkMode ? 'divide-gray-800' : 'divide-gray-100'
    }
  };

  // Filter users
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper function to get user status
  const getUserStatus = (userId: string) => {
    const unread = unreadCounts[userId] || 0;
    const isMuted = mutedChats[userId];
    const isLocked = lockedChats[userId];
    const user = users.find(u => u._id === userId);
    
    if (unread > 0) return { type: 'unread', value: unread, label: 'New' };
    if (isMuted) return { type: 'muted', value: null, label: 'Muted' };
    if (isLocked) return { type: 'locked', value: null, label: 'Locked' };
    if (user?.isOnline) return { type: 'online', value: null, label: 'Online' };
    return null;
  };

  // Loading state
  if (!users || !Array.isArray(users)) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className={`px-4 py-8 text-center ${theme.text.muted}`}>
          Loading users...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header Section */}
      <div className="sticky top-0 z-10 bg-inherit px-4 pt-4 pb-2 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className={`w-full rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500 ${theme.bg.input} ${theme.border.default} border`}
          />
        </div>

        {/* Title Bar */}
        <div className="flex items-center justify-between">
          <h2 className={`text-xs font-semibold uppercase tracking-wider ${theme.text.secondary}`}>
            All Chats
            <span className="ml-2 text-[10px] text-gray-500">
              ({filteredUsers.length})
            </span>
          </h2>
          {onMarkAllRead && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <div className={`px-4 py-12 text-center ${theme.text.muted}`}>
          <div className="text-4xl mb-2">👥</div>
          <p className="text-sm">No users found</p>
          <p className="text-xs mt-1">Try a different search term</p>
        </div>
      ) : (
        <ul className={`divide-y ${theme.border.divider}`}>
          {filteredUsers.map((user) => {
            const userId = user._id || '';
            const unread = unreadCounts[userId] || 0;
            const preview = pinnedPreviews[userId]?.[0]?.content;
            const userLabelsList = userLabels[userId] || [];
            const status = getUserStatus(userId);
            const isSelected = selectedUser?._id === userId;

            return (
              <li
                key={userId}
                onClick={() => onSelectUser(user)}
                className={`
                  px-4 py-3 cursor-pointer transition-all duration-200
                  ${theme.bg.hover}
                  ${isSelected ? theme.bg.active : ''}
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar Section */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold overflow-hidden shadow-lg">
                      {user.avatar ? (
                        <Image
                          src={user.avatar}
                          alt={user.username}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    {/* Online Indicator */}
                    {user.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-900" />
                    )}
                    
                    {/* Unread Badge */}
                    {unread > 0 && (
                      <div className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg">
                        {unread > 99 ? '99+' : unread}
                      </div>
                    )}
                  </div>

                  {/* User Info Section */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className={`text-sm font-semibold truncate ${theme.text.primary}`}>
                          {user.username}
                        </p>
                        {lockedChats[userId] && (
                          <FiLock className="text-xs text-amber-400 shrink-0" title="Encrypted chat" />
                        )}
                      </div>
                      
                      {/* Status Badge */}
                      {status && (
                        <span className={`
                          text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0
                          ${status.type === 'unread' ? 'bg-rose-500/20 text-rose-400' : ''}
                          ${status.type === 'muted' ? 'bg-gray-500/20 text-gray-400' : ''}
                          ${status.type === 'locked' ? 'bg-amber-500/20 text-amber-400' : ''}
                          ${status.type === 'online' ? 'bg-green-500/20 text-green-400' : ''}
                        `}>
                          {status.label}
                        </span>
                      )}
                    </div>

                    {/* Email */}
                    <p className={`text-xs truncate ${theme.text.secondary}`}>
                      {user.email}
                    </p>

                    {/* Status Message */}
                    {user.statusMessage && (
                      <p className={`text-[11px] truncate mt-1 ${theme.text.accent}`}>
                        💬 {user.statusMessage}
                      </p>
                    )}

                    {/* Pinned Message Preview */}
                    {preview && (
                      <p className={`text-[11px] truncate mt-1 flex items-center gap-1 text-amber-400`}>
                        <span>📌</span>
                        <span>{preview}</span>
                      </p>
                    )}

                    {/* Labels Section */}
                    {userLabelsList.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {userLabelsList.map((labelId) => {
                          const label = labels.find(l => l.id === labelId);
                          if (!label) return null;
                          return (
                            <span
                              key={labelId}
                              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: `${label.color}20`,
                                color: label.color,
                                border: `1px solid ${label.color}40`
                              }}
                            >
                              {label.name}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Labels Menu Button */}
                    {labels.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLabelMenuUserId(prev => prev === userId ? null : userId);
                          }}
                          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-indigo-400 transition-colors"
                        >
                          <FiTag className="text-[10px]" />
                          <span>Manage labels</span>
                        </button>

                        {/* Labels Dropdown */}
                        {labelMenuUserId === userId && (
                          <div className={`
                            mt-2 p-2 rounded-lg border shadow-lg animate-in fade-in zoom-in-95 duration-200
                            ${theme.bg.card} ${theme.border.default}
                          `}>
                            <p className="text-[10px] font-medium text-gray-400 mb-2">Add labels</p>
                            <div className="flex flex-wrap gap-1.5">
                              {labels.map((label) => {
                                const isActive = userLabelsList.includes(label.id);
                                return (
                                  <button
                                    key={label.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleUserLabel?.(userId, label.id);
                                    }}
                                    className={`
                                      text-[10px] px-2 py-1 rounded-full transition-all flex items-center gap-1
                                      ${isActive ? 'text-white' : 'text-gray-300'}
                                    `}
                                    style={{
                                      backgroundColor: isActive ? label.color : `${label.color}20`,
                                      border: `1px solid ${label.color}`
                                    }}
                                  >
                                    {isActive && <FiCheck className="text-[8px]" />}
                                    {label.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}