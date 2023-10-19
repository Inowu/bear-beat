import { router } from '../../trpc';
import { demo } from './demo';
import { download } from './download';
import { ls } from './ls';
import { quota } from './quota';
import { search } from './search';

export const ftpRouter = router({
  ls,
  quota,
  download,
  demo,
  search,
});
