import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  subtitle?: string;
}

export function KPICard({ title, value, icon: Icon, variant = 'default', subtitle }: KPICardProps) {
  const variants = {
    default: '',
    success: 'border-success/30 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_-5px_hsl(142_76%_45%/0.3)]',
    warning: 'border-warning/30 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_-5px_hsl(38_92%_50%/0.3)]',
    destructive: 'border-destructive/30 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_-5px_hsl(0_72%_55%/0.3)]',
  };

  const iconVariants = {
    default: 'bg-primary/20 text-primary',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
    destructive: 'bg-destructive/20 text-destructive',
  };

  return (
    <Card className={cn('transition-all duration-300 hover:scale-[1.02] hover:border-white/20', variants[variant])}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn('p-3 rounded-xl', iconVariants[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}