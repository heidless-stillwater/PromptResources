'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function ApiDocsPage() {
    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <h1 style={{ marginBottom: 'var(--space-3)' }}>📡 API Documentation</h1>
                    <p style={{
                        color: 'var(--text-muted)',
                        marginBottom: 'var(--space-8)',
                    }}>
                        Access PromptResources data programmatically. Placeholder API key authentication is used for development.
                    </p>

                    {/* Authentication */}
                    <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ marginBottom: 'var(--space-4)' }}>🔑 Authentication</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                            For member-specific endpoints, include your API key via header or query parameter:
                        </p>
                        <div style={{
                            background: 'var(--bg-input)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-4)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-primary)',
                            overflow: 'auto',
                        }}>
                            <div style={{ color: 'var(--text-muted)' }}>// Header method</div>
                            <div>x-api-key: pr_placeholder_api_key_change_me</div>
                            <br />
                            <div style={{ color: 'var(--text-muted)' }}>// Query parameter method</div>
                            <div>?apiKey=pr_placeholder_api_key_change_me</div>
                        </div>
                    </div>

                    {/* Endpoints */}
                    <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ marginBottom: 'var(--space-5)' }}>📋 Endpoints</h3>

                        {/* GET /api/resources */}
                        <div style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            paddingBottom: 'var(--space-5)',
                            marginBottom: 'var(--space-5)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                <span className="badge badge-success">GET</span>
                                <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>/api/resources</code>
                            </div>
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                                List all resources with optional filtering and pagination.
                            </p>
                            <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Query Parameters</h4>
                            <div className="table-wrapper">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Parameter</th>
                                            <th>Type</th>
                                            <th>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><code>platform</code></td>
                                            <td>string</td>
                                            <td>Filter by platform (gemini, nanobanana, chatgpt, claude, midjourney, general)</td>
                                        </tr>
                                        <tr>
                                            <td><code>pricing</code></td>
                                            <td>string</td>
                                            <td>Filter by pricing (free, paid, freemium)</td>
                                        </tr>
                                        <tr>
                                            <td><code>type</code></td>
                                            <td>string</td>
                                            <td>Filter by type (video, article, tool, course, book, tutorial)</td>
                                        </tr>
                                        <tr>
                                            <td><code>category</code></td>
                                            <td>string</td>
                                            <td>Filter by category name</td>
                                        </tr>
                                        <tr>
                                            <td><code>search</code></td>
                                            <td>string</td>
                                            <td>Search in title and description</td>
                                        </tr>
                                        <tr>
                                            <td><code>page</code></td>
                                            <td>number</td>
                                            <td>Page number (default: 1)</td>
                                        </tr>
                                        <tr>
                                            <td><code>pageSize</code></td>
                                            <td>number</td>
                                            <td>Results per page (default: 20, max: 100)</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* GET /api/resources/[id] */}
                        <div style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            paddingBottom: 'var(--space-5)',
                            marginBottom: 'var(--space-5)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                <span className="badge badge-success">GET</span>
                                <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>/api/resources/[id]</code>
                            </div>
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                Get a single resource by its ID. Returns full resource details including categories, credits, and metadata.
                            </p>
                        </div>

                        {/* GET /api/member/[uid] */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                <span className="badge badge-success">GET</span>
                                <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>/api/member/[uid]</code>
                                <span className="badge badge-warning">Auth Required</span>
                            </div>
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                                Get all data related to a specific member account. Requires API key authentication.
                            </p>
                            <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Response</h4>
                            <div style={{
                                background: 'var(--bg-input)',
                                borderRadius: 'var(--radius-md)',
                                padding: 'var(--space-4)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-primary)',
                                overflow: 'auto',
                                whiteSpace: 'pre',
                            }}>
                                {`{
  "success": true,
  "data": {
    "profile": {
      "uid": "...",
      "email": "...",
      "displayName": "...",
      "role": "member",
      "subscriptionType": "free",
      "createdAt": "2024-..."
    },
    "savedResources": [...],
    "notes": { "resourceId": "note text" },
    "progress": { "resourceId": "completed" },
    "stats": {
      "totalSaved": 5,
      "totalCompleted": 2,
      "totalInProgress": 1
    }
  }
}`}
                            </div>
                        </div>
                    </div>

                    {/* Example Usage */}
                    <div className="glass-card">
                        <h3 style={{ marginBottom: 'var(--space-4)' }}>💡 Example Usage</h3>
                        <div style={{
                            background: 'var(--bg-input)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-4)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-primary)',
                            overflow: 'auto',
                            whiteSpace: 'pre',
                        }}>
                            {`// Fetch all free Gemini resources
fetch('/api/resources?platform=gemini&pricing=free')
  .then(res => res.json())
  .then(data => console.log(data));

// Fetch member data
fetch('/api/member/USER_UID', {
  headers: { 'x-api-key': 'your_api_key' }
})
  .then(res => res.json())
  .then(data => console.log(data));`}
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
