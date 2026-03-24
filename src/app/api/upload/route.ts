import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

const buildSignature = (params: Record<string, string>) => {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto
    .createHash('sha1')
    .update(sorted + CLOUDINARY_API_SECRET)
    .digest('hex');
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return NextResponse.json(
        { error: 'Cloudinary config missing' },
        { status: 500 }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = 'az-chat';
    const signature = buildSignature({ folder, timestamp });

    const uploadForm = new FormData();
    uploadForm.append('file', file);
    uploadForm.append('api_key', CLOUDINARY_API_KEY);
    uploadForm.append('timestamp', timestamp);
    uploadForm.append('folder', folder);
    uploadForm.append('signature', signature);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
      {
        method: 'POST',
        body: uploadForm
      }
    );
    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      return NextResponse.json(
        { error: uploadData?.error?.message || 'Upload failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fileUrl: uploadData.secure_url,
      filename: uploadData.original_filename,
      fileSize: uploadData.bytes
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
