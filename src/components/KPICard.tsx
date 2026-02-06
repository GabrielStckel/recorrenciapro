import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon, Eye, EyeOff } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  subtitle?: string;
  showPrivacyToggle?: boolean;
  isPrivate?: boolean;
  onPrivacyToggle?: () => void;
}

export function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  variant = 'default', 
  subtitle,
  showPrivacyToggle = false,
  isPrivate = false,
  onPrivacyToggle,
}: KPICardProps) {
  const variants = {
    default: 'bg-card',
    success: 'bg-success/10 border-success/20',
    warning: 'bg-warning/10 border-warning/20',
    destructive: 'bg-destructive/10 border-destructive/20',
  };

  const iconVariants = {
    default: 'bg-primary/20 text-primary',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
    destructive: 'bg-destructive/20 text-destructive',
  };

  return (
    <Card className={cn('glass transition-all hover:scale-[1.02] h-full', variants[variant])}>
      <CardContent className="p-4 sm:p-5 h-full">
        <div className="flex items-center gap-3 h-full min-h-[72px]">
          <div className={cn('p-2.5 rounded-xl shrink-0', iconVariants[variant])}>
            <Icon className="w-5 h-5 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <p className="text-sm sm:text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-xl sm:text-xl font-bold text-foreground truncate">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {showPrivacyToggle && onPrivacyToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onPrivacyToggle();
              }}
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              title={isPrivate ? 'Mostrar nomes' : 'Ocultar nomes'}
            >
              {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}