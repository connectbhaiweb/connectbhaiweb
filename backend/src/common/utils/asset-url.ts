/** Absolute URL for a stored Cloudinary path. Full URLs and site-relative paths (/logos/x.svg) pass through unchanged. */
export function assetUrl(stored: string, cloud: string, deliveryBase = 'https://res.cloudinary.com'): string {
  if (!stored || /^(https?:)?\/\//i.test(stored) || stored.startsWith('/') || !cloud) return stored;
  return `${deliveryBase.replace(/\/$/, '')}/${cloud}/image/upload/${stored.replace(/^\//, '')}`;
}
