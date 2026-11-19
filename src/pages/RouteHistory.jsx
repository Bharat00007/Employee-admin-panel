import React, { useState, useEffect, useRef } from 'react';
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
  CheckCircle2,
  ShieldAlert,
  Route as RouteIcon
} from 'lucide-react';
import { employeeService } from '../services/employee.service';
import { attendanceService } from '../services/attendance.service';

const createGoogleMarkerIcon = (text, isCheckin = false) => {
  const bgColor = isCheckin ? '#7C3AED' : '#4F46E5';
  const width = isCheckin ? 36 : 30;
  const height = isCheckin ? 46 : 38;

  let centerContent = '';
  if (isCheckin) {
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

  const svg = isCheckin ? `
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

const RouteHistory = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialEmployeeId = searchParams.get('employeeId') || '';
  const initialDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const [routeData, setRouteData] = useState(null);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const googleMapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [googleMapLoaded, setGoogleMapLoaded] = useState(false);
  const [googleMapError, setGoogleMapError] = useState(null);
  const [authError, setAuthError] = useState(false);

  const apiKey = (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 
    import.meta.env.VITE_GOOGLE_MAPS_JAVASCRIPT_API_KEY || 
    import.meta.env.GOOGLE_MAPS_JAVASCRIPT_API_KEY || ''
  ).trim();

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
    const fetchEmployees = async () => {
      try {
        const res = await employeeService.getAllEmployees(1, 100);
        const list = res.data?.employees || [];
        setEmployees(list);
        if (!selectedEmployeeId && list.length > 0) {
          setSelectedEmployeeId(list[0]._id);
        }
      } catch (err) {
        console.error('Failed to load employee list:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

  // 2. Fetch Route whenever selectedEmployeeId or selectedDate changes
  useEffect(() => {
    if (!selectedEmployeeId) return;

    const fetchRoute = async () => {
      setLoadingRoute(true);
      try {
        const res = await attendanceService.getRouteHistory(selectedEmployeeId, selectedDate);
        setRouteData(res.data);
      } catch (err) {
        console.error('Failed to fetch route history:', err);
        setRouteData(null);
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [selectedEmployeeId, selectedDate]);

  const rawRoute = routeData?.route || [];
  const summary = routeData?.summary || {};
  const employee = routeData?.employee || null;

  // Process points with micro-offsets for identical coordinates
  const processedPoints = React.useMemo(() => {
    const valid = rawRoute.filter(pt => pt && !isNaN(parseFloat(pt.lat)) && !isNaN(parseFloat(pt.lng)) && !(parseFloat(pt.lat) === 0 && parseFloat(pt.lng) === 0))
      .map(pt => ({ ...pt, lat: parseFloat(pt.lat), lng: parseFloat(pt.lng) }));

    const coordGroups = {};
    valid.forEach(pt => {
      const key = `${pt.lat.toFixed(6)},${pt.lng.toFixed(6)}`;
      if (!coordGroups[key]) coordGroups[key] = [];
      coordGroups[key].push(pt);
    });

    let wpCount = 1;
    return valid.map(pt => {
      const isPhoto = pt.type === 'checkin' || pt.type === 'photo_checkin' || !!pt.imageUrl;
      const sequenceNumber = isPhoto ? '📷' : wpCount++;

      const key = `${pt.lat.toFixed(6)},${pt.lng.toFixed(6)}`;
      const group = coordGroups[key];
      let displayLat = pt.lat;
      let displayLng = pt.lng;

      if (group.length > 1) {
        const idx = group.indexOf(pt);
        const radius = 0.00035; // ~38m radial spiderfy offset (~12-16px on map) so overlapping waypoints and photos are clearly visible side-by-side
        if (group.length === 2) {
          const offsetLng = (idx === 0 ? -radius : radius) / Math.cos((pt.lat * Math.PI) / 180);
          displayLng = pt.lng + offsetLng;
        } else {
          const angle = (2 * Math.PI * idx) / group.length;
          displayLat = pt.lat + radius * Math.sin(angle);
          displayLng = pt.lng + (radius * Math.cos(angle)) / Math.cos((pt.lat * Math.PI) / 180);
        }
      }

      return { ...pt, displayLat, displayLng, sequenceNumber, isPhoto };
    });
  }, [rawRoute]);

  const hasRoute = processedPoints.length > 0;

  // Initialize Google Maps when route data is ready
  useEffect(() => {
    if (!hasRoute || authError) return;
    if (!apiKey) {
      setGoogleMapError('VITE_GOOGLE_MAPS_API_KEY is not defined in admin_panel/.env');
      return;
    }

    let isMounted = true;
    let resizeTimer = null;

    loadGoogleMapsAPI(apiKey).then((google) => {
      if (!isMounted || !googleMapRef.current) return;

      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      let map = mapInstanceRef.current;
      const center = { lat: processedPoints[0].displayLat, lng: processedPoints[0].displayLng };

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
          <div style="font-family: system-ui, sans-serif; font-size: 12px; color: #1e293b; max-width: 250px; line-height: 1.4; padding: 4px;">
            <div style="font-weight: 700; color: ${isPhoto ? '#7c3aed' : '#4f46e5'}; margin-bottom: 4px;">
              ${isPhoto ? '📸 Check-in Photograph' : '📍 Waypoint #' + point.sequenceNumber}
            </div>
            <div style="font-weight: 600; color: #0f172a; margin-bottom: 2px;">
              ${escapeHtml(employee?.name || 'Employee')}
            </div>
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
          map.setCenter(center);
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
  }, [hasRoute, processedPoints, apiKey, authError]);

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
                setSelectedEmployeeId(e.target.value);
                setSearchParams({ employeeId: e.target.value, date: selectedDate });
              }}
              disabled={loadingEmployees}
              className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-hidden"
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
                setSelectedDate(e.target.value);
                setSearchParams({ employeeId: selectedEmployeeId, date: e.target.value });
              }}
              className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      {hasRoute && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5"><RouteIcon className="w-4 h-4 text-indigo-600" /> Total Distance</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
                {summary.distanceCalculationMethod === 'google_directions_api' ? 'Directions API' : (isStationary ? 'Stationary' : 'Estimated')}
              </span>
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
        {/* Map Header with Legend */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50/50 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-sm">
              {employee?.name ? `${employee.name}'s Route` : 'Employee Route'} • {selectedDate}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              Google Maps
            </span>
            {summary.isTrackingActive && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Live
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" /> Route Waypoint
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-600 inline-block" /> Photo Check-in
            </span>
          </div>
        </div>

        {/* Map Body */}
        <div className="w-full h-[600px] relative bg-slate-100">
          {loadingRoute ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
              <p className="text-sm font-semibold text-slate-600">Retrieving full route coordinates from server...</p>
            </div>
          ) : !hasRoute ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="font-bold text-slate-700 text-lg">No Travelled Route Recorded</h4>
              <p className="text-slate-500 text-sm max-w-sm mt-1">
                No GPS coordinates were streamed for {employee?.name || 'this employee'} on {selectedDate}.
              </p>
            </div>
          ) : (authError || (!apiKey && googleMapError)) ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-white">
              <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
              <h4 className="font-bold text-slate-800 text-lg">Google Maps Unavailable</h4>
              <p className="text-rose-600 text-sm max-w-md mt-1">{googleMapError}</p>
            </div>
          ) : (
            <div ref={googleMapRef} style={{ width: '100%', height: '100%' }} className="w-full h-full" />
          )}
        </div>
      </div>

      {/* Chronological Waypoints Feed Table */}
      {hasRoute && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm">
              Chronological Waypoint Audit ({processedPoints.length} Coordinates)
            </h3>
            <span className="text-xs text-slate-500">Sorted from origin to finish</span>
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-white border-b border-slate-100 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3 font-semibold">#</th>
                  <th className="p-3 font-semibold">Time</th>
                  <th className="p-3 font-semibold">Coordinates (Lat, Lng)</th>
                  <th className="p-3 font-semibold">Accuracy</th>
                  <th className="p-3 font-semibold">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {processedPoints.map((pt, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors font-medium">
                    <td className="p-3 text-slate-400">{pt.sequenceNumber}</td>
                    <td className="p-3 text-slate-800 font-bold">{formatTime(pt.recordedAt)}</td>
                    <td className="p-3 font-mono text-slate-600">
                      {pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}
                    </td>
                    <td className="p-3 text-slate-500">
                      {pt.accuracy ? `±${Math.round(pt.accuracy)}m` : 'Normal'}
                    </td>
                    <td className="p-3">
                      {pt.isPhoto ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
                          📷 Photo Check-in
                        </span>
                      ) : idx === 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                          Start Origin
                        </span>
                      ) : idx === processedPoints.length - 1 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                          Final Destination
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Route Waypoint
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteHistory;
