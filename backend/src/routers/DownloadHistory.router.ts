import { z } from 'zod';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';

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
                where: z.any(),
                select: z.any(),
            }),
        )
        .query(async ({ ctx: { prisma }, input }) => {

            const countQuery = `SELECT COUNT(*) as totalCount 
                FROM download_history dh
                INNER JOIN users u ON dh.userId = u.id `;

            // Set pagination or not based on offset and limit being defined.
            const limitOffset = (input.take && input.skip)
                ? `LIMIT ${input.take} OFFSET ${input.skip}`
                : '';

            const query = `SELECT dh.*, u.email, u.phone
                FROM download_history dh
                INNER JOIN users u ON dh.userId = u.id
                ORDER BY date DESC
                ${limitOffset};`;

            const count = await prisma.$queryRawUnsafe<any>(countQuery);
            const results = await prisma.$queryRawUnsafe<DownloadHistory[]>(query);
            console.log('this results', results)
            
            return {
                count: Number(count[0].totalCount),
                data: results,
            };
        }),
});
