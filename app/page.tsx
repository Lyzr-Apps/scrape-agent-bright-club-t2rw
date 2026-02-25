'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FaInstagram, FaFacebook, FaLinkedin, FaStar, FaStarHalfAlt, FaRegStar,
  FaSearch, FaBars, FaTimes, FaTrash, FaArrowLeft, FaGlobe, FaPhone,
  FaMapMarkerAlt, FaCalendarAlt, FaUsers, FaIndustry, FaChevronRight,
  FaBuilding, FaNewspaper, FaChartLine, FaExclamationTriangle, FaBriefcase,
  FaThumbsUp, FaThumbsDown, FaComments, FaExternalLinkAlt, FaHistory, FaRedo,
} from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'
import { HiSparkles } from 'react-icons/hi2'

const AGENT_ID = '699ec82ddd80cdb173d3dd49'

// --- Known schema fields for validation ---
const SCHEMA_FIELDS: (keyof CompanyData)[] = [
  'company_name', 'industry', 'location', 'overall_sentiment', 'executive_summary',
  'instagram_followers', 'instagram_engagement', 'instagram_sentiment',
  'facebook_followers', 'facebook_rating', 'facebook_reviews',
  'twitter_followers', 'twitter_engagement', 'twitter_sentiment',
  'linkedin_employees', 'linkedin_description',
  'google_rating', 'google_review_count', 'google_review_highlights',
  'recent_news', 'press_releases',
  'glassdoor_rating', 'glassdoor_pros', 'glassdoor_cons',
  'employee_sentiment', 'work_life_balance', 'culture_rating',
  'website', 'phone', 'headquarters', 'founding_year', 'employee_count',
  'data_gaps', 'key_takeaways',
]

// --- Types ---
interface CompanyData {
  company_name?: string; industry?: string; location?: string; overall_sentiment?: string
  executive_summary?: string; instagram_followers?: string; instagram_engagement?: string
  instagram_sentiment?: string; facebook_followers?: string; facebook_rating?: string
  facebook_reviews?: string; twitter_followers?: string; twitter_engagement?: string
  twitter_sentiment?: string; linkedin_employees?: string; linkedin_description?: string
  google_rating?: string; google_review_count?: string; google_review_highlights?: string
  recent_news?: string; press_releases?: string; glassdoor_rating?: string
  glassdoor_pros?: string; glassdoor_cons?: string; employee_sentiment?: string
  work_life_balance?: string; culture_rating?: string; website?: string; phone?: string
  headquarters?: string; founding_year?: string; employee_count?: string
  data_gaps?: string; key_takeaways?: string
}

interface SearchHistoryItem {
  companyName: string; date: string; sentiment: string
}

// --- Deep Response Extraction ---

/**
 * Deeply extracts CompanyData from an agent response, handling:
 * - Nested result.result.result... wrappers
 * - Stringified JSON at any depth
 * - response.message containing JSON
 * - raw_response strings
 * - Flat objects with schema fields at any nesting level
 */
function extractCompanyData(raw: any): CompanyData {
  if (!raw) return {}

  // Helper: count how many schema fields an object has
  const countSchemaFields = (obj: any): number => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 0
    return SCHEMA_FIELDS.filter(f => obj[f] !== undefined && obj[f] !== null && obj[f] !== '').length
  }

  // Helper: try parsing a string as JSON
  const tryParse = (str: string): any => {
    if (typeof str !== 'string') return null
    const trimmed = str.trim()
    if (!trimmed) return null
    try {
      return JSON.parse(trimmed)
    } catch {
      // Try parseLLMJson for resilient parsing
      const parsed = parseLLMJson(trimmed)
      if (parsed && typeof parsed === 'object' && !parsed.error) return parsed
      return null
    }
  }

  // Collect all candidate objects by walking the structure
  const candidates: { obj: any; depth: number; score: number }[] = []

  const walk = (node: any, depth: number) => {
    if (depth > 10 || !node) return

    // If it's a string, try to parse it
    if (typeof node === 'string') {
      const parsed = tryParse(node)
      if (parsed && typeof parsed === 'object') {
        walk(parsed, depth + 1)
      }
      return
    }

    if (typeof node !== 'object' || Array.isArray(node)) return

    // Score this object
    const score = countSchemaFields(node)
    if (score > 0) {
      candidates.push({ obj: node, depth, score })
    }

    // Walk common wrapper keys
    const wrapperKeys = ['result', 'response', 'data', 'output', 'content', 'message', 'raw_response', 'rawResponse', 'text']
    for (const key of wrapperKeys) {
      if (node[key] !== undefined && node[key] !== null) {
        walk(node[key], depth + 1)
      }
    }
  }

  walk(raw, 0)

  if (candidates.length === 0) {
    // Fallback: if raw is an object, try to use it directly
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as CompanyData
    }
    return {}
  }

  // Pick the candidate with the highest score (most matching schema fields)
  // On tie, prefer shallower depth
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.depth - b.depth
  })

  const best = candidates[0].obj

  // Build final result: extract only known fields, stringify any nested objects
  const result: CompanyData = {}
  for (const field of SCHEMA_FIELDS) {
    let val = best[field]
    if (val === undefined || val === null) continue
    if (typeof val === 'object') {
      // Convert objects/arrays to readable string
      if (Array.isArray(val)) {
        result[field] = val.map((item: any) =>
          typeof item === 'string' ? item : JSON.stringify(item)
        ).join('\n- ')
      } else {
        try { result[field] = JSON.stringify(val) } catch { result[field] = String(val) }
      }
    } else {
      result[field] = String(val)
    }
  }

  return result
}

