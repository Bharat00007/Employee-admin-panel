import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let loadPromise = null;

/**
 * Singleton Google Maps API Loader
 * Uses modern functional @googlemaps/js-api-loader (v2+) API:
 * setOptions() and importLibrary('maps').
 * Ensures Google Maps JavaScript API is loaded exactly once and cached.
 */
export const loadGoogleMapsAPI = async (apiKey) => {
  if (typeof window !== 'undefined' && window.google?.maps) {
    return window.google;
  }

  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('No Google Maps API key provided');
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        setOptions({
          key: cleanKey,
          v: 'weekly',
        });
        await importLibrary('maps');
        await importLibrary('marker').catch(() => null); // Optional modern marker library
        
        if (typeof window !== 'undefined' && window.google?.maps) {
          return window.google;
        }
        throw new Error('Google Maps script loaded but window.google.maps is undefined');
      } catch (err) {
        loadPromise = null; // Allow retry on failure
        throw err;
      }
    })();
  }

  return loadPromise;
};
