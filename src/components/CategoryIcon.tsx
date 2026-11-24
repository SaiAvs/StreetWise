import {
  AlertCircle, Building2, CircleHelp, Droplets, Lightbulb, Route, ShieldAlert,
  SprayCan, Trash2, TrafficCone, Waves, Zap, Droplet, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Route,
  Trash2,
  Droplets,
  Waves,
  Lightbulb,
  Zap,
  ShieldAlert,
  SprayCan,
  TrafficCone,
  Building2,
  CircleHelp,
  AlertCircle,
  Droplet,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? CircleHelp;
  return <Icon className={className} />;
}
