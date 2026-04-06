import React from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

const icons = {
  success: <CheckCircle className="text-success-500" size={20} />,
  danger: <XCircle className="text-danger-500" size={20} />,
  warning: <AlertTriangle className="text-warning-500" size={20} />,
  info: <Info className="text-slate-500" size={20} />,
};

const bgColors = {
  success: 'bg-success-50 border-success-200',
  danger: 'bg-danger-50 border-danger-200',
  warning: 'bg-warning-50 border-warning-200',
  info: 'bg-slate-50 border-slate-200',
};

const Toast: React.FC = () => {
  const { notifications } = useNotification();

  return (
    <div className="fixed top-5 right-5 z-50 space-y-3 w-full max-w-sm">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`relative w-full p-4 pr-5 border rounded-lg shadow-lg flex items-start space-x-3 animate-fade-in ${bgColors[notification.type]}`}
        >
          <div className="flex-shrink-0">
            {icons[notification.type]}
          </div>
          <div className="flex-1 text-sm font-medium text-slate-800">
            {notification.message}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Toast;