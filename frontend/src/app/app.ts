import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ProductService } from './services/product.service';
import { Product } from './models/product';

interface CartLine {
  product: Product;
  option: string;
  quantity: number;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly productService = inject(ProductService);

  readonly products = signal<Product[]>([]);
  readonly category = signal('Tout');
  readonly query = signal('');
  readonly categories = computed(() => ['Tout', ...new Set(this.products().map((p) => p.category))]);
  readonly filteredProducts = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.products().filter((product) => {
      const matchesCategory = this.category() === 'Tout' || product.category === this.category();
      const matchesQuery = !query || product.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  });
  readonly cart = signal<CartLine[]>(this.loadCart());
  readonly cartCount = computed(() => this.cart().reduce((total, line) => total + line.quantity, 0));
  readonly cartTotal = computed(() => this.cart().reduce((total, line) => total + line.product.price * line.quantity, 0));
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedProduct = signal<Product | null>(null);
  readonly selectedOption = signal('');

  ngOnInit(): void {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products.set(products.filter((product) => product.active));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Le catalogue est momentanément indisponible.');
        this.loading.set(false);
      },
    });
  }

  selectCategory(category: string): void {
    this.category.set(category);
  }

  openProduct(product: Product): void {
    this.selectedProduct.set(product);
    this.selectedOption.set(product.options[0] ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeProduct(): void {
    this.selectedProduct.set(null);
  }

  addToCart(product: Product, option = product.options[0] ?? ''): void {
    const existing = this.cart().find((line) => line.product.id === product.id && line.option === option);
    const next = existing
      ? this.cart().map((line) => line === existing ? { ...line, quantity: line.quantity + 1 } : line)
      : [...this.cart(), { product, option, quantity: 1 }];
    this.cart.set(next);
    this.saveCart(next);
  }

  changeQuantity(line: CartLine, delta: number): void {
    const next = this.cart()
      .map((item) => item === line ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0);
    this.cart.set(next);
    this.saveCart(next);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
  }

  private loadCart(): CartLine[] {
    try { return JSON.parse(localStorage.getItem('hb_cart_angular') ?? '[]') as CartLine[]; } catch { return []; }
  }

  private saveCart(cart: CartLine[]): void {
    localStorage.setItem('hb_cart_angular', JSON.stringify(cart));
  }
}
