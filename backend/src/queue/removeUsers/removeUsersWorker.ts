import { Job } from 'bullmq';
import { RemoveUsersJob } from './types';
import { log } from '../../server';
import stripeInstance from '../../stripe';
import { conektaCustomers } from '../../conekta';

export default async function (job: Job<RemoveUsersJob>) {
  for (let i = 0; i < job.data.userCustomerIds.length; i++) {
    const ids = job.data.userCustomerIds[i];

    // DO NOT DELETE USERS IN TEST SERVER, SINCE DATABASE IS A COPY OF PRODUCTION
    // log.info(
    //   `[REMOVE_INACTIVE_USERS] Test server, simulating delay. Stripe id: ${ids.stripe}, Conekta id: ${ids.conekta}`,
    // );
    // await new Promise((res) => setTimeout(res, 100));
    // job.updateProgress((i / job.data.userCustomerIds.length) * 100);
    // continue;

    try {
      log.info(
        `[REMOVE_INACTIVE_USERS] Removing stripe customer for user ${ids.stripe}...`,
      );

      if (ids.stripe) {
        await stripeInstance.customers.del(ids.stripe);
      }

      log.info(
        `[REMOVE_INACTIVE_USERS] Removed stripe customer for user ${ids.stripe}`,
      );
    } catch (e) {
      log.error(
        `[REMOVE_INACTIVE_USERS] Error removing stripe customer for user ${ids.stripe}, ${e}`,
      );
    }

    try {
      log.info(
        `[REMOVE_INACTIVE_USERS] Removing conekta customer for user ${ids.conekta}...`,
      );

      if (ids.conekta) {
        await conektaCustomers.deleteCustomerById(ids.conekta);
      }

      log.info(
        `[REMOVE_INACTIVE_USERS] Removed conekta customer for user ${ids.conekta}`,
      );
    } catch (e) {
      log.error(
        `[REMOVE_INACTIVE_USERS] Error removing conekta customer for user ${ids.conekta}, ${e}`,
      );
    }

    // Avoid rate limiting
    await new Promise((res) => setTimeout(res, 500));

    job.updateProgress((i / job.data.userCustomerIds.length) * 100);
  }
}
