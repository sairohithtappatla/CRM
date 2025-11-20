import { X, Phone, Mail, MessageCircle, Send } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import ChatBubble from "./ChatBubble";
import PaymentTable from "./PaymentTable";
import InsightsBox from "./InsightsBox";
import { Badge } from "@/components/ui/badge";
import { ChevronUpCircle, ChevronDownCircle, Plus, Minus, CirclePlus, CircleMinus } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";

// Updated interfaces to match Supabase schema
interface Lead {
  id: string;
  parent_name: string | null;
  student_name: string | null;
  phone: string | null;
  class: string | null;
  status: 'HOT' | 'WARM' | 'COLD' | 'FOLLOW-UP' | 'ADMITTED';
  score: number | null;
  engagement_score: number | null;
  last_contact_at: string;
  language_pref: 'en' | 'hi' | 'te';
  organization_id: string | null;
}

interface Message {
  id: number;
  lead_id: string;
  sender: 'user' | 'admin' | 'assistant';
  message: string;
  timestamp: string;
}

interface Payment {
  id: string;
  lead_id: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_id: string | null;
  purpose: string | null;
  payer_phone: string | null;
  created_at: string;
}

interface LeadDrawerProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

const LeadDrawer = ({ lead, open, onClose }: LeadDrawerProps) => {
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    if (lead && open) {
      setCurrentStatus(lead.status);
      setCurrentScore(lead.score);
      fetchDisplayName();
      fetchMessages();
      fetchPayments();
    }
  }, [lead, open]);

  const fetchDisplayName = async () => {
    if (!lead) return;

    // If we have parent_name, use it
    if (lead.parent_name && lead.parent_name !== 'Unknown Parent') {
      setDisplayName(lead.parent_name);
      return;
    }

    try {
      // Try to get name from AI memory profile using secure RPC function
      const { data: aiMemoryProfile, error: memoryError } = await supabase
        .rpc('get_lead_ai_memory', { lead_id_input: lead.id });

      if (!memoryError && aiMemoryProfile) {
        const profile = aiMemoryProfile as any;
        const name = profile.parent_name || profile.student_name || profile.name;
        if (name) {
          setDisplayName(name);
          // Update lead table with the name
          await supabase
            .from('leads')
            .update({ parent_name: name })
            .eq('id', lead.id);
          return;
        }
      }

      // If still no name, try to extract from first user message using secure RPC
      const { data: firstMessages, error: msgError } = await supabase
        .rpc('get_first_user_message', { lead_id_input: lead.id });

      if (!msgError && firstMessages && firstMessages.length > 0) {
        const firstMessage = firstMessages[0];

        // Try to extract name from first message
        const namePatterns = [
          /my name is (\w+)/i,
          /i am (\w+)/i,
          /this is (\w+)/i,
          /(\w+) here/i,
        ];

        for (const pattern of namePatterns) {
          const match = firstMessage.message.match(pattern);
          if (match && match[1]) {
            const extractedName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
            setDisplayName(extractedName);
            // Update lead table
            await supabase
              .from('leads')
              .update({ parent_name: extractedName })
              .eq('id', lead.id);
            return;
          }
        }
      }

      // Fallback: use phone number
      setDisplayName(lead.phone || 'Unknown Contact');
    } catch (error) {
      console.error('Error fetching display name:', error);
      setDisplayName(lead.parent_name || 'Unknown Contact');
    }
  };

  const fetchMessages = async () => {
    if (!lead) return;

    try {
      // Fetch last 20 messages using secure RPC function
      const { data, error } = await supabase
        .rpc('get_lead_messages', {
          lead_id_input: lead.id,
          message_limit: 20
        });

      if (error) throw error;

      // Map msg_timestamp back to timestamp for consistency
      const mappedMessages = (data || []).map((msg: any) => ({
        ...msg,
        timestamp: msg.msg_timestamp
      }));

      // Reverse to show oldest first, newest last
      const reversedMessages = mappedMessages.reverse();
      setMessages(reversedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "❌ Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  const fetchPayments = async () => {
    if (!lead) return;

    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: "❌ Error",
        description: "Failed to load payments",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !lead) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          lead_id: lead.id,
          sender: 'admin',
          message: messageInput.trim(),
          timestamp: new Date().toISOString(),
        });

      if (error) throw error;

      // Update last contact time
      await supabase
        .from('leads')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', lead.id);

      setMessageInput("");
      await fetchMessages();

      toast({
        title: "✅ Message Sent",
        description: "Your message has been sent successfully",
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "❌ Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          status: newStatus,
          last_contact_at: new Date().toISOString()
        })
        .eq('id', lead.id);

      if (error) throw error;

      setCurrentStatus(newStatus);
      toast({
        title: "✅ Status Updated",
        description: `Lead status changed to ${newStatus}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "❌ Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleScoreChange = async (delta: number) => {
    if (!lead) return;

    const newScore = Math.max(0, Math.min(100, currentScore + delta));

    try {
      const { error } = await supabase
        .from('leads')
        .update({ score: newScore })
        .eq('id', lead.id);

      if (error) throw error;

      setCurrentScore(newScore);
      toast({
        title: "✅ Score Updated",
        description: `Lead score ${delta > 0 ? 'increased' : 'decreased'} to ${newScore}`,
      });
    } catch (error) {
      console.error('Error updating score:', error);
      toast({
        title: "❌ Error",
        description: "Failed to update score",
        variant: "destructive",
      });
    }
  };

  const formatPhoneNumber = (phone: string | null): string => {
    if (!phone) return 'No phone number';

    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle different scenarios:
    // Case 1: +91919032040859 -> 91919032040859 -> 9032040859
    // Case 2: 919032040859 -> 9032040859
    // Case 3: 9032040859 -> 9032040859

    // Remove leading 91 twice if present (handles 91919032040859)
    while (cleaned.startsWith('91') && cleaned.length > 12) {
      cleaned = cleaned.substring(2);
    }

    // If still longer than 10 digits and starts with 91, remove it once more
    if (cleaned.startsWith('91') && cleaned.length > 10) {
      cleaned = cleaned.substring(2);
    }

    // Ensure we have exactly 10 digits
    if (cleaned.length > 10) {
      cleaned = cleaned.slice(-10); // Take last 10 digits
    }

    // Format as +91 XXXXX XXXXX if we have 10 digits
    if (cleaned.length === 10) {
      return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }

    // Fallback: return original if we can't parse it
    return phone;
  };

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

    // If we have more than 10 digits after cleaning, take last 10
    if (cleaned.length > 10 && !cleaned.startsWith('91')) {
      cleaned = cleaned.slice(-10);
    }

    // Add country code if missing
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }

    // Final check: ensure we have exactly 12 digits (91 + 10 digits)
    if (cleaned.length > 12) {
      cleaned = '91' + cleaned.slice(-10);
    }

    return cleaned;
  };

  const handleWhatsAppClick = () => {
    if (lead?.phone) {
      const phoneNumber = getCallablePhone(lead.phone);
      window.open(`https://wa.me/${phoneNumber}`, '_blank');
    }
  };

  const handleCallClick = () => {
    if (lead?.phone) {
      const phoneNumber = getCallablePhone(lead.phone);
      window.location.href = `tel:+${phoneNumber}`;
    }
  };

  if (!lead) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "HOT":
        return "bg-status-hot text-white";
      case "WARM":
        return "bg-status-warm text-white";
      case "COLD":
        return "bg-status-cold text-white";
      case "FOLLOW-UP":
        return "bg-status-followup text-white";
      case "ADMITTED":
        return "bg-status-admitted text-white";
      default:
        return "bg-muted";
    }
  };

  const getLanguageLabel = (lang: string) => {
    switch (lang) {
      case 'en': return '🇬🇧 English';
      case 'hi': return '🇮🇳 Hindi';
      case 'te': return '🇮🇳 Telugu';
      default: return lang;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <div className="sticky top-0 bg-card border-b z-10">
          <SheetHeader className="p-6 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <SheetTitle className="text-2xl">
                  {displayName || lead.parent_name || 'Loading...'}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Lead details for {displayName || lead.parent_name || 'this contact'}
                </SheetDescription>
                <p className="text-muted-foreground mt-1">
                  Student: {lead.student_name || 'N/A'} • Class {lead.class || 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {getLanguageLabel(lead.language_pref || 'en')}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </SheetHeader>

          <div className="px-6 pb-4 space-y-3">
            <div className="flex items-center gap-4 text-sm">
              {lead?.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{formatPhoneNumber(lead.phone)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Select value={currentStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOT">HOT</SelectItem>
                  <SelectItem value="WARM">WARM</SelectItem>
                  <SelectItem value="COLD">COLD</SelectItem>
                  <SelectItem value="FOLLOW-UP">FOLLOW-UP</SelectItem>
                  <SelectItem value="ADMITTED">ADMITTED</SelectItem>
                </SelectContent>
              </Select>
              <Badge className={getStatusColor(currentStatus)}>{currentStatus}</Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                WhatsApp Lead
              </Badge>
            </div>

            {/* Score Management */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Lead Score:</span>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => handleScoreChange(-5)}
                  disabled={currentScore <= 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Badge
                  variant="secondary"
                  className={`min-w-[60px] justify-center text-base font-bold ${
                    currentScore >= 80
                      ? 'bg-status-hot text-white'
                      : currentScore >= 60
                        ? 'bg-status-warm text-white'
                        : 'bg-status-cold text-white'
                  }`}
                >
                  {currentScore}%
                </Badge>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => handleScoreChange(5)}
                  disabled={currentScore >= 100}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleCallClick}
              >
                <Phone className="h-4 w-4 mr-2" />
                Call Now
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleWhatsAppClick}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chat">
                Chat
                {messages.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {messages.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="payment">
                Payment
                {payments.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {payments.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="mt-6">
              <div className="space-y-4 pb-4 min-h-[400px] max-h-[500px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-center">
                    <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No messages yet</p>
                    <p className="text-sm text-muted-foreground">Start the conversation below</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <ChatBubble key={message.id} message={message} />
                  ))
                )}
              </div>
              <div className="sticky bottom-0 bg-card pt-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && messageInput.trim()) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={loading}
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={loading || !messageInput.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payment" className="mt-6">
              <PaymentTable payments={payments} />
            </TabsContent>

            <TabsContent value="insights" className="mt-6">
              <InsightsBox lead={lead} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default LeadDrawer;