// --- Markdown Renderer ---

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1 tracking-wider uppercase text-cyan-300">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1 tracking-wider uppercase text-cyan-300">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2 tracking-widest uppercase gradient-text">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 text-sm leading-relaxed list-none flex items-start gap-2">
              <span className="text-cyan-500 mt-1 flex-shrink-0">{'>'}</span>
              <span>{formatInline(line.slice(2))}</span>
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm leading-relaxed text-foreground/90">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm leading-relaxed text-foreground/90">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

// --- Helper Components ---

function SentimentIndicator({ sentiment }: { sentiment: string }) {
  const s = (sentiment ?? '').toLowerCase()
  const isPositive = s.includes('positive')
  const isNegative = s.includes('negative')
  const dotColor = isPositive ? 'bg-emerald-400' : isNegative ? 'bg-red-400' : 'bg-amber-400'
  const glowColor = isPositive ? 'shadow-emerald-400/50' : isNegative ? 'shadow-red-400/50' : 'shadow-amber-400/50'
  const textColor = isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-amber-400'
  const borderColor = isPositive ? 'border-emerald-500/30' : isNegative ? 'border-red-500/30' : 'border-amber-500/30'
  return (
    <div className={cn('inline-flex items-center gap-2 px-4 py-2 border rounded-sm', borderColor, 'bg-background/50')}>
      <span className={cn('w-2 h-2 rounded-full shadow-lg', dotColor, glowColor)} />
      <span className={cn('text-xs tracking-widest uppercase font-semibold', textColor)}>
        {sentiment || 'N/A'}
      </span>
    </div>
  )
}

function SentimentDot({ sentiment }: { sentiment: string }) {
  const s = (sentiment ?? '').toLowerCase()
  const isPositive = s.includes('positive')
  const isNegative = s.includes('negative')
  const dotColor = isPositive ? 'bg-emerald-400' : isNegative ? 'bg-red-400' : 'bg-amber-400'
  const glowColor = isPositive ? 'shadow-emerald-400/50' : isNegative ? 'shadow-red-400/50' : 'shadow-amber-400/50'
  return <span className={cn('w-2 h-2 rounded-full shadow-md inline-block', dotColor, glowColor)} />
}

function StarRating({ rating }: { rating: string }) {
  const num = parseFloat(rating) || 0
  const full = Math.floor(num)
  const hasHalf = num - full >= 0.5
  const empty = 5 - full - (hasHalf ? 1 : 0)
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: full }).map((_, i) => (
        <FaStar key={`f${i}`} className="text-cyan-400" size={14} />
      ))}
      {hasHalf && <FaStarHalfAlt className="text-cyan-400" size={14} />}
      {Array.from({ length: Math.max(0, empty) }).map((_, i) => (
        <FaRegStar key={`e${i}`} className="text-muted-foreground/40" size={14} />
      ))}
      <span className="ml-2 text-sm text-cyan-300 font-semibold neon-text">{rating || 'N/A'}</span>
    </div>
  )
}

function GlassCard({ children, className: extraClass, glowColor }: { children: React.ReactNode; className?: string; glowColor?: string }) {
  return (
    <div className={cn('glass-card rounded-lg p-6 transition-all duration-300', extraClass)}>
      {glowColor && (
        <div className={cn('absolute top-0 left-0 right-0 h-px', glowColor)} />
      )}
      {children}
    </div>
  )
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-cyan-400">{icon}</span>
      <h3 className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-semibold">
        {'// '}{label}
      </h3>
      <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/20 to-transparent" />
    </div>
  )
}

function CornerAccents({ children, className: extraClass }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative', extraClass)}>
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/30" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-500/30" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-500/30" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-500/30" />
      {children}
    </div>
  )
}

function SocialPlatformCard({
  icon, name, iconColor, borderColor, followers, metrics, sentiment,
}: {
  icon: React.ReactNode; name: string; iconColor: string; borderColor: string
  followers: string; metrics: { label: string; value: string }[]
  sentiment?: string
}) {
  return (
    <div className={cn('glass-card rounded-lg overflow-hidden transition-all duration-300 group')}>
      <div className={cn('h-1 w-full', borderColor)} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn('text-xl', iconColor)}>{icon}</div>
            <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">{name}</span>
          </div>
          {sentiment && <SentimentDot sentiment={sentiment} />}
        </div>
        <div className="text-2xl font-bold text-foreground mb-1 neon-text tracking-wide">
          {followers || 'N/A'}
        </div>
        <div className="text-xs text-muted-foreground tracking-wider uppercase mb-3">Followers</div>
        {metrics.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-border/50">
            {metrics.map((m, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground tracking-wider">{m.label}</span>
                <span className="text-xs text-foreground/80">{m.value || 'N/A'}</span>
              </div>
            ))}
          </div>
        )}
        {sentiment && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2">{sentiment}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ContactInfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const isUrl = (value ?? '').startsWith('http')
  return (
    <div className="glass-card rounded-lg p-4 transition-all duration-300">
      <div className="text-cyan-400 mb-2">{icon}</div>
      <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1 font-medium">{label}</div>
      {isUrl ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 break-all"
        >
          {value} <FaExternalLinkAlt className="text-[10px] flex-shrink-0" />
        </a>
      ) : (
        <div className="text-sm text-foreground/90 break-words">{value || 'N/A'}</div>
      )}
    </div>
  )
}

