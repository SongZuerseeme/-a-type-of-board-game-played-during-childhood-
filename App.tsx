/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { LaoZhuQi } from './components/LaoZhuQi';
import { motion } from 'motion/react';
import { LucideShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-950 bg-dot-grid text-zinc-50 selection:bg-blue-500/30 overflow-x-hidden relative flex flex-col">
      {/* Decorative Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-[128px] -z-10" />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-8 flex items-center justify-between relative z-20">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <LucideShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">老猪棋</h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Heritage Gaming</p>
          </div>
        </motion.div>

        <div className="hidden sm:flex items-center gap-6">
          <nav className="flex items-center gap-6">
            <a href="#" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">规则详解</a>
            <a href="#" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">在线对战</a>
          </nav>
          <div className="h-4 w-px bg-zinc-800" />
          <button className="px-4 py-2 bg-white text-zinc-950 text-xs font-bold rounded-lg hover:bg-zinc-200 transition-colors">
            关于项目
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-4 flex flex-col items-center justify-center relative z-20">
        <LaoZhuQi />
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-8 border-t border-zinc-900 flex flex-col md:flex-row items-center justify-between gap-6 text-zinc-500 relative z-20">
        <div className="text-[11px] font-medium tracking-wide">
          &copy; 2026 老猪棋项目 (Lao Zhu Qi). 基于中国民间传统规则开发.
        </div>
        <div className="flex items-center gap-8 text-[11px] font-bold uppercase tracking-wider">
          <span className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            系统运行中
          </span>
          <a href="https://ais.studio" className="hover:text-zinc-300 transition-colors">AI Studio 构建</a>
        </div>
      </footer>
    </div>
  );
};

export default App;
