'use client';

import { useState, useEffect, useRef } from 'react';
import { Call } from '@/types';

interface CurrentUser {
  id: string;
  username: string;
  email: string;
}

interface CallModalProps {
  call: Call;
  currentUser: CurrentUser;
  selectedUser: { username: string } | null;
  isInCall: boolean;
  onCallEnd: () => void;
}

export default function CallModal({
  call,
  currentUser,
  selectedUser,
  isInCall,
  onCallEnd
}: CallModalProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [, setRemoteStream] = useState<MediaStream | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'incoming' | 'ringing' | 'connecting' | 'connected' | 'ended'>(
    call.receiverId === currentUser.id ? 'incoming' : 'ringing'
  );
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const ringingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const startRinging = () => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    
    audioContextRef.current = new AudioContextClass();
    gainNodeRef.current = audioContextRef.current.createGain();
    if (audioContextRef.current && gainNodeRef.current) {
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    
    let isRinging = true;
    
    const playRing = () => {
      if (!isRinging || !audioContextRef.current) return;
      
      const oscillator = audioContextRef.current.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContextRef.current.currentTime);
      oscillator.connect(gainNodeRef.current!);
      
      oscillator.start();
      oscillator.stop(audioContextRef.current.currentTime + 0.5);
    };
    
    playRing();
    ringingIntervalRef.current = setInterval(playRing, 1500);
    
    return () => {
      isRinging = false;
    };
  };

  const stopRinging = () => {
    if (ringingIntervalRef.current) {
      clearInterval(ringingIntervalRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    stopRinging();
  };

  useEffect(() => {
    if (isInCall && callStatus === 'connecting') {
      initializeCall();
    }

    // Start ringing for incoming or outgoing calls
    if (isInCall && (callStatus === 'incoming' || callStatus === 'ringing')) {
      startRinging();
    } else {
      stopRinging();
    }

    const statusPollingInterval = setInterval(async () => {
      if (call.callerId === currentUser.id && callStatus === 'ringing') {
        try {
          const response = await fetch(`/api/calls/${call._id}`, {
            headers: {
              'x-user-id': currentUser.id
            }
          });
          const data = await response.json();
          
          if (data.call && data.call.status === 'accepted') {
            setCallStatus('connecting');
          } else if (data.call && (data.call.status === 'rejected' || data.call.status === 'ended')) {
            setCallStatus('ended');
            onCallEnd();
          }
        } catch (error) {
          console.error('Error polling call status:', error);
        }
      }
    }, 1000);

    return () => {
      cleanup();
      clearInterval(statusPollingInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInCall, callStatus]);

  const initializeCall = async () => {
    try {
      setCallError(null);
      const constraints = {
        audio: true,
        video: call.type === 'video'
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      await setupPeerConnection(stream);
      
      if (call.callerId === currentUser.id) {
        await createOffer();
      } else {
        startPollingForSignals();
      }
      setCallStatus('connecting');
    } catch (error) {
      console.error('Error initializing call:', error);
      const err = error as { name?: string; message?: string };
      if (err?.name === 'NotFoundError') {
        setCallError(call.type === 'video'
          ? 'لم يتم العثور على كاميرا أو ميكروفون على هذا الجهاز.'
          : 'لم يتم العثور على ميكروفون على هذا الجهاز.');
      } else if (err?.name === 'NotAllowedError') {
        setCallError('تم رفض صلاحية الوصول للكاميرا أو الميكروفون.');
      } else {
        setCallError('حدث خطأ أثناء تشغيل الكاميرا/الميكروفون.');
      }
      setCallStatus('ended');
      setTimeout(() => {
        onCallEnd();
      }, 2500);
    }
  };

  const setupPeerConnection = async (stream: MediaStream) => {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await sendSignal('ice-candidate', event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setCallStatus('ended');
      }
    };
  };

  const createOffer = async () => {
    if (!peerConnectionRef.current) return;

    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
    await sendSignal('offer', offer);
    startPollingForSignals();
  };

  const createAnswer = async () => {
    if (!peerConnectionRef.current) return;

    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    await sendSignal('answer', answer);
    setCallStatus('connecting');
  };

  const sendSignal = async (type: 'offer' | 'answer' | 'ice-candidate', data: RTCSessionDescriptionInit | RTCIceCandidateInit) => {
    try {
      await fetch('/api/webrtc/signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          callId: call._id,
          senderId: currentUser.id,
          receiverId: call.callerId === currentUser.id ? call.receiverId : call.callerId,
          data
        })
      });
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  };

  const startPollingForSignals = () => {
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/webrtc/signal?callId=${call._id}&userId=${currentUser.id}`
        );
        const data = await response.json();

        for (const signal of data.signals) {
          await handleSignal(signal);
        }
      } catch (error) {
        console.error('Error polling for signals:', error);
      }
    }, 1000);
  };

  const handleSignal = async (signal: { type: string; data: RTCSessionDescriptionInit | RTCIceCandidateInit }) => {
    if (!peerConnectionRef.current || peerConnectionRef.current.signalingState === 'closed') return;

    try {
      if (signal.type === 'offer') {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
        );
        await createAnswer();
        await updateCallStatus('accepted');
      } else if (signal.type === 'answer') {
        if ((peerConnectionRef.current.signalingState as any) !== 'closed') {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
          );
        }
      } else if (signal.type === 'ice-candidate') {
        if ((peerConnectionRef.current.signalingState as any) !== 'closed') {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(signal.data as RTCIceCandidateInit)
          );
        }
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  };

  const updateCallStatus = async (status: string) => {
    try {
      await fetch(`/api/calls/${call._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ status })
      });
    } catch (error) {
      console.error('Error updating call status:', error);
    }
  };

  const handleAcceptCall = async () => {
    setCallStatus('connecting');
    await initializeCall();
    await updateCallStatus('accepted');
  };

  const handleRejectCall = async () => {
    await updateCallStatus('rejected');
    setCallStatus('ended');
    onCallEnd();
  };

  const handleEndCall = async () => {
    await updateCallStatus('ended');
    setCallStatus('ended');
    onCallEnd();
  };

  if (callStatus === 'ended' && !callError) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <div className="bg-gray-900 rounded-lg overflow-hidden w-full max-w-4xl h-150 flex flex-col relative">
        {callError && (
          <div className="absolute top-4 right-4 z-60 bg-gray-900/90 border border-amber-400/40 text-amber-300 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md text-sm max-w-xs animate-slideDown">
            {callError}
          </div>
        )}
        {callStatus === 'incoming' ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8">
            <div className="w-24 h-24 rounded-full bg-indigo-500 flex items-center justify-center text-white text-4xl font-bold">
              {selectedUser?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-2">
                {selectedUser?.username || 'Unknown'}
              </h2>
              <p className="text-gray-400">
                {call.type === 'video' ? 'Video' : 'Voice'} Call
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={handleRejectCall}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptCall}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors"
              >
                Accept
              </button>
            </div>
          </div>
        ) : callStatus === 'ringing' ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8">
            <div className="w-24 h-24 rounded-full bg-indigo-500 flex items-center justify-center text-white text-4xl font-bold">
              {selectedUser?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-2">
                {selectedUser?.username || 'Unknown'}
              </h2>
              <p className="text-gray-400 animate-pulse">
                {call.type === 'video' ? 'Video' : 'Voice'} Call
              </p>
              <p className="text-indigo-400 mt-2 animate-pulse">Ringing...</p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={handleEndCall}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
              >
                End Call
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 relative bg-black">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {call.type === 'video' && localStream && (
                <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-gray-700">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="absolute top-4 left-4 bg-black bg-opacity-50 px-4 py-2 rounded-lg">
                <p className="text-white font-semibold">
                  {selectedUser?.username || 'Unknown'}
                </p>
                <p className="text-gray-300 text-sm">
                  {callStatus === 'connecting' ? 'Connecting...' : 'Connected'}
                </p>
              </div>
            </div>
            <div className="bg-gray-800 px-6 py-4 flex justify-center space-x-4">
              <button
                onClick={handleEndCall}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors flex items-center space-x-2"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 8l2-2m0 0l2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
                  />
                </svg>
                <span>End Call</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
