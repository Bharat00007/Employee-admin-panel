import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { 
  X, Navigation, Clock, MapPin, Activity, AlertCircle, Loader2, 
  User, RefreshCw, Camera, Route, Radio, ExternalLink, ShieldAlert
} from 'lucide-react';
import { loadGoogleMapsAPI } from '../services/googleMapsLoader';
import { attendanceService } from '../services/attendance.service';
import toast from 'react-hot-toast';

// Google Maps Custom SVG Marker Pin (Distinguishable Camera Pin for Photos vs Waypoints)
const createGoogleMarkerIcon = (text, isPhoto = false) => {
  const bgColor = isPhoto ? '#7C3AED' : '#4F46E5';
  const width = isPhoto ? 36 : 30;
  const height = isPhoto ? 46 : 38;

  let centerContent = '';
  if (isPhoto) {
    centerContent = `
      <circle cx="18" cy="16" r="11" fill="#ffffff" />
      <text x="18" y="20.5" font-size="13" font-family="Arial, sans-serif" text-anchor="middle">📷</text>
    `;
  } else {
    centerContent = `
      <circle cx="15" cy="14" r="9.5" fill="#ffffff" />
      <text x="15" y="17.5" font-size="10" font-weight="bold" font-family="Arial, sans-serif" fill="${bgColor}" text-anchor="middle">${text}</text>
    `;
  }

  const svg = isPhoto ? `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
      <defs>
        <filter id="shadow" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 16.5 27 17.2 27.5.5.4 1.1.4 1.6 0 .7-.5 17.2-14 17.2-27.5C36 8.06 27.94 0 18 0z" fill="${bgColor}" stroke="#ffffff" stroke-width="2.5" filter="url(#shadow)"/>
      ${centerContent}
    </svg>
  ` : `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
      <defs>
        <filter id="shadow2" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <path d="M15 0C6.72 0 0 6.72 0 15c0 10.8 13.8 22.3 14.3 22.7.4.3.9.3 1.3 0 .6-.4 14.3-11.9 14.3-22.7C30 6.72 23.28 0 15 0z" fill="${bgColor}" stroke="#ffffff" stroke-width="2" filter="url(#shadow2)"/>
      ${centerContent}
    </svg>
  `;

  const gMaps = window.google?.maps;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: gMaps?.Size ? new gMaps.Size(width, height) : undefined,
    anchor: gMaps?.Point ? new gMaps.Point(width / 2, height) : undefined
  };
};

const formatTime = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (_e) {
    return isoString;
  }
};

const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (_e) {
    return isoString;
  }
};

