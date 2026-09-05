import sgMail from "@sendgrid/mail";
import { getCurrencySymbol } from "./currency";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export interface ExpenseItemSummary {
  description: string;
  amount: number;
  category?: string | null;
  accountName?: string | null;
}

export interface SharedExpenseItemSummary {
  id: string;
  description: string;
  workspaceName: string;
  totalAmount: number;
  myShare: number;
  category?: string | null;
  paidBy?: string;
  accountName?: string | null;
  splitCount?: number;
}

export interface WorkspaceSummary {
  workspaceName: string;
  total: number;
  expenses?: SharedExpenseItemSummary[];
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
  const personalList = options?.personalExpenses || [];
  const totalSharedItems = workspaceSummaries.reduce(
    (sum, w) => sum + (w.expenses?.length || (w.total > 0 ? 1 : 0)),
    0
  );

  const dateFormatted =
    options?.dateStr ||
    new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // Plain text fallback formatting with full shared details
  const workspaceTextBlocks = workspaceSummaries
    .map((w) => {
      let block = `  • ${w.workspaceName}: Your Share = ${sym}${Math.round(w.total).toLocaleString()}\n`;
      if (w.expenses && w.expenses.length > 0) {
        block +=
          w.expenses
            .map(
              (exp) =>
                `      - ${exp.description}: Your Share ${sym}${Math.round(exp.myShare).toLocaleString()} (Total Bill: ${sym}${Math.round(exp.totalAmount).toLocaleString()}${exp.paidBy ? `, Paid by: ${exp.paidBy}` : ""}${exp.category ? `, Category: ${exp.category}` : ""})`
            )
            .join("\n") + "\n";
      }
      return block;
    })
    .join("\n");

  const personalTextBlocks = personalList
    .map(
      (p) =>
        `  • ${p.description}: ${sym}${Math.round(p.amount).toLocaleString()}${p.category ? ` [${p.category}]` : ""}${p.accountName ? ` via ${p.accountName}` : ""}`
    )
    .join("\n");

  const text = `Hi ${name},

Here is your daily expense summary for ${dateFormatted}:

==================================================
TOTAL OUTFLOW TODAY: ${sym}${Math.round(grandTotal).toLocaleString()}
  • Personal Expenses: ${sym}${Math.round(personalTotal).toLocaleString()} (${personalList.length} items)
  • Shared Workspace Share: ${sym}${Math.round(sharedTotal).toLocaleString()} (${totalSharedItems} items)
==================================================

💳 PERSONAL EXPENSES:
${personalTextBlocks || "  • No personal expenses recorded today."}

👥 SHARED WORKSPACES:
${workspaceTextBlocks || "  • No shared workspace activity today."}

View your real-time ledger on Hisab Kitab:
https://hisab.awaisnazir.tech/dashboard

— Hisab Kitab Daily Pulse`;

  // Itemized personal expenses rows HTML
  const personalRowsHtml =
    personalList.length > 0
      ? personalList
          .map(
            (e) => `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE6; color: #162B27; font-size: 13px; vertical-align: top;">
            <div style="font-weight: 600; color: #162B27; line-height: 1.3;">
              ${escapeHtml(e.description)}
            </div>
            <div style="margin-top: 3px; font-size: 11px; color: #6B7268;">
              ${
                e.category
                  ? `<span style="display: inline-block; background-color: #E8F5F1; color: #0F5C53; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-right: 5px;">${escapeHtml(
                      e.category
                    )}</span>`
                  : ""
              }
              ${
                e.accountName
                  ? `<span style="display: inline-block; background-color: #F3EFEA; color: #5A6863; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px;">💳 ${escapeHtml(
                      e.accountName
                    )}</span>`
                  : ""
              }
            </div>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE6; color: #162B27; font-size: 13px; font-weight: 700; text-align: right; vertical-align: top; font-family: monospace;">
            -${sym}${Math.round(e.amount).toLocaleString()}
          </td>
        </tr>
      `
          )
          .join("")
      : `
        <tr>
          <td colspan="2" style="padding: 10px 0; color: #8A9691; font-size: 13px; font-style: italic;">
            No personal expenses recorded today.
          </td>
        </tr>
      `;

