import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "")

function App() {
  // Backend health status
  const [status, setStatus] = useState('checking')
  const [errorMessage, setErrorMessage] = useState('')

  // Issue form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdIssueId, setCreatedIssueId] = useState(null)
  const [triageResult, setTriageResult] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [triageError, setTriageError] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        if (data.status === 'ok') {
          setStatus('connected')
        } else {
          throw new Error('Unexpected response format')
        }
      })
      .catch((err) => {
        setStatus('error')
        setErrorMessage(err.message || 'Failed to fetch')
      })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    setTriageError('')
    setCreatedIssueId(null)
    setTriageResult(null)

    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()
    const trimmedLocation = location.trim()

    if (!trimmedTitle || !trimmedDescription || !trimmedLocation) {
      setSubmitError('All fields are required and cannot be whitespace only.')
      return
    }

    setIsSubmitting(true)

    const payload = {
      title: trimmedTitle,
      description: trimmedDescription,
      location: trimmedLocation,
    }

    try {
      // 1. Create issue in backend
      const issueRes = await fetch(`${API_URL}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const issueData = await issueRes.json()

      if (!issueRes.ok) {
        let msg = 'Failed to submit issue'
        if (issueData && issueData.detail) {
          msg = typeof issueData.detail === 'string'
            ? issueData.detail
            : issueData.detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
        }
        throw new Error(msg)
      }

      setCreatedIssueId(issueData.id)

      // 2. Perform AI triage with Gemini
      try {
        const triageRes = await fetch(`${API_URL}/triage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const triageData = await triageRes.json()

        if (!triageRes.ok) {
          throw new Error(triageData.detail || `AI Triage failed with HTTP ${triageRes.status}`)
        }

        setTriageResult(triageData)
      } catch (aiErr) {
        setTriageError(aiErr.message || 'AI Triage service was unable to evaluate this issue.')
      }

      // Reset form fields
      setTitle('')
      setDescription('')
      setLocation('')
    } catch (err) {
      setSubmitError(err.message || 'Network error occurred while submitting issue')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getUrgencyBadgeStyle = (urgency) => {
    switch (urgency) {
      case 'high':
        return { backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #f87171' }
      case 'medium':
        return { backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fbbf24' }
      case 'low':
      default:
        return { backgroundColor: '#d1fae5', color: '#047857', border: '1px solid #34d399' }
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '640px', margin: '0 auto' }}>
      <h1>CivicFix AI</h1>
      <p style={{ color: '#6b7280' }}>Local issue reporting and intelligent AI triage assistant</p>

      {/* Backend connection status */}
      <div style={{ marginTop: '1.5rem', padding: '0.85rem 1rem', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
        {status === 'checking' && <p style={{ margin: 0 }}>Checking backend connection…</p>}
        {status === 'connected' && (
          <p style={{ margin: 0, color: '#16a34a', fontWeight: 600 }}>● Backend connected</p>
        )}
        {status === 'error' && (
          <p style={{ margin: 0, color: '#dc2626' }}>
            ● Connection failed: {errorMessage}
          </p>
        )}
      </div>

      {/* Issue report form */}
      <section style={{ marginTop: '2rem' }}>
        <h2>Report an Issue</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="title" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Hazardous deep pothole"
              required
              style={{ width: '100%', padding: '0.6rem', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div>
            <label htmlFor="description" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>
              Description
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue, hazards, or impact..."
              required
              style={{ width: '100%', padding: '0.6rem', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div>
            <label htmlFor="location" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>
              Location
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Main Street & 4th Avenue"
              required
              style={{ width: '100%', padding: '0.6rem', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              backgroundColor: isSubmitting ? '#9ca3af' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              transition: 'background-color 0.2s',
            }}
          >
            {isSubmitting ? 'Submitting & Triaging with Gemini…' : 'Submit Issue & Triage with AI'}
          </button>
        </form>

        {/* Submission Failure */}
        {submitError && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.85rem 1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #ef4444',
              borderRadius: '6px',
              color: '#991b1b',
            }}
          >
            <strong>Submission Error:</strong> {submitError}
          </div>
        )}

        {/* Success + Triage Card */}
        {createdIssueId && (
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1.25rem',
              backgroundColor: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: '#047857', fontWeight: 700, fontSize: '1.1rem' }}>
                ✓ Issue Created (#{createdIssueId})
              </span>
            </div>

            {/* AI Triage Information */}
            {triageResult && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>AI Assessment:</span>
                  <span
                    style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '9999px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      ...getUrgencyBadgeStyle(triageResult.urgency),
                    }}
                  >
                    {triageResult.urgency} urgency
                  </span>
                  <span
                    style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '9999px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      backgroundColor: '#e0e7ff',
                      color: '#4338ca',
                      border: '1px solid #c7d2fe',
                      textTransform: 'capitalize',
                    }}
                  >
                    {triageResult.category}
                  </span>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#374151' }}>Summary:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#4b5563', fontSize: '0.95rem' }}>
                    {triageResult.summary}
                  </p>
                </div>

                <div
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#f8fafc',
                    borderLeft: '4px solid #3b82f6',
                    borderRadius: '4px',
                  }}
                >
                  <strong style={{ fontSize: '0.9rem', color: '#1e3a8a' }}>Suggested Action:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#1e40af', fontSize: '0.95rem' }}>
                    {triageResult.suggested_action}
                  </p>
                </div>
              </div>
            )}

            {/* Triage error warning if issue was saved but AI triage had an issue */}
            {triageError && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  color: '#92400e',
                  fontSize: '0.9rem',
                }}
              >
                <strong>Note:</strong> Issue was saved, but AI triage could not complete: {triageError}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

export default App
