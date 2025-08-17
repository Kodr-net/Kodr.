import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { 
  Code2, 
  Users, 
  Shield, 
  Zap, 
  CheckCircle, 
  Star, 
  TrendingUp,
  Clock,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import heroImage from '@/assets/hero-main.jpg';
import codersImage from '@/assets/coders-working.jpg';
import techImage from '@/assets/tech-abstract.jpg';

const features = [
  {
    icon: Shield,
    title: 'Secure & Trusted',
    description: 'Escrow protection, verified profiles, and secure payments ensure safe transactions.',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Find and hire skilled coders or teams within minutes, not weeks.',
  },
  {
    icon: Users,
    title: 'Pre-Vetted Talent',
    description: 'All coders and teams are carefully curated for quality and reliability.',
  },
  {
    icon: TrendingUp,
    title: 'Track Progress',
    description: 'Real-time project tracking with built-in communication tools.',
  },
];

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Startup Founder',
    content: 'Found an amazing React team that delivered my MVP in just 3 weeks. The quality exceeded expectations.',
    rating: 5,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
  },
  {
    name: 'Marcus Johnson',
    role: 'Product Manager',
    content: 'The escrow system gave me confidence to hire. Communication was seamless throughout the project.',
    rating: 5,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marcus',
  },
  {
    name: 'Elena Rodriguez',
    role: 'E-commerce Owner',
    content: 'Hired a full-stack developer who transformed my idea into reality. Highly recommend Kodr.',
    rating: 5,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=elena',
  },
];

const stats = [
  { label: 'Active Coders', value: '2,500+' },
  { label: 'Projects Completed', value: '10,000+' },
  { label: 'Success Rate', value: '98%' },
  { label: 'Avg. Response Time', value: '2 hours' },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background to-surface-elevated">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5" />
        <div className="container mx-auto px-4 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-fade-up">
              <Badge variant="secondary" className="w-fit">
                🚀 Trusted by 10,000+ Projects
              </Badge>
              
              <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
                Hire <span className="gradient-text">Coders</span> & 
                <br />Teams to Build 
                <br />Your <span className="gradient-text">Ideas</span>
              </h1>
              
              <p className="text-xl text-foreground-muted max-w-lg leading-relaxed">
                Connect with pre-vetted developers and teams. From MVPs to enterprise solutions, 
                find the perfect talent to bring your vision to life.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="text-lg px-8 py-6 focus-ring">
                  <Link to="/browse">
                    Hire a Coder
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6 focus-ring">
                  <Link to="/register">
                    Join as Coder
                  </Link>
                </Button>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-6 pt-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">98%</div>
                  <div className="text-sm text-foreground-muted">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-secondary">2hrs</div>
                  <div className="text-sm text-foreground-muted">Avg Response</div>
                </div>
              </div>
            </div>
            
            <div className="relative animate-fade-up">
              <div className="relative rounded-2xl overflow-hidden shadow-elegant hover-lift">
                <img 
                  src={heroImage} 
                  alt="Professional developers collaborating" 
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
              
              {/* Floating Cards */}
              <Card className="absolute -bottom-6 -left-6 glass animate-scale-in">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                      <Code2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold">Live Project</div>
                      <div className="text-sm text-foreground-muted">React App Development</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="absolute -top-6 -right-6 glass animate-scale-in">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold">Team Hired</div>
                      <div className="text-sm text-foreground-muted">Full-Stack Experts</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-surface">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6">Why Choose Kodr?</h2>
            <p className="text-xl text-foreground-muted max-w-2xl mx-auto">
              We've built the most trusted marketplace for connecting hirers with talented developers.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="hover-lift bg-background border-border">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-foreground-muted text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6">How It Works</h2>
            <p className="text-xl text-foreground-muted">Simple steps to get your project started</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Post Your Project</h3>
              <p className="text-foreground-muted">
                Describe your project, set your budget, and specify the skills you need.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Review Proposals</h3>
              <p className="text-foreground-muted">
                Browse through vetted coders and teams, review their portfolios and ratings.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Start Building</h3>
              <p className="text-foreground-muted">
                Hire your chosen talent and track progress with our built-in project tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="py-20 bg-surface">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-foreground-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6">What Our Clients Say</h2>
            <p className="text-xl text-foreground-muted">Real feedback from successful projects</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="hover-lift">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-foreground-muted mb-6">"{testimonial.content}"</p>
                  <div className="flex items-center space-x-3">
                    <img 
                      src={testimonial.avatar} 
                      alt={testimonial.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-foreground-muted">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary to-secondary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Build Something Amazing?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of successful projects. Whether you're hiring or looking for work, 
            Kodr is your trusted partner.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild className="text-lg px-8 py-6">
              <Link to="/browse">Start Hiring</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6 border-white text-white hover:bg-white hover:text-primary">
              <Link to="/register">Join as Coder</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-elevated py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <Code2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-jakarta font-bold text-xl">Kodr</span>
            </div>
            <div className="text-foreground-muted text-sm">
              © 2024 Kodr. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}