import {
  Sparkles, Shirt, Wand2, CreditCard, LifeBuoy, BookOpen, HelpCircle,
  Camera, User, Settings, MessageCircle, ShoppingBag, Heart, Bell, Shield,
  type LucideIcon,
} from "lucide-react";

/** Map the KB category `icon` string (lucide-style names from the seed) to a real icon. */
const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  shirt: Shirt,
  wand: Wand2,
  "wand-2": Wand2,
  "credit-card": CreditCard,
  "life-buoy": LifeBuoy,
  lifebuoy: LifeBuoy,
  book: BookOpen,
  "book-open": BookOpen,
  help: HelpCircle,
  camera: Camera,
  user: User,
  account: User,
  settings: Settings,
  chat: MessageCircle,
  message: MessageCircle,
  shopping: ShoppingBag,
  bag: ShoppingBag,
  heart: Heart,
  bell: Bell,
  shield: Shield,
};

export function categoryIcon(name?: string): LucideIcon {
  if (!name) return BookOpen;
  return ICONS[name.trim().toLowerCase()] ?? BookOpen;
}

export function CategoryIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = categoryIcon(name);
  return <Icon className={className} />;
}
