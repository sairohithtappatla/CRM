import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { Lock, Palette, LogOut, Shield, Moon, Sun, Monitor } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

const Settings = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [theme, setTheme] = useState("system");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "system";
    setTheme(savedTheme);

    // Apply the saved theme on initial load
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "❌ Error",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "❌ Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "❌ Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    // Password strength validation
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast({
        title: "❌ Weak Password",
        description: "Password must contain uppercase, lowercase, and number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get admin email from localStorage
      const adminEmail = localStorage.getItem("adminEmail");

      if (!adminEmail) {
        toast({
          title: "❌ Session Error",
          description: "Please log in again",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      // Call secure function with email parameter
      const { data: updateData, error: updateError } = await supabase.rpc('change_user_password', {
        p_email: adminEmail,
        p_current_password_plain: currentPassword,
        p_new_password_plain: newPassword
      });

      if (updateError || !updateData?.success) {
        console.error("Password update error:", updateError || updateData);
        toast({
          title: "❌ Update Failed",
          description: updateData?.error || updateError?.message || "Failed to update password",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Send password changed notification email
      try {
        await supabase.functions.invoke("send-password-changed-email", {
          body: { email: adminEmail, source: "settings" },
        });
      } catch (emailError) {
        console.error("Failed to send notification email:", emailError);
        // Don't fail the password change if email fails
      }

      toast({
        title: "✅ Password Changed",
        description: "Your password has been updated. Logging out...",
      });

      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Logout after 2 seconds
      setTimeout(() => {
        localStorage.removeItem("authToken");
        localStorage.removeItem("adminEmail");
        localStorage.removeItem("adminUsername");
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        title: "❌ Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = (value: string) => {
    setTheme(value);
    localStorage.setItem("theme", value);

    if (value === "dark") {
      document.documentElement.classList.add("dark");
    } else if (value === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }

    toast({
      title: "✅ Theme Updated",
      description: `Theme changed to ${value}`,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    toast({
      title: "👋 Logged Out",
      description: "You have been successfully logged out. See you soon!",
    });
    navigate("/");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col w-full">
          <Navbar />
          <main className="flex-1 p-4 sm:p-6 bg-subbuGray/30 dark:bg-background overflow-auto">
            {/* Page header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-subbuText">Settings</h2>
              <p className="text-muted-foreground">Manage your account preferences</p>
            </div>

            {/* ====== 2-column responsive layout ====== */}
            <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: Change Password */}
              <Card className="bg-white dark:bg-card">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="h-5 w-5 text-subbuRed" />
                    Change Password
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Update your password to keep your account secure
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-white dark:bg-background"
                    />
                  </div>
                  <Separator />
                  <div>
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Enter new password (min. 8 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-white dark:bg-background"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-white dark:bg-background"
                    />
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5" />
                      <div className="text-xs text-amber-800 dark:text-amber-400">
                        <p className="font-medium mb-1">Password Requirements:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li>Minimum 8 characters long</li>
                          <li>Include uppercase and lowercase letters</li>
                          <li>Include at least one number</li>
                          <li>Include at least one special character</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-subbuRed hover:bg-[#c9221b]"
                    onClick={handleChangePassword}
                    disabled={loading}
                  >
                    {loading ? "Changing Password..." : "Change Password"}
                  </Button>
                </CardContent>
              </Card>

              {/* RIGHT: Theme + Logout stacked */}
              <div className="flex flex-col gap-6">
                {/* Theme Preference */}
                <Card className="bg-white dark:bg-card">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Palette className="h-5 w-5 text-subbuRed" />
                      Choose Default Theme
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Select your preferred theme for the application
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup value={theme} onValueChange={handleThemeChange}>
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-muted/30 transition-colors cursor-pointer">
                        <RadioGroupItem value="light" id="light" />
                        <Label htmlFor="light" className="flex items-center gap-3 cursor-pointer flex-1">
                          <div className="p-2 bg-gray-100 dark:bg-muted rounded-lg">
                            <Sun className="h-5 w-5 text-subbuYellow" />
                          </div>
                          <div>
                            <p className="font-medium text-subbuText">Light Mode</p>
                            <p className="text-xs text-muted-foreground">Bright and clean interface</p>
                          </div>
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-muted/30 transition-colors cursor-pointer">
                        <RadioGroupItem value="dark" id="dark" />
                        <Label htmlFor="dark" className="flex items-center gap-3 cursor-pointer flex-1">
                          <div className="p-2 bg-gray-100 dark:bg-muted rounded-lg">
                            <Moon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-subbuText">Dark Mode</p>
                            <p className="text-xs text-muted-foreground">Easy on the eyes in low light</p>
                          </div>
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-muted/30 transition-colors cursor-pointer">
                        <RadioGroupItem value="system" id="system" />
                        <Label htmlFor="system" className="flex items-center gap-3 cursor-pointer flex-1">
                          <div className="p-2 bg-gray-100 dark:bg-muted rounded-lg">
                            <Monitor className="h-5 w-5 text-subbuRed" />
                          </div>
                          <div>
                            <p className="font-medium text-subbuText">System Default</p>
                            <p className="text-xs text-muted-foreground">Match your device settings</p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>

                {/* Logout */}
                <Card className="bg-white dark:bg-card border-red-200 dark:border-red-900">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <LogOut className="h-5 w-5 text-red-600" />
                      Logout
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Sign out of your account</p>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="destructive"
                      className="w-full bg-red-600 hover:bg-red-700"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout from Account
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Settings;
