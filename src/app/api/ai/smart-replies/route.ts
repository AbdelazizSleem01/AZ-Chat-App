import { NextRequest, NextResponse } from 'next/server';

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    if (!message) return NextResponse.json({ replies: [] });

    // 1. Try Real AI (Gemini) if API key exists
    if (process.env.GOOGLE_GENAI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" }, { apiVersion: 'v1' });


        const prompt = `You are a helpful chat assistant. Given the user message: "${message}", generate 3 extremely short and helpful smart reply suggestions (max 3 words each) in the same language as the message. Return them as a JSON array of strings only. Do not add any explanation. Example: ["مرحباً!", "كيف حالك؟", "أهلاً بك."]`;
        
        const result = await model.generateContent(prompt);

        const text = result.response.text();
        const cleaned = text.replace(/```json|```/g, '').trim();
        const aiReplies = JSON.parse(cleaned);
        
        if (Array.isArray(aiReplies)) {
          return NextResponse.json({ replies: aiReplies });
        }
      } catch (e) {
        console.error("Gemini failed, falling back to local engine", e);
      }
    }

    // 2. Local Fallback Engine (Advanced NLP rules)
    const content = message.toLowerCase().trim();
    const findReplies = () => {
      if (content.match(/سلام|أهلا|مرحبا/)) return ['وعليكم السلام يا غالي', 'أهلاً بك! 👋', 'مرحباً!'];
      if (content.match(/كيفك|اخبارك|عامل ايه/)) return ['بخير والحمد لله', 'تمام جداً، كلك ذوق', 'بأحسن حال، شكراً!'];
      if (content.match(/سعر|بكام|كم/)) return ['الأسعار تبدأ من ١٠ دولار', 'راجع صفحة الباقات', 'تواصل مع المبيعات'];
      if (content.match(/شكرا|تسلم/)) return ['العفو، في الخدمة!', 'لا شكر على واجب', 'على الرحب والسعة ❤️'];
      if (content.match(/\?|؟/)) return ['ممكن توضح أكثر؟', 'سأرد عليك خلال دقائق', 'سؤال جيد!'];
      
      const pools = [
        ['أتفق معك تماماً.', 'فهمت وجهة نظرك.', 'كلام سليم ١٠٠٪.'],
        ['جميل جداً، واصل!', 'رائع حقاً.', 'أوكي، علم.']
      ];
      return pools[Math.floor(Math.random() * pools.length)];
    }

    return NextResponse.json({ replies: findReplies() });
  } catch (error) {
    return NextResponse.json({ error: 'AI Error' }, { status: 500 });
  }
}

