import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import './Login.css'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (mode === 'forgot') {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/CATwala/login',
      })
      setLoading(false)
      if (resetError) {
        setError(resetError.message)
      } else {
        setSuccess('Password reset link sent! Check your email.')
      }
      return
    }

    if (mode === 'signup') {
      if (!firstName.trim()) {
        setError('First name is required')
        setLoading(false)
        return
      }
      if (!phone.trim() || phone.trim().length < 10) {
        setError('Please enter a valid mobile number')
        setLoading(false)
        return
      }

      const { error: authError } = await signUp(email, password, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone: phone.trim(),
      })

      setLoading(false)

      if (authError) {
        setError(authError.message)
        return
      }

      navigate('/')
      return
    }

    // login
    const { error: authError } = await signIn(email, password)
    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    navigate('/')
  }

  function switchMode(newMode) {
    setMode(newMode)
    setError('')
    setSuccess('')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-cat">CAT</span>
          <span className="logo-wala">Wala</span>
        </div>
        <p className="login-tagline">India's most realistic CAT mock test</p>

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'signup' && (
            <>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="First Name *"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <input
                type="tel"
                placeholder="Mobile Number *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </>
          )}
          <input
            type="email"
            placeholder="Email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {mode !== 'forgot' && (
            <input
              type="password"
              placeholder="Password * (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          )}
          {error && <div className="login-error">{error}</div>}
          {success && <div className="login-success">{success}</div>}
          <button type="submit" className="btn-login" disabled={loading}>
            {loading
              ? 'Please wait...'
              : mode === 'signup'
                ? 'Create Account'
                : mode === 'forgot'
                  ? 'Send Reset Link'
                  : 'Log In'}
          </button>
        </form>

        {mode === 'login' && (
          <button className="btn-forgot" onClick={() => switchMode('forgot')}>
            Forgot password?
          </button>
        )}

        {mode === 'forgot' && (
          <button className="btn-toggle-mode" onClick={() => switchMode('login')}>
            Back to login
          </button>
        )}

        {mode !== 'forgot' && (
          <button
            className="btn-toggle-mode"
            onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
          >
            {mode === 'signup' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
          </button>
        )}
      </div>
    </div>
  )
}
