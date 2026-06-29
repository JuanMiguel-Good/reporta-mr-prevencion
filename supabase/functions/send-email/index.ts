import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import * as nodemailer from 'npm:nodemailer@6.9.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailQueueItem {
  id: string;
  company_id: string;
  recipient_user_id: string;
  recipient_email: string;
  email_type: string;
  subject: string;
  html_body: string;
  data: any;
  retry_count: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const smtpHost = 'smtp.hostinger.com';
    const smtpPort = 465;
    const smtpUser = 'noreply@goodsolutions.app';
    const smtpPass = ']Na2;[FK9p';
    const smtpFrom = 'noreply@goodsolutions.app';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email_id } = await req.json();

    if (!email_id) {
      return new Response(
        JSON.stringify({ error: 'email_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: emailData, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('id', email_id)
      .eq('status', 'pending')
      .single();

    if (fetchError || !emailData) {
      return new Response(
        JSON.stringify({ error: 'Email not found or already processed' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const email = emailData as EmailQueueItem;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    let deliveryStatus = 'delivered';
    let smtpResponse = '';
    let errorMessage = null;

    try {
      const info = await transporter.sendMail({
        from: `"Reporta SST" <${smtpFrom}>`,
        to: email.recipient_email,
        subject: email.subject,
        html: email.html_body,
      });

      smtpResponse = info.response;

      await supabase
        .from('email_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', email.id);

      await supabase
        .from('email_delivery_status')
        .upsert({
          email_address: email.recipient_email,
          status: 'valid',
          last_successful_delivery: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'email_address',
        });

    } catch (sendError: any) {
      deliveryStatus = 'failed';
      errorMessage = sendError.message;
      smtpResponse = sendError.response || sendError.message;

      const isRateLimit = errorMessage?.toLowerCase().includes('ratelimit') ||
                         errorMessage?.toLowerCase().includes('rate limit') ||
                         errorMessage?.toLowerCase().includes('too many');

      const isPermanentError = errorMessage?.toLowerCase().includes('bounce') ||
                              errorMessage?.toLowerCase().includes('invalid') ||
                              errorMessage?.toLowerCase().includes('not found') ||
                              errorMessage?.toLowerCase().includes('does not exist') ||
                              errorMessage?.toLowerCase().includes('recipient rejected');

      if (isRateLimit) {
        const delayMinutes = 15;
        const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);

        await supabase
          .from('email_queue')
          .update({
            error_message: `Rate limit: ${errorMessage}`,
            scheduled_for: scheduledFor.toISOString(),
          })
          .eq('id', email.id);

        console.log(`Rate limited email ${email.id}, rescheduled for ${scheduledFor}`);

      } else if (isPermanentError) {
        await supabase
          .from('email_queue')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', email.id);

        const { data: existingStatus } = await supabase
          .from('email_delivery_status')
          .select('bounce_count')
          .eq('email_address', email.recipient_email)
          .single();

        const bounceCount = (existingStatus?.bounce_count || 0) + 1;

        await supabase
          .from('email_delivery_status')
          .upsert({
            email_address: email.recipient_email,
            status: bounceCount >= 3 ? 'hard_bounce' : 'soft_bounce',
            bounce_count: bounceCount,
            last_bounce_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'email_address',
          });

        console.log(`Permanent error for email ${email.id}: ${errorMessage}`);

      } else {
        const newRetryCount = email.retry_count + 1;
        const maxRetries = 5;

        if (newRetryCount >= maxRetries) {
          await supabase
            .from('email_queue')
            .update({
              status: 'failed',
              error_message: `Max retries reached: ${errorMessage}`,
              retry_count: newRetryCount,
            })
            .eq('id', email.id);

          console.log(`Max retries reached for email ${email.id}`);
        } else {
          const delayMinutes = Math.pow(2, newRetryCount) * 5;
          const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);

          await supabase
            .from('email_queue')
            .update({
              retry_count: newRetryCount,
              error_message: errorMessage,
              scheduled_for: scheduledFor.toISOString(),
            })
            .eq('id', email.id);

          console.log(`Retry ${newRetryCount}/${maxRetries} for email ${email.id}, scheduled for ${scheduledFor}`);
        }
      }
    }

    await supabase
      .from('email_history')
      .insert({
        company_id: email.company_id,
        recipient_user_id: email.recipient_user_id,
        recipient_email: email.recipient_email,
        email_type: email.email_type,
        subject: email.subject,
        delivery_status: deliveryStatus,
        smtp_response: smtpResponse,
        data: email.data,
      });

    return new Response(
      JSON.stringify({
        success: deliveryStatus === 'delivered',
        email_id: email.id,
        delivery_status: deliveryStatus,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in send-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
