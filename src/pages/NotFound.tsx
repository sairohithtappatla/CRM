import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-subbuGray/50">
      <div className="text-center px-4">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-subbuRed">404</h1>
          <div className="h-1 w-32 bg-subbuRed mx-auto mt-4 rounded-full"></div>
        </div>

        <h2 className="mb-4 text-3xl font-bold text-subbuText">Oops! Page Not Found</h2>
        <p className="mb-8 text-lg text-muted-foreground max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="hover:bg-subbuGray transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          <Button
            onClick={() => navigate("/dashboard")}
            className="bg-subbuRed hover:bg-[#c9221b] transition-all"
          >
            <Home className="h-4 w-4 mr-2" />
            Return to Dashboard
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Route attempted: <code className="px-2 py-1 bg-subbuGray rounded text-subbuText">{location.pathname}</code>
        </p>
      </div>
    </div>
  );
};

export default NotFound;
