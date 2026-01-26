import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, Button } from '../ui';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ExpenseErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ExpenseErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertTriangle className="text-red-500" size={48} />
            <h2 className="text-xl font-semibold text-gray-900">
              Something went wrong
            </h2>
            <p className="text-gray-600 text-center max-w-md">
              {this.state.error?.message || 'An unexpected error occurred while loading expenses.'}
            </p>
            <div className="flex gap-2">
              <Button onClick={this.handleReset} variant="outline">
                Try Again
              </Button>
              <Button onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ExpenseErrorBoundary;
