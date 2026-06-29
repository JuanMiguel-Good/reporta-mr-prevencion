import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ReminderStats {
  companies_processed: number;
  managers_notified: number;
  total_pending_reports: number;
  assignment_reminders_sent: number;
  deadline_reminders_sent: number;
  review_reminders_sent: number;
  errors: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  let executionId: string | undefined;
  let supabase: any;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: executionLog, error: logError } = await supabase
      .from('cron_execution_logs')
      .insert({
        job_name: 'send-daily-reminders',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError || !executionLog) {
      console.error('Failed to create execution log:', logError);
    }

    executionId = executionLog?.id;

    const stats: ReminderStats = {
      companies_processed: 0,
      managers_notified: 0,
      total_pending_reports: 0,
      assignment_reminders_sent: 0,
      deadline_reminders_sent: 0,
      review_reminders_sent: 0,
      errors: [],
    };

    // Call reminder functions
    const { data: assignmentResult, error: assignmentError } = await supabase
      .rpc('send_pending_assignment_reminders');

    if (assignmentError) {
      stats.errors.push(`Assignment reminders error: ${assignmentError.message}`);
    } else if (assignmentResult) {
      stats.assignment_reminders_sent = assignmentResult.reminders_sent || 0;
      if (assignmentResult.errors && assignmentResult.errors.length > 0) {
        stats.errors.push(...assignmentResult.errors);
      }
    }

    const { data: deadlineResult, error: deadlineError } = await supabase
      .rpc('send_deadline_reminders');

    if (deadlineError) {
      stats.errors.push(`Deadline reminders error: ${deadlineError.message}`);
    } else if (deadlineResult) {
      stats.deadline_reminders_sent = deadlineResult.reminders_sent || 0;
      if (deadlineResult.errors && deadlineResult.errors.length > 0) {
        stats.errors.push(...deadlineResult.errors);
      }
    }

    const { data: reviewResult, error: reviewError } = await supabase
      .rpc('send_pending_review_reminders');

    if (reviewError) {
      stats.errors.push(`Review reminders error: ${reviewError.message}`);
    } else if (reviewResult) {
      stats.review_reminders_sent = reviewResult.reminders_sent || 0;
      if (reviewResult.errors && reviewResult.errors.length > 0) {
        stats.errors.push(...reviewResult.errors);
      }
    }

    const { data: activeCompanies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, logo_url')
      .eq('active', true);

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    if (!activeCompanies || activeCompanies.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active companies found',
          stats,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    for (const company of activeCompanies) {
      try {
        stats.companies_processed++;
        console.log(`Processing company: ${company.name} (${company.id})`);

        const { data: pendingReports, error: reportsError } = await supabase
          .from('reports')
          .select(`
            id,
            type,
            created_at,
            status,
            area,
            proyecto,
            category_id,
            categories (name)
          `)
          .eq('company_id', company.id)
          .in('status', ['reported', 'assigned', 'in_review', 'evidence_rejected'])
          .order('created_at', { ascending: false });

        if (reportsError) {
          const errorMsg = `Company ${company.name}: ${reportsError.message}`;
          stats.errors.push(errorMsg);
          console.error(errorMsg);

          if (executionId) {
            await supabase.from('cron_company_logs').insert({
              execution_id: executionId,
              company_id: company.id,
              company_name: company.name,
              status: 'failed',
              error_message: reportsError.message,
            });
          }
          continue;
        }

        if (!pendingReports || pendingReports.length === 0) {
          console.log(`Company ${company.name}: No pending reports, skipping`);

          if (executionId) {
            await supabase.from('cron_company_logs').insert({
              execution_id: executionId,
              company_id: company.id,
              company_name: company.name,
              status: 'skipped',
              pending_reports_count: 0,
            });
          }
          continue;
        }

        console.log(`Company ${company.name}: Found ${pendingReports.length} pending reports`);

        stats.total_pending_reports += pendingReports.length;

        const reportedCount = pendingReports.filter(r => r.status === 'reported').length;
        const assignedCount = pendingReports.filter(r => r.status === 'assigned').length;
        const inReviewCount = pendingReports.filter(r => r.status === 'in_review').length;
        const rejectedCount = pendingReports.filter(r => r.status === 'evidence_rejected').length;

        const { data: managers, error: managersError } = await supabase
          .from('users')
          .select('id, email, full_name')
          .eq('company_id', company.id)
          .eq('role', 'sst_manager')
          .eq('active', true)
          .not('email', 'is', null);

        if (managersError || !managers || managers.length === 0) {
          const errorMsg = `Company ${company.name}: No active SST managers found`;
          stats.errors.push(errorMsg);
          console.error(errorMsg);

          if (executionId) {
            await supabase.from('cron_company_logs').insert({
              execution_id: executionId,
              company_id: company.id,
              company_name: company.name,
              status: 'failed',
              pending_reports_count: pendingReports.length,
              error_message: 'No active SST managers found',
            });
          }
          continue;
        }

        console.log(`Company ${company.name}: Found ${managers.length} active SST managers`);

        let emailsQueuedForCompany = 0;

        for (const manager of managers) {
          if (!manager.email) {
            console.log(`Manager ${manager.full_name} has no email, skipping`);
            continue;
          }

          console.log(`Processing manager: ${manager.full_name} (${manager.email})`);

          const reportsList = pendingReports
            .slice(0, 10)
            .map((report: any) => {
              const statusLabel = {
                'reported': '🔴 Sin Asignar',
                'assigned': '🟡 Asignado',
                'in_review': '🔵 En Revisión',
                'evidence_rejected': '🔴 Evidencia Rechazada',
              }[report.status] || report.status;

              const typeLabel = report.type === 'unsafe_act' ? 'Acto Inseguro' : 'Condición Insegura';

              return `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 12px 8px;">${statusLabel}</td>
                  <td style="padding: 12px 8px;">${typeLabel}</td>
                  <td style="padding: 12px 8px;">${report.categories?.name || 'Sin categoría'}</td>
                  <td style="padding: 12px 8px;">${report.area || 'N/A'}</td>
                  <td style="padding: 12px 8px; white-space: nowrap;">
                    ${new Date(report.created_at).toLocaleDateString('es-PE', {
                      timeZone: 'America/Lima',
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit'
                    })}
                  </td>
                </tr>
              `;
            })
            .join('');

          const moreReports = pendingReports.length > 10
            ? `<p style="margin-top: 10px; font-style: italic;">Y ${pendingReports.length - 10} reportes más...</p>`
            : '';

          const subject = `[${company.name}] Recordatorio Diario: ${pendingReports.length} Reportes Pendientes`;

          const htmlBody = `
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #2563eb;">Buenos días, ${manager.full_name}</h2>
                  <p>Este es tu resumen diario de reportes pendientes en <strong>${company.name}</strong>.</p>

                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1f2937;">📊 Resumen de Reportes Pendientes</h3>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Total de reportes pendientes:</td>
                        <td style="padding: 8px 0; text-align: right; font-size: 20px; color: #2563eb;"><strong>${pendingReports.length}</strong></td>
                      </tr>
                      ${reportedCount > 0 ? `
                      <tr>
                        <td style="padding: 8px 0;">🔴 Sin asignar:</td>
                        <td style="padding: 8px 0; text-align: right; color: #dc2626;"><strong>${reportedCount}</strong></td>
                      </tr>` : ''}
                      ${assignedCount > 0 ? `
                      <tr>
                        <td style="padding: 8px 0;">🟡 Asignados:</td>
                        <td style="padding: 8px 0; text-align: right; color: #f59e0b;"><strong>${assignedCount}</strong></td>
                      </tr>` : ''}
                      ${inReviewCount > 0 ? `
                      <tr>
                        <td style="padding: 8px 0;">🔵 En revisión:</td>
                        <td style="padding: 8px 0; text-align: right; color: #2563eb;"><strong>${inReviewCount}</strong></td>
                      </tr>` : ''}
                      ${rejectedCount > 0 ? `
                      <tr>
                        <td style="padding: 8px 0;">🔴 Evidencia rechazada:</td>
                        <td style="padding: 8px 0; text-align: right; color: #dc2626;"><strong>${rejectedCount}</strong></td>
                      </tr>` : ''}
                    </table>
                  </div>

                  ${pendingReports.length > 0 ? `
                  <h3 style="color: #1f2937; margin-top: 30px;">Últimos Reportes Pendientes</h3>
                  <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
                      <thead>
                        <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                          <th style="padding: 12px 8px; text-align: left; font-weight: 600;">Estado</th>
                          <th style="padding: 12px 8px; text-align: left; font-weight: 600;">Tipo</th>
                          <th style="padding: 12px 8px; text-align: left; font-weight: 600;">Categoría</th>
                          <th style="padding: 12px 8px; text-align: left; font-weight: 600;">Área</th>
                          <th style="padding: 12px 8px; text-align: left; font-weight: 600;">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${reportsList}
                      </tbody>
                    </table>
                  </div>
                  ${moreReports}
                  ` : ''}

                  <div style="margin: 30px 0;">
                    <a href="https://app.goodsolutions.app/login"
                       style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                      Ver Todos los Reportes
                    </a>
                  </div>

                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

                  <p style="font-size: 12px; color: #6b7280;">
                    Este es un recordatorio automático diario del sistema de reportes de ${company.name}.<br>
                    Por favor no respondas a este correo.
                  </p>
                </div>
              </body>
            </html>
          `;

          const { error: enqueueError } = await supabase.rpc('enqueue_email', {
            p_company_id: company.id,
            p_recipient_user_id: manager.id,
            p_recipient_email: manager.email,
            p_email_type: 'daily_reminder',
            p_subject: subject,
            p_html_body: htmlBody,
            p_data: {
              total_pending: pendingReports.length,
              reported_count: reportedCount,
              assigned_count: assignedCount,
              in_review_count: inReviewCount,
              rejected_count: rejectedCount,
            },
          });

          if (enqueueError) {
            const errorMsg = `Failed to enqueue email for ${manager.email}: ${enqueueError.message}`;
            stats.errors.push(errorMsg);
            console.error(errorMsg);
          } else {
            stats.managers_notified++;
            emailsQueuedForCompany++;
            console.log(`Email queued successfully for ${manager.email}`);
          }
        }

        if (executionId) {
          await supabase.from('cron_company_logs').insert({
            execution_id: executionId,
            company_id: company.id,
            company_name: company.name,
            status: emailsQueuedForCompany > 0 ? 'processed' : 'failed',
            pending_reports_count: pendingReports.length,
            managers_notified: emailsQueuedForCompany,
            emails_queued: emailsQueuedForCompany,
            error_message: emailsQueuedForCompany === 0 ? 'No emails queued' : null,
          });
        }

      } catch (error: any) {
        const errorMsg = `Company ${company.name}: ${error.message}`;
        stats.errors.push(errorMsg);
        console.error(`Error processing company ${company.name}:`, error);

        if (executionId) {
          await supabase.from('cron_company_logs').insert({
            execution_id: executionId,
            company_id: company.id,
            company_name: company.name,
            status: 'failed',
            error_message: error.message,
          });
        }
      }
    }

    if (executionId) {
      await supabase
        .from('cron_execution_logs')
        .update({
          status: stats.errors.length === 0 ? 'success' : 'partial',
          completed_at: new Date().toISOString(),
          stats: {
            companies_processed: stats.companies_processed,
            managers_notified: stats.managers_notified,
            total_pending_reports: stats.total_pending_reports,
            assignment_reminders_sent: stats.assignment_reminders_sent,
            deadline_reminders_sent: stats.deadline_reminders_sent,
            review_reminders_sent: stats.review_reminders_sent,
          },
          errors: stats.errors,
        })
        .eq('id', executionId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily reminders sent to ${stats.managers_notified} managers`,
        stats,
        execution_id: executionId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in send-daily-reminders function:', error);

    if (executionId) {
      await supabase
        .from('cron_execution_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          errors: [error.message],
        })
        .eq('id', executionId);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
