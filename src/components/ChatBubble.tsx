import { cn } from "@/lib/utils";
import { format, isToday, isYesterday, parseISO } from "date-fns";

interface Message {
  id: number;
  lead_id: string;
  sender: 'user' | 'admin';
  message: string;
  timestamp: string;
}

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble = ({ message }: ChatBubbleProps) => {
  const isAdmin = message.sender === "admin";

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

  return (
    <div className={cn("flex", isAdmin ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[80%] space-y-1")}>
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
