import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { loadGoogleMapsAPI } from '../services/googleMapsLoader';
import { useSearchParams } from 'react-router-dom';
import { 
  Navigation, 
  MapPin, 
  Calendar, 
  User, 
  Clock, 
  Activity, 
  RefreshCw, 
  Loader2, 
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Route as RouteIcon
} from 'lucide-react';
import { employeeService } from '../services/employee.service';
import { attendanceService } from '../services/attendance.service';
import toast from 'react-hot-toast';

/**
 * Returns 'YYYY-MM-DD' representing today in Asia/Kolkata (IST: UTC+5:30)
 */
export const getTodayDateInIST = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
};

// Google Maps Custom SVG Marker Pin supporting Start, End, Photos, Verified, and Unverified GPS
const createGoogleMarkerIcon = (text, isPhoto = false, verificationStatus = 'VERIFIED', isStart = false, isEnd = false) => {
  let bgColor = '#4F46E5'; // Default indigo
  if (isPhoto) {
    bgColor = '#7C3AED'; // Purple
  } else if (isStart) {
    bgColor = '#10B981'; // Emerald Start
  } else if (isEnd) {
    bgColor = '#1E293B'; // Slate-900 End
  } else if (verificationStatus === 'UNVERIFIED_GPS') {
    bgColor = '#F59E0B'; // Amber Unverified
  } else if (verificationStatus === 'VERIFIED_BY_ADMIN') {
    bgColor = '#059669'; // Green Verified
  } else if (verificationStatus === 'REJECTED_BY_ADMIN') {
    bgColor = '#EF4444'; // Red Rejected
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
        <filter id="shadow-se-rh" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path d="M17 0C7.61 0 0 7.61 0 17c0 12.5 15.5 25.5 16.2 26 .5.4 1.1.4 1.6 0 .7-.5 16.2-13.5 16.2-26C34 7.61 26.39 0 17 0z" fill="${bgColor}" stroke="#ffffff" stroke-width="2.5" filter="url(#shadow-se-rh)"/>
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

const RouteHistory = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialEmployeeId = searchParams.get('employeeId') || '';
  const initialDate = searchParams.get('date') || getTodayDateInIST();

  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const [routeData, setRouteData] = useState(null);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState(null);

  const googleMapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);

  // Race condition protection & Request cancellation
  const activeRequestIdRef = useRef(0);
  const abortControllerRef = useRef(null);

  const [googleMapLoaded, setGoogleMapLoaded] = useState(false);
  const [googleMapError, setGoogleMapError] = useState(null);
  const [authError, setAuthError] = useState(false);

  const apiKey = (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 
    import.meta.env.VITE_GOOGLE_MAPS_JAVASCRIPT_API_KEY || 
    import.meta.env.GOOGLE_MAPS_JAVASCRIPT_API_KEY || ''
  ).trim();

  // Clear all overlays from the map instance
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

  // Listen for Google auth failure
  useEffect(() => {
    const originalAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      setAuthError(true);
      setGoogleMapError('Google Maps API authentication failed (gm_authFailure).');
      if (typeof originalAuthFailure === 'function') originalAuthFailure();
    };
    return () => {
      window.gm_authFailure = originalAuthFailure;
    };
  }, []);

  // 1. Fetch employee list on mount
  useEffect(() => {
    let isMounted = true;
    const fetchEmployees = async () => {
      try {
        const res = await employeeService.getAllEmployees(1, 100);
        const list = res.data?.employees || [];
        if (isMounted) {
          setEmployees(list);
          if (!selectedEmployeeId && list.length > 0) {
            setSelectedEmployeeId(list[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to load employee list:', err);
      } finally {
        if (isMounted) setLoadingEmployees(false);
      }
    };
    fetchEmployees();
    return () => { isMounted = false; };
  }, []);

  // 2. Fetch Route whenever selectedEmployeeId or selectedDate changes with race-condition protection
  const fetchRoute = useCallback(async () => {
    if (!selectedEmployeeId) {
      clearMapOverlays();
      setRouteData(null);
      setLoadingRoute(false);
      return;
    }

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentRequestId = ++activeRequestIdRef.current;
    const requestedEmpId = selectedEmployeeId;
    const requestedDate = selectedDate;

    // Immediately isolate state: clear previous employee's data and map overlays
    clearMapOverlays();
    setRouteData(null);
    setRouteError(null);
    setLoadingRoute(true);

    try {
      const res = await attendanceService.getRouteHistory(requestedEmpId, requestedDate, controller.signal);

      // Check if this response is stale (i.e. another request started after this one)
      if (currentRequestId !== activeRequestIdRef.current) {
        console.log(`[ROUTE_STALE_IGNORED] Ignoring response #${currentRequestId} (active is #${activeRequestIdRef.current})`);
        return;
      }

      // Security / Data Isolation Check: Verify response employee ID matches selectedEmployeeId
      const returnedEmpId = res.data?.employee?.id || res.data?.employee?._id;
      if (returnedEmpId && String(returnedEmpId) !== String(requestedEmpId)) {
        console.error(`[DATA_ISOLATION_ERROR] Mismatch: Requested ${requestedEmpId} but received ${returnedEmpId}`);
        setRouteError('Data isolation error: Server returned records for a different employee.');
        setRouteData(null);
        clearMapOverlays();
        return;
      }

      setRouteData(res.data);
    } catch (err) {
      // Ignore cancellations
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }

      if (currentRequestId === activeRequestIdRef.current) {
        console.error('Failed to fetch route history:', err);
        setRouteError(err.response?.data?.message || err.message || 'Failed to fetch employee route');
        setRouteData(null);
        clearMapOverlays();
      }
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setLoadingRoute(false);
      }
    }
  }, [selectedEmployeeId, selectedDate, clearMapOverlays]);

  useEffect(() => {
    fetchRoute();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchRoute]);

  // Global Admin Review Record Handler (invoked from InfoWindow buttons)
  useEffect(() => {
    const handleReviewEvent = async (e) => {
      const { recordId, status } = e.detail || {};
      if (!recordId || !status) return;
      try {
        toast.loading('Updating record verification status...', { id: 'rh_review_toast' });
        await attendanceService.reviewRecord(recordId, status);
        toast.success(`Record marked as ${status.replace(/_/g, ' ')}!`, { id: 'rh_review_toast' });
        await fetchRoute();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to update record status', { id: 'rh_review_toast' });
      }
    };
    window.addEventListener('gotails_review_record', handleReviewEvent);
    return () => window.removeEventListener('gotails_review_record', handleReviewEvent);
  }, [fetchRoute]);

  const rawRoute = routeData?.route || [];
  const summary = routeData?.summary || {};
  const employee = routeData?.employee || null;

  // Process points with micro-offsets for identical coordinates and start/end identification
  const processedPoints = useMemo(() => {
    const valid = rawRoute.filter(pt => pt && !isNaN(parseFloat(pt.lat)) && !isNaN(parseFloat(pt.lng)) && !(parseFloat(pt.lat) === 0 && parseFloat(pt.lng) === 0))
      .map(pt => ({ ...pt, lat: parseFloat(pt.lat), lng: parseFloat(pt.lng) }));

    valid.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

    const coordGroups = {};
    valid.forEach(pt => {
      const key = `${pt.lat.toFixed(6)},${pt.lng.toFixed(6)}`;
      if (!coordGroups[key]) coordGroups[key] = [];
      coordGroups[key].push(pt);
    });

    let wpCount = 1;
    const totalValid = valid.length;

    return valid.map((pt, idx) => {
      const isPhoto = pt.type === 'checkin' || pt.type === 'photo_checkin' || !!pt.imageUrl;
      const isStart = idx === 0 && totalValid > 1 && !isPhoto;
      const isEnd = idx === totalValid - 1 && totalValid > 1 && !isPhoto;
      const sequenceNumber = isPhoto ? '📷' : wpCount++;

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

      return { ...pt, displayLat, displayLng, sequenceNumber, isPhoto, isStart, isEnd };
    });
  }, [rawRoute]);

  const hasRoute = processedPoints.length > 0;
  const unverifiedCount = useMemo(() => {
    return (rawRoute || []).filter(p => p.verificationStatus === 'UNVERIFIED_GPS').length;
  }, [rawRoute]);

  // Google Maps Overlay Renderer
  useEffect(() => {
    if (authError) return;
    if (!apiKey) {
      setGoogleMapError('VITE_GOOGLE_MAPS_API_KEY is not defined in admin_panel/.env');
      return;
    }

    // If no route records exist for this employee, immediately clear all overlays
    if (!hasRoute) {
      clearMapOverlays();
      return;
    }

    let isMounted = true;
    let resizeTimer = null;

    loadGoogleMapsAPI(apiKey).then((google) => {
      if (!isMounted || !googleMapRef.current) return;

      // Clean up previous overlays before drawing fresh ones
      clearMapOverlays();

      let map = mapInstanceRef.current;
      const center = { lat: processedPoints[0].displayLat, lng: processedPoints[0].displayLng };

      if (!map || !googleMapRef.current.contains(map.getDiv())) {
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
      // Prefer best available road-matched geometry from backend; fallback to recorded points with 20-min gap breaks
      const roadSegments = routeData?.roadMatchedSegments || [];
      const hasRoadSegments = roadSegments.length > 0 && roadSegments.some(s => s.path && s.path.length >= 2);

      if (hasRoadSegments) {
        roadSegments.forEach((segment) => {
          if (!segment.path || segment.path.length < 2) return;
          const path = segment.path.map(p => ({ lat: p.lat, lng: p.lng }));
          const isUnverified = segment.verificationStatus === 'UNVERIFIED_GPS';

          if (isUnverified) {
            // Unverified travel: distinct dashed amber styling
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
            // Solid road-matched route path
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
        // Fallback: draw single route path directly from valid waypoints with 20-minute gap breaks
        const routeWaypoints = processedPoints.filter(p => !p.isPhoto);

        if (routeWaypoints.length >= 2) {
          const MAX_GAP_MS = 20 * 60 * 1000;
          let currentSegment = [routeWaypoints[0]];

          const renderSegment = (segmentPoints) => {
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
              const solidLine = new google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: '#4F46E5',
                strokeOpacity: 0.85,
                strokeWeight: 4,
                map,
                zIndex: 30
              });
              polylinesRef.current.push(solidLine);
            }
          };

          for (let i = 1; i < routeWaypoints.length; i++) {
            const prev = routeWaypoints[i - 1];
            const curr = routeWaypoints[i];
            const timeDiff = Math.abs(new Date(curr.recordedAt).getTime() - new Date(prev.recordedAt).getTime());

            if (timeDiff > MAX_GAP_MS) {
              renderSegment(currentSegment);
              currentSegment = [curr];
            } else {
              currentSegment.push(curr);
            }
          }
          renderSegment(currentSegment);
        }
      }

      // RENDER ONE SET OF GPS LOCATION MARKERS
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
          zIndex: isPhoto ? 1000 : (isStart || isEnd ? 500 : 100)
        });

        markersRef.current.push(marker);

        let verificationHtml = '';
        if (verificationStatus === 'UNVERIFIED_GPS') {
          verificationHtml = `
            <div style="background-color: #fef3c7; border: 1.5px solid #f59e0b; color: #92400e; padding: 6px; border-radius: 6px; font-size: 11px; margin: 6px 0;">
              <div style="font-weight: 700;">⚠️ UNVERIFIED_GPS (Captured Offline)</div>
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
          <div style="font-family: system-ui, sans-serif; font-size: 12px; color: #1e293b; max-width: 270px; line-height: 1.4; padding: 4px;">
            <div style="font-weight: 700; color: ${isPhoto ? '#7c3aed' : (isStart ? '#15803d' : (isEnd ? '#0f172a' : '#4f46e5'))}; margin-bottom: 4px;">
              ${isPhoto ? '📸 Check-in Photograph' : (isStart ? '▶ Journey Start' : (isEnd ? '🏁 Latest Point' : '📍 Waypoint #' + point.sequenceNumber))}
            </div>
            <div style="font-weight: 600; color: #0f172a; margin-bottom: 2px;">
              ${escapeHtml(employee?.name || 'Employee')}
            </div>

            ${verificationHtml}

            <div><b>Date:</b> ${formatDate(point.recordedAt)}</div>
            <div><b>Time:</b> ${formatTime(point.recordedAt)}</div>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px; margin: 4px 0; font-family: monospace; font-size: 11px;">
              <div>Lat: ${point.lat.toFixed(6)}</div>
              <div>Lng: ${point.lng.toFixed(6)}</div>
              ${point.accuracy ? '<div>Accuracy: ±' + Math.round(point.accuracy) + 'm' + (point.accuracy <= 25 ? ' <span style="color: #059669; font-weight: bold;">(Precise)</span>' : ' <span style="color: #d97706; font-weight: bold;">(Coarse)</span>') + '</div>' : ''}
              ${point.speed != null ? '<div>Speed: ' + (point.speed * 3.6).toFixed(1) + ' km/h</div>' : ''}
              ${point.isStale ? '<div style="color: #dc2626; font-weight: bold; font-size: 10px;">⚠️ Stale Fix (>90s)</div>' : ''}
            </div>
            ${point.address ? '<div style="color: #64748b; font-size: 11px;">' + point.address + '</div>' : ''}
            ${point.imageUrl ? `
              <div style="margin-top: 6px;">
                <img 
                  src="${escapeHtml(point.imageUrl)}" 
                  alt="Check-in Photo" 
                  style="width: 100%; height: 110px; object-fit: cover; border-radius: 6px; border: 1.5px solid #a855f7;" 
                />
              </div>
            ` : ''}
          </div>
        `;

        marker.addListener('click', () => {
          infoWindow.setContent(contentString);
          infoWindow.open(map, marker);
        });
      });

      resizeTimer = setTimeout(() => {
        if (!isMounted || !map) return;
        google.maps.event.trigger(map, 'resize');
        if (processedPoints.length > 1) {
          map.fitBounds(bounds, 50);
        } else if (processedPoints.length === 1) {
          map.setCenter({ lat: processedPoints[0].displayLat, lng: processedPoints[0].displayLng });
          map.setZoom(16);
        }
      }, 100);

      setGoogleMapLoaded(true);
      setGoogleMapError(null);
    }).catch(err => {
      console.warn('Google Maps failed to load:', err);
      if (isMounted) setGoogleMapError(err.message || 'Google Maps failed to load');
    });

    return () => { 
      isMounted = false; 
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [hasRoute, processedPoints, routeData, apiKey, authError, clearMapOverlays]);

  const isStationary = summary.isStationary || summary.formattedDistance === '0.00 km' || summary.totalDistanceKm === 0;

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Navigation className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Employee Route Playback</h1>
            <p className="text-xs text-slate-500">Track and audit full-day movements on Google Maps</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <User className="h-4 w-4 text-slate-400" />
            <select
              value={selectedEmployeeId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedEmployeeId(newId);
                setSearchParams({ employeeId: newId, date: selectedDate });
              }}
              disabled={loadingEmployees}
              className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name} ({emp.username || emp.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const newDate = e.target.value;
                setSelectedDate(newDate);
                setSearchParams({ employeeId: selectedEmployeeId, date: newDate });
              }}
              className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
            />
          </div>

          <button
            onClick={fetchRoute}
            disabled={loadingRoute}
            className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Route"
          >
            <RefreshCw className={`h-4 w-4 ${loadingRoute ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {hasRoute && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5"><RouteIcon className="w-4 h-4 text-indigo-600" /> Total Distance</span>
            </div>
            <div className="font-extrabold text-slate-900 text-lg flex items-center gap-2 flex-wrap">
              <span>{summary.formattedDistance || (summary.totalDistanceKm ? `${summary.totalDistanceKm} km` : '0.00 km')}</span>
              {isStationary && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  Stationary
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Road displacement</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-500" /> GPS Markers
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                {processedPoints.length} Total
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                {processedPoints.filter(p => !p.isPhoto).length} Waypoints
              </span>
              <span className="inline-flex items-center gap-1 text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-xs">
                📷 {processedPoints.filter(p => p.isPhoto).length} Photos
              </span>
            </div>
          </div>

          {/* Verification Status Metric */}
          <div className={`p-4 rounded-xl border shadow-xs ${unverifiedCount > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-200'}`}>
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className={`w-4 h-4 ${unverifiedCount > 0 ? 'text-amber-600' : 'text-emerald-500'}`} /> Verification
              </span>
            </div>
            <div className="font-extrabold text-slate-900 text-lg flex items-center gap-2 mt-1">
              {unverifiedCount > 0 ? (
                <span className="text-amber-800 text-base">⚠️ {unverifiedCount} Unverified</span>
              ) : (
                <span className="text-emerald-700 text-base">✓ All Verified</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {unverifiedCount > 0 ? 'Offline buffered coordinates' : 'Real-time verified stream'}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5 mb-1">
              <Clock className="w-4 h-4 text-emerald-500" /> Shift Start
            </div>
            <div className="font-bold text-slate-800 text-base">
              {formatTime(summary.startTime)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {formatDate(summary.startTime)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5 mb-1">
              <Activity className="w-4 h-4 text-blue-500" /> Last Ping Time
            </div>
            <div className="font-bold text-slate-800 text-base flex items-center gap-2">
              {formatTime(summary.lastPingTime)}
              {summary.isTrackingActive && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Tracking Live" />
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {summary.isTrackingActive ? 'Tracking active' : 'Tracking completed/stopped'}
            </div>
          </div>
        </div>
      )}

      {/* Main Google Maps Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Simplified Map Header with Legend */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50/50 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-sm">
              {employee?.name ? `${employee.name}'s Route` : 'Employee Route'} • {selectedDate}
            </span>
            {summary.isTrackingActive && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Live
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Start
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-900 inline-block" /> End
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-1.5 bg-indigo-600 inline-block rounded" /> Route Path
            </span>
            {unverifiedCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-1.5 border-b-2 border-dashed border-amber-500 inline-block" /> Offline Travel
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-600 inline-block" /> Photo Check-in
            </span>
          </div>
        </div>

        {/* Map Body: Google Map Container always preserved in DOM */}
        <div className="w-full h-[600px] relative bg-slate-100">
          {/* Layer 1: Google Map (Persistent DOM node) */}
          <div ref={googleMapRef} style={{ width: '100%', height: '100%' }} className="w-full h-full" />

          {/* Layer 2: Loading Overlay */}
          {loadingRoute && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
              <p className="text-sm font-semibold text-slate-600">Loading {employees.find(e => e._id === selectedEmployeeId)?.name || 'employee'} route for {selectedDate}...</p>
            </div>
          )}

          {/* Layer 3: Error State with Retry */}
          {!loadingRoute && routeError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-white/95">
              <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
              <h4 className="font-bold text-slate-800 text-lg">Unable to Load Route</h4>
              <p className="text-slate-500 text-sm max-w-sm mt-1 mb-4">{routeError}</p>
              <button
                type="button"
                onClick={fetchRoute}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-xs"
              >
                Retry Request
              </button>
            </div>
          )}

          {/* Layer 4: Empty Route State */}
          {!loadingRoute && !routeError && !hasRoute && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-white/90">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="font-bold text-slate-700 text-lg">No Travelled Route Recorded</h4>
              <p className="text-slate-500 text-sm max-w-sm mt-1">
                No GPS coordinates were streamed for {employees.find(e => e._id === selectedEmployeeId)?.name || 'this employee'} on {selectedDate}.
              </p>
            </div>
          )}

          {/* Layer 5: Map API Key / Auth Error */}
          {(authError || (!apiKey && googleMapError)) && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-white">
              <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
              <h4 className="font-bold text-slate-800 text-lg">Google Maps Unavailable</h4>
              <p className="text-rose-600 text-sm max-w-md mt-1">{googleMapError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Chronological Waypoints Feed Table */}
      {hasRoute && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600" />
              Chronological Coordinate Audit Log ({processedPoints.length} Points)
            </h3>
            <span className="text-xs text-slate-500">
              Recorded in chronological sequence
            </span>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Coordinates</th>
                  <th className="px-4 py-3">Accuracy</th>
                  <th className="px-4 py-3">Speed</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedPoints.map((pt) => {
                  const isPhoto = pt.isPhoto;
                  const isStart = pt.isStart;
                  const isEnd = pt.isEnd;
                  const verificationStatus = pt.verificationStatus || 'VERIFIED';

                  return (
                    <tr 
                      key={pt._id || `${pt.lat}-${pt.lng}-${pt.recordedAt}`}
                      className={`hover:bg-slate-50/80 transition-colors ${verificationStatus === 'UNVERIFIED_GPS' ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">
                        {isPhoto ? '📷' : (isStart ? '▶ START' : (isEnd ? '🏁 END' : `#${pt.sequenceNumber}`))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${isPhoto ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                          {isPhoto ? 'Check-in Photo' : 'Waypoint'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {formatTime(pt.recordedAt)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        {pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {pt.accuracy ? `±${Math.round(pt.accuracy)}m` : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {pt.speed != null ? `${(pt.speed * 3.6).toFixed(1)} km/h` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {verificationStatus === 'UNVERIFIED_GPS' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            ⚠️ Unverified (Offline)
                          </span>
                        ) : verificationStatus === 'VERIFIED_BY_ADMIN' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ Verified by Admin
                          </span>
                        ) : verificationStatus === 'REJECTED_BY_ADMIN' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            ✕ Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            ● Live Verified
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {verificationStatus === 'UNVERIFIED_GPS' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => window.dispatchEvent(new CustomEvent('gotails_review_record', { detail: { recordId: pt._id, status: 'VERIFIED_BY_ADMIN' } }))}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                              title="Verify record"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => window.dispatchEvent(new CustomEvent('gotails_review_record', { detail: { recordId: pt._id, status: 'REJECTED_BY_ADMIN' } }))}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                              title="Reject record"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Audited</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteHistory;
