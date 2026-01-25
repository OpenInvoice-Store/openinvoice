'use client';

import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string;
  maxLength?: number;
  className?: string;
  showTooltip?: boolean;
}

export function TruncatedText({
  text,
  maxLength = 50,
  className,
  showTooltip = true
}: TruncatedTextProps) {
  const shouldTruncate = text.length > maxLength;
  const displayText = shouldTruncate ? `${text.slice(0, maxLength)}...` : text;

  const content = (
    <span
      className={cn(
        'block truncate',
        shouldTruncate && 'cursor-help',
        className
      )}
      title={shouldTruncate && !showTooltip ? text : undefined}
    >
      {displayText}
    </span>
  );

  if (shouldTruncate && showTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent className='max-w-xs break-words'>
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
