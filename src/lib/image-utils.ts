/**
 * Utility functions for optimizing image URLs, particularly Google profile photos
 */

/**
 * Enhances Google profile photo URLs to request higher resolution versions
 * Google profile photos can be requested in different sizes by modifying URL parameters
 * 
 * @param photoURL - The original photo URL from Firebase Auth
 * @param size - Desired size in pixels (default: 400 for high quality)
 * @returns Enhanced URL with higher resolution, or original URL if not a Google photo
 */
export function enhanceGoogleProfilePhoto(photoURL: string | null | undefined, size: number = 400): string {
  if (!photoURL) {
    return '/default-avatar.svg';
  }

  // Check if this is a Google profile photo URL
  if (photoURL.includes('googleusercontent.com') || photoURL.includes('lh3.googleusercontent.com')) {
    // Remove existing size parameters and add our desired size
    let enhancedUrl = photoURL;
    
    // Remove common size parameters that might be present
    enhancedUrl = enhancedUrl.replace(/[?&]s=\d+/g, '');
    enhancedUrl = enhancedUrl.replace(/[?&]sz=\d+/g, '');
    enhancedUrl = enhancedUrl.replace(/=s\d+-c/g, '');
    enhancedUrl = enhancedUrl.replace(/=w\d+-h\d+/g, '');
    
    // Add our desired size parameter
    const separator = enhancedUrl.includes('?') ? '&' : '?';
    enhancedUrl = `${enhancedUrl}${separator}s=${size}`;
    
    return enhancedUrl;
  }

  // For non-Google photos (custom uploads, etc.), return as-is
  return photoURL;
}

/**
 * Gets an optimized profile photo URL for different use cases
 * 
 * @param photoURL - The original photo URL
 * @param context - The context where the image will be used
 * @returns Optimized URL based on context
 */
export function getOptimizedProfilePhoto(
  photoURL: string | null | undefined, 
  context: 'avatar' | 'playbill' | 'profile' | 'thumbnail' = 'avatar'
): string {
  const sizeMap = {
    thumbnail: 96,   // Small thumbnails
    avatar: 200,     // Regular avatars
    profile: 400,    // Profile pages
    playbill: 800    // Large playbill display
  };

  const size = sizeMap[context];
  return enhanceGoogleProfilePhoto(photoURL, size);
}

/**
 * Preloads an optimized image to improve loading performance
 * 
 * @param photoURL - The photo URL to preload
 * @param context - The context for optimization
 */
export function preloadOptimizedImage(
  photoURL: string | null | undefined, 
  context: 'avatar' | 'playbill' | 'profile' | 'thumbnail' = 'avatar'
): void {
  if (typeof window === 'undefined') return; // Skip on server-side
  
  const optimizedUrl = getOptimizedProfilePhoto(photoURL, context);
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = optimizedUrl;
  document.head.appendChild(link);
}
