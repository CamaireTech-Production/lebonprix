import { ReactNode, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useRolePermissions } from '@hooks/business/useRolePermissions';
import { useAuth } from '@contexts/AuthContext';
import { Button } from '@components/common';
import { Lock } from 'lucide-react';

type PermissionAction = 'view' | 'edit' | 'delete';
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface PermissionButtonProps {
  /** The resource to check permission for (from RESOURCES constant) */
  resource: string;
  /** The action type: 'view', 'edit', or 'delete' */
  action: PermissionAction;
  /** Click handler - only called if user has permission */
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  /** Button content */
  children: ReactNode;
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Button icon */
  icon?: ReactNode;
  /** Additional class names */
  className?: string;
  /** If true, hides the button entirely when no permission (default: shows disabled) */
  hideWhenNoPermission?: boolean;
  /** If true, shows a tooltip explaining why button is disabled */
  showPermissionTooltip?: boolean;
  /** Additional disabled state (combines with permission check) */
  disabled?: boolean;
  /** Button type */
  type?: 'button' | 'submit' | 'reset';
  /** Title/tooltip text */
  title?: string;
}

/**
 * PermissionButton - Button that automatically checks permissions
 *
 * Usage:
 * ```tsx
 * <PermissionButton
 *   resource={RESOURCES.PRODUCTS}
 *   action="edit"
 *   onClick={handleEdit}
 *   icon={<Edit2 className="h-4 w-4" />}
 *   variant="outline"
 *   size="sm"
 * >
 *   Edit
 * </PermissionButton>
 * ```
 */
export const PermissionButton = ({
  resource,
  action,
  onClick,
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  hideWhenNoPermission = false,
  showPermissionTooltip = true,
  disabled = false,
  type = 'button',
  title,
}: PermissionButtonProps) => {
  const { t } = useTranslation();
  const { company } = useAuth();
  const { canAccess, canEdit, canDelete, isOwner } = useRolePermissions(company?.id);

  // Check permission based on action type
  // IMPORTANT: Delete actions are OWNER-ONLY - employees must use action request system
  let hasPermission = isOwner;
  if (!isOwner) {
    switch (action) {
      case 'view':
        hasPermission = canAccess(resource);
        break;
      case 'edit':
        hasPermission = canEdit(resource);
        break;
      case 'delete':
        // DELETE IS OWNER-ONLY - never grant delete to non-owners
        hasPermission = false;
        break;
    }
  }

  // Hide button if no permission and hideWhenNoPermission is true
  if (!hasPermission && hideWhenNoPermission) {
    return null;
  }

  // Determine if button should be disabled
  const isDisabled = disabled || !hasPermission;

  // Build tooltip text
  let tooltipText = title;
  if (!hasPermission && showPermissionTooltip) {
    tooltipText = t('permissions.noPermissionAction', "You don't have permission for this action");
  }

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (hasPermission && !disabled) {
      onClick(e);
    }
  };

  return (
    <Button
      type={type}
      variant={variant}
      size={size}
      icon={!hasPermission ? <Lock className="h-4 w-4" /> : icon}
      onClick={handleClick}
      disabled={isDisabled}
      className={`${className} ${!hasPermission ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={tooltipText}
    >
      {children}
    </Button>
  );
};

export default PermissionButton;
