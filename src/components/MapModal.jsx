import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { 
  X, Navigation, Clock, MapPin, Activity, AlertCircle, Loader2, 
  User, RefreshCw, Camera, Route, Radio, ExternalLink, ShieldAlert,
  AlertTriangle, CheckCircle, Check
} from 'lucide-react';
import { loadGoogleMapsAPI } from '../services/googleMapsLoader';
import { attendanceService } from '../services/attendance.service';
import toast from 'react-hot-toast';

// Google Maps Custom SVG Marker Pin supporting Start, End, Photos, Verified, and Unverified GPS
const createGoogleMarkerIcon = (text, isPhoto = false, verificationStatus = 'VERIFIED', isStart = false, isEnd = false) => {
  let bgColor = '#4F46E5'; // Default indigo
  let textColor = '#ffffff';

  if (isPhoto) {
    bgColor = '#7C3AED'; // Purple
  } else if (isStart) {
    bgColor = '#10B981'; // Emerald Start
  } else if (isEnd) {
    bgColor = '#1E293B'; // Slate-900 End
  } else if (verificationStatus === 'UNVERIFIED_GPS') {
    bgColor = '#F59E0B'; // Amber Unverified
  } else if (verificationStatus === 'VERIFIED_BY_ADMIN') {
    bgColor = '#059669'; // Green Verified by Admin
  } else if (verificationStatus === 'REJECTED_BY_ADMIN') {
    bgColor = '#EF4444'; // Red Rejected by Admin
  }

  const width = isPhoto ? 36 : (isStart || isEnd ? 34 : 30);
  const height = isPhoto ? 46 : (isStart || isEnd ? 44 : 38);

  let centerContent = '';
  if (isPhoto) {
    centerContent = `
      <circle cx="18" cy="16" r="11" fill="#ffffff" />
      <text x="18" y="20.5" font-size="13" font-family="Arial, sans-serif" text-anchor="middle">📷</text>
    `;
  } else if (isStart) {
    centerContent = `
      <circle cx="17" cy="15" r="10" fill="#ffffff" />
      <text x="17" y="19" font-size="9" font-weight="bold" font-family="Arial, sans-serif" fill="${bgColor}" text-anchor="middle">START</text>
    `;
  } else if (isEnd) {
    centerContent = `
      <circle cx="17" cy="15" r="10" fill="#ffffff" />
      <text x="17" y="19" font-size="9" font-weight="bold" font-family="Arial, sans-serif" fill="${bgColor}" text-anchor="middle">END</text>
    `;
  } else if (verificationStatus === 'UNVERIFIED_GPS') {
    centerContent = `
      <circle cx="15" cy="14" r="9.5" fill="#ffffff" />
      <text x="15" y="17.5" font-size="10" font-weight="bold" font-family="Arial, sans-serif" fill="${bgColor}" text-anchor="middle">⚠️</text>
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
  ` : (isStart || isEnd) ? `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
      <defs>
        <filter id="shadow-se" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path d="M17 0C7.61 0 0 7.61 0 17c0 12.5 15.5 25.5 16.2 26 .5.4 1.1.4 1.6 0 .7-.5 16.2-13.5 16.2-26C34 7.61 26.39 0 17 0z" fill="${bgColor}" stroke="#ffffff" stroke-width="2.5" filter="url(#shadow-se)"/>
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
  const polylinesRef = useRef([]);

  const [googleMapLoaded, setGoogleMapLoaded] = useState(false);
  const [googleMapError, setGoogleMapError] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [isRequestingLive, setIsRequestingLive] = useState(false);
  const [modalLightboxImage, setModalLightboxImage] = useState(null);
  const lastRefreshedTotalRef = useRef(0);
  const [accumulatedSinceRefresh, setAccumulatedSinceRefresh] = useState(0);

  // Clear all overlays helper
  const clearMapOverlays = useCallback(() => {
    if (markersRef.current && markersRef.current.length > 0) {
      markersRef.current.forEach(m => {
        try {
          if (m && typeof m.setMap === 'function') m.setMap(null);
        } catch (_e) {}
      });
      markersRef.current = [];
    }
    if (polylinesRef.current && polylinesRef.current.length > 0) {
      polylinesRef.current.forEach(p => {
        try {
          if (p && typeof p.setMap === 'function') p.setMap(null);
        } catch (_e) {}
      });
      polylinesRef.current = [];
    }
  }, []);

  // Retrieve Google Maps API Key from environment variables
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
      verificationStatus: loc.verificationStatus || 'VERIFIED',
      verificationReason: loc.verificationReason || 'REALTIME_STREAM',
      serverReceivedAt: loc.serverReceivedAt || null,
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
      type: 'photo_checkin',
      verificationStatus: 'VERIFIED',
      verificationReason: 'PHOTO_CHECKIN_VERIFIED'
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

  // Unverified Points Count
  const unverifiedCount = useMemo(() => {
    return (rawRoute || []).filter(pt => pt.verificationStatus === 'UNVERIFIED_GPS').length;
  }, [rawRoute]);

  // 2) Handle Coordinates with spiderfying / radial micro-offset for identical locations
  const processedPoints = useMemo(() => {
    const validPoints = (rawRoute || []).filter(pt => {
      if (!pt) return false;
      const pLat = parseFloat(pt.lat);
      const pLng = parseFloat(pt.lng);
      if (isNaN(pLat) || isNaN(pLng)) return false;
      if (pLat === 0 && pLng === 0) return false;
      return true;
    }).map(pt => ({
      ...pt,
      lat: parseFloat(pt.lat),
      lng: parseFloat(pt.lng)
    }));

    // Ensure chronological sort
    validPoints.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

    const coordGroups = {};
    validPoints.forEach((pt) => {
      const key = `${pt.lat.toFixed(6)},${pt.lng.toFixed(6)}`;
      if (!coordGroups[key]) coordGroups[key] = [];
      coordGroups[key].push(pt);
    });

    let waypointCounter = 1;
    const totalValid = validPoints.length;

    return validPoints.map((pt, idx) => {
      const isPhoto = pt.type === 'photo_checkin' || !!pt.imageUrl;
      const isStart = idx === 0 && totalValid > 1 && !isPhoto;
      const isEnd = idx === totalValid - 1 && totalValid > 1 && !isPhoto;
      const sequenceNumber = isPhoto ? '📷' : waypointCounter++;

      const key = `${pt.lat.toFixed(6)},${pt.lng.toFixed(6)}`;
      const group = coordGroups[key];
      let displayLat = pt.lat;
      let displayLng = pt.lng;

      if (group.length > 1) {
        const itemIdx = group.indexOf(pt);
        const radius = 0.00035;
        if (group.length === 2) {
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
        isPhoto,
        isStart,
        isEnd
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

  // 4) Map Refresh Policy: 100-new-record map refresh threshold
  useEffect(() => {
    const empId = employee?.id || employee?._id;
    if (!isOpen || !empId || !onRefreshRoute || !summary.isTrackingActive) return;

    const checkInterval = setInterval(async () => {
      try {
        const countRes = await attendanceService.getRecordCount(empId, routeData?.date);
        const currentDbTotal = countRes.data?.totalCount || 0;
        const baseline = lastRefreshedTotalRef.current || 0;
        const newAccumulated = Math.max(0, currentDbTotal - baseline);
        setAccumulatedSinceRefresh(newAccumulated);

        if (newAccumulated >= 100) {
          console.log(`[GPS_MAP_REFRESH] Threshold reached: ${newAccumulated} new records stored in DB (>= 100). Refreshing map...`);
          lastRefreshedTotalRef.current = currentDbTotal;
          setAccumulatedSinceRefresh(0);
          await onRefreshRoute(false);
        }
      } catch (err) {
        console.warn('[GPS_MAP_CHECK] Failed to check record count:', err.message);
      }
    }, 30000);

    return () => clearInterval(checkInterval);
  }, [isOpen, employee, onRefreshRoute, summary.isTrackingActive, routeData?.date]);

  // 5) Global Admin Review Record Handler (invoked from InfoWindow buttons)
  useEffect(() => {
    const handleReviewEvent = async (e) => {
      const { recordId, status } = e.detail || {};
      if (!recordId || !status) return;
      try {
        toast.loading('Updating record verification status...', { id: 'review_toast' });
        await attendanceService.reviewRecord(recordId, status);
        toast.success(`Record marked as ${status.replace(/_/g, ' ')}!`, { id: 'review_toast' });
        if (onRefreshRoute) {
          await onRefreshRoute(true);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to update record status', { id: 'review_toast' });
      }
    };
    window.addEventListener('gotails_review_record', handleReviewEvent);
    return () => window.removeEventListener('gotails_review_record', handleReviewEvent);
  }, [onRefreshRoute]);

  // 6) Initialize Google Maps JavaScript API and Render Route & Markers
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

        // Clean up previous markers and polylines
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        polylinesRef.current.forEach(p => p.setMap(null));
        polylinesRef.current = [];

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

        // RENDER ONE ROUTE PATH
        // Prefer best available road-matched geometry; fallback to recorded points with 20-min gap breaks
        const roadSegments = routeData?.roadMatchedSegments || [];
        const hasRoadMatchedSegments = roadSegments.length > 0 && roadSegments.some(s => s.path && s.path.length >= 2);

        if (hasRoadMatchedSegments) {
          roadSegments.forEach((segment) => {
            if (!segment.path || segment.path.length < 2) return;
            const path = segment.path.map(p => ({ lat: p.lat, lng: p.lng }));
            const isUnverified = segment.verificationStatus === 'UNVERIFIED_GPS';

            if (isUnverified) {
              // Unverified offline travel rendered with distinct dashed amber styling
              const dashedLine = new google.maps.Polyline({
                path,
                geodesic: true,
                strokeOpacity: 0,
                icons: [{
                  icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    scale: 3,
                    strokeColor: '#F59E0B'
                  },
                  offset: '0',
                  repeat: '14px'
                }],
                map,
                zIndex: 40
              });
              polylinesRef.current.push(dashedLine);
            } else {
              // High-definition road-matched solid indigo polyline conforming to road curvature
              const solidLine = new google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: '#4F46E5',
                strokeOpacity: 0.9,
                strokeWeight: 5,
                map,
                zIndex: 35
              });
              polylinesRef.current.push(solidLine);
            }
          });
        } else {
          // Fallback: single route path directly from waypoints with 20-minute gap breaks
          const routeWaypoints = processedPoints.filter(p => !p.isPhoto);

          if (routeWaypoints.length >= 2) {
            const MAX_GAP_MS = 20 * 60 * 1000;
            let currentSegment = [routeWaypoints[0]];

            const renderRawSegment = (segmentPoints) => {
              if (segmentPoints.length < 2) return;
              const hasUnverified = segmentPoints.some(p => p.verificationStatus === 'UNVERIFIED_GPS');
              const path = segmentPoints.map(p => ({ lat: p.lat, lng: p.lng }));

              if (hasUnverified) {
                const dashedLine = new google.maps.Polyline({
                  path,
                  geodesic: true,
                  strokeOpacity: 0,
                  icons: [{
                    icon: {
                      path: 'M 0,-1 0,1',
                      strokeOpacity: 1,
                      scale: 3,
                      strokeColor: '#F59E0B'
                    },
                    offset: '0',
                    repeat: '14px'
                  }],
                  map,
                  zIndex: 40
                });
                polylinesRef.current.push(dashedLine);
              } else {
                const rawLine = new google.maps.Polyline({
                  path,
                  geodesic: true,
                  strokeColor: '#4F46E5',
                  strokeOpacity: 0.85,
                  strokeWeight: 4,
                  map,
                  zIndex: 30
                });
                polylinesRef.current.push(rawLine);
              }
            };

            for (let i = 1; i < routeWaypoints.length; i++) {
              const prev = routeWaypoints[i - 1];
              const curr = routeWaypoints[i];
              const timeDiff = Math.abs(new Date(curr.recordedAt).getTime() - new Date(prev.recordedAt).getTime());

              if (timeDiff > MAX_GAP_MS) {
                renderRawSegment(currentSegment);
                currentSegment = [curr];
              } else {
                currentSegment.push(curr);
              }
            }
            renderRawSegment(currentSegment);
          }
        }

        // Render markers for EVERY valid GPS record (preserving accessibility and individual inspection)
        processedPoints.forEach((point) => {
          const isPhoto = point.isPhoto;
          const isStart = point.isStart;
          const isEnd = point.isEnd;
          const verificationStatus = point.verificationStatus || 'VERIFIED';
          const position = { lat: point.displayLat, lng: point.displayLng };
          bounds.extend(position);

          const marker = new google.maps.Marker({
            position,
            map,
            title: isPhoto ? 'Check-in Photograph' : (isStart ? 'Journey Start' : (isEnd ? 'Latest Point' : `Waypoint #${point.sequenceNumber}`)),
            icon: createGoogleMarkerIcon(
              isPhoto ? '📷' : String(point.sequenceNumber), 
              isPhoto, 
              verificationStatus, 
              isStart, 
              isEnd
            ),
            zIndex: isPhoto ? 1000 : (isStart || isEnd ? 500 : (verificationStatus === 'UNVERIFIED_GPS' ? 200 : 100))
          });

          markersRef.current.push(marker);

          // Build Verification Status Badge
          let verificationHtml = '';
          if (verificationStatus === 'UNVERIFIED_GPS') {
            verificationHtml = `
              <div style="background-color: #fef3c7; border: 1.5px solid #f59e0b; color: #92400e; padding: 6px; border-radius: 6px; font-size: 11px; margin: 6px 0;">
                <div style="font-weight: 700; display: flex; align-items: center; gap: 4px;">
                  ⚠️ UNVERIFIED_GPS (Captured Offline)
                </div>
                <div style="font-size: 10px; color: #b45309; margin-top: 2px;">
                  <b>Reason:</b> ${escapeHtml(point.verificationReason || 'Buffered offline, uploaded upon reconnection')}
                </div>
                ${point.serverReceivedAt ? `<div style="font-size: 10px; color: #78350f; margin-top: 2px;"><b>Server Received:</b> ${formatTime(point.serverReceivedAt)}</div>` : ''}
                <div style="display: flex; gap: 6px; margin-top: 6px; border-top: 1px dashed #fcd34d; padding-top: 4px;">
                  <button 
                    onclick="window.dispatchEvent(new CustomEvent('gotails_review_record', { detail: { recordId: '${point._id}', status: 'VERIFIED_BY_ADMIN' } }))"
                    style="background: #059669; color: white; border: none; border-radius: 4px; padding: 3px 8px; font-size: 10px; font-weight: 700; cursor: pointer;"
                  >
                    ✓ Mark Verified
                  </button>
                  <button 
                    onclick="window.dispatchEvent(new CustomEvent('gotails_review_record', { detail: { recordId: '${point._id}', status: 'REJECTED_BY_ADMIN' } }))"
                    style="background: #dc2626; color: white; border: none; border-radius: 4px; padding: 3px 8px; font-size: 10px; font-weight: 700; cursor: pointer;"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            `;
          } else if (verificationStatus === 'VERIFIED_BY_ADMIN') {
            verificationHtml = `
              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 3px 6px; border-radius: 4px; font-size: 10px; margin: 4px 0; font-weight: 600;">
                ✓ Verified by Admin
              </div>
            `;
          } else if (verificationStatus === 'REJECTED_BY_ADMIN') {
            verificationHtml = `
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 3px 6px; border-radius: 4px; font-size: 10px; margin: 4px 0; font-weight: 600;">
                ✕ Rejected by Admin
              </div>
            `;
          } else {
            verificationHtml = `
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin: 4px 0;">
                ● Real-time Live Verified
              </div>
            `;
          }

          const contentString = `
            <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #1e293b; max-width: 280px; line-height: 1.4; padding: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
                <span style="background-color: ${isPhoto ? '#f3e8ff' : (isStart ? '#dcfce7' : (isEnd ? '#f1f5f9' : '#e0e7ff'))}; color: ${isPhoto ? '#6b21a8' : (isStart ? '#15803d' : (isEnd ? '#0f172a' : '#3730a3'))}; font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 4px;">
                  ${isPhoto ? '📷 Check-in Photograph' : (isStart ? '▶ Journey Start' : (isEnd ? '🏁 Latest Point' : 'Waypoint #' + point.sequenceNumber))}
                </span>
                <span style="color: #64748b; font-size: 10px; font-family: monospace;">${formatTime(point.recordedAt)}</span>
              </div>
              <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                ${escapeHtml(employee?.name || 'Employee')} ${employee?.username ? '<span style="color: #4f46e5; font-family: monospace;">(@' + escapeHtml(employee.username) + ')</span>' : ''}
              </div>

              ${verificationHtml}

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; margin: 6px 0; font-family: monospace; font-size: 11px;">
                <div><span style="color: #64748b;">Lat:</span> ${point.lat.toFixed(6)}</div>
                <div><span style="color: #64748b;">Lng:</span> ${point.lng.toFixed(6)}</div>
                ${point.accuracy ? '<div><span style="color: #64748b;">Accuracy:</span> ±' + Math.round(point.accuracy) + 'm' + (point.accuracy <= 25 ? ' <span style="color: #059669; font-weight: bold;">(Precise)</span>' : ' <span style="color: #d97706; font-weight: bold;">(Coarse)</span>') + '</div>' : ''}
                ${point.speed != null ? '<div><span style="color: #64748b;">Speed:</span> ' + (point.speed * 3.6).toFixed(1) + ' km/h</div>' : ''}
                ${point.isStale ? '<div style="color: #dc2626; font-weight: bold; font-size: 10px;">⚠️ Stale Fix (>90s)</div>' : ''}
              </div>
              <div style="font-size: 11px; color: #475569;">
                <div><b>Recorded At:</b> ${formatDate(point.recordedAt)} ${formatTime(point.recordedAt)}</div>
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

        console.log(`[GPS_MAP_RENDER] Total Markers: ${processedPoints.length} | Polylines: ${polylinesRef.current.length} | Unverified: ${unverifiedCount}`);

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
  }, [isOpen, hasPoints, isLoading, apiKey, authError, processedPoints, employee, unverifiedCount, routeData, clearMapOverlays]);

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
      clearMapOverlays();
      mapInstanceRef.current = null;
      setGoogleMapLoaded(false);
      setGoogleMapError(null);
      setAuthError(false);
      setModalLightboxImage(null);
    }
  }, [isOpen, clearMapOverlays]);

  // TASK 1: Handle Admin "Get Live Location" Click with multi-stage progress tracking and decoupled database fallback
  const handleRequestLiveLocation = async () => {
    const empId = employee?.id || employee?._id;
    if (!empId) {
      toast.error('No employee selected');
      return;
    }
    setIsRequestingLive(true);
    console.log(`[GPS_LIVE_REQUEST] Admin requested live location for employee: ${empId} (${employee?.name})`);
    const toastId = toast.loading('Request sent – Waiting for employee device...');

    try {
      const res = await attendanceService.requestLiveLocation(empId);
      const requestId = res.data?.requestId;

      if (!requestId) {
        toast.dismiss(toastId);
        toast('Live request signal dispatched. Displaying stored records from database.', { icon: 'ℹ️' });
        setIsRequestingLive(false);
        if (onRefreshRoute) await onRefreshRoute(true);
        return;
      }

      // Actively poll request lifecycle every 1.5 seconds up to 20 seconds
      let attempts = 0;
      const maxAttempts = 13;
      const pollTimer = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await attendanceService.getLiveRequestStatus(requestId, empId);
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
            // Decouple device timeout from database display: always load MongoDB history
            toast(
              sData?.errorMessage 
                ? `Device sync status: ${sData.errorMessage}. Showing last stored location.` 
                : 'Device offline or unreachable. Displaying latest stored GPS location from database.',
              { id: toastId, icon: '⚠️' }
            );
            if (onRefreshRoute) {
              await onRefreshRoute(true);
            }
          }
        } catch (_pollErr) {
          if (attempts >= maxAttempts) {
            clearInterval(pollTimer);
            setIsRequestingLive(false);
            toast('Device offline or unreachable. Displaying latest stored GPS location from database.', { id: toastId, icon: '⚠️' });
            if (onRefreshRoute) {
              await onRefreshRoute(true);
            }
          }
        }
      }, 1500);

    } catch (err) {
      toast.dismiss(toastId);
      toast(err.response?.data?.message || 'Device unreachable. Loaded last stored GPS records.', { icon: '⚠️' });
      setIsRequestingLive(false);
      if (onRefreshRoute) {
        await onRefreshRoute(true);
      }
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
            {(employee?.id || employee?._id) && (
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
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 px-6 py-3 bg-white border-b border-slate-100 text-xs">
            {/* Total Road Distance */}
            <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
              <div className="text-indigo-600 font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Route className="w-3.5 h-3.5 text-indigo-600" /> Road Distance
                </span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-mono">
                  {summary.distanceCalculationMethod === 'google_snap_to_roads' ? 'Snap to Roads' : (summary.distanceCalculationMethod === 'google_directions_api' ? 'Directions API' : (isStationary ? 'Stationary Filter' : 'Estimated'))}
                </span>
              </div>
              <div className="font-extrabold text-indigo-950 text-base mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{summary.formattedDistance || (summary.totalDistanceKm ? `${summary.totalDistanceKm} km` : '0.00 km')}</span>
                {isStationary && (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200">
                    Stationary / No travel
                  </span>
                )}
                {summary.roadMatchingStatus && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${summary.roadMatchingStatus === 'ROAD_MATCHED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {summary.roadMatchingStatus}
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

            {/* Verification Status Breakdown */}
            <div className={`p-2.5 rounded-xl border ${unverifiedCount > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/60 border-emerald-100'}`}>
              <div className={`font-semibold flex items-center justify-between ${unverifiedCount > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                <span className="flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Verification
                </span>
              </div>
              <div className="font-extrabold text-sm mt-0.5 flex items-center gap-1.5 flex-wrap">
                {unverifiedCount > 0 ? (
                  <span className="text-amber-900 flex items-center gap-1">
                    ⚠️ {unverifiedCount} Unverified
                  </span>
                ) : (
                  <span className="text-emerald-800 flex items-center gap-1">
                    ✓ All Verified
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {unverifiedCount > 0 ? 'Captured offline' : 'Continuous stream'}
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

        {/* Legend Banner */}
        {hasPoints && (
          <div className="px-6 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-700">Map Legend:</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Start
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-slate-900 inline-block"></span> End
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-4 h-1.5 bg-indigo-600 inline-block rounded"></span> Route Path
              </span>
              {unverifiedCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-4 h-1.5 border-b-2 border-dashed border-amber-500 inline-block"></span> Offline Travel
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-purple-600 inline-block"></span> 📷 Photo
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Gaps &gt; 20 min not connected
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
          {/* Layer 1: Google Maps JavaScript API Container (Always preserved in DOM) */}
          <div 
            ref={googleMapRef} 
            style={{ width: '100%', height: '100%', minHeight: '400px' }}
            className="w-full h-full absolute inset-0 bg-slate-100"
          />

          {/* Layer 2: Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
              <p className="text-sm font-semibold text-slate-600">Retrieving employee GPS coordinates...</p>
            </div>
          )}

          {/* Layer 3: Error State */}
          {!isLoading && error && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-white/95">
              <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
              <h4 className="font-bold text-slate-800 text-lg">Failed to Retrieve GPS History</h4>
              <p className="text-rose-600 text-sm max-w-sm mt-1">{error}</p>
            </div>
          )}

          {/* Layer 4: Empty Route State */}
          {!isLoading && !error && !hasPoints && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-white/90">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="font-bold text-slate-700 text-lg">No GPS Coordinates Recorded</h4>
              <p className="text-slate-500 text-sm max-w-sm mt-1">
                No location records were found for {employee?.name || 'this employee'} on {routeData?.date || 'the selected date'}.
              </p>
            </div>
          )}

          {/* Layer 5: Google Maps API Configuration / Auth Error */}
          {(authError || (!apiKey && googleMapError)) && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-white">
              <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
              <h4 className="font-bold text-slate-800 text-lg">Google Maps Unavailable</h4>
              <p className="text-rose-600 text-sm max-w-md mt-1">
                {googleMapError || 'The Google Maps JavaScript API could not be loaded.'}
              </p>
            </div>
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
