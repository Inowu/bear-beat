import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { sendEmail } from '../../email';
import { publicProcedure } from '../../procedures/public.procedure';
import { router } from '../../trpc';
import {
  getEmailTemplateCatalog,
  getEmailTemplateCatalogEntry,
  normalizeEmailTemplateLookupKey,
  renderDefaultEmailTemplate,
} from '../../email/templateCatalog';
import {
  getEmailTemplateOverride,
  invalidateEmailTemplateOverrideCache,
  renderEmailTemplateContent,
  resolveEmailTemplateContent,
} from '../../email/templateOverrides';
import { RolesNames } from '../auth/interfaces/roles.interface';
import { createAdminAuditLog } from '../utils/adminAuditLog';

const templateKeyInputSchema = z.object({
  templateKey: z.string().trim().min(1).max(120),
});

const saveOverrideInputSchema = z
  .object({
    templateKey: z.string().trim().min(1).max(120),
    enabled: z.boolean().optional(),
    subject: z.string().max(191).optional().nullable(),
    html: z.string().max(300_000).optional().nullable(),
    text: z.string().max(300_000).optional().nullable(),
  })
  .refine(
    (input) =>
      input.enabled !== undefined
      || input.subject !== undefined
      || input.html !== undefined
      || input.text !== undefined,
    {
      message: 'No hay cambios para guardar',
    },
  );

const sendTestInputSchema = z.object({
  templateKey: z.string().trim().min(1).max(120),
  toEmail: z.string().email().max(255),
  useDraft: z.boolean().optional().default(false),
  subject: z.string().max(191).optional().nullable(),
  html: z.string().max(300_000).optional().nullable(),
  text: z.string().max(300_000).optional().nullable(),
});

const assertAdminRole = (role?: string): void => {
  if (role !== RolesNames.admin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Solo admin puede gestionar plantillas de email',
    });
  }
};

