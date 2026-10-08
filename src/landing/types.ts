export interface NavItem {
  name: string;
  href: string;
  active?: boolean;
}

export interface StudentAttendance {
  id: string;
  name: string;
  nisn: string;
  className: string;
  time: string;
  status: 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpa';
  parentPhone: string;
  photoUrl?: string;
}

export interface ClassSummary {
  className: string;
  totalStudents: number;
  present: number;
  sick: number;
  permission: number;
  absent: number;
  percentage: number;
}

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  pricePerStudent: string;
  period: string;
  popular?: boolean;
  features: string[];
  ctaText: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  school: string;
  avatar: string;
  content: string;
  rating: number;
}

export interface BlogPost {
  id: string;
  title: string;
  category: string;
  readTime: string;
  date: string;
  snippet: string;
  image: string;
}
