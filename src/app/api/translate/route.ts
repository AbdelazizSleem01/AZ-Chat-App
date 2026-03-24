import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = typeof body?.text === 'string' ? body.text : '';
    const target = typeof body?.target === 'string' ? body.target : 'en';
    const source = typeof body?.source === 'string' ? body.source : 'auto';

    if (!text.trim()) {
      return NextResponse.json({ translatedText: '' }, { status: 400 });
    }
    if (source !== 'auto' && source === target) {
      return NextResponse.json({ translatedText: text });
    }

    const endpoints = [
      'https://translate.googleapis.com/translate_a/single?client=gtx',
      process.env.TRANSLATE_ENDPOINT,
      'https://libretranslate.de/translate',
      'https://libretranslate.com/translate',
      'https://translate.argosopentech.com/translate'
    ].filter(Boolean) as string[];

    for (const endpoint of endpoints) {
      try {
        const isGooglePublic = endpoint.includes('translate.googleapis.com/translate_a/single');
        const response = await fetch(
          isGooglePublic
            ? `${endpoint}&sl=${encodeURIComponent(source === 'auto' ? 'auto' : source)}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`
            : endpoint,
          isGooglePublic
            ? { cache: 'no-store' }
            : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                q: text,
                source,
                target,
                format: 'text'
              }),
              cache: 'no-store'
            }
        );

        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        const translatedText = isGooglePublic
          ? (Array.isArray(data?.[0]) ? data[0].map((chunk: unknown[]) => chunk?.[0]).join('') : '')
          : (typeof data?.translatedText === 'string' ? data.translatedText : '');
        if (translatedText.trim()) {
          return NextResponse.json({ translatedText });
        }
      } catch {
        continue;
      }
    }

    // Fallback: MyMemory (free, no key) via GET
    try {
      const fixedSource = source === 'auto' ? 'en' : source;
      if (fixedSource === target) {
        return NextResponse.json({ translatedText: text });
      }
      const langpair = `${fixedSource}|${target}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        const translatedText = data?.responseData?.translatedText;
        if (typeof translatedText === 'string' && translatedText.trim()) {
          return NextResponse.json({ translatedText });
        }
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ translatedText: '', error: 'Translation failed' });
  } catch (error) {
    console.error('Translate error:', error);
    return NextResponse.json({ translatedText: '', error: 'Translation failed' });
  }
}
