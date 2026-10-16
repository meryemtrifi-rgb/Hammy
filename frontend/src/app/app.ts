import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ProductService } from './services/product.service';
import { Product } from './models/product';

interface CartLine { product: Product; option: string; quantity: number; }
interface Account { email: string; name: string; marketingConsent: boolean; }
interface AccountOrder { orderNumber: string; totalCents: number; paymentStatus: string; fulfillmentStatus: string; createdAt: string; }
interface Customer { email: string; firstName: string; lastName: string; address: string; postalCode: string; city: string; country: string; }
type View = 'home' | 'checkout' | 'account' | 'newsletter' | 'confirmation';

@Component({ selector: 'app-root', imports: [CommonModule], templateUrl: './app.html', styleUrl: './app.scss' })
export class App implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly http = inject(HttpClient);
  readonly products = signal<Product[]>([]);
  readonly category = signal('Tout');
  readonly query = signal('');
  readonly view = signal<View>('home');
  readonly categories = computed(() => ['Tout', ...new Set(this.products().map((p) => p.category))]);
  readonly filteredProducts = computed(() => { const q = this.query().trim().toLowerCase(); return this.products().filter((p) => (this.category() === 'Tout' || p.category === this.category()) && (!q || p.name.toLowerCase().includes(q))); });
  readonly cart = signal<CartLine[]>(this.loadCart());
  readonly cartCount = computed(() => this.cart().reduce((n, l) => n + l.quantity, 0));
  readonly subtotal = computed(() => this.cart().reduce((n, l) => n + l.product.price * l.quantity, 0));
  readonly discount = computed(() => this.promoCode().trim().toUpperCase() === 'HAMMEYTEST10' && this.subtotal() >= 30 ? this.subtotal() * .1 : 0);
  readonly shipping = computed(() => this.shippingMethod() === 'exp' ? 9.9 : (this.subtotal() >= 80 ? 0 : 4.9));
  readonly total = computed(() => Math.max(0, this.subtotal() + this.shipping() - this.discount()));
  readonly loading = signal(true); readonly error = signal('');
  readonly selectedProduct = signal<Product | null>(null); readonly selectedOption = signal('');
  readonly account = signal<Account | null>(null); readonly orders = signal<AccountOrder[]>([]);
  readonly accountLoading = signal(false); readonly accountMessage = signal('');
  readonly newsletterEmail = signal(''); readonly newsletterConsent = signal(false); readonly newsletterMessage = signal('');
  readonly promoCode = signal(''); readonly shippingMethod = signal<'std' | 'exp'>('std'); readonly paymentMethod = signal<'stripe' | 'paypal'>('stripe');
  readonly customer = signal<Customer>({ email: '', firstName: '', lastName: '', address: '', postalCode: '', city: '', country: 'France' });
  readonly checkoutMessage = signal(''); readonly orderNumber = signal('');

  ngOnInit(): void {
    this.productService.getProducts().subscribe({ next: (p) => { this.products.set(p.filter((x) => x.active)); this.loading.set(false); }, error: () => { this.error.set('Le catalogue est momentanément indisponible.'); this.loading.set(false); } });
    this.refreshAccount();
    const params = new URLSearchParams(location.search); const order = params.get('order');
    if (order && params.get('payment') === 'success') { this.orderNumber.set(order); this.view.set('confirmation'); history.replaceState({}, '', '/'); }
  }
  selectCategory(category: string): void { this.category.set(category); }
  openProduct(product: Product): void { this.selectedProduct.set(product); this.selectedOption.set(product.options[0] ?? ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  closeProduct(): void { this.selectedProduct.set(null); }
  addToCart(product: Product, option = product.options[0] ?? ''): void { const old = this.cart().find((l) => l.product.id === product.id && l.option === option); const next = old ? this.cart().map((l) => l === old ? { ...l, quantity: l.quantity + 1 } : l) : [...this.cart(), { product, option, quantity: 1 }]; this.cart.set(next); this.saveCart(next); }
  changeQuantity(line: CartLine, delta: number): void { const next = this.cart().map((l) => l === line ? { ...l, quantity: l.quantity + delta } : l).filter((l) => l.quantity > 0); this.cart.set(next); this.saveCart(next); }
  show(view: View): void { this.view.set(view); this.selectedProduct.set(null); window.scrollTo({ top: 0, behavior: 'smooth' }); if (view === 'account') this.refreshAccount(); }
  scrollToCollection(): void { this.show('home'); document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' }); }
  updateCustomer(field: keyof Customer, value: string): void { this.customer.update((c) => ({ ...c, [field]: value })); }
  formatPrice(price: number): string { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price); }
  refreshAccount(): void { this.http.get<{ authenticated: boolean; user?: Account }>('/api/auth/me').subscribe({ next: (r) => { this.account.set(r.authenticated ? r.user ?? null : null); if (r.authenticated) this.loadOrders(); } }); }
  loadOrders(): void { this.accountLoading.set(true); this.http.get<AccountOrder[]>('/api/account/orders').subscribe({ next: (o) => { this.orders.set(o); this.accountLoading.set(false); }, error: () => { this.accountMessage.set('Historique indisponible pour le moment.'); this.accountLoading.set(false); } }); }
  subscribeNewsletter(): void { this.newsletterMessage.set(''); this.http.post<{ message: string }>('/api/newsletter/subscribe', { email: this.newsletterEmail(), consent: this.newsletterConsent(), source: 'angular-footer' }).subscribe({ next: (r) => { this.newsletterMessage.set(r.message); this.newsletterEmail.set(''); this.newsletterConsent.set(false); }, error: (e) => this.newsletterMessage.set(e.error?.error || 'Inscription impossible.') }); }
  unsubscribeNewsletter(): void { this.newsletterMessage.set(''); this.http.post<{ message: string }>('/api/newsletter/unsubscribe', { email: this.newsletterEmail() }).subscribe({ next: (r) => this.newsletterMessage.set(r.message), error: (e) => this.newsletterMessage.set(e.error?.error || 'Désinscription impossible.') }); }
  submitCheckout(): void { if (!this.cart().length) return; this.checkoutMessage.set('Préparation du paiement…'); const body = { paymentMethod: this.paymentMethod(), promoCode: this.promoCode(), items: this.cart().map((l) => ({ productId: l.product.id, option: l.option, quantity: l.quantity })), customer: { email: this.customer().email, firstName: this.customer().firstName, lastName: this.customer().lastName }, shipping: { address: this.customer().address, postalCode: this.customer().postalCode, city: this.customer().city, country: this.customer().country }, shippingMethod: this.shippingMethod() }; this.http.post<{ orderNumber: string }>('/api/commandes', body).subscribe({ next: (order) => this.http.post<{ checkoutUrl: string }>('/api/paiement', { orderNumber: order.orderNumber }).subscribe({ next: (payment) => { localStorage.setItem('hb_pending_order', order.orderNumber); location.href = payment.checkoutUrl; }, error: (e) => this.checkoutMessage.set(e.error?.error || 'Paiement indisponible.') }), error: (e) => this.checkoutMessage.set(e.error?.error || 'Commande invalide.') }); }
  private loadCart(): CartLine[] { try { return JSON.parse(localStorage.getItem('hb_cart_angular') ?? '[]') as CartLine[]; } catch { return []; } }
  private saveCart(cart: CartLine[]): void { localStorage.setItem('hb_cart_angular', JSON.stringify(cart)); }
}
