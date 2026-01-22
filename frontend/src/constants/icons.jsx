import {
  Server, Activity, Cloud, Wrench, Home, Shield, Globe,
  Cpu, HardDrive, Clock as ClockIcon, Zap, Users, Lock, Check, AlertCircle,
  Grid, List, RefreshCw, ChevronDown, ChevronUp, Upload, Link as LinkIcon,
  Download, Folder, FolderPlus, GripVertical, Lightbulb, ToggleRight,
  Gauge, Cog, Database, Container, Eye, EyeOff, Copy, FileJson,
  MonitorCheck, Network, Wifi, Router, Box, Layers, BarChart3,
  ThermometerSun, Droplets, Wind, Power, PlayCircle, PauseCircle, Terminal, Key,
  Bell, BellOff, Radio, Signal, Send, MessageCircle, Timer, TrendingUp,
  Palette, FileText, Receipt, CreditCard, Banknote, ShoppingCart, Cat,
  Smartphone, Tv, Car, Fuel, Pill, Heart, Baby, Utensils, Coffee,
  Building2, Flame, Waves, Phone, QrCode, Camera,
  Calendar, History, PieChart, ArrowLeft, CheckCircle2, ScanLine, Ban,
  Sun, Moon, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudFog, Cloudy,
  Search, Gamepad2, Music, Film, Gift, ShoppingBag, Tag, Package, Sofa, Bike,
  Stethoscope, Repeat, Play, Link2, Dumbbell, Wine, Plane, Train, Bus, Scissors,
  Glasses, Watch, Headphones, Speaker, Printer, BookOpen, GraduationCap, Briefcase
} from 'lucide-react';

