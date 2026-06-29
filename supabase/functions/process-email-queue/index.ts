import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ProcessStats {
  total_processed: number;
  successful: number;
  failed: number;
  skipped: number;
  rate_limited: boolean;
  errors: string[];
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const stats: ProcessStats = {
      total_processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      rate_limited: false,
      errors: [],
    };

    const maxEmailsPerRun = 50;
    const maxEmailsPerDay = 950;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentEmailCount } = await supabase
      .from('email_history')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', twentyFourHoursAgo);

    if (recentEmailCount && recentEmailCount >= maxEmailsPerDay) {
      console.warn(`Rate limit reached: ${recentEmailCount} emails sent in last 24 hours (limit: ${maxEmailsPerDay})`);
      stats.rate_limited = true;

      const { data: superAdmins } = await supabase
        .from('users')
        .select('id, email, full_name, company_id')
        .eq('role', 'super_admin')
        .eq('active', true)
        .not('email', 'is', null);

      if (superAdmins && superAdmins.length > 0) {
        for (const admin of superAdmins) {
          if (admin.email) {
            await supabase.from('email_queue').insert({
              company_id: admin.company_id,
              recipient_user_id: admin.id,
              recipient_email: admin.email,
              email_type: 'smtp_failure_alert',
              subject: '[ALERTA] Límite de Envío de Emails Alcanzado',
              html_body: `
                <html>
                  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                      <h2 style="color: #dc2626;">Alerta del Sistema</h2>
                      <p>Se ha alcanzado el límite de envío de emails en 24 horas (${maxEmailsPerDay} emails).</p>
                      <p><strong>Emails enviados en las últimas 24 horas:</strong> ${recentEmailCount}</p>
                      <p>El sistema pausará el envío de emails y reintentará en la próxima ejecución.</p>
                      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                      <p style="font-size: 12px; color: #6b7280;">
                        Este es un mensaje automático del sistema de reportes.<br>
                        Por favor no respondas a este correo.
                      </p>
                    </div>
                  </body>
                </html>
              `,
              data: { recent_email_count: recentEmailCount, max_allowed: maxEmailsPerDay },
              scheduled_for: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            });
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Rate limit reached, pausing email processing',
          stats,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(maxEmailsPerRun);

    if (fetchError) {
      throw new Error(`Failed to fetch pending emails: ${fetchError.message}`);
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending emails to process',
          stats,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Processing ${pendingEmails.length} pending emails...`);

    for (const email of pendingEmails) {
      stats.total_processed++;

      const retryCount = email.retry_count || 0;
      const maxRetries = 3;

      if (retryCount >= maxRetries) {
        console.log(`Skipping email ${email.id} - max retries reached (${retryCount})`);

        await supabase
          .from('email_queue')
          .update({
            status: 'failed',
            error_message: `Max retry attempts reached (${maxRetries})`
          })
          .eq('id', email.id);

        stats.skipped++;
        continue;
      }

      if (email.email_type === 'admin_announcement' && email.data?.announcement_id) {
        const { data: alreadySent } = await supabase
          .from('announcement_recipients')
          .select('email_sent')
          .eq('announcement_id', email.data.announcement_id)
          .eq('user_id', email.recipient_user_id)
          .eq('email_sent', true)
          .maybeSingle();

        if (alreadySent) {
          console.log(`Skipping announcement email to ${email.recipient_email} - already sent`);

          await supabase
            .from('email_queue')
            .update({
              status: 'cancelled',
              error_message: 'Announcement already sent to this user'
            })
            .eq('id', email.id);

          stats.skipped++;
          continue;
        }
      }

      const { data: deliveryStatus } = await supabase
        .from('email_delivery_status')
        .select('status')
        .eq('email_address', email.recipient_email)
        .maybeSingle();

      if (deliveryStatus && ['hard_bounce', 'invalid'].includes(deliveryStatus.status)) {
        console.log(`Skipping email to ${email.recipient_email} - status: ${deliveryStatus.status}`);

        await supabase
          .from('email_queue')
          .update({ status: 'cancelled', error_message: `Email marked as ${deliveryStatus.status}` })
          .eq('id', email.id);

        stats.skipped++;
        continue;
      }

      try {
        const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;
        const response = await fetch(sendEmailUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ email_id: email.id }),
        });

        const result = await response.json();

        if (result.success) {
          stats.successful++;
        } else {
          stats.failed++;
          stats.errors.push(`Email ${email.id}: ${result.error || 'Unknown error'}`);

          await supabase
            .from('email_queue')
            .update({
              retry_count: retryCount + 1,
              scheduled_for: new Date(Date.now() + (retryCount + 1) * 60 * 60 * 1000).toISOString()
            })
            .eq('id', email.id)
            .eq('status', 'pending');
        }

      } catch (error: any) {
        stats.failed++;
        stats.errors.push(`Email ${email.id}: ${error.message}`);
        console.error(`Error processing email ${email.id}:`, error);

        await supabase
          .from('email_queue')
          .update({
            retry_count: retryCount + 1,
            scheduled_for: new Date(Date.now() + (retryCount + 1) * 60 * 60 * 1000).toISOString()
          })
          .eq('id', email.id)
          .eq('status', 'pending');
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const smtpFailureRate = stats.total_processed > 0
      ? (stats.failed / stats.total_processed) * 100
      : 0;

    if (smtpFailureRate > 50 && stats.total_processed >= 10) {
      console.error(`High SMTP failure rate: ${smtpFailureRate.toFixed(2)}%`);

      const { data: superAdmins } = await supabase
        .from('users')
        .select('id, email, full_name, company_id')
        .eq('role', 'super_admin')
        .eq('active', true)
        .not('email', 'is', null);

      if (superAdmins && superAdmins.length > 0) {
        for (const admin of superAdmins) {
          if (admin.email) {
            await supabase.from('email_queue').insert({
              company_id: admin.company_id,
              recipient_user_id: admin.id,
              recipient_email: admin.email,
              email_type: 'smtp_failure_alert',
              subject: '[ALERTA CRÍTICA] Alta Tasa de Fallos en Envío de Emails',
              html_body: `
                <html>
                  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                      <h2 style="color: #dc2626;">🚨 Alerta Crítica del Sistema</h2>
                      <p>Se ha detectado una alta tasa de fallos en el envío de emails.</p>
                      <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; font-weight: bold;">Total procesados:</td>
                            <td style="padding: 8px 0;">${stats.total_processed}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; font-weight: bold;">Exitosos:</td>
                            <td style="padding: 8px 0; color: #059669;">${stats.successful}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; font-weight: bold;">Fallidos:</td>
                            <td style="padding: 8px 0; color: #dc2626;">${stats.failed}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; font-weight: bold;">Tasa de fallos:</td>
                            <td style="padding: 8px 0; color: #dc2626;"><strong>${smtpFailureRate.toFixed(2)}%</strong></td>
                          </tr>
                        </table>
                      </div>
                      <p><strong>Acción:</strong> El sistema reintentará el envío en la próxima ejecución (cada hora).</p>
                      <p>Por favor, verifica la configuración SMTP y el estado del servidor de correo.</p>
                      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                      <p style="font-size: 12px; color: #6b7280;">
                        Este es un mensaje automático del sistema de reportes.<br>
                        Por favor no respondas a este correo.
                      </p>
                    </div>
                  </body>
                </html>
              `,
              data: { stats },
              scheduled_for: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${stats.total_processed} emails`,
        stats,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in process-email-queue function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
