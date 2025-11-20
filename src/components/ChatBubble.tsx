import { cn } from "@/lib/utils";
import { format, isToday, isYesterday, parseISO } from "date-fns";

interface Message {
  id: number;
  lead_id: string;
  sender: 'user' | 'admin' | 'assistant';
  message: string;
  timestamp: string;
}

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble = ({ message }: ChatBubbleProps) => {
  // admin and assistant (AI bot) messages show on right side
  const isAdmin = message.sender === "admin" || message.sender === "assistant";

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = parseISO(timestamp);

      if (isToday(date)) {
        return format(date, 'h:mm a');
      } else if (isYesterday(date)) {
        return `Yesterday ${format(date, 'h:mm a')}`;
      } else {
        return format(date, 'MMM d, h:mm a');
      }
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return timestamp;
    }
  };

  const getSenderLabel = () => {
    if (message.sender === 'admin') return 'Admin';
    if (message.sender === 'assistant') return 'AI Bot';
    return 'User';
  };

  return (
    <div className={cn("flex", isAdmin ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[80%] space-y-1")}>
        {/* Sender label - only show for assistant messages */}
        {message.sender === 'assistant' && (
          <p className={cn("text-xs font-medium text-muted-foreground px-2", isAdmin && "text-right")}>
            🤖 {getSenderLabel()}
          </p>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 break-words",
            isAdmin
              ? "bg-accent text-accent-foreground rounded-br-sm"
              : "bg-secondary text-foreground rounded-bl-sm"
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
        </div>
        <p className={cn("text-xs text-muted-foreground px-2", isAdmin && "text-right")}>
          {formatTimestamp(message.timestamp)}
        </p>
      </div>
    </div>
  );
};

export default ChatBubble;
