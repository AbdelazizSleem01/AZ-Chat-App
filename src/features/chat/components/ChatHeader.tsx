'use client';

import Image from 'next/image';
import { UserWithId } from '../types/chat';

type ChatHeaderProps = {
  selectedUser: UserWithId | null;
};

export default function ChatHeader({ selectedUser }: ChatHeaderProps) {
  if (!selectedUser) {
    return (
      <header className="border-b border-gray-800 px-6 py-4 text-gray-300">
        اختر محادثة من القائمة لعرض الرسائل
      </header>
    );
  }

  return (
    <header className="flex items-center gap-3 border-b border-gray-800 px-6 py-4">
      <div className="relative h-10 w-10 overflow-hidden rounded-full bg-gray-800">
        {selectedUser.avatar ? (
          <Image src={selectedUser.avatar} alt={selectedUser.username} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
            {selectedUser.username.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-white">{selectedUser.username}</h2>
        <p className="text-xs text-gray-400">{selectedUser.statusMessage || 'متصل الآن'}</p>
      </div>
    </header>
  );
}
