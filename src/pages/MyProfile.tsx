import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { User, Mail, Phone, Building2, Save, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const PHOTO_KEY = "profilePhoto"; // localStorage key

const MyProfile = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Administrator",
    organization: "",
    address: "",
  });

  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(PHOTO_KEY);
    if (saved) setPhoto(saved);

    // Fetch admin profile data
    fetchAdminProfile();
  }, []);

  const fetchAdminProfile = async () => {
    try {
      setLoading(true);

      // Get admin email from localStorage (set during login)
      const adminEmail = localStorage.getItem("adminEmail");

      if (!adminEmail) {
        toast({
          title: "⚠️ Warning",
          description: "No admin session found. Please log in again.",
          variant: "destructive",
        });
        // Load fallback data
        setFormData({
          name: "Admin",
          email: "admin@example.com",
          phone: "+91 9640549549",
          role: "Administrator",
          organization: "Subbu Innovative Classes",
          address: "Hyderabad, Telangana, India",
        });
        setLoading(false);
        return;
      }

      // Check if Supabase client is properly initialized
      if (!supabase) {
        throw new Error("Supabase client not initialized");
      }

      // Fetch admin data with organization join using service role for authentication
      const { data: adminData, error: adminError } = await supabase
        .from("admins")
        .select(`
          id,
          username,
          email,
          organization_id,
          created_at,
          organizations (
            name,
            domain
          )
        `)
        .eq("email", adminEmail)
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors when no data

      // Handle specific error cases
      if (adminError) {
        if (adminError.code === 'PGRST116' || adminError.message?.includes('0 rows')) {
          // No admin found with this email
          console.warn("No admin profile found for:", adminEmail);
          toast({
            title: "⚠️ Profile Not Found",
            description: "Admin profile not found. Using default data.",
            variant: "destructive",
          });
        } else if (adminError.code === '401' || adminError.message?.includes('JWT')) {
          // Authentication issue
          console.error("Authentication error:", adminError);
          toast({
            title: "🔒 Authentication Error",
            description: "Session expired. Please log in again.",
            variant: "destructive",
          });
          // Optionally redirect to login
          // window.location.href = "/login";
        } else {
          // Other errors
          throw adminError;
        }
      }

      if (adminData) {
        setAdminId(adminData.id);
        setCreatedAt(adminData.created_at);

        // Handle organizations as array from Supabase join
        const orgArray = adminData.organizations as { name: string; domain: string }[] | null;
        const orgData = orgArray && orgArray.length > 0 ? orgArray[0] : null;

        setFormData({
          name: adminData.username || "Admin",
          email: adminData.email,
          phone: "+91 9640549549",
          role: "Administrator",
          organization: orgData?.name || "Not Assigned",
          address: "Hyderabad, Telangana, India",
        });
      } else {
        // No data returned - use fallback
        setFormData({
          name: "Admin",
          email: adminEmail,
          phone: "+91 9640549549",
          role: "Administrator",
          organization: "Subbu Innovative Classes",
          address: "Hyderabad, Telangana, India",
        });
      }
    } catch (error: any) {
      console.error("Error fetching admin profile:", error);

      // Provide more specific error messages
      let errorMessage = "Failed to load profile data";
      if (error?.message?.includes("fetch")) {
        errorMessage = "Network error. Please check your connection.";
      } else if (error?.code === "PGRST301") {
        errorMessage = "Database query error. Please contact support.";
      }

      toast({
        title: "❌ Error",
        description: errorMessage,
        variant: "destructive",
      });

      // Fallback to default values
      setFormData({
        name: "Admin",
        email: localStorage.getItem("adminEmail") || "admin@example.com",
        phone: "+91 9640549549",
        role: "Administrator",
        organization: "Subbu Innovative Classes",
        address: "Hyderabad, Telangana, India",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!adminId) {
      toast({
        title: "⚠️ Error",
        description: "Unable to save: Admin ID not found",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update admin data in Supabase
      const { error } = await supabase
        .from("admins")
        .update({
          username: formData.name,
          email: formData.email,
        })
        .eq("id", adminId);

      if (error) throw error;

      // Update localStorage email if changed
      localStorage.setItem("adminEmail", formData.email);

      toast({
        title: "✅ Profile Updated",
        description: "Your profile information has been saved successfully",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "❌ Error",
        description: "Failed to save profile changes",
        variant: "destructive",
      });
    }
  };

  const openPicker = () => fileInputRef.current?.click();

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type + size (<= 3MB)
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Unsupported file",
        description: "Please select a PNG, JPG, or WEBP image.",
        variant: "destructive",
      });
      return;
    }
    const maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast({
        title: "File too large",
        description: "Please choose an image under 3 MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setPhoto(dataUrl);
      localStorage.setItem(PHOTO_KEY, dataUrl);
      toast({ title: "Photo updated", description: "Your profile picture has changed." });
    } catch {
      toast({
        title: "Upload failed",
        description: "Something went wrong while reading the image.",
        variant: "destructive",
      });
    } finally {
      // allow selecting the same file again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    localStorage.removeItem(PHOTO_KEY);
    toast({ title: "Photo removed", description: "Reverted to initials." });
  };

  // Helper for initials when no photo
  const initials = formData.name
    ? formData.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AD";

  // Format created date
  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "N/A";

  if (loading) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col w-full">
            <Navbar />
            <main className="flex-1 flex items-center justify-center bg-subbuGray/30 dark:bg-background">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-subbuRed mx-auto mb-4" />
                <p className="text-muted-foreground">Loading profile...</p>
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col w-full">
          <Navbar />
          <main className="flex-1 p-4 sm:p-6 bg-subbuGray/30 dark:bg-background overflow-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-subbuText">My Profile</h2>
              <p className="text-muted-foreground">View and update your profile information</p>
            </div>

            <div className="max-w-3xl space-y-6">
              {/* Profile Card with Avatar */}
              <Card className="bg-white dark:bg-card">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <button
                      type="button"
                      onClick={openPicker}
                      className="relative group rounded-full outline-none focus:ring-2 focus:ring-offset-2 focus:ring-subbuRed"
                      aria-label="Change profile photo"
                    >
                      <Avatar className="h-24 w-24">
                        {photo ? <AvatarImage src={photo} alt="Profile photo" /> : null}
                        <AvatarFallback className="bg-subbuRed text-white text-2xl font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      {/* subtle hover overlay hint */}
                      <span className="absolute inset-0 hidden group-hover:flex items-center justify-center rounded-full bg-black/35 text-white text-xs">
                        Change
                      </span>
                    </button>

                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-xl font-bold text-subbuText">{formData.name}</h3>
                      <p className="text-sm text-muted-foreground">{formData.role}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Member since {memberSince}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="hover:bg-gray-100 dark:hover:bg-muted"
                        onClick={openPicker}
                      >
                        Change Photo
                      </Button>
                      {photo && (
                        <Button variant="ghost" onClick={removePhoto}>
                          Remove
                        </Button>
                      )}
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Personal Information */}
              <Card className="bg-white dark:bg-card">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-subbuRed" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => handleChange("name", e.target.value)}
                          className="pl-10 bg-white dark:bg-background"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="role">Role</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="role"
                          value={formData.role}
                          disabled
                          className="pl-10 bg-gray-50 dark:bg-muted/50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleChange("email", e.target.value)}
                          className="pl-10 bg-white dark:bg-background"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => handleChange("phone", e.target.value)}
                          className="pl-10 bg-white dark:bg-background"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Organization Details */}
              <Card className="bg-white dark:bg-card">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-subbuRed" />
                    Organization Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="organization">Organization Name</Label>
                    <Input
                      id="organization"
                      value={formData.organization}
                      disabled
                      className="bg-gray-50 dark:bg-muted/50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="address">Address</Label>
                    <div className="relative">
                      <Input
                        id="address"
                        value={formData.address}
                        disabled
                        className="pl-10 bg-gray-50 dark:bg-muted/50"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  className="bg-subbuRed hover:bg-[#c9221b] min-w-32"
                  onClick={handleSave}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MyProfile;
