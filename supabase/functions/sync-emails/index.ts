// Supabase Edge Function to trigger email sync every hour
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

console.log("Email sync cron function started")

Deno.serve(async (req) => {
  try {
    console.log('🔄 Triggering email sync...')

    // Get environment variables
    const nextjsUrl = Deno.env.get('NEXTJS_URL') || 'https://your-app.vercel.app'
    const cronSecret = Deno.env.get('CRON_SECRET')

    if (!cronSecret) {
      throw new Error('CRON_SECRET not configured')
    }

    // Call your Next.js API endpoint to do the actual sync
    const response = await fetch(`${nextjsUrl}/api/cron/sync-emails`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`)
    }

    const result = await response.json()

    console.log('✅ Email sync completed:', result)

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('❌ Error in sync-emails function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