// ============ Service Icons ============
export const serviceIcons = {
  'proxmox': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="currentColor" opacity="0.2"/>
      <polygon points="50,15 85,32.5 85,67.5 50,85 15,67.5 15,32.5" fill="none" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="50" r="15" fill="currentColor"/>
    </svg>
  ),
  'home-assistant': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path d="M50 10 L85 40 L85 90 L15 90 L15 40 Z" fill="currentColor" opacity="0.2"/>
      <path d="M50 20 L80 45 L80 85 L20 85 L20 45 Z" fill="none" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="55" r="12" fill="currentColor"/>
    </svg>
  ),
  'adguard': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path d="M50 5 L90 25 L90 55 C90 75 70 90 50 95 C30 90 10 75 10 55 L10 25 Z" fill="currentColor" opacity="0.2"/>
      <path d="M50 15 L80 30 L80 55 C80 70 65 82 50 87 C35 82 20 70 20 55 L20 30 Z" fill="none" stroke="currentColor" strokeWidth="3"/>
      <path d="M35 50 L47 62 L65 40" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'nginx': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <polygon points="50,10 90,30 90,70 50,90 10,70 10,30" fill="currentColor" opacity="0.2"/>
      <text x="50" y="60" textAnchor="middle" fontSize="30" fontWeight="bold" fill="currentColor">N</text>
    </svg>
  ),
  'docker': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect x="10" y="40" width="80" height="45" rx="5" fill="currentColor" opacity="0.2"/>
      <rect x="15" y="25" width="12" height="12" fill="currentColor" opacity="0.5"/>
      <rect x="30" y="25" width="12" height="12" fill="currentColor" opacity="0.5"/>
      <rect x="45" y="25" width="12" height="12" fill="currentColor" opacity="0.5"/>
      <rect x="30" y="10" width="12" height="12" fill="currentColor" opacity="0.5"/>
    </svg>
  ),
  'crowdsec': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="40" fill="currentColor" opacity="0.2"/>
      <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="50" r="5" fill="currentColor"/>
    </svg>
  ),
  'uptime-kuma': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect x="15" y="25" width="70" height="50" rx="5" fill="currentColor" opacity="0.2"/>
      <polyline points="25,55 35,45 50,60 65,35 75,50" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'mikrotik': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect x="10" y="30" width="80" height="40" rx="5" fill="currentColor" opacity="0.2"/>
      <rect x="15" y="35" width="70" height="30" rx="3" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="25" cy="50" r="4" fill="currentColor"/>
      <circle cx="40" cy="50" r="4" fill="currentColor"/>
      <circle cx="55" cy="50" r="4" fill="currentColor"/>
      <circle cx="70" cy="50" r="4" fill="currentColor"/>
      <rect x="78" y="44" width="4" height="12" fill="currentColor"/>
    </svg>
  ),
  'server': () => <Server className="w-full h-full" />,
  'activity': () => <Activity className="w-full h-full" />,
  'cloud': () => <Cloud className="w-full h-full" />,
  'wrench': () => <Wrench className="w-full h-full" />,
  'home': () => <Home className="w-full h-full" />,
  'shield': () => <Shield className="w-full h-full" />,
  'globe': () => <Globe className="w-full h-full" />,
  'database': () => <Database className="w-full h-full" />,
  'container': () => <Container className="w-full h-full" />,
  'network': () => <Network className="w-full h-full" />,
  'router': () => <Router className="w-full h-full" />,
  'layers': () => <Layers className="w-full h-full" />,
  'monitor': () => <MonitorCheck className="w-full h-full" />,
  'gauge': () => <Gauge className="w-full h-full" />,
  'cog': () => <Cog className="w-full h-full" />,
  'weather': () => <ThermometerSun className="w-full h-full" />,
  'wiki': () => <FileJson className="w-full h-full" />,
  'terminal': () => <Terminal className="w-full h-full" />,
  'ssh': () => <Terminal className="w-full h-full" />,
  // Providers and services
  'receipt': () => <Receipt className="w-full h-full" />,
  'credit-card': () => <CreditCard className="w-full h-full" />,
  'banknote': () => <Banknote className="w-full h-full" />,
  'internet': () => <Wifi className="w-full h-full" />,
  'wifi': () => <Wifi className="w-full h-full" />,
  'phone': () => <Phone className="w-full h-full" />,
  'mobile': () => <Smartphone className="w-full h-full" />,
  'tv': () => <Tv className="w-full h-full" />,
  'electric': () => <Zap className="w-full h-full" />,
  'gas': () => <Flame className="w-full h-full" />,
  'water': () => <Waves className="w-full h-full" />,
  'utilities': () => <Building2 className="w-full h-full" />,
  'cat': () => <Cat className="w-full h-full" />,
  'pet': () => <Cat className="w-full h-full" />,
  'shopping': () => <ShoppingCart className="w-full h-full" />,
  'car': () => <Car className="w-full h-full" />,
  'fuel': () => <Fuel className="w-full h-full" />,
  'health': () => <Heart className="w-full h-full" />,
  'medicine': () => <Pill className="w-full h-full" />,
  'baby': () => <Baby className="w-full h-full" />,
  'food': () => <Utensils className="w-full h-full" />,
  'coffee': () => <Coffee className="w-full h-full" />,
  // New icons
  'gamepad': () => <Gamepad2 className="w-full h-full" />,
  'music': () => <Music className="w-full h-full" />,
  'film': () => <Film className="w-full h-full" />,
  'gift': () => <Gift className="w-full h-full" />,
  'bag': () => <ShoppingBag className="w-full h-full" />,
  'tag': () => <Tag className="w-full h-full" />,
  'package': () => <Package className="w-full h-full" />,
  'sofa': () => <Sofa className="w-full h-full" />,
  'bike': () => <Bike className="w-full h-full" />,
  'stethoscope': () => <Stethoscope className="w-full h-full" />,
  'subscription': () => <Repeat className="w-full h-full" />,
  'play': () => <Play className="w-full h-full" />,
  'dumbbell': () => <Dumbbell className="w-full h-full" />,
  'wine': () => <Wine className="w-full h-full" />,
  'plane': () => <Plane className="w-full h-full" />,
  'train': () => <Train className="w-full h-full" />,
  'bus': () => <Bus className="w-full h-full" />,
  'scissors': () => <Scissors className="w-full h-full" />,
  'glasses': () => <Glasses className="w-full h-full" />,
  'watch': () => <Watch className="w-full h-full" />,
  'headphones': () => <Headphones className="w-full h-full" />,
  'speaker': () => <Speaker className="w-full h-full" />,
  'printer': () => <Printer className="w-full h-full" />,
  'book': () => <BookOpen className="w-full h-full" />,
  'education': () => <GraduationCap className="w-full h-full" />,
  'briefcase': () => <Briefcase className="w-full h-full" />,
  'utensils': () => <Utensils className="w-full h-full" />,
  'pill': () => <Pill className="w-full h-full" />,
  'shopping-cart': () => <ShoppingCart className="w-full h-full" />,
  'default': () => <Server className="w-full h-full" />
};

// Category icons mapping
export const categoryIcons = {
  server: Server,
  activity: Activity,
  cloud: Cloud,
  wrench: Wrench,
  home: Home,
  shield: Shield,
  globe: Globe,
  database: Database,
  container: Container,
  network: Network,
  layers: Layers,
  folder: Folder,
  gauge: Gauge,
  cog: Cog,
  receipt: Receipt
};

// Preset colors for color picker
export const presetColors = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#78716c', '#71717a', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'
];

export default serviceIcons;
