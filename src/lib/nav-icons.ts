import {
  BarChart3,
  Car,
  FileText,
  History,
  LayoutDashboard,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Car,
  FileText,
  Wrench,
  Receipt,
  Package,
  Truck,
  TrendingUp,
  Wallet,
  History,
  BarChart3,
  ScrollText,
  Settings,
  Shield,
};

export function getNavIcon(name: string): LucideIcon {
  return iconMap[name] ?? LayoutDashboard;
}
