import { appRouter } from '../src/routers';
import { RolesNames } from '../src/routers/auth/interfaces/roles.interface';
import { sendEmail } from '../src/email';

jest.mock('../src/email', () => ({
  sendEmail: jest.fn(),
}));

const sendEmailMock = sendEmail as jest.Mock;

const createPrismaMock = () => ({
  emailTemplateOverride: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  adminAuditLog: {
    create: jest.fn(),
  },
});

const createCaller = (
  prismaMock: ReturnType<typeof createPrismaMock>,
  role: RolesNames = RolesNames.admin,
) =>
  appRouter.createCaller({
    req: { headers: {} } as any,
    res: {} as any,
    prisma: prismaMock as any,
    session: {
      user: {
        id: 11,
        role,
      } as any,
    },
  });

describe('admin.emailTemplates router', () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
  });

  it('lists catalog templates with override metadata', async () => {
    const prismaMock = createPrismaMock();
    const caller = createCaller(prismaMock);

    prismaMock.emailTemplateOverride.findMany.mockResolvedValue([
      {
        template_key: 'welcome',
        enabled: true,
        updated_at: new Date('2026-02-19T18:00:00.000Z'),
        updated_by_user_id: 99,
      },
    ]);

    const result = await caller.admin.emailTemplates.list();

    expect(prismaMock.emailTemplateOverride.findMany).toHaveBeenCalled();
    expect(result.length).toBeGreaterThan(5);

    const welcome = result.find((item: any) => item.templateKey === 'welcome');
    expect(welcome).toBeDefined();
    expect(welcome).toMatchObject({
      templateKey: 'welcome',
      hasOverride: true,
      enabled: true,
      updatedByUserId: 99,
    });
  });

  it('returns template detail with effective content', async () => {
    const prismaMock = createPrismaMock();
    const caller = createCaller(prismaMock);

    prismaMock.emailTemplateOverride.findUnique.mockResolvedValue({
      template_key: 'welcome',
      enabled: true,
      subject: 'Hola {{NAME}}',
      html: '<p>Hola {{NAME}}</p>',
      text: 'Hola {{NAME}}',
      updated_at: new Date('2026-02-19T18:05:00.000Z'),
      updated_by_user_id: 99,
    });

    const result = await caller.admin.emailTemplates.get({ templateKey: 'welcome' });

    expect(result.templateKey).toBe('welcome');
    expect(result.override?.enabled).toBe(true);
    expect(result.effectiveContent.subject).toContain('Gustavo');
    expect(result.effectiveContent.html).toContain('Gustavo');
    expect(result.tokens).toContain('NAME');
  });

  it('saves an override and records admin audit log', async () => {
    const prismaMock = createPrismaMock();
    const caller = createCaller(prismaMock);

    prismaMock.emailTemplateOverride.findUnique.mockResolvedValue(null);
    prismaMock.emailTemplateOverride.create.mockResolvedValue({
      template_key: 'welcome',
      enabled: true,
      subject: 'Nuevo subject',
      html: '<p>Nuevo</p>',
      text: 'Nuevo',
      updated_at: new Date('2026-02-19T18:10:00.000Z'),
      updated_by_user_id: 11,
    });

    const result = await caller.admin.emailTemplates.saveOverride({
      templateKey: 'welcome',
      enabled: true,
      subject: 'Nuevo subject',
      html: '<p>Nuevo</p>',
      text: 'Nuevo',
    });

    expect(prismaMock.emailTemplateOverride.create).toHaveBeenCalled();
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalled();
    expect(result).toMatchObject({
      templateKey: 'welcome',
      enabled: true,
      subject: 'Nuevo subject',
    });
  });

  it('resets an override', async () => {
    const prismaMock = createPrismaMock();
    const caller = createCaller(prismaMock);

    prismaMock.emailTemplateOverride.deleteMany.mockResolvedValue({ count: 1 });

    const result = await caller.admin.emailTemplates.resetOverride({
      templateKey: 'welcome',
    });

    expect(prismaMock.emailTemplateOverride.deleteMany).toHaveBeenCalledWith({
      where: { template_key: 'welcome' },
    });
    expect(result).toEqual({ ok: true, removed: 1 });
  });

  it('sends a draft test email', async () => {
    const prismaMock = createPrismaMock();
    const caller = createCaller(prismaMock);

    sendEmailMock.mockResolvedValue({ messageId: 'ses-msg-123' });

    const result = await caller.admin.emailTemplates.sendTest({
      templateKey: 'welcome',
      toEmail: 'admin@example.com',
      useDraft: true,
      subject: 'Hola {{NAME}}',
      html: '<p>Hola {{NAME}}</p>',
      text: 'Hola {{NAME}}',
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['admin@example.com'],
      }),
    );
    expect(result).toEqual({
      ok: true,
      messageId: 'ses-msg-123',
      templateKey: 'welcome',
      usedDraft: true,
    });
  });

  it('blocks non-admin users', async () => {
    const prismaMock = createPrismaMock();
    const caller = createCaller(prismaMock, RolesNames.normal);

    await expect(caller.admin.emailTemplates.list()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
