import React, { useState, useEffect } from 'react';
import { X, Loader2, User, Mail, Calendar } from 'lucide-react';
import { employeeService } from '../services/employee.service';
import toast from 'react-hot-toast';

const EditEmployeeModal = ({ isOpen, onClose, employee, onEmployeeUpdated }) => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    hireDate: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name || '',
        username: employee.username || '',
        email: employee.email || '',
        hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : ''
      });
    }
  }, [employee]);

  if (!isOpen || !employee) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedUsername = formData.username.trim().toLowerCase();
    if (!trimmedUsername) {
      toast.error('Username is required!');
      return;
    }
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      toast.error('Username must be between 3 and 30 characters!');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
      toast.error('Username can only contain letters, numbers, underscores, dots, and hyphens');
      return;
    }

    setIsSubmitting(true);
    try {
      await employeeService.updateEmployee(employee._id, {
        name: formData.name.trim(),
        username: trimmedUsername,
        email: formData.email.trim().toLowerCase(),
        hireDate: formData.hireDate
      });
      toast.success('Employee updated successfully!');
      if (onEmployeeUpdated) onEmployeeUpdated();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update employee details');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Edit Employee</h2>
            <p className="text-xs text-slate-500">Update username & profile details for mobile login</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g. Rohit Choudhary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Username <span className="text-xs text-indigo-600 font-normal">(Used for mobile login)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">@</span>
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm transition-all"
                placeholder="e.g. rohit_c"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Lowercase letters, numbers, underscores, dots, or hyphens</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="rohit@gotails.in"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hire Date</label>
            <input
              type="date"
              name="hireDate"
              value={formData.hireDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEmployeeModal;
