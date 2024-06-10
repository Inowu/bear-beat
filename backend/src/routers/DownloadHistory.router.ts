import { z } from 'zod';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import { extendedAccountPostfix } from '../utils/constants';

interface DownloadHistory {
    id: number;
    userId: number;
    size: bigint;
    date: Date;
    fileName: string;
    isFolder: boolean;
    email: string;
    phone: string;
}

export const downloadHistoryRouter = router({
    getDownloadHistory: shieldedProcedure
        .input(
            z.object({
                skip: z.number().optional(),
                take: z.number().optional(),
                orderBy: z.any(),
                where: z.object({
                    userId: z.number()
                }).optional(),
                select: z.any(),
            }),
        )
        .query(async ({ ctx: { prisma }, input }) => {
            let filters = '';
            if (input.where) {
                filters = `WHERE userId = ${input.where.userId}`;
            }

            const countQuery = `SELECT COUNT(*) as totalCount 
                FROM download_history dh
                INNER JOIN users u ON dh.userId = u.id
                ${filters}`;

            // Set pagination or not based on offset and limit being defined.
            const limitOffset = (input.take)
                ? `LIMIT ${input.take} OFFSET ${input.skip}`
                : '';

            const query = `SELECT dh.*, u.email, u.phone
                FROM download_history dh
                INNER JOIN users u ON dh.userId = u.id
                ${filters}
                ORDER BY date DESC
                ${limitOffset};`;

            const count = await prisma.$queryRawUnsafe<any>(countQuery);
            const results = await prisma.$queryRawUnsafe<DownloadHistory[]>(query);

            return {
                count: Number(count[0].totalCount),
                data: results,
            };
        }),
    getRemainingGigas: shieldedProcedure
        .input(
            z.object({
                userId: z.number()
            })
        )
        .query(async ({ ctx: { prisma }, input }) => {
            const ftpAccounts = await prisma.ftpUser.findMany({
                where: {
                    user_id: input.userId,
                },
            });

            let regularFtpUser = ftpAccounts.find(
                (ftpAccount) => !ftpAccount.userid.endsWith(extendedAccountPostfix),
            );

            if (ftpAccounts.length === 0 || !regularFtpUser) {
                return { remaining: 0 };
            }

            let quotaTallies = await prisma.ftpquotatallies.findFirst({
                where: {
                    name: regularFtpUser.userid,
                },
            });

            let quotaLimits = await prisma.ftpQuotaLimits.findFirst({
                where: {
                    name: regularFtpUser.userid,
                },
            });

            if (!quotaLimits || !quotaTallies) {
                return { remaining: 0 };
            }

            const availableBytes = quotaLimits.bytes_out_avail - quotaTallies.bytes_out_used;
            const availableGigas = Number(availableBytes) / (1024 * 1024 * 1024);
            return { remaining: availableGigas };
        })
});
