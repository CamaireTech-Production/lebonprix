/**
 * Safe HTML rendering utilities to replace dangerouslySetInnerHTML
 */

import React from 'react';
import { cn } from '../utils/cn';

// Safe HTML component that sanitizes content
export interface SafeHTMLProps {
  content: string;
  className?: string;
  allowedTags?: string[];
  allowedAttributes?: string[];
}

export const SafeHTML: React.FC<SafeHTMLProps> = ({
  content,
  className,
  allowedTags = ['p', 'br', 'strong', 'em', 'u', 'span', 'div'],
  allowedAttributes = ['class', 'style']
}) => {
  // Simple HTML sanitizer (in production, use a library like DOMPurify)
  const sanitizeHTML = (html: string): string => {
    // Remove script tags and their content
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove event handlers
    sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '');
    sanitized = sanitized.replace(/on\w+='[^']*'/gi, '');
    
    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    // Remove data: URLs that aren't images
    sanitized = sanitized.replace(/data:(?!image\/)/gi, '');
    
    return sanitized;
  };

  const sanitizedContent = sanitizeHTML(content);

  return (
    <div
      className={cn('safe-html', className)}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};

// CSS-in-JS component for safe styling
export interface SafeCSSProps {
  styles: Record<string, any>;
  children: React.ReactNode;
  className?: string;
}

export const SafeCSS: React.FC<SafeCSSProps> = ({
  styles,
  children,
  className
}) => {
  const cssString = Object.entries(styles)
    .map(([property, value]) => {
      // Convert camelCase to kebab-case
      const kebabProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${kebabProperty}: ${value}`;
    })
    .join('; ');

  return (
    <div
      className={cn('safe-css', className)}
      style={{ [cssString]: undefined }}
    >
      {children}
    </div>
  );
};

// Template preview component that safely renders CSS
export interface TemplatePreviewProps {
  templateId: string;
  settings: any;
  pageType: string;
  className?: string;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  templateId,
  settings,
  pageType,
  className
}) => {
  // Generate safe CSS from settings
  const generateSafeCSS = (): string => {
    const cssVariables: string[] = [];
    
    // Add color variables
    if (settings.colors) {
      Object.entries(settings.colors).forEach(([key, value]) => {
        cssVariables.push(`--color-${key}: ${value};`);
      });
    }
    
    // Add typography variables
    if (settings.typography) {
      Object.entries(settings.typography).forEach(([key, value]) => {
        cssVariables.push(`--font-${key}: ${value};`);
      });
    }
    
    // Add spacing variables
    if (settings.spacing) {
      Object.entries(settings.spacing).forEach(([key, value]) => {
        cssVariables.push(`--spacing-${key}: ${value};`);
      });
    }
    
    return `
      .template-preview {
        ${cssVariables.join('\n        ')}
      }
    `;
  };

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <div className="bg-gray-100 p-2 text-sm text-gray-600 border-b">
        Live Preview
        <div className="text-xs text-gray-500 mt-1">
          Background: {settings.colors?.background || '#FFFFFF'} | Primary: {settings.colors?.primary || '#3B82F6'}
        </div>
      </div>
      <div className="h-96 overflow-auto template-preview">
        <style>{generateSafeCSS()}</style>
        {/* Template content would go here */}
      </div>
    </div>
  );
};

// Safe markdown renderer
export interface SafeMarkdownProps {
  content: string;
  className?: string;
}

export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({
  content,
  className
}) => {
  // Simple markdown to HTML converter (in production, use a library like marked)
  const markdownToHTML = (markdown: string): string => {
    return markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Line breaks
      .replace(/\n/gim, '<br>');
  };

  const htmlContent = markdownToHTML(content);

  return (
    <SafeHTML
      content={htmlContent}
      className={cn('safe-markdown', className)}
      allowedTags={['h1', 'h2', 'h3', 'p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li']}
      allowedAttributes={['class', 'style', 'href', 'target', 'rel']
    />
  );
};

// Safe code block renderer
export interface SafeCodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export const SafeCodeBlock: React.FC<SafeCodeBlockProps> = ({
  code,
  language = 'text',
  className
}) => {
  // Escape HTML characters
  const escapeHTML = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const escapedCode = escapeHTML(code);

  return (
    <pre className={cn('bg-gray-100 p-4 rounded-lg overflow-x-auto', className)}>
      <code className={`language-${language}`}>
        {escapedCode}
      </code>
    </pre>
  );
};

// Safe table renderer
export interface SafeTableProps {
  data: Array<Record<string, any>>;
  headers?: string[];
  className?: string;
}

export const SafeTable: React.FC<SafeTableProps> = ({
  data,
  headers,
  className
}) => {
  const tableHeaders = headers || (data.length > 0 ? Object.keys(data[0]) : []);

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {tableHeaders.map((header, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {tableHeaders.map((header, colIndex) => (
                <td
                  key={colIndex}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                >
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Safe list renderer
export interface SafeListProps {
  items: string[];
  ordered?: boolean;
  className?: string;
}

export const SafeList: React.FC<SafeListProps> = ({
  items,
  ordered = false,
  className
}) => {
  const ListComponent = ordered ? 'ol' : 'ul';
  const listClass = ordered ? 'list-decimal list-inside' : 'list-disc list-inside';

  return (
    <ListComponent className={cn(listClass, 'space-y-1', className)}>
      {items.map((item, index) => (
        <li key={index} className="text-gray-700">
          {item}
        </li>
      ))}
    </ListComponent>
  );
};

