import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import OpenAI from 'npm:openai@4.28.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Get the JWT token
    const token = authHeader.replace('Bearer ', '')
    
    // Get the user from the token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      throw new Error('Invalid token')
    }

    // Get request body
    const { prompt, options = {} } = await req.json()

    if (!prompt) {
      throw new Error('Prompt is required')
    }

    // Store generation request
    const { data: request, error: requestError } = await supabase
      .from('caption_generations')
      .insert({
        user_id: user.id,
        prompt,
        options,
        status: 'pending'
      })
      .select()
      .single()

    if (requestError) throw requestError

    // Generate caption with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: options.language === 'hi' 
            ? "आप एक एक्सपर्ट इंस्टाग्राम कंटेंट क्रिएटर हैं जो आकर्षक हिंदी कैप्शन लिखने में माहिर हैं। कैप्शन में इमोजी का उचित प्रयोग करें और इंस्टाग्राम के लिए ऑप्टिमाइज़ करें।"
            : "You are an expert Instagram content creator who specializes in writing engaging captions. Create captions that are authentic, engaging, and optimized for Instagram. Always include relevant emojis and hashtags."
        },
        {
          role: "user",
          content: `Create an engaging Instagram caption about: ${prompt}\n\nTone: ${options?.tone || 'professional'}\nLength: ${options?.length || 'medium'}`
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    })

    const generatedCaption = completion.choices[0].message.content

    // Update request with result
    const { error: updateError } = await supabase
      .from('caption_generations')
      .update({
        status: 'completed',
        result: generatedCaption,
        completed_at: new Date().toISOString()
      })
      .eq('id', request.id)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ content: generatedCaption }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})