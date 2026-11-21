import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Camera, Loader2, ArrowLeft, History, ChevronLeft, ChevronRight, User, Calendar, Radio, Route } from 'lucide-react';
import { attendanceService } from '../services/attendance.service';
import { employeeService } from '../services/employee.service';
import MapModal from '../components/MapModal';
import toast from 'react-hot-toast';

const EmployeeHistory = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  
  // For the Image Lightbox
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Route Map State
  const [mapModal, setMapModal] = useState({ 
    isOpen: false, 
    routeData: null, 
    locations: [], 
    lat: null, 
    lng: null, 
    address: '', 
    title: '', 
    isLoading: false 
  });
  const [selectedRouteDate, setSelectedRouteDate] = useState(new Date().toISOString().split('T')[0]);
  const [routeLoading, setRouteLoading] = useState(false);

  // Fetch all employees for quick switcher
  useEffect(() => {
    const fetchEmployeesList = async () => {
      try {
        const res = await employeeService.getAllEmployees(1, 100);
        setAllEmployees(res.data?.employees || []);
      } catch (err) {
        console.error('Failed to load employee list:', err);
      }
    };
    fetchEmployeesList();
  }, []);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 20;

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const response = await attendanceService.getAllAttendance(page, limit, id);
        setLogs(response.data.attendances);
        setTotalPages(response.pagination.totalPages);
        setTotalRecords(response.pagination.total);
        
        if (response.data.attendances.length > 0 && !employeeInfo) {
          setEmployeeInfo(response.data.attendances[0].employee);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [id, page, employeeInfo]);

  const [liveRequesting, setLiveRequesting] = useState(false);

  // Open full travelled route on map
  const handleOpenRouteMap = async (targetDate, silent = false, focusId = null) => {
    const formattedDate = targetDate.includes('T') ? targetDate.split('T')[0] : targetDate;
    if (!silent) setRouteLoading(true);
    if (!silent) {
      setMapModal(prev => ({
        ...prev,
        isOpen: true,
        isLoading: true,
        title: `Employee GPS Locations (${formattedDate})`,
        error: null
      }));
    }

    try {
      const res = await attendanceService.getRouteHistory(id, formattedDate);
      setMapModal(prev => ({
        ...prev,
        isOpen: true,
        isLoading: false,
        title: `Employee GPS Locations (${formattedDate})`,
        routeData: res.data,
        focusRecordId: focusId,
        locations: [],
        lat: null,
        lng: null,
        error: null
      }));
    } catch (err) {
      console.error('Failed to load route history:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to retrieve GPS history from server';
      setMapModal(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMsg 
      }));
    } finally {
      if (!silent) setRouteLoading(false);
    }
  };

  // Immediate live location request for this employee with multi-stage progress tracking
  const handleGetLiveLocation = async () => {
    setLiveRequesting(true);
    const toastId = toast.loading('Request sent – Waiting for employee device...');
    const todayStr = new Date().toISOString().split('T')[0];
    setSelectedRouteDate(todayStr);

    // Pre-fetch stored MongoDB records to ensure admin immediately sees location history
    await handleOpenRouteMap(todayStr, true);

    try {
      const res = await attendanceService.requestLiveLocation(id);
      const requestId = res.data?.requestId;

      if (!requestId) {
        toast.dismiss(toastId);
        toast('Live request signal dispatched. Displaying stored records from database.', { icon: 'ℹ️' });
        setLiveRequesting(false);
        await handleOpenRouteMap(todayStr, false);
        return;
      }

      // Actively poll request lifecycle every 1.5 seconds up to 20 seconds
      let attempts = 0;
      const maxAttempts = 13;
      const pollTimer = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await attendanceService.getLiveRequestStatus(requestId, id);
          const sData = statusRes.data;

          if (sData?.stage === 'received') {
            toast.loading('Employee device received request...', { id: toastId });
          } else if (sData?.stage === 'collecting_gps') {
            toast.loading('Collecting fresh GPS location...', { id: toastId });
          } else if (sData?.stage === 'uploading') {
            toast.loading('Uploading pending GPS records...', { id: toastId });
          } else if (sData?.status === 'fulfilled' || sData?.stage === 'fulfilled') {
            clearInterval(pollTimer);
            setLiveRequesting(false);
            const count = sData.uploadedCount || 0;
            toast.success(`Synchronization completed – ${count} GPS records uploaded!`, { id: toastId });
            await handleOpenRouteMap(todayStr, false);
          } else if (sData?.status === 'failed' || sData?.status === 'expired' || attempts >= maxAttempts) {
            clearInterval(pollTimer);
            setLiveRequesting(false);
            toast(
              sData?.errorMessage 
                ? `Device sync status: ${sData.errorMessage}. Showing last stored location.` 
                : 'Employee device offline or unreachable. Loaded last stored GPS records from database.',
              { id: toastId, icon: '⚠️' }
            );
            await handleOpenRouteMap(todayStr, false);
          }
        } catch (_pollErr) {
          if (attempts >= maxAttempts) {
            clearInterval(pollTimer);
            setLiveRequesting(false);
            toast('Employee device offline or unreachable. Loaded last stored GPS records from database.', { id: toastId, icon: '⚠️' });
            await handleOpenRouteMap(todayStr, false);
          }
        }
      }, 1500);

    } catch (err) {
      toast.dismiss(toastId);
      toast(err.response?.data?.message || 'Device unreachable. Loaded last stored GPS records.', { icon: '⚠️' });
      setLiveRequesting(false);
      await handleOpenRouteMap(todayStr, false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={() => navigate('/employees')}
          className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <History className="h-6 w-6 mr-2 text-indigo-600" />
            Attendance & Travelled Route History
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {employeeInfo ? `Showing continuous GPS movement and check-in logs for ${employeeInfo.name}${employeeInfo.username ? ` (@${employeeInfo.username})` : ''}` : 'Detailed chronological feed'}
          </p>
        </div>
      </div>

      {/* Quick Route Audit & Employee Switcher Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Employee Switcher */}
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-slate-400" />
            <select
              value={id}
              onChange={(e) => {
                navigate(`/employees/${e.target.value}/attendance`);
                setEmployeeInfo(null);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {allEmployees.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}{emp.username ? ` (@${emp.username})` : ''} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input 
              type="date"
              value={selectedRouteDate}
              onChange={(e) => setSelectedRouteDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleGetLiveLocation}
            disabled={liveRequesting}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50"
            title="Poll device for fresh live coordinates"
          >
            {liveRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4 animate-pulse" />}
            Get Live Location
          </button>

          <button
            onClick={() => handleOpenRouteMap(selectedRouteDate)}
            disabled={routeLoading}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50"
          >
            {routeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            View Travelled Route on Map
          </button>
        </div>
      </div>

      {/* Recent Attendance Feed */}
      <div className="space-y-6">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center h-[400px] text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-600" />
            <p>Loading attendance feed...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center h-[400px] text-slate-400">
            <History className="h-12 w-12 mb-4 text-slate-200" />
            <p className="text-lg font-medium text-slate-600">No attendance logs found</p>
            <p className="text-sm">This employee hasn't checked in yet.</p>
          </div>
        ) : (
          Object.entries(
            logs.reduce((acc, log) => {
              const dateKey = new Date(log.createdAt).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              });
              if (!acc[dateKey]) acc[dateKey] = [];
              acc[dateKey].push(log);
              return acc;
            }, {})
          ).map(([date, dayLogs]) => (
            <div key={date} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-slate-800">{date}</h3>
                  <button
                    onClick={() => {
                      const rawDate = dayLogs[0]?.createdAt || date;
                      const dt = new Date(rawDate);
                      const targetDate = !isNaN(dt.getTime())
                        ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
                        : new Date().toISOString().split('T')[0];
                      handleOpenRouteMap(targetDate);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full transition-colors border border-indigo-200 shadow-xs"
                  >
                    <MapPin size={12} className="text-indigo-600" /> View Entire Day on Map
                  </button>
                </div>
                <span className="text-xs font-semibold px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                  {dayLogs.length} {dayLogs.length === 1 ? 'Log' : 'Logs'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-wider">
                      <th className="p-4 font-semibold w-1/4">Time</th>
                      <th className="p-4 font-semibold w-2/4">Location</th>
                      <th className="p-4 font-semibold text-center w-1/4">Snapshot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {dayLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-slate-900 font-medium">
                          {new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4">
                          <div className="flex items-start">
                            <MapPin className="h-4 w-4 text-slate-400 mr-2 mt-0.5 flex-shrink-0" />
                            <span className="text-slate-600 text-sm line-clamp-2" title={log.addressString}>
                              {log.addressString}
                            </span>
                          </div>
                          <div className="mt-1 ml-6">
                            {log.coordinates && (
                              <button
                                onClick={() => {
                                  const rawDate = log.createdAt;
                                  const dt = new Date(rawDate);
                                  const targetDate = !isNaN(dt.getTime())
                                    ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
                                    : new Date().toISOString().split('T')[0];
                                  handleOpenRouteMap(targetDate, false, log._id);
                                }}
                                className="text-[10px] text-blue-500 hover:text-blue-600 hover:underline font-mono inline-flex items-center gap-1"
                              >
                                <MapPin size={10} /> View on Map [{log.coordinates.lat.toFixed(4)}, {log.coordinates.lng.toFixed(4)}]
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {log.imageUrl ? (
                            <button 
                              onClick={() => setSelectedImage(log.imageUrl)}
                              className="group relative inline-block rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow border border-slate-200"
                            >
                              <img 
                                src={log.imageUrl} 
                                alt="Check-in Snapshot" 
                                className="h-16 w-16 object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="h-5 w-5 text-white" />
                              </div>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs italic">No Snapshot</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && logs.length > 0 && (
        <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Showing page {page} of {totalPages} ({totalRecords} records)
          </span>
          <div className="flex space-x-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center">
            <button 
              className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <img 
              src={selectedImage} 
              alt="Full Resolution Snapshot" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        </div>
      )}

      {/* Continuous Route Travelled Map Modal */}
      <MapModal 
        {...mapModal} 
        onClose={() => setMapModal(prev => ({ ...prev, isOpen: false }))} 
        onRefreshRoute={(silent) => handleOpenRouteMap(selectedRouteDate, silent)}
        onImagePreview={(imgUrl) => setSelectedImage(imgUrl)}
      />
    </div>
  );
};

export default EmployeeHistory;