function DataCoverageIndicator({ dataGaps }: { dataGaps: string }) {
  const platforms = [
    { name: 'Instagram', icon: <FaInstagram size={12} /> },
    { name: 'Facebook', icon: <FaFacebook size={12} /> },
    { name: 'X / Twitter', icon: <FaXTwitter size={12} /> },
    { name: 'LinkedIn', icon: <FaLinkedin size={12} /> },
    { name: 'Google', icon: <FaSearch size={12} /> },
    { name: 'Glassdoor', icon: <FaBriefcase size={12} /> },
  ]
  const gapsLower = (dataGaps ?? '').toLowerCase()
  return (
    <div className="flex flex-wrap gap-3">
      {platforms.map((p) => {
        const hasGap = gapsLower.includes(p.name.toLowerCase())
        return (
          <div
            key={p.name}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-sm text-xs tracking-wider uppercase transition-all duration-300',
              hasGap
                ? 'border border-amber-500/30 text-amber-400/80 bg-amber-900/10'
                : 'border border-emerald-500/30 text-emerald-400/80 bg-emerald-900/10'
            )}
          >
            {p.icon}
            <span>{p.name}</span>
            <span className={cn(
              'text-[10px] tracking-widest font-semibold',
              hasGap ? 'text-amber-400' : 'text-emerald-400'
            )}>
              {hasGap ? 'LIMITED' : 'ONLINE'}
            </span>
            {hasGap && <FaExclamationTriangle className="text-amber-500" size={10} />}
          </div>
        )
      })}
    </div>
  )
}

function LoadingScreen() {
  const sources = [
    { tag: 'META', label: 'Instagram & Facebook', color: 'text-pink-400' },
    { tag: 'X', label: 'Twitter Intelligence', color: 'text-foreground' },
    { tag: 'GOOGLE', label: 'Business & News', color: 'text-cyan-400' },
    { tag: 'ALT', label: 'LinkedIn & Glassdoor', color: 'text-blue-400' },
  ]
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center justify-center py-16">
        {/* Concentric rings */}
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping" />
          <div className="absolute inset-2 rounded-full border border-purple-500/30 animate-ping" style={{ animationDelay: '0.3s' }} />
          <div className="absolute inset-4 rounded-full border border-cyan-500/40 animate-ping" style={{ animationDelay: '0.6s' }} />
          <div className="absolute inset-[22px] rounded-full bg-cyan-500/10 flex items-center justify-center">
            <FaSearch className="text-cyan-400 animate-pulse" size={16} />
          </div>
        </div>
        <p className="text-xs tracking-[0.3em] uppercase text-cyan-400 font-semibold neon-text animate-pulse mb-8">
          Scanning Multiple Intelligence Sources...
        </p>
        {/* Source indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
          {sources.map((src, idx) => (
            <div
              key={src.tag}
              className="glass-card rounded-lg px-4 py-3 flex items-center gap-3"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50" style={{ animationDelay: `${idx * 0.2}s` }} />
              <div className="flex-1 min-w-0">
                <span className={cn('text-[10px] tracking-[0.2em] uppercase font-bold', src.color)}>
                  [{src.tag}]
                </span>
                <span className="text-[10px] tracking-wider text-muted-foreground ml-2">{src.label}</span>
              </div>
              <span className="text-[10px] tracking-widest text-cyan-500 animate-pulse">SCANNING</span>
            </div>
          ))}
        </div>
      </div>
      {/* Skeleton cards */}
      <div className="space-y-4">
        <div className="glass-card rounded-lg p-8">
          <Skeleton className="h-8 w-64 mb-4 bg-cyan-500/5" />
          <div className="flex gap-3">
            <Skeleton className="h-6 w-24 bg-cyan-500/5" />
            <Skeleton className="h-6 w-32 bg-cyan-500/5" />
            <Skeleton className="h-6 w-20 bg-cyan-500/5" />
          </div>
        </div>
        <div className="glass-card rounded-lg p-8">
          <Skeleton className="h-5 w-48 mb-4 bg-cyan-500/5" />
          <Skeleton className="h-4 w-full mb-2 bg-cyan-500/5" />
          <Skeleton className="h-4 w-full mb-2 bg-cyan-500/5" />
          <Skeleton className="h-4 w-3/4 bg-cyan-500/5" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-lg p-5">
              <Skeleton className="h-6 w-6 mb-4 bg-cyan-500/5" />
              <Skeleton className="h-8 w-24 mb-4 bg-cyan-500/5" />
              <Skeleton className="h-4 w-full mb-2 bg-cyan-500/5" />
              <Skeleton className="h-4 w-full bg-cyan-500/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Error Boundary ---

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full border border-red-500/30 flex items-center justify-center">
              <FaExclamationTriangle className="text-red-400" size={24} />
            </div>
            <h2 className="text-xl font-semibold mb-2 tracking-wider">SYSTEM ERROR</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-6 py-2 bg-cyan-500 text-background text-sm tracking-widest uppercase font-semibold rounded-sm hover:bg-cyan-400 transition-colors"
            >
              Reinitialize
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- localStorage helpers ---

function saveToHistory(item: SearchHistoryItem) {
  try {
    const history: SearchHistoryItem[] = JSON.parse(localStorage.getItem('companyscope_history') || '[]')
    const filtered = history.filter((h) => h.companyName !== item.companyName)
    filtered.unshift(item)
    localStorage.setItem('companyscope_history', JSON.stringify(filtered.slice(0, 10)))
  } catch {
    // localStorage unavailable
  }
}

function loadHistory(): SearchHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('companyscope_history') || '[]')
  } catch {
    return []
  }
}

function clearHistory() {
  try {
    localStorage.removeItem('companyscope_history')
  } catch {
    // localStorage unavailable
  }
}

// --- Sample Data ---

