'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/session').then(res => res.json()).then(setUser);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-secondary p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">⚡ Luarmor</h1>
          <div className="flex gap-4">
            {user ? (
              <Link href="/dashboard" className="btn-primary">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="text-white hover:text-primary">Login</Link>
                <Link href="/register" className="btn-primary">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl font-bold mb-6"
        >
          Protect Your <span className="text-primary">Lua Scripts</span>
        </motion.h1>
        <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
          Advanced license management for Roblox executors. Generate keys, whitelist users, track analytics.
        </p>
        <Link href="/register" className="btn-primary text-lg px-8 py-3">Get Started →</Link>
      </section>
    </div>
  );
}
