import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

export type SendSesEmailParams = {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string[];
  tags?: Record<string, string | number | null | undefined>;
};

const resolveAwsRegion = (): string | null => {
  const region = (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '').trim();
  return region ? region : null;
};

const resolveFromEmail = (): { email: string; name?: string } | null => {
  const email = (process.env.SES_FROM_EMAIL || '').trim();
  if (!email) return null;
  const name = (process.env.SES_FROM_NAME || '').trim();
  return name ? { email, name } : { email };
};

const resolveConfigurationSetName = (): string | null => {
  const value = (process.env.SES_CONFIGURATION_SET || '').trim();
  return value || null;
};

export const isSesConfigured = (): boolean => {
  const region = resolveAwsRegion();
  const from = resolveFromEmail();
  return Boolean(region && from?.email);
};

let sesClient: SESv2Client | null = null;

const getSesClient = (): SESv2Client => {
  if (sesClient) return sesClient;
  const region = resolveAwsRegion();
  if (!region) {
    throw new Error('Missing AWS_REGION (or AWS_DEFAULT_REGION) for SES');
  }
  sesClient = new SESv2Client({ region });
  return sesClient;
};

const formatFromAddress = (): string => {
  const from = resolveFromEmail();
  if (!from) {
    throw new Error('Missing SES_FROM_EMAIL for SES');
  }
  // SES generally accepts RFC 5322 mailbox format with an optional display name.
  if (from.name) return `${from.name} <${from.email}>`;
  return from.email;
};

export async function sendSesEmail(params: SendSesEmailParams): Promise<{ messageId: string | null }> {
  const { to, subject, html, text, replyTo, tags } = params;
  const configurationSetName = resolveConfigurationSetName();

  const toAddresses = (to || []).map((v) => String(v || '').trim()).filter(Boolean);
  if (toAddresses.length === 0) {
    throw new Error('sendSesEmail: missing "to" recipients');
  }

  const subjectValue = String(subject || '').trim();
  if (!subjectValue) {
    throw new Error('sendSesEmail: missing "subject"');
  }

  const hasHtml = Boolean(html && String(html).trim());
  const hasText = Boolean(text && String(text).trim());
  if (!hasHtml && !hasText) {
    throw new Error('sendSesEmail: missing "html" and "text" content');
  }

  const emailTags = Object.entries(tags || {})
    .map(([Name, rawValue]) => {
      const value = rawValue == null ? '' : String(rawValue).trim();
      return { Name: Name.trim(), Value: value.slice(0, 256) };
    })
    .filter((tag) => Boolean(tag.Name) && Boolean(tag.Value))
    .slice(0, 20);

  const cmd = new SendEmailCommand({
    FromEmailAddress: formatFromAddress(),
    ...(configurationSetName ? { ConfigurationSetName: configurationSetName } : {}),
    Destination: {
      ToAddresses: toAddresses,
    },
    ReplyToAddresses: (replyTo || []).map((v) => String(v || '').trim()).filter(Boolean),
    Content: {
      Simple: {
        Subject: { Data: subjectValue, Charset: 'UTF-8' },
        Body: {
          ...(hasHtml ? { Html: { Data: String(html), Charset: 'UTF-8' } } : {}),
          ...(hasText ? { Text: { Data: String(text), Charset: 'UTF-8' } } : {}),
        },
      },
    },
    EmailTags: emailTags,
  });

  const result = await getSesClient().send(cmd);
  return { messageId: result.MessageId ?? null };
}