const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const MapModal = ({ 
  isOpen, 
  onClose, 
  title = "Employee GPS Locations", 
  routeData = null, 
  focusRecordId = null,
  locations = [], 
  lat = null, 
  lng = null, 
  address = '', 
  isLoading = false,
  error = null,
  onRefreshRoute = null,
  onImagePreview = null
}) => {
  const googleMapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const [googleMapLoaded, setGoogleMapLoaded] = useState(false);
  const [googleMapError, setGoogleMapError] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [isRequestingLive, setIsRequestingLive] = useState(false);
  const [modalLightboxImage, setModalLightboxImage] = useState(null);
  const lastRefreshedTotalRef = useRef(0);
  const [accumulatedSinceRefresh, setAccumulatedSinceRefresh] = useState(0);

  // Retrieve Google Maps API Key from environment variables (supports VITE_ and fallback)
  const apiKey = (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 
    import.meta.env.VITE_GOOGLE_MAPS_JAVASCRIPT_API_KEY || 
    import.meta.env.GOOGLE_MAPS_JAVASCRIPT_API_KEY || 
    ''
  ).trim();

  // 1) Extract raw records
  let rawRoute = [];
  let employee = routeData?.employee || null;
  let summary = routeData?.summary || {};

  if (routeData && Array.isArray(routeData.route) && routeData.route.length > 0) {
    rawRoute = routeData.route;
  } else if (Array.isArray(locations) && locations.length > 0) {
    rawRoute = locations.map((loc, idx) => ({
      _id: loc._id || loc.id || `loc-${idx}`,
      lat: loc.lat,
      lng: loc.lng,
      accuracy: loc.accuracy || null,
      recordedAt: loc.time || loc.recordedAt || new Date().toISOString(),
      type: idx === 0 ? 'photo_checkin' : 'waypoint',
      address: loc.address || '',
      imageUrl: loc.imageUrl || null
    }));
    summary = {
      totalPoints: rawRoute.length,
      startTime: rawRoute[0]?.recordedAt,
      endTime: rawRoute[rawRoute.length - 1]?.recordedAt,
      lastPingTime: rawRoute[rawRoute.length - 1]?.recordedAt
    };
  } else if (lat !== null && lng !== null && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
    rawRoute = [{
      _id: 'single-checkin',
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      accuracy: null,
      address: address || '',
      recordedAt: new Date().toISOString(),
      type: 'photo_checkin'
    }];
    summary = {
      totalPoints: 1,
      startTime: rawRoute[0].recordedAt,
      endTime: rawRoute[0].recordedAt,
      lastPingTime: rawRoute[0].recordedAt
    };
  }

  // Detect photos without valid coordinates (never plot them at 0,0)
  const photosWithoutCoordinates = useMemo(() => {
    return (rawRoute || []).filter(pt => {
      const isPhoto = pt.type === 'photo_checkin' || !!pt.imageUrl;
      if (!isPhoto) return false;
      const pLat = parseFloat(pt.lat);
      const pLng = parseFloat(pt.lng);
      return isNaN(pLat) || isNaN(pLng) || (pLat === 0 && pLng === 0);
    });
  }, [rawRoute]);

  // 2) Handle Coordinates with spiderfying / radial micro-offset for identical locations
  const processedPoints = useMemo(() => {
    const validPoints = (rawRoute || []).filter(pt => {
      if (!pt) return false;
      const pLat = parseFloat(pt.lat);
      const pLng = parseFloat(pt.lng);
      if (isNaN(pLat) || isNaN(pLng)) return false;
      // Filter out invalid (0, 0) coordinates
      if (pLat === 0 && pLng === 0) return false;
      return true;
    }).map(pt => ({
      ...pt,
      lat: parseFloat(pt.lat),
      lng: parseFloat(pt.lng)
    }));

    const coordGroups = {};
    validPoints.forEach((pt) => {
      const key = `${pt.lat.toFixed(6)},${pt.lng.toFixed(6)}`;
      if (!coordGroups[key]) coordGroups[key] = [];
      coordGroups[key].push(pt);
    });

    let waypointCounter = 1;

    return validPoints.map((pt) => {
      const isPhoto = pt.type === 'photo_checkin' || !!pt.imageUrl;
      const sequenceNumber = isPhoto ? '📷' : waypointCounter++;

      const key = `${pt.lat.toFixed(6)},${pt.lng.toFixed(6)}`;
      const group = coordGroups[key];
      let displayLat = pt.lat;
      let displayLng = pt.lng;

      if (group.length > 1) {
        const itemIdx = group.indexOf(pt);
        const radius = 0.00035; // ~38m radial spiderfy offset (~12-16px on map) so overlapping waypoints and photos are clearly visible side-by-side
        if (group.length === 2) {
          // Split horizontally east/west so waypoint (#N) and photo (📷) stand side-by-side
          const offsetLng = (itemIdx === 0 ? -radius : radius) / Math.cos((pt.lat * Math.PI) / 180);
          displayLng = pt.lng + offsetLng;
        } else {
          const angle = (2 * Math.PI * itemIdx) / group.length;
          displayLat = pt.lat + radius * Math.sin(angle);
          displayLng = pt.lng + (radius * Math.cos(angle)) / Math.cos((pt.lat * Math.PI) / 180);
        }
      }

      return {
        ...pt,
        displayLat,
        displayLng,
        sequenceNumber,
        isPhoto
      };
    });
  }, [rawRoute]);

  const hasPoints = processedPoints.length > 0;

  // 3) Listen for Google Maps Authentication Failures globally
  useEffect(() => {
    const originalAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      console.warn('Google Maps Authentication Failed: API Key was rejected or missing required permissions.');
      setAuthError(true);
      setGoogleMapError('Google Maps API Key rejected (gm_authFailure). Please check API key permissions, enabled APIs, or HTTP Referrer restrictions in Google Cloud Console.');
      if (typeof originalAuthFailure === 'function') {
        originalAuthFailure();
      }
    };

    return () => {
      window.gm_authFailure = originalAuthFailure;
    };
  }, []);

  // Update baseline reference count whenever fresh routeData arrives
  useEffect(() => {
    if (routeData) {
      const currentCount = routeData?.summary?.totalPoints ?? (routeData?.route?.length || 0);
      lastRefreshedTotalRef.current = currentCount;
      setAccumulatedSinceRefresh(0);
    }
  }, [routeData]);

  // 4) Map Refresh Policy: Only fetch full map history when 100 new records have been stored in MongoDB
  // GPS uploads continue independently every ~60s; Admin Panel does NOT refetch on every upload.
  useEffect(() => {
    if (!isOpen || !employee?.id || !onRefreshRoute || !summary.isTrackingActive) return;

    const checkInterval = setInterval(async () => {
      try {
        const countRes = await attendanceService.getRecordCount(employee.id, routeData?.date);
        const currentDbTotal = countRes.data?.totalCount || 0;
        const baseline = lastRefreshedTotalRef.current || 0;
        const newAccumulated = Math.max(0, currentDbTotal - baseline);
        setAccumulatedSinceRefresh(newAccumulated);

        if (newAccumulated >= 100) {
          console.log(`[GPS_MAP_REFRESH] Threshold reached: ${newAccumulated} new records stored in DB (>= 100). Refreshing map...`);
          lastRefreshedTotalRef.current = currentDbTotal;
          setAccumulatedSinceRefresh(0);
          await onRefreshRoute(false);
        } else {
          console.log(`[GPS_MAP_THROTTLE] Buffer: ${newAccumulated}/100 new records stored in DB. Map refresh held to prevent unnecessary API calls.`);
        }
      } catch (err) {
        console.warn('[GPS_MAP_CHECK] Failed to check record count:', err.message);
      }
    }, 30000);

    return () => clearInterval(checkInterval);
  }, [isOpen, employee?.id, onRefreshRoute, summary.isTrackingActive, routeData?.date]);

  // 5) Initialize Google Maps JavaScript API with size-guard and lifecycle management
  useEffect(() => {
    if (!isOpen || !hasPoints || isLoading || authError) return;

    if (!apiKey) {
      setGoogleMapError('Google Maps API Key is missing. Please set VITE_GOOGLE_MAPS_API_KEY in admin_panel/.env.');
      return;
    }

    let isMounted = true;
    let resizeTimer = null;

    loadGoogleMapsAPI(apiKey)
      .then((google) => {
        if (!isMounted || !googleMapRef.current) return;

        // Clean up previous markers if any
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        const center = {
          lat: processedPoints[0].displayLat,
          lng: processedPoints[0].displayLng
        };

        // Create or reuse map instance
        let map = mapInstanceRef.current;
        if (!map) {
          map = new google.maps.Map(googleMapRef.current, {
            center,
            zoom: 15,
            mapTypeId: 'roadmap',
            streetViewControl: false,
            fullscreenControl: true,
            mapTypeControl: true,
            zoomControl: true,
            backgroundColor: '#f1f5f9'
          });
          mapInstanceRef.current = map;
        } else {
          map.setCenter(center);
        }

        const bounds = new google.maps.LatLngBounds();
        const infoWindow = new google.maps.InfoWindow();

        // Render independent markers for EVERY valid GPS record (NO Polylines)
        processedPoints.forEach((point) => {
          const isPhoto = point.isPhoto;
          const position = { lat: point.displayLat, lng: point.displayLng };
          bounds.extend(position);

          const marker = new google.maps.Marker({
            position,
            map,
            title: isPhoto ? 'Check-in Photograph' : `Waypoint #${point.sequenceNumber}`,
            icon: createGoogleMarkerIcon(isPhoto ? '📷' : String(point.sequenceNumber), isPhoto),
            zIndex: isPhoto ? 1000 : Number(point.sequenceNumber) || 10
          });

          markersRef.current.push(marker);

          const contentString = `
            <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #1e293b; max-width: 270px; line-height: 1.4; padding: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
                <span style="background-color: ${isPhoto ? '#f3e8ff' : '#e0e7ff'}; color: ${isPhoto ? '#6b21a8' : '#3730a3'}; font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 4px;">
                  ${isPhoto ? '📷 Check-in Photograph' : 'Waypoint #' + point.sequenceNumber}
                </span>
                <span style="color: #64748b; font-size: 10px; font-family: monospace;">${formatTime(point.recordedAt)}</span>
              </div>
              <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                ${escapeHtml(employee?.name || 'Employee')} ${employee?.username ? '<span style="color: #4f46e5; font-family: monospace;">(@' + escapeHtml(employee.username) + ')</span>' : ''}
              </div>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; margin: 6px 0; font-family: monospace; font-size: 11px;">
                <div><span style="color: #64748b;">Lat:</span> ${point.lat.toFixed(6)}</div>
                <div><span style="color: #64748b;">Lng:</span> ${point.lng.toFixed(6)}</div>
                ${point.accuracy ? '<div><span style="color: #64748b;">Accuracy:</span> ±' + Math.round(point.accuracy) + 'm' + (point.accuracy <= 25 ? ' <span style="color: #059669; font-weight: bold;">(Precise)</span>' : ' <span style="color: #d97706; font-weight: bold;">(Coarse)</span>') + '</div>' : ''}
                ${point.speed != null ? '<div><span style="color: #64748b;">Speed:</span> ' + (point.speed * 3.6).toFixed(1) + ' km/h</div>' : ''}
                ${point.isStale ? '<div style="color: #dc2626; font-weight: bold; font-size: 10px;">⚠️ Stale Fix (>90s)</div>' : ''}
              </div>
              <div style="font-size: 11px; color: #475569;">
                <div><b>Date:</b> ${formatDate(point.recordedAt)}</div>
                <div><b>Time:</b> ${formatTime(point.recordedAt)}</div>
                ${point.address ? '<div style="margin-top: 4px; color: #334155;">' + escapeHtml(point.address) + '</div>' : ''}
              </div>
              ${point.imageUrl ? `
                <div style="margin-top: 8px;">
                  <img 
                    src="${escapeHtml(point.imageUrl)}" 
                    alt="Check-in Photo" 
                    style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; border: 1.5px solid #a855f7; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" 
                    onclick="window.dispatchEvent(new CustomEvent('gotails_preview_photo', { detail: '${escapeHtml(point.imageUrl)}' }))"
                  />
                  <div style="font-size: 10px; color: #7c3aed; text-align: center; margin-top: 4px; font-weight: 600; cursor: pointer;" onclick="window.dispatchEvent(new CustomEvent('gotails_preview_photo', { detail: '${escapeHtml(point.imageUrl)}' }))">
                    🔍 Click photo to enlarge
                  </div>
                </div>
              ` : ''}
            </div>
          `;

          marker.addListener('click', () => {
            infoWindow.setContent(contentString);
            infoWindow.open(map, marker);
          });

          if (focusRecordId && (point._id === focusRecordId || String(point._id) === String(focusRecordId))) {
            setTimeout(() => {
              if (isMounted && map) {
                map.setCenter(position);
                map.setZoom(17);
                infoWindow.setContent(contentString);
                infoWindow.open(map, marker);
              }
            }, 300);
          }
        });

        console.log(`[GPS_MAP_RENDER] Total Markers: ${processedPoints.length} | Waypoints: ${processedPoints.filter(p => !p.isPhoto).length} | Photos: ${processedPoints.filter(p => p.isPhoto).length}`);

        // Trigger resize and fit bounds smoothly after modal animation settles
        resizeTimer = setTimeout(() => {
          if (!isMounted || !map) return;
          google.maps.event.trigger(map, 'resize');
          if (processedPoints.length > 1) {
            map.fitBounds(bounds, 50);
          } else if (processedPoints.length === 1) {
            map.setCenter({ lat: processedPoints[0].displayLat, lng: processedPoints[0].displayLng });
            map.setZoom(16);
          }
        }, 150);

        setGoogleMapLoaded(true);
        setGoogleMapError(null);
      })
      .catch((err) => {
        console.warn('Google Maps loader error:', err);
        if (isMounted) {
          setGoogleMapError(err.message || 'Failed to load Google Maps JavaScript API. Please verify network connectivity and API key settings.');
        }
      });

    return () => {
      isMounted = false;
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [isOpen, hasPoints, isLoading, apiKey, authError, processedPoints, employee]);

  // Window event listener for photo clicks inside Google Maps InfoWindow
  useEffect(() => {
    const handlePhotoPreviewEvent = (e) => {
      if (e.detail) {
        if (onImagePreview) {
          onImagePreview(e.detail);
        } else {
          setModalLightboxImage(e.detail);
        }
      }
    };
    window.addEventListener('gotails_preview_photo', handlePhotoPreviewEvent);
    return () => window.removeEventListener('gotails_preview_photo', handlePhotoPreviewEvent);
  }, [onImagePreview]);

  // Reset local state when modal closes
  useEffect(() => {
    if (!isOpen) {
      mapInstanceRef.current = null;
      markersRef.current = [];
      setGoogleMapLoaded(false);
      setGoogleMapError(null);
      setAuthError(false);
      setModalLightboxImage(null);
    }
  }, [isOpen]);

  // Handle Admin "Get Live Location" Click with multi-stage progress tracking
  const handleRequestLiveLocation = async () => {
    if (!employee?.id) {
      toast.error('No employee selected');
      return;
    }
    setIsRequestingLive(true);
    console.log(`[GPS_LIVE_REQUEST] Admin requested live location for employee: ${employee?.id} (${employee?.name})`);
    const toastId = toast.loading('Request sent – Waiting for employee device...');

    try {
      const res = await attendanceService.requestLiveLocation(employee.id);
      const requestId = res.data?.requestId;

      if (!requestId) {
        toast.dismiss(toastId);
        toast.error('Failed to dispatch live request.');
        setIsRequestingLive(false);
        return;
      }

      // Actively poll request lifecycle every 1.5 seconds up to 20 seconds
      let attempts = 0;
      const maxAttempts = 13;
      const pollTimer = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await attendanceService.getLiveRequestStatus(requestId);
          const sData = statusRes.data;

          if (sData?.stage === 'received') {
            toast.loading('Employee device received request...', { id: toastId });
          } else if (sData?.stage === 'collecting_gps') {
            toast.loading('Collecting fresh GPS location...', { id: toastId });
          } else if (sData?.stage === 'uploading') {
            toast.loading('Uploading pending GPS records...', { id: toastId });
          } else if (sData?.status === 'fulfilled' || sData?.stage === 'fulfilled') {
            clearInterval(pollTimer);
            setIsRequestingLive(false);
            const count = sData.uploadedCount || 0;
            toast.success(`Synchronization completed – ${count} GPS records uploaded!`, { id: toastId });
            setAccumulatedSinceRefresh(0);
            if (onRefreshRoute) {
              await onRefreshRoute(true);
            }
          } else if (sData?.status === 'failed' || sData?.status === 'expired' || attempts >= maxAttempts) {
            clearInterval(pollTimer);
            setIsRequestingLive(false);
            toast.error(
              sData?.errorMessage 
                ? `Sync failed: ${sData.errorMessage}` 
                : 'Employee device unavailable or background sync timed out.',
              { id: toastId }
            );
          }
        } catch (_pollErr) {
          if (attempts >= maxAttempts) {
            clearInterval(pollTimer);
            setIsRequestingLive(false);
            toast.error('Employee device unavailable or timed out.', { id: toastId });
          }
        }
      }, 1500);

    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err.response?.data?.message || 'Failed to request live location');
      setIsRequestingLive(false);
    }
  };

  if (!isOpen) return null;

  // Determine stationary status
  const isStationary = summary.isStationary || summary.formattedDistance === '0.00 km' || summary.totalDistanceKm === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Navigation className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                {title}
                {summary.isTrackingActive ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Tracking Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    Tracking Ended ({summary.configuredCutoffTime || '19:00'} IST)
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  Google Maps
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {employee?.name || 'Employee'}{employee?.username ? ` (@${employee.username})` : ''} 
                  {employee?.email ? ` • ${employee.email}` : ''}
                </span>
                <span>•</span>
                <span>{routeData?.date || 'Selected Date'}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Get Live Location Button */}
            {employee?.id && (
              <button
                type="button"
                onClick={handleRequestLiveLocation}
                disabled={isRequestingLive}
                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-all flex items-center gap-1.5 shadow-xs hover:shadow"
                title="Immediately poll employee mobile device for fresh live coordinates"
              >
                {isRequestingLive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Radio className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                )}
                Get Live Location
              </button>
            )}

            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* GPS Summary Metrics Section */}
        {hasPoints && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-6 py-3 bg-white border-b border-slate-100 text-xs">
            {/* Total Road Distance */}
            <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
              <div className="text-indigo-600 font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Route className="w-3.5 h-3.5 text-indigo-600" /> Road Distance
                </span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-mono">
                  {summary.distanceCalculationMethod === 'google_directions_api' ? 'Directions API' : (isStationary ? 'Stationary Filter' : 'Estimated')}
                </span>
              </div>
              <div className="font-extrabold text-indigo-950 text-base mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{summary.formattedDistance || (summary.totalDistanceKm ? `${summary.totalDistanceKm} km` : '0.00 km')}</span>
                {isStationary && (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200">
                    Stationary / No travel
                  </span>
                )}
              </div>
            </div>

            {/* Total Points & Photos Breakdown */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-slate-500 font-medium flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-500" /> GPS Markers
                </span>
                <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                  {processedPoints.length} Plotted
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1 text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  {processedPoints.filter(p => !p.isPhoto).length} Waypoints
                </span>
                <span className="inline-flex items-center gap-1 text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[10px]">
                  📷 {processedPoints.filter(p => p.isPhoto).length} Photos
                </span>
                {summary.isTrackingActive && (
                  <span 
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                    title="Map auto-refreshes every 100 newly stored records in DB, or immediately upon clicking 'Get Live Location'"
                  >
                    Auto-refresh: {accumulatedSinceRefresh}/100
                  </span>
                )}
              </div>
            </div>

            {/* First Log */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-slate-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-500" /> First Log
              </div>
              <div className="font-bold text-slate-700 mt-0.5">{formatTime(summary.startTime)}</div>
              <div className="text-[10px] text-slate-400">{formatDate(summary.startTime)}</div>
            </div>

            {/* Last Log */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-slate-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-red-500" /> Last Log
              </div>
              <div className="font-bold text-slate-700 mt-0.5">{formatTime(summary.endTime || summary.lastPingTime)}</div>
              <div className="text-[10px] text-slate-400">{formatDate(summary.endTime || summary.lastPingTime)}</div>
            </div>

            {/* Tracking Window Cutoff */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-slate-500 font-medium flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-blue-500" /> Daily Cutoff
              </div>
              <div className="font-bold text-slate-700 mt-0.5">
                {summary.configuredCutoffTime ? `${summary.configuredCutoffTime} IST` : '19:00 IST'}
              </div>
              <div className="text-[10px] text-slate-400">Fixed End Time</div>
            </div>
          </div>
        )}

        {/* Warning if photos exist without GPS coordinates */}
        {photosWithoutCoordinates.length > 0 && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <Camera className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <b>Note:</b> {photosWithoutCoordinates.length} check-in photo(s) were captured without valid GPS coordinates and are excluded from the map.
            </span>
          </div>
        )}

        {/* Diagnostic Banner if Google Auth or Loading Fails */}
        {(authError || googleMapError) && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-200 text-rose-900 text-xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-800 text-sm">Google Maps Configuration Error</div>
              <p className="mt-0.5 text-rose-700">{googleMapError || 'Google Maps failed to authenticate. Check API key permissions and HTTP referrer settings in Google Cloud Console.'}</p>
            </div>
          </div>
        )}

        {/* Map View / Loading / Empty / Error States */}
        <div className="flex-1 w-full relative bg-slate-100 overflow-hidden" style={{ minHeight: '400px' }}>
          {isLoading ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
              <p className="text-sm font-semibold text-slate-600">Retrieving employee GPS coordinates...</p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
              <h4 className="font-bold text-slate-800 text-lg">Failed to Retrieve GPS History</h4>
              <p className="text-rose-600 text-sm max-w-sm mt-1">{error}</p>
            </div>
          ) : !hasPoints ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="font-bold text-slate-700 text-lg">No GPS Coordinates Recorded</h4>
              <p className="text-slate-500 text-sm max-w-sm mt-1">
                No location records were found for {employee?.name || 'this employee'} on {routeData?.date || 'the selected date'}.
              </p>
            </div>
          ) : (authError || (!apiKey && googleMapError)) ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-white">
              <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
              <h4 className="font-bold text-slate-800 text-lg">Google Maps Unavailable</h4>
              <p className="text-rose-600 text-sm max-w-md mt-1">
                {googleMapError || 'The Google Maps JavaScript API could not be loaded.'}
              </p>
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-left max-w-md text-xs space-y-1.5 text-slate-600">
                <p className="font-semibold text-slate-800">Troubleshooting Steps:</p>
                <p>1. Ensure <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700">VITE_GOOGLE_MAPS_API_KEY</code> is correctly set in <code className="bg-slate-200 px-1 py-0.5 rounded">admin_panel/.env</code>.</p>
                <p>2. Verify "Maps JavaScript API" is enabled in Google Cloud Console.</p>
                <p>3. If HTTP referrers are restricted, allow <code className="bg-slate-200 px-1 py-0.5 rounded">http://localhost:*</code>.</p>
              </div>
            </div>
          ) : (
            /* Google Maps JavaScript API Container with solid fallback background */
            <div 
              ref={googleMapRef} 
              style={{ width: '100%', height: '100%', minHeight: '400px' }}
              className="w-full h-full absolute inset-0 bg-slate-100"
            />
          )}
        </div>
      </div>

      {/* Internal Modal Photo Lightbox */}
      {modalLightboxImage && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
          onClick={() => setModalLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button 
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-1"
              onClick={() => setModalLightboxImage(null)}
            >
              <X size={24} />
            </button>
            <img 
              src={modalLightboxImage} 
              alt="Enlarged Check-in Photo" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MapModal;
