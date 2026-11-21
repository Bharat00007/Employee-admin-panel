import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Search, ChevronLeft, ChevronRight, Loader2, Power, Eye, KeyRound, Radio, MapPin, Pencil, Activity } from 'lucide-react';
import { employeeService } from '../services/employee.service';
import AddEmployeeModal from '../components/AddEmployeeModal';
import EditEmployeeModal from '../components/EditEmployeeModal';
import ResetPasswordModal from '../components/ResetPasswordModal';
import MapModal from '../components/MapModal';
import toast from 'react-hot-toast';
import { attendanceService } from '../services/attendance.service';

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editModalEmployee, setEditModalEmployee] = useState(null);
  const [resetModalEmployee, setResetModalEmployee] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapModal, setMapModal] = useState({ isOpen: false, routeData: null, isLoading: false, title: '' });
  const [liveLoadingId, setLiveLoadingId] = useState(null);
  const navigate = useNavigate();
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 10;

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const [empData, statsData] = await Promise.all([
        employeeService.getAllEmployees(page, limit),
        attendanceService.getStats()
      ]);

      // Calculate total lifetime attendances per employee
      const stats = statsData.data.stats || [];
      const employeesWithCounts = empData.data.employees.map(emp => {
        const empStats = stats.filter(s => s.employeeId === emp._id);
        const total = empStats.reduce((sum, s) => sum + s.totalAttendances, 0);
        return { ...emp, totalAttendances: total };
      });

      setEmployees(employeesWithCounts);
      setTotalPages(empData.pagination.totalPages);
      setTotalRecords(empData.pagination.total);
    } catch (_error) {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleToggleStatus = async (id, currentStatus) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} this employee?`)) return;
    
    try {
      await employeeService.toggleEmployeeStatus(id);
      toast.success(`Employee ${action}d successfully`);
      fetchEmployees();
    } catch (_error) {
      // toast handled globally
    }
  };

  const handleResetPassword = (emp) => {
    setResetModalEmployee(emp);
  };

  const handleGetLiveLocation = async (emp) => {
    setLiveLoadingId(emp._id);
    const todayStr = new Date().toISOString().split('T')[0];
    const toastId = toast.loading(`Request sent – Waiting for ${emp.name}'s device...`);

    // Immediately fetch and open latest stored GPS records from MongoDB
    try {
      const initialRouteRes = await attendanceService.getRouteHistory(emp._id, todayStr);
      setMapModal({
        isOpen: true,
        routeData: initialRouteRes.data,
        isLoading: false,
        title: `Live Tracking: ${emp.name}`
      });
    } catch (_initialErr) {
      console.warn('Could not pre-fetch route history:', _initialErr.message);
    }

    try {
      const res = await attendanceService.requestLiveLocation(emp._id);
      const requestId = res.data?.requestId;

      if (!requestId) {
        toast.dismiss(toastId);
        toast('Live request signal dispatched. Displaying stored records.', { icon: 'ℹ️' });
        setLiveLoadingId(null);
        return;
      }

      // Poll status every 1.5s up to 20 seconds
      let attempts = 0;
      const maxAttempts = 13;
      const pollTimer = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await attendanceService.getLiveRequestStatus(requestId, emp._id);
          const sData = statusRes.data;

          if (sData?.stage === 'received') {
            toast.loading(`Device received request from ${emp.name}...`, { id: toastId });
          } else if (sData?.stage === 'collecting_gps') {
            toast.loading(`Collecting fresh GPS location from ${emp.name}...`, { id: toastId });
          } else if (sData?.stage === 'uploading') {
            toast.loading(`Uploading pending GPS records from ${emp.name}...`, { id: toastId });
          } else if (sData?.status === 'fulfilled' || sData?.stage === 'fulfilled') {
            clearInterval(pollTimer);
            setLiveLoadingId(null);
            const count = sData.uploadedCount || 0;
            toast.success(`Synchronization completed – ${count} GPS records uploaded!`, { id: toastId });
            const freshRes = await attendanceService.getRouteHistory(emp._id, todayStr);
            setMapModal(prev => ({
              ...prev,
              routeData: freshRes.data
            }));
          } else if (sData?.status === 'failed' || sData?.status === 'expired' || attempts >= maxAttempts) {
            clearInterval(pollTimer);
            setLiveLoadingId(null);
            // Decouple device timeout from database display
            toast(
              sData?.errorMessage 
                ? `${emp.name}'s device status: ${sData.errorMessage}. Showing last stored location.` 
                : `${emp.name}'s device offline or unreachable. Loaded last stored GPS records.`,
              { id: toastId, icon: '⚠️' }
            );
            const freshRes = await attendanceService.getRouteHistory(emp._id, todayStr);
            setMapModal(prev => ({
              ...prev,
              routeData: freshRes.data
            }));
          }
        } catch (_pollErr) {
          if (attempts >= maxAttempts) {
            clearInterval(pollTimer);
            setLiveLoadingId(null);
            toast(`${emp.name}'s device offline or timed out. Loaded last stored GPS records.`, { id: toastId, icon: '⚠️' });
            const freshRes = await attendanceService.getRouteHistory(emp._id, todayStr);
            setMapModal(prev => ({
              ...prev,
              routeData: freshRes.data
            }));
          }
        }
      }, 1500);

    } catch (err) {
      toast.dismiss(toastId);
      toast(err.response?.data?.message || 'Device unreachable. Loaded last stored GPS records.', { icon: '⚠️' });
      setLiveLoadingId(null);
      const freshRes = await attendanceService.getRouteHistory(emp._id, todayStr);
      setMapModal(prev => ({
        ...prev,
        routeData: freshRes.data
      }));
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <Users className="h-6 w-6 mr-2 text-indigo-600" />
            Employee Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage your workforce, add new employees, and review access.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:shadow transition-all flex items-center"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add Employee
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="relative w-64">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, username or email..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="text-sm text-slate-500 font-medium">
            Showing {filteredEmployees.length} of {totalRecords}
          </div>
        </div>

        {/* Table Area */}
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-600" />
              <p>Loading employees...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
              <Users className="h-12 w-12 mb-4 text-slate-200" />
              <p className="text-lg font-medium text-slate-600">No employees found</p>
              <p className="text-sm">Click 'Add Employee' to get started.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Employee</th>
                  <th className="p-4 font-semibold">Email</th>
                  <th className="p-4 font-semibold">GPS Tracking Health</th>
                  <th className="p-4 font-semibold">Hire Date</th>
                  <th className="p-4 font-semibold text-center">Total Attendances</th>
                  <th className="p-4 font-semibold">Role</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredEmployees.map((emp) => (
                  <tr key={emp._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-slate-900">{emp.name}</div>
                      <div className="text-xs text-indigo-600 font-mono flex items-center gap-1">
                        <span>@{emp.username || 'no-username'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600">{emp.email}</td>
                    <td className="p-4">
                      {emp.trackingHealth === 'HEALTHY' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Tracking Healthy
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {emp.lastSeenAgoSeconds !== null ? `${Math.round(emp.lastSeenAgoSeconds / 60)}m ago` : 'Live'}
                          </span>
                        </div>
                      ) : emp.trackingHealth === 'DELAYED' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            GPS Delayed
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {emp.lastSeenAgoSeconds !== null ? `${Math.round(emp.lastSeenAgoSeconds / 60)}m ago` : 'Delayed'}
                          </span>
                        </div>
                      ) : emp.trackingHealth === 'POOR_ACCURACY' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Poor Accuracy (±{Math.round(emp.latestLocation?.accuracy)}m)
                          </span>
                        </div>
                      ) : emp.trackingHealth === 'OFFLINE' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Device Offline
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {emp.latestLocation?.recordedAt ? new Date(emp.latestLocation.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No pings today'}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs text-slate-500 bg-slate-50 border border-slate-200">
                          Awaiting Fix
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600">
                      {emp.hireDate ? new Date(emp.hireDate).toLocaleDateString() : new Date(emp.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        {emp.totalAttendances || 0}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        emp.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {emp.role !== 'admin' && (
                        <div className="flex items-center justify-end space-x-1">
                          <button 
                            onClick={() => handleGetLiveLocation(emp)}
                            disabled={liveLoadingId === emp._id}
                            className="p-1.5 rounded-md transition-colors text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                            title="Get Live Location"
                          >
                            {liveLoadingId === emp._id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                            ) : (
                              <Radio className="h-4 w-4" />
                            )}
                          </button>
                          <button 
                            onClick={() => setEditModalEmployee(emp)}
                            className="p-1.5 rounded-md transition-colors text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit Username & Profile"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => navigate(`/employees/${emp._id}/attendance`)}
                            className="p-1.5 rounded-md transition-colors text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="View Attendance History"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleResetPassword(emp)}
                            className="p-1.5 rounded-md transition-colors text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                            title="Reset Password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(emp._id, emp.isActive)}
                            className={`p-1.5 rounded-md transition-colors ${
                              emp.isActive 
                                ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' 
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={emp.isActive ? "Deactivate Employee" : "Activate Employee"}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && employees.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white">
            <span className="text-sm text-slate-500">
              Showing page {page} of {totalPages}
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
      </div>

      {/* Reusable Modal Component */}
      <AddEmployeeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onEmployeeAdded={fetchEmployees}
      />
      <EditEmployeeModal
        isOpen={!!editModalEmployee}
        onClose={() => setEditModalEmployee(null)}
        employee={editModalEmployee}
        onEmployeeUpdated={fetchEmployees}
      />
      <ResetPasswordModal
        isOpen={!!resetModalEmployee}
        onClose={() => setResetModalEmployee(null)}
        employee={resetModalEmployee}
      />
      <MapModal
        {...mapModal}
        onClose={() => setMapModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Employees;
