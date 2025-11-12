import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, ArrowLeft, Mail, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code" | "reset" | "success">("email");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1: Send verification code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: "❌ Email Required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "❌ Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Call the send-reset-email Edge Function
      // This function will:
      // 1. Check if admin exists
      // 2. Generate and store hashed token
      // 3. Send email with code
      const { data, error } = await supabase.functions.invoke("send-reset-email", {
        body: { email: email.toLowerCase() },
      });

      if (error) {
        console.error("Edge function error:", error);
        toast({
          title: "❌ Error",
          description: error.message || "Failed to send verification code",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!data?.success) {
        toast({
          title: "❌ Error",
          description: data?.error || "Failed to send verification code",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "✅ Code Sent",
        description: `A verification code has been sent to ${email}`,
      });
      setStep("code");
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "❌ Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "❌ Invalid Code",
        description: "Please enter a 6-digit verification code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('verify_reset_token', {
        p_email: email.toLowerCase(),
        p_token_plain: verificationCode
      });

      if (error || !data?.valid) {
        toast({
          title: "❌ Invalid Code",
          description: data?.error || "The verification code is incorrect or expired",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "✅ Code Verified",
        description: "Please enter your new password",
      });
      setStep("reset");
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "❌ Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast({
        title: "❌ Password Required",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "❌ Passwords Don't Match",
        description: "New password and confirm password must match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "❌ Password Too Short",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    // Client-side validation
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
      const { data, error } = await supabase.rpc('reset_user_password', {
        p_email: email.toLowerCase(),
        p_verification_code: verificationCode,
        p_new_password_plain: newPassword
      });

      if (error || !data?.success) {
        console.error("Password reset error:", error || data);
        toast({
          title: "❌ Reset Failed",
          description: data?.error || error?.message || "Failed to reset password",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Send password changed notification
      await supabase.functions.invoke("send-password-changed-email", {
        body: { email: email.toLowerCase(), source: "forgot-password" },
      });

      toast({
        title: "✅ Password Reset Successful",
        description: "Your password has been successfully reset",
      });
      setStep("success");
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "❌ Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);

    try {
      // Call the send-reset-email Edge Function again
      const { data, error } = await supabase.functions.invoke("send-reset-email", {
        body: { email: email.toLowerCase() },
      });

      if (error || !data?.success) {
        toast({
          title: "❌ Error",
          description: data?.error || error?.message || "Failed to resend code",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "✅ Code Resent",
        description: `A new verification code has been sent to ${email}`,
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "❌ Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-redirect after success
  useEffect(() => {
    if (step === "success") {
      const timer = setTimeout(() => {
        navigate("/");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [step, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-subbuGray/30 dark:bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="w-full max-w-md shadow-lg bg-white dark:bg-card">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-10 w-10 text-brand-red" />
                <div className="text-left">
                  <h1 className="text-2xl font-bold text-foreground">Subbu Innovative</h1>
                  <p className="text-sm text-muted-foreground">Classes</p>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {step === "email" && (
                <motion.div
                  key="email-header"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <CardTitle className="text-2xl">Forgot Password?</CardTitle>
                  <CardDescription>
                    Enter your email address and we'll send you a verification code
                  </CardDescription>
                </motion.div>
              )}

              {step === "code" && (
                <motion.div
                  key="code-header"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <CardTitle className="text-2xl">Enter Verification Code</CardTitle>
                  <CardDescription>
                    We've sent a 6-digit code to {email}
                  </CardDescription>
                </motion.div>
              )}

              {step === "reset" && (
                <motion.div
                  key="reset-header"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <CardTitle className="text-2xl">Create New Password</CardTitle>
                  <CardDescription>
                    Enter your new password below
                  </CardDescription>
                </motion.div>
              )}

              {step === "success" && (
                <motion.div
                  key="success-header"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="flex justify-center">
                    <div className="rounded-full bg-subbuGreen/10 p-4">
                      <CheckCircle2 className="h-12 w-12 text-subbuGreen" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl">Password Reset!</CardTitle>
                  <CardDescription>
                    Your password has been successfully reset. You can now login with your new password.
                  </CardDescription>
                </motion.div>
              )}
            </AnimatePresence>
          </CardHeader>

          <CardContent>
            <AnimatePresence mode="wait">
              {/* Step 1: Email Input */}
              {step === "email" && (
                <motion.form
                  key="email-form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleSendCode}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@subbu.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-subbuRed hover:bg-[#c9221b]" disabled={loading}>
                    {loading ? "Sending Code..." : "Send Verification Code"}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => navigate("/")}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Login
                  </Button>
                </motion.form>
              )}

              {/* Step 2: Verification Code */}
              {step === "code" && (
                <motion.form
                  key="code-form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleVerifyCode}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="code">Verification Code</Label>
                    <Input
                      id="code"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="text-center text-2xl tracking-widest font-semibold"
                      maxLength={6}
                      required
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Check your email inbox for the code
                    </p>
                  </div>

                  <Button type="submit" className="w-full bg-subbuRed hover:bg-[#c9221b]" disabled={loading}>
                    {loading ? "Verifying..." : "Verify Code"}
                  </Button>

                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Didn't receive the code?
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      className="text-subbuRed p-0 h-auto"
                      onClick={handleResendCode}
                      disabled={loading}
                    >
                      Resend Code
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setStep("email")}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Change Email
                  </Button>
                </motion.form>
              )}

              {/* Step 3: New Password */}
              {step === "reset" && (
                <motion.form
                  key="reset-form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleResetPassword}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-400 mb-1">
                      Password Requirements:
                    </p>
                    <ul className="text-xs text-amber-700 dark:text-amber-500 list-disc list-inside space-y-0.5">
                      <li>Minimum 8 characters long</li>
                      <li>Include uppercase and lowercase letters</li>
                      <li>Include at least one number</li>
                    </ul>
                  </div>

                  <Button type="submit" className="w-full bg-subbuRed hover:bg-[#c9221b]" disabled={loading}>
                    {loading ? "Resetting Password..." : "Reset Password"}
                  </Button>
                </motion.form>
              )}

              {/* Step 4: Success */}
              {step === "success" && (
                <motion.div
                  key="success-actions"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <Button
                    className="w-full bg-subbuGreen hover:bg-[#0f6330]"
                    onClick={() => navigate("/")}
                  >
                    Go to Login
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    You will be redirected to the login page in 5 seconds...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;