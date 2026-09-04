import sgMail from "@sendgrid/mail";
import { getCurrencySymbol } from "./currency";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export interface ExpenseItemSummary {
  description: string;
  amount: number;
  category?: string | null;
}

export interface WorkspaceSummary {
  workspaceName: string;
  total: number;
}

export async function sendDailySummaryEmail(
  to: string,
  name: string,
  personalTotal: number,
  workspaceSummaries: WorkspaceSummary[],
  options?: {
    currency?: string;
    personalExpenses?: ExpenseItemSummary[];
    dateStr?: string;
  }
) {
  const currency = options?.currency || "PKR";
  const sym = getCurrencySymbol(currency);
  const sharedTotal = workspaceSummaries.reduce((sum, w) => sum + w.total, 0);
  const grandTotal = personalTotal + sharedTotal;
  const dateFormatted =
    options?.dateStr ||
    new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // Plain text fallback
  const workspaceLines = workspaceSummaries
    .map((w) => `  • ${w.workspaceName}: ${sym}${Math.round(w.total).toLocaleString()}`)
    .join("\n");

  const text = `Hi ${name},

Here is your daily expense summary for ${dateFormatted}:

Total Spent Today: ${sym}${Math.round(grandTotal).toLocaleString()}
  • Personal Expenses: ${sym}${Math.round(personalTotal).toLocaleString()}
${workspaceLines ? "Shared Workspaces:\n" + workspaceLines : "  • No shared expenses today."}

View your dashboard on Hisab Kitab.

— Hisab Kitab Team`;

  // Itemized personal expenses rows if provided
  const personalRowsHtml =
    options?.personalExpenses && options.personalExpenses.length > 0
      ? options.personalExpenses
        .slice(0, 6)
        .map(
          (e) => `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE6; color: #162B27; font-size: 13px; font-weight: 500;">
            ${escapeHtml(e.description)}
            ${e.category
              ? `<span style="display: inline-block; background-color: #E8F5F1; color: #0F5C53; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; margin-left: 6px;">${escapeHtml(e.category)}</span>`
              : ""
            }
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE6; color: #162B27; font-size: 13px; font-weight: 700; text-align: right; font-family: monospace;">
            ${sym}${Math.round(e.amount).toLocaleString()}
          </td>
        </tr>
      `
        )
        .join("")
      : `
        <tr>
          <td style="padding: 10px 0; color: #6B7268; font-size: 13px;">Total Personal Expenses</td>
          <td style="padding: 10px 0; color: #162B27; font-size: 13px; font-weight: 700; text-align: right; font-family: monospace;">
            ${sym}${Math.round(personalTotal).toLocaleString()}
          </td>
        </tr>
      `;

  // Shared workspaces rows
  const workspaceRowsHtml =
    workspaceSummaries.length > 0
      ? workspaceSummaries
        .map(
          (w) => `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE6; color: #162B27; font-size: 13px; font-weight: 500;">
            📁 ${escapeHtml(w.workspaceName)}
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE6; color: #0F5C53; font-size: 13px; font-weight: 700; text-align: right; font-family: monospace;">
            ${sym}${Math.round(w.total).toLocaleString()}
          </td>
        </tr>
      `
        )
        .join("")
      : `
        <tr>
          <td colspan="2" style="padding: 10px 0; color: #6B7268; font-size: 13px; font-style: italic;">
            No shared workspace activity today.
          </td>
        </tr>
      `;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Expense Summary - Hisab Kitab</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #162B27;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 1px solid #E5E0D8; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
          
          <!-- Top Emerald Header Banner -->
          <tr>
            <td style="background-color: #0F5C53; padding: 32px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(255,255,255,0.18); color: #FFFFFF; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 10px; border-radius: 6px; margin-bottom: 10px;">
                      Daily Ledger Pulse
                    </span>
                    <h1 style="margin: 0; color: #FFFFFF; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; font-family: Georgia, serif;">
                      Hisab Kitab
                    </h1>
                  </td>
                  <td align="right" style="color: #A3D9D2; font-size: 12px; font-weight: 500;">
                    ${dateFormatted}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 22px 0; font-size: 15px; line-height: 1.5; color: #3A4D48;">
                Hi <strong>${escapeHtml(name)}</strong>, here is your summary of expenses recorded today:
              </p>

              <!-- Hero Stat Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; border: 1px solid #E5E0D8; border-radius: 18px; margin-bottom: 26px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #6B7268; margin-bottom: 6px;">
                      Total Spent Today
                    </span>
                    <span style="display: block; font-size: 40px; font-weight: 800; color: #0F5C53; letter-spacing: -1px; font-family: Georgia, serif; line-height: 1.1;">
                      ${sym}${Math.round(grandTotal).toLocaleString()}
                    </span>
                    <span style="display: inline-block; font-size: 12px; color: #6B7268; margin-top: 6px;">
                      Personal: <strong>${sym}${Math.round(personalTotal).toLocaleString()}</strong> &bull; Shared Share: <strong>${sym}${Math.round(sharedTotal).toLocaleString()}</strong>
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Personal Expenses Breakdown -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <div style="border-bottom: 2px solid #0F5C53; padding-bottom: 6px; margin-bottom: 12px;">
                      <h3 style="margin: 0; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0F5C53;">
                        💳 Personal Expenses
                      </h3>
                    </div>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      ${personalRowsHtml}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Shared Workspaces Breakdown -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                <tr>
                  <td>
                    <div style="border-bottom: 2px solid #0F5C53; padding-bottom: 6px; margin-bottom: 12px;">
                      <h3 style="margin: 0; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0F5C53;">
                        👥 Shared Workspaces (Your Share)
                      </h3>
                    </div>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      ${workspaceRowsHtml}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="text-align: center; margin-bottom: 10px;">
                <tr>
                  <td align="center">
                    <a href="https://hisab.awaisnazir.tech/dashboard" style="display: inline-block; background-color: #0F5C53; color: #FFFFFF; font-size: 14px; font-weight: 700; text-decoration: none; padding: 13px 32px; border-radius: 12px; box-shadow: 0 3px 8px rgba(15,92,83,0.3);">
                      Open Hisab Kitab &rarr;
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF8F5; border-top: 1px solid #E5E0D8; padding: 22px 32px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #7B8580; line-height: 1.6;">
                You are receiving this automated daily pulse from <strong>Hisab Kitab</strong>.<br>
                Currency: <strong>${currency}</strong> &bull; All split calculations rounded to whole integers.
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

  await sgMail.send({
    to,
    from: process.env.SENDGRID_FROM_EMAIL!,
    subject: `Daily Expense Summary • ${sym}${Math.round(grandTotal).toLocaleString()} spent today`,
    text,
    html,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}