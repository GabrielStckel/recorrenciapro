import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { LayoutDashboard, Users, History, HelpCircle, LogOut } from 'lucide-react';


const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/historico', label: 'Histórico', icon: History },
  { href: '/como-usar', label: 'Como Usar', icon: HelpCircle },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-bold text-base sm:text-xl bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent whitespace-nowrap">
              Recorrência Pro
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-2',
                      isActive && 'bg-primary/20 text-primary'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden md:block">
              {user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-1 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Recorrência Pro. Todos os direitos reservados.</p>
            <span className="hidden sm:inline">•</span>
            <p className="text-xs sm:text-sm">Feito com 💚 para gestão de recorrências</p>
          </div>
        </div>
      </footer>
    </div>
  );
}