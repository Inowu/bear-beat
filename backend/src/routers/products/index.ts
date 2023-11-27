import { router } from '../../trpc';
import { buyMoreGB } from './buyMoreGB';
import { getProducts } from './getProducts';

export const productsRouter = router({
  getProducts,
  buyMoreGB,
});
