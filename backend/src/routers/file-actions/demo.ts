import path from 'path';
import { z } from 'zod';
import Ffmpeg from 'fluent-ffmpeg';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { fileService } from '../../ftp';
import { log } from '../../server';

export const demo = shieldedProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path: demoPath }, ctx: { prisma } }) => {
    const fullPath = path.join(process.env.SONGS_PATH as string, demoPath);
    const fileExists = await fileService.exists(fullPath);
    const demoFileName = path.basename(demoPath);
    const encodedDemoFileName = encodeURIComponent(demoFileName);

    if (!fileExists) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No existe este archivo para demo',
      });
    }

    const config = await prisma.config.findFirst({
      where: {
        name: 'time_demos',
      },
    });

    const demoDuration = config?.value ? Number(config.value) : 60;
    const demoOutputPath = path.join(
      process.env.DEMOS_PATH as string,
      demoFileName,
    );

    if (await fileService.exists(demoOutputPath)) {
      return {
        demo: `/demos/${encodedDemoFileName}`,
      };
    }

    log.info(`[DEMOS] Generating demo for ${demoPath}`);

    try {
      await generateDemo(fullPath, demoDuration, demoOutputPath);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'No pudimos preparar el demo. Reintenta en unos segundos.',
        cause: error,
      });
    }

    return {
      demo: `/demos/${encodedDemoFileName}`,
    };
  });

const generateDemo = (
  filePath: string,
  duration: number,
  outputPath: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const demoVideo = Ffmpeg({
      logger: console,
    })
      .input(filePath)
      .inputOptions(['-to', `${duration}`])
      .inputOptions(['-ss 0', `-to ${duration}`])
      .videoCodec('copy') // Copy video stream
      .audioCodec('copy') // Copy audio stream
      // .on('start', (cmdLine) => console.log(cmdLine))
      .output(outputPath);

    // // Run the FFmpeg process
    demoVideo.on('end', () => {
      // const fileContents = fs.readFileSync(tempFile.name);
      // const base64Contents = fileContents.toString('base64');
      // tempFile.removeCallback();
      resolve();
    });

    demoVideo.on('error', (error) => {
      // tempFile.removeCallback();
      log.error(`[DEMOS] Error while generating demo: ${error}`);
      reject(error);
    });

    demoVideo.run();
  });
