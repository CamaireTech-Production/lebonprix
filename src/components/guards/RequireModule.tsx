/**
 * RequireModule Guard Component
 * Conditionally renders children based on module availability
 */

import React from 'react';
import { useModules } from '@/hooks/business/useModules';
import type { ModuleName } from '@/types/models';

interface RequireModuleProps {
    /** The module that must be available */
    module: ModuleName;
    /** Content to render if module is available */
    children: React.ReactNode;
    /** Optional fallback content if module is not available */
    fallback?: React.ReactNode;
}

/**
 * Guard component that only renders children if the required module is available
 * 
 * @example
 * // Hide production features for starter users
 * <RequireModule module="PRODUCTION">
 *   <ProductionPage />
 * </RequireModule>
 * 
 * // With custom fallback
 * <RequireModule 
 *   module="MULTI_LOCATION" 
 *   fallback={<UpgradePrompt />}
 * >
 *   <ShopsPage />
 * </RequireModule>
 */
export const RequireModule: React.FC<RequireModuleProps> = ({
    module,
    children,
    fallback = null
}) => {
    const { hasModule } = useModules();

    if (!hasModule(module)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};

/**
 * Higher-order component version for route protection
 */
export const withModule = <P extends object>(
    WrappedComponent: React.ComponentType<P>,
    moduleName: ModuleName,
    FallbackComponent?: React.ComponentType
) => {
    const ComponentWithModule: React.FC<P> = (props) => {
        const { hasModule } = useModules();

        if (!hasModule(moduleName)) {
            if (FallbackComponent) {
                return <FallbackComponent />;
            }
            return null;
        }

        return <WrappedComponent {...props} />;
    };

    ComponentWithModule.displayName = `WithModule(${WrappedComponent.displayName || WrappedComponent.name})`;

    return ComponentWithModule;
};

export default RequireModule;
