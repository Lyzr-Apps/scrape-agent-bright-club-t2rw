'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FaInstagram,
  FaFacebook,
  FaLinkedin,
  FaStar,
  FaStarHalfAlt,
  FaRegStar,
  FaSearch,
  FaBars,
  FaTimes,
  FaTrash,
  FaArrowLeft,
  FaGlobe,
  FaPhone,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaUsers,
  FaIndustry,
  FaChevronRight,
  FaBuilding,
  FaNewspaper,
  FaChartLine,
  FaExclamationTriangle,
  FaBriefcase,
  FaThumbsUp,
  FaThumbsDown,
  FaComments,
  FaExternalLinkAlt,
  FaHistory,
  FaRedo,
} from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'
import { HiSparkles } from 'react-icons/hi2'

const AGENT_ID = '699ec82ddd80cdb173d3dd49'

// --- Types ---

interface CompanyData {
  company_name?: string
  industry?: string
  location?: string
  overall_sentiment?: string
  executive_summary?: string
  instagram_followers?: string
  instagram_engagement?: string
  instagram_sentiment?: string
  facebook_followers?: string
  facebook_rating?: string
  facebook_reviews?: string
  twitter_followers?: string
  twitter_engagement?: string
  twitter_sentiment?: string
  linkedin_employees?: string
  linkedin_description?: string
  google_rating?: string
  google_review_count?: string
  google_review_highlights?: string
  recent_news?: string
  press_releases?: string
  glassdoor_rating?: string
  glassdoor_pros?: string
  glassdoor_cons?: string
  employee_sentiment?: string
  work_life_balance?: string
  culture_rating?: string
  website?: string
  phone?: string
  headquarters?: string
  founding_year?: string
  employee_count?: string
  data_gaps?: string
  key_takeaways?: string
}

interface SearchHistoryItem {
  companyName: string
  date: string
  sentiment: string
}

// --- Helper Components ---

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-medium text-sm mt-3 mb-1 tracking-wider uppercase">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-medium text-base mt-3 mb-1 tracking-wider uppercase">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-medium text-lg mt-4 mb-2 tracking-widest uppercase">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm leading-relaxed">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm leading-relaxed">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm leading-relaxed">
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
      <strong key={i} className="font-medium">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const s = (sentiment ?? '').toLowerCase()
  const isPositive = s.includes('positive')
  const isNegative = s.includes('negative')
  const colorClass = isPositive
    ? 'bg-green-900/50 text-green-400 border-green-700'
    : isNegative
      ? 'bg-red-900/50 text-red-400 border-red-700'
      : 'bg-yellow-900/50 text-yellow-400 border-yellow-700'
  return (
    <span className={`inline-flex items-center px-3 py-1 text-xs border tracking-widest uppercase ${colorClass}`}>
      {sentiment || 'N/A'}
    </span>
  )
}

function StarRating({ rating }: { rating: string }) {
  const num = parseFloat(rating) || 0
  const full = Math.floor(num)
  const hasHalf = num - full >= 0.5
  const empty = 5 - full - (hasHalf ? 1 : 0)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <FaStar key={`f${i}`} className="text-primary" />
      ))}
      {hasHalf && <FaStarHalfAlt className="text-primary" />}
      {Array.from({ length: Math.max(0, empty) }).map((_, i) => (
        <FaRegStar key={`e${i}`} className="text-muted-foreground" />
      ))}
      <span className="ml-2 text-sm text-muted-foreground">{rating || 'N/A'}</span>
    </div>
  )
}

