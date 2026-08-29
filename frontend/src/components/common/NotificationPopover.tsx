import { useState, useEffect, useRef } from 'react';
import {
  getStoredNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type OperationalNotification,
} from '../../data/notificationStore';
import { Bell, CheckCheck, AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function NotificationPopover() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<OperationalNotification[]>(getStoredNotifications());
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotifications(getStoredNotifications());
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAll = () => {
    const updated = markAllNotificationsAsRead();
    setNotifications(updated);
  };

  const handleNotificationClick = (notif: OperationalNotification) => {
    const updated = markNotificationAsRead(notif.id);
    setNotifications(updated);
    setIsOpen(false);
    if (notif.actionPayload) {
      if (notif.actionPayload.type === 'REPORT') {
        navigate('/reports');
      } else {
        navigate('/');
      }
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-7 h-7 rounded-xs bg-[#111716] border border-[#29332F] text-[#A5B1AC] hover:text-[#5EE6C0] flex items-center justify-center cursor-pointer transition-colors"
        title="Operational Incident Alerts"
      >
        <Bell className="w-3.5 h-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#F05D5E] text-white text-[8px] font-mono font-bold rounded-full flex items-center justify-center pulse-glow-anim">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[#0B0F0E] border border-[#29332F] rounded-xs shadow-2xl z-50 overflow-hidden font-sans text-xs select-none">
          <div className="p-2.5 bg-[#111716] border-b border-[#202925] flex items-center justify-between font-mono">
            <div className="flex items-center gap-1.5 font-bold text-[#E8EFEC] text-xs">
              <Bell className="w-3.5 h-3.5 text-[#5EE6C0]" />
              <span>OPERATIONAL ALERTS [{unreadCount}]</span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-[9px] text-[#5EE6C0] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3 h-3" />
                <span>MARK ALL READ</span>
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-[#202925] p-1 space-y-1">
            {notifications.map((n) => {
              const iconMap = {
                ALERT: <AlertOctagon className="w-3.5 h-3.5 text-[#F05D5E]" />,
                WARNING: <AlertTriangle className="w-3.5 h-3.5 text-[#E8A84E]" />,
                INFO: <Info className="w-3.5 h-3.5 text-[#5EE6C0]" />,
                SUCCESS: <CheckCircle2 className="w-3.5 h-3.5 text-[#38B99A]" />,
              };

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left p-2 rounded-xs transition-colors cursor-pointer block font-mono ${
                    !n.read ? 'bg-[#161D1B] border-l-2 border-l-[#5EE6C0]' : 'hover:bg-[#111716]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex-shrink-0">{iconMap[n.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#E8EFEC] text-[11px] leading-tight line-clamp-1">
                        {n.title}
                      </div>
                      <p className="text-[10px] text-[#A5B1AC] font-sans line-clamp-2 mt-0.5">
                        {n.message}
                      </p>
                      <span className="text-[8px] text-[#68746F] block mt-1">
                        {new Date(n.timestamp).toISOString().replace('T', ' ').replace('Z', '')} UTC
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
