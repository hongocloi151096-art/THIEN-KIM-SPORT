export function generateVietQRUrl(
  bankAccount: string,
  amount: number,
  description: string
): string {
  const cleanDesc = encodeURIComponent(description.replace(/[^a-zA-Z0-9 ]/g, ''));
  return `https://img.vietqr.io/image/MBBANK-${bankAccount}-compact2.png?amount=${amount}&addInfo=${cleanDesc}`;
}

export function generateOrderCode(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TK${ymd}${rand}`;
}