  // Itemized shared workspace expenses HTML
  const workspaceBlocksHtml =
    workspaceSummaries.length > 0
      ? workspaceSummaries
          .map((w) => {
            const expenseRows =
              w.expenses && w.expenses.length > 0
                ? w.expenses
                    .map(
                      (exp) => `
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #F0ECE6; color: #162B27; font-size: 13px; vertical-align: top;">
                    <div style="font-weight: 600; color: #162B27; line-height: 1.3;">
                      ${escapeHtml(exp.description)}
                    </div>
                    <div style="margin-top: 3px; font-size: 11px; color: #6B7268; line-height: 1.4;">
                      ${
                        exp.category
                          ? `<span style="display: inline-block; background-color: #E8F5F1; color: #0F5C53; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-right: 5px;">${escapeHtml(
                              exp.category
                            )}</span>`
                          : ""
                      }
                      <span style="color: #6B7268;">Total Bill: <strong>${sym}${Math.round(
                        exp.totalAmount
                      ).toLocaleString()}</strong></span>
                      ${
                        exp.paidBy
                          ? ` &bull; <span style="color: #4A5752;">Paid by <strong>${escapeHtml(
                              exp.paidBy
                            )}</strong></span>`
                          : ""
                      }
                      ${
                        exp.splitCount && exp.splitCount > 1
                          ? ` &bull; <span style="color: #6B7268;">Split: ${exp.splitCount} members</span>`
                          : ""
                      }
                      ${
                        exp.accountName
                          ? ` &bull; <span style="color: #6B7268;">${escapeHtml(
                              exp.accountName
                            )}</span>`
                          : ""
                      }
                    </div>
                  </td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #F0ECE6; text-align: right; vertical-align: top; white-space: nowrap;">
                    <div style="color: #0F5C53; font-size: 14px; font-weight: 800; font-family: monospace;">
                      ${sym}${Math.round(exp.myShare).toLocaleString()}
                    </div>
                    <div style="font-size: 10px; color: #8A9691; text-transform: uppercase; font-weight: 700;">
                      Your Split
                    </div>
                  </td>
                </tr>
              `
                    )
                    .join("")
                : `
                <tr>
                  <td style="padding: 10px 12px; color: #162B27; font-size: 13px;">Total workspace share</td>
                  <td style="padding: 10px 12px; text-align: right; color: #0F5C53; font-size: 14px; font-weight: 700; font-family: monospace;">
                    ${sym}${Math.round(w.total).toLocaleString()}
                  </td>
                </tr>
              `;

            return `
            <div style="margin-bottom: 14px; background-color: #FAF8F5; border: 1px solid #E5E0D8; border-radius: 14px; overflow: hidden;">
              <!-- Workspace Subheader -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F1ECE4; border-bottom: 1px solid #E5E0D8;">
                <tr>
                  <td style="padding: 9px 12px; font-size: 11px; font-weight: 700; color: #162B27; text-transform: uppercase; letter-spacing: 0.8px;">
                    📁 ${escapeHtml(w.workspaceName)}
                  </td>
                  <td align="right" style="padding: 9px 12px; font-size: 11px; font-weight: 700; color: #0F5C53;">
                    Subtotal: ${sym}${Math.round(w.total).toLocaleString()}
                  </td>
                </tr>
              </table>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FFFFFF;">
                ${expenseRows}
              </table>
            </div>
          `;
          })
          .join("")
      : `
        <div style="padding: 14px; background-color: #FAF8F5; border-radius: 12px; border: 1px dashed #D6D0C7; text-align: center; color: #8A9691; font-size: 12px;">
          No shared workspace activity recorded today.
        </div>
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
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 1px solid #E5E0D8; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
          
          <!-- Top Emerald Header Banner -->
          <tr>
            <td style="background-color: #0F5C53; padding: 28px 32px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(255,255,255,0.18); color: #FFFFFF; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 10px; border-radius: 6px; margin-bottom: 8px;">
                      Daily Ledger Pulse
                    </span>
                    <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: Georgia, serif;">
                      Hisab Kitab
                    </h1>
                  </td>
                  <td align="right" style="color: #A3D9D2; font-size: 12px; font-weight: 600; vertical-align: bottom;">
                    ${dateFormatted}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 28px 32px;">
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.5; color: #3A4D48;">
                Hi <strong>${escapeHtml(name)}</strong>, here is your breakdown of expenses and shared workspace splits recorded today:
              </p>

              <!-- Hero Stat Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; border: 1px solid #E5E0D8; border-radius: 18px; margin-bottom: 26px;">
                <tr>
                  <td style="padding: 22px 20px; text-align: center;">
                    <span style="display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #6B7268; margin-bottom: 4px;">
                      Total Outflow Today
                    </span>
                    <span style="display: block; font-size: 38px; font-weight: 800; color: #0F5C53; letter-spacing: -1px; font-family: Georgia, serif; line-height: 1.1;">
                      ${sym}${Math.round(grandTotal).toLocaleString()}
                    </span>
                    <div style="margin-top: 10px; display: inline-block;">
                      <span style="display: inline-block; background-color: #FFFFFF; border: 1px solid #E5E0D8; padding: 4px 10px; border-radius: 8px; font-size: 11px; color: #3A4D48; margin: 2px;">
                        💳 Personal: <strong>${sym}${Math.round(personalTotal).toLocaleString()}</strong> (${personalList.length})
                      </span>
                      <span style="display: inline-block; background-color: #FFFFFF; border: 1px solid #E5E0D8; padding: 4px 10px; border-radius: 8px; font-size: 11px; color: #3A4D48; margin: 2px;">
                        👥 Shared Splits: <strong>${sym}${Math.round(sharedTotal).toLocaleString()}</strong> (${totalSharedItems})
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Section 1: Personal Expenses Breakdown -->
              <div style="margin-bottom: 26px;">
                <div style="border-bottom: 2px solid #0F5C53; padding-bottom: 6px; margin-bottom: 12px;">
                  <h3 style="margin: 0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0F5C53;">
                    💳 Personal Expenses (${personalList.length})
                  </h3>
                </div>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  ${personalRowsHtml}
                </table>
              </div>

              <!-- Section 2: Shared Workspace Expenses Breakdown (Detailed) -->
              <div style="margin-bottom: 28px;">
                <div style="border-bottom: 2px solid #0F5C53; padding-bottom: 6px; margin-bottom: 14px;">
                  <h3 style="margin: 0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0F5C53;">
                    👥 Shared Workspaces &amp; Splits (${totalSharedItems})
                  </h3>
                </div>
                ${workspaceBlocksHtml}
              </div>

              <!-- Call to Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="text-align: center; margin-bottom: 8px;">
                <tr>
                  <td align="center">
                    <a href="https://hisab.awaisnazir.tech/dashboard" style="display: inline-block; background-color: #0F5C53; color: #FFFFFF; font-size: 14px; font-weight: 700; text-decoration: none; padding: 13px 32px; border-radius: 12px; box-shadow: 0 3px 8px rgba(15,92,83,0.3);">
                      Open Hisab Kitab Dashboard &rarr;
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
                Currency: <strong>${currency}</strong> &bull; Splits &amp; balances reflect your active share of group ledger books.
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