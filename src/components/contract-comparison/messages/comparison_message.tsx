import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

interface MessageProps {
  message: {
    id: string;
    role: string;
    content: string;
    createdAt: string;
  };
}

const ComparisonMessage = ({ message }: MessageProps) => {
  const isUser = message.role === "user";
  const date = new Date(message.createdAt);
  //   const formattedTime = format(date, "h:mm a");

  return (
    <div
      className={cn(
        "flex w-full items-start gap-2 p-2",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-white">
            <Bot size={16} />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "flex flex-col space-y-1 max-w-[80%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
        {/* <span className="text-xs text-muted-foreground">{formattedTime}</span> */}
      </div>
      {isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-white">
            <User size={16} />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default ComparisonMessage;
