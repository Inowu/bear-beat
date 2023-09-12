import fs from 'fs';
import path from 'path';
// import tmp from 'tmp';
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

    if (!fileExists) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'That file does not exist',
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
      path.basename(demoPath),
    );

    if (await fileService.exists(demoOutputPath)) {
      return {
        demo: `/demos/${demoPath}`,
      };
    }

    await generateDemo(fullPath, demoDuration, demoOutputPath);

    return {
      demo: `/demos/${demoPath}`,
    };
  });

const generateDemo = (
  path: string,
  duration: number,
  outputPath: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const demoVideo = Ffmpeg({
      logger: console,
    })
      .input(fs.createReadStream(path))
      .inputOptions(['-to', `${duration}`])
      .format('mp3')
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
