import type * as React from "react";
import { type Icon as IconsaxIcon, Activity } from "iconsax-react";
import { cn } from "@/lib/utils";

interface UsageIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  percentage: number;
  icon?: IconsaxIcon;
  label?: string;
  usage: number;
  limit: number;
}

export function NavUsageIndicator({
  percentage,
  icon: Icon = Activity,
  usage,
  limit,
  label,
  className,
  ...props
}: UsageIndicatorProps) {
  // Ensure percentage is between 0 and 100
  const value = Math.min(100, Math.max(0, percentage));

  // Calculate SVG parameters
  const size = 35;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div
      className={cn("flex flex-col items-center space-y-1", className)}
      {...props}
    >
      {/* <span className="text-xs">{label}</span> */}
      <div
        className="relative inline-flex items-center justify-center "
        style={{ width: size, height: size }}
      >
        {/* Background circle */}
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#2A2A2A"
            strokeWidth={strokeWidth}
            className="opacity-20"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={label === "Message" ? "#2A2A2A" : "#f47373"}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <Icon
            size={14}
            color={label === "Message" ? "#2A2A2A" : "#f47373"}
            variant="Bold"
          />
          {/* <span className="mt-1 text-xs font-medium text-gray-800">
            {Math.round(value)}%
          </span> */}
        </div>
      </div>

      {label && (
        <span className="mt-1 text-xs text-gray-600 font-medium">
          {usage}/{limit}
        </span>
      )}
    </div>
  );
}
