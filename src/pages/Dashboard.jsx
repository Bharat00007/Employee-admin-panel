import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, CalendarDays, Loader2, Award, CheckCircle2, XCircle } from 'lucide-react';
import { attendanceService } from '../services/attendance.service';
import { employeeService } from '../services/employee.service';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  
  // Daily Summary State
  const [summaryDate, setSummaryDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailySummary, setDailySummary] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Initial Load (Stats + Employees)
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [statsRes, empRes] = await Promise.all([
          attendanceService.getStats(),
          employeeService.getAllEmployees(1, 1) // Just to get total count
        ]);
        
        setStats(statsRes.data.stats || []);
        setEmployeeCount(empRes.pagination.total);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // Fetch Daily Summary when date changes
  useEffect(() => {
    const fetchDailySummary = async () => {
      setSummaryLoading(true);
      try {
        const res = await attendanceService.getDailySummary(summaryDate);
        setDailySummary(res.data.summary);
      } catch (error) {
        console.error(error);
      } finally {
        setSummaryLoading(false);
      }
    };
    fetchDailySummary();
  }, [summaryDate]);

  // Calculate some aggregate numbers
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const thisMonthStats = stats.filter(s => s.month === currentMonth && s.year === currentYear);
  const totalAttendancesThisMonth = thisMonthStats.reduce((sum, s) => sum + s.totalAttendances, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Company Overview</h1>
        <p className="text-slate-500 text-sm mt-1">High-level statistical view of workforce attendance.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center hover:shadow-md transition-shadow">
          <div className="bg-indigo-50 p-4 rounded-xl mr-4">
            <Users className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Employees</p>
            <p className="text-2xl font-bold text-slate-800">{loading ? '-' : employeeCount}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center hover:shadow-md transition-shadow">
          <div className="bg-emerald-50 p-4 rounded-xl mr-4">
            <TrendingUp className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Monthly Attendances</p>
            <p className="text-2xl font-bold text-slate-800">{loading ? '-' : totalAttendancesThisMonth}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center hover:shadow-md transition-shadow">
          <div className="bg-amber-50 p-4 rounded-xl mr-4">
            <CalendarDays className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Month</p>
            <p className="text-lg font-bold text-slate-800 mt-1">
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Daily Summary Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center">
            <CalendarDays className="h-5 w-5 mr-2 text-indigo-500" />
            Daily Attendance Summary
          </h2>
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-slate-600">Select Date:</label>
            <input 
              type="date" 
              value={summaryDate}
              onChange={(e) => setSummaryDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {summaryLoading ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-600" />
            <p>Loading summary...</p>
          </div>
        ) : dailySummary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Present Column */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-emerald-700 flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Present ({dailySummary.totalPresent})
                </h3>
              </div>
              {dailySummary.present.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No active employees checked in on this date.</p>
              ) : (
                <ul className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {dailySummary.present.map(p => (
                    <li 
                      key={p.employee._id} 
                      onClick={() => navigate(`/employees/${p.employee._id}/attendance`)}
                      className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-lg border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p.employee.name}</p>
                        <p className="text-xs text-slate-500">{p.employee.email}</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                        {p.logs.length} Log(s)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Absent Column */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-red-700 flex items-center">
                  <XCircle className="h-5 w-5 mr-2" />
                  Absent ({dailySummary.totalAbsent})
                </h3>
              </div>
              {dailySummary.absent.length === 0 ? (
                <p className="text-sm text-slate-500 italic">All active employees checked in on this date!</p>
              ) : (
                <ul className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {dailySummary.absent.map(a => (
                    <li 
                      key={a._id} 
                      onClick={() => navigate(`/employees/${a._id}/attendance`)}
                      className="flex items-center justify-between p-3 bg-red-50/50 rounded-lg border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{a.name}</p>
                        <p className="text-xs text-slate-500">{a.email}</p>
                      </div>
                      <span className="text-xs font-medium text-red-600">
                        No-Show
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center">
            <Award className="h-5 w-5 mr-2 text-indigo-500" />
            Attendance Leaderboard
          </h2>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-600" />
              <p>Aggregating statistics...</p>
            </div>
          ) : stats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
              <TrendingUp className="h-12 w-12 mb-4 text-slate-200" />
              <p className="text-lg font-medium text-slate-600">No data available yet</p>
              <p className="text-sm">Statistics will appear once employees begin checking in.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Employee Name</th>
                  <th className="p-4 font-semibold">Year</th>
                  <th className="p-4 font-semibold">Month</th>
                  <th className="p-4 font-semibold text-right">Total Attendances</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {stats.map((stat, index) => {
                  const monthName = new Date(stat.year, stat.month - 1).toLocaleString('default', { month: 'long' });
                  return (
                    <tr 
                      key={index} 
                      onClick={() => navigate(`/employees/${stat.employeeId}/attendance`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 font-medium text-slate-900 flex items-center group-hover:text-indigo-600 transition-colors">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mr-3">
                          {stat.employeeName.charAt(0).toUpperCase()}
                        </div>
                        {stat.employeeName}
                      </td>
                      <td className="p-4 text-slate-600">{stat.year}</td>
                      <td className="p-4 text-slate-600">{monthName}</td>
                      <td className="p-4 text-right">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                          {stat.totalAttendances}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
