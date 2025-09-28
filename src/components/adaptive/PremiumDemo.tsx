'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  Users, 
  Calendar,
  MapPin,
  Star,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

export const PremiumDemo = () => {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  const demoData = [
    {
      id: 1,
      title: "AI & Machine Learning Summit",
      location: "Berlin, Germany",
      date: "Dec 15, 2024",
      attendees: "2.4k",
      growth: "+23%",
      category: "Technology",
      trending: true
    },
    {
      id: 2,
      title: "FinTech Innovation Conference",
      location: "Amsterdam, Netherlands",
      date: "Dec 18, 2024",
      attendees: "1.8k",
      growth: "+15%",
      category: "Finance",
      trending: false
    },
    {
      id: 3,
      title: "Healthcare Tech Expo",
      location: "Munich, Germany",
      date: "Dec 22, 2024",
      attendees: "3.1k",
      growth: "+31%",
      category: "Healthcare",
      trending: true
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center space-x-3"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-[#4ADE80] to-[#38BDF8] rounded-2xl flex items-center justify-center">
            <Sparkles size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-[#E6E8EC] font-geist">
            Premium Adaptive UI
          </h1>
        </motion.div>
        <p className="text-[#9CA3AF] text-lg max-w-2xl mx-auto">
          A sophisticated, enterprise-ready interface that balances minimalism with powerful functionality.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: TrendingUp,
            title: "Adaptive Intelligence",
            description: "UI that learns and adapts to user behavior patterns",
            color: "from-[#4ADE80] to-[#38BDF8]"
          },
          {
            icon: Users,
            title: "Enterprise Ready",
            description: "Built for scale with premium design tokens",
            color: "from-[#38BDF8] to-[#4ADE80]"
          },
          {
            icon: CheckCircle,
            title: "Accessibility First",
            description: "WCAG AA compliant with keyboard navigation",
            color: "from-[#4ADE80] to-[#38BDF8]"
          }
        ].map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#1A1F2C] border border-[#2D3344] rounded-2xl p-6 hover:border-[#4ADE80]/30 transition-all duration-150"
          >
            <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4`}>
              <feature.icon size={24} className="text-white" />
            </div>
            <h3 className="text-[#E6E8EC] font-semibold text-lg mb-2">
              {feature.title}
            </h3>
            <p className="text-[#9CA3AF] text-sm">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Event Cards Demo */}
      <div className="space-y-4">
        <h2 className="text-[#E6E8EC] font-semibold text-xl">
          Trending Events
        </h2>
        <div className="grid gap-4">
          {demoData.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 bg-[#1A1F2C] border rounded-2xl transition-all duration-150 cursor-pointer ${
                selectedCard === event.id
                  ? 'border-[#4ADE80]/30 bg-[#4ADE80]/5'
                  : 'border-[#2D3344] hover:border-[#4ADE80]/20'
              }`}
              onClick={() => setSelectedCard(selectedCard === event.id ? null : event.id)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-[#E6E8EC] font-medium">
                      {event.title}
                    </h3>
                    {event.trending && (
                      <div className="flex items-center space-x-1 px-2 py-1 bg-[#4ADE80]/10 text-[#4ADE80] rounded-lg text-xs">
                        <TrendingUp size={12} />
                        <span>Trending</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-[#9CA3AF] mb-3">
                    <div className="flex items-center space-x-1">
                      <MapPin size={14} />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar size={14} />
                      <span>{event.date}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users size={14} />
                      <span className="font-geist-mono">{event.attendees}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <span className="text-xs text-[#9CA3AF]">
                      {event.category}
                    </span>
                    <div className="flex items-center space-x-1 text-[#4ADE80] text-xs font-geist-mono">
                      <TrendingUp size={12} />
                      <span>{event.growth}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <button className="p-2 hover:bg-[#2D3344] rounded-xl transition-colors duration-150">
                    <Star size={16} className="text-[#9CA3AF] hover:text-[#4ADE80]" />
                  </button>
                  <button className="px-4 py-2 bg-[#4ADE80]/10 text-[#4ADE80] rounded-xl text-sm font-medium hover:bg-[#4ADE80]/20 transition-colors duration-150 flex items-center space-x-2">
                    <span>View</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Design Tokens Demo */}
      <div className="bg-[#1A1F2C] border border-[#2D3344] rounded-2xl p-6">
        <h3 className="text-[#E6E8EC] font-semibold text-lg mb-4">
          Design Tokens
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Primary', color: '#4ADE80', class: 'bg-[#4ADE80]' },
            { name: 'Secondary', color: '#38BDF8', class: 'bg-[#38BDF8]' },
            { name: 'Surface', color: '#1A1F2C', class: 'bg-[#1A1F2C] border border-[#2D3344]' },
            { name: 'Background', color: '#0B0F1A', class: 'bg-[#0B0F1A] border border-[#2D3344]' }
          ].map((token, index) => (
            <div key={index} className="space-y-2">
              <div className={`w-full h-16 rounded-xl ${token.class}`} />
              <div className="text-center">
                <p className="text-[#E6E8EC] text-sm font-medium">{token.name}</p>
                <p className="text-[#9CA3AF] text-xs font-geist-mono">{token.color}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

