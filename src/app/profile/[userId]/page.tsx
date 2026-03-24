'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  FiGlobe,
  FiLink,
  FiFacebook,
  FiInstagram,
  FiTwitter,
  FiLinkedin,
  FiGithub,
  FiYoutube,
  FiPhone,
  FiCalendar,
  FiUsers,
  FiLock,
  FiEye,
  FiCheckCircle,
  FiClock,
  FiUserPlus,
  FiUserCheck,
  FiShield
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

type ProfileData = {
  title: string;
  bio: string;
  phones: string[];
  socials: Array<{ label: string; url: string; icon?: string }>;
};

export default function ProfilePage() {
  const params = useParams();
  const userId = (params?.userId as string) || '';
  const [data, setData] = useState<ProfileData | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [requested, setRequested] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private' | 'custom'>('public');
  const [isFollower, setIsFollower] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [username, setUsername] = useState('User');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [memberSince, setMemberSince] = useState('');

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
    const current = localStorage.getItem('currentUser');
    const currentUser = current ? JSON.parse(current) as { id: string } : null;
    if (!currentUser?.id || !userId) {
      setIsLoading(false);
      return;
    }
    
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/users/profile?userId=${userId}`, {
          headers: { 'x-user-id': currentUser.id },
          cache: 'no-store'
        });
        const result = await res.json();
        setAllowed(Boolean(result?.allowed));
        setRequested(Boolean(result?.requested));
        setVisibility(result?.visibility || 'public');
        setIsFollower(Boolean(result?.isFollower));
        setIsSelf(Boolean(result?.isSelf));
        if (result?.profile) setData(result.profile);

        // fetch basic user
        const usersRes = await fetch('/api/users', { headers: { 'x-user-id': currentUser.id } });
        const usersData = await usersRes.json();
        const user = (usersData?.users || []).find((u: { _id: string }) => u._id === userId);
        if (user) {
          setUsername(user.username || 'User');
          setAvatar(user.avatar || null);
          const followersLen = Array.isArray(user.followers) ? user.followers.length : 0;
          const followingLen = Array.isArray(user.following) ? user.following.length : 0;
          setFollowersCount(user.followersCount ?? followersLen);
          setFollowingCount(user.followingCount ?? followingLen);
          setMemberSince(user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
          }) : '');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [userId]);

  const requestAccess = async () => {
    const current = localStorage.getItem('currentUser');
    const currentUser = current ? JSON.parse(current) as { id: string } : null;
    if (!currentUser?.id) return;
    
    try {
      await fetch('/api/users/follow/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ targetUserId: userId })
      });
      setRequested(true);
    } catch (error) {
      console.error('Error requesting access:', error);
    }
  };

  const cancelRequest = async () => {
    const current = localStorage.getItem('currentUser');
    const currentUser = current ? JSON.parse(current) as { id: string } : null;
    if (!currentUser?.id) return;
    try {
      await fetch('/api/users/follow/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ targetUserId: userId })
      });
      setRequested(false);
    } catch (error) {
      console.error('Error cancelling request:', error);
    }
  };

  const toggleFollow = async () => {
    const current = localStorage.getItem('currentUser');
    const currentUser = current ? JSON.parse(current) as { id: string } : null;
    if (!currentUser?.id) return;
    try {
      await fetch('/api/users/follow/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ targetUserId: userId, action: isFollower ? 'unfollow' : 'follow' })
      });
      setIsFollower(prev => !prev);
      setFollowersCount(prev => Math.max(0, prev + (isFollower ? -1 : 1)));
    } catch (error) {
      console.error('Toggle follow error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
            <FiUsers className="text-white text-2xl" />
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <FiClock className="animate-spin" />
            <span>Loading profile...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-950 via-gray-900 to-gray-950 text-white relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-4000" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Profile header with glass effect */}
        <div className="bg-gray-900/40 backdrop-blur-xl rounded-3xl border border-gray-800/50 p-6 sm:p-8 shadow-2xl animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar with glow effect */}
            <div className="relative group">
              <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-purple-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity duration-300" />
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden ring-4 ring-indigo-500/30 group-hover:ring-indigo-400 transition-all duration-300">
                {avatar ? (
                  <Image 
                    src={avatar} 
                    alt={username} 
                    width={112} 
                    height={112} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl sm:text-4xl font-bold text-white">
                    {username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {visibility !== 'public' && (
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center">
                  {visibility === 'private' ? (
                    <FiLock className="text-amber-400 text-sm" />
                  ) : (
                    <FiUsers className="text-indigo-400 text-sm" />
                  )}
                </div>
              )}
            </div>

            {/* User info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold bg-linear-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  {username}
                </h1>
                {visibility === 'public' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">
                    <FiEye className="text-xs" />
                    Public profile
                  </span>
                )}
              </div>

              {!isSelf && visibility === 'public' && (
                <div className="mb-3">
                  <button
                    onClick={toggleFollow}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 ${
                      isFollower
                        ? 'bg-gray-800/80 text-gray-200 border border-gray-700/60'
                        : 'bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                    }`}
                  >
                    {isFollower ? (
                      <>
                        <FiUserCheck className="text-base" />
                        Following
                      </>
                    ) : (
                      <>
                        <FiUserPlus className="text-base" />
                        Follow
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {data?.title && (
                <div className="text-gray-400 text-sm sm:text-base mb-4 flex items-center justify-center sm:justify-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-indigo-500" />
                  {data.title}
                </div>
              )}

              {/* Stats */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <FiUsers className="text-indigo-400" />
                  <span className="text-white font-medium">{followersCount}</span>
                  <span>Followers</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-gray-700" />
                <div className="flex items-center gap-2 text-gray-400">
                  <FiUserCheck className="text-indigo-400" />
                  <span className="text-white font-medium">{followingCount}</span>
                  <span>Following</span>
                </div>
                {memberSince && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-gray-700" />
                    <div className="flex items-center gap-2 text-gray-400">
                      <FiCalendar className="text-indigo-400" />
                      <span>Member since {memberSince}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Profile content */}
          <div className="mt-8">
            {allowed && data ? (
              <div className="space-y-6 animate-slideUp">
                {/* Bio */}
                {data.bio && (
                  <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-800/50">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-indigo-500" />
                      About
                    </h3>
                    <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                      {data.bio}
                    </p>
                  </div>
                )}

                {/* Phones */}
                {data.phones?.length > 0 && (
                  <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-800/50">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-indigo-500" />
                      Contact
                    </h3>
                    <div className="space-y-2">
                      {data.phones.map((phone, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                            <FiPhone className="text-indigo-400 text-sm" />
                          </div>
                          <a href={`tel:${phone}`} className="text-indigo-300 hover:text-indigo-200 transition-colors">
                            {phone}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Links */}
                {data.socials?.length > 0 && (
                  <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-800/50">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-indigo-500" />
                      Social Links
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {data.socials.map((s, idx) => {
                        const Icon = getSocialIcon(s.icon);
                        return (
                          <a
                            key={`${s.url}-${idx}`}
                            href={formatSocialUrl(s.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl transition-all duration-200 hover:scale-105 border border-gray-700/50"
                          >
                            <div className="w-10 h-10 rounded-lg bg-linear-to-br from-indigo-500/20 to-purple-600/20 group-hover:from-indigo-500/30 group-hover:to-purple-600/30 flex items-center justify-center transition-all duration-200">
                              <Icon className="text-indigo-400 group-hover:text-indigo-300 text-lg" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{s.label || 'Link'}</p>
                              <p className="text-xs text-gray-500 truncate">{s.url}</p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-8 border border-gray-800/50 text-center animate-fadeIn">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-linear-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center">
                  {visibility === 'private' ? (
                    <FiShield className="text-amber-400 text-3xl" />
                  ) : (
                    <FiUsers className="text-indigo-400 text-3xl" />
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-2">
                  {visibility === 'private' ? 'Private Profile' : 'Limited Access'}
                </h3>
                
                <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                  {visibility === 'private' 
                    ? 'This profile is private. You need to send an access request to view their information.'
                    : 'This profile is only visible to approved followers. Send a request to connect.'}
                </p>

                {visibility !== 'public' && (
                  <button
                    onClick={requested ? cancelRequest : requestAccess}
                    className={`
                      inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm
                      transition-all duration-200 transform hover:scale-105
                      ${requested 
                        ? 'bg-gray-800/80 text-gray-200 border border-gray-700/60'
                        : 'bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30'
                      }
                    `}
                  >
                    {requested ? (
                      <>
                        <FiCheckCircle className="text-lg" />
                        Cancel Request
                      </>
                    ) : (
                      <>
                        <FiUserPlus className="text-lg" />
                        Request Access
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-gray-800/50 flex items-center justify-center gap-2 text-xs text-gray-600">
            <FiShield className="text-xs" />
            <span>Profile information is protected</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.6s ease-out;
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