const normalizeSubject = (
  value: string | null | undefined,
): string | null => {
  if (value == null) return null;
  const normalized = String(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;
  return normalized.slice(0, 191);
};

const normalizeBody = (
  value: string | null | undefined,
): string | null => {
  if (value == null) return null;
  const normalized = String(value).replace(/\r\n/g, '\n');
  if (!normalized.trim()) return null;
  return normalized;
};

export const adminEmailTemplatesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    assertAdminRole(ctx.session?.user?.role);

    const catalog = getEmailTemplateCatalog();
    const overrides = await ctx.prisma.emailTemplateOverride.findMany({
      select: {
        template_key: true,
        enabled: true,
        updated_at: true,
        updated_by_user_id: true,
      },
    });

    const overrideByKey = new Map(overrides.map((row) => [row.template_key, row]));

    return catalog.map((template) => {
      const override = overrideByKey.get(template.key);

      return {
        templateKey: template.key,
        label: template.label,
        description: template.description,
        category: template.category,
        tokens: template.tokens,
        hasOverride: Boolean(override),
        enabled: override?.enabled ?? false,
        updatedAt: override?.updated_at?.toISOString() ?? null,
        updatedByUserId: override?.updated_by_user_id ?? null,
      };
    });
  }),

  get: publicProcedure
    .input(templateKeyInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);

      const normalizedTemplateKey = normalizeEmailTemplateLookupKey(input.templateKey);
      if (!normalizedTemplateKey) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Template key inválido',
        });
      }

      const catalogEntry = getEmailTemplateCatalogEntry(normalizedTemplateKey);
      const defaultContent = renderDefaultEmailTemplate(normalizedTemplateKey);
      const override = await getEmailTemplateOverride({
        templateKey: normalizedTemplateKey,
        prisma: ctx.prisma,
        bypassCache: true,
      });

      const effective = await resolveEmailTemplateContent({
        templateKey: normalizedTemplateKey,
        fallback: defaultContent,
        variables: catalogEntry.sampleVariables,
        prisma: ctx.prisma,
      });

      return {
        templateKey: normalizedTemplateKey,
        label: catalogEntry.label,
        description: catalogEntry.description,
        category: catalogEntry.category,
        tokens: catalogEntry.tokens,
        sampleVariables: catalogEntry.sampleVariables,
        defaultContent,
        override: override
          ? {
              enabled: override.enabled,
              subject: override.subject,
              html: override.html,
              text: override.text,
              updatedAt: override.updated_at.toISOString(),
              updatedByUserId: override.updated_by_user_id,
            }
          : null,
        effectiveContent: effective,
      };
    }),

  saveOverride: publicProcedure
    .input(saveOverrideInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);

      const normalizedTemplateKey = normalizeEmailTemplateLookupKey(input.templateKey);
      if (!normalizedTemplateKey) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Template key inválido',
        });
      }

      const actorUserId = ctx.session?.user?.id ?? null;
      const nextSubject =
        input.subject === undefined ? undefined : normalizeSubject(input.subject);
      const nextHtml = input.html === undefined ? undefined : normalizeBody(input.html);
      const nextText = input.text === undefined ? undefined : normalizeBody(input.text);

      const existing = await ctx.prisma.emailTemplateOverride.findUnique({
        where: { template_key: normalizedTemplateKey },
        select: {
          id: true,
          template_key: true,
          enabled: true,
          subject: true,
          html: true,
          text: true,
        },
      });

      const updateData: {
        enabled?: boolean;
        subject?: string | null;
        html?: string | null;
        text?: string | null;
        updated_by_user_id?: number | null;
      } = {
        updated_by_user_id: actorUserId,
      };

      if (input.enabled !== undefined) updateData.enabled = input.enabled;
      if (nextSubject !== undefined) updateData.subject = nextSubject;
      if (nextHtml !== undefined) updateData.html = nextHtml;
      if (nextText !== undefined) updateData.text = nextText;

      const saved = existing
        ? await ctx.prisma.emailTemplateOverride.update({
            where: { template_key: normalizedTemplateKey },
            data: updateData,
            select: {
              template_key: true,
              enabled: true,
              subject: true,
              html: true,
              text: true,
              updated_at: true,
              updated_by_user_id: true,
            },
          })
        : await ctx.prisma.emailTemplateOverride.create({
            data: {
              template_key: normalizedTemplateKey,
              enabled: input.enabled ?? true,
              subject: nextSubject ?? null,
              html: nextHtml ?? null,
              text: nextText ?? null,
              updated_by_user_id: actorUserId,
            },
            select: {
              template_key: true,
              enabled: true,
              subject: true,
              html: true,
              text: true,
              updated_at: true,
              updated_by_user_id: true,
            },
          });

      invalidateEmailTemplateOverrideCache(normalizedTemplateKey);

      if (actorUserId) {
        await createAdminAuditLog({
          prisma: ctx.prisma,
          req: ctx.req,
          actorUserId,
          action: 'email_template_override_saved',
          metadata: {
            templateKey: normalizedTemplateKey,
            enabled: saved.enabled,
            hasSubjectOverride: Boolean(saved.subject),
            hasHtmlOverride: Boolean(saved.html),
            hasTextOverride: Boolean(saved.text),
          },
        });
      }

      return {
        templateKey: saved.template_key,
        enabled: saved.enabled,
        subject: saved.subject,
        html: saved.html,
        text: saved.text,
        updatedAt: saved.updated_at.toISOString(),
        updatedByUserId: saved.updated_by_user_id,
      };
    }),

  resetOverride: publicProcedure
    .input(templateKeyInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);

      const normalizedTemplateKey = normalizeEmailTemplateLookupKey(input.templateKey);
      if (!normalizedTemplateKey) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Template key inválido',
        });
      }

      const result = await ctx.prisma.emailTemplateOverride.deleteMany({
        where: { template_key: normalizedTemplateKey },
      });

      invalidateEmailTemplateOverrideCache(normalizedTemplateKey);

      const actorUserId = ctx.session?.user?.id;
      if (actorUserId) {
        await createAdminAuditLog({
          prisma: ctx.prisma,
          req: ctx.req,
          actorUserId,
          action: 'email_template_override_reset',
          metadata: {
            templateKey: normalizedTemplateKey,
            removed: result.count,
          },
        });
      }

      return {
        ok: true,
        removed: result.count,
      };
    }),

  sendTest: publicProcedure
    .input(sendTestInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);

      const normalizedTemplateKey = normalizeEmailTemplateLookupKey(input.templateKey);
      if (!normalizedTemplateKey) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Template key inválido',
        });
      }

      const catalogEntry = getEmailTemplateCatalogEntry(normalizedTemplateKey);
      const defaultContent = renderDefaultEmailTemplate(normalizedTemplateKey);

      const content = input.useDraft
        ? (() => {
            const draft = {
              subject: normalizeSubject(input.subject) ?? defaultContent.subject,
              html: normalizeBody(input.html) ?? defaultContent.html,
              text: normalizeBody(input.text) ?? defaultContent.text,
            };

            const rendered = renderEmailTemplateContent({
              content: draft,
              variables: catalogEntry.sampleVariables,
            });

            return {
              subject: rendered.subject || defaultContent.subject,
              html: rendered.html || defaultContent.html,
              text: rendered.text || defaultContent.text,
            };
          })()
        : await resolveEmailTemplateContent({
            templateKey: normalizedTemplateKey,
            fallback: defaultContent,
            variables: catalogEntry.sampleVariables,
            prisma: ctx.prisma,
          });

      const sendResult = await sendEmail({
        to: [input.toEmail],
        subject: content.subject,
        html: content.html,
        text: content.text,
        tags: {
          action_key: 'admin_template_test',
          template_key: normalizedTemplateKey,
          stage: '0',
        },
      });

      const actorUserId = ctx.session?.user?.id;
      if (actorUserId) {
        await createAdminAuditLog({
          prisma: ctx.prisma,
          req: ctx.req,
          actorUserId,
          action: 'email_template_test_sent',
          metadata: {
            templateKey: normalizedTemplateKey,
            usedDraft: Boolean(input.useDraft),
            delivered: Boolean(sendResult.messageId),
          },
        });
      }

      return {
        ok: true,
        messageId: sendResult.messageId,
        templateKey: normalizedTemplateKey,
        usedDraft: Boolean(input.useDraft),
      };
    }),
});
