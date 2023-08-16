import fs from 'fs';
import tmp from 'tmp';
import { z } from 'zod';
import Ffmpeg from 'fluent-ffmpeg';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';

export const demo = shieldedProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path }, ctx: { prisma } }) => {
    const fullPath = `${process.env.SONGS_PATH}${path}`;
    const fileExists = fs.existsSync(fullPath);

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

    const demoString = await generateDemo(fullPath, demoDuration);

    return {
      demo: demoString,
    };
  });

const generateDemo = (path: string, duration: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const tempFile = tmp.fileSync({ prefix: 'mp4' });

    const demoVideo = Ffmpeg({
      logger: console,
    })
      .input(path)
      .inputOptions(['-to', `${duration}`])
      .format('mp4')
      // .on('start', (cmdLine) => console.log(cmdLine))
      .output(tempFile.name);

    // Run the FFmpeg process
    demoVideo.on('end', () => {
      const fileContents = fs.readFileSync(tempFile.name);
      const base64Contents = fileContents.toString('base64');
      tempFile.removeCallback();
      resolve(base64Contents);
    });

    demoVideo.on('error', (error) => {
      tempFile.removeCallback();
      reject(error);
    });

    demoVideo.run();
  });
