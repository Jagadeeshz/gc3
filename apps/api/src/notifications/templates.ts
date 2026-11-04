import type { EventEmailPayload, InviteEmailPayload } from './types';

/**
 * Email rendering, in one place.
 *
 * Two rules hold for every template here:
 *  - every tenant-supplied string (organization name, request title, person's
 *    name) is escaped before it reaches HTML — none of it is trusted as markup;
 *  - the plain-text alternative carries the same information as the HTML, because
 *    a notification that only works in a rich client is not a notification.
 */

/** Escapes tenant-supplied text for HTML interpolation. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** The shared dark card shell, so every email looks like it came from one product. */
function shell(input: { heading: string; bodyHtml: string; footHtml: string }): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#07080b;color:#f4f0e8;font-family:system-ui,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:32px 16px">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
               style="background:#11141a;border:1px solid rgba(244,240,232,0.12);border-radius:14px">
          <tr><td style="padding:28px 28px 0">
            <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#a7a9b0">GC³ Portal</p>
            <h1 style="margin:10px 0 0;font-size:22px;line-height:1.25;color:#f4f0e8">${input.heading}</h1>
          </td></tr>
          <tr><td style="padding:16px 28px 0;font-size:14px;line-height:1.6;color:#a7a9b0">
            ${input.bodyHtml}
          </td></tr>
          <tr><td style="padding:16px 28px 28px;font-size:12px;line-height:1.6;color:#a7a9b0">
            ${input.footHtml}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}"
     style="display:inline-block;padding:12px 18px;border-radius:10px;background:#d9b65d;color:#111318;font-weight:600;text-decoration:none">
    ${escapeHtml(label)}
  </a>`;
}

export function renderInvite(payload: InviteEmailPayload): RenderedEmail {
  const roles = payload.roles.join(', ');
  const expires = payload.expiresAt.toISOString();

  const subject =
    payload.kind === 'resent'
      ? `Reminder: your invitation to ${payload.organizationName} on GC³ Portal`
      : `You have been invited to ${payload.organizationName} on GC³ Portal`;

  const text = [
    `Hello ${payload.fullName},`,
    '',
    `${payload.organizationName} has invited you to the GC³ Portal as ${roles}.`,
    '',
    'Set your password and activate your account:',
    payload.inviteUrl,
    '',
    `This link expires on ${expires} and can only be used once.`,
    '',
    "If you weren't expecting this invitation you can ignore this email.",
    '',
    '— GC³ Portal',
  ].join('\n');

  const html = shell({
    heading: `You have been invited to ${escapeHtml(payload.organizationName)}`,
    bodyHtml: [
      `Hello ${escapeHtml(payload.fullName)}, you have been added as <strong style="color:#f4f0e8">${escapeHtml(roles)}</strong>.`,
      'Set a password to activate your account.',
      `<div style="padding:16px 0 0">${button(payload.inviteUrl, 'Set your password')}</div>`,
      `<div style="padding:16px 0 0">Or paste this link into your browser:<br><span style="color:#e2c777;word-break:break-all">${escapeHtml(payload.inviteUrl)}</span></div>`,
    ].join('<br>'),
    footHtml: `This link expires on ${escapeHtml(expires)} and can only be used once.`,
  });

  return { subject, text, html };
}

export function renderEvent(payload: EventEmailPayload): RenderedEmail {
  if (payload.kind === 'sla_risk') {
    const breached = payload.slaState === 'BREACHED';
    const stateLabel = breached ? 'past its delivery commitment' : 'at risk of breaching its SLA';
    const target = payload.slaTargetAt
      ? new Date(payload.slaTargetAt).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })
      : null;

    const subject = breached
      ? `SLA breached: ${payload.requestReference} needs attention`
      : `SLA at risk: ${payload.requestReference} is approaching its commitment`;

    const text = [
      `Hello ${payload.recipientName},`,
      '',
      `Request ${payload.requestReference} — ${payload.requestTitle} — is ${stateLabel}.`,
      target ? `Committed delivery: ${target} IST` : '',
      '',
      'You are the owner of this work. Re-plan it, or tell operations it will slip.',
      '',
      `Open it in the portal: ${payload.requestUrl}`,
      '',
      '— GC³ Portal',
    ]
      .filter(Boolean)
      .join('\n');

    const html = shell({
      heading: breached
        ? `SLA breached: ${escapeHtml(payload.requestReference)}`
        : `SLA at risk: ${escapeHtml(payload.requestReference)}`,
      bodyHtml: [
        `Hello ${escapeHtml(payload.recipientName)}, <strong style="color:#f4f0e8">${escapeHtml(payload.requestTitle)}</strong> is ${escapeHtml(stateLabel)}.`,
        target ? `Committed delivery: <strong style="color:#f4f0e8">${escapeHtml(target)} IST</strong>.` : '',
        '<div style="padding:16px 0 0">' +
          button(payload.requestUrl, 'Review the request') +
          '</div>',
      ]
        .filter(Boolean)
        .join('<br>'),
      footHtml: 'You are receiving this because you own or lead the pod for this request.',
    });

    return { subject, text, html };
  }

  if (payload.kind === 'deliverable_released') {
    const title = payload.deliverableTitle ?? 'A deliverable';
    const version = payload.deliverableVersion ? `v${payload.deliverableVersion}` : '';

    const subject = `Deliverable released: ${title} (${payload.requestReference})`;

    const text = [
      `Hello ${payload.recipientName},`,
      '',
      `${payload.organizationName} has released a deliverable for request ${payload.requestReference} — ${payload.requestTitle}.`,
      '',
      `Deliverable: ${title}${version ? ` (${version})` : ''}`,
      `Open it in the portal: ${payload.requestUrl}`,
      '',
      '— GC³ Portal',
    ].join('\n');

    const html = shell({
      heading: `Deliverable released: ${escapeHtml(title)}`,
      bodyHtml: [
        `Hello ${escapeHtml(payload.recipientName)}, a deliverable is now available against <strong style="color:#f4f0e8">${escapeHtml(payload.requestReference)}</strong> — ${escapeHtml(payload.requestTitle)}.`,
        version ? `Version <strong style="color:#f4f0e8">${escapeHtml(version)}</strong>.` : '',
        `<div style="padding:16px 0 0">${button(payload.requestUrl, 'Open the request')}</div>`,
      ]
        .filter(Boolean)
        .join('<br>'),
      footHtml: 'You are receiving this because your organization owns this request.',
    });

    return { subject, text, html };
  }

  const from = payload.fromStatus ? payload.fromStatus.replace(/_/g, ' ') : 'previously';
  const to = (payload.toStatus ?? 'updated').replace(/_/g, ' ');
  const subject = `Request ${payload.requestReference} is now ${to}`;

  const text = [
    `Hello ${payload.recipientName},`,
    '',
    `Request ${payload.requestReference} — ${payload.requestTitle} — moved from ${from} to ${to}.`,
    '',
    `Follow it in the portal: ${payload.requestUrl}`,
    '',
    '— GC³ Portal',
  ].join('\n');

  const html = shell({
    heading: `Request ${escapeHtml(payload.requestReference)} is now ${escapeHtml(to)}`,
    bodyHtml: [
      `Hello ${escapeHtml(payload.recipientName)}, <strong style="color:#f4f0e8">${escapeHtml(payload.requestTitle)}</strong> moved from ${escapeHtml(from)} to <strong style="color:#f4f0e8">${escapeHtml(to)}</strong>.`,
      `<div style="padding:16px 0 0">${button(payload.requestUrl, 'View the request')}</div>`,
    ].join('<br>'),
    footHtml: 'You are receiving this because you raised this request.',
  });

  return { subject, text, html };
}
