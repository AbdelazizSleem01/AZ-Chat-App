'use client';

import Image from 'next/image';
import { UserWithId } from '../types/chat';

type UserSidebarProps = {
  users: UserWithId[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  loading: boolean;
};

export default function UserSidebar({ users, selectedUserId, onSelectUser, loading }: UserSidebarProps) {
  return (
    <aside className="w-full border-r border-gray-800 bg-gray-900 md:w-80">
      <div className="border-b border-gray-800 px-4 py-4">
        <h1 className="text-lg font-semibold text-white">AZ Chat</h1>
      </div>
      <div className="max-h-[calc(100vh-5rem)] overflow-y-auto p-2">
        {loading ? (
          <p className="px-3 py-5 text-sm text-gray-400">جاري تحميل المستخدمين...</p>
        ) : users.length === 0 ? (
          <p className="px-3 py-5 text-sm text-gray-400">لا يوجد مستخدمون حالياً</p>
        ) : (
          users.map((user) => {
            const active = user._id === selectedUserId;
            return (
              <button
                key={user._id}
                type="button"
                onClick={() => onSelectUser(user._id)}
                className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                  active ? 'bg-indigo-600/25 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <div className="relative h-10 w-10 overflow-hidden rounded-full bg-gray-700">
                  {user.avatar ? (
                    <Image src={user.avatar} alt={user.username} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                      {user.username.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.username}</p>
                  <p className="truncate text-xs text-gray-400">{user.email}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
