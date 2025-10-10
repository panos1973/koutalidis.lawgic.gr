"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  gradientColors?: string;
  label?: string;
  usedValue?: string | number;
  maxValue?: string | number;
}

export function CircularProgress({
  percentage,
  size = 60,
  strokeWidth = 4,
  showPercentage = true,
  gradientColors = "linear-gradient(90deg, #b10d32, #fb2626)",
  label,
  usedValue,
  maxValue,
  className,
  ...props
}: CircularProgressProps) {
  // Ensure percentage is between 0 and 100
  const value = Math.min(100, Math.max(0, percentage));

  // Calculate SVG parameters
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center", className)} {...props}>
      {label && (
        <p className="text-xs font-light text-zinc-500 mb-1">{label}</p>
      )}
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Background circle */}
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#e5e7eb" // Light gray background
            strokeWidth={strokeWidth}
            className="opacity-50"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="url(#gradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#b10d32" />
              <stop offset="100%" stopColor="#fb2626" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center content */}
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold">{Math.round(value)}%</span>
          </div>
        )}
      </div>

      {/* {usedValue !== undefined && maxValue !== undefined && (
        <div className="flex justify-between w-full mt-1">
          <p className="text-xs font-medium text-zinc-500">{usedValue}</p>
          <p className="text-xs font-medium text-zinc-500">{maxValue}</p>
        </div>
      )} */}
    </div>
  );
}
