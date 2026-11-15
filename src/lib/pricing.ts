import {
  Product,
  CATEGORY_MARKUP,
  TIERED_CATEGORIES,
  TIERED_PRICING,
} from './types';

export type PriceType = 'hlv' | 'le';

export function getUnitPrice(
  product: Pick<Product, 'category' | 'price_hlv' | 'price_le'>,
  priceType: PriceType,
  quantity = 1
): number {
  if (priceType === 'hlv') {
    return product.price_hlv;
  }

  if (TIERED_CATEGORIES.includes(product.category)) {
    const tier = TIERED_PRICING.tiers.find(
      (t) => quantity >= t.minQty && quantity <= t.maxQty
    );
    return tier ? tier.price : product.price_le;
  }

  return product.price_le;
}

export function getExpectedRetailPrice(product: Pick<Product, 'category' | 'price_hlv'>): number {
  if (TIERED_CATEGORIES.includes(product.category)) {
    return product.price_hlv;
  }
  const markup = CATEGORY_MARKUP[product.category] ?? 0;
  return product.price_hlv + markup;
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
