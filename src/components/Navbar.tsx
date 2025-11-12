import { Search, Bell, Settings, LogOut, UserCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GraduationCap, Phone, MessageCircle, CreditCard, Users, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabaseClient";
import { formatDistanceToNow } from "date-fns";

const PHOTO_KEY = "profilePhoto";

interface Notification {
  id: string;
  event: string;
  payload: any;
  read: boolean;
  created_at: string;
  admin_id: string | null;
}

const Navbar = () => {
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(PHOTO_KEY);
    if (saved) setPhoto(saved);

    // Fetch notifications on mount
    fetchNotifications();

    // Set up real-time subscription
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          console.log('New notification:', payload);
          fetchNotifications(); // Refresh notifications

          // Show toast for new notification
          const newNotif = payload.new as Notification;
          toast({
            title: getNotificationTitle(newNotif.event),
            description: getNotificationDescription(newNotif),
          });
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);

      toast({
        title: "✅ All notifications marked as read",
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationIcon = (event: string) => {
    switch (event) {
      case 'new_lead':
        return Users;
      case 'payment_received':
        return DollarSign;
      case 'lead_hot':
        return Phone;
      case 'message_received':
        return MessageCircle;
      case 'payment_pending':
        return CreditCard;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (event: string) => {
    switch (event) {
      case 'new_lead':
        return 'text-blue-500';
      case 'payment_received':
        return 'text-green-500';
      case 'lead_hot':
        return 'text-status-hot';
      case 'message_received':
        return 'text-purple-500';
      case 'payment_pending':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  const getNotificationTitle = (event: string) => {
    switch (event) {
      case 'new_lead':
        return '👤 New Lead';
      case 'payment_received':
        return '💰 Payment Received';
      case 'lead_hot':
        return '🔥 Hot Lead Alert';
      case 'message_received':
        return '💬 New Message';
      case 'payment_pending':
        return '⏰ Payment Pending';
      default:
        return '🔔 Notification';
    }
  };

  const getNotificationDescription = (notification: Notification) => {
    const { event, payload } = notification;

    switch (event) {
      case 'new_lead':
        return `${payload?.lead_name || 'New lead'} - Class ${payload?.class || 'N/A'}`;
      case 'payment_received':
        return `₹${payload?.amount?.toLocaleString('en-IN') || '0'} from ${payload?.lead_name || 'Unknown'}`;
      case 'lead_hot':
        return `${payload?.lead_name || 'Lead'} score: ${payload?.score || 0}% - ${payload?.reason || ''}`;
      case 'message_received':
        return `New message from ${payload?.lead_name || 'Unknown'}`;
      case 'payment_pending':
        return `₹${payload?.amount?.toLocaleString('en-IN') || '0'} from ${payload?.lead_name || 'Unknown'}`;
      default:
        return payload?.message || 'You have a new notification';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return timestamp;
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate based on event type
    switch (notification.event) {
      case 'new_lead':
      case 'lead_hot':
      case 'message_received':
        navigate('/dashboard');
        break;
      case 'payment_received':
      case 'payment_pending':
        navigate('/leads');
        break;
      default:
        navigate('/activities');
    }
  };

  const initials = "AU"; // Replace with dynamic user initials if needed

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    toast({
      title: "👋 Logged Out",
      description: "You have been successfully logged out. See you soon!",
    });
    navigate("/");
  };

  return (
    <header className="h-16 border-b bg-card dark:bg-card flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-8 w-8 text-brand-red" />
        <div>
          <h1 className="text-lg font-semibold text-foreground leading-tight">
            Subbu Innovative Classes
          </h1>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads, students..." className="pl-10" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />

        {/* Notification Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <>
                  <span className="absolute top-1 right-1 h-2 w-2 bg-brand-red rounded-full animate-pulse"></span>
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span className="font-semibold">Notifications</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} new
                  </Badge>
                )}
                {notifications.length > 0 && unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs h-6"
                  >
                    Mark all read
                  </Button>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    We'll notify you when something happens
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.event);
                  const color = getNotificationColor(notification.event);

                  return (
                    <DropdownMenuItem
                      key={notification.id}
                      className={`flex items-start gap-3 p-3 cursor-pointer ${!notification.read ? 'bg-muted/50' : ''
                        }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className={`p-2 rounded-full bg-gray-100 dark:bg-muted ${color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {getNotificationTitle(notification.event)}
                          </p>
                          {!notification.read && (
                            <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {getNotificationDescription(notification)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimeAgo(notification.created_at)}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-center text-sm font-medium text-subbuRed cursor-pointer justify-center"
              onClick={() => navigate("/activities")}
            >
              View All Activities →
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
          <Settings className="h-5 w-5" />
        </Button>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full h-10 w-10 overflow-hidden">
              <Avatar className="h-10 w-10">
                {photo ? <AvatarImage src={photo} alt="Profile" /> : null}
                <AvatarFallback className="bg-subbuRed text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-3 py-2">
                <Avatar className="h-10 w-10">
                  {photo ? <AvatarImage src={photo} /> : null}
                  <AvatarFallback className="bg-subbuRed text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold text-subbuText">Admin User</p>
                  <p className="text-xs text-muted-foreground">admin@subbu.com</p>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => navigate("/my-profile")}>
              <UserCircle className="h-4 w-4 mr-3 text-muted-foreground" />
              <span className="text-sm">My Profile</span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="h-4 w-4 mr-3 text-muted-foreground" />
              <span className="text-sm">Settings</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer py-2.5 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
            >
              <LogOut className="h-4 w-4 mr-3" />
              <span className="text-sm font-medium">Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Navbar;
