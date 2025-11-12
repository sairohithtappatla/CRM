import { Phone, MessageCircle, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

// Updated Lead interface to match Supabase schema
interface Lead {
  id: string;
  parent_name: string | null;
  student_name: string | null;
  phone: string | null;
  class: string | null;
  status: 'HOT' | 'WARM' | 'COLD' | 'FOLLOW-UP' | 'ADMITTED';
  score: number;
  last_contact_at: string;
  language_pref: 'en' | 'hi' | 'te';
  organization_id: string | null;
}

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

const LeadCard = ({ lead, onClick }: LeadCardProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-status-hot";
    if (score >= 60) return "bg-status-warm";
    return "bg-status-cold";
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const contactDate = new Date(timestamp);
    const diffMs = now.getTime() - contactDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getLanguageLabel = (lang: string) => {
    switch (lang) {
      case 'en': return '🇬🇧 English';
      case 'hi': return '🇮🇳 Hindi';
      case 'te': return '🇮🇳 Telugu';
      default: return lang;
    }
  };

  // Format phone number properly - ENHANCED VERSION
  const formatPhoneNumber = (phone: string | null): string => {
    if (!phone) return 'No phone number';

    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Remove duplicate 91 prefixes (handles 91919032040859)
    while (cleaned.startsWith('9191') && cleaned.length > 12) {
      cleaned = '91' + cleaned.substring(4);
    }

    // Remove leading 91 if number is too long
    while (cleaned.startsWith('91') && cleaned.length > 12) {
      cleaned = cleaned.substring(2);
    }

    // If we still have more than 10 digits, take last 10
    if (cleaned.length > 10 && !cleaned.startsWith('91')) {
      cleaned = cleaned.slice(-10);
    }

    // If we have exactly 10 digits, format it nicely
    if (cleaned.length === 10) {
      return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }

    // If we have 12 digits starting with 91, format it
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      const digits = cleaned.substring(2);
      return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    }

    // Fallback
    return phone;
  };

  // Get clean phone number for calling (with country code)
  const getCallablePhone = (phone: string | null): string => {
    if (!phone) return '';

    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Remove duplicate 91 prefixes
    while (cleaned.startsWith('9191') && cleaned.length > 12) {
      cleaned = '91' + cleaned.substring(4);
    }

    // Remove leading 91 if number is too long
    while (cleaned.startsWith('91') && cleaned.length > 12) {
      cleaned = cleaned.substring(2);
    }

    // If we have more than 10 digits and no country code, take last 10
    if (cleaned.length > 10 && !cleaned.startsWith('91')) {
      cleaned = cleaned.slice(-10);
    }

    // Add country code if missing
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }

    // Final check: ensure exactly 12 digits (91 + 10 digits)
    if (cleaned.length > 12) {
      cleaned = '91' + cleaned.slice(-10);
    }

    return cleaned;
  };

  const displayPhone = formatPhoneNumber(lead.phone);
  const callablePhone = getCallablePhone(lead.phone);

  return (
    <Card className="card-hover cursor-pointer" onClick={onClick}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-foreground">
              {lead.parent_name || 'Unknown Parent'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {lead.student_name || 'Student'} • Class {lead.class || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {getLanguageLabel(lead.language_pref || 'en')}
            </p>
          </div>

          <div className="text-sm text-muted-foreground line-clamp-2">
            {displayPhone}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{getTimeAgo(lead.last_contact_at)}</span>
            <span className="font-medium">{lead.score}% score</span>
          </div>

          <Progress
            value={lead.score || 0}
            className="h-1.5"
            indicatorClassName={getScoreColor(lead.score || 0)}
          />

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                if (callablePhone) {
                  window.location.href = `tel:+${callablePhone}`;
                }
              }}
            >
              <Phone className="h-3.5 w-3.5 mr-1.5" />
              Call
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
              Chat
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeadCard;
