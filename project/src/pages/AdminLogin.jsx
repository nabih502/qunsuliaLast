import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, User, Eye, EyeOff, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminLogin = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await login(formData.username, formData.password);

    if (result.success) {
      navigate('/admin/dashboard');
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  const fillTestCredentials = (role) => {
    if (role === 'admin') {
      setFormData({ username: 'admin', password: 'admin123' });
    } else if (role === 'staff1') {
      setFormData({ username: 'staff1', password: 'staff123' });
    } else if (role === 'staff2') {
      setFormData({ username: 'staff2', password: 'staff123' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#276073] via-[#1e4a5a] to-[#276073] flex items-center justify-center p-4" dir="rtl">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" viewBox="0 0 400 400" fill="none">
          <defs>
            <pattern id="admin-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#admin-grid)" />
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-[#276073] to-[#1e4a5a] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            لوحة تحكم الإدارة
          </h1>
          <p className="text-gray-600">
            تسجيل الدخول للنظام الإداري
          </p>
        </div>

        {/* Test Credentials */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">بيانات تجريبية:</h3>
          <div className="space-y-2 text-xs">
            <button
              onClick={() => fillTestCredentials('admin')}
              className="block w-full text-right bg-blue-100 hover:bg-blue-200 p-2 rounded text-blue-700 transition-colors duration-200"
            >
              <strong>مدير عام:</strong> admin / admin123
            </button>
            <button
              onClick={() => fillTestCredentials('staff1')}
              className="block w-full text-right bg-green-100 hover:bg-green-200 p-2 rounded text-green-700 transition-colors duration-200"
            >
              <strong>موظف جوازات:</strong> staff1 / staff123
            </button>
            <button
              onClick={() => fillTestCredentials('staff2')}
              className="block w-full text-right bg-purple-100 hover:bg-purple-200 p-2 rounded text-purple-700 transition-colors duration-200"
            >
              <strong>موظف تصديقات:</strong> staff2 / staff123
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اسم المستخدم
            </label>
            <div className="relative">
              <User className="absolute top-3.5 right-4 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#276073] focus:border-transparent outline-none transition-all duration-200"
                placeholder="أدخل اسم المستخدم"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              كلمة المرور
            </label>
            <div className="relative">
              <Lock className="absolute top-3.5 right-4 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#276073] focus:border-transparent outline-none transition-all duration-200"
                placeholder="أدخل كلمة المرور"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-3.5 left-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-2 rtl:space-x-reverse text-red-600 bg-red-50 border border-red-200 rounded-lg p-3"
            >
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-[#276073] to-[#1e4a5a] hover:from-[#1e4a5a] hover:to-[#276073] disabled:from-gray-400 disabled:to-gray-500 text-white py-3 rounded-lg font-bold transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center space-x-2 rtl:space-x-reverse"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>جاري تسجيل الدخول...</span>
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                <span>تسجيل الدخول</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            © 2025 القنصلية السودانية - نظام إدارة محمي
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;