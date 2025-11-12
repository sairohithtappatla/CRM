import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Use secure login RPC function (uses same pgcrypto as password reset)
      const { data, error } = await supabase.rpc('admin_login', {
        p_email: email.toLowerCase(),
        p_password_plain: password
      });

      if (error) {
        console.error("Login error:", error);
        toast({
          title: "❌ Login Failed",
          description: "Invalid credentials",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (data?.success) {
        const admin = data.admin;

        // Save token to localStorage
        localStorage.setItem("authToken", admin.id);
        localStorage.setItem("adminEmail", admin.email);
        localStorage.setItem("adminUsername", admin.username);

        toast({
          title: "✅ Login Successful",
          description: `Welcome back, ${admin.username}!`,
        });

        navigate("/dashboard");
      } else {
        toast({
          title: "❌ Login Failed",
          description: data?.error || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Login exception:", err);
      toast({
        title: "❌ Login Failed",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-subbuGray/30 dark:bg-background p-4">
      <Card className="w-full max-w-md shadow-lg bg-white dark:bg-card">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-10 w-10 text-brand-red" />
              <div className="text-left">
                <h1 className="text-2xl font-bold text-foreground">Subbu Innovative Classes</h1>
                
              </div>
            </div>
          </div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>Enter your credentials to access the CRM</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@subbu.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs text-subbuRed hover:underline focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-subbuRed hover:bg-[#c9221b]"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
