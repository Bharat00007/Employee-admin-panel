import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Loader2, ShieldCheck, MapPin, Clock } from 'lucide-react';
import { settingsService } from '../services/settings.service';
import toast from 'react-hot-toast';

const Settings = () => {
  const [maxDailyAttendance, setMaxDailyAttendance] = useState('');
  const [gpsTrackingEndTime, setGpsTrackingEndTime] = useState('19:00');
  const [gpsTrackingEnabled, setGpsTrackingEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await settingsService.getSettings();
        if (response.data.settings) {
          setMaxDailyAttendance(response.data.settings.max_daily_attendance?.toString() || '1');
          setGpsTrackingEndTime(response.data.settings.gps_tracking_end_time || '19:00');
          setGpsTrackingEnabled(response.data.settings.gps_tracking_enabled !== false);
        }
      } catch (_error) {
        toast.error('Failed to load global settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = {
        max_daily_attendance: Number(maxDailyAttendance),
        gps_tracking_end_time: gpsTrackingEndTime,
        gps_tracking_enabled: gpsTrackingEnabled
      };
      
      const res = await settingsService.updateSettings(payload);
      if (res.data?.settings) {
        setMaxDailyAttendance(res.data.settings.max_daily_attendance?.toString() || '1');
        setGpsTrackingEndTime(res.data.settings.gps_tracking_end_time || '19:00');
        setGpsTrackingEnabled(res.data.settings.gps_tracking_enabled !== false);
      }
      toast.success('Global settings updated successfully!');
    } catch (_error) {
      // Handled globally by axios interceptor toast
    } finally {
      setSaving(false);
    }
  };

  // Convert "HH:mm" 24h string to friendly 12h label
  const formatTimeLabel = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const minute = m || '00';
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute} ${period}`;
  };

  const presets = [
    { label: '5:00 PM', value: '17:00' },
    { label: '6:00 PM', value: '18:00' },
    { label: '6:30 PM', value: '18:30' },
    { label: '7:00 PM (Default)', value: '19:00' },
    { label: '8:00 PM', value: '20:00' },
    { label: '9:00 PM', value: '21:00' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-600" />
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <SettingsIcon className="h-6 w-6 mr-2 text-indigo-600" />
          Global Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Configure application-wide rules, limits, and GPS tracking schedules. Changes take effect immediately.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Security & Rules */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center bg-slate-50/50">
            <ShieldCheck className="h-5 w-5 text-indigo-500 mr-2" />
            <h2 className="text-lg font-bold text-slate-800">Security & Rules</h2>
          </div>

          <div className="p-6">
            <div className="max-w-md">
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Max Daily Attendance Limit
              </label>
              <p className="text-xs text-slate-500 mb-3">
                How many times can an employee log their attendance in a single day? 
                (e.g., 2 for Check-in and Check-out).
              </p>
              <input
                type="number"
                required
                min="1"
                max="100"
                value={maxDailyAttendance}
                onChange={(e) => setMaxDailyAttendance(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-900"
                placeholder="e.g. 2"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Employee GPS Tracking Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center bg-slate-50/50">
            <MapPin className="h-5 w-5 text-indigo-500 mr-2" />
            <h2 className="text-lg font-bold text-slate-800">Employee GPS Tracking Settings</h2>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <span className="text-sm font-bold text-slate-800">Background GPS Tracking</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automatically track employee location coordinates every ~60 seconds after photo check-in.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={gpsTrackingEnabled}
                  onChange={(e) => setGpsTrackingEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  GPS Tracking End Time
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Select the daily cutoff time when employee background GPS collection automatically stops.
                  Default is 7:00 PM (19:00 IST).
                </p>

                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    required
                    value={gpsTrackingEndTime}
                    onChange={(e) => setGpsTrackingEndTime(e.target.value)}
                    className="px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-semibold text-slate-800 text-base"
                  />
                  <div className="px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-700">
                    Stops at {formatTimeLabel(gpsTrackingEndTime)}
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Quick Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setGpsTrackingEndTime(preset.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        gpsTrackingEndTime === preset.value
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving Changes...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Save Settings</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
