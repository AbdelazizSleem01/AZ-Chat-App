import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { User } from '@/types';

const getUserById = async (db: ReturnType<typeof getDb> extends Promise<infer T> ? T : never, id: string) => {
  const usersCollection = db.collection<User>('users');
  if (ObjectId.isValid(id)) {
    const byObj = await usersCollection.findOne({ _id: new ObjectId(id) } as never);
    if (byObj) return byObj;
  }
  return usersCollection.findOne({ _id: id } as never);
};

export async function GET(request: NextRequest) {
  try {
    const viewerId = request.headers.get('x-user-id');
    if (!viewerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get('userId') || viewerId;

    const db = await getDb();
    const user = await getUserById(db, targetId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isSelf = String(user._id) === viewerId || targetId === viewerId;
    const visibility = user.bioVisibility || 'public';
    const followers = user.followers || [];
    const allowedUserIds = user.allowedUserIds || [];
    const requested = (user.followRequests || []).includes(viewerId);
    const isFollower = followers.includes(viewerId);

    let allowed = false;
    if (isSelf) allowed = true;
    else if (visibility === 'public') allowed = true;
    else if (visibility === 'followers' && isFollower) allowed = true;
    else if (visibility === 'custom' && allowedUserIds.includes(viewerId)) allowed = true;
    else if (visibility === 'private' && allowedUserIds.includes(viewerId)) allowed = true;

    return NextResponse.json({
      allowed,
      requested,
      isFollower,
      isSelf,
      visibility,
      profile: allowed
        ? {
          title: user.profileTitle || '',
          statusMessage: user.statusMessage || '',
          bio: user.bio || '',
          phones: user.phones || [],
          socials: user.socials || []
        }
        : null,
      followRequests: isSelf ? (user.followRequests || []) : undefined,
      allowedUserIds: isSelf ? (user.allowedUserIds || []) : undefined,
      followers: isSelf ? (user.followers || []) : undefined,
      following: isSelf ? (user.following || []) : undefined
    });
  } catch (error) {
    console.error('Profile get error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const {
      title,
      statusMessage,
      bio,
      phones,
      socials,
      bioVisibility,
      allowedUserIds
    } = body;

    const update: Partial<User> = {
      profileTitle: typeof title === 'string' ? title : '',
      statusMessage: typeof statusMessage === 'string' ? statusMessage : '',
      bio: typeof bio === 'string' ? bio : '',
      phones: Array.isArray(phones) ? phones.filter((p: string) => typeof p === 'string' && p.trim()) : [],
      socials: Array.isArray(socials)
        ? socials
          .filter((s: { label?: string; url?: string; icon?: string }) => typeof s?.label === 'string' && typeof s?.url === 'string')
          .map((s: { label: string; url: string; icon?: string }) => ({
            label: s.label.trim(),
            url: s.url.trim(),
            icon: typeof s.icon === 'string' ? s.icon.trim() : ''
          }))
        : [],
      bioVisibility: ['public', 'followers', 'private', 'custom'].includes(bioVisibility) ? bioVisibility : 'public',
      allowedUserIds: Array.isArray(allowedUserIds) ? allowedUserIds : []
    };

    const db = await getDb();
    const usersCollection = db.collection<User>('users');
    await usersCollection.updateOne(
      ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } as never : { _id: userId } as never,
      { $set: update }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