const SAMPLE_DATA: CompanyData = {
  company_name: 'Tesla, Inc.',
  industry: 'Electric Vehicles & Clean Energy',
  location: 'Austin, Texas, United States',
  overall_sentiment: 'Positive',
  executive_summary:
    'Tesla continues to dominate the electric vehicle market with strong brand recognition and innovative technology. The company maintains a polarizing but highly engaged social media presence across all platforms. Consumer sentiment is predominantly positive, driven by product innovation and sustainability mission. Employee reviews indicate a demanding but rewarding work culture with competitive compensation.',
  instagram_followers: '13.2M',
  instagram_engagement: '2.8% average engagement rate',
  instagram_sentiment: 'Positive - Strong visual content strategy with high engagement on product launches and behind-the-scenes content',
  facebook_followers: '14.5M',
  facebook_rating: '4.2',
  facebook_reviews:
    'Mixed reviews focusing on customer service experiences. Many praise product quality while some note service center wait times.',
  twitter_followers: '24.1M',
  twitter_engagement: '3.1% average engagement rate - significantly above industry average',
  twitter_sentiment: 'Positive - High engagement driven by CEO activity and product announcements. Strong community advocacy.',
  linkedin_employees: '127,855 associated members',
  linkedin_description:
    'Tesla accelerates the world\'s transition to sustainable energy with electric cars, solar, and integrated renewable energy solutions for homes and businesses.',
  google_rating: '4.1',
  google_review_count: '45,200+ across all locations',
  google_review_highlights:
    'Customers frequently praise vehicle performance, technology integration, and the buying experience. Common concerns include service center availability and repair timelines.',
  recent_news:
    '- Tesla announces record Q4 deliveries exceeding analyst expectations\n- New Gigafactory expansion plans announced for Southeast Asia\n- Full Self-Driving beta receives positive safety audit results\n- Cybertruck production ramp accelerates ahead of schedule',
  press_releases:
    '- Tesla Energy division reports 150% year-over-year growth\n- Partnership announced with major mining companies for sustainable lithium sourcing\n- Software update v12.5 introduces advanced AI-assisted driving features',
  glassdoor_rating: '3.7',
  glassdoor_pros:
    'Innovative work environment, mission-driven culture, competitive stock options, cutting-edge technology, opportunity to work on industry-defining products',
  glassdoor_cons:
    'Long working hours, high-pressure environment, rapid organizational changes, work-life balance challenges in some departments',
  employee_sentiment: 'Mixed to Positive - Employees appreciate the mission and innovation but note demanding expectations',
  work_life_balance: '3.2 / 5.0',
  culture_rating: '3.8 / 5.0',
  website: 'https://www.tesla.com',
  phone: '+1 (888) 518-3752',
  headquarters: 'Austin, Texas, United States',
  founding_year: '2003',
  employee_count: '140,000+',
  data_gaps:
    'Limited data availability for regional social media accounts. Glassdoor reviews may be skewed towards US employees.',
  key_takeaways:
    '- Tesla maintains industry-leading social media engagement across all platforms\n- Overall consumer sentiment is strongly positive, driven by product innovation\n- Employee satisfaction is mixed with strengths in mission alignment and compensation\n- Google reviews indicate strong product satisfaction with service improvement opportunities\n- The brand continues to generate significant media attention and public discourse',
}

const TRENDING_COMPANIES = ['Tesla', 'Apple', 'Google', 'Microsoft', 'Amazon', 'Netflix']

// --- Main Page ---

