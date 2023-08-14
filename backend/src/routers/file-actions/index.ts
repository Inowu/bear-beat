import { router } from '../../trpc';
import download from './download';
import ls from './ls';

export const ftpRouter = router({
  ls,
  download,
});
