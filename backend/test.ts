import Stripe from 'stripe';
import { paypal } from './src/paypal';
import archiver from 'archiver';
import type { CompressionJob } from './src/queue/compression/types';
import fastFolderSizeSync from 'fast-folder-size/sync';
import { Queue, Worker } from 'bullmq';
import fs from 'fs';
import { config } from 'dotenv';
import {
  CustomersApi,
  SubscriptionsApi,
  PaymentMethodsApi,
  Configuration,
  OrdersApi,
} from 'conekta';
import axios from 'axios';
import path from 'path';

config();

async function main() {
  // try {
  //   const conektaConfig = new Configuration({
  //     apiKey: process.env.CONEKTA_TEST_KEY,
  //     accessToken: process.env.CONEKTA_TEST_KEY,
  //   });
  //
  //   const customersApi = new CustomersApi(conektaConfig);
  //
  //   try {
  //     const res = await customersApi.createCustomer({
  //       name: 'JDEZ94'.replace(/[^a-zA-Z0-9]/g, ''),
  //       email: 'john_bdc@hotmail.com',
  //       phone: '+52 4776820132',
  //       metadata: {
  //         id: 11356,
  //       },
  //     });
  //
  //     console.log(res);
  //   } catch (e) {
  //     console.log(e?.response?.data?.details);
  //   }
  // } catch (e) {
  //   console.log(e.type);
  //   console.log(e.raw.code);
  // }

  // STRIPE
  // const stripeInstance = new Stripe(process.env.STRIPE_TEST_KEY as string, {
  //   apiVersion: '2023-08-16',
  // });
  //
  // console.log(
  //   await stripeInstance.products.create({
  //     name: 'test product bearbeat',
  //     active: true,
  //     default_price_data: {
  //       currency: 'usd',
  //       unit_amount: 1000,
  //       recurring: {
  //         interval: 'month',
  //         interval_count: 1,
  //       },
  //     },
  //   }),
  // );

  // console.log({
  //   paypalUrl: paypal.paypalUrl(),
  //   clientId: paypal.clientId(),
  //   clientSecret: paypal.clientSecret(),
  // });
  // PAYPAL
  // const token = await paypal.getToken();

  // const res = await axios.get(
  //   `${paypal.paypalUrl()}/v1/catalogs/products`,
  //   // {
  //   //   name: 'test product bearbeat',
  //   //   type: 'DIGITAL',
  //   //   category: 'ECOMMERCE_SERVICES',
  //   //   home_url: 'https://thebearbeat.com',
  //   // },
  //   {
  //     headers: {
  //       Authorization: `Bearer ${token}`,
  //     },
  //   },
  // );
  //
  // console.log({
  //   paypalUrl: paypal.paypalUrl(),
  //   clientId: paypal.clientId(),
  //   clientSecret: paypal.clientSecret(),
  // });
  // const res = (
  //   await axios.post(
  //     `${paypal.paypalUrl()}/v1/billing/plans`,
  //     {
  //       product_id: 'PROD-6XD39077UM964502Y',
  //       name: 'test plan bearbeat',
  //       description: undefined,
  //       status: 'ACTIVE',
  //       billing_cycles: [
  //         {
  //           tenure_type: 'REGULAR',
  //           sequence: 1,
  //           total_cycles: 0,
  //           pricing_scheme: {
  //             fixed_price: {
  //               value: '18',
  //               currency_code: 'USD',
  //             },
  //           },
  //           frequency: {
  //             interval_unit: 'MONTH',
  //             interval_count: 1,
  //           },
  //         },
  //       ],
  //       payment_preferences: {
  //         auto_bill_outstanding: true,
  //         setup_fee: {
  //           value: '0',
  //           currency_code: 'USD',
  //         },
  //       },
  //     },
  //     {
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //       },
  //     },
  //   )
  // ).data;

  // const res = (
  //   await axios(
  //     `${paypal.paypalUrl()}/v1/billing/subscriptions/I-M9U0UXA9XLU0`,
  //     { headers: { Authorization: `Bearer ${token}` } },
  //   )
  // ).data;

  // console.log(res);

  const q = new Queue('test-queue');

  const worker = new Worker<CompressionJob>(
    'test-queue',
    async (job) => {
      const { songsAbsolutePath, songsRelativePath } = job.data;

      console.log(job.data);
      // const dirName = `${songsRelativePath}-${job.data.userId}-${job.id}.zip`;
      const dirName = '/home/inowu/Desktop/Projects/cardscan-infrastructure/';

      const archive = archiver('zip');

      console.log(
        `[COMPRESSION:START] Compressing ${songsAbsolutePath} to ${dirName}`,
      );

      const zippedDirPath = path.resolve(
        __dirname,
        `../../../${process.env.COMPRESSED_DIRS_NAME}/${dirName}`,
      );

      const output = fs.createWriteStream('./compressed-dirs/test.zip');

      const size = fastFolderSizeSync(dirName)!;

      archive.on('warning', function (err) {
        if (err.code === 'ENOENT') {
          console.log(`[COMPRESSION:WARNING] ${err}`);
        } else {
          console.log(`[COMPRESSION:ERROR] ${err}`);
        }
      });

      output.on('end', function () {
        console.log('[COMPRESSION:END] Data has been drained');
      });

      output.on('close', function () {
        console.log(
          `[COMPRESSION:CLOSE] Archiver has been finalized and the output file descriptor has closed. ${archive.pointer()} total bytes`,
        );
      });

      archive.pipe(output);
      archive.directory(dirName, false);

      archive.on('error', (error) => {
        console.log(
          `[COMPRESSION:ERROR] Error while zipping ${songsAbsolutePath}: ${error.message}, code: ${error.code}, ${error.data}`,
        );

        throw error;
      });

      archive.on('finish', () => {
        console.log(
          `[COMPRESSION:FINISH] Finished zipping ${songsAbsolutePath}`,
        );
      });

      archive.on('progress', (progress) => {
        const progressPercentage = (progress.fs.processedBytes / size) * 100;
        if (Math.trunc(progressPercentage) % 10 === 0) {
          console.log(progressPercentage);
        }
        job.updateProgress(Math.min(progressPercentage));
      });

      await archive.finalize();
    },
    {
      useWorkerThreads: true,
      lockDuration: 1000 * 60 * 60 * 10, // 10 hours
      concurrency: 1,
      removeOnComplete: {
        count: 0,
      },
      removeOnFail: {
        count: 0,
      },
    },
  );

  worker.on('closed', () => console.log('Worker closed'));

  worker.on('ready', () => console.log('Worker ready'));

  worker.on('failed', (job) => console.log(`Job failed ${job?.id}`));

  worker.on('completed', (job) => console.log(`Job completed ${job.id}`));

  worker.on('stalled', (job) => {
    console.warn(`[WORKER:COMPRESSION] Job ${job} stalled`);
  });

  worker.on('error', (error) => {
    console.error(`[WORKER:COMPRESSION] Error: ${error}`);
  });

  q.add('test-job', {
    userId: 1,
    dirSize: fastFolderSizeSync('./node_modules'),
    ftpTalliesId: 1,
    songsAbsolutePath:
      '/home/inowu/Desktop/Projects/bearbeat/backend/node_modules',
    ftpAccountName: 'kevinwoolfolk',
    songsRelativePath: '/bearbeat/backend/node_modules',
    dirDownloadId: 1,
  } as CompressionJob);
}

main();