function SocialPlatformCard({
  icon,
  name,
  iconColor,
  followers,
  metrics,
  sentiment,
}: {
  icon: React.ReactNode
  name: string
  iconColor: string
  followers: string
  metrics: { label: string; value: string }[]
  sentiment?: string
}) {
  return (
    <Card className="bg-card border border-border hover:border-primary/30 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`text-2xl ${iconColor}`}>{icon}</div>
          <span className="text-xs tracking-widest uppercase text-muted-foreground">{name}</span>
        </div>
        <div className="text-2xl font-medium text-foreground mb-4 tracking-wide">
          {followers || 'N/A'}
        </div>
        <div className="space-y-2">
          {metrics.map((m, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground tracking-wider uppercase">{m.label}</span>
              <span className="text-xs text-foreground">{m.value || 'N/A'}</span>
            </div>
          ))}
        </div>
        {sentiment && (
          <div className="mt-4 pt-4 border-t border-border">
            <SentimentBadge sentiment={sentiment} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const isUrl = (value ?? '').startsWith('http')
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-b-0">
      <div className="text-primary mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-xs tracking-widest uppercase text-muted-foreground mb-1">{label}</div>
        {isUrl ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {value} <FaExternalLinkAlt className="text-xs" />
          </a>
        ) : (
          <div className="text-sm text-foreground">{value || 'N/A'}</div>
        )}
      </div>
    </div>
  )
}

function SkeletonResults() {
  return (
    <div className="space-y-6 animate-pulse">
      <Card className="bg-card border border-border">
        <CardContent className="p-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="flex gap-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-8">
          <Skeleton className="h-5 w-48 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-card border border-border">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-6 mb-4" />
              <Skeleton className="h-8 w-24 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-card border border-border">
            <CardContent className="p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function DataCoverageIndicator({ dataGaps }: { dataGaps: string }) {
  const platforms = [
    { name: 'Instagram', icon: <FaInstagram /> },
    { name: 'Facebook', icon: <FaFacebook /> },
    { name: 'X / Twitter', icon: <FaXTwitter /> },
    { name: 'LinkedIn', icon: <FaLinkedin /> },
    { name: 'Google', icon: <FaSearch /> },
    { name: 'Glassdoor', icon: <FaBriefcase /> },
  ]
  const gapsLower = (dataGaps ?? '').toLowerCase()
  return (
    <div className="flex flex-wrap gap-3">
      {platforms.map((p) => {
        const hasGap = gapsLower.includes(p.name.toLowerCase())
        return (
          <div
            key={p.name}
            className={`flex items-center gap-2 px-3 py-2 border text-xs tracking-wider uppercase ${hasGap ? 'border-yellow-700/50 text-yellow-500/70 bg-yellow-900/10' : 'border-green-700/50 text-green-400/70 bg-green-900/10'}`}
          >
            {p.icon}
            <span>{p.name}</span>
            {hasGap && <FaExclamationTriangle className="text-yellow-500 text-xs" />}
          </div>
        )
      })}
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
            <h2 className="text-xl font-medium mb-2 tracking-wider">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm tracking-wider"
            >
              Try again
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
          let data = apiResult?.response?.result
          if (typeof data === 'string') {
            data = parseLLMJson(data)
          }
          if (data?.result && typeof data.result === 'object') {
            data = data.result
          }

          setResult(data as CompanyData)

          const historyItem: SearchHistoryItem = {
            companyName: data?.company_name || company.trim(),
            date: new Date().toISOString(),
            sentiment: data?.overall_sentiment || 'Unknown',
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
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Toggle sidebar"
              >
                {sidebarOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
              </button>
              <div>
                <h1 className="text-lg font-medium tracking-widest uppercase text-foreground">
                  CompanyScope
                </h1>
                <p className="text-xs text-muted-foreground tracking-wider">
                  Social Intelligence Aggregator
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {viewState === 'results' && !sampleDataOn && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewSearch}
                  className="tracking-wider text-xs uppercase"
                >
                  <FaArrowLeft className="mr-2" size={10} />
                  New Search
                </Button>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tracking-wider uppercase">Sample Data</span>
                <Switch checked={sampleDataOn} onCheckedChange={setSampleDataOn} />
              </div>
            </div>
          </div>
        </header>

        {/* ---- SIDEBAR ---- */}
        <aside
          className={`fixed top-0 left-0 z-40 h-full w-72 bg-card border-r border-border transition-transform duration-300 pt-20 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FaHistory size={12} />
                <span className="text-xs tracking-widest uppercase">Search History</span>
              </div>
            </div>
            <ScrollArea className="flex-1 px-4 py-2">
              {searchHistory.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-xs text-muted-foreground tracking-wider">No searches yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {searchHistory.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleHistoryClick(item)}
                      className="w-full text-left p-3 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                          {item.companyName}
                        </span>
                        <FaChevronRight size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {item.date ? new Date(item.date).toLocaleDateString() : ''}
                        </span>
                        <SentimentBadge sentiment={item.sentiment} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            {searchHistory.length > 0 && (
              <div className="p-4 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  className="w-full text-xs tracking-wider uppercase text-muted-foreground hover:text-destructive"
                >
                  <FaTrash className="mr-2" size={10} />
                  Clear History
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* ---- Overlay when sidebar open ---- */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ---- MAIN CONTENT ---- */}
        <main className="pt-20 pb-12 px-4 md:px-6 max-w-7xl mx-auto">
          {/* ---- SEARCH STATE ---- */}
          {viewState === 'search' && (
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
              <div className="w-full max-w-2xl text-center">
                <div className="mb-2">
                  <FaChartLine className="text-primary mx-auto mb-4" size={32} />
                </div>
                <h2 className="text-3xl md:text-4xl font-medium tracking-widest uppercase text-foreground mb-3">
                  CompanyScope
                </h2>
                <p className="text-sm text-muted-foreground tracking-wider mb-10 uppercase">
                  Social Intelligence Aggregator
                </p>

                <div className="flex gap-0 mb-8">
                  <Input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch(searchQuery)
                    }}
                    placeholder="Enter company or organization name..."
                    className="flex-1 h-14 text-base bg-card border border-border px-6 tracking-wider placeholder:text-muted-foreground/50 focus:border-primary"
                  />
                  <Button
                    onClick={() => handleSearch(searchQuery)}
                    disabled={!searchQuery.trim()}
                    className="h-14 px-8 bg-primary text-primary-foreground tracking-widest uppercase text-xs hover:bg-primary/90 transition-colors"
                  >
                    <FaSearch className="mr-2" size={14} />
                    Analyze
                  </Button>
                </div>

                <div className="mb-10">
                  <p className="text-xs text-muted-foreground tracking-wider uppercase mb-4">
                    Trending Companies
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {TRENDING_COMPANIES.map((company) => (
                      <button
                        key={company}
                        onClick={() => {
                          setSearchQuery(company)
                          handleSearch(company)
                        }}
                        className="px-4 py-2 border border-border text-xs tracking-wider uppercase text-muted-foreground hover:text-primary hover:border-primary transition-all duration-300"
                      >
                        {company}
                      </button>
                    ))}
                  </div>
                </div>

                {searchHistory.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground tracking-wider uppercase mb-3">
                      Recent Searches
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {searchHistory.slice(0, 5).map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSearchQuery(item.companyName)
                            handleSearch(item.companyName)
                          }}
                          className="px-4 py-2 border border-border/50 bg-card text-xs tracking-wider text-muted-foreground hover:text-primary hover:border-primary transition-all duration-300"
                        >
                          {item.companyName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground/50 mt-12 tracking-wider max-w-md mx-auto">
                  CompanyScope aggregates data from Instagram, Facebook, X, LinkedIn, Google Reviews, Glassdoor, and news sources to provide comprehensive company intelligence.
                </p>
              </div>
            </div>
          )}

          {/* ---- RESULTS STATE ---- */}
          {viewState === 'results' && (
            <div className="space-y-6">
              {/* Loading */}
              {loading && (
                <div>
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 px-6 py-3 border border-border bg-card">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary animate-bounce" />
                        <span className="w-2 h-2 bg-primary animate-bounce" style={{ animationDelay: '0.15s' }} />
                        <span className="w-2 h-2 bg-primary animate-bounce" style={{ animationDelay: '0.3s' }} />
                      </div>
                      <span className="text-xs tracking-widest uppercase text-muted-foreground">
                        Gathering intelligence from multiple sources...
                      </span>
                    </div>
                  </div>
                  <SkeletonResults />
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div className="flex flex-col items-center justify-center min-h-[50vh]">
                  <Card className="bg-card border border-border max-w-md w-full">
                    <CardContent className="p-8 text-center">
                      <FaExclamationTriangle className="text-destructive mx-auto mb-4" size={28} />
                      <h3 className="text-base font-medium tracking-wider uppercase mb-2">Something went wrong</h3>
                      <p className="text-sm text-muted-foreground mb-6">{error}</p>
                      <div className="flex gap-3 justify-center">
                        <Button
                          variant="outline"
                          onClick={handleNewSearch}
                          className="tracking-wider text-xs uppercase"
                        >
                          <FaArrowLeft className="mr-2" size={10} />
                          Back
                        </Button>
                        <Button
                          onClick={() => handleSearch(searchQuery)}
                          className="tracking-wider text-xs uppercase"
                        >
                          <FaRedo className="mr-2" size={10} />
                          Retry
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Results Data */}
              {result && !loading && !error && (
                <div className="space-y-6">
                  {/* 1. Company Header */}
                  <Card className="bg-card border border-border">
                    <CardContent className="p-8">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <h2 className="text-2xl md:text-3xl font-medium tracking-widest uppercase text-foreground mb-3">
                            {result?.company_name || searchQuery || 'Company'}
                          </h2>
                          <div className="flex flex-wrap gap-2">
                            {result?.industry && (
                              <Badge variant="outline" className="tracking-wider text-xs uppercase border-primary/30 text-primary">
                                <FaIndustry className="mr-1.5" size={10} />
                                {result.industry}
                              </Badge>
                            )}
                            {result?.location && (
                              <Badge variant="outline" className="tracking-wider text-xs uppercase border-border text-muted-foreground">
                                <FaMapMarkerAlt className="mr-1.5" size={10} />
                                {result.location}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground tracking-wider uppercase mb-1">
                            Overall Sentiment
                          </div>
                          <SentimentBadge sentiment={result?.overall_sentiment || ''} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 2. Executive Summary */}
                  {result?.executive_summary && (
                    <Card className="bg-card border border-border">
                      <CardContent className="p-8">
                        <div className="flex items-center gap-2 mb-4">
                          <HiSparkles className="text-primary" size={18} />
                          <span className="text-xs tracking-widest uppercase text-muted-foreground">
                            AI-Generated Summary
                          </span>
                        </div>
                        <div className="text-sm leading-relaxed text-foreground">
                          {renderMarkdown(result.executive_summary)}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 3. Social Media Presence */}
                  <div>
                    <h3 className="text-xs tracking-widest uppercase text-muted-foreground mb-4 px-1">
                      Social Media Presence
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <SocialPlatformCard
                        icon={<FaInstagram />}
                        name="Instagram"
                        iconColor="text-pink-400"
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
                        followers={result?.facebook_followers || 'N/A'}
                        metrics={[
                          { label: 'Rating', value: result?.facebook_rating || '' },
                        ]}
                        sentiment={undefined}
                      />
                      <SocialPlatformCard
                        icon={<FaXTwitter />}
                        name="X / Twitter"
                        iconColor="text-foreground"
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
                        followers={result?.linkedin_employees || 'N/A'}
                        metrics={[]}
                        sentiment={undefined}
                      />
                    </div>
                  </div>

                  {/* LinkedIn Description (if present) */}
                  {result?.linkedin_description && (
                    <Card className="bg-card border border-border">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <FaLinkedin className="text-blue-500" size={14} />
                          <span className="text-xs tracking-widest uppercase text-muted-foreground">
                            LinkedIn Description
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {result.linkedin_description}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Facebook Reviews (if present) */}
                  {result?.facebook_reviews && (
                    <Card className="bg-card border border-border">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <FaFacebook className="text-blue-400" size={14} />
                          <span className="text-xs tracking-widest uppercase text-muted-foreground">
                            Facebook Reviews
                          </span>
                        </div>
                        <div className="text-sm text-foreground leading-relaxed">
                          {renderMarkdown(result.facebook_reviews)}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 4. Reviews & Ratings + 5. News in a 2-col grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Reviews & Ratings */}
                    <Card className="bg-card border border-border">
                      <CardHeader className="px-6 pt-6 pb-2">
                        <CardTitle className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                          <FaStar className="text-primary" size={14} />
                          Reviews & Ratings
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-6 pb-6 space-y-5">
                        <div>
                          <div className="text-xs text-muted-foreground tracking-wider uppercase mb-2">
                            Google Rating
                          </div>
                          <StarRating rating={result?.google_rating || ''} />
                          {result?.google_review_count && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {result.google_review_count} reviews
                            </p>
                          )}
                        </div>
                        {result?.google_review_highlights && (
                          <div>
                            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-2">
                              Review Highlights
                            </div>
                            <div className="text-sm text-foreground leading-relaxed">
                              {renderMarkdown(result.google_review_highlights)}
                            </div>
                          </div>
                        )}
                        {result?.facebook_rating && (
                          <div>
                            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-2">
                              Facebook Rating
                            </div>
                            <StarRating rating={result.facebook_rating} />
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* News & Updates */}
                    <Card className="bg-card border border-border">
                      <CardHeader className="px-6 pt-6 pb-2">
                        <CardTitle className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                          <FaNewspaper className="text-primary" size={14} />
                          News & Updates
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-6 pb-6 space-y-5">
                        {result?.recent_news && (
                          <div>
                            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-2">
                              Recent News
                            </div>
                            <div className="text-sm text-foreground leading-relaxed">
                              {renderMarkdown(result.recent_news)}
                            </div>
                          </div>
                        )}
                        {result?.press_releases && (
                          <div>
                            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-2">
                              Press Releases
                            </div>
                            <div className="text-sm text-foreground leading-relaxed">
                              {renderMarkdown(result.press_releases)}
                            </div>
                          </div>
                        )}
                        {!result?.recent_news && !result?.press_releases && (
                          <p className="text-sm text-muted-foreground">No news data available</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* 6. Employee Sentiment */}
                  <Card className="bg-card border border-border">
                    <CardHeader className="px-8 pt-8 pb-2">
                      <CardTitle className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                        <FaUsers className="text-primary" size={14} />
                        Employee Sentiment
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-8 pb-8">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Glassdoor Rating */}
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-2">
                              Glassdoor Rating
                            </div>
                            <StarRating rating={result?.glassdoor_rating || ''} />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-2">
                              Work-Life Balance
                            </div>
                            <span className="text-sm text-foreground">{result?.work_life_balance || 'N/A'}</span>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-2">
                              Culture Rating
                            </div>
                            <span className="text-sm text-foreground">{result?.culture_rating || 'N/A'}</span>
                          </div>
                        </div>

                        {/* Pros */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FaThumbsUp className="text-green-400" size={12} />
                            <span className="text-xs text-muted-foreground tracking-wider uppercase">
                              Pros
                            </span>
                          </div>
                          <div className="text-sm text-foreground leading-relaxed">
                            {result?.glassdoor_pros ? renderMarkdown(result.glassdoor_pros) : 'N/A'}
                          </div>
                        </div>

                        {/* Cons */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FaThumbsDown className="text-red-400" size={12} />
                            <span className="text-xs text-muted-foreground tracking-wider uppercase">
                              Cons
                            </span>
                          </div>
                          <div className="text-sm text-foreground leading-relaxed">
                            {result?.glassdoor_cons ? renderMarkdown(result.glassdoor_cons) : 'N/A'}
                          </div>
                        </div>
                      </div>

                      {/* Employee Sentiment Summary */}
                      {result?.employee_sentiment && (
                        <div className="mt-6 pt-6 border-t border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <FaComments className="text-primary" size={12} />
                            <span className="text-xs text-muted-foreground tracking-wider uppercase">
                              Employee Sentiment Summary
                            </span>
                          </div>
                          <div className="text-sm text-foreground leading-relaxed">
                            {renderMarkdown(result.employee_sentiment)}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 7. Contact & Business Details */}
                  <Card className="bg-card border border-border">
                    <CardHeader className="px-8 pt-8 pb-2">
                      <CardTitle className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                        <FaBuilding className="text-primary" size={14} />
                        Contact & Business Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-8 pb-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        <div>
                          <InfoRow
                            icon={<FaGlobe size={14} />}
                            label="Website"
                            value={result?.website || 'N/A'}
                          />
                          <InfoRow
                            icon={<FaPhone size={14} />}
                            label="Phone"
                            value={result?.phone || 'N/A'}
                          />
                          <InfoRow
                            icon={<FaMapMarkerAlt size={14} />}
                            label="Headquarters"
                            value={result?.headquarters || 'N/A'}
                          />
                        </div>
                        <div>
                          <InfoRow
                            icon={<FaCalendarAlt size={14} />}
                            label="Founded"
                            value={result?.founding_year || 'N/A'}
                          />
                          <InfoRow
                            icon={<FaUsers size={14} />}
                            label="Employees"
                            value={result?.employee_count || 'N/A'}
                          />
                          <InfoRow
                            icon={<FaIndustry size={14} />}
                            label="Industry"
                            value={result?.industry || 'N/A'}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 8. Key Takeaways */}
                  {result?.key_takeaways && (
                    <Card className="bg-card border border-border">
                      <CardHeader className="px-8 pt-8 pb-2">
                        <CardTitle className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                          <HiSparkles className="text-primary" size={14} />
                          Key Takeaways
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-8 pb-8">
                        <div className="text-sm text-foreground leading-relaxed">
                          {renderMarkdown(result.key_takeaways)}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 9. Data Coverage */}
                  <Card className="bg-card border border-border">
                    <CardHeader className="px-8 pt-8 pb-2">
                      <CardTitle className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                        <FaChartLine className="text-primary" size={14} />
                        Data Coverage
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-8 pb-8">
                      <DataCoverageIndicator dataGaps={result?.data_gaps || ''} />
                      {result?.data_gaps && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="text-xs text-muted-foreground tracking-wider uppercase mb-2">
                            Data Gaps & Notes
                          </div>
                          <div className="text-sm text-muted-foreground leading-relaxed">
                            {renderMarkdown(result.data_gaps)}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* No Results State */}
                  {!result?.company_name && !result?.executive_summary && !loading && (
                    <div className="text-center py-16">
                      <FaExclamationTriangle className="text-muted-foreground mx-auto mb-4" size={24} />
                      <p className="text-sm text-muted-foreground tracking-wider mb-4">
                        We couldn{"'"}t find enough data for {"\u201C"}{searchQuery}{"\u201D"}. Try a different name or spelling.
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleNewSearch}
                        className="tracking-wider text-xs uppercase"
                      >
                        <FaRedo className="mr-2" size={10} />
                        Try Again
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ---- AGENT STATUS FOOTER ---- */}
          <div className="mt-12 pt-6 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs tracking-widest uppercase text-muted-foreground mb-2">
                  Powered By
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 ${activeAgentId ? 'bg-primary animate-pulse' : 'bg-green-500'}`} />
                    <span className="text-xs text-muted-foreground tracking-wider">
                      Company Intelligence Manager
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground/40 tracking-wider">
                {activeAgentId ? 'Analyzing...' : 'Ready'}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Social Media Analyzer', 'Review Aggregator', 'News Scanner', 'Employee Insights'].map((sub) => (
                <span key={sub} className="text-xs px-2 py-1 border border-border/50 text-muted-foreground/50 tracking-wider">
                  {sub}
                </span>
              ))}
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