export default function Page() {
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompanyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [viewState, setViewState] = useState<'search' | 'results'>('search')
  const [sampleDataOn, setSampleDataOn] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSearchHistory(loadHistory())
  }, [])

  useEffect(() => {
    if (sampleDataOn) {
      setResult(SAMPLE_DATA)
      setViewState('results')
      setSearchQuery('Tesla')
      setError(null)
    } else {
      setResult(null)
      setViewState('search')
      setSearchQuery('')
      setError(null)
    }
  }, [sampleDataOn])

  const handleSearch = useCallback(
    async (company: string) => {
      if (!company.trim()) return
      setLoading(true)
      setError(null)
      setViewState('results')
      setResult(null)
      setActiveAgentId(AGENT_ID)

      try {
        const apiResult = await callAIAgent(
          `Analyze the company: ${company.trim()}`,
          AGENT_ID
        )

        setActiveAgentId(null)

        if (apiResult.success) {
          const extracted = extractCompanyData(apiResult)
          const fieldCount = SCHEMA_FIELDS.filter(f => extracted[f]).length

          let finalData: CompanyData
          if (fieldCount >= 3) {
            finalData = extracted
          } else {
            const fallback = extractCompanyData(apiResult?.response?.result)
            const fallbackCount = SCHEMA_FIELDS.filter(f => fallback[f]).length
            finalData = fallbackCount > fieldCount ? fallback : extracted
          }

          if (!finalData.company_name) {
            finalData.company_name = company.trim()
          }

          setResult(finalData)

          const historyItem: SearchHistoryItem = {
            companyName: finalData.company_name || company.trim(),
            date: new Date().toISOString(),
            sentiment: finalData.overall_sentiment || 'Unknown',
          }
          saveToHistory(historyItem)
          setSearchHistory(loadHistory())
        } else {
          setError(apiResult?.error || 'Failed to analyze company. Please try again.')
        }
      } catch (err) {
        setActiveAgentId(null)
        setError('An unexpected error occurred. Please try again.')
      }

      setLoading(false)
    },
    []
  )

  const handleNewSearch = useCallback(() => {
    setViewState('search')
    setResult(null)
    setError(null)
    setSearchQuery('')
    setSampleDataOn(false)
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }, [])

  const handleHistoryClick = useCallback(
    (item: SearchHistoryItem) => {
      setSearchQuery(item.companyName)
      setSidebarOpen(false)
      setSampleDataOn(false)
      handleSearch(item.companyName)
    },
    [handleSearch]
  )

  const handleClearHistory = useCallback(() => {
    clearHistory()
    setSearchHistory([])
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        {/* ---- HEADER ---- */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-cyan-500/10">
          <div className="flex items-center justify-between px-4 md:px-6 py-3 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-muted-foreground hover:text-cyan-400 transition-colors p-1"
                aria-label="Toggle sidebar"
              >
                {sidebarOpen ? <FaTimes size={16} /> : <FaBars size={16} />}
              </button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                  <FaChartLine className="text-background" size={14} />
                </div>
                <div>
                  <h1 className="text-sm font-bold tracking-[0.3em] uppercase gradient-text">
                    CompanyScope
                  </h1>
                  <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase hidden sm:block">
                    // Social Intelligence Aggregator
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
              {viewState === 'results' && !sampleDataOn && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewSearch}
                  className="tracking-widest text-[10px] uppercase border-cyan-500/20 hover:border-cyan-500/50 hover:bg-cyan-500/5 text-cyan-400"
                >
                  <FaArrowLeft className="mr-2" size={10} />
                  New Scan
                </Button>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase hidden sm:inline">Sample</span>
                <Switch checked={sampleDataOn} onCheckedChange={setSampleDataOn} />
              </div>
            </div>
          </div>
        </header>

        {/* ---- SIDEBAR ---- */}
        <aside
          className={cn(
            'fixed top-0 left-0 z-40 h-full w-72 transition-transform duration-300 pt-16',
            'bg-background/95 backdrop-blur-xl border-r border-cyan-500/10',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex flex-col h-full">
            <div className="px-5 py-4 border-b border-cyan-500/10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FaHistory size={11} className="text-cyan-500" />
                <span className="text-[10px] tracking-[0.3em] uppercase font-semibold">Search Log</span>
              </div>
            </div>
            <ScrollArea className="flex-1 px-3 py-2">
              {searchHistory.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full border border-cyan-500/10 flex items-center justify-center">
                    <FaHistory className="text-muted-foreground/30" size={14} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 tracking-wider">No scans recorded</p>
                </div>
              ) : (
                <div className="space-y-1 mt-1">
                  {searchHistory.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleHistoryClick(item)}
                      className="w-full text-left px-3 py-3 hover:bg-cyan-500/5 transition-all duration-200 group rounded-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-cyan-500/50 text-xs flex-shrink-0">{'>'}</span>
                          <span className="text-sm text-foreground/80 group-hover:text-cyan-400 transition-colors truncate">
                            {item.companyName}
                          </span>
                        </div>
                        <FaChevronRight size={8} className="text-cyan-500/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 ml-4">
                        <span className="text-[10px] text-muted-foreground/40">
                          {item.date ? new Date(item.date).toLocaleDateString() : ''}
                        </span>
                        <SentimentDot sentiment={item.sentiment} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            {searchHistory.length > 0 && (
              <div className="p-3 border-t border-cyan-500/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  className="w-full text-[10px] tracking-[0.2em] uppercase text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/5"
                >
                  <FaTrash className="mr-2" size={9} />
                  Clear Log
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* ---- Overlay when sidebar open ---- */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ---- MAIN CONTENT ---- */}
        <main className="pt-16 pb-12 px-4 md:px-6 max-w-7xl mx-auto">
          {/* ---- SEARCH STATE (Hero) ---- */}
          {viewState === 'search' && (
            <div className="flex flex-col items-center justify-center min-h-[85vh]">
              <div className="w-full max-w-2xl text-center">
                {/* System status */}
                <div className="flex items-center justify-center gap-2 mb-10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse" />
                  <span className="text-[10px] tracking-[0.3em] uppercase text-emerald-400/80 font-semibold">System Online</span>
                </div>

                {/* Title */}
                <CornerAccents className="inline-block px-8 py-6 mb-6">
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[0.15em] uppercase gradient-text leading-tight">
                    CompanyScope
                  </h2>
                </CornerAccents>

                <p className="text-xs text-muted-foreground tracking-[0.3em] uppercase mb-12 font-medium">
                  {'// Social Intelligence Aggregator'}
                </p>

                {/* Search bar */}
                <div className="relative mb-10">
                  <div className="flex gap-0 neon-glow rounded-sm overflow-hidden">
                    <div className="relative flex-1">
                      <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/40" size={14} />
                      <Input
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSearch(searchQuery)
                        }}
                        placeholder="Enter target company name..."
                        className="h-14 text-sm bg-background/80 border-0 border-r border-cyan-500/10 pl-11 pr-4 tracking-wider placeholder:text-muted-foreground/30 focus-visible:ring-1 focus-visible:ring-cyan-500/30 rounded-none"
                      />
                    </div>
                    <Button
                      onClick={() => handleSearch(searchQuery)}
                      disabled={!searchQuery.trim()}
                      className="h-14 px-8 bg-gradient-to-r from-cyan-500 to-purple-500 text-background tracking-[0.2em] uppercase text-[11px] font-bold rounded-none hover:from-cyan-400 hover:to-purple-400 transition-all duration-300 disabled:opacity-30"
                    >
                      <HiSparkles className="mr-2" size={14} />
                      Initiate Scan
                    </Button>
                  </div>
                </div>

                {/* Trending */}
                <div className="mb-10">
                  <p className="text-[10px] text-muted-foreground/50 tracking-[0.3em] uppercase mb-4 font-medium">
                    {'// Trending Targets'}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {TRENDING_COMPANIES.map((company) => (
                      <button
                        key={company}
                        onClick={() => {
                          setSearchQuery(company)
                          handleSearch(company)
                        }}
                        className="px-4 py-2 border border-cyan-500/15 rounded-sm text-xs tracking-[0.15em] uppercase text-muted-foreground/60 hover:text-cyan-400 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/5"
                      >
                        {company}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recent searches */}
                {searchHistory.length > 0 && (
                  <div className="mb-10">
                    <p className="text-[10px] text-muted-foreground/50 tracking-[0.3em] uppercase mb-4 font-medium">
                      {'// Recent Scans'}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {searchHistory.slice(0, 5).map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSearchQuery(item.companyName)
                            handleSearch(item.companyName)
                          }}
                          className="flex items-center gap-2 px-4 py-2 glass-card rounded-sm text-xs tracking-wider text-muted-foreground/60 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-300"
                        >
                          <span className="text-cyan-500/40">{'>'}</span>
                          {item.companyName}
                          <SentimentDot sentiment={item.sentiment} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="glass-card rounded-lg px-6 py-4 max-w-lg mx-auto">
                  <p className="text-[11px] text-muted-foreground/40 tracking-wider leading-relaxed">
                    CompanyScope aggregates data from Instagram, Facebook, X, LinkedIn, Google Reviews, Glassdoor, and news sources to provide comprehensive company intelligence.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ---- RESULTS STATE ---- */}
          {viewState === 'results' && (
            <div className="space-y-6 pt-4">
              {/* Loading */}
              {loading && <LoadingScreen />}

              {/* Error */}
              {error && !loading && (
                <div className="flex flex-col items-center justify-center min-h-[50vh]">
                  <CornerAccents className="max-w-md w-full">
                    <div className="glass-card rounded-lg p-8 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full border border-red-500/30 flex items-center justify-center bg-red-500/5">
                        <FaExclamationTriangle className="text-red-400" size={22} />
                      </div>
                      <h3 className="text-sm font-bold tracking-[0.2em] uppercase mb-2 text-red-400">Scan Failed</h3>
                      <p className="text-sm text-muted-foreground/70 mb-6 leading-relaxed">{error}</p>
                      <div className="flex gap-3 justify-center">
                        <Button
                          variant="outline"
                          onClick={handleNewSearch}
                          className="tracking-widest text-[10px] uppercase border-cyan-500/20 hover:border-cyan-500/50 text-cyan-400"
                        >
                          <FaArrowLeft className="mr-2" size={10} />
                          Back
                        </Button>
                        <Button
                          onClick={() => handleSearch(searchQuery)}
                          className="tracking-widest text-[10px] uppercase bg-gradient-to-r from-cyan-500 to-purple-500 text-background hover:from-cyan-400 hover:to-purple-400"
                        >
                          <FaRedo className="mr-2" size={10} />
                          Retry
                        </Button>
                      </div>
                    </div>
                  </CornerAccents>
                </div>
              )}

              {/* Results Data */}
              {result && !loading && !error && (
                <div className="space-y-6">
                  {/* 1. Company Header */}
                  <CornerAccents>
                    <div className="glass-card rounded-lg p-6 md:p-8 neon-glow">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                        <div>
                          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-[0.1em] uppercase gradient-text mb-4">
                            {result?.company_name || searchQuery || 'Company'}
                          </h2>
                          <div className="flex flex-wrap gap-2">
                            {result?.industry && (
                              <Badge className="tracking-[0.15em] text-[10px] uppercase bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/15 rounded-sm">
                                <FaIndustry className="mr-1.5" size={9} />
                                {result.industry}
                              </Badge>
                            )}
                            {result?.location && (
                              <Badge variant="outline" className="tracking-[0.15em] text-[10px] uppercase border-border/50 text-muted-foreground rounded-sm">
                                <FaMapMarkerAlt className="mr-1.5" size={9} />
                                {result.location}
                              </Badge>
                            )}
                            {result?.employee_count && (
                              <Badge variant="outline" className="tracking-[0.15em] text-[10px] uppercase border-border/50 text-muted-foreground rounded-sm">
                                <FaUsers className="mr-1.5" size={9} />
                                {result.employee_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <div className="text-[10px] text-muted-foreground tracking-[0.3em] uppercase mb-2 font-medium">
                            Overall Sentiment
                          </div>
                          <SentimentIndicator sentiment={result?.overall_sentiment || ''} />
                        </div>
                      </div>
                    </div>
                  </CornerAccents>

                  {/* 2. Executive Summary */}
                  {result?.executive_summary && (
                    <div className="glass-card rounded-lg overflow-hidden">
                      <div className="h-px w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-transparent" />
                      <div className="p-6 md:p-8">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border-0 text-[10px] tracking-[0.2em] uppercase rounded-sm px-2 py-0.5">
                            <HiSparkles className="mr-1" size={10} />
                            AI Analysis
                          </Badge>
                        </div>
                        <div className="h-px bg-gradient-to-r from-cyan-500/10 to-transparent my-4" />
                        <div className="text-sm leading-relaxed text-foreground/85">
                          {renderMarkdown(result.executive_summary)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Social Media Presence */}
                  <div>
                    <SectionHeader icon={<FaChartLine size={13} />} label="Social Media Presence" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <SocialPlatformCard
                        icon={<FaInstagram />}
                        name="Instagram"
                        iconColor="text-pink-400"
                        borderColor="bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400"
                        followers={result?.instagram_followers || 'N/A'}
                        metrics={[
                          { label: 'Engagement', value: result?.instagram_engagement || '' },
                        ]}
                        sentiment={result?.instagram_sentiment}
                      />
                      <SocialPlatformCard
                        icon={<FaFacebook />}
                        name="Facebook"
                        iconColor="text-blue-400"
                        borderColor="bg-blue-500"
                        followers={result?.facebook_followers || 'N/A'}
                        metrics={[
                          { label: 'Rating', value: result?.facebook_rating ? `${result.facebook_rating} / 5.0` : '' },
                        ]}
                      />
                      <SocialPlatformCard
                        icon={<FaXTwitter />}
                        name="X / Twitter"
                        iconColor="text-foreground"
                        borderColor="bg-foreground/80"
                        followers={result?.twitter_followers || 'N/A'}
                        metrics={[
                          { label: 'Engagement', value: result?.twitter_engagement || '' },
                        ]}
                        sentiment={result?.twitter_sentiment}
                      />
                      <SocialPlatformCard
                        icon={<FaLinkedin />}
                        name="LinkedIn"
                        iconColor="text-blue-500"
                        borderColor="bg-blue-600"
                        followers={result?.linkedin_employees || 'N/A'}
                        metrics={[]}
                      />
                    </div>
                  </div>

                  {/* LinkedIn Description */}
                  {result?.linkedin_description && (
                    <div className="glass-card rounded-lg overflow-hidden">
                      <div className="h-px w-full bg-blue-500/40" />
                      <div className="p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <FaLinkedin className="text-blue-500" size={14} />
                          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-semibold">
                            // LinkedIn Description
                          </span>
                        </div>
                        <p className="text-sm text-foreground/85 leading-relaxed">
                          {result.linkedin_description}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Facebook Reviews */}
                  {result?.facebook_reviews && (
                    <div className="glass-card rounded-lg overflow-hidden">
                      <div className="h-px w-full bg-blue-400/40" />
                      <div className="p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <FaFacebook className="text-blue-400" size={14} />
                          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-semibold">
                            // Facebook Reviews
                          </span>
                        </div>
                        <div className="text-sm text-foreground/85 leading-relaxed">
                          {renderMarkdown(result.facebook_reviews)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. Reviews & Ratings + 5. News */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Reviews & Ratings */}
                    <div className="glass-card rounded-lg overflow-hidden">
                      <div className="h-px w-full bg-gradient-to-r from-amber-500 to-transparent" />
                      <div className="p-6">
                        <SectionHeader icon={<FaStar size={13} />} label="Reviews & Ratings" />
                        <div className="space-y-5">
                          <div>
                            <div className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-2 font-medium">
                              Google Rating
                            </div>
                            <StarRating rating={result?.google_rating || ''} />
                            {result?.google_review_count && (
                              <p className="text-xs text-muted-foreground/60 mt-1.5">
                                {result.google_review_count} reviews
                              </p>
                            )}
                          </div>
                          {result?.google_review_highlights && (
                            <div>
                              <div className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-2 font-medium">
                                Review Highlights
                              </div>
                              <div className="text-sm text-foreground/80 leading-relaxed">
                                {renderMarkdown(result.google_review_highlights)}
                              </div>
                            </div>
                          )}
                          {result?.facebook_rating && (
                            <div>
                              <div className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-2 font-medium">
                                Facebook Rating
                              </div>
                              <StarRating rating={result.facebook_rating} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* News & Updates */}
                    <div className="glass-card rounded-lg overflow-hidden">
                      <div className="h-px w-full bg-gradient-to-r from-purple-500 to-transparent" />
                      <div className="p-6">
                        <SectionHeader icon={<FaNewspaper size={13} />} label="News & Updates" />
                        <div className="space-y-5">
                          {result?.recent_news && (
                            <div>
                              <div className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-2 font-medium">
                                Recent News
                              </div>
                              <div className="text-sm text-foreground/80 leading-relaxed">
                                {renderMarkdown(result.recent_news)}
                              </div>
                            </div>
                          )}
                          {result?.press_releases && (
                            <div>
                              <div className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-2 font-medium">
                                Press Releases
                              </div>
                              <div className="text-sm text-foreground/80 leading-relaxed">
                                {renderMarkdown(result.press_releases)}
                              </div>
                            </div>
                          )}
                          {!result?.recent_news && !result?.press_releases && (
                            <p className="text-sm text-muted-foreground/50 tracking-wider">No news data available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 6. Employee Sentiment */}
                  <div className="glass-card rounded-lg overflow-hidden">
                    <div className="h-px w-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-transparent" />
                    <div className="p-6 md:p-8">
                      <SectionHeader icon={<FaUsers size={13} />} label="Employee Sentiment" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Glassdoor Stats */}
                        <div className="space-y-5">
                          <div>
                            <div className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-2 font-medium">
                              Glassdoor Rating
                            </div>
                            <StarRating rating={result?.glassdoor_rating || ''} />
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-2 font-medium">
                              Work-Life Balance
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500"
                                  style={{ width: `${(parseFloat(result?.work_life_balance || '0') / 5) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm text-cyan-300 font-semibold neon-text min-w-[60px] text-right">
                                {result?.work_life_balance || 'N/A'}
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-2 font-medium">
                              Culture Rating
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                                  style={{ width: `${(parseFloat(result?.culture_rating || '0') / 5) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm text-purple-300 font-semibold min-w-[60px] text-right">
                                {result?.culture_rating || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Pros */}
                        <div className="glass-card rounded-lg p-4 border-emerald-500/15">
                          <div className="flex items-center gap-2 mb-3">
                            <FaThumbsUp className="text-emerald-400" size={11} />
                            <span className="text-[10px] text-emerald-400 tracking-[0.2em] uppercase font-semibold">
                              Pros
                            </span>
                          </div>
                          <div className="text-sm text-foreground/80 leading-relaxed">
                            {result?.glassdoor_pros ? renderMarkdown(result.glassdoor_pros) : 'N/A'}
                          </div>
                        </div>

                        {/* Cons */}
                        <div className="glass-card rounded-lg p-4 border-red-500/15">
                          <div className="flex items-center gap-2 mb-3">
                            <FaThumbsDown className="text-red-400" size={11} />
                            <span className="text-[10px] text-red-400 tracking-[0.2em] uppercase font-semibold">
                              Cons
                            </span>
                          </div>
                          <div className="text-sm text-foreground/80 leading-relaxed">
                            {result?.glassdoor_cons ? renderMarkdown(result.glassdoor_cons) : 'N/A'}
                          </div>
                        </div>
                      </div>

                      {/* Employee Sentiment Summary */}
                      {result?.employee_sentiment && (
                        <div className="mt-6 pt-6 border-t border-cyan-500/10">
                          <div className="flex items-center gap-2 mb-3">
                            <FaComments className="text-cyan-400" size={11} />
                            <span className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase font-semibold">
                              // Employee Sentiment Summary
                            </span>
                          </div>
                          <div className="text-sm text-foreground/80 leading-relaxed">
                            {renderMarkdown(result.employee_sentiment)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 7. Contact & Business Details */}
                  <div>
                    <SectionHeader icon={<FaBuilding size={13} />} label="Contact & Business Details" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <ContactInfoCell
                        icon={<FaGlobe size={14} />}
                        label="Website"
                        value={result?.website || 'N/A'}
                      />
                      <ContactInfoCell
                        icon={<FaPhone size={14} />}
                        label="Phone"
                        value={result?.phone || 'N/A'}
                      />
                      <ContactInfoCell
                        icon={<FaMapMarkerAlt size={14} />}
                        label="Headquarters"
                        value={result?.headquarters || 'N/A'}
                      />
                      <ContactInfoCell
                        icon={<FaCalendarAlt size={14} />}
                        label="Founded"
                        value={result?.founding_year || 'N/A'}
                      />
                      <ContactInfoCell
                        icon={<FaUsers size={14} />}
                        label="Employees"
                        value={result?.employee_count || 'N/A'}
                      />
                      <ContactInfoCell
                        icon={<FaIndustry size={14} />}
                        label="Industry"
                        value={result?.industry || 'N/A'}
                      />
                    </div>
                  </div>

                  {/* 8. Key Takeaways */}
                  {result?.key_takeaways && (
                    <div className="glass-card rounded-lg overflow-hidden relative">
                      <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500 via-purple-500 to-transparent rounded-l-lg" />
                        <div className="p-6 md:p-8 pl-8 md:pl-10">
                          <div className="flex items-center gap-2 mb-4">
                            <HiSparkles className="text-cyan-400" size={14} />
                            <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-semibold">
                              // Key Takeaways
                            </span>
                          </div>
                          <div className="text-sm text-foreground/85 leading-relaxed">
                            {renderMarkdown(result.key_takeaways)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 9. Data Coverage */}
                  <div className="glass-card rounded-lg overflow-hidden">
                    <div className="h-px w-full bg-gradient-to-r from-cyan-500/30 to-transparent" />
                    <div className="p-6 md:p-8">
                      <SectionHeader icon={<FaChartLine size={13} />} label="Data Coverage" />
                      <DataCoverageIndicator dataGaps={result?.data_gaps || ''} />
                      {result?.data_gaps && (
                        <div className="mt-5 pt-5 border-t border-cyan-500/10">
                          <div className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-2 font-medium">
                            // Data Gaps & Notes
                          </div>
                          <div className="text-sm text-muted-foreground/70 leading-relaxed">
                            {renderMarkdown(result.data_gaps)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* No Results State */}
                  {!result?.company_name && !result?.executive_summary && !loading && (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full border border-cyan-500/20 flex items-center justify-center">
                        <FaExclamationTriangle className="text-muted-foreground/40" size={20} />
                      </div>
                      <p className="text-sm text-muted-foreground/60 tracking-wider mb-6">
                        Insufficient data found for {"\u201C"}{searchQuery}{"\u201D"}. Try a different name or spelling.
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleNewSearch}
                        className="tracking-widest text-[10px] uppercase border-cyan-500/20 hover:border-cyan-500/50 text-cyan-400"
                      >
                        <FaRedo className="mr-2" size={10} />
                        New Scan
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ---- AGENT STATUS FOOTER ---- */}
          <div className="mt-16 pt-6 border-t border-cyan-500/10">
            <div className="glass-card rounded-lg p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/50 mb-2 font-semibold">
                    {'// System Status'}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'w-2 h-2 rounded-full shadow-lg',
                        activeAgentId ? 'bg-cyan-400 shadow-cyan-400/50 animate-pulse' : 'bg-emerald-400 shadow-emerald-400/50'
                      )} />
                      <span className="text-xs text-foreground/70 tracking-wider font-medium">
                        Company Intelligence Manager
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[9px] tracking-widest uppercase border-cyan-500/15 text-muted-foreground/40 rounded-sm">
                      {activeAgentId ? 'SCANNING' : 'STANDBY'}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Social Media Analyzer', 'Review Aggregator', 'News Scanner', 'Employee Insights'].map((sub) => (
                    <span
                      key={sub}
                      className="text-[9px] px-2.5 py-1 border border-cyan-500/10 text-muted-foreground/30 tracking-wider rounded-sm"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
