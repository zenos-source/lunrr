'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({ totalKeys: 0, activeKeys: 0, totalUsers: 0, revenue: 0 });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetch('/api/stats').then(res => res.json()).then(setStats);
    fetch('/api/charts').then(res => res.json()).then(setChartData);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-gray-400 text-sm">Total Keys</div>
          <div className="text-3xl font-bold">{stats.totalKeys}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm">Active Keys</div>
          <div className="text-3xl font-bold text-green-500">{stats.activeKeys}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm">Total Users</div>
          <div className="text-3xl font-bold">{stats.totalUsers}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm">Revenue</div>
          <div className="text-3xl font-bold text-primary">${stats.revenue}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-4">Key Redemptions (30 days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis dataKey="date" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip contentStyle={{ backgroundColor: '#1e1e2e', border: 'none' }} />
            <Line type="monotone" dataKey="redemptions" stroke="#5865f2" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/keys" className="card hover:border-primary transition-all">
          <div className="text-2xl mb-2">🔑</div>
          <div className="font-semibold">Manage Keys</div>
          <div className="text-sm text-gray-400">Generate, revoke, extend licenses</div>
        </Link>
        <Link href="/users" className="card hover:border-primary transition-all">
          <div className="text-2xl mb-2">👥</div>
          <div className="font-semibold">Whitelist Users</div>
          <div className="text-sm text-gray-400">Manage user access and HWIDs</div>
        </Link>
        <Link href="/projects" className="card hover:border-primary transition-all">
          <div className="text-2xl mb-2">📁</div>
          <div className="font-semibold">Projects</div>
          <div className="text-sm text-gray-400">Configure scripts and settings</div>
        </Link>
      </div>
    </div>
  );
}
