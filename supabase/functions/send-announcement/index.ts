import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'info' | 'warning' | 'important';
  attachment_urls: string[];
  created_by: string;
  data?: {
    type: 'all' | 'companies' | 'managers';
    company_ids?: string[];
    manager_ids?: string[];
  };
}

interface SSTManager {
  id: string;
  email: string;
  full_name: string;
  company_id: string;
  company_name?: string;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  console.log('[send-announcement] Request received at', new Date().toISOString());

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[send-announcement] Step 1: Validating authentication');
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error('[send-announcement] No authorization header provided');
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[send-announcement] Authentication failed:', authError?.message);
      throw new Error("Unauthorized");
    }

    console.log('[send-announcement] User authenticated:', user.id);

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (userError || !userData || userData.role !== "super_admin") {
      console.error('[send-announcement] User is not super_admin:', { userError, userData });
      throw new Error("Only super admins can send announcements");
    }

    console.log('[send-announcement] Step 2: Parsing request body');
    let announcementId: string;
    try {
      const body = await req.json();
      announcementId = body.announcementId;
    } catch (parseError) {
      console.error('[send-announcement] Failed to parse request body:', parseError);
      throw new Error("Invalid request body");
    }

    if (!announcementId) {
      console.error('[send-announcement] No announcement ID provided');
      throw new Error("Announcement ID is required");
    }

    console.log('[send-announcement] Step 3: Fetching announcement:', announcementId);
    const { data: announcement, error: announcementError } = await supabase
      .from("announcements")
      .select("*")
      .eq("id", announcementId)
      .maybeSingle();

    if (announcementError) {
      console.error('[send-announcement] Database error fetching announcement:', announcementError);
      throw new Error(`Database error: ${announcementError.message}`);
    }

    if (!announcement) {
      console.error('[send-announcement] Announcement not found:', announcementId);
      throw new Error("Announcement not found");
    }

    console.log('[send-announcement] Announcement loaded:', {
      id: announcement.id,
      title: announcement.title,
      status: announcement.status,
      filters: announcement.data
    });

    if (announcement.status === "sent") {
      console.error('[send-announcement] Announcement already sent');
      throw new Error("Announcement already sent");
    }

    console.log('[send-announcement] Step 4: Validating recipient filters');
    if (announcement.data) {
      const filters = announcement.data as { type: string; company_ids?: string[]; manager_ids?: string[] };
      console.log('[send-announcement] Filters:', filters);

      if (filters.type === 'companies') {
        if (!filters.company_ids || filters.company_ids.length === 0) {
          console.error('[send-announcement] No companies selected for company filter');
          throw new Error("No companies selected. Please select at least one company.");
        }
        console.log('[send-announcement] Filtering by companies:', filters.company_ids);
      } else if (filters.type === 'managers') {
        if (!filters.manager_ids || filters.manager_ids.length === 0) {
          console.error('[send-announcement] No managers selected for manager filter');
          throw new Error("No managers selected. Please select at least one manager.");
        }
        console.log('[send-announcement] Filtering by managers:', filters.manager_ids);
      }
    } else {
      console.log('[send-announcement] No filters - sending to all SST managers');
    }

    console.log('[send-announcement] Step 5: Fetching SST managers');
    let sstManagersQuery = supabase
      .from("users")
      .select(`
        id,
        email,
        full_name,
        company_id,
        companies:company_id (
          name
        )
      `)
      .eq("role", "sst_manager")
      .eq("active", true)
      .not("email", "is", null);

    if (announcement.data) {
      const filters = announcement.data as { type: string; company_ids?: string[]; manager_ids?: string[] };

      if (filters.type === 'companies' && filters.company_ids && filters.company_ids.length > 0) {
        sstManagersQuery = sstManagersQuery.in("company_id", filters.company_ids);
      } else if (filters.type === 'managers' && filters.manager_ids && filters.manager_ids.length > 0) {
        sstManagersQuery = sstManagersQuery.in("id", filters.manager_ids);
      }
    }

    const { data: sstManagers, error: managersError } = await sstManagersQuery;

    if (managersError) {
      console.error('[send-announcement] Error fetching SST managers:', managersError);
      throw new Error(`Error fetching SST managers: ${managersError.message}`);
    }

    if (!sstManagers || sstManagers.length === 0) {
      console.error('[send-announcement] No SST managers found matching criteria');
      throw new Error("No SST managers found matching the criteria. Please verify the selected filters.");
    }

    console.log('[send-announcement] Found', sstManagers.length, 'SST managers');

    console.log('[send-announcement] Step 6: Checking daily email limits');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentEmailCount } = await supabase
      .from('email_history')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', twentyFourHoursAgo);

    const maxEmailsPerDay = 950;
    const emailsRemaining = maxEmailsPerDay - (recentEmailCount || 0);

    console.log('[send-announcement] Email usage:', {
      sent_last_24h: recentEmailCount,
      limit: maxEmailsPerDay,
      remaining: emailsRemaining,
      requested: sstManagers.length
    });

    if (emailsRemaining < sstManagers.length) {
      console.error('[send-announcement] Not enough email quota');
      throw new Error(`No hay suficiente capacidad de envío. Disponibles: ${emailsRemaining} emails, necesarios: ${sstManagers.length}. El límite se reinicia en las próximas 24 horas.`);
    }

    const priorityColors = {
      info: "#3B82F6",
      warning: "#F59E0B",
      important: "#EF4444",
    };

    const priorityLabels = {
      info: "Información",
      warning: "Advertencia",
      important: "Importante",
    };

    const priorityColor = priorityColors[announcement.priority as keyof typeof priorityColors];
    const priorityLabel = priorityLabels[announcement.priority as keyof typeof priorityLabels];

    const loginUrl = "https://reporta.goodsolutions.app/login";

    console.log('[send-announcement] Step 7: Checking for duplicate sends');
    const { data: alreadySent } = await supabase
      .from("email_history")
      .select("recipient_email")
      .eq("email_type", "admin_announcement")
      .contains("data", { announcement_id: announcement.id });

    const alreadySentEmails = new Set(
      (alreadySent || []).map((record: any) => record.recipient_email)
    );

    console.log('[send-announcement] Already sent to', alreadySentEmails.size, 'recipients');

    console.log('[send-announcement] Step 8: Generating email records');
    const emailRecords = [];
    const recipientRecords = [];

    const baseTime = new Date();
    const delayBetweenEmails = 12000;

    for (let i = 0; i < sstManagers.length; i++) {
      const manager = sstManagers[i];

      if (alreadySentEmails.has(manager.email)) {
        console.log(`[send-announcement] Skipping ${manager.email} - already sent`);
        continue;
      }

      const companyName = (manager as any).companies?.name || "su empresa";
      const scheduledTime = new Date(baseTime.getTime() + (i * delayBetweenEmails));

      let attachmentsHtml = "";
      if (announcement.attachment_urls && announcement.attachment_urls.length > 0) {
        // Helper function to detect if file is an image
        const isImage = (url: string): boolean => {
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
          const urlLower = url.toLowerCase();
          return imageExtensions.some(ext => urlLower.includes(ext));
        };

        // Separate images from other files
        const images = announcement.attachment_urls.filter((url: string) => isImage(url));
        const documents = announcement.attachment_urls.filter((url: string) => !isImage(url));

        // Generate HTML for embedded images
        let imagesHtml = "";
        if (images.length > 0) {
          imagesHtml = `
            <div style="margin-top: 24px;">
              ${images.map((url: string) => {
                const fileName = url.split('/').pop() || 'imagen';
                return `
                  <div style="margin-bottom: 16px; text-align: center;">
                    <img src="${url}" alt="${fileName}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); display: block; margin: 0 auto;" />
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #6B7280;">${fileName}</p>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }

        // Generate HTML for downloadable documents
        let documentsHtml = "";
        if (documents.length > 0) {
          documentsHtml = `
            <div style="margin-top: 24px; padding: 16px; background-color: #F9FAFB; border-radius: 8px; border: 1px solid #E5E7EB;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">Documentos Adjuntos:</h3>
              <ul style="margin: 0; padding-left: 20px; list-style: none;">
                ${documents.map((url: string) => {
                  const fileName = url.split('/').pop() || 'archivo';
                  return `<li style="margin-bottom: 8px;"><a href="${url}" style="color: #EF4444; text-decoration: none; font-weight: 500;">${fileName}</a></li>`;
                }).join('')}
              </ul>
            </div>
          `;
        }

        attachmentsHtml = imagesHtml + documentsHtml;
      }

      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F3F4F6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                  <tr>
                    <td style="background-color: ${priorityColor}; padding: 24px; text-align: center;">
                      <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: bold;">
                        Anuncio Oficial
                      </h1>
                      <p style="margin: 8px 0 0 0; color: #FFFFFF; font-size: 14px; opacity: 0.95;">
                        ${priorityLabel} • Reporta SST
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 32px;">
                      <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">
                        ${announcement.title}
                      </h2>
                      <div style="color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">
                        ${announcement.message}
                      </div>
                      ${attachmentsHtml}
                      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #E5E7EB;">
                        <p style="margin: 0 0 16px 0; color: #6B7280; font-size: 14px;">
                          Este anuncio ha sido enviado por el administrador del sistema.
                        </p>
                        <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #EF4444; color: #FFFFFF; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                          Ir a Reporta SST
                        </a>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center;">
                      <p style="margin: 0; color: #6B7280; font-size: 12px;">
                        Este es un correo automático del sistema Reporta SST
                      </p>
                      <p style="margin: 8px 0 0 0; color: #9CA3AF; font-size: 11px;">
                        © ${new Date().getFullYear()} Reporta SST - Gestión de Seguridad y Salud en el Trabajo
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      emailRecords.push({
        company_id: manager.company_id,
        recipient_user_id: manager.id,
        recipient_email: manager.email,
        email_type: "admin_announcement",
        subject: `${priorityLabel}: ${announcement.title}`,
        html_body: htmlBody,
        data: {
          announcement_id: announcement.id,
          priority: announcement.priority,
        },
        status: "pending",
        scheduled_for: scheduledTime.toISOString(),
      });

      recipientRecords.push({
        announcement_id: announcement.id,
        user_id: manager.id,
        company_id: manager.company_id,
        email_sent: false,
      });
    }

    if (emailRecords.length === 0) {
      console.error('[send-announcement] No new recipients to send to');
      throw new Error("Todos los destinatarios ya recibieron este anuncio anteriormente.");
    }

    console.log('[send-announcement] Generated', emailRecords.length, 'email records');

    console.log('[send-announcement] Step 9: Inserting email records in chunks');
    const emailChunks = chunkArray(emailRecords, 25);
    let totalEmailsInserted = 0;
    const emailErrors = [];

    for (let i = 0; i < emailChunks.length; i++) {
      const chunk = emailChunks[i];
      console.log(`[send-announcement] Inserting email chunk ${i + 1}/${emailChunks.length} (${chunk.length} records)`);

      try {
        const { error: chunkError } = await supabase
          .from("email_queue")
          .insert(chunk);

        if (chunkError) {
          console.error(`[send-announcement] Error in chunk ${i + 1}:`, chunkError);
          emailErrors.push(`Chunk ${i + 1}: ${chunkError.message}`);
        } else {
          totalEmailsInserted += chunk.length;
        }
      } catch (error) {
        console.error(`[send-announcement] Exception in chunk ${i + 1}:`, error);
        emailErrors.push(`Chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (totalEmailsInserted === 0) {
      console.error('[send-announcement] Failed to insert any emails');
      throw new Error(`No se pudo programar ningún email. Errores: ${emailErrors.join('; ')}`);
    }

    console.log('[send-announcement] Step 10: Inserting recipient records in chunks');
    const recipientChunks = chunkArray(recipientRecords, 25);
    let totalRecipientsInserted = 0;

    for (let i = 0; i < recipientChunks.length; i++) {
      const chunk = recipientChunks[i];
      console.log(`[send-announcement] Inserting recipient chunk ${i + 1}/${recipientChunks.length}`);

      try {
        const { error: chunkError } = await supabase
          .from("announcement_recipients")
          .insert(chunk);

        if (chunkError) {
          console.error(`[send-announcement] Error in recipient chunk ${i + 1}:`, chunkError);
        } else {
          totalRecipientsInserted += chunk.length;
        }
      } catch (error) {
        console.error(`[send-announcement] Exception in recipient chunk ${i + 1}:`, error);
      }
    }

    console.log('[send-announcement] Step 11: Updating announcement status');
    const { error: updateError } = await supabase
      .from("announcements")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        recipient_count: totalEmailsInserted,
      })
      .eq("id", announcement.id);

    if (updateError) {
      console.error("[send-announcement] Error updating announcement status:", updateError);
    }

    const duration = Date.now() - startTime;
    console.log('[send-announcement] Completed successfully in', duration, 'ms');
    console.log('[send-announcement] Final stats:', {
      total_recipients: sstManagers.length,
      emails_inserted: totalEmailsInserted,
      recipients_inserted: totalRecipientsInserted,
      email_errors: emailErrors.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Anuncio programado exitosamente para ${totalEmailsInserted} gestor(es) SST`,
        recipient_count: totalEmailsInserted,
        stats: {
          total_recipients: sstManagers.length,
          emails_queued: totalEmailsInserted,
          errors: emailErrors.length > 0 ? emailErrors : undefined
        }
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[send-announcement] FATAL ERROR:", {
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: "Revisa los logs de la Edge Function para más detalles"
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
