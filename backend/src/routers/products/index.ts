import { router } from '../../trpc';
import { buyMoreGBStripe } from './buyMoreGB';
import { getProducts } from './getProducts';

export const productsRouter = router({
  getProducts,
  buyMoreGBStripe,
});
