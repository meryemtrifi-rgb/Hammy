export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  priceCents: number;
  description: string;
  optionLabel: string;
  options: string[];
  stock: Record<string, number>;
  images: string[];
  active: boolean;
}
