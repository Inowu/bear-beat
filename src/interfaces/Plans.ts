export interface PlanI {
  id: number;
  title: string;
  price: string;
  description: string;
  duration: number;
  included: Array<string>;
  space: number;
  priceIdStripe: string;
  priceIdPaypal: string;
}
